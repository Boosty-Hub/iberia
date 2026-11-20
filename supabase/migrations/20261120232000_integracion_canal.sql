-- =============================================================================
-- PLATAFORMA IBERIA · Integración del canal (NUC-CAN) a la plataforma
--
-- El canal —la app de la planta y de toda la nómina— entra al rediseño por dos
-- lados:
--
--   1) LA ADMINISTRACIÓN pasa a /sistema/nucleo/canal (NUC-CAN): Resumen con
--      cifras del registro, Publicaciones, Grupos, Moderación (lo que era
--      /dashboard/reportes) y Uso. Todo lo que el equipo lee de la gente son
--      CUENTAS, nunca contenidos: ningún camino nuevo lee el texto de un mensaje
--      privado (la RLS de `mensajes` ya lo impide y aquí no se abre ninguno).
--   2) LA APP del trabajador suma «Mi cargo» (su plaza, su unidad, a quién le
--      reporta, los procesos de su cargo y de su unidad, y los documentos que le
--      tocan). Esas funciones responden SOLO por quien llama: no reciben a otra
--      persona como parámetro.
--
-- Además cierra un hueco viejo: «actualizo mi ficha» dejaba a cualquiera escribir
-- su fila entera de `empleados` —la RLS decide filas, no columnas—, así que una
-- persona de planta podía darse `puede_publicar` o `es_moderador` con una llamada
-- a la API. Ahora lo impide un trigger (la regla de AGENTS.md: «cualquier
-- política de lo propio sobre una tabla con columnas de acceso necesita su
-- trigger»).
--
-- Funciones security definer: las que cuentan lo de todos piden la casilla
-- `modulo:reportes` adentro (además del despachador de métricas); las de «Mi
-- cargo» solo responden por `mi_empleado()`. EXECUTE revocado de PUBLIC y anon,
-- search_path fijo. Los ayudantes que no se exponen van en `privado`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) EMPLEADOS: nadie se da permisos ni se cambia la ficha a sí mismo
-- -----------------------------------------------------------------------------
create or replace function privado.empleados_proteger_acceso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Sin usuario (clave de servicio, migraciones, scripts) y el equipo editor
  -- administran el padrón como siempre.
  if auth.uid() is null or public.es_editor() then
    return new;
  end if;
  -- Quién publica y quién modera en el canal: la casilla de moderación del canal.
  if (new.puede_publicar, new.es_moderador) is distinct from (old.puede_publicar, old.es_moderador)
     and not public.puede('modulo:reportes', 'editar') then
    raise exception 'Solo quien administra el canal decide quién publica o modera'
      using errcode = 'insufficient_privilege';
  end if;
  -- La identidad, el lugar en la organización y el enlace con la cuenta son del
  -- padrón (Capital Humano), no de la persona.
  if (new.cedula, new.ficha, new.nombre_completo, new.cargo, new.area_id, new.sede, new.nivel,
      new.tipo_nomina, new.familia_oficio, new.activo, new.perfil_id, new.fecha_ingreso)
     is distinct from
     (old.cedula, old.ficha, old.nombre_completo, old.cargo, old.area_id, old.sede, old.nivel,
      old.tipo_nomina, old.familia_oficio, old.activo, old.perfil_id, old.fecha_ingreso) then
    raise exception 'Esos datos los cambia Capital Humano en el padrón'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke execute on function privado.empleados_proteger_acceso() from public, anon, authenticated;

drop trigger if exists a_empleados_proteger_acceso on public.empleados;
create trigger a_empleados_proteger_acceso
  before update on public.empleados
  for each row execute function privado.empleados_proteger_acceso();

-- -----------------------------------------------------------------------------
-- 1) EL MÓDULO: la administración del canal vive en la plataforma
-- -----------------------------------------------------------------------------
-- El recurso del módulo es la casilla de moderación: quien solo tiene el canal
-- (toda la planta) no ve la administración en el menú. Las casillas
-- `modulo:canal` y `modulo:reportes` no cambian.
update control.modulo
   set ruta = '/sistema/nucleo/canal', recurso = 'modulo:reportes', estado = 'operando'
 where codigo = 'NUC-CAN';

-- -----------------------------------------------------------------------------
-- 2) AYUDANTE: quién hizo algo en el canal en una ventana (privado)
-- -----------------------------------------------------------------------------
-- Una acción es escribir un mensaje, abrir una conversación, leer o reaccionar a
-- una publicación, comentar o publicar. Devuelve ids de empleados, nunca qué
-- hicieron. «Abrir una conversación» es `visto_en`, que guarda solo la última
-- vez: a una fecha pasada cuenta a quien la abrió por última vez en la ventana.
create or replace function privado.canal_actividad(p_desde date, p_hasta date)
returns table (empleado_id uuid)
language sql stable security definer set search_path = public as $$
  select m.autor_id from public.mensajes m
   where (m.created_at at time zone 'America/Caracas')::date between p_desde and p_hasta
  union
  select cp.empleado_id from public.conversacion_participantes cp
   where cp.visto_en is not null and (cp.visto_en at time zone 'America/Caracas')::date between p_desde and p_hasta
  union
  select l.empleado_id from public.publicacion_lecturas l
   where (l.leido_en at time zone 'America/Caracas')::date between p_desde and p_hasta
  union
  select r.empleado_id from public.reacciones r
   where (r.created_at at time zone 'America/Caracas')::date between p_desde and p_hasta
  union
  select c.empleado_id from public.comentarios c
   where (c.created_at at time zone 'America/Caracas')::date between p_desde and p_hasta
  union
  select p.autor_id from public.publicaciones p
   where p.autor_id is not null and p.publicado_en is not null
     and (p.publicado_en at time zone 'America/Caracas')::date between p_desde and p_hasta;
$$;
revoke execute on function privado.canal_actividad(date, date) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3) LAS MÉTRICAS DEL CANAL (registro R5: una función ui.m_* por cifra)
--    Cuentan lo de todos —la RLS del canal solo deja a cada quien lo suyo—, así
--    que corren como dueña, piden la casilla adentro y devuelven cifras.
-- -----------------------------------------------------------------------------
create or replace function ui.m_canal_personas_activas(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
declare
  v_al date := coalesce(p_al, org.hoy());
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para ver las cifras del canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  with act as (select distinct a.empleado_id from privado.canal_actividad(v_al - 29, v_al) a),
       padron as (select e.id, e.perfil_id from public.empleados e where e.activo)
  select (select count(*) from act join padron p on p.id = act.empleado_id)::numeric,
         (select count(*) from padron)::numeric,
         jsonb_build_object(
           'en_padron', (select count(*) from padron),
           'con_cuenta', (select count(*) from padron where perfil_id is not null),
           'desde', v_al - 29,
           'serie', (select jsonb_agg(n order by k) from (
                       select k, (select count(distinct a.empleado_id) from privado.canal_actividad(v_al - 29 - 30 * k, v_al - 30 * k) a
                                    join padron p on p.id = a.empleado_id) as n
                         from generate_series(5, 0, -1) k) s)),
         now();
end;
$$;

create or replace function ui.m_canal_publicaciones_mes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
declare
  v_al date := coalesce(p_al, org.hoy());
  v_mes date := date_trunc('month', coalesce(p_al, org.hoy()))::date;
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para ver las cifras del canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  with p as (
    select x.* from public.publicaciones x
     where x.estado <> 'borrador' and x.publicado_en is not null
       and (x.publicado_en at time zone 'America/Caracas')::date between v_mes and v_al
  )
  select count(*)::numeric, null::numeric,
         jsonb_build_object(
           'oficiales', count(*) filter (where p.oficial),
           'archivadas', count(*) filter (where p.estado = 'archivado'),
           'lecturas', (select count(*) from public.publicacion_lecturas l where l.publicacion_id in (select id from p)),
           'mes', to_char(v_mes, 'YYYY-MM'),
           'serie', (select jsonb_agg(n order by k) from (
                       select k, (select count(*) from public.publicaciones y
                                   where y.estado <> 'borrador' and y.publicado_en is not null
                                     and date_trunc('month', y.publicado_en at time zone 'America/Caracas')::date
                                         = (v_mes - make_interval(months => k))::date) as n
                         from generate_series(5, 0, -1) k) s)),
         now()
    from p;
end;
$$;

-- Solo la cuenta: ni el texto, ni quién, ni con quién.
create or replace function ui.m_canal_mensajes_mes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
declare
  v_al date := coalesce(p_al, org.hoy());
  v_mes date := date_trunc('month', coalesce(p_al, org.hoy()))::date;
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para ver las cifras del canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  with m as (
    select x.conversacion_id, c.tipo from public.mensajes x
      join public.conversaciones c on c.id = x.conversacion_id
     where x.estado <> 'eliminado'
       and (x.created_at at time zone 'America/Caracas')::date between v_mes and v_al
  )
  select count(*)::numeric, null::numeric,
         jsonb_build_object(
           'directos', count(*) filter (where m.tipo = 'directa'),
           'en_grupos', count(*) filter (where m.tipo = 'grupo'),
           'conversaciones', count(distinct m.conversacion_id),
           'mes', to_char(v_mes, 'YYYY-MM'),
           'serie', (select jsonb_agg(n order by k) from (
                       select k, (select count(*) from public.mensajes y
                                   where y.estado <> 'eliminado'
                                     and date_trunc('month', y.created_at at time zone 'America/Caracas')::date
                                         = (v_mes - make_interval(months => k))::date) as n
                         from generate_series(5, 0, -1) k) s)),
         now()
    from m;
end;
$$;

create or replace function ui.m_canal_grupos(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para ver las cifras del canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  select (count(*) filter (where g.activo))::numeric, count(*)::numeric,
         jsonb_build_object(
           'abiertos', count(*) filter (where g.activo and g.tipo = 'abierto'),
           'cerrados', count(*) filter (where g.activo and g.tipo = 'cerrado'),
           'miembros', (select count(distinct gm.empleado_id) from public.grupo_miembros gm
                          join public.grupos x on x.id = gm.grupo_id and x.activo)),
         now()
    from public.grupos g;
end;
$$;

create or replace function ui.m_canal_reportes_abiertos(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para ver las cifras del canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  select (count(*) filter (where r.estado = 'abierto'))::numeric, count(*)::numeric,
         jsonb_build_object(
           'revisados', count(*) filter (where r.estado = 'revisado'),
           'ocultos', count(*) filter (where r.oculto),
           'mas_viejo', min(r.created_at) filter (where r.estado = 'abierto')),
         now()
    from public.reportes r;
end;
$$;

revoke execute on function
  ui.m_canal_personas_activas(date, uuid), ui.m_canal_publicaciones_mes(date, uuid), ui.m_canal_mensajes_mes(date, uuid),
  ui.m_canal_grupos(date, uuid), ui.m_canal_reportes_abiertos(date, uuid)
  from public, anon;
grant execute on function
  ui.m_canal_personas_activas(date, uuid), ui.m_canal_publicaciones_mes(date, uuid), ui.m_canal_mensajes_mes(date, uuid),
  ui.m_canal_grupos(date, uuid), ui.m_canal_reportes_abiertos(date, uuid)
  to authenticated;

insert into ui.metrica (clave, nombre, definicion, unidad, modulo, recurso, accion, dueno, fuente, consulta, href, con_fecha, con_escenario, orden) values
  ('canal_personas_activas', 'Personas activas en el canal',
   'Personas activas del padrón que hicieron al menos una acción en el canal en los 30 días que terminan en la fecha de «Datos al»: escribir un mensaje, abrir una conversación, leer o reaccionar a una publicación, comentar o publicar. El total son las personas activas del padrón (la cobertura sobre toda la nómina); cuántas tienen cuenta enlazada va en el detalle. Abrir una conversación cuenta solo la última vez que se abrió.',
   'personas', 'NUC-CAN', 'modulo:reportes', 'ver', 'Capital Humano · comunicación interna', 'Canal de comunicación interna (app Iberia)',
   'ui.m_canal_personas_activas', '/sistema/nucleo/canal/uso', true, false, 60),
  ('canal_publicaciones_mes', 'Publicaciones del mes',
   'Publicaciones del feed que salieron en el mes calendario de la fecha de «Datos al», hasta ese día, en hora de Caracas. Cuenta también las que después se archivaron; no cuenta borradores. Los comunicados oficiales y las lecturas van en el detalle.',
   'publicaciones', 'NUC-CAN', 'modulo:reportes', 'ver', 'Capital Humano · comunicación interna', 'Canal de comunicación interna (app Iberia)',
   'ui.m_canal_publicaciones_mes', '/sistema/nucleo/canal/publicaciones', true, false, 61),
  ('canal_mensajes_mes', 'Mensajes del mes',
   'Mensajes escritos en el canal —directos y de grupo— en el mes calendario de la fecha de «Datos al», hasta ese día, en hora de Caracas. Es solo la cuenta: la plataforma no lee ni muestra el contenido, ni quién le escribe a quién. No cuenta los eliminados.',
   'mensajes', 'NUC-CAN', 'modulo:reportes', 'ver', 'Capital Humano · comunicación interna', 'Canal de comunicación interna (app Iberia)',
   'ui.m_canal_mensajes_mes', '/sistema/nucleo/canal/uso', true, false, 62),
  ('canal_grupos', 'Grupos del canal',
   'Grupos activos del canal, abiertos y cerrados. El total incluye los desactivados; los miembros distintos van en el detalle. Es el estado de hoy.',
   'grupos', 'NUC-CAN', 'modulo:reportes', 'ver', 'Capital Humano · comunicación interna', 'Canal de comunicación interna (app Iberia)',
   'ui.m_canal_grupos', '/sistema/nucleo/canal/grupos', false, false, 63),
  ('canal_reportes_abiertos', 'Reportes por revisar',
   'Reportes de la gente sobre publicaciones, comentarios o mensajes que nadie ha marcado como revisados (guía 1.2 de la App Store). El total son todos los reportes recibidos. Es el estado de hoy.',
   'reportes', 'NUC-CAN', 'modulo:reportes', 'ver', 'Capital Humano · comunicación interna', 'Reportes del canal (reportar_contenido)',
   'ui.m_canal_reportes_abiertos', '/sistema/nucleo/canal/moderacion', false, false, 64)
on conflict (clave) do update set
  nombre = excluded.nombre, definicion = excluded.definicion, unidad = excluded.unidad, modulo = excluded.modulo,
  recurso = excluded.recurso, accion = excluded.accion, dueno = excluded.dueno, fuente = excluded.fuente,
  consulta = excluded.consulta, href = excluded.href, con_fecha = excluded.con_fecha,
  con_escenario = excluded.con_escenario, orden = excluded.orden, actualizado_en = now();

-- -----------------------------------------------------------------------------
-- 4) LA ADMINISTRACIÓN: publicaciones, grupos y uso (cuentas, no contenidos)
-- -----------------------------------------------------------------------------

-- El feed entero, en cualquier estado, con sus cuentas. La RLS de
-- `publicaciones` solo deja ver lo archivado a quien publica; la administración
-- lo lee aquí con la casilla del canal.
create or replace function ui.canal_publicaciones()
returns table (
  id uuid, tipo text, titulo text, bajada text, autor text, autor_cargo text, estado text, oficial boolean,
  fijado boolean, audiencia text, area text, publicado_en timestamptz, creado_en timestamptz,
  lecturas integer, reacciones integer, comentarios integer, reportes_abiertos integer
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para administrar el canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  select p.id, p.tipo, p.titulo, p.bajada, e.nombre_completo, e.cargo, p.estado, p.oficial, p.fijado,
         p.audiencia, a.nombre, p.publicado_en, p.created_at,
         (select count(*)::int from public.publicacion_lecturas l where l.publicacion_id = p.id),
         (select count(*)::int from public.reacciones r where r.publicacion_id = p.id),
         (select count(*)::int from public.comentarios c where c.publicacion_id = p.id and c.estado = 'visible'),
         (select count(*)::int from public.reportes r where r.tipo = 'publicacion' and r.contenido_id = p.id and r.estado = 'abierto')
    from public.publicaciones p
    left join public.empleados e on e.id = p.autor_id
    left join public.areas a on a.id = p.audiencia_area_id
   order by p.fijado desc, coalesce(p.publicado_en, p.created_at) desc;
end;
$$;

-- Los grupos con sus miembros y coordinadores; de los mensajes, solo cuántos y
-- cuándo fue el último.
create or replace function ui.canal_grupos()
returns table (
  id uuid, nombre text, proposito text, tipo text, activo boolean, area text, creado_en timestamptz,
  miembros integer, coordinadores text, mensajes_30d integer, ultimo_mensaje timestamptz, busqueda text
)
language plpgsql stable security definer set search_path = public, ui as $$
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para administrar el canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  select g.id, g.nombre, g.proposito, g.tipo, g.activo, a.nombre, g.created_at,
         (select count(*)::int from public.grupo_miembros gm where gm.grupo_id = g.id),
         (select string_agg(e.nombre_completo, ', ' order by e.nombre_completo)
            from public.grupo_miembros gm join public.empleados e on e.id = gm.empleado_id
           where gm.grupo_id = g.id and gm.rol = 'coordinador'),
         (select count(*)::int from public.mensajes m join public.conversaciones c on c.id = m.conversacion_id
           where c.grupo_id = g.id and m.estado <> 'eliminado' and m.created_at >= now() - interval '30 days'),
         (select max(m.created_at) from public.mensajes m join public.conversaciones c on c.id = m.conversacion_id
           where c.grupo_id = g.id),
         ui.plano(g.nombre || ' ' || coalesce(g.proposito, '') || ' ' || coalesce(a.nombre, ''))
    from public.grupos g
    left join public.areas a on a.id = g.area_id;
end;
$$;

-- La adopción por área, sede y nivel: cuántos hay en el padrón, cuántos tienen
-- cuenta, cuántos entraron alguna vez y cuántos están activos. Sin nombres.
create or replace function ui.canal_uso(p_al date default null)
returns table (
  clave text, area text, sede text, sede_nombre text, nivel text, nivel_nombre text,
  en_padron integer, con_cuenta integer, entraron integer, activas_30d integer,
  mensajes_30d integer, lecturas_30d integer, adopcion numeric, busqueda text
)
language plpgsql stable security definer set search_path = public, ui as $$
declare
  v_al date := coalesce(p_al, org.hoy());
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para administrar el canal' using errcode = 'insufficient_privilege';
  end if;
  return query
  with act as (select distinct a.empleado_id from privado.canal_actividad(v_al - 29, v_al) a),
  men as (
    select m.autor_id, count(*)::int as n from public.mensajes m
     where m.estado <> 'eliminado' and (m.created_at at time zone 'America/Caracas')::date between v_al - 29 and v_al
     group by m.autor_id
  ),
  lec as (
    select l.empleado_id, count(*)::int as n from public.publicacion_lecturas l
     where (l.leido_en at time zone 'America/Caracas')::date between v_al - 29 and v_al
     group by l.empleado_id
  ),
  base as (
    select e.id, e.area_id, coalesce(ar.nombre, 'Sin área') as area, coalesce(e.sede, 'sin_dato') as sede, e.nivel,
           e.perfil_id is not null as con_cuenta,
           exists (select 1 from auth.users u where u.id = e.perfil_id and u.last_sign_in_at is not null) as entro,
           exists (select 1 from act where act.empleado_id = e.id) as activa,
           coalesce((select n from men where men.autor_id = e.id), 0) as mensajes,
           coalesce((select n from lec where lec.empleado_id = e.id), 0) as lecturas
      from public.empleados e
      left join public.areas ar on ar.id = e.area_id
     where e.activo
  )
  select concat_ws('|', coalesce(b.area_id::text, '-'), b.sede, b.nivel),
         b.area, b.sede,
         case b.sede when 'caracas' then 'Caracas' when 'cagua' then 'Cagua' when 'campo' then 'En campo' else 'Sin dato' end,
         b.nivel,
         case b.nivel when 'direccion' then 'Dirección' when 'gerencia' then 'Gerencia' when 'jefatura' then 'Jefatura'
                      when 'administrativo' then 'Administrativo' when 'planta' then 'Planta' else b.nivel end,
         count(*)::int, (count(*) filter (where b.con_cuenta))::int, (count(*) filter (where b.entro))::int,
         (count(*) filter (where b.activa))::int, sum(b.mensajes)::int, sum(b.lecturas)::int,
         round(100.0 * count(*) filter (where b.activa) / nullif(count(*), 0), 1),
         ui.plano(b.area || ' ' || b.sede || ' ' || b.nivel)
    from base b
   group by b.area_id, b.area, b.sede, b.nivel;
end;
$$;

revoke execute on function ui.canal_publicaciones(), ui.canal_grupos(), ui.canal_uso(date) from public, anon;
grant execute on function ui.canal_publicaciones(), ui.canal_grupos(), ui.canal_uso(date) to authenticated;

-- Archivar, restaurar, fijar y marcar oficial una publicación. No borra nada.
-- Archivar da por revisados (y ocultos) los reportes de esa publicación, como
-- `ocultar_contenido_reportado`; restaurar los devuelve a visibles.
create or replace function public.canal_moderar_publicacion(p_publicacion uuid, p_accion text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'No tienes permiso para administrar el canal' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.publicaciones where id = p_publicacion) then
    raise exception 'No se encontró la publicación' using errcode = 'no_data_found';
  end if;
  case p_accion
    when 'archivar' then
      update public.publicaciones set estado = 'archivado' where id = p_publicacion and estado = 'publicado';
      update public.reportes set oculto = true, estado = 'revisado', revisado_por = auth.uid(), revisado_en = now()
       where tipo = 'publicacion' and contenido_id = p_publicacion;
    when 'restaurar' then
      update public.publicaciones set estado = 'publicado', publicado_en = coalesce(publicado_en, now())
       where id = p_publicacion and estado = 'archivado';
      update public.reportes set oculto = false where tipo = 'publicacion' and contenido_id = p_publicacion;
    when 'fijar' then update public.publicaciones set fijado = true where id = p_publicacion;
    when 'soltar' then update public.publicaciones set fijado = false where id = p_publicacion;
    when 'oficial' then update public.publicaciones set oficial = true where id = p_publicacion;
    when 'no_oficial' then update public.publicaciones set oficial = false where id = p_publicacion;
    else raise exception 'Acción no válida' using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- Quién publica en nombre de la organización y quién modera. Pasa por aquí
-- porque la RLS del padrón solo deja escribir al equipo editor.
create or replace function public.canal_autorizar(p_empleado uuid, p_puede_publicar boolean, p_es_moderador boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'No tienes permiso para administrar el canal' using errcode = 'insufficient_privilege';
  end if;
  update public.empleados
     set puede_publicar = coalesce(p_puede_publicar, puede_publicar),
         es_moderador = coalesce(p_es_moderador, es_moderador)
   where id = p_empleado and activo;
  if not found then
    raise exception 'Esa persona no está activa en el padrón' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.canal_moderar_publicacion(uuid, text), public.canal_autorizar(uuid, boolean, boolean) from public, anon;
grant execute on function public.canal_moderar_publicacion(uuid, text), public.canal_autorizar(uuid, boolean, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) MI CARGO (la app del trabajador): solo lo de quien llama
-- -----------------------------------------------------------------------------
-- Sin parámetros de persona: todo sale de `mi_empleado()`. Devuelve su plaza (o
-- plazas: titular, encargado…), su cargo, su unidad con la ruta hasta arriba y a
-- quién le reporta (el cargo y quién lo ocupa hoy).
create or replace function nucleo.mi_cargo()
returns jsonb
language plpgsql stable security definer set search_path = org, public, ui as $$
declare
  yo uuid := public.mi_empleado();
  hoy date := org.hoy();
begin
  if yo is null then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'nombre', e.nombre_completo,
      'cargo_padron', e.cargo,
      'area', ar.nombre,
      'plazas', coalesce((
        select jsonb_agg(x.j order by x.titular desc, x.desde)
          from (
            select o.tipo = 'titular' as titular, lower(o.vigencia) as desde,
                   jsonb_build_object(
                     'plaza_ref', p.ref,
                     'tipo', o.tipo,
                     'tipo_nombre', ui.etiqueta('tipo_ocupacion', o.tipo),
                     'desde', lower(o.vigencia),
                     'cargo_id', c.id,
                     'cargo', c.nombre,
                     'proposito', c.proposito,
                     'familia', case when c.familia is not null then ui.etiqueta('familia_cargo', c.familia) end,
                     'unidad_ref', u.ref,
                     'unidad', u.nombre,
                     'unidad_tipo', case when u.tipo is not null then ui.etiqueta('tipo_unidad', u.tipo) end,
                     'sede', case when p.sede is not null then ui.etiqueta('sede', p.sede) end,
                     'ruta', (
                       with recursive anc(ref, n) as (
                         select u.padre_ref, 1
                         union all
                         select (select x.padre_ref from org.unidad x
                                  where x.ref = anc.ref and x.escenario_id is null and x.vigencia @> hoy limit 1), anc.n + 1
                           from anc where anc.ref is not null and anc.n < 12
                       )
                       select jsonb_agg(un.nombre order by anc.n desc)
                         from anc
                         join lateral (select x.nombre from org.unidad x
                                        where x.ref = anc.ref and x.escenario_id is null and x.vigencia @> hoy limit 1) un on true
                     ),
                     'reporta_a', (
                       select jsonb_build_object(
                                'cargo', c2.nombre,
                                'unidad', (select x.nombre from org.unidad x
                                            where x.ref = p2.unidad_ref and x.escenario_id is null and x.vigencia @> hoy limit 1),
                                'personas', coalesce((
                                  select jsonb_agg(e2.nombre_completo order by e2.nombre_completo)
                                    from org.ocupacion o2 join public.empleados e2 on e2.id = o2.empleado_id and e2.activo
                                   where o2.plaza_ref = p2.ref and o2.tipo = 'titular' and o2.vigencia @> hoy), '[]'::jsonb))
                         from org.plaza p2 join org.cargo c2 on c2.id = p2.cargo_id
                        where p2.ref = p.reporta_a_ref and p2.escenario_id is null and p2.vigencia @> hoy
                        limit 1)
                   ) as j
              from org.ocupacion o
              join lateral (select y.* from org.plaza y
                             where y.ref = o.plaza_ref and y.escenario_id is null and y.vigencia @> hoy
                             order by lower(y.vigencia) desc limit 1) p on true
              join org.cargo c on c.id = p.cargo_id
              left join lateral (select y.* from org.unidad y
                                  where y.ref = p.unidad_ref and y.escenario_id is null and y.vigencia @> hoy
                                  order by lower(y.vigencia) desc limit 1) u on true
             where o.empleado_id = yo and o.vigencia @> hoy
          ) x), '[]'::jsonb)
    )
    from public.empleados e
    left join public.areas ar on ar.id = e.area_id
   where e.id = yo
  );
end;
$$;

-- Los procesos vigentes cuyo dueño es una plaza de mi mismo cargo ('tu_cargo')
-- o de mi unidad ('tu_unidad'). Es lo que la estructura sabe hoy de dónde
-- participa un cargo; cuando el SGC registre participantes por actividad, esto
-- se amplía sin cambiar la pantalla.
create or replace function nucleo.mis_procesos()
returns table (ref uuid, codigo text, nombre text, nivel smallint, nivel_nombre text, relacion text, dueno text, objetivo text)
language sql stable security definer set search_path = org, sgc, public as $$
  with mias as (
    select p.cargo_id, p.unidad_ref
      from org.ocupacion o
      join org.plaza p on p.ref = o.plaza_ref and p.escenario_id is null and p.vigencia @> org.hoy()
     where o.empleado_id = public.mi_empleado() and o.vigencia @> org.hoy()
  ),
  vig as (
    select pr.ref, pr.codigo_sgc, pr.codigo_informe, pr.nombre, pr.nivel, pr.ficha, pr.dueno_plaza_ref
      from sgc.proceso pr
     where pr.escenario_id is null and pr.estado = 'vigente' and pr.dueno_plaza_ref is not null
  ),
  cruce as (
    select v.*, pl.cargo_id, pl.unidad_ref, c.nombre as cargo,
           case when pl.cargo_id in (select m.cargo_id from mias m) then 'tu_cargo' else 'tu_unidad' end as relacion
      from vig v
      join org.plaza pl on pl.ref = v.dueno_plaza_ref and pl.escenario_id is null and pl.vigencia @> org.hoy()
      join org.cargo c on c.id = pl.cargo_id
     where pl.cargo_id in (select m.cargo_id from mias m) or pl.unidad_ref in (select m.unidad_ref from mias m)
  )
  select distinct on (x.ref)
         x.ref, coalesce(x.codigo_sgc, x.codigo_informe), x.nombre, x.nivel,
         case x.nivel when 0 then 'Macroproceso' when 1 then 'Proceso' when 2 then 'Subproceso' else 'Actividad' end,
         x.relacion, x.cargo,
         case when jsonb_typeof(x.ficha -> 'objetivo') = 'string' then nullif(btrim(x.ficha ->> 'objetivo'), '') end
    from cruce x
   order by x.ref, (x.relacion = 'tu_cargo') desc
   limit 120;
$$;

-- Los documentos vigentes de uso general (sin perímetro ni datos sensibles)
-- vinculados a esos procesos: lo que mi cargo debería conocer hoy. La
-- distribución por cargo con acuse («Mis documentos», New Iberia) lo reemplaza.
create or replace function nucleo.mis_documentos()
returns table (id uuid, codigo text, titulo text, version text, fecha date, proceso text, relacion text)
language sql stable security definer set search_path = sgc, public as $$
  select d.id, d.codigo, d.titulo, d.version, d.fecha, mp.nombre, mp.relacion
    from sgc.documento d
    join nucleo.mis_procesos() mp on mp.ref = d.proceso_ref
   where d.estado = 'vigente' and d.perimetro = 'general' and not d.datos_sensibles
   order by (mp.relacion = 'tu_cargo') desc, d.codigo, d.titulo
   limit 120;
$$;

revoke execute on function nucleo.mi_cargo(), nucleo.mis_procesos(), nucleo.mis_documentos() from public, anon;
grant execute on function nucleo.mi_cargo(), nucleo.mis_procesos(), nucleo.mis_documentos() to authenticated;
