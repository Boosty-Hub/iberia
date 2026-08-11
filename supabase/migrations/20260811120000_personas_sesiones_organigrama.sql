-- =============================================================================
-- Industrias Iberia · Programa de Adopción de IA
--
-- Tres cambios que salen del primer material cargado:
--
--  1. Lo cargado no son entrevistas: son reuniones de comité y visitas a planta,
--     con hasta 12 participantes. El módulo asumía un entrevistado por sesión.
--  2. El export de Fireflies trae "speaker 1", "speaker 2"… sin nombres. Hace
--     falta un lugar donde vivan las personas y el mapeo hablante → persona,
--     porque sin nombres el informe no puede citar a nadie.
--  3. Las áreas sembradas eran genéricas. Se reemplazan por el organigrama real
--     (documento II-21-14-008), con su jerarquía.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) ÁREAS · jerarquía del organigrama
-- -----------------------------------------------------------------------------

alter table public.areas
  add column if not exists tipo text not null default 'gerencia'
    check (tipo in ('direccion_general', 'direccion', 'gerencia', 'jefatura', 'externo')),
  add column if not exists padre_id uuid references public.areas (id) on delete set null;

create index if not exists areas_padre_idx on public.areas (padre_id);

-- -----------------------------------------------------------------------------
-- 2) PERSONAS · quién es quién, dentro y fuera de Iberia
-- -----------------------------------------------------------------------------

create table if not exists public.personas (
  id             uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  cargo          text,
  area_id        uuid references public.areas (id) on delete set null,
  organizacion   text not null default 'iberia'
                 check (organizacion in ('iberia', 'boosty', 'externo')),
  sede           text check (sede in ('caracas', 'cagua', 'remoto')),
  email          text,
  telefono       text,
  notas          text,
  -- Marca a quien conduce el programa desde Iberia.
  es_lider_programa boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  busqueda       tsvector generated always as (
                   to_tsvector('spanish',
                     coalesce(nombre_completo, '') || ' ' || coalesce(cargo, ''))
                 ) stored
);

create index if not exists personas_area_idx     on public.personas (area_id);
create index if not exists personas_busqueda_idx on public.personas using gin (busqueda);
create unique index if not exists personas_nombre_unico
  on public.personas (lower(nombre_completo));

create trigger personas_updated_at
  before update on public.personas
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) SESIONES · la tabla entrevistas pasa a cubrir reuniones y visitas
-- -----------------------------------------------------------------------------

alter table public.entrevistas
  add column if not exists tipo text not null default 'entrevista'
    check (tipo in ('entrevista', 'reunion', 'visita', 'taller', 'formacion')),
  -- Título de la sesión. En una entrevista 1:1 puede ir vacío: manda el nombre
  -- del entrevistado. En una reunión de 12 personas es lo único que la nombra.
  add column if not exists titulo text,
  add column if not exists entrevistado_id uuid references public.personas (id) on delete set null;

-- Una reunión no tiene "entrevistado": el campo deja de ser obligatorio.
alter table public.entrevistas alter column entrevistado_nombre drop not null;

create index if not exists entrevistas_tipo_idx        on public.entrevistas (tipo);
create index if not exists entrevistas_entrevistado_idx on public.entrevistas (entrevistado_id);

-- -----------------------------------------------------------------------------
-- 4) PARTICIPANTES · quién estuvo y con qué etiqueta lo grabó Fireflies
-- -----------------------------------------------------------------------------

create table if not exists public.sesion_participantes (
  id            uuid primary key default gen_random_uuid(),
  entrevista_id uuid not null references public.entrevistas (id) on delete cascade,
  persona_id    uuid not null references public.personas (id) on delete cascade,
  rol           text not null default 'participante'
                check (rol in ('entrevistado', 'entrevistador', 'participante', 'anfitrion')),
  -- La etiqueta cruda del export ("speaker 3"). Es el puente entre la
  -- transcripción y la persona, y la numeración cambia en cada archivo.
  etiqueta_hablante text,
  created_at    timestamptz not null default now(),
  unique (entrevista_id, persona_id)
);

create index if not exists participantes_entrevista_idx on public.sesion_participantes (entrevista_id);
create index if not exists participantes_persona_idx    on public.sesion_participantes (persona_id);
create unique index if not exists participantes_etiqueta_unica
  on public.sesion_participantes (entrevista_id, etiqueta_hablante)
  where etiqueta_hablante is not null;

-- -----------------------------------------------------------------------------
-- 5) SEGMENTOS · se conserva la etiqueta original al renombrar
-- -----------------------------------------------------------------------------

alter table public.transcripcion_segmentos
  add column if not exists hablante_original text;

-- =============================================================================
-- RLS de las tablas nuevas
-- =============================================================================

alter table public.personas            enable row level security;
alter table public.sesion_participantes enable row level security;

create policy "personas legibles con sesion"
  on public.personas for select to authenticated using (true);

create policy "editores gestionan personas"
  on public.personas for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

create policy "participantes legibles con sesion"
  on public.sesion_participantes for select to authenticated using (true);

create policy "editores gestionan participantes"
  on public.sesion_participantes for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- =============================================================================
-- ORGANIGRAMA REAL · documento II-21-14-008, actualización 10-02-2026
-- Se reemplazan las áreas genéricas sembradas al inicio.
-- =============================================================================

-- Las entrevistas cargadas no tienen área asignada, así que no se pierde nada.
delete from public.areas where slug in (
  'gerencia-general', 'comercial', 'produccion', 'planificacion', 'compras',
  'logistica', 'finanzas', 'rrhh', 'calidad', 'sistemas', 'comunicaciones'
);

-- Nivel 0 y 1 ---------------------------------------------------------------
insert into public.areas (slug, nombre, tipo, descripcion, orden) values
  ('direccion-general', 'Dirección Gerente General', 'direccion_general',
   'Junta Directiva → Director Gerente → Director Gerente General', 10),
  ('capital-humano',    'Dirección de Capital Humano',     'direccion', null, 20),
  ('comercializacion',  'Dirección de Comercialización',   'direccion', null, 30),
  ('operaciones',       'Dirección de Operaciones',        'direccion', null, 40),
  ('calidad-logistica', 'Dirección de Calidad y Logística','direccion', null, 50),
  ('finanzas',          'Dirección de Finanzas',           'direccion', null, 60),
  ('boosty',            'Equipo consultor (Boosty)',       'externo',
   'Consultores externos del programa', 900)
on conflict (slug) do nothing;

update public.areas d
   set padre_id = (select id from public.areas where slug = 'direccion-general')
 where d.slug in ('capital-humano', 'comercializacion', 'operaciones',
                  'calidad-logistica', 'finanzas');

-- Gerencias ------------------------------------------------------------------
insert into public.areas (slug, nombre, tipo, orden) values
  ('g-recursos-humanos',    'Gerencia de Recursos Humanos',            'gerencia', 21),
  ('g-desarrollo-comercial','Gerencia de Desarrollo Comercial',        'gerencia', 31),
  ('g-ventas',              'Gerencia Nacional de Ventas',             'gerencia', 32),
  ('g-ventas-olympia',      'Gerencia Nacional de Ventas Olympia',     'gerencia', 33),
  ('g-entrenamiento-ventas','Gerencia de Entrenamiento en Ventas',     'gerencia', 34),
  ('g-distribuidores',      'Gerencia de Distribuidores',              'gerencia', 35),
  ('g-cuentas-clave',       'Gerencia de Cuentas Clave',               'gerencia', 36),
  ('g-planta',              'Gerencia de Planta',                      'gerencia', 41),
  ('g-mantenimiento',       'Gerencia de Mantenimiento',               'gerencia', 42),
  ('g-distribucion',        'Gerencia de Distribución',                'gerencia', 51),
  ('g-calidad',             'Gerencia de Calidad',                     'gerencia', 52),
  ('g-compras',             'Gerencia de Compras',                     'gerencia', 61),
  ('g-contabilidad',        'Gerencia de Contabilidad',                'gerencia', 62),
  ('g-tesoreria',           'Gerencia de Tesorería',                   'gerencia', 63),
  ('g-tecnologia',          'Gerencia de Tecnología de la Información','gerencia', 64)
on conflict (slug) do nothing;

update public.areas set padre_id = (select id from public.areas where slug = 'capital-humano')
 where slug in ('g-recursos-humanos');
update public.areas set padre_id = (select id from public.areas where slug = 'comercializacion')
 where slug in ('g-desarrollo-comercial', 'g-ventas', 'g-ventas-olympia',
                'g-entrenamiento-ventas', 'g-distribuidores', 'g-cuentas-clave');
update public.areas set padre_id = (select id from public.areas where slug = 'operaciones')
 where slug in ('g-planta', 'g-mantenimiento');
update public.areas set padre_id = (select id from public.areas where slug = 'calidad-logistica')
 where slug in ('g-distribucion', 'g-calidad');
-- Compras y Tecnología cuelgan de Finanzas según lo declarado por la propia
-- Directora de Finanzas en la sesión del 5 de agosto.
update public.areas set padre_id = (select id from public.areas where slug = 'finanzas')
 where slug in ('g-compras', 'g-contabilidad', 'g-tesoreria', 'g-tecnologia');

-- Jefaturas ------------------------------------------------------------------
insert into public.areas (slug, nombre, tipo, orden) values
  ('j-seguridad-salud',     'Jefatura de Seguridad y Salud en el Trabajo', 'jefatura', 22),
  ('j-prevencion-perdidas', 'Jefatura de Prevención y Control de Pérdidas','jefatura', 23),
  ('j-administracion-personal','Jefatura de Administración de Personal',   'jefatura', 24),
  ('j-desarrollo-organizacional','Jefatura de Desarrollo Organizacional',  'jefatura', 25),
  ('j-comunicaciones',      'Coordinación de Comunicaciones',              'jefatura', 26),
  ('j-oficina-caracas',     'Jefatura de Oficina Caracas',                 'jefatura', 37),
  ('j-trade-marketing',     'Jefatura de Trade Marketing',                 'jefatura', 38),
  ('j-produccion',          'Jefatura de Producción',                      'jefatura', 43),
  ('j-almacen-materia-prima','Jefatura de Almacén de Materia Prima',       'jefatura', 44),
  ('j-mantenimiento',       'Jefatura de Mantenimiento',                   'jefatura', 45),
  ('j-diseno-desarrollo',   'Jefatura de Diseño y Desarrollo',             'jefatura', 53),
  ('j-aseguramiento-calidad','Jefatura de Aseguramiento de la Calidad',    'jefatura', 54),
  ('j-laboratorio',         'Jefatura de Laboratorio',                     'jefatura', 55),
  ('j-credito-cobranza',    'Jefatura de Crédito y Cobranza',              'jefatura', 65),
  ('j-impuestos-cxp',       'Jefatura de Impuestos y Cuentas por Pagar',   'jefatura', 66),
  ('j-costos',              'Jefatura de Costos',                          'jefatura', 67),
  ('j-presupuesto-control', 'Jefatura de Presupuesto y Control Interno',   'jefatura', 68)
on conflict (slug) do nothing;

update public.areas set padre_id = (select id from public.areas where slug = 'capital-humano')
 where slug in ('j-seguridad-salud', 'j-prevencion-perdidas', 'j-administracion-personal',
                'j-desarrollo-organizacional', 'j-comunicaciones');
update public.areas set padre_id = (select id from public.areas where slug = 'comercializacion')
 where slug in ('j-oficina-caracas', 'j-trade-marketing');
update public.areas set padre_id = (select id from public.areas where slug = 'g-planta')
 where slug in ('j-produccion', 'j-almacen-materia-prima');
update public.areas set padre_id = (select id from public.areas where slug = 'g-mantenimiento')
 where slug in ('j-mantenimiento');
update public.areas set padre_id = (select id from public.areas where slug = 'g-calidad')
 where slug in ('j-diseno-desarrollo', 'j-aseguramiento-calidad', 'j-laboratorio');
update public.areas set padre_id = (select id from public.areas where slug = 'finanzas')
 where slug in ('j-credito-cobranza', 'j-impuestos-cxp', 'j-costos', 'j-presupuesto-control');
