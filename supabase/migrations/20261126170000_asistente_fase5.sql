-- =============================================================================
-- Asistente de IA · fase 5: tareas programadas, tableros vivos e investigación
-- =============================================================================
--
--  · Una TAREA es una instrucción que corre sola a su hora de Caracas, a nombre
--    de su dueño y con sus permisos de ese día. Cada vez que corre deja una
--    CORRIDA: un chat «Tarea · nombre · fecha» con la respuesta y los archivos,
--    un aviso en la campana y, si se pidió, correo o WhatsApp.
--  · El reloj es de la plataforma, no de un proveedor: pg_cron llama cada minuto
--    a /api/asistente/programador (en producción; en pruebas lo llama la suite
--    con el reloj adelantado) y la ruta toma lo vencido con
--    `asistente.tomar_vencidas()`, que lo marca bajo candado: no corre dos veces.
--  · Un TABLERO es una tarea que, en vez de un chat, mantiene al día un
--    artefacto (`html_grupo`): cada corrida le agrega una versión.
--  · La INVESTIGACIÓN PROFUNDA es un modo del turno (`turno.modo`): más vueltas,
--    más búsquedas, su propio tope y, si pasa del tramo de la función de fondo,
--    se reanuda (`turno.continuacion`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) CONFIGURACIÓN Y POLÍTICA
-- -----------------------------------------------------------------------------

alter table asistente.config
  add column if not exists programador_pausado boolean not null default false,
  add column if not exists max_tareas integer not null default 10 check (max_tareas >= 0),
  add column if not exists frecuencia_min_min integer not null default 60 check (frecuencia_min_min between 60 and 10080),
  add column if not exists tope_investigacion_usd numeric(10, 2) not null default 3 check (tope_investigacion_usd >= 0),
  -- Remitente verificado en Resend (P7: el subdominio de Iberia). Vacío = el correo queda pendiente.
  add column if not exists correo_remitente text check (correo_remitente is null or correo_remitente ~ '^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$'),
  add column if not exists correo_nombre text not null default 'Asistente de IA · Iberia' check (length(correo_nombre) between 1 and 80),
  -- Plantilla de WhatsApp aprobada por Meta para los resultados (la conexión es la de `ajustes_whatsapp`).
  add column if not exists whatsapp_plantilla text check (whatsapp_plantilla is null or whatsapp_plantilla ~ '^[a-z0-9_]{1,512}$');

alter table asistente.politica_rol
  add column if not exists max_tareas integer check (max_tareas is null or max_tareas >= 0),
  add column if not exists frecuencia_min_min integer check (frecuencia_min_min is null or frecuencia_min_min between 60 and 10080);
alter table asistente.politica_usuario
  add column if not exists max_tareas integer check (max_tareas is null or max_tareas >= 0),
  add column if not exists frecuencia_min_min integer check (frecuencia_min_min is null or frecuencia_min_min between 60 and 10080);

-- La política efectiva suma lo de programar.
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
  return jsonb_build_object(
    'habilitado', pr.activo and coalesce(u.habilitado, v_casilla),
    'encendido', c.encendido,
    'motor', c.motor,
    'modelos', to_jsonb(coalesce(u.modelos, r.modelos, (select array_agg(m.id order by m.orden) from asistente.modelo m where m.encendido))),
    'modelo_defecto', case c.motor when 'openai' then c.modelo_openai else c.modelo_anthropic end,
    'esfuerzo_defecto', c.esfuerzo_defecto,
    'esfuerzo_max', coalesce(u.esfuerzo_max, r.esfuerzo_max, c.esfuerzo_max),
    'tope_diario_usd', coalesce(u.tope_diario_usd, r.tope_diario_usd, c.tope_diario_usd),
    'tope_mensual_usd', coalesce(u.tope_mensual_usd, r.tope_mensual_usd, c.tope_mensual_usd),
    'tope_empresa_usd', c.tope_mensual_empresa_usd,
    'tope_investigacion_usd', c.tope_investigacion_usd,
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

-- -----------------------------------------------------------------------------
-- 2) TAREAS Y CORRIDAS
-- -----------------------------------------------------------------------------

create table if not exists asistente.tarea (
  id              uuid primary key default gen_random_uuid(),
  dueno           uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  tipo            text not null default 'tarea' check (tipo in ('tarea', 'tablero')),
  nombre          text not null check (length(trim(nombre)) between 2 and 120),
  instruccion     text not null check (length(trim(instruccion)) between 5 and 8000),
  proyecto_id     uuid references asistente.proyecto (id) on delete set null,
  -- El artefacto que mantiene al día un tablero.
  html_grupo      uuid,
  modelo          text,
  esfuerzo        text check (esfuerzo is null or esfuerzo in ('low', 'medium', 'high', 'xhigh', 'max')),
  -- Cuándo, siempre en hora de Caracas.
  frecuencia      text not null check (frecuencia in ('horas', 'diaria', 'semanal', 'mensual')),
  hora            time not null default '08:00',
  dias            smallint[] not null default '{}' check (dias <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  dia_mes         smallint check (dia_mes is null or dia_mes between 1 and 28),
  cada_horas      smallint check (cada_horas is null or cada_horas in (1, 2, 3, 4, 6, 8, 12)),
  canales         text[] not null default array['plataforma'] check (canales <@ array['plataforma', 'correo', 'whatsapp'] and 'plataforma' = any (canales)),
  -- Otras personas de la plataforma que reciben el resultado (compartir: revisa el linaje).
  destinatarios   uuid[] not null default '{}' check (cardinality(destinatarios) <= 20),
  en_mi_dia       boolean not null default false,
  estado          text not null default 'activa' check (estado in ('activa', 'pausada')),
  pausada_motivo  text check (pausada_motivo is null or length(pausada_motivo) <= 300),
  proxima_en      timestamptz,
  ultima_en       timestamptz,
  fallas_seguidas integer not null default 0,
  -- Las fuentes que consultó la última corrida buena: si el dueño pierde una, la corrida lo dice.
  fuentes_usadas  text[] not null default '{}',
  origen_chat     uuid references asistente.chat (id) on delete set null,
  origen_mensaje  uuid references asistente.mensaje (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  constraint tarea_semanal check (frecuencia <> 'semanal' or cardinality(dias) >= 1),
  constraint tarea_mensual check (frecuencia <> 'mensual' or dia_mes is not null),
  constraint tarea_horas check (frecuencia <> 'horas' or cada_horas is not null),
  constraint tarea_tablero check ((tipo = 'tablero') = (html_grupo is not null))
);
create index if not exists tarea_dueno_idx on asistente.tarea (dueno, estado);
create index if not exists tarea_vencida_idx on asistente.tarea (proxima_en) where estado = 'activa';
alter table asistente.tarea enable row level security;

create table if not exists asistente.corrida (
  id              uuid primary key default gen_random_uuid(),
  tarea_id        uuid not null references asistente.tarea (id) on delete cascade,
  dueno           uuid not null references public.profiles (id) on delete cascade,
  programada_para timestamptz not null,
  intento         smallint not null default 1 check (intento between 1 and 2),
  manual          boolean not null default false,
  estado          text not null default 'en_cola' check (estado in ('en_cola', 'corriendo', 'lista', 'fallida', 'saltada')),
  reintentar_en   timestamptz,
  chat_id         uuid references asistente.chat (id) on delete set null,
  turno_id        uuid references asistente.turno (id) on delete set null,
  error           text check (error is null or length(error) <= 2000),
  -- Cómo salió por cada canal y a quién: [{canal, a, estado, detalle}]. Sin contenido.
  entregas        jsonb not null default '[]'::jsonb,
  creado_en       timestamptz not null default now(),
  empezado_en     timestamptz,
  terminado_en    timestamptz,
  unique (tarea_id, programada_para, intento)
);
create index if not exists corrida_tarea_idx on asistente.corrida (tarea_id, creado_en desc);
create index if not exists corrida_reintento_idx on asistente.corrida (reintentar_en) where estado = 'en_cola';
alter table asistente.corrida enable row level security;

-- El chat de una corrida sabe de qué tarea viene; el turno, de qué corrida y en qué modo.
alter table asistente.chat add column if not exists tarea_id uuid references asistente.tarea (id) on delete set null;
alter table asistente.turno
  add column if not exists corrida_id uuid references asistente.corrida (id) on delete set null,
  add column if not exists modo text not null default 'normal' check (modo in ('normal', 'investigacion')),
  -- El estado del motor cuando un turno largo se parte en tramos (investigación profunda).
  add column if not exists continuacion jsonb,
  add column if not exists tramos smallint not null default 0;

-- Con sesión, ni el chat se cuelga de una tarea ni el turno de una corrida: eso es del programador.
create or replace function asistente.t_chat_tarea()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and new.tarea_id is distinct from (case when tg_op = 'UPDATE' then old.tarea_id end) then
    raise exception 'El chat de una tarea lo crea el programador' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists b_chat_tarea on asistente.chat;
create trigger b_chat_tarea before insert or update of tarea_id on asistente.chat for each row execute function asistente.t_chat_tarea();

drop policy if exists "pido turnos" on asistente.turno;
create policy "pido turnos" on asistente.turno for insert to authenticated
  with check (solicitante = (select auth.uid()) and estado = 'en_cola' and costo_usd = 0 and reserva_usd = 0
              and corrida_id is null and continuacion is null and tramos = 0
              and privado.participo_en_chat(chat_id) and (select privado.asistente_habilitado()));

-- -----------------------------------------------------------------------------
-- 3) CUÁNDO TOCA (siempre en hora de Caracas, que no tiene horario de verano)
-- -----------------------------------------------------------------------------

create or replace function asistente.proxima_ejecucion(t asistente.tarea, p_desde timestamptz)
returns timestamptz
language plpgsql stable set search_path = asistente, public as $$
declare
  l timestamp := p_desde at time zone 'America/Caracas';
  c timestamp;
  i integer;
begin
  if t.frecuencia = 'horas' then
    -- Desde la hora de ayer, de cada_horas en cada_horas: cruza la medianoche sin saltos.
    c := date_trunc('day', l) - interval '1 day' + t.hora;
    while c <= l loop c := c + make_interval(hours => t.cada_horas); end loop;
  elsif t.frecuencia = 'diaria' then
    c := date_trunc('day', l) + t.hora;
    if c <= l then c := c + interval '1 day'; end if;
  elsif t.frecuencia = 'semanal' then
    for i in 0..7 loop
      c := date_trunc('day', l) + make_interval(days => i) + t.hora;
      exit when c > l and extract(isodow from c)::smallint = any (t.dias);
    end loop;
  else
    c := date_trunc('month', l) + make_interval(days => t.dia_mes - 1) + t.hora;
    if c <= l then c := date_trunc('month', l) + interval '1 month' + make_interval(days => t.dia_mes - 1) + t.hora; end if;
  end if;
  return c at time zone 'America/Caracas';
end;
$$;
grant execute on function asistente.proxima_ejecucion(asistente.tarea, timestamptz) to authenticated, service_role;

-- Al crear o cambiar una tarea: se valida contra la política y se calcula la próxima.
create or replace function asistente.t_tarea()
returns trigger language plpgsql security definer set search_path = asistente, public as $$
declare
  pol jsonb;
  v_activas integer;
  d uuid;
begin
  -- ⚠️ La función es security definer (llama a politica_de): adentro `current_user`
  -- es su dueña, no quien llama. El rol de la petición está en el ajuste `role`.
  if coalesce(current_setting('role', true), '') = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.dueno is distinct from auth.uid() then raise exception 'La tarea es de quien la crea' using errcode = 'insufficient_privilege'; end if;
      new.fallas_seguidas := 0;
      new.ultima_en := null;
      new.fuentes_usadas := '{}';
    else
      -- Lo que lleva la cuenta es del programador.
      new.dueno := old.dueno;
      new.fallas_seguidas := case when new.estado = 'activa' and old.estado = 'pausada' then 0 else old.fallas_seguidas end;
      new.ultima_en := old.ultima_en;
      new.fuentes_usadas := old.fuentes_usadas;
      new.tipo := old.tipo;
      new.html_grupo := old.html_grupo;
      new.creado_en := old.creado_en;
    end if;
    pol := asistente.politica_de(new.dueno);
    if not coalesce((pol ->> 'habilitado')::boolean, false) then raise exception 'No tienes el asistente de IA habilitado' using errcode = 'insufficient_privilege'; end if;
    if new.estado = 'activa' then
      if not coalesce((pol ->> 'puede_programar')::boolean, false) then raise exception 'Tu política no te deja programar tareas' using errcode = 'insufficient_privilege'; end if;
      select count(*) into v_activas from asistente.tarea where dueno = new.dueno and estado = 'activa' and id <> new.id;
      if v_activas >= (pol ->> 'max_tareas')::integer then
        raise exception 'Llegaste al máximo de tareas activas (%)', (pol ->> 'max_tareas') using errcode = 'check_violation';
      end if;
      if new.frecuencia = 'horas' and new.cada_horas * 60 < (pol ->> 'frecuencia_min_min')::integer then
        raise exception 'La administración no deja programar más de una vez cada % horas', ((pol ->> 'frecuencia_min_min')::integer / 60) using errcode = 'check_violation';
      end if;
      if new.frecuencia <> 'horas' and (pol ->> 'frecuencia_min_min')::integer > 1440 and new.frecuencia = 'diaria' then
        raise exception 'La administración no deja programar tareas diarias' using errcode = 'check_violation';
      end if;
    end if;
    if new.proyecto_id is not null and not exists (select 1 from asistente.proyecto p where p.id = new.proyecto_id and p.dueno = new.dueno) then
      raise exception 'El proyecto no es tuyo' using errcode = 'insufficient_privilege';
    end if;
    if new.modelo is not null and not coalesce((pol -> 'modelos') ? new.modelo, false) then
      raise exception 'Ese modelo no está habilitado para ti' using errcode = 'check_violation';
    end if;
    -- Los destinatarios: otras personas con el asistente (sin repetir ni incluir al dueño).
    new.destinatarios := array(select distinct x from unnest(new.destinatarios) x where x <> new.dueno);
    foreach d in array new.destinatarios loop
      if not coalesce((asistente.politica_de(d) ->> 'habilitado')::boolean, false) then
        raise exception 'Un destinatario no tiene el asistente de IA' using errcode = 'check_violation';
      end if;
    end loop;
  end if;
  if new.estado = 'pausada' then
    new.proxima_en := null;
  elsif tg_op = 'INSERT' or old.estado = 'pausada' or (new.frecuencia, new.hora, new.dias, new.dia_mes, new.cada_horas) is distinct from (old.frecuencia, old.hora, old.dias, old.dia_mes, old.cada_horas)
        or (new.proxima_en is null) then
    new.proxima_en := asistente.proxima_ejecucion(new, now());
  end if;
  if new.estado = 'activa' then new.pausada_motivo := null; end if;
  new.actualizado_en := now();
  return new;
end;
$$;
drop trigger if exists b_tarea on asistente.tarea;
create trigger b_tarea before insert or update on asistente.tarea for each row execute function asistente.t_tarea();

-- -----------------------------------------------------------------------------
-- 4) EL PROGRAMADOR (solo servicio)
-- -----------------------------------------------------------------------------

-- Toma lo vencido (tareas a su hora y reintentos) y lo marca `corriendo` bajo
-- candado: dos llamadas a la vez no toman lo mismo. Adelanta la próxima de
-- cada tarea desde AHORA: si el reloj estuvo caído, corre una vez, no N.
-- `p_ahora` existe para las pruebas (el reloj adelantado).
create or replace function asistente.tomar_vencidas(p_ahora timestamptz default now(), p_limite integer default 20)
returns setof asistente.corrida
language plpgsql security definer set search_path = asistente, public as $$
declare
  t asistente.tarea;
  c asistente.corrida;
begin
  if (select programador_pausado from asistente.config where id) then return; end if;
  for t in
    select * from asistente.tarea where estado = 'activa' and proxima_en <= p_ahora order by proxima_en limit p_limite for update skip locked
  loop
    insert into asistente.corrida (tarea_id, dueno, programada_para, estado, empezado_en)
      values (t.id, t.dueno, t.proxima_en, 'corriendo', now())
      on conflict (tarea_id, programada_para, intento) do nothing
      returning * into c;
    update asistente.tarea set proxima_en = asistente.proxima_ejecucion(t, greatest(p_ahora, t.proxima_en)) where id = t.id;
    if c.id is not null then return next c; end if;
    c := null;
  end loop;
  for c in
    update asistente.corrida k set estado = 'corriendo', empezado_en = now(), reintentar_en = null
     where k.id in (select id from asistente.corrida where estado = 'en_cola' and reintentar_en <= p_ahora order by reintentar_en limit p_limite for update skip locked)
    returning k.*
  loop
    return next c;
  end loop;
end;
$$;
revoke all on function asistente.tomar_vencidas(timestamptz, integer) from public, anon, authenticated;
grant execute on function asistente.tomar_vencidas(timestamptz, integer) to service_role;

-- «Correr ahora»: del dueño, con su política. Devuelve la corrida, que el servidor lanza.
create or replace function asistente.correr_ahora(p_tarea uuid)
returns uuid
language plpgsql security definer set search_path = asistente, public as $$
declare
  t asistente.tarea;
  v_id uuid;
begin
  select * into t from asistente.tarea where id = p_tarea and dueno = auth.uid();
  if not found then raise exception 'Esa tarea no es tuya' using errcode = 'insufficient_privilege'; end if;
  if not coalesce((asistente.politica_de(auth.uid()) ->> 'puede_programar')::boolean, false) then
    raise exception 'Tu política no te deja programar tareas' using errcode = 'insufficient_privilege';
  end if;
  if exists (select 1 from asistente.corrida where tarea_id = p_tarea and estado = 'corriendo' and empezado_en > now() - interval '20 minutes') then
    raise exception 'Esa tarea ya está corriendo' using errcode = 'check_violation';
  end if;
  insert into asistente.corrida (tarea_id, dueno, programada_para, manual, estado, empezado_en)
    values (t.id, t.dueno, now(), true, 'corriendo', now()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function asistente.correr_ahora(uuid) from public, anon;
grant execute on function asistente.correr_ahora(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) RLS
-- -----------------------------------------------------------------------------

drop policy if exists "mis tareas" on asistente.tarea;
create policy "mis tareas" on asistente.tarea for select to authenticated using (dueno = (select auth.uid()));
drop policy if exists "creo tareas" on asistente.tarea;
create policy "creo tareas" on asistente.tarea for insert to authenticated
  with check (dueno = (select auth.uid()) and (select privado.asistente_habilitado()));
drop policy if exists "cambio mis tareas" on asistente.tarea;
create policy "cambio mis tareas" on asistente.tarea for update to authenticated
  using (dueno = (select auth.uid())) with check (dueno = (select auth.uid()));
drop policy if exists "borro mis tareas" on asistente.tarea;
create policy "borro mis tareas" on asistente.tarea for delete to authenticated using (dueno = (select auth.uid()));

drop policy if exists "mis corridas" on asistente.corrida;
create policy "mis corridas" on asistente.corrida for select to authenticated using (dueno = (select auth.uid()));

grant select, insert, update, delete on asistente.tarea to authenticated;
grant select on asistente.corrida to authenticated;
grant all on asistente.tarea, asistente.corrida to service_role;

-- -----------------------------------------------------------------------------
-- 6) LO QUE VE LA ADMINISTRACIÓN: cuentas, nunca instrucciones
-- -----------------------------------------------------------------------------

create or replace function asistente.tareas_resumen()
returns jsonb
language sql stable security definer set search_path = asistente, public as $$
  select jsonb_build_object(
    'activas', (select count(*) from asistente.tarea where estado = 'activa'),
    'pausadas', (select count(*) from asistente.tarea where estado = 'pausada'),
    'tableros', (select count(*) from asistente.tarea where tipo = 'tablero' and estado = 'activa'),
    'corridas_mes', (select count(*) from asistente.corrida where creado_en >= date_trunc('month', now() at time zone 'America/Caracas') at time zone 'America/Caracas'),
    'fallidas_mes', (select count(*) from asistente.corrida where estado = 'fallida' and creado_en >= date_trunc('month', now() at time zone 'America/Caracas') at time zone 'America/Caracas'),
    'pausado', (select programador_pausado from asistente.config where id)
  ) where public.puede('sistema:asistente-admin', 'ver');
$$;
revoke all on function asistente.tareas_resumen() from public, anon;
grant execute on function asistente.tareas_resumen() to authenticated;
