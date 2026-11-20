-- =============================================================================
-- PLATAFORMA IBERIA · Hoja de ruta de la plataforma (PRG-PLN, 21-nov-2026)
--
-- Gabriel: «Necesito en una parte del sistema algún módulo de todo el plan:
-- hasta ahora qué hemos ejecutado y qué es lo que falta». El plan es dato: las
-- fases, los hitos, lo que falta y las decisiones abiertas viven en la base, no
-- en el repositorio (la carpeta del plan está fuera de git, bajo NDA). Se cargan
-- con `scripts/plataforma/importar-hoja-de-ruta.mjs` y después se editan en la
-- plataforma.
--
--   1) `control.modulo` crece: `ref` (identidad para su ficha), `en_plan` (los
--      65 del plan; FIN-TAS es de interfaz), `fase_clave` (la fase de entrada,
--      para filtrar), `frontera`, `dueno` y `construido` (lo que ya opera). Los
--      estados pasan a la realidad del 21-nov y la columna `estado` se edita con
--      `modulo:programa` · editar (solo esa columna: ruta y recurso deciden el
--      menú y no se tocan desde la API).
--   2) `control.fase_plataforma`, `control.hito_plataforma`,
--      `control.pendiente_plataforma` y `control.decision_plataforma`, con RLS:
--      leer pide `modulo:programa` · ver; lo marcado `solo_equipo` (y todas las
--      decisiones «para Gabriel») solo lo lee el equipo de Boosty
--      (`privado.es_equipo_boosty()`: admin o consultor **y** de la organización
--      Boosty; Alberto es administrador de Iberia y no lo ve). La nota interna de
--      un hito no sale por la API: `control.notas_hitos()`, solo al equipo.
--      Escribir (estado, fechas, resolver) pide `modulo:programa` · editar, por
--      columnas; todo queda en la auditoría encadenada.
--   3) Tres métricas del registro (`ui.m_plataforma_*`): módulos por estado
--      (con el reparto por dominio), hitos por cumplir y lo que falta de Iberia.
--
-- ⚠️ Lo lee Iberia: nada de dinero, nada de régimen contractual (P, P*, E) y
-- nada de alarmas. Lo interno va marcado `solo_equipo`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) ¿Es del equipo de Boosty? (no basta `es_editor()`: el administrador de
--    Iberia también es editor)
-- -----------------------------------------------------------------------------
create or replace function privado.es_equipo_boosty()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.rol in ('admin', 'consultor') and p.organizacion = 'boosty'
                     from public.profiles p where p.id = auth.uid() and p.activo), false);
$$;
revoke all on function privado.es_equipo_boosty() from public, anon;
grant execute on function privado.es_equipo_boosty() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1) LAS FASES (primero: el registro de módulos las referencia)
-- -----------------------------------------------------------------------------
create table if not exists control.fase_plataforma (
  id              uuid primary key default gen_random_uuid(),
  clave           text not null unique check (clave ~ '^[a-z0-9_]{2,40}$'),
  orden           integer not null default 0,
  nombre          text not null check (length(btrim(nombre)) between 3 and 80),
  periodo_texto   text,
  inicio          date,
  fin             date check (fin is null or inicio is null or fin >= inicio),
  estado          text not null default 'planificado' check (estado in ('hecho', 'en_curso', 'proximo', 'planificado')),
  contiene        text,
  criterio_salida text,
  -- Con fechas acordadas (Fase 1, Paso 0, Fase 2, New Iberia y el punto de
  -- control). Las demás no llevan fecha firme: se deciden en el punto de control.
  contratada      boolean not null default false,
  -- La fase en la que va la plataforma hoy (una sola) y en qué está.
  actual          boolean not null default false,
  situacion       text,
  actualizado_en  timestamptz not null default now()
);
create unique index if not exists fase_plataforma_una_actual on control.fase_plataforma (actual) where actual;
comment on table control.fase_plataforma is 'Hoja de ruta: las fases de la plataforma con su estado, lo que contienen y su criterio de salida. Sin montos.';

alter table control.modulo add column if not exists ref uuid not null default gen_random_uuid();
create unique index if not exists modulo_ref_idx on control.modulo (ref);
alter table control.modulo add column if not exists en_plan boolean not null default true;
alter table control.modulo add column if not exists fase_clave text references control.fase_plataforma (clave) on update cascade on delete set null;
alter table control.modulo add column if not exists frontera text;
alter table control.modulo add column if not exists dueno text;
alter table control.modulo add column if not exists construido text;
comment on column control.modulo.en_plan is 'Uno de los 65 módulos del plan (false: módulo de interfaz, como FIN-TAS).';
comment on column control.modulo.construido is 'Lo que ya está construido y operando del módulo, en una o dos frases.';

create table if not exists control.hito_plataforma (
  id             uuid primary key default gen_random_uuid(),
  clave          text not null unique check (clave ~ '^[a-z0-9_]{2,60}$'),
  fase           text references control.fase_plataforma (clave) on update cascade on delete set null,
  titulo         text not null check (length(btrim(titulo)) between 3 and 200),
  fecha          date,
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'hecho', 'cancelado')),
  dueno          text,
  -- Coordinación interna de Boosty: no sale por la API (ver `control.notas_hitos()`).
  nota_interna   text,
  orden          integer not null default 0,
  actualizado_en timestamptz not null default now()
);
create index if not exists hito_plataforma_fecha_idx on control.hito_plataforma (fecha);

create table if not exists control.pendiente_plataforma (
  id             uuid primary key default gen_random_uuid(),
  clave          text not null unique check (clave ~ '^[a-z0-9_]{2,60}$'),
  titulo         text not null check (length(btrim(titulo)) between 3 and 300),
  detalle        text,
  dueno_tipo     text not null check (dueno_tipo in ('iberia', 'gabriel', 'boosty')),
  dueno_cargo    text,
  bloquea        text,
  fecha_limite   date,
  -- Cuando el plazo es una condición y no un día («antes del primer dato de JD»).
  fecha_texto    text,
  estado         text not null default 'abierto' check (estado in ('abierto', 'resuelto')),
  resuelto_en    date,
  -- Lo interno de Boosty: solo lo lee el equipo.
  solo_equipo    boolean not null default false,
  -- De dónde sale (DEP-xx, I-xx del plan, PENDIENTES.md).
  origen         text,
  orden          integer not null default 0,
  actualizado_en timestamptz not null default now(),
  check ((estado = 'resuelto') = (resuelto_en is not null))
);

create table if not exists control.decision_plataforma (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique check (codigo ~ '^[A-Z][A-Z0-9]?-[0-9]{2}$'),
  pregunta           text not null,
  opciones           text,
  opcion_por_defecto text,
  antes_de           text,
  fecha_limite       date,
  estado             text not null default 'abierta' check (estado in ('abierta', 'decidida')),
  decision           text,
  decidida_en        date,
  -- Las «para Gabriel» son de Boosty: no las lee Iberia.
  solo_equipo        boolean not null default true,
  orden              integer not null default 0,
  actualizado_en     timestamptz not null default now(),
  check ((estado = 'decidida') = (decidida_en is not null))
);

-- -----------------------------------------------------------------------------
-- 2) RLS, PRIVILEGIOS POR COLUMNA Y AUDITORÍA
-- -----------------------------------------------------------------------------
alter table control.fase_plataforma enable row level security;
alter table control.hito_plataforma enable row level security;
alter table control.pendiente_plataforma enable row level security;
alter table control.decision_plataforma enable row level security;

-- Nada por defecto: cada columna que se escribe se nombra.
revoke all on control.fase_plataforma, control.hito_plataforma, control.pendiente_plataforma, control.decision_plataforma from public, anon, authenticated;
grant all on control.fase_plataforma, control.hito_plataforma, control.pendiente_plataforma, control.decision_plataforma to service_role;

grant select on control.fase_plataforma to authenticated;
grant update (estado, periodo_texto, inicio, fin, contiene, criterio_salida, situacion, actualizado_en) on control.fase_plataforma to authenticated;

-- El hito sin su nota interna.
grant select (id, clave, fase, titulo, fecha, estado, dueno, orden, actualizado_en) on control.hito_plataforma to authenticated;
grant update (estado, fecha, dueno, actualizado_en) on control.hito_plataforma to authenticated;

grant select on control.pendiente_plataforma to authenticated;
grant update (estado, resuelto_en, fecha_limite, fecha_texto, dueno_cargo, bloquea, actualizado_en) on control.pendiente_plataforma to authenticated;

grant select on control.decision_plataforma to authenticated;
grant update (estado, decision, decidida_en, actualizado_en) on control.decision_plataforma to authenticated;

drop policy if exists "leer las fases" on control.fase_plataforma;
create policy "leer las fases" on control.fase_plataforma for select to authenticated
  using ((select public.puede('modulo:programa', 'ver')));
drop policy if exists "actualizar las fases" on control.fase_plataforma;
create policy "actualizar las fases" on control.fase_plataforma for update to authenticated
  using ((select public.puede('modulo:programa', 'editar'))) with check ((select public.puede('modulo:programa', 'editar')));

drop policy if exists "leer los hitos" on control.hito_plataforma;
create policy "leer los hitos" on control.hito_plataforma for select to authenticated
  using ((select public.puede('modulo:programa', 'ver')));
drop policy if exists "actualizar los hitos" on control.hito_plataforma;
create policy "actualizar los hitos" on control.hito_plataforma for update to authenticated
  using ((select public.puede('modulo:programa', 'editar'))) with check ((select public.puede('modulo:programa', 'editar')));

drop policy if exists "leer lo que falta" on control.pendiente_plataforma;
create policy "leer lo que falta" on control.pendiente_plataforma for select to authenticated
  using ((select public.puede('modulo:programa', 'ver')) and (not solo_equipo or (select privado.es_equipo_boosty())));
drop policy if exists "actualizar lo que falta" on control.pendiente_plataforma;
create policy "actualizar lo que falta" on control.pendiente_plataforma for update to authenticated
  using ((select public.puede('modulo:programa', 'editar')) and (not solo_equipo or (select privado.es_equipo_boosty())))
  with check ((select public.puede('modulo:programa', 'editar')) and (not solo_equipo or (select privado.es_equipo_boosty())));

drop policy if exists "leer las decisiones" on control.decision_plataforma;
create policy "leer las decisiones" on control.decision_plataforma for select to authenticated
  using ((select public.puede('modulo:programa', 'ver')) and (not solo_equipo or (select privado.es_equipo_boosty())));
drop policy if exists "actualizar las decisiones" on control.decision_plataforma;
create policy "actualizar las decisiones" on control.decision_plataforma for update to authenticated
  using ((select public.puede('modulo:programa', 'editar')) and (not solo_equipo or (select privado.es_equipo_boosty())))
  with check ((select public.puede('modulo:programa', 'editar')) and (not solo_equipo or (select privado.es_equipo_boosty())));

-- El registro de módulos: se sigue leyendo entero (es el menú); desde la API
-- solo se escribe el estado, y con la casilla.
revoke insert, update, delete on control.modulo from anon, authenticated;
grant update (estado) on control.modulo to authenticated;
drop policy if exists "actualizar el estado de un módulo" on control.modulo;
create policy "actualizar el estado de un módulo" on control.modulo for update to authenticated
  using ((select public.puede('modulo:programa', 'editar'))) with check ((select public.puede('modulo:programa', 'editar')));

-- La hora del cambio y la fecha de resolución las pone la base.
create or replace function control.hoja_ruta_al_cambiar()
returns trigger language plpgsql set search_path = control, pg_catalog as $$
begin
  new.actualizado_en := now();
  if tg_table_name = 'pendiente_plataforma' then
    if new.estado = 'resuelto' and new.resuelto_en is null then new.resuelto_en := org.hoy(); end if;
    if new.estado = 'abierto' then new.resuelto_en := null; end if;
  elsif tg_table_name = 'decision_plataforma' then
    if new.estado = 'decidida' and new.decidida_en is null then new.decidida_en := org.hoy(); end if;
    if new.estado = 'abierta' then new.decidida_en := null; end if;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['fase_plataforma', 'hito_plataforma', 'pendiente_plataforma', 'decision_plataforma'] loop
    execute format('drop trigger if exists al_cambiar on control.%I', t);
    execute format('create trigger al_cambiar before insert or update on control.%I for each row execute function control.hoja_ruta_al_cambiar()', t);
    execute format('drop trigger if exists auditar on control.%I', t);
    execute format('create trigger auditar after insert or update or delete on control.%I for each row execute function control.auditar()', t);
  end loop;
end;
$$;

-- La nota interna de los hitos: solo al equipo de Boosty.
create or replace function control.notas_hitos()
returns table (id uuid, nota_interna text)
language sql stable security definer set search_path = control, public as $$
  select h.id, h.nota_interna from control.hito_plataforma h
   where privado.es_equipo_boosty() and h.nota_interna is not null;
$$;
revoke all on function control.notas_hitos() from public, anon;
grant execute on function control.notas_hitos() to authenticated;

-- -----------------------------------------------------------------------------
-- 3) LAS FASES DE PARTIDA Y LOS MÓDULOS A LA REALIDAD DEL 21-NOV
--    (lo demás —hitos, lo que falta, decisiones, lo construido— lo carga
--    `importar-hoja-de-ruta.mjs`; aquí solo lo que la columna `fase_clave`
--    necesita para existir)
-- -----------------------------------------------------------------------------
insert into control.fase_plataforma (clave, orden, nombre, estado, contratada) values
  ('fase_1', 10, 'Fase 1 · Entender', 'hecho', true),
  ('t0', 20, 'T0 · Preparación técnica', 'en_curso', true),
  ('paso_0', 30, 'Fase 2 · Paso 0 · La base', 'en_curso', true),
  ('etapa_1', 40, 'Etapa 1 · Procesos y estructura', 'hecho', true),
  ('rediseno', 50, 'Rediseño de la interfaz · R0 a R6', 'hecho', true),
  ('integracion', 60, 'Integración del panel y del canal', 'hecho', true),
  ('f2_modulos', 70, 'Fase 2 · Módulos', 'proximo', true),
  ('new_iberia', 80, 'New Iberia', 'en_curso', true),
  ('punto_control', 90, 'Punto de control', 'planificado', true),
  ('ola_3a', 100, 'Fase 3 · Ola 3A', 'planificado', false),
  ('ola_3b', 110, 'Fase 3 · Ola 3B · La planta', 'planificado', false),
  ('fase_4', 120, 'Fase 4', 'planificado', false)
on conflict (clave) do nothing;

-- La fase de entrada de cada módulo, del texto del plan («Paso 0 → F2…»).
update control.modulo set fase_clave = case
    when fase ilike 'ya opera%' then 'fase_1'
    when fase ilike 'paso 0%' then 'paso_0'
    when fase ilike 'f2%' then 'f2_modulos'
    when fase ilike 'ni%' then 'new_iberia'
    when fase ilike 'f3-a%' then 'ola_3a'
    when fase ilike 'f3-b%' then 'ola_3b'
    when fase ilike 'f4%' then 'fase_4'
    when fase ilike 'r0%' then 'rediseno'
  end
 where fase_clave is null;

update control.modulo set en_plan = false where codigo = 'FIN-TAS';

-- Lo que opera hoy (en producción desde el 20-nov-2026), lo que está a medias y
-- lo demás, planificado. `importar-base.mjs` dice lo mismo.
update control.modulo set estado = 'operando'
 where codigo in ('NUC-IDN', 'NUC-ORG', 'NUC-PRO', 'NUC-DOC', 'NUC-FLU', 'NUC-AUD', 'NUC-CFG', 'NUC-CAN', 'NUC-FOR',
                  'NUC-IA', 'NUC-GIA', 'PRG-PLN', 'PRG-LEV', 'PRG-BIB', 'FIN-TAS');
update control.modulo set estado = 'en_construccion' where codigo in ('NUC-NOT', 'DAT-SEM');
update control.modulo set estado = 'planificado'
 where codigo not in ('NUC-IDN', 'NUC-ORG', 'NUC-PRO', 'NUC-DOC', 'NUC-FLU', 'NUC-AUD', 'NUC-CFG', 'NUC-CAN', 'NUC-FOR',
                      'NUC-IA', 'NUC-GIA', 'PRG-PLN', 'PRG-LEV', 'PRG-BIB', 'FIN-TAS', 'NUC-NOT', 'DAT-SEM')
   and estado <> 'planificado';

-- La casilla «editar» de `modulo:programa` (actualizar la hoja de ruta): de
-- fábrica para el rol Consultor. El nivel administrador ya lo puede todo.
update public.rol_permisos set editar = true
 where recurso = 'modulo:programa' and rol_id = (select id from public.roles where clave = 'consultor');

-- -----------------------------------------------------------------------------
-- 4) LAS MÉTRICAS DEL REGISTRO
--    Firma común: (p_al date, p_escenario uuid) → (valor, total, detalle,
--    calculado_en); security invoker: la RLS de quien mira.
-- -----------------------------------------------------------------------------

-- 4.1 Módulos del plan por estado, con el reparto por dominio.
create or replace function ui.m_plataforma_modulos(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with m as (select * from control.modulo where en_plan),
  dom as (
    select dominio, min(orden) as orden,
           count(*) filter (where estado = 'operando') as operando,
           count(*) filter (where estado = 'en_construccion') as en_construccion,
           count(*) filter (where estado in ('planificado', 'pausado')) as planificado,
           count(*) as total
      from m group by dominio
  )
  select (select count(*) from m where estado = 'operando')::numeric,
         (select count(*) from m)::numeric,
         jsonb_build_object(
           'operando', (select count(*) from m where estado = 'operando'),
           'en_construccion', (select count(*) from m where estado = 'en_construccion'),
           'planificado', (select count(*) from m where estado = 'planificado'),
           'pausado', (select count(*) from m where estado = 'pausado'),
           'por_dominio', coalesce((select jsonb_agg(jsonb_build_object('dominio', dominio, 'operando', operando, 'en_construccion', en_construccion,
                                                                         'planificado', planificado, 'total', total) order by orden) from dom), '[]'::jsonb),
           'actualizado_en', ui.ultimo_cambio('control', array['modulo'])),
         now();
$$;

-- 4.2 Hitos de la hoja de ruta por cumplir (sin hacer ni cancelar), el
-- siguiente y los de los próximos 30 días.
create or replace function ui.m_plataforma_hitos(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with p as (select coalesce(p_al, org.hoy()) as al),
  -- Columnas nombradas: la nota interna no se lee con la sesión (privilegio por columna).
  h as (select id, titulo, fecha, estado, orden from control.hito_plataforma where estado <> 'cancelado')
  select (select count(*) from h where estado = 'pendiente')::numeric,
         (select count(*) from h)::numeric,
         jsonb_build_object(
           'hechos', (select count(*) from h where estado = 'hecho'),
           'proximos_30', (select count(*) from h, p where h.estado = 'pendiente' and h.fecha between p.al and p.al + 30),
           'siguiente', (select jsonb_build_object('titulo', h.titulo, 'fecha', h.fecha) from h, p
                          where h.estado = 'pendiente' and h.fecha >= p.al order by h.fecha, h.orden limit 1),
           'actualizado_en', ui.ultimo_cambio('control', array['hito_plataforma'])),
         now();
$$;

-- 4.3 Lo que falta de Iberia: pendientes abiertos con dueño en Iberia. El total
-- son todos los abiertos que quien mira puede leer (lo interno de Boosty solo
-- cuenta para el equipo: la RLS lo decide).
create or replace function ui.m_plataforma_pendientes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with p as (select coalesce(p_al, org.hoy()) as al),
  a as (select * from control.pendiente_plataforma where estado = 'abierto')
  select (select count(*) from a where dueno_tipo = 'iberia')::numeric,
         (select count(*) from a)::numeric,
         jsonb_build_object(
           'iberia', (select count(*) from a where dueno_tipo = 'iberia'),
           'gabriel', (select count(*) from a where dueno_tipo = 'gabriel'),
           'boosty', (select count(*) from a where dueno_tipo = 'boosty'),
           'con_fecha_30', (select count(*) from a, p where a.dueno_tipo = 'iberia' and a.fecha_limite between p.al and p.al + 30),
           'resueltos', (select count(*) from control.pendiente_plataforma where estado = 'resuelto'),
           'actualizado_en', ui.ultimo_cambio('control', array['pendiente_plataforma'])),
         now();
$$;

revoke execute on function ui.m_plataforma_modulos(date, uuid) from public, anon;
revoke execute on function ui.m_plataforma_hitos(date, uuid) from public, anon;
revoke execute on function ui.m_plataforma_pendientes(date, uuid) from public, anon;
grant execute on function ui.m_plataforma_modulos(date, uuid) to authenticated;
grant execute on function ui.m_plataforma_hitos(date, uuid) to authenticated;
grant execute on function ui.m_plataforma_pendientes(date, uuid) to authenticated;

insert into ui.metrica (clave, nombre, definicion, unidad, modulo, recurso, accion, dueno, fuente, consulta, href, con_fecha, con_escenario, orden) values
  ('plataforma_modulos', 'Módulos operando',
   'Módulos del plan de la plataforma (los 65 de los doce dominios) que están en producción y en uso, contra el total del plan. «En construcción» son los que tienen una parte operando y otra por hacer; «planificados», los que esperan su fase. Las pantallas de apoyo que no son módulos del plan (las tasas, el padrón) no cuentan. Es el estado de hoy del registro de módulos.',
   'módulos', 'PRG-PLN', 'modulo:programa', 'ver', 'Consultoría Boosty (arquitectura de la plataforma)', 'Registro de módulos de la plataforma',
   'ui.m_plataforma_modulos', '/sistema/programa/hoja-de-ruta/modulos', false, false, 65),
  ('plataforma_hitos', 'Hitos por cumplir',
   'Hitos de la hoja de ruta de la plataforma que no se han cumplido (sin contar los cancelados), con el siguiente por fecha y los que caen en los próximos 30 días. El total son todos los hitos, también los cumplidos. Es el estado de hoy.',
   'hitos', 'PRG-PLN', 'modulo:programa', 'ver', 'Consultoría Boosty (arquitectura de la plataforma)', 'Hoja de ruta de la plataforma',
   'ui.m_plataforma_hitos', '/sistema/programa/hoja-de-ruta#hitos', false, false, 66),
  ('plataforma_pendientes', 'Lo que falta de Iberia',
   'Pendientes abiertos de la hoja de ruta cuyo dueño es un cargo de Iberia (insumos, accesos y decisiones que destraban una fase), contra todos los pendientes abiertos que puedes ver. Un pendiente se cierra cuando se marca resuelto, con su fecha. Es el estado de hoy.',
   'pendientes', 'PRG-PLN', 'modulo:programa', 'ver', 'Gerencia General (responsable del roadmap)', 'Hoja de ruta de la plataforma',
   'ui.m_plataforma_pendientes', '/sistema/programa/hoja-de-ruta?f.dueno_tipo=iberia&f.estado=abierto#falta', false, false, 67)
on conflict (clave) do update set
  nombre = excluded.nombre, definicion = excluded.definicion, unidad = excluded.unidad, modulo = excluded.modulo,
  recurso = excluded.recurso, accion = excluded.accion, dueno = excluded.dueno, fuente = excluded.fuente,
  consulta = excluded.consulta, href = excluded.href, con_fecha = excluded.con_fecha,
  con_escenario = excluded.con_escenario, orden = excluded.orden, actualizado_en = now();
