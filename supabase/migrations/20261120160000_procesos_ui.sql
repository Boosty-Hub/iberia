-- =============================================================================
-- PLATAFORMA IBERIA · ETAPA 1 · lo que piden las pantallas de procesos y
-- documentos: búsqueda sin acentos, conteos, escenarios de procesos y su ruta
--
--   · `sgc.buscar_documentos`: la biblioteca se pagina y se filtra EN LA BASE
--     (son más de mil documentos y la API corta en mil). La búsqueda ignora
--     tildes y mayúsculas, y mira código, título y alias. Corre con los permisos
--     de quien pregunta: el perímetro lo sigue cerrando la RLS.
--   · `sgc.conteo_documentos`: cuántos documentos cuelgan de cada proceso.
--   · Escenarios de procesos (E1.6): un escenario copia un subárbol vigente en
--     filas con `escenario_id`; se edita libre; se compara contra la realidad;
--     se envía con fecha; al aprobarse, se publica con «vigente desde».
--     Lo de antes queda cerrado, no borrado.
--   · `sgc.activar_programados`: lo publicado con fecha futura entra en vigor
--     cuando llega su día (las pantallas lo llaman al abrir; no hay cron).
--   · `flujo.al_decidir` en versión nueva: conserva todas sus ramas y suma la
--     del escenario de procesos.
-- =============================================================================

create extension if not exists unaccent with schema extensions;

-- El subárbol que copió el escenario (nulo = el catálogo completo).
alter table org.escenario add column if not exists proceso_raiz_ref uuid;

-- -----------------------------------------------------------------------------
-- 1) DOCUMENTOS: búsqueda paginada y opciones de los filtros
-- -----------------------------------------------------------------------------

-- Texto comparable: sin tildes, en minúsculas. `unaccent` no es inmutable, así
-- que va en una función propia y no en una columna generada.
create or replace function sgc.plano(p text)
returns text language sql stable set search_path = extensions, public as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')));
$$;

create or replace function sgc.buscar_documentos(
  p_texto     text default null,
  p_estado    text default null,
  p_xx        text default null,
  p_yy        text default null,
  p_familia   text default null,
  p_perimetro text default null,
  p_proceso   uuid default null,
  p_desde     integer default 0,
  p_limite    integer default 50
)
returns table (
  id uuid, codigo text, titulo text, proceso_xx text, tipo_yy text, proceso_ref uuid, version text,
  fecha date, estado text, perimetro text, datos_sensibles boolean, familia text, alias text[], total bigint
)
language sql stable security invoker set search_path = sgc, public, extensions as $$
  select d.id, d.codigo, d.titulo, d.proceso_xx, d.tipo_yy, d.proceso_ref, d.version, d.fecha, d.estado,
         d.perimetro, d.datos_sensibles, d.familia, d.alias, count(*) over () as total
    from sgc.documento d
   where (p_estado is null or d.estado = p_estado)
     and (p_xx is null or d.proceso_xx = p_xx)
     and (p_yy is null or d.tipo_yy = p_yy)
     and (p_familia is null or d.familia = p_familia)
     and (p_perimetro is null or d.perimetro = p_perimetro)
     and (p_proceso is null or d.proceso_ref = p_proceso)
     and (coalesce(trim(p_texto), '') = ''
          or sgc.plano(d.codigo || ' ' || d.titulo || ' ' || array_to_string(d.alias, ' '))
             like '%' || sgc.plano(trim(p_texto)) || '%')
   order by d.codigo, d.titulo
  offset greatest(p_desde, 0)
   limit least(greatest(p_limite, 1), 200);
$$;

-- Los valores que existen para cada filtro (con su cuenta), sin bajar la tabla.
create or replace function sgc.opciones_documentos()
returns table (campo text, valor text, total bigint)
language sql stable security invoker set search_path = sgc, public as $$
  select 'estado', estado, count(*) from sgc.documento group by estado
  union all
  select 'proceso_xx', proceso_xx, count(*) from sgc.documento where proceso_xx is not null group by proceso_xx
  union all
  select 'tipo_yy', tipo_yy, count(*) from sgc.documento where tipo_yy is not null group by tipo_yy
  union all
  select 'familia', familia, count(*) from sgc.documento where familia is not null group by familia
  union all
  select 'perimetro', perimetro, count(*) from sgc.documento group by perimetro;
$$;

create or replace function sgc.conteo_documentos()
returns table (proceso_ref uuid, total bigint, vigentes bigint)
language sql stable security invoker set search_path = sgc, public as $$
  select proceso_ref, count(*), count(*) filter (where estado = 'vigente')
    from sgc.documento where proceso_ref is not null group by proceso_ref;
$$;

-- -----------------------------------------------------------------------------
-- 2) LO PUBLICADO CON FECHA FUTURA
-- -----------------------------------------------------------------------------
-- Una versión «aprobada» espera su «vigente desde»; la vigente que la precede
-- tiene la vigencia cerrada en esa fecha. Al llegar el día: la vieja pasa a
-- reemplazada (o retirada, si no tiene sucesora) y la aprobada a vigente.
create or replace function sgc.activar_programados()
returns integer
language plpgsql security definer set search_path = sgc, public as $$
declare
  n integer := 0;
  m integer;
begin
  update sgc.proceso p
     set estado = case when exists (select 1 from sgc.proceso q
                                     where q.ref = p.ref and q.escenario_id is null and q.estado = 'aprobada'
                                       and lower(q.vigencia) <= current_date)
                       then 'reemplazada' else 'retirada' end
   where p.escenario_id is null and p.estado = 'vigente'
     and upper(p.vigencia) is not null and upper(p.vigencia) <= current_date;
  get diagnostics n = row_count;
  update sgc.proceso set estado = 'vigente'
   where escenario_id is null and estado = 'aprobada' and lower(vigencia) <= current_date;
  get diagnostics m = row_count;
  return n + m;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) ESCENARIOS DE PROCESOS
-- -----------------------------------------------------------------------------

-- Copia el subárbol vigente (o el catálogo entero) en filas del escenario. Las
-- copias nacen en «borrador»: dentro del escenario se editan libres, y el
-- trigger de inmutabilidad solo protege lo publicado.
create or replace function sgc.crear_escenario_procesos(p_nombre text, p_descripcion text default null, p_raiz uuid default null)
returns uuid
language plpgsql security invoker set search_path = sgc, org, public as $$
declare
  v_id uuid;
begin
  if not public.puede('sistema:escenarios', 'crear') then
    raise exception 'Sin permiso para crear escenarios' using errcode = 'insufficient_privilege';
  end if;
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Sin permiso para editar procesos' using errcode = 'insufficient_privilege';
  end if;
  insert into org.escenario (nombre, descripcion, alcance, fecha_base, proceso_raiz_ref)
  values (p_nombre, p_descripcion, 'procesos', current_date, p_raiz) returning id into v_id;

  insert into sgc.proceso (ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe,
                           estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha, estado, version,
                           escenario_id, fuente, nota)
  with recursive arbol as (
    select * from sgc.proceso
     where escenario_id is null and estado = 'vigente'
       and (case when p_raiz is null then padre_ref is null else ref = p_raiz end)
    union all
    select h.* from sgc.proceso h join arbol a on h.padre_ref = a.ref
     where h.escenario_id is null and h.estado = 'vigente'
  )
  select ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe,
         estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha, 'borrador', version,
         v_id, fuente, nota
    from arbol;
  return v_id;
end;
$$;

-- Qué cambia el escenario contra la realidad de hoy. Solo cuenta lo que el
-- escenario tiene: un proceso que la realidad sumó después de copiar no es una
-- baja. Baja = la copia está «retirada»; alta = no existe vigente en la realidad.
create or replace function sgc.comparar_escenario_procesos(p_escenario uuid)
returns table (ref uuid, nivel smallint, nombre text, cambio text, campos text[], antes jsonb, despues jsonb, borrador_abierto boolean)
language sql stable security invoker set search_path = sgc, public as $$
  with e as (select * from sgc.proceso where escenario_id = p_escenario),
  r as (select * from sgc.proceso where escenario_id is null and estado = 'vigente')
  select e.ref, e.nivel, e.nombre,
         case when r.ref is null then 'alta' when e.estado = 'retirada' then 'baja' else 'cambio' end,
         case when r.ref is null or e.estado = 'retirada' then '{}'::text[] else array_remove(array[
           case when e.nombre is distinct from r.nombre then 'nombre' end,
           case when e.padre_ref is distinct from r.padre_ref then 'padre' end,
           case when (e.dueno_plaza_ref, e.dueno_texto) is distinct from (r.dueno_plaza_ref, r.dueno_texto) then 'dueno' end,
           case when e.tipo is distinct from r.tipo then 'tipo' end,
           case when e.estado_operativo is distinct from r.estado_operativo then 'estado_operativo' end,
           case when (e.codigo_sgc, e.codigo_informe) is distinct from (r.codigo_sgc, r.codigo_informe) then 'codigos' end,
           case when e.ficha is distinct from r.ficha then 'ficha' end,
           case when e.orden is distinct from r.orden then 'orden' end
         ], null) end,
         case when r.ref is not null then jsonb_build_object(
           'nombre', r.nombre, 'padre_ref', r.padre_ref, 'dueno_plaza_ref', r.dueno_plaza_ref, 'dueno_texto', r.dueno_texto,
           'tipo', r.tipo, 'estado_operativo', r.estado_operativo, 'codigo_sgc', r.codigo_sgc, 'codigo_informe', r.codigo_informe,
           'version', r.version) end,
         jsonb_build_object(
           'nombre', e.nombre, 'padre_ref', e.padre_ref, 'dueno_plaza_ref', e.dueno_plaza_ref, 'dueno_texto', e.dueno_texto,
           'tipo', e.tipo, 'estado_operativo', e.estado_operativo, 'codigo_sgc', e.codigo_sgc, 'codigo_informe', e.codigo_informe),
         exists (select 1 from sgc.proceso b where b.ref = e.ref and b.escenario_id is null and b.estado in ('borrador', 'en_revision'))
    from e left join r on r.ref = e.ref
   where (r.ref is null and e.estado <> 'retirada')
      or (r.ref is not null and e.estado = 'retirada')
      or (r.ref is not null and (e.nombre, e.padre_ref, e.dueno_plaza_ref, e.dueno_texto, e.tipo, e.estado_operativo,
                                 e.codigo_sgc, e.codigo_informe, e.ficha, e.orden)
                                is distinct from
                                (r.nombre, r.padre_ref, r.dueno_plaza_ref, r.dueno_texto, r.tipo, r.estado_operativo,
                                 r.codigo_sgc, r.codigo_informe, r.ficha, r.orden));
$$;

create or replace function sgc.enviar_escenario_procesos(p_esc uuid, p_vigente_desde date)
returns uuid
language plpgsql security definer set search_path = sgc, org, flujo, public as $$
declare
  e org.escenario;
  v_unidad uuid;
begin
  if not public.puede('sistema:escenarios', 'editar') then
    raise exception 'Sin permiso para enviar escenarios' using errcode = 'insufficient_privilege';
  end if;
  select * into e from org.escenario where id = p_esc for update;
  if not found or e.alcance <> 'procesos' then raise exception 'El escenario de procesos no existe'; end if;
  if e.estado <> 'borrador' then raise exception 'Solo se envía un escenario en borrador' using errcode = 'check_violation'; end if;
  if p_vigente_desde is null or p_vigente_desde < current_date then
    raise exception 'La vigencia retroactiva no se permite' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from sgc.comparar_escenario_procesos(p_esc)) then
    raise exception 'El escenario no cambia nada respecto de la realidad' using errcode = 'check_violation';
  end if;
  if exists (select 1 from sgc.comparar_escenario_procesos(p_esc) where borrador_abierto) then
    raise exception 'Hay procesos de este escenario con un borrador abierto en la realidad: ciérralo antes de enviar'
      using errcode = 'check_violation';
  end if;
  select p.unidad_ref into v_unidad
    from sgc.proceso x join org.plaza p on p.ref = x.dueno_plaza_ref and p.escenario_id is null
   where x.ref = e.proceso_raiz_ref and x.escenario_id is null and x.estado = 'vigente' limit 1;
  update org.escenario set estado = 'en_aprobacion', vigente_desde = p_vigente_desde where id = p_esc;
  return flujo.iniciar('escenario_procesos', p_esc, format('Escenario de procesos · %s', e.nombre), v_unidad, '{}');
end;
$$;

-- Aplica el escenario a la realidad con su «vigente desde». Si la fecha es hoy
-- (o ya pasó), entra en vigor en el acto; si es futura, la versión nueva queda
-- «aprobada» y la vieja con la vigencia cerrada en esa fecha.
create or replace function sgc.publicar_escenario_procesos(p_esc uuid)
returns void
language plpgsql security definer set search_path = sgc, org, public as $$
declare
  e org.escenario;
  d date;
  v_ya boolean;
  c record;
  v_ver integer;
begin
  select * into e from org.escenario where id = p_esc for update;
  if e.estado = 'publicado' then return; end if;
  d := greatest(coalesce(e.vigente_desde, current_date), current_date);
  v_ya := d <= current_date;

  for c in select * from sgc.comparar_escenario_procesos(p_esc) loop
    if c.cambio in ('baja', 'cambio') then
      update sgc.proceso
         set estado = case when not v_ya then 'vigente'
                           when c.cambio = 'baja' then 'retirada' else 'reemplazada' end,
             vigencia = case when lower(vigencia) >= d then null else daterange(lower(vigencia), d) end
       where ref = c.ref and escenario_id is null and estado = 'vigente';
    end if;
    if c.cambio in ('alta', 'cambio') then
      select coalesce(max(version), 0) + 1 into v_ver from sgc.proceso where ref = c.ref and escenario_id is null;
      insert into sgc.proceso (ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe,
                               estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha, estado, version,
                               vigencia, fuente, nota, creado_por)
      select ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe,
             estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha,
             case when v_ya then 'vigente' else 'aprobada' end, v_ver,
             daterange(d, null), fuente || array[format('escenario:%s', e.id)], nota, e.creado_por
        from sgc.proceso where ref = c.ref and escenario_id = p_esc;
    end if;
  end loop;
  update org.escenario set estado = 'publicado', publicado_en = now() where id = p_esc;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) LA RUTA DEL ESCENARIO DE PROCESOS y su efecto al decidirse
-- -----------------------------------------------------------------------------

insert into flujo.ruta (tipo_objeto, nombre, descripcion, vigencia)
select 'escenario_procesos', 'Escenario de procesos',
       'Revisa la Coordinación del SGC y aprueba la Gerencia de Calidad y Desarrollo; al aprobarse se publica con su «vigente desde».',
       daterange(date '2026-01-01', null)
 where not exists (select 1 from flujo.ruta where tipo_objeto = 'escenario_procesos');

insert into flujo.ruta_paso (ruta_id, orden, nombre, resolutor, cargo_id, accion, hito)
select r.id, x.orden, x.nombre, 'cargo', (select id from org.cargo where clave = x.cargo), 'aprobar', x.hito
  from flujo.ruta r
 cross join (values
   (1, 'Coordinación del SGC · revisa', 'coordinador-sgc', false),
   (2, 'Gerente de Calidad y Desarrollo · aprueba', 'gerente-calidad-desarrollo', true)
 ) as x(orden, nombre, cargo, hito)
 where r.tipo_objeto = 'escenario_procesos'
   and not exists (select 1 from flujo.ruta_paso p where p.ruta_id = r.id);

-- Versión nueva: las mismas ramas de antes, más el escenario de procesos.
create or replace function flujo.al_decidir(p_tipo text, p_objeto uuid, p_accion text, p_hito boolean, p_decision text, p_estado_solicitud text)
returns void
language plpgsql security definer set search_path = flujo, org, sgc, public as $$
begin
  if p_tipo = 'requisicion_personal' then
    if p_decision = 'rechazado' then
      update org.requisicion set estado = 'rechazada' where id = p_objeto;
    elsif p_decision = 'devuelto' then
      update org.requisicion set estado = 'devuelta' where id = p_objeto;
    elsif p_hito then
      update org.requisicion set estado = 'aprobada' where id = p_objeto;
      perform org.aplicar_requisicion(p_objeto);
    elsif p_accion = 'recibir' then
      update org.requisicion set estado = 'en_seleccion' where id = p_objeto;
    end if;
  elsif p_tipo = 'proceso' then
    if p_decision = 'rechazado' or p_decision = 'devuelto' then
      update sgc.proceso set estado = 'borrador' where id = p_objeto and estado = 'en_revision';
    elsif p_estado_solicitud = 'aprobada' then
      perform sgc.publicar_proceso(p_objeto);
    end if;
  elsif p_tipo = 'escenario_estructura' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform org.publicar_escenario(p_objeto);
    end if;
  elsif p_tipo = 'escenario_procesos' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform sgc.publicar_escenario_procesos(p_objeto);
    end if;
  end if;
end;
$$;

grant execute on function sgc.plano(text) to authenticated;
grant execute on function sgc.buscar_documentos(text, text, text, text, text, text, uuid, integer, integer) to authenticated;
grant execute on function sgc.opciones_documentos() to authenticated;
grant execute on function sgc.conteo_documentos() to authenticated;
grant execute on function sgc.activar_programados() to authenticated;
grant execute on function sgc.crear_escenario_procesos(text, text, uuid) to authenticated;
grant execute on function sgc.comparar_escenario_procesos(uuid) to authenticated;
grant execute on function sgc.enviar_escenario_procesos(uuid, date) to authenticated;
revoke execute on function sgc.publicar_escenario_procesos(uuid) from authenticated, public;
revoke execute on function flujo.al_decidir(text, uuid, text, boolean, text, text) from authenticated, public;
grant execute on all functions in schema sgc, flujo to service_role;

-- ⚠️ Arreglo: la migración de funciones revocó estas de `authenticated`, pero
-- Postgres da EXECUTE a PUBLIC al crear una función, y `authenticated` lo
-- heredaba: cualquiera con sesión podía publicar un proceso sin aprobación
-- (`sgc.publicar_proceso`) o abrir solicitudes a mano (`flujo.iniciar`).
revoke execute on function sgc.publicar_proceso(uuid) from public;
revoke execute on function flujo.iniciar(text, uuid, text, uuid, jsonb) from public;
revoke execute on function org.aplicar_requisicion(uuid) from public;
revoke execute on function org.publicar_escenario(uuid) from public;
