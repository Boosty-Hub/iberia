-- =============================================================================
-- Industrias Iberia · Programa de Adopción de IA
-- Schema inicial: perfiles, áreas, entrevistas, transcripciones, hallazgos,
--                 archivos e informe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 1) PERFILES Y ROLES
--    rol:  admin     → equipo Boosty, control total incl. gestión de usuarios
--          consultor → equipo Boosty, edita levantamiento e informe
--          lector    → Iberia (comité, gerencia), solo lectura
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  nombre_completo text,
  cargo          text,
  organizacion   text not null default 'boosty'
                 check (organizacion in ('boosty', 'iberia')),
  rol            text not null default 'lector'
                 check (rol in ('admin', 'consultor', 'lector')),
  activo         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Alta automática de perfil al crear el usuario en auth.
-- El rol y la organización se pasan por raw_user_meta_data al provisionar.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre_completo, cargo, organizacion, rol)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre_completo',
    new.raw_user_meta_data ->> 'cargo',
    coalesce(new.raw_user_meta_data ->> 'organizacion', 'boosty'),
    coalesce(new.raw_user_meta_data ->> 'rol', 'lector')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de autorización. SECURITY DEFINER para que las políticas de otras
-- tablas puedan consultar profiles sin recursión de RLS.
create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.profiles where id = auth.uid() and activo;
$$;

create or replace function public.es_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rol in ('admin', 'consultor') from public.profiles
      where id = auth.uid() and activo),
    false);
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select rol = 'admin' from public.profiles where id = auth.uid() and activo),
    false);
$$;

-- -----------------------------------------------------------------------------
-- 2) ÁREAS DE LA ORGANIZACIÓN
-- -----------------------------------------------------------------------------

create table if not exists public.areas (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  nombre      text not null,
  descripcion text,
  orden       int not null default 100,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3) ENTREVISTAS  (Corriente B · diagnóstico y levantamiento)
-- -----------------------------------------------------------------------------

create table if not exists public.entrevistas (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  entrevistado_nombre text not null,
  entrevistado_cargo  text,
  area_id            uuid references public.areas (id) on delete set null,
  sede               text check (sede in ('caracas', 'cagua', 'remoto')),
  fecha_entrevista   date,
  duracion_minutos   int,
  entrevistador      text,
  estado             text not null default 'programada'
                     check (estado in ('programada', 'realizada', 'transcrita', 'analizada')),
  resumen            text,
  notas_consultor    text,
  fireflies_url      text,
  -- Metadata cruda del import (action items, keywords, participantes, etc.)
  fireflies_meta     jsonb,
  created_by         uuid references auth.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  busqueda           tsvector generated always as (
                       to_tsvector('spanish',
                         coalesce(codigo, '') || ' ' ||
                         coalesce(entrevistado_nombre, '') || ' ' ||
                         coalesce(entrevistado_cargo, '') || ' ' ||
                         coalesce(resumen, '') || ' ' ||
                         coalesce(notas_consultor, ''))
                     ) stored
);

create index if not exists entrevistas_busqueda_idx on public.entrevistas using gin (busqueda);
create index if not exists entrevistas_area_idx     on public.entrevistas (area_id);
create index if not exists entrevistas_estado_idx   on public.entrevistas (estado);
create index if not exists entrevistas_fecha_idx    on public.entrevistas (fecha_entrevista desc);

create trigger entrevistas_updated_at
  before update on public.entrevistas
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4) SEGMENTOS DE TRANSCRIPCIÓN  (importados desde Fireflies .md / .json)
-- -----------------------------------------------------------------------------

create table if not exists public.transcripcion_segmentos (
  id             bigint generated always as identity primary key,
  entrevista_id  uuid not null references public.entrevistas (id) on delete cascade,
  indice         int not null,
  hablante       text,
  inicio_segundos numeric(10, 2),
  fin_segundos    numeric(10, 2),
  texto          text not null,
  busqueda       tsvector generated always as (to_tsvector('spanish', coalesce(texto, ''))) stored,
  unique (entrevista_id, indice)
);

create index if not exists segmentos_entrevista_idx on public.transcripcion_segmentos (entrevista_id, indice);
create index if not exists segmentos_busqueda_idx   on public.transcripcion_segmentos using gin (busqueda);

-- -----------------------------------------------------------------------------
-- 5) HALLAZGOS
--    El puente entre las 25 entrevistas y el Documento de Arquitectura de IA:
--    lo que la fase 1 "lee" (cuellos de botella, trabajo manual, datos) y lo
--    que propone (oportunidades de IA), con la cita que lo respalda.
-- -----------------------------------------------------------------------------

create table if not exists public.hallazgos (
  id            uuid primary key default gen_random_uuid(),
  entrevista_id uuid references public.entrevistas (id) on delete set null,
  segmento_id   bigint references public.transcripcion_segmentos (id) on delete set null,
  area_id       uuid references public.areas (id) on delete set null,
  tipo          text not null
                check (tipo in ('cuello_botella', 'trabajo_manual', 'dato_disponible',
                                'oportunidad_ia', 'riesgo', 'sistema', 'supuesto')),
  titulo        text not null,
  descripcion   text,
  cita_textual  text,
  impacto       text check (impacto in ('alto', 'medio', 'bajo')),
  esfuerzo      text check (esfuerzo in ('alto', 'medio', 'bajo')),
  estado        text not null default 'propuesto'
                check (estado in ('propuesto', 'validado', 'descartado')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists hallazgos_entrevista_idx on public.hallazgos (entrevista_id);
create index if not exists hallazgos_area_idx       on public.hallazgos (area_id);
create index if not exists hallazgos_tipo_idx       on public.hallazgos (tipo);

create trigger hallazgos_updated_at
  before update on public.hallazgos
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 6) ARCHIVOS  (metadata; el binario vive en Storage, bucket privado "archivos")
-- -----------------------------------------------------------------------------

create table if not exists public.archivos (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  descripcion   text,
  storage_path  text not null unique,
  mime_type     text,
  tamano_bytes  bigint,
  categoria     text not null default 'otro'
                check (categoria in ('entrevista', 'proceso', 'sistema', 'dato',
                                     'politica', 'comunicacion', 'formacion',
                                     'referencia', 'otro')),
  area_id       uuid references public.areas (id) on delete set null,
  entrevista_id uuid references public.entrevistas (id) on delete set null,
  fase          int check (fase between 1 and 4),
  confidencial  boolean not null default true,
  uploaded_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  busqueda      tsvector generated always as (
                  to_tsvector('spanish',
                    coalesce(nombre, '') || ' ' || coalesce(descripcion, ''))
                ) stored
);

create index if not exists archivos_categoria_idx  on public.archivos (categoria);
create index if not exists archivos_area_idx       on public.archivos (area_id);
create index if not exists archivos_entrevista_idx on public.archivos (entrevista_id);
create index if not exists archivos_busqueda_idx   on public.archivos using gin (busqueda);

create trigger archivos_updated_at
  before update on public.archivos
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7) INFORME
--    Secciones editables en el dashboard que se renderizan en la página del
--    informe (ruta propia, siempre autenticada).
-- -----------------------------------------------------------------------------

create table if not exists public.informe_secciones (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  numero      text,
  parte       text not null default 'levantamiento'
              check (parte in ('portada', 'levantamiento', 'arquitectura', 'anexos')),
  titulo      text not null,
  subtitulo   text,
  contenido_md text,
  orden       int not null default 100,
  publicado   boolean not null default false,
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists informe_orden_idx on public.informe_secciones (parte, orden);

create trigger informe_secciones_updated_at
  before update on public.informe_secciones
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- Todo el contenido es material bajo NDA: nada es legible sin sesión válida.
-- =============================================================================

alter table public.profiles                enable row level security;
alter table public.areas                   enable row level security;
alter table public.entrevistas             enable row level security;
alter table public.transcripcion_segmentos enable row level security;
alter table public.hallazgos               enable row level security;
alter table public.archivos                enable row level security;
alter table public.informe_secciones       enable row level security;

-- profiles ---------------------------------------------------------------------
create policy "perfil propio visible"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.es_admin());

create policy "admin gestiona perfiles"
  on public.profiles for all
  to authenticated
  using (public.es_admin())
  with check (public.es_admin());

create policy "actualizar perfil propio"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- areas ------------------------------------------------------------------------
create policy "areas legibles con sesion"
  on public.areas for select to authenticated using (true);

create policy "editores gestionan areas"
  on public.areas for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- entrevistas ------------------------------------------------------------------
create policy "entrevistas legibles con sesion"
  on public.entrevistas for select to authenticated using (true);

create policy "editores gestionan entrevistas"
  on public.entrevistas for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- transcripcion_segmentos ------------------------------------------------------
create policy "segmentos legibles con sesion"
  on public.transcripcion_segmentos for select to authenticated using (true);

create policy "editores gestionan segmentos"
  on public.transcripcion_segmentos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- hallazgos --------------------------------------------------------------------
create policy "hallazgos legibles con sesion"
  on public.hallazgos for select to authenticated using (true);

create policy "editores gestionan hallazgos"
  on public.hallazgos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- archivos ---------------------------------------------------------------------
create policy "archivos legibles con sesion"
  on public.archivos for select to authenticated using (true);

create policy "editores gestionan archivos"
  on public.archivos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- informe_secciones ------------------------------------------------------------
-- Los lectores de Iberia ven solo lo publicado; el equipo Boosty ve los borradores.
create policy "informe publicado legible con sesion"
  on public.informe_secciones for select to authenticated
  using (publicado or public.es_editor());

create policy "editores gestionan informe"
  on public.informe_secciones for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- =============================================================================
-- STORAGE · bucket privado para el módulo de archivos
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('archivos', 'archivos', false)
on conflict (id) do nothing;

create policy "archivos storage: lectura con sesion"
  on storage.objects for select to authenticated
  using (bucket_id = 'archivos');

create policy "archivos storage: editores suben"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'archivos' and public.es_editor());

create policy "archivos storage: editores actualizan"
  on storage.objects for update to authenticated
  using (bucket_id = 'archivos' and public.es_editor());

create policy "archivos storage: editores borran"
  on storage.objects for delete to authenticated
  using (bucket_id = 'archivos' and public.es_editor());

-- =============================================================================
-- SEED · áreas de Industrias Iberia y esqueleto del informe
-- =============================================================================

insert into public.areas (slug, nombre, descripcion, orden) values
  ('gerencia-general', 'Gerencia General',  'Dirección y comité gerencial',                     10),
  ('comercial',        'Comercial y Ventas','Pedidos, clientes, precios y herramientas de análisis', 20),
  ('produccion',       'Producción',        'Planta de Cagua: planificación y ejecución',       30),
  ('planificacion',    'Planificación',     'Programación de producción y cobertura de materiales', 40),
  ('compras',          'Compras',           'Abastecimiento y proveedores',                     50),
  ('logistica',        'Logística y Despacho','Almacén, inventario y despacho',                 60),
  ('finanzas',         'Finanzas',          'Cobranzas, conciliación, costos y reportería',     70),
  ('rrhh',             'Recursos Humanos',  'Nómina, contratación y desarrollo',                80),
  ('calidad',          'Calidad',           'Aseguramiento y control de calidad',               90),
  ('sistemas',         'Sistemas / TI',     'ERP, infraestructura, datos y conectividad',      100),
  ('comunicaciones',   'Comunicaciones y Mercadeo','Comunicación interna, boletín e identidad', 110)
on conflict (slug) do nothing;

insert into public.informe_secciones (slug, numero, parte, titulo, subtitulo, orden, publicado) values
  ('resumen-ejecutivo',   '01', 'portada',       'Resumen ejecutivo',
   'Qué encontramos y qué proponemos', 10, false),
  ('alcance-metodologia', '02', 'levantamiento', 'Alcance y metodología',
   'Cómo se levantó la información', 20, false),
  ('mapa-organizacion',   '03', 'levantamiento', 'Mapa de la organización',
   'Áreas, roles y sedes', 30, false),
  ('procesos-clave',      '04', 'levantamiento', 'Procesos clave',
   'Del pedido al cobro: cómo opera Iberia hoy', 40, false),
  ('sistemas-datos',      '05', 'levantamiento', 'Inventario de sistemas y datos',
   'Qué vive en el ERP, qué vive fuera', 50, false),
  ('cuellos-botella',     '06', 'levantamiento', 'Cuellos de botella y trabajo manual',
   'Dónde se pierde tiempo y trazabilidad', 60, false),
  ('principios',          '07', 'arquitectura',  'Principios de arquitectura',
   'El núcleo protegido y las dos vías', 70, false),
  ('modulos-propuestos',  '08', 'arquitectura',  'Módulos de IA propuestos',
   'Priorizados por impacto, costo y dependencias', 80, false),
  ('hoja-de-ruta',        '09', 'arquitectura',  'Hoja de ruta fases 2–4',
   'Secuencia, dependencias e inversión estimada', 90, false),
  ('supuestos-riesgos',   '10', 'arquitectura',  'Supuestos y riesgos',
   'Qué debe validar la dirección antes de dimensionar', 100, false)
on conflict (slug) do nothing;
