-- =============================================================================
-- EL PROGRAMA · línea de tiempo y consumo de horas
--
-- El contrato CONT-2026-08-0002, cláusula 8, obliga a dos cosas que hasta ahora
-- no vivían en ninguna parte:
--
--   · una bolsa de 107 horas al mes de equipo multidisciplinario, administrada
--     «como promedio dentro de cada fase», y
--   · un «reporte mensual de consumo».
--
-- Sin registro no hay reporte, y sin reporte se descubre el sobreconsumo cuando
-- ya se gastó. Peor: la cláusula 8 solo deja facturar horas adicionales si se
-- notifican ANTES de ejecutarlas, así que una hora que se descubre tarde es una
-- hora que se regala.
--
-- La línea de tiempo va aparte de las horas a propósito. Un hito es lo que pasó;
-- una hora es lo que costó. Se cruzan por fecha, no por fila.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) HITOS · qué pasó y cuándo
--
-- Las sesiones del levantamiento NO se copian aquí: ya viven en `entrevistas`
-- con su fecha, y duplicarlas garantizaría que en dos semanas las dos listas
-- digan cosas distintas. La vista `linea_de_tiempo` las une al leer.
-- -----------------------------------------------------------------------------

create table if not exists public.hitos (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  titulo      text not null,
  descripcion text,

  tipo        text not null default 'hito'
              check (tipo in ('contrato', 'entregable', 'sesion', 'comunicacion',
                              'decision', 'hito')),

  -- Contra cuál de los siete entregables de la cláusula 5 cuenta. `gestion` es
  -- el que no cuenta contra ninguno: dirección, reuniones de gobierno, reportería.
  entregable  text check (entregable in ('comunicacion', 'app', 'formacion',
                                         'levantamiento', 'inventario', 'planta',
                                         'arquitectura', 'gestion')),

  estado      text not null default 'hecho'
              check (estado in ('hecho', 'previsto', 'en_riesgo', 'cancelado')),

  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists hitos_fecha_idx      on public.hitos (fecha desc);
create index if not exists hitos_entregable_idx on public.hitos (entregable);

create trigger hitos_updated_at
  before update on public.hitos
  for each row execute function public.set_updated_at();

comment on table public.hitos is
  'Lo que pasó en el programa y lo que está previsto. Las sesiones del '
  'levantamiento no se repiten aquí: viven en `entrevistas` y la vista '
  '`linea_de_tiempo` las une.';

-- -----------------------------------------------------------------------------
-- 2) REGISTROS DE HORAS · qué costó
--
-- El perfil, no la persona, es lo que el contrato tarifa: la cláusula 8 remite a
-- la Sección 07 de la propuesta, que define cuatro perfiles con su tarifa y su
-- cuota mensual. Quién las hizo se guarda aparte, porque una misma persona puede
-- facturar como perfiles distintos según lo que estuviera haciendo.
-- -----------------------------------------------------------------------------

create table if not exists public.registros_horas (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,

  perfil      text not null
              check (perfil in ('consultor_senior', 'director_arquitecto',
                                'consultor_procesos', 'desarrollador_ia')),

  -- En horas, con cuartos de hora. El tope de 24 es un cazafallos de tecleo:
  -- nadie carga una jornada de 80 horas, pero sí se le va un cero.
  horas       numeric(5, 2) not null check (horas > 0 and horas <= 24),

  descripcion text not null,
  persona     text,

  entregable  text not null default 'gestion'
              check (entregable in ('comunicacion', 'app', 'formacion',
                                    'levantamiento', 'inventario', 'planta',
                                    'arquitectura', 'gestion')),

  -- De dónde salió, cuando salió de algo que ya está registrado.
  entrevista_id uuid references public.entrevistas (id) on delete set null,
  hito_id       uuid references public.hitos (id) on delete set null,

  -- Las horas fuera de la bolsa solo se pueden facturar si Iberia las aprobó por
  -- escrito ANTES de ejecutarlas (cláusula 8). Marcarlas al cargarlas es lo que
  -- permite que el reporte separe lo cubierto de lo que hay que conversar.
  adicional   boolean not null default false,

  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists horas_fecha_idx      on public.registros_horas (fecha desc);
create index if not exists horas_perfil_idx     on public.registros_horas (perfil);
create index if not exists horas_entregable_idx on public.registros_horas (entregable);

create trigger registros_horas_updated_at
  before update on public.registros_horas
  for each row execute function public.set_updated_at();

comment on table public.registros_horas is
  'Consumo de la bolsa de 107 h/mes de la cláusula 8. Se tarifa por perfil, no '
  'por persona: la misma persona puede cargar como perfiles distintos según lo '
  'que estuviera haciendo.';

-- -----------------------------------------------------------------------------
-- 3) LA LÍNEA DE TIEMPO · los hitos y las sesiones, en un solo hilo
-- -----------------------------------------------------------------------------

create or replace view public.linea_de_tiempo
with (security_invoker = on) as
select
  'hito'::text                as origen,
  h.id                        as id,
  h.fecha                     as fecha,
  h.titulo                    as titulo,
  h.descripcion               as descripcion,
  h.tipo                      as tipo,
  h.entregable                as entregable,
  h.estado                    as estado,
  null::int                   as duracion_minutos
from public.hitos h

union all

select
  'sesion'::text,
  e.id,
  e.fecha_entrevista,
  coalesce(e.titulo, e.entrevistado_nombre, e.codigo),
  e.entrevistado_cargo,
  e.tipo,
  case when e.tipo = 'formacion' then 'formacion' else 'levantamiento' end,
  'hecho',
  e.duracion_minutos
from public.entrevistas e
where e.fecha_entrevista is not null;

comment on view public.linea_de_tiempo is
  'Los hitos del programa y las sesiones del levantamiento en un solo hilo, '
  'ordenables por fecha. Las sesiones se leen de `entrevistas`, no se copian.';

-- -----------------------------------------------------------------------------
-- 4) CONSUMO MENSUAL · lo que pide el «reporte mensual de consumo»
-- -----------------------------------------------------------------------------

create or replace view public.consumo_mensual
with (security_invoker = on) as
select
  date_trunc('month', r.fecha)::date as mes,
  r.perfil,
  sum(r.horas)                       as horas,
  sum(r.horas) filter (where r.adicional) as horas_adicionales
from public.registros_horas r
group by 1, 2;

comment on view public.consumo_mensual is
  'Horas por mes y por perfil. La tarifa y la cuota de cada perfil viven en '
  '`lib/programa.ts`, no en la base: son términos de la propuesta, no datos.';

-- =============================================================================
-- RLS · las horas y los hitos son gestión interna de Boosty
--
-- Un lector de Iberia no ve lo que cuesta cada perfil ni cuántas horas van
-- consumidas: eso se le entrega en el reporte mensual, redactado, no crudo.
-- =============================================================================

alter table public.hitos           enable row level security;
alter table public.registros_horas enable row level security;

create policy "editores leen hitos"
  on public.hitos for select to authenticated
  using (public.es_editor());

create policy "editores gestionan hitos"
  on public.hitos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

create policy "editores leen horas"
  on public.registros_horas for select to authenticated
  using (public.es_editor());

create policy "editores gestionan horas"
  on public.registros_horas for all to authenticated
  using (public.es_editor()) with check (public.es_editor());
