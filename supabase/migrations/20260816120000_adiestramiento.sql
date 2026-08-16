-- =============================================================================
-- Adiestramiento en IA · el curso de Ajito
--
-- Nueve lecciones por el teléfono para las ~200 personas de Iberia que no van a
-- las tres formaciones presenciales. Lo dicta Ajito, el personaje de la casa.
--
-- Cuatro decisiones que el esquema hace explícitas:
--
--  1. EL EJERCICIO BIFURCA POR OFICIO, NO POR NIVEL. Bajo `nivel = 'planta'`
--     conviven la operadora de envasado, la cocinera de pruebas, el
--     montacarguista y el vigilante. Mandarle a la cocinera un ejercicio del
--     codificador de frascos es decirle que la empresa no sabe qué hace. Por eso
--     `empleados.familia_oficio`, y por eso el valor por defecto es `generico`:
--     el genérico no es el descarte, es el estado seguro.
--
--  2. LAS RESPUESTAS SON MATERIA PRIMA DEL INFORME. Cada lección cierra con una
--     pregunta de campo. Doscientas respuestas habladas a «¿qué sabes tú de tu
--     puesto que no esté escrito en ningún lado?» no las produce ninguna ronda
--     de entrevistas. Por eso `respuestas` guarda familia y área junto al texto:
--     hacia el informe se lee agregado, sin nombre.
--
--  3. LO QUE SE RESPONDE NO LO LEE EL SUPERVISOR. Ajito lo promete en la lección
--     0 y aquí se cumple: la RLS deja ver una respuesta a su autor y a los
--     editores de Boosty. A nadie más. Ni al jefe, ni a quien modera el canal.
--
--  4. EL ASISTENTE LIBRE ES UN INTERRUPTOR, APAGADO DE FÁBRICA. La lección 8
--     tiene dos cierres escritos y el curso elige uno según `curso.asistente
--     _libre_activo`. Se enciende desde el panel cuando Iberia lo decida.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) FAMILIA DE OFICIO EN EL PADRÓN
-- -----------------------------------------------------------------------------

alter table public.empleados
  add column if not exists familia_oficio text not null default 'generico'
  check (familia_oficio in (
    'linea',        -- operadores, empacadores, embaladores, alimentadores
    'cocina',       -- preparadores de pruebas, cocineros, desarrollo de producto
    'almacen',      -- despachadores, montacarguistas, auxiliares de almacén
    'mantenimiento',
    'laboratorio',  -- analistas, inspectores, auxiliares de calidad
    'limpieza',     -- limpiadores, servicios generales
    'seguridad',    -- vigilantes, prevención, seguridad y salud
    'oficina',      -- administrativos, nómina, motorizado
    'supervision',
    'generico'      -- por defecto, y a prueba de fallos
  ));

comment on column public.empleados.familia_oficio is
  'Gobierna qué ejercicio le toca en el adiestramiento. Sale de cruzar cargo con '
  'área, no del nivel. Ante la duda queda en generico: vale más un ejercicio '
  'general bien hecho que uno específico equivocado.';

create index if not exists empleados_familia_idx on public.empleados (familia_oficio);

-- -----------------------------------------------------------------------------
-- 2) EL CURSO Y SU CONFIGURACIÓN
-- -----------------------------------------------------------------------------

create table if not exists public.cursos (
  id            uuid primary key default gen_random_uuid(),
  clave         text not null unique,
  nombre        text not null,
  descripcion   text,

  -- El interruptor. Apagado, el curso son las nueve lecciones y cierra con el
  -- certificado. Encendido, aparece «pregúntale lo que sea» y la lección 8
  -- despide distinto.
  asistente_libre_activo boolean not null default false,

  -- Mientras esté cerrado nadie entra, aunque tenga matrícula. Sirve para
  -- preparar todo y abrir el mismo día para todos.
  abierto       boolean not null default false,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3) CATÁLOGO DE LECCIONES
-- -----------------------------------------------------------------------------

create table if not exists public.lecciones (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.cursos (id) on delete cascade,

  numero        smallint not null,
  clave         text not null,
  titulo        text not null,

  -- La forma en que actúa la IA. Es el eje del curso: cada lección es una.
  forma         text not null
                check (forma in ('bienvenida', 'entiende', 'escucha', 've',
                                 'dibuja', 'habla', 'cuenta', 'se_equivoca',
                                 'cierre')),

  resumen       text,
  minutos       smallint not null default 4,
  activa        boolean not null default true,

  created_at    timestamptz not null default now(),
  unique (curso_id, numero),
  unique (curso_id, clave)
);

create index if not exists lecciones_curso_idx on public.lecciones (curso_id, numero);

-- -----------------------------------------------------------------------------
-- 4) MATRÍCULA
-- -----------------------------------------------------------------------------

create table if not exists public.matriculas (
  id            uuid primary key default gen_random_uuid(),
  curso_id      uuid not null references public.cursos (id) on delete cascade,
  empleado_id   uuid not null references public.empleados (id) on delete cascade,

  -- Cómo le dicen, que se lo pregunta Ajito en la lección 0. No es el nombre
  -- del carnet.
  nombre_corto  text,

  -- Copia congelada de la familia al momento de matricular. Si Capital Humano
  -- reclasifica a alguien a mitad del curso, no se le cambian los ejercicios
  -- por debajo.
  familia_oficio text not null default 'generico',

  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'en_curso', 'completado')),

  iniciado_en   timestamptz,
  completado_en timestamptz,
  ultimo_toque  timestamptz,

  -- Cuántos empujones se le han mandado ya. Para no acosar a nadie.
  empujones     smallint not null default 0,
  ultimo_empujon timestamptz,

  created_at    timestamptz not null default now(),
  unique (curso_id, empleado_id)
);

create index if not exists matriculas_empleado_idx on public.matriculas (empleado_id);
create index if not exists matriculas_estado_idx   on public.matriculas (curso_id, estado);

-- -----------------------------------------------------------------------------
-- 5) AVANCE POR LECCIÓN
-- -----------------------------------------------------------------------------

create table if not exists public.avances (
  id            uuid primary key default gen_random_uuid(),
  matricula_id  uuid not null references public.matriculas (id) on delete cascade,
  leccion_id    uuid not null references public.lecciones (id) on delete cascade,

  estado        text not null default 'en_curso'
                check (estado in ('en_curso', 'completada')),

  -- En qué paso del guion se quedó, para retomar donde lo dejó.
  paso          smallint not null default 0,

  iniciada_en   timestamptz not null default now(),
  completada_en timestamptz,

  unique (matricula_id, leccion_id)
);

create index if not exists avances_matricula_idx on public.avances (matricula_id);

-- -----------------------------------------------------------------------------
-- 6) RESPUESTAS
-- -----------------------------------------------------------------------------

create table if not exists public.respuestas (
  id            uuid primary key default gen_random_uuid(),
  matricula_id  uuid not null references public.matriculas (id) on delete cascade,
  leccion_id    uuid not null references public.lecciones (id) on delete cascade,

  -- Qué se preguntó. `campo` es la pregunta de cierre de cada lección: la que
  -- alimenta el informe.
  clave_paso    text not null,
  es_pregunta_campo boolean not null default false,

  entrada       text not null default 'texto'
                check (entrada in ('texto', 'voz', 'foto', 'boton')),

  texto         text,          -- lo escrito, o la transcripción confirmada
  transcripcion_cruda text,    -- lo que se oyó antes de que la persona confirmara
  media_url     text,          -- ruta en el bucket privado
  devolucion    text,          -- lo que Ajito respondió

  -- Se copian aquí para poder leer el agregado sin tocar el padrón, y para que
  -- el corte por área y oficio sobreviva a un cambio de cargo.
  familia_oficio text not null default 'generico',
  area_id       uuid references public.areas (id) on delete set null,

  -- Cuando el equipo la convierte en hallazgo del informe, queda amarrada.
  hallazgo_id   uuid references public.hallazgos (id) on delete set null,

  created_at    timestamptz not null default now()
);

create index if not exists respuestas_matricula_idx on public.respuestas (matricula_id);
create index if not exists respuestas_campo_idx
  on public.respuestas (leccion_id, familia_oficio) where es_pregunta_campo;

-- -----------------------------------------------------------------------------
-- 7) CERTIFICADOS
-- -----------------------------------------------------------------------------

create table if not exists public.certificados (
  id            uuid primary key default gen_random_uuid(),
  matricula_id  uuid not null unique references public.matriculas (id) on delete cascade,

  -- Va impreso y se entrega en mano. El código es lo que permite verificarlo.
  codigo        text not null unique,

  -- Congelados al emitir: si la persona cambia de cargo, el certificado sigue
  -- diciendo lo que era cuando lo hizo.
  nombre_completo text not null,
  cedula        text not null,
  cargo         text,
  area_nombre   text,

  emitido_en    timestamptz not null default now(),
  entregado_en  timestamptz,   -- cuando el Gerente de Planta lo entrega en mano

  created_at    timestamptz not null default now()
);

-- =============================================================================
-- HELPERS
-- =============================================================================

-- Mi matrícula en un curso. SECURITY DEFINER para que las políticas de avances,
-- respuestas y certificados no tengan que preguntarle a matriculas pasando otra
-- vez por RLS.
create or replace function public.mi_matricula(curso uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id from public.matriculas m
   where m.curso_id = curso and m.empleado_id = public.mi_empleado()
   limit 1;
$$;

-- ¿Esta matrícula es mía? Es la pregunta que hacen casi todas las políticas de
-- abajo, y la que entraría en recursión si se hiciera en línea.
create or replace function public.matricula_mia(matricula uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matriculas m
     where m.id = matricula and m.empleado_id = public.mi_empleado()
  );
$$;

/**
 * Reparte a todo el padrón activo que no va a las tres formaciones
 * presenciales: planta y administrativo. Idempotente — se puede correr las
 * veces que haga falta a medida que Capital Humano complete el padrón.
 */
create or replace function public.matricular_pendientes(curso_clave text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  curso uuid;
  nuevas integer;
begin
  select id into curso from public.cursos where clave = curso_clave;
  if curso is null then
    raise exception 'No existe el curso %', curso_clave;
  end if;

  insert into public.matriculas (curso_id, empleado_id, familia_oficio)
  select curso, e.id, e.familia_oficio
    from public.empleados e
   where e.activo
     and e.nivel in ('planta', 'administrativo')
  on conflict (curso_id, empleado_id) do nothing;

  get diagnostics nuevas = row_count;
  return nuevas;
end;
$$;

revoke execute on function public.matricular_pendientes(text) from public, anon, authenticated;

-- =============================================================================
-- RLS
--
-- El curso es material de Iberia bajo NDA como todo lo demás: nada se lee sin
-- sesión. Y una regla propia de este módulo: lo que alguien responde no lo ve
-- su supervisor, ni quien modera el canal. Solo esa persona y los editores.
-- =============================================================================

alter table public.cursos        enable row level security;
alter table public.lecciones     enable row level security;
alter table public.matriculas    enable row level security;
alter table public.avances       enable row level security;
alter table public.respuestas    enable row level security;
alter table public.certificados  enable row level security;

-- --- cursos y lecciones: el catálogo lo ve toda la organización --------------

create policy "curso visible" on public.cursos
  for select to authenticated using (true);

create policy "editores configuran el curso" on public.cursos
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

create policy "lecciones visibles" on public.lecciones
  for select to authenticated using (activa or public.es_editor());

create policy "editores gestionan lecciones" on public.lecciones
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- --- matrículas ---------------------------------------------------------------
-- Cada quien ve la suya. El avance agregado por área lo leen los editores; para
-- las gerencias hay una vista aparte, más abajo, que no expone respuestas.

create policy "mi matricula" on public.matriculas
  for select to authenticated
  using (empleado_id = public.mi_empleado() or public.es_editor());

create policy "avanzo en mi matricula" on public.matriculas
  for update to authenticated
  using (empleado_id = public.mi_empleado())
  with check (empleado_id = public.mi_empleado());

create policy "editores gestionan matriculas" on public.matriculas
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- --- avances -------------------------------------------------------------------

create policy "mis avances" on public.avances
  for select to authenticated
  using (public.matricula_mia(matricula_id) or public.es_editor());

create policy "registro mi avance" on public.avances
  for insert to authenticated
  with check (public.matricula_mia(matricula_id));

create policy "actualizo mi avance" on public.avances
  for update to authenticated
  using (public.matricula_mia(matricula_id))
  with check (public.matricula_mia(matricula_id));

-- --- respuestas ------------------------------------------------------------------
-- Aquí vive la promesa de la lección 0. `puede_publicar()` NO alcanza: quien
-- modera el canal tampoco lee esto.

create policy "mis respuestas" on public.respuestas
  for select to authenticated
  using (public.matricula_mia(matricula_id) or public.es_editor());

create policy "respondo yo" on public.respuestas
  for insert to authenticated
  with check (public.matricula_mia(matricula_id));

create policy "corrijo mi respuesta" on public.respuestas
  for update to authenticated
  using (public.matricula_mia(matricula_id))
  with check (public.matricula_mia(matricula_id));

create policy "editores leen respuestas" on public.respuestas
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- --- certificados ----------------------------------------------------------------

create policy "mi certificado" on public.certificados
  for select to authenticated
  using (public.matricula_mia(matricula_id) or public.es_editor());

create policy "editores emiten certificados" on public.certificados
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

-- =============================================================================
-- TABLERO
--
-- El avance por área y por oficio, sin una sola respuesta. Es lo que puede ver
-- una gerencia para empujar a su gente sin leer lo que su gente contestó.
-- =============================================================================

create or replace view public.adiestramiento_avance
with (security_invoker = true) as
select
  m.curso_id,
  e.area_id,
  a.nombre                        as area_nombre,
  e.familia_oficio,
  count(*)                                                as matriculados,
  count(*) filter (where m.estado = 'completado')         as completados,
  count(*) filter (where m.estado = 'en_curso')           as en_curso,
  count(*) filter (where m.estado = 'pendiente')          as sin_empezar,
  coalesce(avg((
    select count(*) from public.avances av
     where av.matricula_id = m.id and av.estado = 'completada'
  )), 0)::numeric(4,1)                                    as lecciones_promedio
from public.matriculas m
join public.empleados e on e.id = m.empleado_id
left join public.areas a on a.id = e.area_id
group by m.curso_id, e.area_id, a.nombre, e.familia_oficio;

-- =============================================================================
-- SIEMBRA · el curso y sus nueve lecciones
-- =============================================================================

insert into public.cursos (clave, nombre, descripcion, asistente_libre_activo, abierto)
values (
  'ajito',
  'Conoce a Ajito',
  'Nueve ratos de tres minutos para saber cómo opera la inteligencia artificial '
  'y de cuántas formas distintas puede actuar. Capítulo del programa '
  'IBERIA · Nuevo Sabor.',
  false,   -- el asistente libre arranca apagado
  false    -- y el curso arranca cerrado, hasta que esté todo listo
)
on conflict (clave) do nothing;

insert into public.lecciones (curso_id, numero, clave, titulo, forma, resumen, minutos)
select c.id, v.numero, v.clave, v.titulo, v.forma, v.resumen, v.minutos
  from public.cursos c,
       (values
         (0, 'bienvenida',   'Conoce a Ajito',        'bienvenida',
          'Quién es Ajito, el primer mensaje, y qué se guarda.', 4),
         (1, 'entiende',     'Ajito entiende lo que le dices', 'entiende',
          'Se le habla en criollo. Mientras más le cuentas, mejor responde.', 4),
         (2, 'escucha',      'Ajito te escucha',      'escucha',
          'No hace falta escribir. Lo enredado vuelve en orden.', 4),
         (3, 've',           'Ajito ve',              've',
          'Le mandas una foto y te dice qué hay. Solo ve lo que le mandas.', 4),
         (4, 'dibuja',       'Ajito dibuja',          'dibuja',
          'Con palabras se hacen imágenes. Y por eso una foto puede ser hecha.', 4),
         (5, 'habla',        'Ajito habla',           'habla',
          'Esta voz la hace una computadora. Te lee en voz alta lo que le mandes.', 4),
         (6, 'cuenta',       'Ajito saca cuentas',    'cuenta',
          'Números sueltos, hablando. Y hay que revisarle.', 4),
         (7, 'se_equivoca',  'Ajito se equivoca',     'se_equivoca',
          'Inventa cuando no sabe. De adentro no sabe nada si no le cuentan.', 4),
         (8, 'cierre',       'Ya sabes',              'cierre',
          'Repaso, la pregunta grande y el certificado.', 3)
       ) as v(numero, clave, titulo, forma, resumen, minutos)
 where c.clave = 'ajito'
on conflict (curso_id, numero) do nothing;
