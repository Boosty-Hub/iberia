-- =============================================================================
-- PLATAFORMA IBERIA · ETAPA 1 · el núcleo: estructura, procesos, documentos,
-- aprobaciones, dotación y auditoría
--
-- Plan: `plataforma/plan/D-etapa-1-procesos-estructura.md` (fuera de git, NDA) y
-- cap. 05 del plan maestro. Lo esencial:
--
--   · Un solo sistema de permisos para toda la plataforma. Se conserva `roles`,
--     `rol_permisos` y `public.puede()`; el inventario crece con recursos
--     `sistema:<clave>`, y aparece el nivel `usuario` para la gente de Iberia
--     que crea y edita en el sistema sin ser del equipo consultor
--     (`es_editor()` sigue siendo solo admin y consultor).
--   · Todo lo editable tiene vigencia (`daterange`) y nada se borra: se cierra
--     con fecha. Cada entidad versionada tiene una identidad estable (`ref`) y
--     una fila por versión.
--   · Escenarios: toda fila de estructura y de procesos lleva `escenario_id`
--     (nulo = la realidad). Crear un escenario copia la realidad; publicarlo
--     aplica sus cambios con fecha.
--   · Los catálogos son datos editables y la base los oye (llave foránea).
--   · Costos y salario propuesto son perímetro de nómina: `sistema:costos`.
--   · Auditoría de solo inserción, encadenada por hash.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;
create extension if not exists ltree with schema extensions;

create schema if not exists org;
create schema if not exists sgc;
create schema if not exists flujo;
create schema if not exists control;

grant usage on schema org, sgc, flujo, control to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 0) PERMISOS: un solo sistema para toda la plataforma
-- -----------------------------------------------------------------------------

alter table public.rol_permisos drop constraint if exists rol_permisos_recurso_check;
alter table public.rol_permisos
  add constraint rol_permisos_recurso_check
  check (recurso ~ '^(modulo|informe|leccion|sistema):[a-z0-9-]+$');

-- El nivel `usuario`: gente de Iberia que trabaja en el sistema (pide una
-- requisición, edita la ficha de su proceso) sin ser del equipo consultor.
-- Puede lo que la matriz le marque, sin administrar usuarios ni roles, y no
-- es editor del programa: `es_editor()` no lo incluye.
alter table public.roles drop constraint if exists roles_nivel_check;
alter table public.roles
  add constraint roles_nivel_check check (nivel in ('admin', 'consultor', 'usuario', 'lector'));
alter table public.profiles drop constraint if exists profiles_rol_check;
alter table public.profiles
  add constraint profiles_rol_check check (rol in ('admin', 'consultor', 'usuario', 'lector'));

insert into public.roles (clave, nombre, descripcion, nivel, sistema) values
  ('usuario-iberia', 'Usuario Iberia',
   'Personal de Iberia que trabaja en la plataforma: ve, crea y edita lo que la matriz le marque.',
   'usuario', true)
on conflict (clave) do nothing;

-- -----------------------------------------------------------------------------
-- 1) CONTROL: auditoría, catálogos y registro de módulos
-- -----------------------------------------------------------------------------

create table if not exists control.auditoria (
  id          bigint generated always as identity primary key,
  esquema     text not null,
  tabla       text not null,
  registro_id text not null,
  accion      text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes       jsonb,
  despues     jsonb,
  actor       uuid default auth.uid(),
  en          timestamptz not null default clock_timestamp(),
  hash_previo text,
  hash        text not null
);
create index if not exists auditoria_registro_idx on control.auditoria (esquema, tabla, registro_id);
alter table control.auditoria enable row level security;

-- Solo inserción: ni el dueño de la tabla la corrige desde la API.
create or replace function control.auditoria_inmutable()
returns trigger language plpgsql as $$
begin
  raise exception 'La auditoría no se modifica ni se borra' using errcode = 'insufficient_privilege';
end;
$$;
create trigger auditoria_inmutable before update or delete on control.auditoria
  for each row execute function control.auditoria_inmutable();

-- Cada cambio de una tabla auditada deja su fila, encadenada con la anterior.
create or replace function control.auditar()
returns trigger
language plpgsql
security definer
set search_path = control, public, extensions
as $$
declare
  v_previo text;
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_id text := coalesce(v_despues ->> 'id', v_antes ->> 'id');
begin
  perform pg_advisory_xact_lock(hashtext('control.auditoria'));
  select hash into v_previo from control.auditoria order by id desc limit 1;
  insert into control.auditoria (esquema, tabla, registro_id, accion, antes, despues, hash_previo, hash)
  values (tg_table_schema, tg_table_name, v_id, tg_op, v_antes, v_despues, v_previo,
          encode(extensions.digest(coalesce(v_previo, '') || tg_table_schema || tg_table_name || v_id || tg_op
                 || coalesce(v_antes::text, '') || coalesce(v_despues::text, '') || clock_timestamp()::text, 'sha256'), 'hex'));
  return coalesce(new, old);
end;
$$;

-- Catálogos editables: tipos de unidad, de nómina, estados, motivos, sedes…
-- Las claves que usa una regla no se borran: se desactivan.
create table if not exists control.catalogo (
  tipo      text not null check (tipo ~ '^[a-z_]+$'),
  clave     text not null check (clave ~ '^[a-z0-9_]+$'),
  etiqueta  text not null,
  orden     integer not null default 0,
  activo    boolean not null default true,
  descripcion text,
  primary key (tipo, clave)
);
alter table control.catalogo enable row level security;

insert into control.catalogo (tipo, clave, etiqueta, orden) values
  ('tipo_unidad', 'junta', 'Junta Directiva', 1),
  ('tipo_unidad', 'direccion_general', 'Dirección General', 2),
  ('tipo_unidad', 'direccion', 'Dirección', 3),
  ('tipo_unidad', 'gerencia', 'Gerencia', 4),
  ('tipo_unidad', 'jefatura', 'Jefatura', 5),
  ('tipo_unidad', 'coordinacion', 'Coordinación', 6),
  ('tipo_unidad', 'departamento', 'Departamento', 7),
  ('tipo_unidad', 'staff', 'Staff', 8),
  ('tipo_unidad', 'comite', 'Comité', 9),
  ('tipo_nomina', 'diaria', 'Diaria', 1),
  ('tipo_nomina', 'mensual', 'Mensual', 2),
  ('tipo_nomina', 'rotativa', 'Rotativa', 3),
  ('tipo_nomina', 'confidencial', 'Confidencial', 4),
  ('tipo_nomina', 'ventas', 'Ventas', 5),
  ('sede', 'caracas', 'Caracas', 1),
  ('sede', 'cagua', 'Cagua', 2),
  ('sede', 'calle', 'Calle (territorio)', 3),
  ('estado_plaza', 'aprobada', 'Aprobada', 1),
  ('estado_plaza', 'en_creacion', 'En creación', 2),
  ('estado_plaza', 'congelada', 'Congelada', 3),
  ('estado_plaza', 'cerrada', 'Cerrada', 4),
  ('tipo_ocupacion', 'titular', 'Titular', 1),
  ('tipo_ocupacion', 'interino', 'Interino', 2),
  ('tipo_ocupacion', 'encargado', 'Encargado', 3),
  ('tipo_ocupacion', 'pasante', 'Pasante', 4),
  ('tipo_ocupacion', 'aprendiz_inces', 'Aprendiz INCES', 5),
  ('familia_cargo', 'direccion', 'Dirección', 1),
  ('familia_cargo', 'gerencia', 'Gerencia', 2),
  ('familia_cargo', 'jefatura', 'Jefatura', 3),
  ('familia_cargo', 'coordinacion', 'Coordinación', 4),
  ('familia_cargo', 'supervision', 'Supervisión', 5),
  ('familia_cargo', 'profesional', 'Profesional', 6),
  ('familia_cargo', 'analista', 'Analista', 7),
  ('familia_cargo', 'tecnico', 'Técnico', 8),
  ('familia_cargo', 'administrativo', 'Administrativo', 9),
  ('familia_cargo', 'ventas', 'Ventas', 10),
  ('familia_cargo', 'operativo', 'Operativo', 11),
  ('origen_requisicion', 'cargo_nuevo', 'Cargo nuevo', 1),
  ('origen_requisicion', 'vacante_egreso', 'Vacante por egreso', 2),
  ('origen_requisicion', 'vacante_promocion', 'Vacante por promoción', 3),
  ('origen_requisicion', 'vacante_transferencia', 'Vacante por transferencia', 4),
  ('origen_requisicion', 'tiempo_determinado', 'Contrato a tiempo determinado', 5),
  ('origen_requisicion', 'pasante', 'Pasante', 6),
  ('tipo_proceso', 'estrategico', 'Estratégico', 1),
  ('tipo_proceso', 'operativo', 'Operativo', 2),
  ('tipo_proceso', 'soporte', 'Soporte', 3),
  ('estado_operativo', 'vigente', 'Se ejecuta', 1),
  ('estado_operativo', 'nuevo', 'No documentado', 2),
  ('estado_operativo', 'propuesto', 'Propuesto', 3),
  ('estado_operativo', 'no_se_ejecuta', 'No se ejecuta', 4),
  ('estado_operativo', 'sin_evidencia', 'Sin evidencia', 5),
  ('perimetro', 'general', 'General', 1),
  ('perimetro', 'nomina', 'Nómina', 2),
  ('perimetro', 'medico', 'Servicio médico', 3),
  ('perimetro', 'pcp', 'Prevención y Control de Pérdidas', 4),
  ('perimetro', 'formulas', 'Fórmulas', 5)
on conflict do nothing;

-- El plan como dato: cada módulo de la plataforma es una fila (NUC-CFG).
create table if not exists control.modulo (
  codigo     text primary key check (codigo ~ '^[A-Z]{3}-[A-Z]{3}$'),
  nombre     text not null,
  dominio    text not null,
  fase       text,
  estado     text not null default 'planificado' check (estado in ('planificado', 'en_construccion', 'operando', 'pausado')),
  ruta       text,
  recurso    text,
  descripcion text,
  orden      integer not null default 0
);
alter table control.modulo enable row level security;

-- -----------------------------------------------------------------------------
-- 2) ESCENARIOS (estructura y procesos)
-- -----------------------------------------------------------------------------

create table if not exists org.escenario (
  id           uuid primary key default gen_random_uuid(),
  nombre       text not null check (length(trim(nombre)) >= 3),
  descripcion  text,
  alcance      text not null check (alcance in ('estructura', 'procesos')),
  fecha_base   date not null default current_date,
  estado       text not null default 'borrador'
               check (estado in ('borrador', 'en_aprobacion', 'aprobado', 'publicado', 'descartado')),
  vigente_desde date,
  creado_por   uuid default auth.uid() references public.profiles (id),
  creado_en    timestamptz not null default now(),
  publicado_en timestamptz
);
alter table org.escenario enable row level security;

-- -----------------------------------------------------------------------------
-- 3) ESTRUCTURA: unidades, cargos, plazas, ocupaciones
-- -----------------------------------------------------------------------------

create table if not exists org.cargo (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null unique check (clave ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre      text not null,
  familia     text,
  familia_cat text generated always as ('familia_cargo') stored,
  nivel       smallint,
  sinonimos   text[] not null default '{}',
  proposito   text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now(),
  foreign key (familia_cat, familia) references control.catalogo (tipo, clave)
);
alter table org.cargo enable row level security;

create table if not exists org.unidad (
  id           uuid primary key default gen_random_uuid(),
  ref          uuid not null default gen_random_uuid(),   -- identidad estable entre versiones
  clave        text not null check (clave ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre       text not null,
  tipo         text not null,
  tipo_cat     text generated always as ('tipo_unidad') stored,
  padre_ref    uuid,
  codigo_organigrama text,
  sede         text,
  sede_cat     text generated always as ('sede') stored,
  area_id      uuid references public.areas (id),        -- puente con lo que ya existe
  orden        integer not null default 0,
  vigencia     daterange not null default daterange(current_date, null),
  escenario_id uuid references org.escenario (id) on delete cascade,
  esc          uuid generated always as (coalesce(escenario_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  fuente       text,
  certeza      text not null default 'hecho' check (certeza in ('hecho', 'inferencia')),
  nota         text,
  foreign key (tipo_cat, tipo) references control.catalogo (tipo, clave),
  foreign key (sede_cat, sede) references control.catalogo (tipo, clave),
  constraint unidad_sin_solape exclude using gist (ref with =, esc with =, vigencia with &&)
);
create index if not exists unidad_ref_idx on org.unidad (ref);
create index if not exists unidad_padre_idx on org.unidad (padre_ref);
alter table org.unidad enable row level security;

create table if not exists org.plaza (
  id            uuid primary key default gen_random_uuid(),
  ref           uuid not null default gen_random_uuid(),
  unidad_ref    uuid not null,
  cargo_id      uuid not null references org.cargo (id),
  reporta_a_ref uuid,                -- otra plaza
  dotacion      integer not null default 1 check (dotacion >= 0),
  tipo_nomina   text,
  nomina_cat    text generated always as ('tipo_nomina') stored,
  sede          text,
  sede_cat      text generated always as ('sede') stored,
  estado        text not null default 'aprobada',
  estado_cat    text generated always as ('estado_plaza') stored,
  vigencia      daterange not null default daterange(current_date, null),
  escenario_id  uuid references org.escenario (id) on delete cascade,
  esc           uuid generated always as (coalesce(escenario_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  fuente        text,
  certeza       text not null default 'hecho' check (certeza in ('hecho', 'inferencia')),
  nota          text,
  foreign key (nomina_cat, tipo_nomina) references control.catalogo (tipo, clave),
  foreign key (sede_cat, sede) references control.catalogo (tipo, clave),
  foreign key (estado_cat, estado) references control.catalogo (tipo, clave),
  constraint plaza_sin_solape exclude using gist (ref with =, esc with =, vigencia with &&)
);
create index if not exists plaza_unidad_idx on org.plaza (unidad_ref);
create index if not exists plaza_ref_idx on org.plaza (ref);
alter table org.plaza enable row level security;

create table if not exists org.ocupacion (
  id           uuid primary key default gen_random_uuid(),
  plaza_ref    uuid not null,
  empleado_id  uuid not null references public.empleados (id),
  tipo         text not null default 'titular',
  tipo_cat     text generated always as ('tipo_ocupacion') stored,
  vigencia     daterange not null default daterange(current_date, null),
  motivo       text,
  certeza      text not null default 'exacta' check (certeza in ('exacta', 'por_nombre_de_cargo', 'manual')),
  creado_en    timestamptz not null default now(),
  foreign key (tipo_cat, tipo) references control.catalogo (tipo, clave),
  -- Una persona no ocupa dos plazas como titular a la vez.
  constraint ocupacion_persona_sin_solape exclude using gist
    (empleado_id with =, vigencia with &&) where (tipo = 'titular')
);
create index if not exists ocupacion_plaza_idx on org.ocupacion (plaza_ref);
alter table org.ocupacion enable row level security;

-- Una plaza de dotación N no tiene más de N titulares a la vez. No se puede
-- escribir como restricción de exclusión (depende de la dotación), así que la
-- comprueba un trigger.
create or replace function org.ocupacion_cabe()
returns trigger language plpgsql set search_path = org, public, extensions as $$
declare
  v_dotacion integer;
  v_ocupadas integer;
begin
  if new.tipo <> 'titular' then return new; end if;
  select dotacion into v_dotacion from org.plaza
   where ref = new.plaza_ref and escenario_id is null and vigencia && new.vigencia
   order by lower(vigencia) desc limit 1;
  if v_dotacion is null then
    raise exception 'La plaza no existe en esa fecha' using errcode = 'foreign_key_violation';
  end if;
  select count(*) into v_ocupadas from org.ocupacion
   where plaza_ref = new.plaza_ref and tipo = 'titular' and vigencia && new.vigencia and id <> new.id;
  if v_ocupadas >= v_dotacion then
    raise exception 'La plaza ya tiene % titular(es) para su dotación de %', v_ocupadas, v_dotacion
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger ocupacion_cabe before insert or update on org.ocupacion
  for each row execute function org.ocupacion_cabe();

-- Plan de dotación por año (headcount planificado).
-- Cada versión aprobada queda congelada; un cambio es una versión nueva.
create table if not exists org.plan_dotacion (
  id      uuid primary key default gen_random_uuid(),
  anio    integer not null check (anio between 2020 and 2100),
  version integer not null default 1,
  estado  text not null default 'borrador' check (estado in ('borrador', 'aprobado', 'reemplazado')),
  aprobado_por uuid references public.profiles (id),
  aprobado_en  timestamptz,
  nota    text,
  unique (anio, version)
);
alter table org.plan_dotacion enable row level security;

create table if not exists org.plan_dotacion_linea (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references org.plan_dotacion (id) on delete cascade,
  unidad_ref uuid not null,
  cargo_id   uuid not null references org.cargo (id),
  cantidad   integer not null check (cantidad >= 0),
  nota       text,
  unique (plan_id, unidad_ref, cargo_id)
);
alter table org.plan_dotacion_linea enable row level security;

-- -----------------------------------------------------------------------------
-- 4) COSTOS · perímetro de nómina (solo `sistema:costos`; sin IA)
-- -----------------------------------------------------------------------------
-- Se modela el costo de REFERENCIA del cargo, no el salario de cada persona: el
-- salario individual sigue en SPI. Los componentes (bono de alimentación,
-- utilidades, bono vacacional, prestaciones, aportes) son filas con vigencia,
-- porque la ley y la convención cambian.

-- Parámetros con vigencia que usan los cálculos (salario mínimo, ingreso
-- mínimo integral…). Se editan; no viven en el código.
create table if not exists control.parametro (
  id       uuid primary key default gen_random_uuid(),
  clave    text not null check (clave ~ '^[a-z0-9_]+$'),
  nombre   text not null,
  valor    numeric(16, 4) not null,
  unidad   text not null,                 -- VES, USD, %, días
  vigencia daterange not null default daterange(current_date, null),
  fuente   text,
  por_confirmar boolean not null default true,
  constraint parametro_sin_solape exclude using gist (clave with =, vigencia with &&)
);
alter table control.parametro enable row level security;

create table if not exists org.componente_costo (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  -- porcentaje: valor % de la base · dias_anuales: valor días de salario al año
  -- (se prorratea /12) · monto_mensual: valor fijo en `moneda`
  forma       text not null check (forma in ('porcentaje', 'dias_anuales', 'monto_mensual')),
  valor       numeric(14, 4) not null check (valor >= 0),
  -- Sobre qué se calcula: el salario normal, el integral (salario + alícuotas
  -- de utilidades y bono vacacional) o el salario más los bonos no salariales
  -- (la contribución de pensiones grava también los bonos en divisas).
  base        text not null default 'salario_normal'
              check (base in ('salario_normal', 'salario_integral', 'salario_y_bonos', 'ninguna')),
  tope_salarios_minimos numeric(8, 2),     -- IVSS 5, RPE 10…
  piso_parametro text,                     -- clave de control.parametro que fija un piso de la base
  moneda      text check (moneda in ('VES', 'USD')),          -- solo para monto_mensual
  aplica_a    text not null default 'todos',                  -- todos | un tipo de nómina
  base_legal  text,
  fuente      text,
  por_confirmar boolean not null default true,
  orden       integer not null default 0,
  vigencia    daterange not null default daterange(current_date, null),
  nota        text
);
alter table org.componente_costo enable row level security;

create table if not exists org.costo_referencia (
  id            uuid primary key default gen_random_uuid(),
  cargo_id      uuid not null references org.cargo (id),
  salario_mensual numeric(16, 2) not null check (salario_mensual >= 0),
  moneda        text not null default 'VES' check (moneda in ('VES', 'USD')),
  bonos_usd_mensual numeric(14, 2) not null default 0,
  vigencia      daterange not null default daterange(current_date, null),
  fuente        text,
  constraint costo_referencia_sin_solape exclude using gist (cargo_id with =, vigencia with &&)
);
alter table org.costo_referencia enable row level security;

create table if not exists org.tasa_cambio (
  fecha  date primary key,
  ves_por_usd numeric(16, 4) not null check (ves_por_usd > 0),
  fuente text not null default 'BCV'
);
alter table org.tasa_cambio enable row level security;

-- -----------------------------------------------------------------------------
-- 5) PROCESOS (NUC-PRO)
-- -----------------------------------------------------------------------------

create table if not exists sgc.proceso (
  id              uuid primary key default gen_random_uuid(),
  ref             uuid not null default gen_random_uuid(),
  clave           text not null check (clave ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nivel           smallint not null check (nivel between 0 and 3),
  padre_ref       uuid,
  orden           integer not null default 0,
  nombre          text not null,
  tipo            text,
  tipo_cat        text generated always as ('tipo_proceso') stored,
  codigo_sgc      text,
  generacion      text,
  codigo_informe  text,
  estado_operativo text not null default 'vigente',
  estado_cat      text generated always as ('estado_operativo') stored,
  dueno_plaza_ref uuid,
  dueno_texto     text,                -- lo que dice la fuente, hasta casarlo con una plaza
  area_texto      text,
  -- Ficha PHVA ampliada (cap. 05 §6.3): objetivo, alcance, proveedores,
  -- entradas, actividades P-H-V-A, salidas, clientes, recursos, riesgos,
  -- oportunidades, indicadores, excepciones…
  ficha           jsonb not null default '{}'::jsonb,
  -- El ciclo único de lo editable.
  estado          text not null default 'vigente'
                  check (estado in ('borrador', 'en_revision', 'aprobada', 'vigente', 'reemplazada', 'retirada')),
  version         integer not null default 1,
  vigencia        daterange,
  escenario_id    uuid references org.escenario (id) on delete cascade,
  esc             uuid generated always as (coalesce(escenario_id, '00000000-0000-0000-0000-000000000000'::uuid)) stored,
  fuente          text[] not null default '{}',
  nota            text,
  creado_por      uuid default auth.uid() references public.profiles (id),
  creado_en       timestamptz not null default now(),
  foreign key (tipo_cat, tipo) references control.catalogo (tipo, clave),
  foreign key (estado_cat, estado_operativo) references control.catalogo (tipo, clave),
  unique (ref, esc, version),
  constraint proceso_una_vigente exclude using gist (ref with =, esc with =, vigencia with &&)
    where (estado in ('vigente', 'aprobada'))
);
create index if not exists proceso_padre_idx on sgc.proceso (padre_ref);
create index if not exists proceso_ref_idx on sgc.proceso (ref);
alter table sgc.proceso enable row level security;

-- Una versión publicada no se edita: se crea otra (cap. 05 §3.2).
create or replace function sgc.proceso_inmutable()
returns trigger language plpgsql as $$
begin
  if old.estado in ('vigente', 'reemplazada', 'retirada') then
    if (new.nombre, new.ficha, new.padre_ref, new.nivel, new.tipo, new.codigo_sgc, new.dueno_plaza_ref)
       is distinct from (old.nombre, old.ficha, old.padre_ref, old.nivel, old.tipo, old.codigo_sgc, old.dueno_plaza_ref) then
      raise exception 'Una versión publicada no se edita: se crea un borrador nuevo' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger proceso_inmutable before update on sgc.proceso
  for each row execute function sgc.proceso_inmutable();

-- El cruce con el inventario del informe de Fase 1 (public.procesos).
create table if not exists sgc.proceso_cruce (
  id            uuid primary key default gen_random_uuid(),
  proceso_ref   uuid not null,
  codigo_sgc    text,
  informe_proceso_id uuid references public.procesos (id) on delete set null,
  informe_macro_id   uuid references public.macroprocesos (id) on delete set null,
  tipo          text not null check (tipo in ('equivalente', 'contiene', 'parcial', 'sin_par')),
  confirmado    boolean not null default false,
  nota          text
);
alter table sgc.proceso_cruce enable row level security;

-- -----------------------------------------------------------------------------
-- 6) DOCUMENTOS (NUC-DOC, inventario)
-- -----------------------------------------------------------------------------

create table if not exists sgc.tipo_documento (
  yy         text not null,
  generacion text not null,
  nombre     text not null,
  nivel      smallint,
  primary key (yy, generacion)
);
alter table sgc.tipo_documento enable row level security;

create table if not exists sgc.documento (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null,
  titulo      text not null,
  proceso_xx  text,
  tipo_yy     text,
  proceso_ref uuid,
  version     text,
  fecha       date,
  estado      text not null check (estado in ('vigente', 'obsoleto', 'borrador', 'sin_determinar', 'retirado')),
  evidencia_estado text,
  perimetro   text not null default 'general',
  perim_cat   text generated always as ('perimetro') stored,
  datos_sensibles boolean not null default false,
  familia     text,
  destino     text check (destino in ('formulario', 'funcion', 'vista_espejo', 'no_migra')),
  alias       text[] not null default '{}',
  archivos    text[] not null default '{}',
  nota        text,
  creado_en   timestamptz not null default now(),
  foreign key (perim_cat, perimetro) references control.catalogo (tipo, clave),
  unique (codigo, titulo)
);
create index if not exists documento_codigo_idx on sgc.documento (codigo);
create index if not exists documento_proceso_idx on sgc.documento (proceso_ref);
create index if not exists documento_alias_idx on sgc.documento using gin (alias);
alter table sgc.documento enable row level security;

-- -----------------------------------------------------------------------------
-- 7) APROBACIONES (NUC-FLU, base)
-- -----------------------------------------------------------------------------

create table if not exists flujo.ruta (
  id          uuid primary key default gen_random_uuid(),
  tipo_objeto text not null check (tipo_objeto ~ '^[a-z_]+$'),
  nombre      text not null,
  descripcion text,
  activa      boolean not null default true,
  vigencia    daterange not null default daterange(current_date, null),
  constraint ruta_una_activa exclude using gist (tipo_objeto with =, vigencia with &&) where (activa)
);
alter table flujo.ruta enable row level security;

create table if not exists flujo.ruta_paso (
  id          uuid primary key default gen_random_uuid(),
  ruta_id     uuid not null references flujo.ruta (id) on delete cascade,
  orden       integer not null,
  nombre      text not null,
  -- Cómo se resuelve quién firma: un cargo, una plaza, el jefe de la unidad
  -- del objeto, el director de la dirección del objeto, o un rol de la matriz.
  resolutor   text not null check (resolutor in ('cargo', 'plaza', 'jefe_unidad', 'director_unidad', 'rol')),
  cargo_id    uuid references org.cargo (id),
  plaza_ref   uuid,
  rol_id      uuid references public.roles (id),
  accion      text not null default 'aprobar' check (accion in ('aprobar', 'recibir', 'completar')),
  -- Condición opcional: {"origen": ["cargo_nuevo"], "fuera_de_plan": true}
  condicion   jsonb,
  ve_costos   boolean not null default false,
  unique (ruta_id, orden)
);
alter table flujo.ruta_paso enable row level security;

create table if not exists flujo.solicitud (
  id          uuid primary key default gen_random_uuid(),
  tipo_objeto text not null,
  objeto_id   uuid not null,
  ruta_id     uuid not null references flujo.ruta (id),
  titulo      text not null,
  estado      text not null default 'en_curso' check (estado in ('en_curso', 'aprobada', 'rechazada', 'devuelta', 'cancelada')),
  paso_actual integer,
  creado_por  uuid default auth.uid() references public.profiles (id),
  creado_en   timestamptz not null default now(),
  cerrado_en  timestamptz
);
create index if not exists solicitud_objeto_idx on flujo.solicitud (tipo_objeto, objeto_id);
alter table flujo.solicitud enable row level security;

create table if not exists flujo.paso (
  id            uuid primary key default gen_random_uuid(),
  solicitud_id  uuid not null references flujo.solicitud (id) on delete cascade,
  orden         integer not null,
  nombre        text not null,
  accion        text not null,
  ve_costos     boolean not null default false,
  aprobador_plaza_ref uuid,
  aprobador_perfil uuid references public.profiles (id),
  regla         jsonb,                 -- qué paso de qué ruta lo habilitó, y cómo se resolvió
  decision      text not null default 'pendiente' check (decision in ('pendiente', 'aprobado', 'rechazado', 'devuelto', 'omitido')),
  comentario    text,
  decidido_por  uuid references public.profiles (id),
  decidido_en   timestamptz,
  unique (solicitud_id, orden)
);
alter table flujo.paso enable row level security;

-- -----------------------------------------------------------------------------
-- 8) REQUISICIÓN DE PERSONAL (II-21-40-001 digital)
-- -----------------------------------------------------------------------------

create table if not exists org.requisicion (
  id            uuid primary key default gen_random_uuid(),
  numero        integer generated always as identity unique,
  unidad_ref    uuid not null,
  cargo_id      uuid not null references org.cargo (id),
  plaza_ref     uuid,                  -- la vacante que se cubre, o nula si es cargo nuevo
  origen        text not null,
  origen_cat    text generated always as ('origen_requisicion') stored,
  reemplaza_empleado_id uuid references public.empleados (id),
  motivo_contrato text,
  tiempo_contrato text,
  cantidad      integer not null default 1 check (cantidad between 1 and 50),
  tipo_nomina   text,
  nomina_cat    text generated always as ('tipo_nomina') stored,
  justificacion text not null check (length(trim(justificacion)) >= 10),
  perfil        jsonb not null default '{}'::jsonb,       -- nivel educativo, especialidad, conocimientos
  condiciones   jsonb not null default '{}'::jsonb,       -- turnos, de pie/sentado, carga
  fecha_deseada date,
  estado        text not null default 'borrador'
                check (estado in ('borrador', 'en_aprobacion', 'devuelta', 'aprobada', 'rechazada', 'en_seleccion', 'cubierta', 'cancelada')),
  impacto       jsonb,                 -- congelado al enviar (sin costos: esos van aparte)
  solicitud_id  uuid references flujo.solicitud (id),
  candidato     text,
  fecha_ingreso date,
  creado_por    uuid default auth.uid() references public.profiles (id),
  creado_en     timestamptz not null default now(),
  foreign key (origen_cat, origen) references control.catalogo (tipo, clave),
  foreign key (nomina_cat, tipo_nomina) references control.catalogo (tipo, clave)
);
alter table org.requisicion enable row level security;

-- Lo salarial de la requisición, aparte: perímetro de nómina.
create table if not exists org.requisicion_costo (
  requisicion_id uuid primary key references org.requisicion (id) on delete cascade,
  salario_propuesto numeric(16, 2),
  moneda        text check (moneda in ('VES', 'USD')),
  bonos_usd     numeric(14, 2),
  impacto_costo jsonb,                 -- congelado al enviar
  nota          text
);
alter table org.requisicion_costo enable row level security;

-- -----------------------------------------------------------------------------
-- 9) RLS: la matriz única decide
-- -----------------------------------------------------------------------------

do $$
declare
  t record;
begin
  -- Lectura con «ver»; escritura con crear/editar/eliminar del recurso del módulo.
  for t in select * from (values
      ('org', 'unidad', 'sistema:estructura'),
      ('org', 'cargo', 'sistema:estructura'),
      ('org', 'plaza', 'sistema:estructura'),
      ('org', 'ocupacion', 'sistema:estructura'),
      ('org', 'escenario', 'sistema:escenarios'),
      ('org', 'plan_dotacion', 'sistema:dotacion'),
      ('org', 'plan_dotacion_linea', 'sistema:dotacion'),
      ('org', 'componente_costo', 'sistema:costos'),
      ('org', 'costo_referencia', 'sistema:costos'),
      ('org', 'tasa_cambio', 'sistema:costos'),
      ('org', 'requisicion_costo', 'sistema:costos'),
      ('sgc', 'proceso', 'sistema:procesos'),
      ('sgc', 'proceso_cruce', 'sistema:procesos'),
      ('sgc', 'tipo_documento', 'sistema:documentos'),
      ('flujo', 'ruta', 'sistema:aprobaciones'),
      ('flujo', 'ruta_paso', 'sistema:aprobaciones'),
      ('control', 'catalogo', 'sistema:catalogos'),
      ('control', 'parametro', 'sistema:costos'),
      ('control', 'modulo', 'sistema:inicio')
    ) as v(esquema, tabla, recurso)
  loop
    execute format('grant select, insert, update, delete on %I.%I to authenticated', t.esquema, t.tabla);
    execute format('create policy "ver con permiso" on %I.%I for select to authenticated using (public.puede(%L, ''ver''))', t.esquema, t.tabla, t.recurso);
    execute format('create policy "crear con permiso" on %I.%I for insert to authenticated with check (public.puede(%L, ''crear'') or public.puede(%L, ''editar''))', t.esquema, t.tabla, t.recurso, t.recurso);
    execute format('create policy "editar con permiso" on %I.%I for update to authenticated using (public.puede(%L, ''editar'')) with check (public.puede(%L, ''editar''))', t.esquema, t.tabla, t.recurso, t.recurso);
    execute format('create policy "eliminar con permiso" on %I.%I for delete to authenticated using (public.puede(%L, ''eliminar''))', t.esquema, t.tabla, t.recurso);
  end loop;
end;
$$;

-- Escenarios de procesos: también los ve quien ve procesos.
-- Documentos: el perímetro no se lee con el permiso general.
grant select, insert, update, delete on sgc.documento to authenticated;
create policy "ver documentos con permiso" on sgc.documento for select to authenticated
  using (public.puede('sistema:documentos', 'ver')
         and (perimetro = 'general' or public.puede('sistema:perimetros', 'ver')));
create policy "editar documentos con permiso" on sgc.documento for update to authenticated
  using (public.puede('sistema:documentos', 'editar')) with check (public.puede('sistema:documentos', 'editar'));
create policy "crear documentos con permiso" on sgc.documento for insert to authenticated
  with check (public.puede('sistema:documentos', 'editar'));

-- Auditoría: la lee quien administra o quien tiene el recurso de auditoría.
grant select on control.auditoria to authenticated;
create policy "leer auditoría" on control.auditoria for select to authenticated
  using (public.puede('sistema:auditoria', 'ver'));

-- Requisiciones: la ve quien la pidió y quien tiene el permiso; la crea quien
-- tiene «crear»; la edita su autor mientras es borrador, o quien tiene «editar».
grant select, insert, update on org.requisicion to authenticated;
create policy "ver requisiciones" on org.requisicion for select to authenticated
  using (creado_por = auth.uid() or public.puede('sistema:requisiciones', 'ver')
         or exists (select 1 from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
                    where s.objeto_id = org.requisicion.id and p.aprobador_perfil = auth.uid()));
create policy "crear requisiciones" on org.requisicion for insert to authenticated
  with check (public.puede('sistema:requisiciones', 'crear') and creado_por = auth.uid());
create policy "editar requisiciones" on org.requisicion for update to authenticated
  using ((creado_por = auth.uid() and estado in ('borrador', 'devuelta')) or public.puede('sistema:requisiciones', 'editar'))
  with check ((creado_por = auth.uid() and estado in ('borrador', 'devuelta', 'cancelada')) or public.puede('sistema:requisiciones', 'editar'));

-- Solicitudes y pasos: los ve quien participa o quien tiene el permiso; se
-- escriben solo por funciones (abajo).
grant select on flujo.solicitud, flujo.paso to authenticated;
create policy "ver solicitudes" on flujo.solicitud for select to authenticated
  using (creado_por = auth.uid() or public.puede('sistema:aprobaciones', 'ver')
         or exists (select 1 from flujo.paso p where p.solicitud_id = flujo.solicitud.id and p.aprobador_perfil = auth.uid()));
create policy "ver pasos" on flujo.paso for select to authenticated
  using (aprobador_perfil = auth.uid() or public.puede('sistema:aprobaciones', 'ver')
         or exists (select 1 from flujo.solicitud s where s.id = flujo.paso.solicitud_id and s.creado_por = auth.uid()));

-- -----------------------------------------------------------------------------
-- 10) AUDITORÍA en todo lo editable
-- -----------------------------------------------------------------------------

do $$
declare
  t record;
begin
  for t in select * from (values
      ('org', 'unidad'), ('org', 'cargo'), ('org', 'plaza'), ('org', 'ocupacion'), ('org', 'escenario'),
      ('org', 'plan_dotacion'), ('org', 'plan_dotacion_linea'), ('org', 'componente_costo'),
      ('org', 'costo_referencia'), ('org', 'requisicion'), ('org', 'requisicion_costo'),
      ('sgc', 'proceso'), ('sgc', 'proceso_cruce'), ('sgc', 'documento'),
      ('flujo', 'ruta'), ('flujo', 'ruta_paso'), ('flujo', 'solicitud'), ('flujo', 'paso'),
      ('control', 'catalogo'), ('control', 'modulo'), ('control', 'parametro'),
      ('public', 'roles'), ('public', 'rol_permisos')
    ) as v(esquema, tabla)
  loop
    execute format('create trigger auditar after insert or update or delete on %I.%I for each row execute function control.auditar()', t.esquema, t.tabla);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 11) CONSULTAS «a la fecha»
-- -----------------------------------------------------------------------------

-- La estructura vigente a una fecha (o la de un escenario).
create or replace function org.estructura_al(p_fecha date default current_date, p_escenario uuid default null)
returns table (
  unidad_ref uuid, unidad_clave text, unidad text, tipo text, padre_ref uuid, sede text, orden integer,
  plaza_ref uuid, cargo_id uuid, cargo text, familia text, reporta_a_ref uuid, dotacion integer,
  tipo_nomina text, estado text, ocupadas integer
)
language sql stable security invoker set search_path = org, public, extensions as $$
  with u as (
    select * from org.unidad
     where vigencia @> p_fecha and esc = coalesce(p_escenario, '00000000-0000-0000-0000-000000000000'::uuid)
  ), p as (
    select * from org.plaza
     where vigencia @> p_fecha and esc = coalesce(p_escenario, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  select u.ref, u.clave, u.nombre, u.tipo, u.padre_ref, u.sede, u.orden,
         p.ref, p.cargo_id, c.nombre, c.familia, p.reporta_a_ref, p.dotacion, p.tipo_nomina, p.estado,
         (select count(*)::int from org.ocupacion o
           where o.plaza_ref = p.ref and o.tipo = 'titular' and o.vigencia @> p_fecha)
    from u
    left join p on p.unidad_ref = u.ref
    left join org.cargo c on c.id = p.cargo_id
   order by u.orden, u.nombre, c.nombre;
$$;

-- Comparador: qué cambia entre la realidad a una fecha y un escenario.
create or replace function org.comparar_escenario(p_escenario uuid)
returns table (objeto text, ref uuid, cambio text, antes jsonb, despues jsonb)
language sql stable security invoker set search_path = org, public, extensions as $$
  with e as (select fecha_base from org.escenario where id = p_escenario),
  ur as (select * from org.unidad, e where escenario_id is null and vigencia @> e.fecha_base),
  ue as (select * from org.unidad where escenario_id = p_escenario),
  pr as (select * from org.plaza, e where escenario_id is null and vigencia @> e.fecha_base),
  pe as (select * from org.plaza where escenario_id = p_escenario)
  select 'unidad', coalesce(ue.ref, ur.ref),
         case when ur.ref is null then 'alta' when ue.ref is null then 'baja'
              when ue.nombre <> ur.nombre then 'renombre'
              when ue.padre_ref is distinct from ur.padre_ref then 'movimiento' else 'cambio' end,
         case when ur.ref is not null then jsonb_build_object('nombre', ur.nombre, 'tipo', ur.tipo, 'padre_ref', ur.padre_ref) end,
         case when ue.ref is not null then jsonb_build_object('nombre', ue.nombre, 'tipo', ue.tipo, 'padre_ref', ue.padre_ref) end
    from ue full join ur on ur.ref = ue.ref
   where ur.ref is null or ue.ref is null
      or (ue.nombre, ue.tipo, ue.padre_ref, ue.sede) is distinct from (ur.nombre, ur.tipo, ur.padre_ref, ur.sede)
  union all
  select 'plaza', coalesce(pe.ref, pr.ref),
         case when pr.ref is null then 'alta' when pe.ref is null then 'baja'
              when pe.dotacion <> pr.dotacion then 'dotacion'
              when pe.unidad_ref is distinct from pr.unidad_ref then 'movimiento' else 'cambio' end,
         case when pr.ref is not null then jsonb_build_object('cargo_id', pr.cargo_id, 'unidad_ref', pr.unidad_ref, 'dotacion', pr.dotacion, 'reporta_a_ref', pr.reporta_a_ref) end,
         case when pe.ref is not null then jsonb_build_object('cargo_id', pe.cargo_id, 'unidad_ref', pe.unidad_ref, 'dotacion', pe.dotacion, 'reporta_a_ref', pe.reporta_a_ref) end
    from pe full join pr on pr.ref = pe.ref
   where pr.ref is null or pe.ref is null
      or (pe.cargo_id, pe.unidad_ref, pe.dotacion, pe.reporta_a_ref, pe.estado) is distinct from (pr.cargo_id, pr.unidad_ref, pr.dotacion, pr.reporta_a_ref, pr.estado);
$$;

-- Crear un escenario de estructura: copia la realidad a su fecha base.
create or replace function org.crear_escenario_estructura(p_nombre text, p_descripcion text default null, p_fecha date default current_date)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v_id uuid;
begin
  if not public.puede('sistema:escenarios', 'crear') then
    raise exception 'Sin permiso para crear escenarios' using errcode = 'insufficient_privilege';
  end if;
  insert into org.escenario (nombre, descripcion, alcance, fecha_base)
  values (p_nombre, p_descripcion, 'estructura', p_fecha) returning id into v_id;
  insert into org.unidad (ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, vigencia, escenario_id, fuente, certeza, nota)
  select ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, daterange(p_fecha, null), v_id, fuente, certeza, nota
    from org.unidad where escenario_id is null and vigencia @> p_fecha;
  insert into org.plaza (ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, vigencia, escenario_id, fuente, certeza, nota)
  select ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, daterange(p_fecha, null), v_id, fuente, certeza, nota
    from org.plaza where escenario_id is null and vigencia @> p_fecha;
  return v_id;
end;
$$;

-- Exponer los esquemas nuevos se hace en la configuración de la API
-- (db_schema), no aquí. `privado` sigue sin exponerse.
comment on schema org is 'Estructura organizativa, dotación, costos (perímetro) y requisiciones. Plataforma Iberia, NUC-ORG.';
comment on schema sgc is 'Procesos y documentos del sistema de gestión. Plataforma Iberia, NUC-PRO y NUC-DOC.';
comment on schema flujo is 'Rutas de aprobación, solicitudes y pasos. Plataforma Iberia, NUC-FLU.';
comment on schema control is 'Auditoría, catálogos y registro de módulos. Plataforma Iberia, NUC-AUD y NUC-CFG.';
