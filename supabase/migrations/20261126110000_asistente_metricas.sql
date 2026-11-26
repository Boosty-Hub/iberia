-- =============================================================================
-- ASISTENTE DE IA · las cifras de su administración, en el registro de métricas
-- (cada cifra se define una sola vez: ui.metrica + su función ui.m_*).
-- Corren como su dueña y piden la casilla `sistema:asistente-admin` · ver:
-- son cifras del uso de todos, nunca el contenido de un chat.
-- =============================================================================

create or replace function ui.m_asistente_gasto_mes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
declare
  v_al date := coalesce(p_al, (now() at time zone 'America/Caracas')::date);
  v_desde timestamptz := (date_trunc('month', v_al::timestamp))::timestamp at time zone 'America/Caracas';
  v_hasta timestamptz := ((v_al + 1)::timestamp) at time zone 'America/Caracas';
  v_hoy timestamptz := (v_al::timestamp) at time zone 'America/Caracas';
begin
  if not public.puede('sistema:asistente-admin', 'ver') then
    raise exception 'Sin permiso para ver el consumo del asistente' using errcode = 'insufficient_privilege';
  end if;
  return query
  select round(coalesce(sum(t.costo_usd + t.reserva_usd), 0), 2),
         (select c.tope_mensual_empresa_usd from asistente.config c where c.id),
         jsonb_build_object(
           'hoy', round(coalesce(sum(t.costo_usd + t.reserva_usd) filter (where t.creado_en >= v_hoy), 0), 2),
           'turnos', count(*),
           'personas', count(distinct t.solicitante)),
         now()
    from asistente.turno t
   where t.creado_en >= v_desde and t.creado_en < v_hasta;
end;
$$;

create or replace function ui.m_asistente_usuarios_activos(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
declare
  v_al date := coalesce(p_al, (now() at time zone 'America/Caracas')::date);
  v_desde timestamptz := (date_trunc('month', v_al::timestamp))::timestamp at time zone 'America/Caracas';
  v_hasta timestamptz := ((v_al + 1)::timestamp) at time zone 'America/Caracas';
  v_semana timestamptz := ((v_al - 6)::timestamp) at time zone 'America/Caracas';
begin
  if not public.puede('sistema:asistente-admin', 'ver') then
    raise exception 'Sin permiso para ver el consumo del asistente' using errcode = 'insufficient_privilege';
  end if;
  return query
  with habilitados as (
    select p.id from public.profiles p
     left join asistente.politica_usuario u on u.perfil_id = p.id
     where p.activo
       and coalesce(u.habilitado, p.rol = 'admin'
             or exists (select 1 from public.rol_permisos rp where rp.rol_id = p.rol_id and rp.recurso = 'sistema:asistente' and rp.ver))
  )
  select (select count(distinct t.solicitante) from asistente.turno t where t.creado_en >= v_desde and t.creado_en < v_hasta)::numeric,
         (select count(*) from habilitados)::numeric,
         jsonb_build_object('semana', (select count(distinct t.solicitante) from asistente.turno t where t.creado_en >= v_semana and t.creado_en < v_hasta)),
         now();
end;
$$;

create or replace function ui.m_asistente_turnos_mes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
declare
  v_al date := coalesce(p_al, (now() at time zone 'America/Caracas')::date);
  v_desde timestamptz := (date_trunc('month', v_al::timestamp))::timestamp at time zone 'America/Caracas';
  v_hasta timestamptz := ((v_al + 1)::timestamp) at time zone 'America/Caracas';
begin
  if not public.puede('sistema:asistente-admin', 'ver') then
    raise exception 'Sin permiso para ver el consumo del asistente' using errcode = 'insufficient_privilege';
  end if;
  return query
  select count(*) filter (where t.estado = 'listo')::numeric,
         count(*)::numeric,
         jsonb_build_object(
           'fallidos', count(*) filter (where t.estado = 'fallido'),
           'detenidos', count(*) filter (where t.estado = 'detenido'),
           'a_favor', (select count(*) from asistente.mensaje m where m.calificacion = 1 and m.creado_en >= v_desde and m.creado_en < v_hasta),
           'en_contra', (select count(*) from asistente.mensaje m where m.calificacion = -1 and m.creado_en >= v_desde and m.creado_en < v_hasta)),
         now()
    from asistente.turno t
   where t.creado_en >= v_desde and t.creado_en < v_hasta;
end;
$$;

-- El percentil 90 del tiempo hasta la primera palabra, en los últimos 7 días
-- hasta «Datos al»: la meta del plan es menos de 2 s (turnos sin archivos).
create or replace function ui.m_asistente_primera_palabra(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, public as $$
declare
  v_al date := coalesce(p_al, (now() at time zone 'America/Caracas')::date);
  v_desde timestamptz := ((v_al - 6)::timestamp) at time zone 'America/Caracas';
  v_hasta timestamptz := ((v_al + 1)::timestamp) at time zone 'America/Caracas';
begin
  if not public.puede('sistema:asistente-admin', 'ver') then
    raise exception 'Sin permiso para ver el consumo del asistente' using errcode = 'insufficient_privilege';
  end if;
  return query
  select (percentile_cont(0.9) within group (order by t.primer_token_ms))::numeric,
         null::numeric,
         jsonb_build_object('p50', (percentile_cont(0.5) within group (order by t.primer_token_ms))::integer, 'turnos', count(*)),
         now()
    from asistente.turno t
   where t.creado_en >= v_desde and t.creado_en < v_hasta and t.primer_token_ms is not null
     and not exists (select 1 from asistente.mensaje m where m.turno_id = t.id and m.rol = 'usuario' and cardinality(m.adjuntos) > 0);
end;
$$;

revoke all on function ui.m_asistente_gasto_mes(date, uuid), ui.m_asistente_usuarios_activos(date, uuid), ui.m_asistente_turnos_mes(date, uuid), ui.m_asistente_primera_palabra(date, uuid) from public, anon;
grant execute on function ui.m_asistente_gasto_mes(date, uuid), ui.m_asistente_usuarios_activos(date, uuid), ui.m_asistente_turnos_mes(date, uuid), ui.m_asistente_primera_palabra(date, uuid) to authenticated;

insert into ui.metrica (clave, nombre, definicion, unidad, modulo, recurso, accion, dueno, fuente, consulta, href, con_fecha, con_escenario, orden) values
  ('asistente_gasto_mes', 'Gasto del asistente en el mes',
   'Lo que costó el asistente de IA en el mes de «Datos al», hasta ese día, para toda la empresa: tokens a precio de lista del proveedor, búsquedas en internet y lo reservado por los turnos que siguen corriendo. El total es el tope mensual de la empresa que fija la administración.',
   'USD', 'NUC-IA', 'sistema:asistente-admin', 'ver', 'Gerente de Tecnología de la Información', 'Turnos del asistente de IA',
   'ui.m_asistente_gasto_mes', '/sistema/administracion/asistente', true, false, 90),
  ('asistente_usuarios_activos', 'Personas que lo usan',
   'Personas que le pidieron al menos un turno al asistente en el mes de «Datos al». El total son las personas activas con el asistente habilitado (por la casilla de su rol o por una excepción).',
   'personas', 'NUC-IA', 'sistema:asistente-admin', 'ver', 'Gerente de Tecnología de la Información', 'Turnos del asistente de IA',
   'ui.m_asistente_usuarios_activos', '/sistema/administracion/asistente/adopcion', true, false, 91),
  ('asistente_turnos_mes', 'Respuestas del mes',
   'Turnos del asistente que terminaron con respuesta en el mes de «Datos al». El total cuenta también los que fallaron o se detuvieron. Las calificaciones son los pulgares que dieron las personas a las respuestas.',
   'turnos', 'NUC-IA', 'sistema:asistente-admin', 'ver', 'Gerente de Tecnología de la Información', 'Turnos y calificaciones del asistente de IA',
   'ui.m_asistente_turnos_mes', '/sistema/administracion/asistente/adopcion', true, false, 92),
  ('asistente_primera_palabra', 'Primera palabra (p90)',
   'Tiempo desde que el asistente recibe el turno hasta que el proveedor de IA devuelve la primera señal (texto, razonamiento o un paso de herramienta), en el percentil 90 de los últimos 7 días hasta «Datos al». Solo turnos sin archivos adjuntos. La meta del plan es menos de 2 segundos.',
   'ms', 'NUC-IA', 'sistema:asistente-admin', 'ver', 'Gerente de Tecnología de la Información', 'Turnos del asistente de IA',
   'ui.m_asistente_primera_palabra', '/sistema/administracion/asistente', true, false, 93)
on conflict (clave) do nothing;
