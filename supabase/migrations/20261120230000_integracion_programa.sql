-- =============================================================================
-- PLATAFORMA IBERIA · Integración del PROGRAMA (dominio PRG) en /sistema
-- (20-nov-2026, decisión de Gabriel: todo lo del panel viejo pasa a la
-- plataforma; solo el informe se queda afuera, intacto)
--
--   1) `control.modulo`: PRG-PLN, PRG-LEV y PRG-BIB apuntan a sus pantallas
--      nuevas (`/sistema/programa/**`). Los recursos NO cambian
--      (`modulo:programa`, `modulo:entrevistas`, PRG-BIB sin recurso): las
--      matrices de roles siguen valiendo tal cual.
--   2) `calendario_actividades.ref`: un uuid estable por actividad para su
--      ficha (`?ficha=actividad:<ref>`). El id de texto sigue siendo la llave
--      (lo usan la agenda, el documento para Iberia y `mirar-calendario.mjs`).
--   3) `ui.programa_entrevistas` y `ui.programa_archivos`: las fuentes de las
--      tablas del Levantamiento. Vistas `security_invoker` (la RLS de quien
--      mira) que además se cierran con la casilla de su módulo. Lo «solo
--      Boosty» (notas del consultor en la búsqueda, hallazgos sin validar) solo
--      cuenta para el equipo (`es_editor()`).
--   4) El registro de métricas del programa (`ui.metrica` + `ui.m_*`): horas
--      del mes contra la referencia de 107 h (en horas, nunca en dinero),
--      sesiones de trabajo, entregables próximos y vencidos del calendario,
--      entrevistas contra la meta de ~25 y el expediente.
--
-- La RLS de las tablas del programa no cambia: nada se abre.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) EL REGISTRO DE MÓDULOS
-- -----------------------------------------------------------------------------
update control.modulo set ruta = '/sistema/programa' where codigo = 'PRG-PLN';
update control.modulo set ruta = '/sistema/programa/levantamiento' where codigo = 'PRG-LEV';
update control.modulo set ruta = '/sistema/programa/biblioteca' where codigo = 'PRG-BIB';

-- -----------------------------------------------------------------------------
-- 2) LA FICHA DE UNA ACTIVIDAD DEL CALENDARIO
-- -----------------------------------------------------------------------------
alter table public.calendario_actividades add column if not exists ref uuid not null default gen_random_uuid();
create unique index if not exists calendario_actividades_ref_idx on public.calendario_actividades (ref);
comment on column public.calendario_actividades.ref is
  'Identidad estable para la ficha de la plataforma (?ficha=actividad:<ref>). La llave sigue siendo id.';

-- -----------------------------------------------------------------------------
-- 3) LAS FUENTES DE LAS TABLAS DEL LEVANTAMIENTO
-- -----------------------------------------------------------------------------
create or replace view ui.programa_entrevistas with (security_invoker = true) as
select e.id,
       e.codigo,
       left(e.codigo, 3) as serie,
       e.tipo,
       coalesce(nullif(btrim(e.titulo), ''), nullif(btrim(e.entrevistado_nombre), ''), e.codigo) as titulo,
       e.entrevistado_nombre,
       e.entrevistado_cargo,
       e.area_id,
       a.nombre as area,
       e.sede,
       e.fecha_entrevista as fecha,
       e.duracion_minutos,
       e.estado,
       e.entrevistador,
       (select count(*) from public.sesion_participantes p where p.entrevista_id = e.id)::int as participantes,
       (exists (select 1 from public.transcripcion_segmentos s where s.entrevista_id = e.id)) as con_transcripcion,
       -- Los hallazgos sin validar son «solo Boosty»: el cliente cuenta los validados.
       (select count(*) from public.hallazgos h
         where h.entrevista_id = e.id and (h.estado = 'validado' or (select public.es_editor())))::int as hallazgos,
       sgc.plano(concat_ws(' ', e.codigo, e.titulo, e.entrevistado_nombre, e.entrevistado_cargo, a.nombre, e.resumen,
                           case when (select public.es_editor()) then e.notas_consultor end)) as busqueda
  from public.entrevistas e
  left join public.areas a on a.id = e.area_id
 where (select public.puede('modulo:entrevistas', 'ver'));
comment on view ui.programa_entrevistas is
  'PRG-LEV · Entrevistas: la tabla del levantamiento (ENT/SES/FOR), con la RLS de quien mira y la casilla modulo:entrevistas.';
grant select on ui.programa_entrevistas to authenticated;

create or replace view ui.programa_archivos with (security_invoker = true) as
select f.id,
       f.nombre,
       f.descripcion,
       f.mime_type,
       upper(case when position('.' in f.nombre) > 0 then substring(f.nombre from '\.([^.]{1,5})$') end) as extension,
       f.tamano_bytes,
       f.categoria,
       f.area_id,
       a.nombre as area,
       f.entrevista_id,
       e.codigo as entrevista,
       f.fase,
       f.confidencial,
       f.created_at as subido_en,
       'ver,descargar'::text as acciones,
       sgc.plano(concat_ws(' ', f.nombre, f.descripcion, e.codigo, a.nombre)) as busqueda
  from public.archivos f
  left join public.areas a on a.id = f.area_id
  left join public.entrevistas e on e.id = f.entrevista_id
 where (select public.puede('modulo:archivos', 'ver'));
comment on view ui.programa_archivos is
  'PRG-LEV · Archivos: el expediente del levantamiento, con la RLS de quien mira y la casilla modulo:archivos.';
grant select on ui.programa_archivos to authenticated;

-- -----------------------------------------------------------------------------
-- 4) LAS MÉTRICAS DEL PROGRAMA
--    Firma común: (p_al date, p_escenario uuid) → (valor, total, detalle, calculado_en)
--    security invoker: la RLS de quien mira (y el despachador revisa la casilla).
-- -----------------------------------------------------------------------------

-- 4.1 Horas del mes contra la referencia de 107 h (cláusula 8). En HORAS: este
-- módulo lo lee Iberia y no lleva dinero. Las cuotas por perfil son términos
-- firmados que viven en `lib/programa.ts` (CUOTA, BOLSA_MENSUAL = 107); si
-- cambian allá, cambian aquí. Cuenta solo lo que consume bolsa (`imputacion`
-- = bolsa) desde el mes de la firma (agosto de 2026): la etapa anterior y lo
-- que se factura aparte no descuentan.
create or replace function ui.m_programa_horas_mes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with p as (select coalesce(p_al, org.hoy()) as al, date_trunc('month', coalesce(p_al, org.hoy()))::date as mes),
  bolsa as (
    select r.fecha, r.perfil, r.horas, date_trunc('month', r.fecha)::date as mes
      from public.registros_horas r, p
     where coalesce(r.imputacion, 'bolsa') = 'bolsa' and r.fecha >= date '2026-08-01' and r.fecha <= p.al
  ),
  meses as (
    select m::date as mes from p, generate_series(date '2026-08-01', greatest(p.mes, date '2026-08-01'), interval '1 month') m
  ),
  por_mes as (
    select m.mes, coalesce(sum(b.horas), 0) as horas from meses m left join bolsa b on b.mes = m.mes group by m.mes
  )
  select coalesce((select sum(b.horas) from bolsa b, p where b.mes = p.mes), 0)::numeric,
         107::numeric,
         jsonb_build_object(
           'mes', (select mes from p),
           'consultor_senior', coalesce((select sum(b.horas) from bolsa b, p where b.mes = p.mes and b.perfil = 'consultor_senior'), 0),
           'director_arquitecto', coalesce((select sum(b.horas) from bolsa b, p where b.mes = p.mes and b.perfil = 'director_arquitecto'), 0),
           'consultor_procesos', coalesce((select sum(b.horas) from bolsa b, p where b.mes = p.mes and b.perfil = 'consultor_procesos'), 0),
           'desarrollador_ia', coalesce((select sum(b.horas) from bolsa b, p where b.mes = p.mes and b.perfil = 'desarrollador_ia'), 0),
           'acumulado', coalesce((select sum(horas) from bolsa), 0),
           'meses', (select count(*) from meses),
           'promedio', round(coalesce((select sum(horas) from bolsa), 0) / greatest((select count(*) from meses), 1), 1),
           'serie', (select jsonb_agg(horas order by mes) from (select * from por_mes order by mes desc limit 6) x),
           'actualizado_en', (select max(greatest(r.created_at, r.updated_at)) from public.registros_horas r)),
         now();
$$;

-- 4.2 Sesiones de trabajo: las del levantamiento que ya ocurrieron (todo lo que
-- no está «programada») con fecha hasta «Datos al». Es la cifra «Sesiones de
-- trabajo» de Consumos. El total son todas las que tienen fecha.
create or replace function ui.m_programa_sesiones(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with p as (select coalesce(p_al, org.hoy()) as al),
  s as (select e.* from public.entrevistas e, p where e.fecha_entrevista is not null and e.fecha_entrevista <= p.al)
  select (select count(*) from s where estado <> 'programada')::numeric,
         (select count(*) from public.entrevistas where fecha_entrevista is not null)::numeric,
         jsonb_build_object(
           'ent', (select count(*) from s where estado <> 'programada' and codigo like 'ENT-%'),
           'ses', (select count(*) from s where estado <> 'programada' and codigo like 'SES-%'),
           'for', (select count(*) from s where estado <> 'programada' and codigo like 'FOR-%'),
           'programadas', (select count(*) from public.entrevistas where estado = 'programada'),
           'actualizado_en', (select max(updated_at) from public.entrevistas)),
         now();
$$;

-- 4.3 Entregables e hitos del calendario (Fase 2 y New Iberia) que no están
-- hechos. La fecha que cuenta es la confirmada; si no hay, el fin previsto, y
-- si no, el inicio. «Próximos» = de «Datos al» a 30 días; «vencidos» = con la
-- fecha ya pasada y sin hacer (se dice, no se pinta en rojo).
create or replace function ui.m_programa_entregables(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with p as (select coalesce(p_al, org.hoy()) as al),
  e as (
    select c.*, coalesce(c.fecha_confirmada, c.fin, c.inicio) as fecha
      from public.calendario_actividades c where c.tipo in ('entregable', 'hito')
  )
  select (select count(*) from e where estado <> 'hecho')::numeric,
         (select count(*) from e)::numeric,
         jsonb_build_object(
           'proximos_30', (select count(*) from e, p where e.estado <> 'hecho' and e.fecha between p.al and p.al + 30),
           'vencidos', (select count(*) from e, p where e.estado <> 'hecho' and e.fecha < p.al),
           'hechos', (select count(*) from e where estado = 'hecho'),
           'siguiente', (select jsonb_build_object('titulo', e.titulo, 'fecha', e.fecha) from e, p
                          where e.estado <> 'hecho' and e.fecha >= p.al order by e.fecha, e.orden limit 1),
           'actualizado_en', (select max(updated_at) from public.calendario_actividades)),
         now();
$$;

-- 4.4 Entrevistas (serie ENT-) hechas contra la meta de ~25 de la cláusula 5.
-- Las reuniones y recorridos (SES-) y las formaciones (FOR-) no cuentan:
-- meterlas inflaría el avance contra la meta.
create or replace function ui.m_levantamiento_entrevistas(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with p as (select coalesce(p_al, org.hoy()) as al),
  ent as (select e.* from public.entrevistas e where e.codigo like 'ENT-%')
  select (select count(*) from ent, p where ent.estado <> 'programada' and coalesce(ent.fecha_entrevista, p.al) <= p.al)::numeric,
         25::numeric,
         jsonb_build_object(
           'programada', (select count(*) from ent where estado = 'programada'),
           'realizada', (select count(*) from ent where estado = 'realizada'),
           'transcrita', (select count(*) from ent where estado = 'transcrita'),
           'analizada', (select count(*) from ent where estado = 'analizada'),
           'ses', (select count(*) from public.entrevistas where codigo like 'SES-%'),
           'for', (select count(*) from public.entrevistas where codigo like 'FOR-%'),
           'actualizado_en', (select max(updated_at) from public.entrevistas)),
         now();
$$;

-- 4.5 El expediente del levantamiento: archivos cargados hasta «Datos al».
create or replace function ui.m_levantamiento_archivos(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  with p as (select coalesce(p_al, org.hoy()) as al),
  f as (select a.* from public.archivos a, p where a.created_at::date <= p.al)
  select (select count(*) from f)::numeric,
         null::numeric,
         jsonb_build_object(
           'bytes', coalesce((select sum(tamano_bytes) from f), 0),
           'confidenciales', (select count(*) from f where confidencial),
           'con_sesion', (select count(*) from f where entrevista_id is not null),
           'actualizado_en', (select max(greatest(created_at, updated_at)) from public.archivos)),
         now();
$$;

revoke execute on function ui.m_programa_horas_mes(date, uuid) from public, anon;
revoke execute on function ui.m_programa_sesiones(date, uuid) from public, anon;
revoke execute on function ui.m_programa_entregables(date, uuid) from public, anon;
revoke execute on function ui.m_levantamiento_entrevistas(date, uuid) from public, anon;
revoke execute on function ui.m_levantamiento_archivos(date, uuid) from public, anon;
grant execute on function ui.m_programa_horas_mes(date, uuid) to authenticated;
grant execute on function ui.m_programa_sesiones(date, uuid) to authenticated;
grant execute on function ui.m_programa_entregables(date, uuid) to authenticated;
grant execute on function ui.m_levantamiento_entrevistas(date, uuid) to authenticated;
grant execute on function ui.m_levantamiento_archivos(date, uuid) to authenticated;

insert into ui.metrica (clave, nombre, definicion, unidad, modulo, recurso, accion, dueno, fuente, consulta, href, con_fecha, con_escenario, orden) values
  ('programa_horas_mes', 'Horas del mes',
   'Horas del equipo de Boosty cargadas en el mes de «Datos al» (hasta ese día) que consumen la referencia mensual de la fase: 107 horas, la suma de las cuotas de los cuatro perfiles del contrato (cláusula 8). No cuenta la etapa anterior a la firma ni lo que se factura aparte (curso de planta, adicionales). La referencia se administra como promedio dentro de la fase: un mes por encima es información, no una alarma. En horas, nunca en dinero.',
   'horas', 'PRG-PLN', 'modulo:programa', 'ver', 'Gerente General (sponsor del programa)', 'Registro de horas del programa (partidas por perfil)',
   'ui.m_programa_horas_mes', '/sistema/programa/consumos', true, false, 60),
  ('programa_sesiones', 'Sesiones de trabajo',
   'Sesiones del levantamiento que ya ocurrieron hasta «Datos al»: entrevistas (ENT-), reuniones y recorridos (SES-) y formaciones (FOR-), en cualquier estado salvo «programada». El total son todas las sesiones con fecha, también las que están por hacerse.',
   'sesiones', 'PRG-PLN', 'modulo:programa', 'ver', 'Gerente General (sponsor del programa)', 'Levantamiento: sesiones registradas',
   'ui.m_programa_sesiones', '/sistema/programa/linea', true, false, 61),
  ('programa_entregables', 'Entregables por cumplir',
   'Entregables e hitos del calendario de la Fase 2 y New Iberia que no están hechos. La fecha que cuenta es la confirmada; si no hay, el fin previsto, y si no, el inicio. «Próximos» son los que caen en los 30 días desde «Datos al»; «vencidos», los que tienen la fecha pasada y siguen sin hacer. El total son todos los entregables e hitos del calendario. Es el estado de hoy del calendario.',
   'entregables', 'PRG-PLN', 'modulo:calendario', 'ver', 'Gerente de TI (coordinación del programa)', 'Calendario Fase 2 y New Iberia',
   'ui.m_programa_entregables', '/sistema/programa/calendario', false, false, 62),
  ('levantamiento_entrevistas', 'Entrevistas hechas',
   'Entrevistas de la serie ENT- que ya ocurrieron (cualquier estado salvo «programada») hasta «Datos al», contra la meta de alrededor de 25 que compromete la cláusula 5. Las reuniones y recorridos (SES-) y las formaciones (FOR-) se cuentan aparte: sumarlas inflaría el avance.',
   'entrevistas', 'PRG-LEV', 'modulo:entrevistas', 'ver', 'Consultoría Boosty', 'Levantamiento: sesiones registradas',
   'ui.m_levantamiento_entrevistas', '/sistema/programa/levantamiento/entrevistas?f.serie=ENT', true, false, 63),
  ('levantamiento_archivos', 'Archivos del expediente',
   'Documentos cargados al expediente del levantamiento hasta «Datos al»: manuales, reportes del ERP, muestras de datos, políticas y material de comunicación. Cuenta los que tu sesión puede ver.',
   'archivos', 'PRG-LEV', 'modulo:archivos', 'ver', 'Consultoría Boosty', 'Expediente del levantamiento (bucket privado)',
   'ui.m_levantamiento_archivos', '/sistema/programa/levantamiento/archivos', true, false, 64)
on conflict (clave) do update set
  nombre = excluded.nombre, definicion = excluded.definicion, unidad = excluded.unidad, modulo = excluded.modulo,
  recurso = excluded.recurso, accion = excluded.accion, dueno = excluded.dueno, fuente = excluded.fuente,
  consulta = excluded.consulta, href = excluded.href, con_fecha = excluded.con_fecha,
  con_escenario = excluded.con_escenario, orden = excluded.orden, actualizado_en = now();
