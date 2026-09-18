-- =============================================================================
-- EL MAPA DE PROCESOS · los 20 macroprocesos y sus 142 procesos, en la base
--
-- Hasta ahora el inventario vivía **solo** en `contenido/informe/inventario-
-- procesos.json`, que el generador lee para escribir el markdown de las
-- secciones 4 y 5. Eso alcanzaba mientras el mapa fuera texto: el markdown
-- queda escrito en `informe_secciones` y la web no necesita el inventario.
--
-- El mapa interactivo sí lo necesita **en tiempo de lectura**, y de ahí estas
-- dos tablas. Las alternativas no servían:
--
--   · Leer el JSON del disco en el servidor — `contenido/*` está ignorado por
--     git, porque lleva material bajo NDA. La página funcionaría en local y
--     saldría vacía el día del despliegue.
--   · Un módulo TypeScript generado — tendría que ir en git, y el repositorio
--     es público. Serían los nombres de los procesos y las áreas de Iberia en
--     abierto, de forma permanente.
--   · `public/` — se sirve sin sesión. El informe exige sesión.
--
-- Así que el dato va donde va todo el dato de este proyecto: en Postgres, con
-- RLS, y se siembra desde el taller con `npm run sembrar:procesos`.
--
-- ⚠️ **El taller sigue siendo la fuente.** Estas tablas son su reflejo, igual
-- que los anexos del informe: si alguien las edita a mano, la próxima siembra
-- las pisa, y así debe ser. Un inventario con dos versiones deja de ser un
-- inventario.
-- =============================================================================

create table if not exists public.macroprocesos (
  id uuid primary key default gen_random_uuid(),
  nivel text not null check (nivel in ('Estratégico', 'Operativo', 'Soporte')),
  -- El número **dentro de su nivel**: es lo que produce el «1.1», «2.5» que el
  -- informe usa para numerar las fichas y el mapa.
  numero integer not null check (numero > 0),
  nombre text not null,
  -- Macroproceso que el inventario de partida no recogía y el levantamiento
  -- encontró entero. Es un hallazgo por sí mismo y se pinta distinto.
  nuevo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (nivel, numero)
);

create table if not exists public.procesos (
  id uuid primary key default gen_random_uuid(),
  macroproceso_id uuid not null references public.macroprocesos(id) on delete cascade,
  -- El orden en que el inventario los lista. No es un número de proceso: es la
  -- posición, y por eso la unicidad va contra ella y no contra el nombre.
  orden integer not null,
  nombre text not null,
  -- VIGENTE es lo que se ejecuta hoy y NUEVO lo que el levantamiento encontró
  -- y el inventario de partida no recogía — los dos se dibujan, el segundo
  -- marcado. NO SE EJECUTA y SIN EVIDENCIA son el bloque «Lo que NO se hace»
  -- de cada ficha: cuentan como hallazgo, no como proceso, así que el mapa no
  -- los dibuja pero sí los sabe.
  estado text not null check (estado in ('VIGENTE', 'NUEVO', 'NO SE EJECUTA', 'SIN EVIDENCIA')),
  area text,
  -- El levantamiento encontró procesos cuyo dueño en el papel no era el real.
  dueno_corregido boolean not null default false,
  observacion text,
  created_at timestamptz not null default now(),
  unique (macroproceso_id, orden)
);

create index if not exists procesos_macroproceso_idx on public.procesos (macroproceso_id);

alter table public.macroprocesos enable row level security;
alter table public.procesos enable row level security;

-- Lectura: cualquiera con sesión. Es el mismo material que las secciones 4 y 5
-- del informe, y el botón que lleva al mapa vive dentro de una sección — así
-- que quien no puede ver la sección tampoco encuentra la puerta.
create policy "con sesión se lee el mapa"
  on public.macroprocesos for select to authenticated
  using (true);

create policy "con sesión se leen los procesos"
  on public.procesos for select to authenticated
  using (true);

-- Escritura: solo editores, y en la práctica solo el sembrador.
create policy "editores escriben macroprocesos"
  on public.macroprocesos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

create policy "editores escriben procesos"
  on public.procesos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

comment on table public.macroprocesos is
  'Los 20 macroprocesos del mapa. Reflejo de contenido/informe/inventario-procesos.json; se siembra con sembrar:procesos y se pisa en cada siembra.';
comment on table public.procesos is
  'Los procesos de primer nivel de cada macroproceso, incluidos los que no se ejecutan (estado).';
