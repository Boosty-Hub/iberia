-- =============================================================================
-- Asistente de IA: el tope del día, repartido en ventanas de 5 horas
-- =============================================================================
--
-- Pedido de Gabriel (26-nov-2026): que el tope diario no se gaste en una hora,
-- sino que alcance para el día en al menos dos ventanas. Como en Claude web:
-- la ventana arranca con el primer mensaje y se renueva completa 5 horas
-- después. Lo que cabe en una ventana = tope diario / ventanas por día (2 de
-- fábrica, ajustable por rol o persona). El diario, el mensual y el de la
-- empresa siguen igual. Las tareas programadas no gastan ventana (corren sin
-- la persona), pero sí cuentan para el diario y el mensual.
-- =============================================================================

alter table asistente.config add column if not exists ventanas_por_dia smallint not null default 2 check (ventanas_por_dia between 1 and 5);
alter table asistente.politica_rol add column if not exists ventanas_por_dia smallint check (ventanas_por_dia is null or ventanas_por_dia between 1 and 5);
alter table asistente.politica_usuario add column if not exists ventanas_por_dia smallint check (ventanas_por_dia is null or ventanas_por_dia between 1 and 5);

-- La investigación profunda tiene que caber en una ventana: el tope de fábrica baja de US$ 3 a 1,50 (medida: US$ 0,30).
update asistente.config set tope_investigacion_usd = 1.5 where tope_investigacion_usd = 3;
alter table asistente.config alter column tope_investigacion_usd set default 1.5;

-- La ventana vigente de una persona: arranca con su primer turno (no programado)
-- y dura 5 horas; el primer turno después de que vence abre la siguiente.
create or replace function asistente.ventana_de(p_perfil uuid, p_ahora timestamptz default now())
returns table (inicio timestamptz, renueva timestamptz, gastado numeric)
language plpgsql stable security definer set search_path = asistente, public as $$
declare
  t record;
  v_inicio timestamptz;
begin
  for t in
    select creado_en from asistente.turno
     where solicitante = p_perfil and corrida_id is null and creado_en > p_ahora - interval '30 hours' and creado_en <= p_ahora
     order by creado_en
  loop
    if v_inicio is null or t.creado_en >= v_inicio + interval '5 hours' then v_inicio := t.creado_en; end if;
  end loop;
  if v_inicio is null or p_ahora >= v_inicio + interval '5 hours' then
    return query select null::timestamptz, null::timestamptz, 0::numeric;
    return;
  end if;
  return query
    select v_inicio, v_inicio + interval '5 hours',
           coalesce((select sum(costo_usd + reserva_usd) from asistente.turno where solicitante = p_perfil and corrida_id is null and creado_en >= v_inicio), 0);
end;
$$;
revoke all on function asistente.ventana_de(uuid, timestamptz) from public, anon, authenticated;
grant execute on function asistente.ventana_de(uuid, timestamptz) to service_role;

-- La política efectiva suma la ventana.
create or replace function asistente.politica_de(p_perfil uuid)
returns jsonb
language plpgsql stable security definer set search_path = asistente, public as $$
declare
  c asistente.config;
  pr public.profiles;
  r asistente.politica_rol;
  u asistente.politica_usuario;
  v_casilla boolean;
  v_inicio_dia timestamptz := ((now() at time zone 'America/Caracas')::date)::timestamp at time zone 'America/Caracas';
  v_inicio_mes timestamptz := (date_trunc('month', now() at time zone 'America/Caracas'))::timestamp at time zone 'America/Caracas';
  v_dia numeric;
  v_mes numeric;
  v_empresa numeric;
  v_usado bigint;
  v_tope_dia numeric;
  v_ventanas smallint;
  w record;
begin
  select * into c from asistente.config where id;
  select * into pr from public.profiles where id = p_perfil;
  if not found then return null; end if;
  select * into r from asistente.politica_rol where rol_id = pr.rol_id;
  select * into u from asistente.politica_usuario where perfil_id = p_perfil;
  select case when pr.rol = 'admin' then true
              else coalesce((select rp.ver from public.rol_permisos rp where rp.rol_id = pr.rol_id and rp.recurso = 'sistema:asistente'), false) end
    into v_casilla;
  select coalesce(sum(costo_usd + reserva_usd), 0) into v_dia from asistente.turno where solicitante = p_perfil and creado_en >= v_inicio_dia;
  select coalesce(sum(costo_usd + reserva_usd), 0) into v_mes from asistente.turno where solicitante = p_perfil and creado_en >= v_inicio_mes;
  select coalesce(sum(costo_usd + reserva_usd), 0) into v_empresa from asistente.turno where creado_en >= v_inicio_mes;
  select coalesce(sum(bytes), 0) into v_usado from asistente.archivo where dueno = p_perfil and estado <> 'error';
  v_tope_dia := coalesce(u.tope_diario_usd, r.tope_diario_usd, c.tope_diario_usd);
  v_ventanas := coalesce(u.ventanas_por_dia, r.ventanas_por_dia, c.ventanas_por_dia);
  select * into w from asistente.ventana_de(p_perfil);
  return jsonb_build_object(
    'habilitado', pr.activo and coalesce(u.habilitado, v_casilla),
    'encendido', c.encendido,
    'motor', c.motor,
    'modelos', to_jsonb(coalesce(u.modelos, r.modelos, (select array_agg(m.id order by m.orden) from asistente.modelo m where m.encendido))),
    'modelo_defecto', case c.motor when 'openai' then c.modelo_openai else c.modelo_anthropic end,
    'esfuerzo_defecto', c.esfuerzo_defecto,
    'esfuerzo_max', coalesce(u.esfuerzo_max, r.esfuerzo_max, c.esfuerzo_max),
    'tope_diario_usd', v_tope_dia,
    'tope_mensual_usd', coalesce(u.tope_mensual_usd, r.tope_mensual_usd, c.tope_mensual_usd),
    'tope_empresa_usd', c.tope_mensual_empresa_usd,
    'tope_investigacion_usd', c.tope_investigacion_usd,
    'ventanas_por_dia', v_ventanas,
    'tope_ventana_usd', round(v_tope_dia / v_ventanas, 4),
    'gastado_ventana_usd', round(w.gastado, 4),
    'ventana_renueva', w.renueva,
    'cuota_mb', coalesce(u.cuota_mb, r.cuota_mb, c.cuota_mb),
    'puede_compartir', coalesce(u.puede_compartir, r.puede_compartir, true),
    'puede_programar', coalesce(u.puede_programar, r.puede_programar, true),
    'max_tareas', coalesce(u.max_tareas, r.max_tareas, c.max_tareas),
    'frecuencia_min_min', coalesce(u.frecuencia_min_min, r.frecuencia_min_min, c.frecuencia_min_min),
    'gastado_dia_usd', round(v_dia, 4),
    'gastado_mes_usd', round(v_mes, 4),
    'gastado_empresa_usd', round(v_empresa, 4),
    'usado_bytes', v_usado
  );
end;
$$;
revoke all on function asistente.politica_de(uuid) from public, anon, authenticated;
grant execute on function asistente.politica_de(uuid) to service_role;

-- Reservar: además del día, el mes y la empresa, la ventana (solo los turnos que pide la persona).
create or replace function asistente.reservar_turno(p_turno uuid, p_reserva_usd numeric)
returns text
language plpgsql security definer set search_path = asistente, public as $$
declare
  t asistente.turno;
  pol jsonb;
  v_motivo text;
  v_renueva timestamptz;
  v_hora text;
begin
  perform pg_advisory_xact_lock(hashtext('asistente.reserva'));
  select * into t from asistente.turno where id = p_turno for update;
  if not found then return 'Ese turno no existe.'; end if;
  if t.estado <> 'en_cola' then return 'Ese turno ya empezó.'; end if;
  -- Turnos colgados (la función murió sin cerrar): se liberan a los 20 minutos.
  update asistente.turno set estado = 'fallido', reserva_usd = 0, error = 'El turno se quedó sin respuesta y se cerró.', terminado_en = now()
   where estado = 'corriendo' and coalesce(latido, empezado_en) < now() - interval '20 minutes';
  pol := asistente.politica_de(t.solicitante);
  v_renueva := (pol ->> 'ventana_renueva')::timestamptz;
  v_hora := case when v_renueva is null then null
                 else trim(to_char(v_renueva at time zone 'America/Caracas', 'FMHH12:MI')) ||
                      case when extract(hour from v_renueva at time zone 'America/Caracas') < 12 then ' a. m.' else ' p. m.' end end;
  v_motivo := case
    when not coalesce((select encendido from ia.interruptor_general), false) then 'La IA está apagada en toda la plataforma (interruptor general).'
    when not exists (select 1 from ia.capacidad where codigo = 'NUC-ASI-IA-01' and encendida and nivel_actual <> 'N0') then 'El asistente de IA está apagado en el Gobierno de IA.'
    when not (pol ->> 'encendido')::boolean then 'El asistente está apagado por la administración.'
    when not (pol ->> 'habilitado')::boolean then 'No tienes el asistente de IA habilitado.'
    when not (pol -> 'modelos') ? t.modelo then 'Ese modelo no está habilitado para ti.'
    when t.corrida_id is null and (pol ->> 'gastado_ventana_usd')::numeric + p_reserva_usd > (pol ->> 'tope_ventana_usd')::numeric
      then case when v_hora is null
                then 'Este pedido no cabe en una ventana de 5 horas. Prueba con un modelo más liviano o pídeselo a la administración.'
                else format('Llegaste al tope de esta ventana de 5 horas. Se renueva a las %s; mientras tanto, prueba con un modelo más liviano.', v_hora) end
    when (pol ->> 'gastado_dia_usd')::numeric + p_reserva_usd > (pol ->> 'tope_diario_usd')::numeric
      then format('Llegaste a tu tope de hoy (US$ %s). Mañana sigues.', to_char((pol ->> 'tope_diario_usd')::numeric, 'FM990.00'))
    when (pol ->> 'gastado_mes_usd')::numeric + p_reserva_usd > (pol ->> 'tope_mensual_usd')::numeric
      then format('Llegaste a tu tope del mes (US$ %s).', to_char((pol ->> 'tope_mensual_usd')::numeric, 'FM9990.00'))
    when (pol ->> 'gastado_empresa_usd')::numeric + p_reserva_usd > (pol ->> 'tope_empresa_usd')::numeric
      then 'Se alcanzó el tope mensual del asistente para toda la empresa.'
    else null end;
  if v_motivo is not null then
    update asistente.turno set estado = 'fallido', error = v_motivo, terminado_en = now() where id = p_turno;
    return v_motivo;
  end if;
  update asistente.turno set estado = 'corriendo', reserva_usd = p_reserva_usd, empezado_en = now(), latido = now() where id = p_turno;
  return null;
end;
$$;
revoke all on function asistente.reservar_turno(uuid, numeric) from public, anon, authenticated;
grant execute on function asistente.reservar_turno(uuid, numeric) to service_role;
