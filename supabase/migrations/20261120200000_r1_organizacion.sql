-- =============================================================================
-- PLATAFORMA IBERIA · R1 · Organización con el diseño que pone el dato primero
-- (Anexo E §9 y §10). La lógica de la Etapa 1 no cambia: aquí van las fuentes
-- planas que leen las tablas nuevas (`TablaDatos`) y lo poco que faltaba.
--
--   1) `ui.fuente_legible()`: la fuente de un dato como se lee —«Organigrama
--      General y Direcciones II-21-14-010 · 2026»—, nunca la ruta del disco.
--   2) Fuentes de tabla (todas `security invoker` salvo donde se dice): personas
--      que ocupan plazas, catálogo de cargos con sus cuentas, dotación por
--      unidad y cargo contra el plan, requisiciones con quién la tiene y cuántos
--      días lleva, escenarios con sus deltas, la cola de conciliación y el
--      historial de la estructura con el cambio escrito para leerse.
--   3) Costos (perímetro de nómina, `sistema:costos`): la tasa BCV vigente por
--      fecha valor sale de `control.tasa_cambio` (la tabla nueva) con
--      `org.tasa_cambio` de respaldo; el costo por cargo, por componente, por
--      parámetro y por unidad = Σ dotación × costo mensual de referencia.
--   4) La auditoría de lo que es perímetro (costos, parámetros, salario
--      propuesto) solo la lee quien tiene `sistema:costos`: hasta hoy bastaba
--      con el permiso de auditoría para leer los montos en el «antes/después».
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) LA FUENTE, LEGIBLE
-- -----------------------------------------------------------------------------
-- Una o varias rutas separadas por « ; », cada una con una nota opcional al
-- final («(caja sin dotación)», «§5.1»). De cada archivo queda el título, el
-- código II-XX-YY-NNN y el año; la carpeta no sale nunca.
create or replace function ui.fuente_legible(p text)
returns text
language plpgsql immutable set search_path = pg_catalog as $$
declare
  parte text;
  ruta text;
  resto text;
  base text;
  codigo text;
  anio text;
  titulo text;
  uno text;
  salida text[] := '{}';
begin
  if p is null or btrim(p) = '' then return null; end if;
  if p !~ '[\\/]' then return p; end if;
  foreach parte in array regexp_split_to_array(btrim(p), '\s+;\s+') loop
    -- La extensión termina en espacio o al final: «.doc» no se come la «x» de «.docx».
    ruta := substring(parte from '^(.*?\.(pdf|docx|doc|xlsx|xls|md|pptx|ppt|txt))(\s|$)');
    if ruta is null then
      ruta := parte;
      resto := null;
    else
      resto := nullif(btrim(substring(parte from length(ruta) + 1)), '');
    end if;
    base := regexp_replace(ruta, '^.*[\\/]', '');
    base := regexp_replace(base, '\.[A-Za-z0-9]{2,4}$', '');
    if ruta ~* '_trabajo' and base ~* 'organizacion' then
      uno := 'Levantamiento de estructura del equipo consultor';
    else
      codigo := substring(base from 'II-[0-9]{2}-[0-9]{2}-[0-9]{3}');
      anio := substring(base from '.*(20[0-9]{2})');
      titulo := base;
      if codigo is not null then titulo := replace(titulo, codigo, ''); end if;
      titulo := regexp_replace(titulo, '\(?\s*rev\.?\s*[0-9]+[^)]*\)?', '', 'gi');
      titulo := regexp_replace(titulo, '20[0-9]{2}', '', 'g');
      titulo := regexp_replace(titulo, '\(\s*\)', '', 'g');
      titulo := regexp_replace(titulo, '\s+', ' ', 'g');
      titulo := btrim(titulo, ' -_.');
      uno := concat_ws(' · ', nullif(btrim(concat_ws(' ', nullif(titulo, ''), codigo)), ''), anio);
      if uno = '' then uno := 'Documento de Iberia'; end if;
    end if;
    if resto is not null then uno := uno || ' ' || resto; end if;
    if not uno = any (salida) then salida := salida || uno; end if;
  end loop;
  return array_to_string(salida, '; ');
end;
$$;
grant execute on function ui.fuente_legible(text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2) FUENTES DE LAS TABLAS
-- -----------------------------------------------------------------------------

-- 2.1 Personas que ocupan plazas al día pedido. Del padrón, solo nombre y ficha:
-- nada de contacto (ni teléfono, ni correo, ni cédula).
create or replace function ui.personas(p_al date default null)
returns table (
  id uuid, empleado_id uuid, nombre text, ficha text, plaza_ref uuid, cargo_id uuid, cargo text,
  unidad_ref uuid, unidad text, direccion text, tipo text, tipo_nombre text, desde date, hasta date,
  certeza text, excede text, busqueda text
)
language sql stable security invoker set search_path = ui, org, public as $$
  with d as (select coalesce(p_al, org.hoy()) as dia)
  select o.id, e.id, e.nombre_completo, e.ficha, o.plaza_ref, c.id, c.nombre,
         p.unidad_ref, u.nombre, dir.nombre,
         o.tipo, ui.etiqueta('tipo_ocupacion', o.tipo),
         lower(o.vigencia), case when upper_inf(o.vigencia) then null else upper(o.vigencia) - 1 end,
         o.certeza, case when o.excede_dotacion then 'si' else 'no' end,
         ui.plano(e.nombre_completo || ' ' || coalesce(e.ficha, '') || ' ' || c.nombre || ' ' || coalesce(u.nombre, ''))
    from org.ocupacion o
    cross join d
    join public.empleados e on e.id = o.empleado_id
    join org.plaza p on p.ref = o.plaza_ref and p.escenario_id is null and p.vigencia @> d.dia
    join org.cargo c on c.id = p.cargo_id
    left join lateral (select x.nombre from org.unidad x
                        where x.ref = p.unidad_ref and x.escenario_id is null and x.vigencia @> d.dia limit 1) u on true
    left join lateral (select x.nombre from org.unidad x
                        where x.ref = org.direccion_de(p.unidad_ref, d.dia) and x.escenario_id is null and x.vigencia @> d.dia limit 1) dir on true
   where o.vigencia @> d.dia and not isempty(o.vigencia);
$$;

-- 2.2 El catálogo de cargos con lo que pesa cada uno en la estructura.
create or replace function ui.cargos(p_al date default null)
returns table (
  id uuid, clave text, nombre text, familia text, familia_nombre text, nivel smallint, sinonimos text, n_sinonimos integer,
  plazas integer, dotacion integer, ocupantes integer, vacantes integer, activo text, busqueda text
)
language sql stable security invoker set search_path = ui, org, public as $$
  with d as (select coalesce(p_al, org.hoy()) as dia),
  pl as (
    select p.cargo_id, p.dotacion,
           (select count(*) from org.ocupacion o
             where o.plaza_ref = p.ref and o.tipo = 'titular' and o.vigencia @> d.dia)::int as ocu
      from org.plaza p, d
     where p.escenario_id is null and p.vigencia @> d.dia and p.estado <> 'cerrada'
  ),
  x as (
    select cargo_id, count(*)::int as plazas, sum(dotacion)::int as dot, sum(ocu)::int as ocu,
           sum(greatest(dotacion - ocu, 0))::int as vac
      from pl group by cargo_id
  )
  select c.id, c.clave, c.nombre, c.familia, ui.etiqueta('familia_cargo', c.familia), c.nivel,
         nullif(array_to_string(c.sinonimos, '; '), ''), cardinality(c.sinonimos),
         coalesce(x.plazas, 0), coalesce(x.dot, 0), coalesce(x.ocu, 0), coalesce(x.vac, 0),
         case when c.activo then 'activo' else 'inactivo' end,
         ui.plano(c.nombre || ' ' || array_to_string(c.sinonimos, ' ') || ' ' || coalesce(c.familia, '') || ' ' || c.clave)
    from org.cargo c
    left join x on x.cargo_id = c.id;
$$;

-- 2.3 Dotación por unidad y cargo: aprobada (plazas), ocupada (titulares),
-- vacantes, por encima, en requisición y el plan del año (aprobado y, si lo
-- hay, el borrador). Sin costos. `security definer` porque «en requisición»
-- cuenta todas las requisiciones vivas aunque quien mira no pueda abrirlas (es
-- una cifra, no su contenido); se cierra por dentro con `sistema:dotacion`.
create or replace function ui.dotacion(p_al date default null, p_anio integer default null)
returns table (
  clave text, unidad_ref uuid, unidad text, direccion_ref uuid, direccion text, cargo_id uuid, cargo text, familia text,
  aprobada integer, ocupada integer, vacantes integer, por_encima integer, en_requisicion integer,
  plan integer, plan_borrador integer, diferencia integer, estado_plan text, busqueda text
)
language sql stable security definer set search_path = ui, org, public as $$
  with d as (
    select coalesce(p_al, org.hoy()) as dia,
           coalesce(p_anio, extract(year from coalesce(p_al, org.hoy()))::int) as anio
  ),
  pl as (
    select p.unidad_ref, p.cargo_id, p.dotacion,
           (select count(*) from org.ocupacion o
             where o.plaza_ref = p.ref and o.tipo = 'titular' and o.vigencia @> d.dia)::int as ocu
      from org.plaza p, d
     where p.escenario_id is null and p.vigencia @> d.dia and p.estado <> 'cerrada'
  ),
  pz as (
    select unidad_ref, cargo_id, sum(dotacion)::int as aprobada, sum(ocu)::int as ocupada,
           sum(greatest(dotacion - ocu, 0))::int as vacantes, sum(greatest(ocu - dotacion, 0))::int as por_encima
      from pl group by 1, 2
  ),
  pa as (select pd.id from org.plan_dotacion pd, d where pd.anio = d.anio and pd.estado = 'aprobado' order by pd.version desc limit 1),
  pb as (select pd.id from org.plan_dotacion pd, d where pd.anio = d.anio and pd.estado = 'borrador' order by pd.version desc limit 1),
  la as (select l.unidad_ref, l.cargo_id, l.cantidad from org.plan_dotacion_linea l where l.plan_id = (select id from pa)),
  lb as (select l.unidad_ref, l.cargo_id, l.cantidad from org.plan_dotacion_linea l where l.plan_id = (select id from pb)),
  rq as (
    select q.unidad_ref, q.cargo_id, sum(q.cantidad)::int as n from org.requisicion q
     where q.estado in ('en_aprobacion', 'aprobada', 'en_seleccion') group by 1, 2
  ),
  k as (
    select unidad_ref, cargo_id from pz union select unidad_ref, cargo_id from la
    union select unidad_ref, cargo_id from lb union select unidad_ref, cargo_id from rq
  )
  select k.unidad_ref::text || ':' || k.cargo_id::text, k.unidad_ref, u.nombre, dir.ref, dir.nombre, k.cargo_id, c.nombre, c.familia,
         coalesce(pz.aprobada, 0), coalesce(pz.ocupada, 0), coalesce(pz.vacantes, 0), coalesce(pz.por_encima, 0), coalesce(rq.n, 0),
         la.cantidad, lb.cantidad,
         case when la.cantidad is null then null else coalesce(pz.aprobada, 0) - la.cantidad end,
         case when la.cantidad is null then 'sin_plan'
              when coalesce(pz.aprobada, 0) > la.cantidad then 'sobre_plan'
              when coalesce(pz.aprobada, 0) < la.cantidad then 'bajo_plan'
              else 'en_plan' end,
         ui.plano(coalesce(u.nombre, '') || ' ' || c.nombre || ' ' || coalesce(dir.nombre, ''))
    from k
    cross join d
    join org.cargo c on c.id = k.cargo_id
    left join pz on pz.unidad_ref = k.unidad_ref and pz.cargo_id = k.cargo_id
    left join la on la.unidad_ref = k.unidad_ref and la.cargo_id = k.cargo_id
    left join lb on lb.unidad_ref = k.unidad_ref and lb.cargo_id = k.cargo_id
    left join rq on rq.unidad_ref = k.unidad_ref and rq.cargo_id = k.cargo_id
    left join lateral (select x.nombre from org.unidad x where x.ref = k.unidad_ref and x.escenario_id is null
                        order by (x.vigencia @> d.dia) desc, lower(x.vigencia) desc limit 1) u on true
    left join lateral (select x.ref, x.nombre from org.unidad x
                        where x.ref = org.direccion_de(k.unidad_ref, d.dia) and x.escenario_id is null and x.vigencia @> d.dia limit 1) dir on true
   where public.puede('sistema:dotacion', 'ver');
$$;

-- 2.4 Quién tiene hoy una requisición y desde cuándo. Responde solo a quien
-- puede ver la requisición (la misma regla de su política): la pidió, tiene el
-- permiso, o firma en su ruta. Los pasos los lee la función, para que Recursos
-- Humanos vea la bandeja completa sin el permiso de rutas.
create or replace function org.paso_actual_requisicion(p_req uuid)
returns table (paso text, quien text, desde timestamptz)
language sql stable security definer set search_path = org, flujo, public as $$
  select p.nombre,
         coalesce(nullif(trim(pr.nombre_completo), ''), pr.email,
                  case when dp.cargo is not null then dp.cargo || ' · ' || coalesce(dp.unidad, '') end,
                  'Sin firmante resuelto'),
         coalesce((select max(z.decidido_en) from flujo.paso z where z.solicitud_id = s.id), s.creado_en)
    from org.requisicion q
    join flujo.solicitud s on s.id = q.solicitud_id and s.estado = 'en_curso'
    join flujo.paso p on p.solicitud_id = s.id and p.orden = s.paso_actual
    left join public.profiles pr on pr.id = p.aprobador_perfil
    left join lateral org.describir_plazas(array[p.aprobador_plaza_ref]) dp on p.aprobador_plaza_ref is not null
   where q.id = p_req
     and auth.uid() is not null
     and (q.creado_por = auth.uid() or public.puede('sistema:requisiciones', 'ver')
          or exists (select 1 from flujo.paso x where x.solicitud_id = s.id and x.aprobador_perfil = auth.uid()));
$$;

create or replace function ui.requisiciones()
returns table (
  id uuid, numero integer, unidad_ref uuid, unidad text, cargo_id uuid, cargo text, origen text, origen_nombre text,
  cantidad integer, estado text, paso text, quien text, esperando_desde timestamptz, dias integer,
  pedida_por text, mia text, creado_en timestamptz, fecha_deseada date, fuera_de_plan text, busqueda text
)
language sql stable security invoker set search_path = ui, org, flujo, public as $$
  select q.id, q.numero, q.unidad_ref, u.nombre, q.cargo_id, c.nombre, q.origen, ui.etiqueta('origen_requisicion', q.origen),
         q.cantidad, q.estado, pa.paso, pa.quien, pa.desde,
         case when pa.desde is not null then (org.hoy() - (pa.desde at time zone 'America/Caracas')::date)
              else (org.hoy() - (q.creado_en at time zone 'America/Caracas')::date) end,
         n.nombre,
         case when q.creado_por = auth.uid() then 'si' else 'no' end,
         q.creado_en, q.fecha_deseada,
         case when (q.impacto ->> 'fuera_de_plan')::boolean then 'si' when q.impacto is null then null else 'no' end,
         ui.plano('n ' || q.numero || ' ' || c.nombre || ' ' || coalesce(u.nombre, '') || ' ' || coalesce(n.nombre, ''))
    from org.requisicion q
    join org.cargo c on c.id = q.cargo_id
    left join lateral (select x.nombre from org.unidad x where x.ref = q.unidad_ref and x.escenario_id is null
                        order by upper_inf(x.vigencia) desc, lower(x.vigencia) desc limit 1) u on true
    left join lateral org.paso_actual_requisicion(q.id) pa on q.estado = 'en_aprobacion'
    left join lateral flujo.nombres(array[q.creado_por]) n on true;
$$;

-- 2.5 Escenarios de estructura con sus deltas contra la realidad de su fecha
-- base (los publicados y descartados no se comparan: ya son historia).
create or replace function ui.escenarios()
returns table (
  id uuid, nombre text, descripcion text, estado text, fecha_base date, vigente_desde date, creado_por text,
  creado_en timestamptz, publicado_en timestamptz, altas integer, bajas integer, cambios integer, delta_dotacion integer, busqueda text
)
language sql stable security invoker set search_path = ui, org, flujo, public as $$
  select e.id, e.nombre, e.descripcion, e.estado, e.fecha_base, e.vigente_desde, n.nombre, e.creado_en, e.publicado_en,
         x.altas, x.bajas, x.cambios, x.delta,
         ui.plano(e.nombre || ' ' || coalesce(e.descripcion, ''))
    from org.escenario e
    left join lateral flujo.nombres(array[e.creado_por]) n on true
    left join lateral (
      select count(*) filter (where cz.cambio = 'alta')::int as altas,
             count(*) filter (where cz.cambio = 'baja')::int as bajas,
             count(*) filter (where cz.cambio not in ('alta', 'baja'))::int as cambios,
             coalesce(sum(case when cz.objeto = 'plaza'
                               then coalesce((cz.despues ->> 'dotacion')::int, 0) - coalesce((cz.antes ->> 'dotacion')::int, 0) end), 0)::int as delta
        from org.comparar_escenario(e.id) cz
    ) x on e.estado in ('borrador', 'en_aprobacion', 'aprobado')
   where e.alcance = 'estructura';
$$;

-- 2.6 La cola de calidad del dato (conciliación), con la fuente legible.
create or replace function ui.conciliacion()
returns table (
  id uuid, modulo text, tipo text, descripcion text, objeto text, fuente text, responsable text, estado text,
  resolucion text, resuelto_por text, resuelto_en timestamptz, creado_en timestamptz, dias integer, busqueda text
)
language sql stable security invoker set search_path = ui, control, flujo, public as $$
  select c.id, c.modulo, c.tipo, c.descripcion, c.objeto, ui.fuente_legible(c.fuente), c.responsable, c.estado,
         c.resolucion, n.nombre, c.resuelto_en, c.creado_en,
         (org.hoy() - (c.creado_en at time zone 'America/Caracas')::date),
         ui.plano(c.descripcion || ' ' || coalesce(c.objeto, '') || ' ' || coalesce(c.responsable, ''))
    from control.conciliacion c
    left join lateral flujo.nombres(array[c.resuelto_por]) n on c.resuelto_por is not null;
$$;

-- 2.7 El historial de la estructura: la auditoría de `org` (y de los
-- parámetros y la conciliación), con el objeto por su nombre y el cambio
-- escrito para leerse. Lo que es perímetro sale solo con `sistema:costos`.
create or replace function ui.valor_legible(p_campo text, p_valor jsonb)
returns text
language plpgsql stable security definer set search_path = ui, org, public as $$
declare
  v text;
  r text;
  a text;
  b text;
begin
  if p_valor is null or p_valor = 'null'::jsonb then return '—'; end if;
  v := case when jsonb_typeof(p_valor) = 'string' then p_valor #>> '{}' else p_valor::text end;
  if p_campo = 'vigencia' then
    if v = 'empty' then return 'sin vigencia (reemplazada)'; end if;
    a := substring(v from '^[\[(]([0-9-]*),');
    b := substring(v from ',([0-9-]*)[\])]$');
    return case when coalesce(b, '') = '' then 'desde ' || to_char(a::date, 'DD/MM/YYYY')
                else 'del ' || to_char(a::date, 'DD/MM/YYYY') || ' al ' || to_char(b::date - 1, 'DD/MM/YYYY') end;
  end if;
  if v ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if p_campo in ('padre_ref', 'unidad_ref') then
      select x.nombre into r from org.unidad x where x.ref = v::uuid and x.escenario_id is null order by upper_inf(x.vigencia) desc, lower(x.vigencia) desc limit 1;
    elsif p_campo in ('reporta_a_ref', 'plaza_ref') then
      select dp.cargo || ' · ' || coalesce(dp.unidad, '') into r from org.describir_plazas(array[v::uuid]) dp;
    elsif p_campo = 'cargo_id' then
      select x.nombre into r from org.cargo x where x.id = v::uuid;
    elsif p_campo in ('empleado_id', 'reemplaza_empleado_id') then
      select x.nombre_completo into r from public.empleados x where x.id = v::uuid;
    end if;
    return coalesce(r, '(otro registro)');
  end if;
  if p_campo = 'fuente' then v := ui.fuente_legible(v); end if;
  if jsonb_typeof(p_valor) = 'boolean' then return case when v = 'true' then 'sí' else 'no' end; end if;
  if length(v) > 70 then v := left(v, 67) || '…'; end if;
  return v;
end;
$$;

create or replace function ui.campo_legible(p text)
returns text language sql immutable as $$
  select case p
    when 'nombre' then 'Nombre' when 'tipo' then 'Tipo' when 'padre_ref' then 'Depende de' when 'sede' then 'Sede'
    when 'codigo_organigrama' then 'Código' when 'vigencia' then 'Vigencia' when 'certeza' then 'Certeza'
    when 'nota' then 'Nota' when 'fuente' then 'Fuente' when 'dotacion' then 'Dotación' when 'reporta_a_ref' then 'Reporta a'
    when 'tipo_nomina' then 'Nómina' when 'estado' then 'Estado' when 'unidad_ref' then 'Unidad' when 'cargo_id' then 'Cargo'
    when 'plaza_ref' then 'Plaza' when 'empleado_id' then 'Persona' when 'motivo' then 'Motivo' when 'familia' then 'Familia'
    when 'nivel' then 'Nivel' when 'sinonimos' then 'Sinónimos' when 'proposito' then 'Propósito' when 'activo' then 'Activo'
    when 'cantidad' then 'Cantidad' when 'salario_mensual' then 'Salario' when 'bonos_usd_mensual' then 'Bonos (USD)'
    when 'moneda' then 'Moneda' when 'valor' then 'Valor' when 'por_confirmar' then 'Por confirmar' when 'base_legal' then 'Base legal'
    when 'excede_dotacion' then 'Por encima de la dotación' when 'justificacion' then 'Justificación' when 'candidato' then 'Candidato'
    when 'fecha_ingreso' then 'Ingreso' when 'resolucion' then 'Resolución' when 'orden' then 'Orden'
    else replace(initcap(replace(p, '_', ' ')), ' De ', ' de ') end;
$$;

create or replace function ui.diff_legible(p_accion text, p_antes jsonb, p_despues jsonb)
returns text
language sql stable security definer set search_path = ui, org, public as $$
  with k as (
    select key from jsonb_object_keys(coalesce(p_despues, '{}'::jsonb)) as key
    union
    select key from jsonb_object_keys(coalesce(p_antes, '{}'::jsonb)) as key
  ),
  c as (
    select key from k
     where key not in ('id', 'ref', 'esc', 'busqueda', 'tipo_cat', 'sede_cat', 'nomina_cat', 'estado_cat', 'familia_cat',
                       'origen_cat', 'escenario_id', 'creado_en', 'creado_por', 'clave', 'area_id', 'impacto', 'perfil',
                       'condiciones', 'solicitud_id', 'hash', 'payload', 'aprobado_por')
       and (p_accion <> 'UPDATE' or p_antes -> key is distinct from p_despues -> key)
       and (p_accion <> 'INSERT' or key in ('nombre', 'dotacion', 'vigencia', 'cantidad', 'tipo', 'estado', 'valor', 'salario_mensual', 'empleado_id', 'cargo_id'))
       and (p_accion <> 'DELETE' or key in ('nombre', 'dotacion', 'vigencia', 'cantidad'))
  )
  select left(string_agg(
           case p_accion
             when 'UPDATE' then ui.campo_legible(key) || ': ' || ui.valor_legible(key, p_antes -> key) || ' → ' || ui.valor_legible(key, p_despues -> key)
             when 'INSERT' then ui.campo_legible(key) || ': ' || ui.valor_legible(key, p_despues -> key)
             else ui.campo_legible(key) || ': ' || ui.valor_legible(key, p_antes -> key) end,
           ' · ' order by key), 400)
    from c;
$$;

create or replace function ui.historial_org()
returns table (
  id bigint, en timestamptz, actor text, tabla text, tabla_nombre text, accion text, objeto text, cambios text,
  registro_id text, perimetro text, busqueda text
)
language sql stable security definer set search_path = ui, org, control, public as $$
  with a as (
    select a.*, coalesce(a.despues, a.antes) as j
      from control.auditoria a
     where public.puede('sistema:auditoria', 'ver')
       and ((a.esquema = 'org' and a.tabla in ('unidad', 'cargo', 'plaza', 'ocupacion', 'escenario', 'plan_dotacion', 'plan_dotacion_linea',
                                                 'requisicion', 'componente_costo', 'costo_referencia', 'requisicion_costo', 'tasa_cambio'))
            or (a.esquema = 'control' and a.tabla in ('parametro', 'conciliacion')))
       and (public.puede('sistema:costos', 'ver')
            or not ((a.esquema = 'org' and a.tabla in ('componente_costo', 'costo_referencia', 'requisicion_costo', 'tasa_cambio'))
                    or (a.esquema = 'control' and a.tabla = 'parametro')))
  )
  select a.id, a.en,
         case when a.actor is null then 'Sistema' else coalesce(nullif(trim(pr.nombre_completo), ''), pr.email, 'Alguien') end,
         a.tabla,
         case a.tabla
           when 'unidad' then 'Unidad' when 'cargo' then 'Cargo' when 'plaza' then 'Plaza' when 'ocupacion' then 'Ocupación'
           when 'escenario' then 'Escenario' when 'plan_dotacion' then 'Plan de dotación' when 'plan_dotacion_linea' then 'Línea del plan'
           when 'requisicion' then 'Requisición' when 'componente_costo' then '🔒 Componente de costo'
           when 'costo_referencia' then '🔒 Costo de referencia' when 'requisicion_costo' then '🔒 Costo de requisición'
           when 'tasa_cambio' then '🔒 Tasa (respaldo)' when 'parametro' then '🔒 Parámetro' when 'conciliacion' then 'Conciliación'
           else a.tabla end,
         a.accion,
         left(coalesce(
           case a.tabla
             when 'plaza' then (select x.nombre from org.cargo x where x.id = (a.j ->> 'cargo_id')::uuid)
                               || coalesce(' · ' || (select x.nombre from org.unidad x where x.ref = (a.j ->> 'unidad_ref')::uuid and x.escenario_id is null
                                                     order by upper_inf(x.vigencia) desc limit 1), '')
             when 'ocupacion' then (select x.nombre_completo from public.empleados x where x.id = (a.j ->> 'empleado_id')::uuid)
             when 'requisicion' then 'Requisición N.º ' || (a.j ->> 'numero')
             when 'requisicion_costo' then 'Requisición ' || coalesce((select 'N.º ' || q.numero from org.requisicion q where q.id = (a.j ->> 'requisicion_id')::uuid), '')
             when 'plan_dotacion' then 'Plan ' || (a.j ->> 'anio') || ' · versión ' || (a.j ->> 'version')
             when 'plan_dotacion_linea' then (select x.nombre from org.cargo x where x.id = (a.j ->> 'cargo_id')::uuid)
                                             || coalesce(' · ' || (select x.nombre from org.unidad x where x.ref = (a.j ->> 'unidad_ref')::uuid and x.escenario_id is null
                                                                   order by upper_inf(x.vigencia) desc limit 1), '')
             when 'costo_referencia' then (select x.nombre from org.cargo x where x.id = (a.j ->> 'cargo_id')::uuid)
             when 'tasa_cambio' then 'Tasa del ' || to_char((a.j ->> 'fecha')::date, 'DD/MM/YYYY')
             when 'conciliacion' then a.j ->> 'descripcion'
             else a.j ->> 'nombre' end, '—'), 120),
         ui.diff_legible(a.accion, a.antes, a.despues),
         a.registro_id,
         case when a.tabla in ('componente_costo', 'costo_referencia', 'requisicion_costo', 'tasa_cambio', 'parametro') then 'si' else 'no' end,
         ui.plano(coalesce(a.j ->> 'nombre', '') || ' ' || coalesce(pr.nombre_completo, '') || ' ' || a.tabla)
    from a
    left join public.profiles pr on pr.id = a.actor;
$$;

-- 2.8 Lo que resume la pestaña «Resumen»: las cuentas que alertan y la hora
-- del último cambio de la estructura (el sello de sus cifras). Son cuentas, no
-- filas: corre como su dueña y se cierra por dentro con `sistema:estructura`.
create or replace function ui.alertas_organizacion(p_al date default null)
returns jsonb
language sql stable security definer set search_path = ui, org, control, public as $$
  with d as (select coalesce(p_al, org.hoy()) as dia),
  pl as (
    select p.ref, p.unidad_ref, p.dotacion, p.certeza,
           (select count(*) from org.ocupacion o where o.plaza_ref = p.ref and o.tipo = 'titular' and o.vigencia @> d.dia)::int as ocu
      from org.plaza p, d where p.escenario_id is null and p.vigencia @> d.dia and p.estado <> 'cerrada'
  ),
  un as (select u.ref, u.certeza from org.unidad u, d where u.escenario_id is null and u.vigencia @> d.dia)
  select jsonb_build_object(
    'plazas_por_encima', (select count(*) from pl where ocu > dotacion),
    'personas_por_encima', (select coalesce(sum(ocu - dotacion), 0) from pl where ocu > dotacion),
    'plazas_vacias', (select count(*) from pl where ocu = 0),
    'unidades_inferidas', (select count(*) from un where certeza = 'inferencia'),
    'plazas_inferidas', (select count(*) from pl where certeza = 'inferencia'),
    'unidades_sin_plazas', (select count(*) from un where not exists (select 1 from pl where pl.unidad_ref = un.ref)
                                                    and not exists (select 1 from org.unidad h, d where h.padre_ref = un.ref and h.escenario_id is null and h.vigencia @> d.dia)),
    'padron_sin_plaza', (select count(*) from public.empleados e, d where e.activo
                            and not exists (select 1 from org.ocupacion o where o.empleado_id = e.id and o.vigencia @> d.dia)),
    'ocupaciones_por_nombre', (select count(*) from org.ocupacion o, d where o.vigencia @> d.dia and o.certeza = 'por_nombre_de_cargo'),
    'conciliacion_abierta', (select count(*) from control.conciliacion c where c.estado = 'abierto' and c.modulo = 'NUC-ORG'),
    'requisiciones_en_ruta', (select count(*) from org.requisicion q where q.estado = 'en_aprobacion'),
    'ultima_edicion', (select max(a.en) from control.auditoria a
                        where a.esquema = 'org' and a.tabla in ('unidad', 'plaza', 'ocupacion', 'cargo')),
    'dia', (select dia from d)
  )
  where public.puede('sistema:estructura', 'ver');
$$;

-- 2.9 Dependencias de un cargo (o de una plaza): procesos que dirige y rutas
-- donde firma. Nombres de procesos y de pasos: no es dato reservado, y quien
-- ve la estructura necesita saber qué se mueve si toca la plaza.
create or replace function org.dependencias(p_cargo uuid, p_plaza uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = org, sgc, flujo, public as $$
declare
  v_procesos jsonb;
  v_rutas jsonb;
begin
  if not public.puede('sistema:estructura', 'ver') then
    return jsonb_build_object('procesos', '[]'::jsonb, 'rutas', '[]'::jsonb);
  end if;
  select coalesce(jsonb_agg(distinct jsonb_build_object('ref', pr.ref, 'nombre', pr.nombre, 'codigo', coalesce(pr.codigo_sgc, pr.codigo_informe))), '[]')
    into v_procesos
    from sgc.proceso pr
    join org.plaza p on p.ref = pr.dueno_plaza_ref and p.escenario_id is null and p.vigencia @> org.hoy()
   where pr.estado = 'vigente' and pr.escenario_id is null
     and (p.ref = p_plaza or (p_plaza is null and p.cargo_id = p_cargo));
  select coalesce(jsonb_agg(distinct jsonb_build_object('ruta', r.nombre, 'paso', rp.nombre, 'tipo', r.tipo_objeto)), '[]')
    into v_rutas
    from flujo.ruta_paso rp join flujo.ruta r on r.id = rp.ruta_id
   where r.activa and (rp.cargo_id = p_cargo or (p_plaza is not null and rp.plaza_ref = p_plaza));
  return jsonb_build_object('procesos', v_procesos, 'rutas', v_rutas);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) COSTOS · perímetro de nómina
-- -----------------------------------------------------------------------------

-- La tasa oficial (BCV, USD) vigente a una fecha por su fecha valor. La tabla
-- de R0 manda; la vieja de la Etapa 1 queda de respaldo. No es reservada.
create or replace function org.tasa_bcv(p_fecha date default null)
returns table (tasa numeric, fecha_valor date, fuente text)
language plpgsql stable security definer set search_path = control, org, public as $$
declare
  d date := coalesce(p_fecha, org.hoy());
begin
  return query
    select t.tasa, t.fecha_valor, 'BCV'::text from control.tasa_cambio t
     where t.tipo = 'oficial' and t.moneda = 'USD' and t.estado = 'vigente' and t.fecha_valor <= d
     order by t.fecha_valor desc, t.capturada_en desc limit 1;
  if not found then
    return query
      select o.ves_por_usd, o.fecha, o.fuente from org.tasa_cambio o where o.fecha <= d order by o.fecha desc limit 1;
  end if;
end;
$$;
grant execute on function org.tasa_bcv(date) to authenticated, service_role;

-- El costo de un cargo, igual que en la Etapa 1, con dos cambios: la tasa sale
-- de `org.tasa_bcv` (BCV vigente por fecha valor) y el resultado dice qué tasa
-- y de qué fecha usó.
create or replace function org.costo_mensual(p_cargo uuid, p_fecha date default current_date, p_tasa numeric default null)
returns jsonb
language plpgsql stable security invoker set search_path = org, control, public as $$
declare
  r record;
  c record;
  v_tasa numeric := p_tasa;
  v_tasa_fecha date := null;
  v_tasa_fuente text := case when p_tasa is not null then 'indicada' end;
  v_sm numeric;
  s numeric; b numeric; si numeric;
  v_util numeric := 30; v_vac numeric := 15;
  v_base numeric; v_monto numeric; v_piso numeric;
  v_total numeric;
  v_lineas jsonb := '[]'::jsonb;
  v_pendiente boolean := false;
begin
  select * into r from org.costo_referencia where cargo_id = p_cargo and vigencia @> p_fecha;
  if not found then return null; end if;
  if v_tasa is null then
    select t.tasa, t.fecha_valor, t.fuente into v_tasa, v_tasa_fecha, v_tasa_fuente from org.tasa_bcv(p_fecha) t;
  end if;
  select valor into v_sm from control.parametro where clave = 'salario_minimo_ves' and vigencia @> p_fecha;

  s := case when r.moneda = 'USD' then r.salario_mensual * v_tasa else r.salario_mensual end;
  b := r.bonos_usd_mensual * v_tasa;
  select coalesce(max(valor) filter (where nombre ilike 'utilidades%'), 30),
         coalesce(max(valor) filter (where nombre ilike 'bono vacacional%'), 15)
    into v_util, v_vac
    from org.componente_costo where vigencia @> p_fecha;
  si := s + s / 30 * v_util / 12 + s / 30 * v_vac / 12;
  v_total := s + coalesce(b, 0);

  for c in select * from org.componente_costo where vigencia @> p_fecha order by orden loop
    v_base := case c.base when 'salario_normal' then s when 'salario_integral' then si
                          when 'salario_y_bonos' then s + coalesce(b, 0) else 0 end;
    if c.piso_parametro is not null then
      select case when unidad = 'USD' then valor * v_tasa else valor end into v_piso
        from control.parametro where clave = c.piso_parametro and vigencia @> p_fecha;
      v_base := greatest(v_base, coalesce(v_piso, 0));
    end if;
    if c.tope_salarios_minimos is not null and v_sm is not null then
      v_base := least(v_base, c.tope_salarios_minimos * v_sm);
    end if;
    v_monto := case c.forma
      when 'porcentaje' then v_base * c.valor / 100
      when 'dias_anuales' then v_base / 30 * c.valor / 12
      when 'monto_mensual' then case when c.moneda = 'USD' then c.valor * v_tasa else c.valor end
    end;
    v_total := v_total + coalesce(v_monto, 0);
    v_pendiente := v_pendiente or c.por_confirmar;
    v_lineas := v_lineas || jsonb_build_object('nombre', c.nombre, 'monto_ves', round(v_monto, 2), 'por_confirmar', c.por_confirmar);
  end loop;

  return jsonb_build_object(
    'salario_ves', round(s, 2), 'bonos_ves', round(b, 2), 'componentes', v_lineas,
    'total_ves', round(v_total, 2), 'total_usd', case when v_tasa > 0 then round(v_total / v_tasa, 2) end,
    'tasa', v_tasa, 'tasa_fecha', v_tasa_fecha, 'tasa_fuente', v_tasa_fuente,
    'fecha', p_fecha, 'por_confirmar', v_pendiente);
end;
$$;

-- El costo de referencia de cada cargo a una fecha: el que rige (o «falta»),
-- con su total mensual por plaza y cuántas plazas lo usan. Sin `sistema:costos`
-- no devuelve nada.
create or replace function ui.costos_cargo(p_fecha date default null)
returns table (
  cargo_id uuid, cargo text, familia text, plazas integer, dotacion integer, costo_id uuid, salario numeric, moneda text,
  bonos_usd numeric, desde date, hasta date, fuente text, total_ves numeric, total_usd numeric, tasa numeric, tasa_fecha date,
  por_confirmar text, estado text, busqueda text
)
language sql stable security invoker set search_path = ui, org, control, public as $$
  with d as (select coalesce(p_fecha, org.hoy()) as dia),
  pz as (
    select p.cargo_id, count(*)::int as plazas, sum(p.dotacion)::int as dot from org.plaza p, d
     where p.escenario_id is null and p.vigencia @> d.dia and p.estado <> 'cerrada' group by 1
  )
  select c.id, c.nombre, ui.etiqueta('familia_cargo', c.familia), coalesce(pz.plazas, 0), coalesce(pz.dot, 0),
         r.id, r.salario_mensual, r.moneda, r.bonos_usd_mensual, lower(r.vigencia),
         case when upper_inf(r.vigencia) then null else upper(r.vigencia) - 1 end, r.fuente,
         (k.j ->> 'total_ves')::numeric, (k.j ->> 'total_usd')::numeric, (k.j ->> 'tasa')::numeric, (k.j ->> 'tasa_fecha')::date,
         case when k.j is null then null when (k.j ->> 'por_confirmar')::boolean then 'si' else 'no' end,
         case when r.id is null then 'falta' else 'con_costo' end,
         ui.plano(c.nombre || ' ' || coalesce(c.familia, ''))
    from org.cargo c
    cross join d
    left join pz on pz.cargo_id = c.id
    left join org.costo_referencia r on r.cargo_id = c.id and r.vigencia @> d.dia
    left join lateral (select org.costo_mensual(c.id, d.dia) as j) k on r.id is not null
   where c.activo and public.puede('sistema:costos', 'ver');
$$;

create or replace function ui.componentes_costo(p_fecha date default null)
returns table (
  id uuid, nombre text, forma text, valor numeric, base text, tope numeric, piso text, moneda text, aplica_a text,
  base_legal text, fuente text, por_confirmar text, desde date, hasta date, orden integer, nota text
)
language sql stable security invoker set search_path = ui, org, public as $$
  select c.id, c.nombre, c.forma, c.valor, c.base, c.tope_salarios_minimos, c.piso_parametro, c.moneda, c.aplica_a,
         c.base_legal, ui.fuente_legible(c.fuente), case when c.por_confirmar then 'si' else 'no' end,
         lower(c.vigencia), case when upper_inf(c.vigencia) then null else upper(c.vigencia) - 1 end, c.orden, c.nota
    from org.componente_costo c
   where c.vigencia @> coalesce(p_fecha, org.hoy()) and public.puede('sistema:costos', 'ver');
$$;

create or replace function ui.parametros_costo(p_fecha date default null)
returns table (id uuid, clave text, nombre text, valor numeric, unidad text, desde date, fuente text, por_confirmar text)
language sql stable security invoker set search_path = ui, control, org, public as $$
  select p.id, p.clave, p.nombre, p.valor, p.unidad, lower(p.vigencia), ui.fuente_legible(p.fuente),
         case when p.por_confirmar then 'si' else 'no' end
    from control.parametro p
   where p.vigencia @> coalesce(p_fecha, org.hoy()) and public.puede('sistema:costos', 'ver');
$$;

-- El costo mensual por unidad = Σ (dotación de cada plaza × costo mensual de
-- referencia de su cargo). Lo que no tiene costo de referencia se cuenta
-- aparte («falta costo de referencia»), nunca como cero.
create or replace function ui.costo_unidades(p_fecha date default null)
returns table (
  unidad_ref uuid, unidad text, direccion text, plazas integer, dotacion integer, plazas_sin_costo integer,
  dotacion_sin_costo integer, costo_ves numeric, costo_usd numeric, tasa numeric, tasa_fecha date, busqueda text
)
language sql stable security invoker set search_path = ui, org, control, public as $$
  with d as (select coalesce(p_fecha, org.hoy()) as dia),
  p as (select p.* from org.plaza p, d where p.escenario_id is null and p.vigencia @> d.dia and p.estado <> 'cerrada'),
  k as (select x.cargo_id, org.costo_mensual(x.cargo_id, d.dia) as j from (select distinct cargo_id from p) x, d),
  t as (select * from org.tasa_bcv((select dia from d)))
  select p.unidad_ref, u.nombre, dir.nombre, count(*)::int, sum(p.dotacion)::int,
         (count(*) filter (where k.j is null))::int, coalesce(sum(p.dotacion) filter (where k.j is null), 0)::int,
         round(sum(p.dotacion * (k.j ->> 'total_ves')::numeric), 2), round(sum(p.dotacion * (k.j ->> 'total_usd')::numeric), 2),
         (select t.tasa from t), (select t.fecha_valor from t),
         ui.plano(coalesce(u.nombre, '') || ' ' || coalesce(dir.nombre, ''))
    from p
    cross join d
    left join k on k.cargo_id = p.cargo_id
    left join lateral (select x.nombre from org.unidad x where x.ref = p.unidad_ref and x.escenario_id is null and x.vigencia @> d.dia limit 1) u on true
    left join lateral (select x.nombre from org.unidad x
                        where x.ref = org.direccion_de(p.unidad_ref, d.dia) and x.escenario_id is null and x.vigencia @> d.dia limit 1) dir on true
   where public.puede('sistema:costos', 'ver')
   group by p.unidad_ref, u.nombre, dir.nombre;
$$;

-- -----------------------------------------------------------------------------
-- 3.1) PUBLICAR UN ESCENARIO, sin chocar con lo programado
-- -----------------------------------------------------------------------------
-- La versión de la Etapa 1 solo cerraba la versión que empezó ANTES de la fecha:
-- si ya había una que empezaba ese mismo día (otro escenario o una edición con
-- esa fecha) o una programada para después, la nueva se cruzaba con ella y la
-- restricción de exclusión tumbaba la aprobación entera («Se cruza con otra
-- versión vigente»). Ahora: la que rige ese día se cierra con `org.cerrada_en`
-- (vacía si nació ese día, y queda en el historial), y lo nuevo rige hasta la
-- siguiente versión programada, que se respeta. Un cierre deja sin efecto lo
-- programado después, como `org.cerrar_unidad` y `org.cerrar_plaza`.
create or replace function org.publicar_escenario(p_esc uuid)
returns void
language plpgsql security definer set search_path = org, public as $$
declare
  e org.escenario;
  d date;
  c record;
  v_hasta date;
begin
  select * into e from org.escenario where id = p_esc;
  d := coalesce(e.vigente_desde, org.hoy());
  for c in select * from org.comparar_escenario(p_esc) loop
    if c.objeto = 'unidad' then
      update org.unidad set vigencia = org.cerrada_en(vigencia, d)
       where ref = c.ref and escenario_id is null and vigencia @> d;
      if c.cambio = 'baja' then
        update org.unidad set vigencia = 'empty'::daterange
         where ref = c.ref and escenario_id is null and lower(vigencia) > d;
      else
        select min(lower(vigencia)) into v_hasta from org.unidad
         where ref = c.ref and escenario_id is null and not isempty(vigencia) and lower(vigencia) > d;
        insert into org.unidad (ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, vigencia, fuente, certeza, nota)
        select ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, daterange(d, v_hasta),
               format('Escenario «%s»', e.nombre), 'hecho', nota
          from org.unidad where ref = c.ref and escenario_id = p_esc;
      end if;
    else
      update org.plaza set vigencia = org.cerrada_en(vigencia, d)
       where ref = c.ref and escenario_id is null and vigencia @> d;
      if c.cambio = 'baja' then
        update org.plaza set vigencia = 'empty'::daterange
         where ref = c.ref and escenario_id is null and lower(vigencia) > d;
      else
        select min(lower(vigencia)) into v_hasta from org.plaza
         where ref = c.ref and escenario_id is null and not isempty(vigencia) and lower(vigencia) > d;
        insert into org.plaza (ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, vigencia, fuente, certeza, nota)
        select ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, daterange(d, v_hasta),
               format('Escenario «%s»', e.nombre), 'hecho', nota
          from org.plaza where ref = c.ref and escenario_id = p_esc;
      end if;
    end if;
  end loop;
  update org.escenario set estado = 'publicado', publicado_en = now() where id = p_esc;
end;
$$;
revoke execute on function org.publicar_escenario(uuid) from authenticated, public;

-- -----------------------------------------------------------------------------
-- 4) LA AUDITORÍA DEL PERÍMETRO
-- -----------------------------------------------------------------------------
drop policy if exists "leer auditoría" on control.auditoria;
create policy "leer auditoría" on control.auditoria for select to authenticated
  using (public.puede('sistema:auditoria', 'ver')
         and (public.puede('sistema:costos', 'ver')
              or not ((esquema = 'org' and tabla in ('componente_costo', 'costo_referencia', 'requisicion_costo', 'tasa_cambio'))
                      or (esquema = 'control' and tabla = 'parametro'))));

-- -----------------------------------------------------------------------------
-- 5) PRIVILEGIOS
-- -----------------------------------------------------------------------------
grant execute on function
  ui.personas(date), ui.cargos(date), ui.dotacion(date, integer), ui.requisiciones(), ui.escenarios(), ui.conciliacion(),
  ui.historial_org(), ui.valor_legible(text, jsonb), ui.campo_legible(text), ui.diff_legible(text, jsonb, jsonb),
  ui.alertas_organizacion(date), ui.costos_cargo(date), ui.componentes_costo(date), ui.parametros_costo(date),
  ui.costo_unidades(date), org.paso_actual_requisicion(uuid), org.dependencias(uuid, uuid)
to authenticated, service_role;
