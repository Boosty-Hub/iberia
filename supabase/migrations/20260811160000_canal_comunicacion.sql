-- =============================================================================
-- Canal de comunicación interna de Industrias Iberia
--
-- Primer software real de Iberia. Sus cimientos —padrón, identidad, permisos—
-- son los mismos sobre los que después crecen los módulos de IA.
--
-- Tres decisiones que el esquema hace explícitas:
--
--  1. La autenticación de las ~100 personas de nómina diaria NO pasa por
--     contraseña ni por correo: el enlace único que llega por WhatsApp ES la
--     credencial. Por eso `accesos` es una tabla de primera clase.
--  2. Las conexiones son ASIMÉTRICAS. Entre pares se solicita y se acepta; hacia
--     arriba se escribe sin solicitar. Nadie de planta puede quedar expuesto a
--     que la dirección le rechace una solicitud dentro de su propia empresa.
--  3. Cada apertura de un comunicado se registra. Es la primera vez que Iberia
--     va a tener alcance medido en lugar de supuesto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) PADRÓN DE EMPLEADOS
-- -----------------------------------------------------------------------------

create table if not exists public.empleados (
  id            uuid primary key default gen_random_uuid(),
  cedula        text not null unique,
  nombre_completo text not null,
  cargo         text,
  area_id       uuid references public.areas (id) on delete set null,
  sede          text check (sede in ('caracas', 'cagua', 'campo')),

  -- Gobierna qué ve la persona al entrar. Un operador de molino no puede
  -- aterrizar en la misma pantalla que la Gerencia General.
  nivel         text not null default 'administrativo'
                check (nivel in ('direccion', 'gerencia', 'jefatura',
                                 'administrativo', 'planta')),
  tipo_nomina   text not null default 'mensual'
                check (tipo_nomina in ('mensual', 'diaria')),

  telefono      text,
  email         text,
  foto_url      text,
  fecha_ingreso date,
  activo        boolean not null default true,

  -- Enlace con la sesión, cuando la persona ya entró alguna vez.
  perfil_id     uuid references public.profiles (id) on delete set null,

  puede_publicar boolean not null default false,
  es_moderador   boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  busqueda      tsvector generated always as (
                  to_tsvector('spanish',
                    coalesce(nombre_completo, '') || ' ' || coalesce(cargo, ''))
                ) stored
);

create index if not exists empleados_area_idx     on public.empleados (area_id);
create index if not exists empleados_nivel_idx    on public.empleados (nivel);
create index if not exists empleados_perfil_idx   on public.empleados (perfil_id);
create index if not exists empleados_busqueda_idx on public.empleados using gin (busqueda);

create trigger empleados_updated_at
  before update on public.empleados
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2) PUBLICACIONES · el feed
-- -----------------------------------------------------------------------------

create table if not exists public.publicaciones (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null default 'noticia'
              check (tipo in ('comunicado', 'noticia', 'nuestra_gente',
                              'evento', 'hito_ia', 'formacion')),
  titulo      text not null,
  bajada      text,
  cuerpo_md   text,
  imagen_url  text,

  -- Segmentación de audiencia. 'area' se acompaña de audiencia_area_id.
  audiencia   text not null default 'todos'
              check (audiencia in ('todos', 'direccion', 'gerencia',
                                   'administrativo', 'planta', 'area')),
  audiencia_area_id uuid references public.areas (id) on delete set null,

  autor_id    uuid references public.empleados (id) on delete set null,
  estado      text not null default 'borrador'
              check (estado in ('borrador', 'publicado', 'archivado')),
  fijado      boolean not null default false,
  -- Un comunicado oficial de la dirección se marca aparte: tiene otro peso
  -- visual y dispara el envío por WhatsApp.
  oficial     boolean not null default false,
  permite_comentarios boolean not null default true,

  publicado_en timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  busqueda    tsvector generated always as (
                to_tsvector('spanish',
                  coalesce(titulo, '') || ' ' || coalesce(bajada, '') || ' ' ||
                  coalesce(cuerpo_md, ''))
              ) stored
);

create index if not exists publicaciones_estado_idx    on public.publicaciones (estado, publicado_en desc);
create index if not exists publicaciones_audiencia_idx on public.publicaciones (audiencia);
create index if not exists publicaciones_busqueda_idx  on public.publicaciones using gin (busqueda);

create trigger publicaciones_updated_at
  before update on public.publicaciones
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) LECTURAS · alcance medido, no supuesto
-- -----------------------------------------------------------------------------

create table if not exists public.publicacion_lecturas (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  empleado_id    uuid not null references public.empleados (id) on delete cascade,
  leido_en       timestamptz not null default now(),
  -- Por dónde llegó: sirve para saber si el puente de WhatsApp funciona.
  origen         text check (origen in ('feed', 'whatsapp', 'notificacion')),
  unique (publicacion_id, empleado_id)
);

create index if not exists lecturas_publicacion_idx on public.publicacion_lecturas (publicacion_id);

-- -----------------------------------------------------------------------------
-- 4) ACCESOS · el enlace de WhatsApp es la credencial
-- -----------------------------------------------------------------------------

create table if not exists public.accesos (
  id             uuid primary key default gen_random_uuid(),
  empleado_id    uuid not null references public.empleados (id) on delete cascade,
  -- Se guarda el hash, nunca el token en claro: quien lea la tabla no debe
  -- poder suplantar a nadie.
  token_hash     text not null unique,
  publicacion_id uuid references public.publicaciones (id) on delete set null,
  enviado_en     timestamptz,
  expira_en      timestamptz not null,
  usado_en       timestamptz,
  canal          text not null default 'whatsapp'
                 check (canal in ('whatsapp', 'correo', 'manual')),
  created_at     timestamptz not null default now()
);

create index if not exists accesos_empleado_idx on public.accesos (empleado_id);
create index if not exists accesos_expira_idx   on public.accesos (expira_en);

-- -----------------------------------------------------------------------------
-- 5) CONEXIONES · asimétricas a propósito
--
-- Entre pares (mismo nivel o adyacente) se solicita y se acepta.
-- Hacia arriba no hay solicitud: se escribe directo desde el directorio, para
-- que nadie quede expuesto a un rechazo visible dentro de su propia empresa.
-- -----------------------------------------------------------------------------

create table if not exists public.conexiones (
  id          uuid primary key default gen_random_uuid(),
  solicita_id uuid not null references public.empleados (id) on delete cascade,
  recibe_id   uuid not null references public.empleados (id) on delete cascade,
  estado      text not null default 'pendiente'
              check (estado in ('pendiente', 'aceptada', 'rechazada')),
  created_at  timestamptz not null default now(),
  resuelta_en timestamptz,
  check (solicita_id <> recibe_id),
  unique (solicita_id, recibe_id)
);

create index if not exists conexiones_recibe_idx on public.conexiones (recibe_id, estado);

-- -----------------------------------------------------------------------------
-- 6) GRUPOS Y MENSAJERÍA
-- -----------------------------------------------------------------------------

create table if not exists public.grupos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  proposito   text,
  tipo        text not null default 'cerrado' check (tipo in ('abierto', 'cerrado')),
  creador_id  uuid references public.empleados (id) on delete set null,
  area_id     uuid references public.areas (id) on delete set null,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.grupo_miembros (
  id         uuid primary key default gen_random_uuid(),
  grupo_id   uuid not null references public.grupos (id) on delete cascade,
  empleado_id uuid not null references public.empleados (id) on delete cascade,
  rol        text not null default 'miembro' check (rol in ('coordinador', 'miembro')),
  created_at timestamptz not null default now(),
  unique (grupo_id, empleado_id)
);

create index if not exists grupo_miembros_empleado_idx on public.grupo_miembros (empleado_id);

-- Una conversación es 1:1 o de grupo. Nunca las dos cosas.
create table if not exists public.conversaciones (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('directa', 'grupo')),
  grupo_id   uuid references public.grupos (id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((tipo = 'grupo') = (grupo_id is not null))
);

create table if not exists public.conversacion_participantes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  empleado_id     uuid not null references public.empleados (id) on delete cascade,
  visto_en        timestamptz,
  silenciado      boolean not null default false,
  unique (conversacion_id, empleado_id)
);

create index if not exists conv_participantes_empleado_idx
  on public.conversacion_participantes (empleado_id);

create table if not exists public.mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  autor_id        uuid not null references public.empleados (id) on delete cascade,
  texto           text not null,
  estado          text not null default 'visible'
                  check (estado in ('visible', 'oculto', 'eliminado')),
  created_at      timestamptz not null default now()
);

create index if not exists mensajes_conversacion_idx on public.mensajes (conversacion_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 7) COMENTARIOS Y REACCIONES
--
-- Requerimiento explícito de la Gerencia General: bidireccionalidad real. Un
-- comentario con lenguaje fuerte queda oculto y visible solo para quien lo
-- escribió — se prefiere saber que alguien está molesto a suponer que todo va
-- bien.
-- -----------------------------------------------------------------------------

create table if not exists public.comentarios (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  empleado_id    uuid not null references public.empleados (id) on delete cascade,
  texto          text not null,
  estado         text not null default 'visible'
                 check (estado in ('visible', 'oculto', 'eliminado')),
  moderado_por   uuid references public.empleados (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists comentarios_publicacion_idx on public.comentarios (publicacion_id, created_at);

create table if not exists public.reacciones (
  id             uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones (id) on delete cascade,
  empleado_id    uuid not null references public.empleados (id) on delete cascade,
  tipo           text not null default 'me_gusta'
                 check (tipo in ('me_gusta', 'celebro', 'apoyo')),
  created_at     timestamptz not null default now(),
  unique (publicacion_id, empleado_id)
);

-- =============================================================================
-- HELPERS
-- =============================================================================

-- El empleado que corresponde a la sesión actual.
create or replace function public.mi_empleado()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id from public.empleados e
   where e.perfil_id = auth.uid() and e.activo
   limit 1;
$$;

-- Publica en nombre de la organización.
create or replace function public.puede_publicar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select puede_publicar or es_moderador from public.empleados
      where perfil_id = auth.uid() and activo limit 1),
    false) or public.es_editor();
$$;

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.empleados                 enable row level security;
alter table public.publicaciones             enable row level security;
alter table public.publicacion_lecturas      enable row level security;
alter table public.accesos                   enable row level security;
alter table public.conexiones                enable row level security;
alter table public.grupos                    enable row level security;
alter table public.grupo_miembros            enable row level security;
alter table public.conversaciones            enable row level security;
alter table public.conversacion_participantes enable row level security;
alter table public.mensajes                  enable row level security;
alter table public.comentarios               enable row level security;
alter table public.reacciones                enable row level security;

-- El directorio es visible para toda la organización: es su razón de ser.
create policy "directorio visible" on public.empleados
  for select to authenticated using (activo);

create policy "actualizo mi ficha" on public.empleados
  for update to authenticated
  using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "editores gestionan el padron" on public.empleados
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- Solo lo publicado se ve; los borradores, solo quien puede publicar.
create policy "feed publicado" on public.publicaciones
  for select to authenticated
  using (estado = 'publicado' or public.puede_publicar());

create policy "publican los autorizados" on public.publicaciones
  for all to authenticated
  using (public.puede_publicar()) with check (public.puede_publicar());

create policy "registro mi lectura" on public.publicacion_lecturas
  for insert to authenticated with check (empleado_id = public.mi_empleado());

create policy "veo lecturas" on public.publicacion_lecturas
  for select to authenticated
  using (empleado_id = public.mi_empleado() or public.puede_publicar());

-- Los tokens no se leen desde el cliente jamás: solo el servidor con la clave
-- de servicio los maneja.
create policy "accesos solo servidor" on public.accesos
  for select to authenticated using (false);

create policy "mis conexiones" on public.conexiones
  for select to authenticated
  using (solicita_id = public.mi_empleado() or recibe_id = public.mi_empleado());

create policy "solicito conexion" on public.conexiones
  for insert to authenticated with check (solicita_id = public.mi_empleado());

create policy "resuelvo la que recibo" on public.conexiones
  for update to authenticated
  using (recibe_id = public.mi_empleado()) with check (recibe_id = public.mi_empleado());

create policy "grupos visibles" on public.grupos
  for select to authenticated
  using (
    tipo = 'abierto'
    or exists (select 1 from public.grupo_miembros m
                where m.grupo_id = grupos.id and m.empleado_id = public.mi_empleado())
    or public.puede_publicar()
  );

create policy "creo grupos" on public.grupos
  for insert to authenticated with check (creador_id = public.mi_empleado());

create policy "coordino mi grupo" on public.grupos
  for update to authenticated
  using (creador_id = public.mi_empleado() or public.puede_publicar());

create policy "miembros de mis grupos" on public.grupo_miembros
  for select to authenticated
  using (
    empleado_id = public.mi_empleado()
    or exists (select 1 from public.grupo_miembros m
                where m.grupo_id = grupo_miembros.grupo_id
                  and m.empleado_id = public.mi_empleado())
  );

create policy "me uno o me sacan" on public.grupo_miembros
  for all to authenticated
  using (
    empleado_id = public.mi_empleado()
    or exists (select 1 from public.grupos g
                where g.id = grupo_miembros.grupo_id and g.creador_id = public.mi_empleado())
  )
  with check (
    empleado_id = public.mi_empleado()
    or exists (select 1 from public.grupos g
                where g.id = grupo_miembros.grupo_id and g.creador_id = public.mi_empleado())
  );

create policy "mis conversaciones" on public.conversaciones
  for select to authenticated
  using (exists (select 1 from public.conversacion_participantes p
                  where p.conversacion_id = conversaciones.id
                    and p.empleado_id = public.mi_empleado()));

create policy "mi participacion" on public.conversacion_participantes
  for select to authenticated
  using (
    empleado_id = public.mi_empleado()
    or exists (select 1 from public.conversacion_participantes p
                where p.conversacion_id = conversacion_participantes.conversacion_id
                  and p.empleado_id = public.mi_empleado())
  );

create policy "leo mis mensajes" on public.mensajes
  for select to authenticated
  using (
    estado <> 'eliminado'
    and exists (select 1 from public.conversacion_participantes p
                 where p.conversacion_id = mensajes.conversacion_id
                   and p.empleado_id = public.mi_empleado())
  );

create policy "escribo donde participo" on public.mensajes
  for insert to authenticated
  with check (
    autor_id = public.mi_empleado()
    and exists (select 1 from public.conversacion_participantes p
                 where p.conversacion_id = mensajes.conversacion_id
                   and p.empleado_id = public.mi_empleado())
  );

-- Un comentario oculto sigue siendo visible para quien lo escribió.
create policy "comentarios visibles" on public.comentarios
  for select to authenticated
  using (estado = 'visible' or empleado_id = public.mi_empleado() or public.puede_publicar());

create policy "comento" on public.comentarios
  for insert to authenticated with check (empleado_id = public.mi_empleado());

create policy "modero comentarios" on public.comentarios
  for update to authenticated
  using (public.puede_publicar()) with check (public.puede_publicar());

create policy "reacciones visibles" on public.reacciones
  for select to authenticated using (true);

create policy "reacciono" on public.reacciones
  for all to authenticated
  using (empleado_id = public.mi_empleado()) with check (empleado_id = public.mi_empleado());
