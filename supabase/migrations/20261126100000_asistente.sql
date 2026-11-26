-- =============================================================================
-- PLATAFORMA IBERIA · ASISTENTE DE IA · FASE 1
-- El chat, los archivos y los Excel grandes (plan del 26-nov-2026, Claude Docs
-- «Plan · Asistente de IA en la Plataforma Iberia»).
--
-- Principios que esta migración hace cumplir en la base:
--  · Cada usuario ve solo sus chats (y los que le compartan, fase 4): RLS por
--    `privado.participo_en_chat`, que es security definer para no entrar en
--    recursión (trampa conocida del repo).
--  · Los topes se reservan antes de cada turno, bajo candado: dos turnos a la
--    vez no pasan un tope (`asistente.reservar_turno`, solo servicio).
--  · El interruptor general de IA y la capacidad NUC-ASI-IA-01 apagan el
--    asistente. El gasto del asistente vive en `asistente.turno` y NO en
--    `ia.actividad`: el tope diario de la IA de la plataforma (US$ 2) es para
--    las capacidades de los módulos; el asistente tiene sus tres topes propios
--    (diario y mensual por persona, mensual de la empresa).
--  · Nadie se sube un tope, se mete en un chat ajeno ni se cambia el dueño:
--    triggers de columnas, porque la RLS decide filas y no columnas.
-- =============================================================================

create schema if not exists asistente;
grant usage on schema asistente to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1) CONFIGURACIÓN Y CATÁLOGO
-- -----------------------------------------------------------------------------

create table if not exists asistente.config (
  id                      boolean primary key default true check (id),
  motor                   text not null default 'anthropic' check (motor in ('anthropic', 'openai', 'local')),
  encendido               boolean not null default true,
  tope_mensual_empresa_usd numeric(10, 2) not null default 600 check (tope_mensual_empresa_usd >= 0),
  modelo_anthropic        text not null default 'claude-opus-5-5',
  modelo_openai           text not null default 'gpt-6.2-sol',
  esfuerzo_defecto        text not null default 'medium' check (esfuerzo_defecto in ('low', 'medium', 'high', 'xhigh', 'max')),
  -- La política de quien no tiene fila de rol ni de usuario.
  tope_diario_usd         numeric(10, 2) not null default 5 check (tope_diario_usd >= 0),
  tope_mensual_usd        numeric(10, 2) not null default 40 check (tope_mensual_usd >= 0),
  cuota_mb                integer not null default 2048 check (cuota_mb >= 0),
  esfuerzo_max            text not null default 'high' check (esfuerzo_max in ('low', 'medium', 'high', 'xhigh', 'max')),
  -- Lo que el asistente sabe de Iberia en todo chat (vocabulario, tono, formato).
  instrucciones_empresa   text not null default '' check (length(instrucciones_empresa) <= 20000),
  actualizado_por         uuid references public.profiles (id),
  actualizado_en          timestamptz not null default now()
);
alter table asistente.config enable row level security;
insert into asistente.config (id) values (true) on conflict do nothing;

create table if not exists asistente.modelo (
  id              text primary key,
  proveedor       text not null check (proveedor in ('anthropic', 'openai', 'local')),
  nombre          text not null,
  descripcion     text not null default '',
  -- USD por millón de tokens, precios de lista con su fecha de verificación.
  precio_entrada  numeric(10, 4) not null,
  precio_salida   numeric(10, 4) not null,
  precio_cache_lee numeric(10, 4) not null default 0,
  precio_cache_escribe numeric(10, 4) not null default 0,
  esfuerzos       text[] not null default array['low', 'medium', 'high'],
  vision          boolean not null default true,
  encendido       boolean not null default true,
  orden           integer not null default 0,
  verificado_en   date not null
);
alter table asistente.modelo enable row level security;

-- Precios: https://platform.claude.com/docs/en/about-claude/pricing y
-- https://developers.openai.com/api/docs/pricing, consultados el 26-nov-2026.
insert into asistente.modelo (id, proveedor, nombre, descripcion, precio_entrada, precio_salida, precio_cache_lee, precio_cache_escribe, esfuerzos, orden, verificado_en)
values
  ('claude-opus-5-5', 'anthropic', 'Opus 5.5', 'El más capaz. Análisis, Excel grandes y documentos.', 4, 20, 0.20, 5, array['low', 'medium', 'high', 'xhigh', 'max'], 1, date '2026-11-26'),
  ('claude-sonnet-5-5', 'anthropic', 'Sonnet 5.5', 'Rápido y capaz para el trabajo de todos los días.', 2, 10, 0.10, 2.5, array['low', 'medium', 'high', 'xhigh', 'max'], 2, date '2026-11-26'),
  ('claude-haiku-5-5', 'anthropic', 'Haiku 5.5', 'El más rápido y económico, para lo sencillo.', 0.10, 0.50, 0.01, 0.125, array['low', 'medium', 'high'], 3, date '2026-11-26'),
  ('gpt-6.2-astra', 'openai', 'GPT-6.2 Astra', 'El más capaz de OpenAI.', 8, 40, 0.40, 8, array['low', 'medium', 'high'], 11, date '2026-11-26'),
  ('gpt-6.2-sol', 'openai', 'GPT-6.2 Sol', 'Equilibrio entre calidad y costo.', 2, 10, 0.10, 2, array['low', 'medium', 'high'], 12, date '2026-11-26'),
  ('gpt-6.1-terra', 'openai', 'GPT-6.1 Terra', 'Rápido y económico.', 1, 5, 0.05, 1, array['low', 'medium', 'high'], 13, date '2026-11-26')
on conflict (id) do nothing;

-- La política por rol y la excepción por usuario. Un campo nulo hereda: el de
-- usuario hereda del rol, y el del rol, de `config`.
create table if not exists asistente.politica_rol (
  rol_id            uuid primary key references public.roles (id) on delete cascade,
  modelos           text[],
  esfuerzo_max      text check (esfuerzo_max is null or esfuerzo_max in ('low', 'medium', 'high', 'xhigh', 'max')),
  tope_diario_usd   numeric(10, 2) check (tope_diario_usd is null or tope_diario_usd >= 0),
  tope_mensual_usd  numeric(10, 2) check (tope_mensual_usd is null or tope_mensual_usd >= 0),
  cuota_mb          integer check (cuota_mb is null or cuota_mb >= 0),
  puede_compartir   boolean,
  puede_programar   boolean,
  actualizado_por   uuid references public.profiles (id),
  actualizado_en    timestamptz not null default now()
);
alter table asistente.politica_rol enable row level security;

create table if not exists asistente.politica_usuario (
  perfil_id         uuid primary key references public.profiles (id) on delete cascade,
  -- null = lo que diga la casilla `sistema:asistente` de su rol.
  habilitado        boolean,
  modelos           text[],
  esfuerzo_max      text check (esfuerzo_max is null or esfuerzo_max in ('low', 'medium', 'high', 'xhigh', 'max')),
  tope_diario_usd   numeric(10, 2) check (tope_diario_usd is null or tope_diario_usd >= 0),
  tope_mensual_usd  numeric(10, 2) check (tope_mensual_usd is null or tope_mensual_usd >= 0),
  cuota_mb          integer check (cuota_mb is null or cuota_mb >= 0),
  puede_compartir   boolean,
  puede_programar   boolean,
  nota              text check (nota is null or length(nota) <= 500),
  actualizado_por   uuid references public.profiles (id),
  actualizado_en    timestamptz not null default now()
);
alter table asistente.politica_usuario enable row level security;

-- -----------------------------------------------------------------------------
-- 2) CHATS, PARTICIPANTES, TURNOS Y MENSAJES
-- -----------------------------------------------------------------------------

create table if not exists asistente.chat (
  id                uuid primary key default gen_random_uuid(),
  dueno             uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  titulo            text not null default 'Chat nuevo' check (length(titulo) between 1 and 200),
  titulo_auto       boolean not null default true,
  compartido        boolean not null default false,
  -- El contenedor de ejecución de código de Anthropic (vive 30 días).
  contenedor_id     text,
  contenedor_usado_en timestamptz,
  motor             text check (motor is null or motor in ('anthropic', 'openai', 'local')),
  modelo            text,
  esfuerzo          text,
  archivado         boolean not null default false,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now()
);
create index if not exists chat_dueno_idx on asistente.chat (dueno, archivado, actualizado_en desc);
alter table asistente.chat enable row level security;

create table if not exists asistente.participante (
  chat_id   uuid not null references asistente.chat (id) on delete cascade,
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  rol       text not null default 'participante' check (rol in ('dueno', 'participante')),
  desde     timestamptz not null default now(),
  primary key (chat_id, perfil_id)
);
create index if not exists participante_perfil_idx on asistente.participante (perfil_id);
alter table asistente.participante enable row level security;

create table if not exists asistente.turno (
  id                 uuid primary key default gen_random_uuid(),
  chat_id            uuid not null references asistente.chat (id) on delete cascade,
  solicitante        uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  estado             text not null default 'en_cola' check (estado in ('en_cola', 'corriendo', 'listo', 'fallido', 'detenido')),
  motor              text not null check (motor in ('anthropic', 'openai', 'local')),
  modelo             text not null,
  esfuerzo           text not null check (esfuerzo in ('low', 'medium', 'high', 'xhigh', 'max')),
  tokens_entrada     integer not null default 0,
  tokens_salida      integer not null default 0,
  tokens_cache_lee   integer not null default 0,
  tokens_cache_escribe integer not null default 0,
  busquedas          integer not null default 0,
  segundos_contenedor integer not null default 0,
  costo_usd          numeric(12, 5) not null default 0,
  -- Lo reservado mientras corre (cuenta contra los topes hasta cerrar).
  reserva_usd        numeric(12, 5) not null default 0,
  error              text check (error is null or length(error) <= 2000),
  detener            boolean not null default false,
  categoria          text check (categoria is null or categoria in ('analisis', 'redaccion', 'consulta', 'documento', 'investigacion', 'codigo', 'otro')),
  primer_token_ms    integer,
  duracion_ms        integer,
  latido             timestamptz,
  creado_en          timestamptz not null default now(),
  empezado_en        timestamptz,
  terminado_en       timestamptz
);
create index if not exists turno_chat_idx on asistente.turno (chat_id, creado_en desc);
create index if not exists turno_gasto_idx on asistente.turno (solicitante, creado_en);
create index if not exists turno_abierto_idx on asistente.turno (estado) where estado in ('en_cola', 'corriendo');
alter table asistente.turno enable row level security;

create table if not exists asistente.mensaje (
  id               uuid primary key default gen_random_uuid(),
  chat_id          uuid not null references asistente.chat (id) on delete cascade,
  turno_id         uuid references asistente.turno (id) on delete set null,
  rol              text not null check (rol in ('usuario', 'asistente')),
  -- null = el asistente.
  autor            uuid references public.profiles (id) on delete set null,
  texto            text not null default '' check (length(texto) <= 200000),
  -- Bloques normalizados (no los de un proveedor): pasos de herramienta,
  -- archivos y HTML generados, citas de búsqueda, pensamiento resumido.
  bloques          jsonb not null default '[]'::jsonb,
  -- Los archivos que adjuntó la persona en este mensaje.
  adjuntos         uuid[] not null default '{}',
  calificacion     smallint check (calificacion is null or calificacion in (-1, 1)),
  calificacion_nota text check (calificacion_nota is null or length(calificacion_nota) <= 1000),
  creado_en        timestamptz not null default now()
);
create index if not exists mensaje_chat_idx on asistente.mensaje (chat_id, creado_en);
alter table asistente.mensaje enable row level security;

create table if not exists asistente.archivo (
  id                 uuid primary key default gen_random_uuid(),
  dueno              uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  chat_id            uuid references asistente.chat (id) on delete set null,
  mensaje_id         uuid references asistente.mensaje (id) on delete set null,
  origen             text not null check (origen in ('subido', 'generado')),
  estado             text not null default 'subiendo' check (estado in ('subiendo', 'listo', 'error')),
  nombre             text not null check (length(nombre) between 1 and 255),
  mime               text not null default 'application/octet-stream',
  bytes              bigint not null default 0 check (bytes >= 0 and bytes <= 104857600),
  ruta               text not null unique,
  huella             text,
  -- La copia en la Files API de Anthropic (decisión P6: Storage es la fuente;
  -- la copia se borra tras 30 días sin uso y se vuelve a subir si hace falta).
  anthropic_file_id  text,
  anthropic_usado_en timestamptz,
  creado_en          timestamptz not null default now()
);
create index if not exists archivo_dueno_idx on asistente.archivo (dueno, creado_en desc);
create index if not exists archivo_chat_idx on asistente.archivo (chat_id);
alter table asistente.archivo enable row level security;

create table if not exists asistente.html (
  id          uuid primary key default gen_random_uuid(),
  dueno       uuid not null references public.profiles (id) on delete cascade,
  chat_id     uuid references asistente.chat (id) on delete set null,
  mensaje_id  uuid references asistente.mensaje (id) on delete set null,
  titulo      text not null check (length(titulo) between 1 and 200),
  ruta        text not null unique,
  version     integer not null default 1,
  bytes       bigint not null default 0,
  creado_en   timestamptz not null default now()
);
create index if not exists html_dueno_idx on asistente.html (dueno, creado_en desc);
create index if not exists html_chat_idx on asistente.html (chat_id);
alter table asistente.html enable row level security;

-- Lectura de chats por Boosty, para soporte (decisión 9): solo por función,
-- y cada lectura queda aquí. Sin update ni delete para nadie.
create table if not exists asistente.lectura_soporte (
  id         uuid primary key default gen_random_uuid(),
  lector     uuid not null references public.profiles (id),
  chat_id    uuid not null references asistente.chat (id) on delete cascade,
  motivo     text not null check (length(trim(motivo)) between 5 and 500),
  ticket     text check (ticket is null or length(ticket) <= 100),
  creado_en  timestamptz not null default now()
);
alter table asistente.lectura_soporte enable row level security;

-- -----------------------------------------------------------------------------
-- 3) PREGUNTAS QUE LA RLS NECESITA (security definer, fuera de la API)
-- -----------------------------------------------------------------------------

create or replace function privado.participo_en_chat(p_chat uuid)
returns boolean
language sql stable security definer set search_path = asistente, public as $$
  select exists (select 1 from asistente.participante p where p.chat_id = p_chat and p.perfil_id = auth.uid());
$$;
revoke all on function privado.participo_en_chat(uuid) from public, anon;
grant execute on function privado.participo_en_chat(uuid) to authenticated, service_role;

-- La política efectiva de una persona (usuario › rol › config). La usan el
-- servidor (con la clave de servicio, para el turno) y `mi_politica()`.
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
    'cuota_mb', coalesce(u.cuota_mb, r.cuota_mb, c.cuota_mb),
    'puede_compartir', coalesce(u.puede_compartir, r.puede_compartir, true),
    'puede_programar', coalesce(u.puede_programar, r.puede_programar, true),
    'gastado_dia_usd', round(v_dia, 4),
    'gastado_mes_usd', round(v_mes, 4),
    'gastado_empresa_usd', round(v_empresa, 4),
    'usado_bytes', v_usado
  );
end;
$$;
revoke all on function asistente.politica_de(uuid) from public, anon, authenticated;
grant execute on function asistente.politica_de(uuid) to service_role;

create or replace function asistente.mi_politica()
returns jsonb
language sql stable security definer set search_path = asistente, public as $$
  select asistente.politica_de(auth.uid()) - 'gastado_empresa_usd' - 'tope_empresa_usd'
   where auth.uid() is not null;
$$;
revoke all on function asistente.mi_politica() from public, anon;
grant execute on function asistente.mi_politica() to authenticated;

create or replace function privado.asistente_habilitado()
returns boolean
language sql stable security definer set search_path = asistente, public as $$
  select coalesce((asistente.politica_de(auth.uid()) ->> 'habilitado')::boolean, false);
$$;
revoke all on function privado.asistente_habilitado() from public, anon;
grant execute on function privado.asistente_habilitado() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) TOPES: reservar al empezar, cerrar al terminar (solo servicio)
-- -----------------------------------------------------------------------------

-- Devuelve null si se reservó; si no, el motivo legible (y el turno queda fallido).
create or replace function asistente.reservar_turno(p_turno uuid, p_reserva_usd numeric)
returns text
language plpgsql security definer set search_path = asistente, public as $$
declare
  t asistente.turno;
  pol jsonb;
  v_motivo text;
begin
  perform pg_advisory_xact_lock(hashtext('asistente.reserva'));
  select * into t from asistente.turno where id = p_turno for update;
  if not found then return 'Ese turno no existe.'; end if;
  if t.estado <> 'en_cola' then return 'Ese turno ya empezó.'; end if;
  -- Turnos colgados (la función murió sin cerrar): se liberan a los 20 minutos.
  update asistente.turno set estado = 'fallido', reserva_usd = 0, error = 'El turno se quedó sin respuesta y se cerró.', terminado_en = now()
   where estado = 'corriendo' and coalesce(latido, empezado_en) < now() - interval '20 minutes';
  pol := asistente.politica_de(t.solicitante);
  v_motivo := case
    when not coalesce((select encendido from ia.interruptor_general), false) then 'La IA está apagada en toda la plataforma (interruptor general).'
    when not exists (select 1 from ia.capacidad where codigo = 'NUC-ASI-IA-01' and encendida and nivel_actual <> 'N0') then 'El asistente de IA está apagado en el Gobierno de IA.'
    when not (pol ->> 'encendido')::boolean then 'El asistente está apagado por la administración.'
    when not (pol ->> 'habilitado')::boolean then 'No tienes el asistente de IA habilitado.'
    when not (pol -> 'modelos') ? t.modelo then 'Ese modelo no está habilitado para ti.'
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

-- -----------------------------------------------------------------------------
-- 5) TRIGGERS: el dueño entra como participante; columnas protegidas
-- -----------------------------------------------------------------------------

create or replace function asistente.t_chat_dueno()
returns trigger language plpgsql security definer set search_path = asistente, public as $$
begin
  insert into asistente.participante (chat_id, perfil_id, rol) values (new.id, new.dueno, 'dueno') on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists chat_dueno on asistente.chat;
create trigger chat_dueno after insert on asistente.chat for each row execute function asistente.t_chat_dueno();

-- Con sesión solo se cambian el título y el archivado; lo demás es del servidor.
create or replace function asistente.t_chat_proteger()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if new.dueno is distinct from old.dueno or new.compartido is distinct from old.compartido
       or new.contenedor_id is distinct from old.contenedor_id or new.contenedor_usado_en is distinct from old.contenedor_usado_en
       or new.motor is distinct from old.motor or new.modelo is distinct from old.modelo or new.esfuerzo is distinct from old.esfuerzo
       or new.creado_en is distinct from old.creado_en then
      raise exception 'Solo se cambian el título y el archivado' using errcode = 'insufficient_privilege';
    end if;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;
drop trigger if exists a_chat_proteger on asistente.chat;
create trigger a_chat_proteger before update on asistente.chat for each row execute function asistente.t_chat_proteger();

-- Un mensaje de la persona nace con su autor; del asistente solo cambia la calificación.
create or replace function asistente.t_mensaje_proteger()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'UPDATE' then
      if new.chat_id is distinct from old.chat_id or new.turno_id is distinct from old.turno_id or new.rol is distinct from old.rol
         or new.autor is distinct from old.autor or new.texto is distinct from old.texto or new.bloques is distinct from old.bloques
         or new.adjuntos is distinct from old.adjuntos or new.creado_en is distinct from old.creado_en then
        raise exception 'Solo se califica una respuesta' using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists a_mensaje_proteger on asistente.mensaje;
create trigger a_mensaje_proteger before update on asistente.mensaje for each row execute function asistente.t_mensaje_proteger();

-- Del turno, la persona solo pide detenerlo.
create or replace function asistente.t_turno_proteger()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if (to_jsonb(new) - 'detener') is distinct from (to_jsonb(old) - 'detener') then
      raise exception 'Del turno solo se pide detenerlo' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists a_turno_proteger on asistente.turno;
create trigger a_turno_proteger before update on asistente.turno for each row execute function asistente.t_turno_proteger();

-- Del archivo, con sesión solo se crea (subiendo) y se borra.
create or replace function asistente.t_archivo_proteger()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' and tg_op = 'UPDATE' then
    raise exception 'El archivo lo actualiza el servidor' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists a_archivo_proteger on asistente.archivo;
create trigger a_archivo_proteger before update on asistente.archivo for each row execute function asistente.t_archivo_proteger();

-- -----------------------------------------------------------------------------
-- 6) RLS
-- -----------------------------------------------------------------------------

-- Configuración y catálogo: los lee quien tiene sesión; los cambia la administración.
drop policy if exists "leo la config" on asistente.config;
create policy "leo la config" on asistente.config for select to authenticated using (true);
drop policy if exists "administro la config" on asistente.config;
create policy "administro la config" on asistente.config for update to authenticated
  using ((select public.puede('sistema:asistente-admin', 'editar'))) with check ((select public.puede('sistema:asistente-admin', 'editar')));

drop policy if exists "leo el catalogo" on asistente.modelo;
create policy "leo el catalogo" on asistente.modelo for select to authenticated using (true);
drop policy if exists "administro el catalogo" on asistente.modelo;
create policy "administro el catalogo" on asistente.modelo for update to authenticated
  using ((select public.puede('sistema:asistente-admin', 'editar'))) with check ((select public.puede('sistema:asistente-admin', 'editar')));

drop policy if exists "leo politicas de rol" on asistente.politica_rol;
create policy "leo politicas de rol" on asistente.politica_rol for select to authenticated using ((select public.puede('sistema:asistente-admin', 'ver')));
drop policy if exists "escribo politicas de rol" on asistente.politica_rol;
create policy "escribo politicas de rol" on asistente.politica_rol for insert to authenticated with check ((select public.puede('sistema:asistente-admin', 'editar')));
drop policy if exists "cambio politicas de rol" on asistente.politica_rol;
create policy "cambio politicas de rol" on asistente.politica_rol for update to authenticated
  using ((select public.puede('sistema:asistente-admin', 'editar'))) with check ((select public.puede('sistema:asistente-admin', 'editar')));
drop policy if exists "borro politicas de rol" on asistente.politica_rol;
create policy "borro politicas de rol" on asistente.politica_rol for delete to authenticated using ((select public.puede('sistema:asistente-admin', 'editar')));

drop policy if exists "leo politicas de usuario" on asistente.politica_usuario;
create policy "leo politicas de usuario" on asistente.politica_usuario for select to authenticated using ((select public.puede('sistema:asistente-admin', 'ver')));
drop policy if exists "escribo politicas de usuario" on asistente.politica_usuario;
create policy "escribo politicas de usuario" on asistente.politica_usuario for insert to authenticated with check ((select public.puede('sistema:asistente-admin', 'editar')));
drop policy if exists "cambio politicas de usuario" on asistente.politica_usuario;
create policy "cambio politicas de usuario" on asistente.politica_usuario for update to authenticated
  using ((select public.puede('sistema:asistente-admin', 'editar'))) with check ((select public.puede('sistema:asistente-admin', 'editar')));
drop policy if exists "borro politicas de usuario" on asistente.politica_usuario;
create policy "borro politicas de usuario" on asistente.politica_usuario for delete to authenticated using ((select public.puede('sistema:asistente-admin', 'editar')));

-- Chats: los veo si participo; los creo si tengo el asistente; título y archivado si soy el dueño.
drop policy if exists "veo mis chats" on asistente.chat;
create policy "veo mis chats" on asistente.chat for select to authenticated using (privado.participo_en_chat(id));
drop policy if exists "creo chats" on asistente.chat;
create policy "creo chats" on asistente.chat for insert to authenticated
  with check (dueno = (select auth.uid()) and (select privado.asistente_habilitado()) and not compartido);
drop policy if exists "cambio mis chats" on asistente.chat;
create policy "cambio mis chats" on asistente.chat for update to authenticated
  using (dueno = (select auth.uid())) with check (dueno = (select auth.uid()));
drop policy if exists "borro mis chats" on asistente.chat;
create policy "borro mis chats" on asistente.chat for delete to authenticated using (dueno = (select auth.uid()));

drop policy if exists "veo los participantes" on asistente.participante;
create policy "veo los participantes" on asistente.participante for select to authenticated using (privado.participo_en_chat(chat_id));

-- Turnos: los ve quien participa; los crea quien participa y tiene el asistente; solo se pide detener.
drop policy if exists "veo los turnos" on asistente.turno;
create policy "veo los turnos" on asistente.turno for select to authenticated using (privado.participo_en_chat(chat_id));
drop policy if exists "pido turnos" on asistente.turno;
create policy "pido turnos" on asistente.turno for insert to authenticated
  with check (solicitante = (select auth.uid()) and estado = 'en_cola' and costo_usd = 0 and reserva_usd = 0
              and privado.participo_en_chat(chat_id) and (select privado.asistente_habilitado()));
drop policy if exists "detengo mis turnos" on asistente.turno;
create policy "detengo mis turnos" on asistente.turno for update to authenticated
  using (solicitante = (select auth.uid())) with check (solicitante = (select auth.uid()));

-- Mensajes: los ve quien participa; la persona escribe los suyos; califica las respuestas.
drop policy if exists "veo los mensajes" on asistente.mensaje;
create policy "veo los mensajes" on asistente.mensaje for select to authenticated using (privado.participo_en_chat(chat_id));
drop policy if exists "escribo mis mensajes" on asistente.mensaje;
create policy "escribo mis mensajes" on asistente.mensaje for insert to authenticated
  with check (rol = 'usuario' and autor = (select auth.uid()) and privado.participo_en_chat(chat_id) and (select privado.asistente_habilitado()));
drop policy if exists "califico respuestas" on asistente.mensaje;
create policy "califico respuestas" on asistente.mensaje for update to authenticated
  using (rol = 'asistente' and privado.participo_en_chat(chat_id)) with check (rol = 'asistente' and privado.participo_en_chat(chat_id));

-- Archivos y HTML: los del dueño, y los de los chats donde participo.
drop policy if exists "veo archivos" on asistente.archivo;
create policy "veo archivos" on asistente.archivo for select to authenticated
  using (dueno = (select auth.uid()) or (chat_id is not null and privado.participo_en_chat(chat_id)));
drop policy if exists "subo archivos" on asistente.archivo;
create policy "subo archivos" on asistente.archivo for insert to authenticated
  with check (dueno = (select auth.uid()) and origen = 'subido' and estado = 'subiendo' and anthropic_file_id is null
              and (chat_id is null or privado.participo_en_chat(chat_id)) and (select privado.asistente_habilitado())
              and ruta like (select auth.uid())::text || '/%');
drop policy if exists "borro mis archivos" on asistente.archivo;
create policy "borro mis archivos" on asistente.archivo for delete to authenticated using (dueno = (select auth.uid()));

drop policy if exists "veo html" on asistente.html;
create policy "veo html" on asistente.html for select to authenticated
  using (dueno = (select auth.uid()) or (chat_id is not null and privado.participo_en_chat(chat_id)));
drop policy if exists "borro mis html" on asistente.html;
create policy "borro mis html" on asistente.html for delete to authenticated using (dueno = (select auth.uid()));

drop policy if exists "veo lecturas de soporte" on asistente.lectura_soporte;
create policy "veo lecturas de soporte" on asistente.lectura_soporte for select to authenticated
  using ((select privado.es_equipo_boosty()) or (select public.puede('sistema:asistente-admin', 'ver')));

grant select, update on asistente.config, asistente.modelo to authenticated;
grant select, insert, update, delete on asistente.politica_rol, asistente.politica_usuario to authenticated;
grant select, insert, update, delete on asistente.chat to authenticated;
grant select on asistente.participante to authenticated;
grant select, insert, update on asistente.turno, asistente.mensaje to authenticated;
grant select, insert, delete on asistente.archivo to authenticated;
grant select, delete on asistente.html to authenticated;
grant select on asistente.lectura_soporte to authenticated;
grant all on all tables in schema asistente to service_role;

-- -----------------------------------------------------------------------------
-- 7) LECTURA PARA SOPORTE (solo equipo de Boosty, registrada)
-- -----------------------------------------------------------------------------

create or replace function asistente.leer_para_soporte(p_chat uuid, p_motivo text, p_ticket text default null)
returns setof asistente.mensaje
language plpgsql security definer set search_path = asistente, public as $$
begin
  if not privado.es_equipo_boosty() then
    raise exception 'Solo el equipo de Boosty lee chats, y solo para soporte' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then
    raise exception 'Escribe el motivo de la lectura' using errcode = 'check_violation';
  end if;
  insert into asistente.lectura_soporte (lector, chat_id, motivo, ticket) values (auth.uid(), p_chat, trim(p_motivo), nullif(trim(p_ticket), ''));
  return query select m.* from asistente.mensaje m where m.chat_id = p_chat order by m.creado_en;
end;
$$;
revoke all on function asistente.leer_para_soporte(uuid, text, text) from public, anon;
grant execute on function asistente.leer_para_soporte(uuid, text, text) to authenticated;

-- El consumo para la administración: cifras, nunca contenido.
create or replace function asistente.consumo(p_desde timestamptz, p_hasta timestamptz default now())
returns table (perfil_id uuid, nombre text, turnos bigint, fallidos bigint, costo_usd numeric, tokens_entrada bigint, tokens_salida bigint,
               primer_token_p90_ms integer, a_favor bigint, en_contra bigint)
language plpgsql stable security definer set search_path = asistente, public as $$
begin
  if not public.puede('sistema:asistente-admin', 'ver') then return; end if;
  return query
  select t.solicitante, coalesce(nullif(p.nombre_completo, ''), p.email, 'Sin nombre'),
         count(*), count(*) filter (where t.estado = 'fallido'),
         round(sum(t.costo_usd), 4), sum(t.tokens_entrada)::bigint, sum(t.tokens_salida)::bigint,
         (percentile_cont(0.9) within group (order by t.primer_token_ms))::integer,
         (select count(*) from asistente.mensaje m where m.turno_id = any(array_agg(t.id)) and m.calificacion = 1),
         (select count(*) from asistente.mensaje m where m.turno_id = any(array_agg(t.id)) and m.calificacion = -1)
    from asistente.turno t join public.profiles p on p.id = t.solicitante
   where t.creado_en >= p_desde and t.creado_en < p_hasta
   group by t.solicitante, p.nombre_completo, p.email
   order by 4 desc;
end;
$$;
revoke all on function asistente.consumo(timestamptz, timestamptz) from public, anon;
grant execute on function asistente.consumo(timestamptz, timestamptz) to authenticated;

create or replace function asistente.consumo_por(p_desde timestamptz, p_eje text)
returns table (clave text, turnos bigint, costo_usd numeric, primer_token_p90_ms integer)
language plpgsql stable security definer set search_path = asistente, public as $$
begin
  if not public.puede('sistema:asistente-admin', 'ver') then return; end if;
  if p_eje not in ('modelo', 'categoria', 'dia') then raise exception 'Eje no válido'; end if;
  return query execute format(
    'select %s::text, count(*), round(sum(costo_usd), 4), (percentile_cont(0.9) within group (order by primer_token_ms))::integer
       from asistente.turno where creado_en >= $1 group by 1 order by 1',
    case p_eje when 'modelo' then 'modelo' when 'categoria' then 'coalesce(categoria, ''sin_categoria'')'
               else 'to_char(creado_en at time zone ''America/Caracas'', ''YYYY-MM-DD'')' end)
  using p_desde;
end;
$$;
revoke all on function asistente.consumo_por(timestamptz, text) from public, anon;
grant execute on function asistente.consumo_por(timestamptz, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 8) STORAGE: bucket privado, dueño en la ruta {perfil}/{chat}/…
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('asistente', 'asistente', false, 104857600)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "asistente: leo lo mio y lo de mis chats" on storage.objects;
create policy "asistente: leo lo mio y lo de mis chats" on storage.objects for select to authenticated
  using (
    bucket_id = 'asistente'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or exists (select 1 from asistente.archivo a where a.ruta = storage.objects.name and a.chat_id is not null and privado.participo_en_chat(a.chat_id))
         or exists (select 1 from asistente.html h where h.ruta = storage.objects.name and h.chat_id is not null and privado.participo_en_chat(h.chat_id)))
  );
drop policy if exists "asistente: subo a mi carpeta" on storage.objects;
create policy "asistente: subo a mi carpeta" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'asistente'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from asistente.archivo a where a.ruta = storage.objects.name and a.dueno = (select auth.uid()) and a.estado = 'subiendo')
  );
drop policy if exists "asistente: borro lo mio" on storage.objects;
create policy "asistente: borro lo mio" on storage.objects for delete to authenticated
  using (bucket_id = 'asistente' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- -----------------------------------------------------------------------------
-- 9) REALTIME: canal privado por chat, solo para quien participa
-- -----------------------------------------------------------------------------

drop policy if exists "asistente: escucho mis chats" on realtime.messages;
create policy "asistente: escucho mis chats" on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) like 'asistente:chat:%'
    and privado.participo_en_chat(nullif(substring((select realtime.topic()) from 16), '')::uuid)
  );

-- -----------------------------------------------------------------------------
-- 10) PERMISOS, MÓDULO Y CAPACIDAD
-- -----------------------------------------------------------------------------

-- `sistema:asistente` (ver) = tener el asistente; `sistema:asistente-admin`
-- (ver, editar) = gobernarlo. De fábrica: el equipo consultor tiene las dos.
insert into public.rol_permisos (rol_id, recurso, ver, crear, editar, eliminar)
select r.id, x.recurso, true, false, x.editar, false
  from public.roles r
 cross join (values ('sistema:asistente', false), ('sistema:asistente-admin', true)) as x(recurso, editar)
 where r.clave = 'consultor'
on conflict do nothing;

update control.modulo
   set nombre = 'Asistente de IA', ruta = '/sistema/administracion/asistente', recurso = 'sistema:asistente-admin', estado = 'operando',
       descripcion = 'El asistente de IA de la plataforma: motor, usuarios y roles, topes, instrucciones de la empresa, consumo y adopción.'
 where codigo = 'NUC-IA';

insert into ia.capacidad (codigo, modulo, nombre, que_hace, uso, nivel_actual, techo, dueno_cargo, encendida, nota)
values ('NUC-ASI-IA-01', 'NUC-IA', 'Asistente de IA',
        'Chat de IA de cada usuario: conversa, lee y genera archivos, procesa Excel grandes y publica HTML de analítica. Solo lectura: no escribe en la plataforma.',
        'E', 'N1', 'N1', 'Gerente de Tecnología de la Información', true,
        'Tiene sus propios topes (por persona y de la empresa) en Administración › Asistente de IA; no consume el tope diario de las capacidades.')
on conflict (codigo) do nothing;

comment on schema asistente is 'Asistente de IA de la plataforma (chat por usuario). Plan: Claude Docs «Plan · Asistente de IA en la Plataforma Iberia».';
