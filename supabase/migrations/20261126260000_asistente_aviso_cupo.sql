-- =============================================================================
-- Asistente de IA: avisar cuando el cupo se renueva (26-nov-2026, pedido de Gabriel)
-- =============================================================================
--
-- Al llegar a un tope (la ventana de 5 horas, el día o el mes), el chat se cierra
-- para escribir (lo decide la pantalla con la política) y aquí se anota CUÁNDO
-- se renueva. El reloj del programador (pg_cron, cada minuto) toma lo vencido
-- con `asistente.avisos_renovados()` y le deja a la persona un aviso en la
-- campana: «Tu ventana se renovó». Si la pantalla está abierta, además sale un
-- aviso flotante.
-- =============================================================================

create table if not exists asistente.aviso_renovacion (
  perfil_id  uuid primary key references public.profiles (id) on delete cascade,
  motivo     text not null check (motivo in ('ventana', 'dia', 'mes')),
  renueva    timestamptz not null,
  creado_en  timestamptz not null default now()
);
alter table asistente.aviso_renovacion enable row level security;
-- Solo el servidor: nadie la lee ni la escribe con su sesión.
grant all on asistente.aviso_renovacion to service_role;

-- Reservar (la de 20261126220000) + anotar la renovación cuando se rechaza por un tope de la persona.
create or replace function asistente.reservar_turno(p_turno uuid, p_reserva_usd numeric)
returns text
language plpgsql security definer set search_path = asistente, public as $$
declare
  t asistente.turno;
  pol jsonb;
  v_motivo text;
  v_tipo text;
  v_renueva timestamptz;
  v_hora text;
  v_caracas timestamp := now() at time zone 'America/Caracas';
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
  v_tipo := case
    when not coalesce((select encendido from ia.interruptor_general), false) then 'apagado'
    when not exists (select 1 from ia.capacidad where codigo = 'NUC-ASI-IA-01' and encendida and nivel_actual <> 'N0') then 'apagado'
    when not (pol ->> 'encendido')::boolean then 'apagado'
    when not (pol ->> 'habilitado')::boolean then 'apagado'
    when not (pol -> 'modelos') ? t.modelo then 'modelo'
    when t.corrida_id is null and (pol ->> 'gastado_ventana_usd')::numeric + p_reserva_usd > (pol ->> 'tope_ventana_usd')::numeric then 'ventana'
    when (pol ->> 'gastado_dia_usd')::numeric + p_reserva_usd > (pol ->> 'tope_diario_usd')::numeric then 'dia'
    when (pol ->> 'gastado_mes_usd')::numeric + p_reserva_usd > (pol ->> 'tope_mensual_usd')::numeric then 'mes'
    when (pol ->> 'gastado_empresa_usd')::numeric + p_reserva_usd > (pol ->> 'tope_empresa_usd')::numeric then 'empresa'
    else null end;
  v_motivo := case v_tipo
    when 'apagado' then case
      when not coalesce((select encendido from ia.interruptor_general), false) then 'La IA está apagada en toda la plataforma (interruptor general).'
      when not exists (select 1 from ia.capacidad where codigo = 'NUC-ASI-IA-01' and encendida and nivel_actual <> 'N0') then 'El asistente de IA está apagado en el Gobierno de IA.'
      when not (pol ->> 'encendido')::boolean then 'El asistente está apagado por la administración.'
      else 'No tienes el asistente de IA habilitado.' end
    when 'modelo' then 'Ese modelo no está habilitado para ti.'
    when 'ventana' then case when v_hora is null
      then 'Este pedido no cabe en una ventana de 5 horas. Prueba con un modelo más liviano o pídeselo a la administración.'
      else format('Llegaste al tope de esta ventana de 5 horas. Se renueva a las %s; mientras tanto, prueba con un modelo más liviano.', v_hora) end
    when 'dia' then format('Llegaste a tu tope de hoy (US$ %s). Mañana sigues.', to_char((pol ->> 'tope_diario_usd')::numeric, 'FM990.00'))
    when 'mes' then format('Llegaste a tu tope del mes (US$ %s).', to_char((pol ->> 'tope_mensual_usd')::numeric, 'FM9990.00'))
    when 'empresa' then 'Se alcanzó el tope mensual del asistente para toda la empresa.'
    else null end;
  if v_motivo is not null then
    update asistente.turno set estado = 'fallido', error = v_motivo, terminado_en = now() where id = p_turno;
    -- Cuándo se le renueva a esa persona, para avisarle (no en una corrida programada, que no la pidió en el momento).
    if t.corrida_id is null and v_tipo in ('ventana', 'dia', 'mes') and (v_tipo <> 'ventana' or v_renueva is not null) then
      insert into asistente.aviso_renovacion (perfil_id, motivo, renueva)
      values (t.solicitante, v_tipo, case v_tipo
        when 'ventana' then v_renueva
        when 'dia' then (v_caracas::date + 1)::timestamp at time zone 'America/Caracas'
        else (date_trunc('month', v_caracas) + interval '1 month') at time zone 'America/Caracas' end)
      on conflict (perfil_id) do update set motivo = excluded.motivo, renueva = greatest(asistente.aviso_renovacion.renueva, excluded.renueva), creado_en = now();
    end if;
    return v_motivo;
  end if;
  update asistente.turno set estado = 'corriendo', reserva_usd = p_reserva_usd, empezado_en = now(), latido = now() where id = p_turno;
  return null;
end;
$$;
revoke all on function asistente.reservar_turno(uuid, numeric) from public, anon, authenticated;
grant execute on function asistente.reservar_turno(uuid, numeric) to service_role;

-- La pantalla también avisa la renovación cuando cierra el chat por el tope (sin haber intentado un turno).
create or replace function asistente.anotar_tope(p_motivo text, p_renueva timestamptz)
returns void
language plpgsql security definer set search_path = asistente, public as $$
begin
  if auth.uid() is null or p_motivo not in ('ventana', 'dia', 'mes') or p_renueva is null
     or p_renueva < now() or p_renueva > now() + interval '32 days' then
    return;
  end if;
  insert into asistente.aviso_renovacion (perfil_id, motivo, renueva) values (auth.uid(), p_motivo, p_renueva)
  on conflict (perfil_id) do update set motivo = excluded.motivo, renueva = greatest(asistente.aviso_renovacion.renueva, excluded.renueva);
end;
$$;
revoke all on function asistente.anotar_tope(text, timestamptz) from public, anon;
grant execute on function asistente.anotar_tope(text, timestamptz) to authenticated;

-- Lo vencido: se borra y se devuelve, para que el programador avise una sola vez.
create or replace function asistente.avisos_renovados(p_ahora timestamptz default now())
returns table (perfil_id uuid, motivo text)
language sql security definer set search_path = asistente, public as $$
  delete from asistente.aviso_renovacion a where a.renueva <= p_ahora returning a.perfil_id, a.motivo;
$$;
revoke all on function asistente.avisos_renovados(timestamptz) from public, anon, authenticated;
grant execute on function asistente.avisos_renovados(timestamptz) to service_role;

notify pgrst, 'reload schema';
