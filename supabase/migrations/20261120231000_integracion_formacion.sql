-- =============================================================================
-- PLATAFORMA IBERIA · Integración de Formación (NUC-FOR) y del padrón
--
-- El adiestramiento de Ajito (panel, certificados, el empujón) y el padrón con
-- su enlace personal se mudan del panel viejo (`/dashboard`) a la plataforma:
--
--   · Formación  → `/sistema/nucleo/formacion` (Resumen, Avance, Certificados,
--                  Recordatorios). Es NUC-FOR del plan (05-nucleo §6.13).
--   · Padrón     → `/sistema/personas/padron` («Padrón y accesos»): una vista
--                  del maestro de persona, no un módulo nuevo del plan.
--
-- Lo que hace esta migración:
--   1) El registro de módulos: NUC-FOR apunta a su pantalla nueva.
--   2) `ui.formacion_base()`: las cuentas del curso en una sola función (cuántos
--      le tocan, matriculados, en curso, terminados y el avance por lección).
--      Corre como su dueña —la RLS de `matriculas` y `avances` solo le deja ver
--      lo suyo a quien no es del equipo— y se cierra por dentro con la misma
--      puerta de `adiestramiento_avance`: el equipo o la casilla de
--      Adiestramiento. Son cuentas: ni nombres ni respuestas.
--   3) Las cuatro métricas del registro (`ui.m_formacion_*`) y sus filas en
--      `ui.metrica`. La de certificados corre con la RLS de quien mira: la
--      política de `certificados` ya oye la casilla de Certificados.
--   4) Las fuentes de las tablas: avance por área y oficio (cuentas, con la
--      misma puerta), avance por persona (con la RLS: solo el equipo ve a los
--      demás) y certificados (con la RLS de `certificados`).
--
-- Ninguna política se afloja: las tres funciones que corren como dueña repiten
-- la puerta que ya tenía el tablero, y las demás son `security invoker`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) EL REGISTRO DE MÓDULOS
-- -----------------------------------------------------------------------------
update control.modulo
   set ruta = '/sistema/nucleo/formacion', recurso = 'modulo:adiestramiento', estado = 'operando'
 where codigo = 'NUC-FOR';

-- -----------------------------------------------------------------------------
-- 2) LAS CUENTAS DEL CURSO
-- -----------------------------------------------------------------------------
-- Una fila, siempre (con la puerta cerrada, vacía). `por_leccion` lleva cada
-- lección activa con cuántos la terminaron y cuántos van por ella.
create or replace function ui.formacion_base()
returns table (
  elegibles integer, matriculados integer, sin_empezar integer, en_curso integer, completados integer,
  lecciones integer, hechas integer, por_leccion jsonb, actualizado_en timestamptz
)
language sql stable security definer set search_path = public, pg_catalog as $$
  with c as (select id from public.cursos where clave = 'ajito'),
  m as (select m.* from public.matriculas m join c on c.id = m.curso_id),
  l as (select l.id, l.numero, l.titulo from public.lecciones l join c on c.id = l.curso_id where l.activa),
  a as (
    select av.leccion_id, av.estado, av.completada_en, av.iniciada_en
      from public.avances av join m on m.id = av.matricula_id
  )
  select
    (select count(*) from public.empleados e where e.activo and e.nivel in ('planta', 'administrativo'))::int,
    (select count(*) from m)::int,
    (select count(*) from m where m.estado = 'pendiente')::int,
    (select count(*) from m where m.estado = 'en_curso')::int,
    (select count(*) from m where m.estado = 'completado')::int,
    (select count(*) from l)::int,
    (select count(*) from a join l on l.id = a.leccion_id where a.estado = 'completada')::int,
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'numero', l.numero, 'titulo', l.titulo,
               'completadas', (select count(*) from a where a.leccion_id = l.id and a.estado = 'completada'),
               'en_curso', (select count(*) from a where a.leccion_id = l.id and a.estado <> 'completada'))
             order by l.numero)
        from l), '[]'::jsonb),
    greatest((select max(coalesce(m.ultimo_toque, m.created_at)) from m), (select max(coalesce(a.completada_en, a.iniciada_en)) from a))
  -- ⚠️ Corre como su dueña: la puerta es esta línea (la misma de `adiestramiento_avance`).
  where public.es_editor() or public.puede('modulo:adiestramiento', 'ver');
$$;
comment on function ui.formacion_base() is
  'Las cuentas del curso de Ajito (sin nombres ni respuestas). Corre como su dueña y se cierra con el equipo o la casilla de Adiestramiento.';

-- -----------------------------------------------------------------------------
-- 3) LAS MÉTRICAS DEL REGISTRO
--    Firma común: (p_al date, p_escenario uuid) → (valor, total, detalle, calculado_en)
--    Son el estado de hoy: el avance del curso no tiene historia por fecha.
-- -----------------------------------------------------------------------------
create or replace function ui.m_formacion_matriculados(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select b.matriculados::numeric, b.elegibles::numeric,
         jsonb_build_object('sin_empezar', b.sin_empezar, 'en_curso', b.en_curso, 'completados', b.completados,
                            'sin_matricula', greatest(b.elegibles - b.matriculados, 0), 'actualizado_en', b.actualizado_en),
         now()
    from ui.formacion_base() b;
$$;

create or replace function ui.m_formacion_completaron(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select b.completados::numeric, b.matriculados::numeric,
         jsonb_build_object('en_curso', b.en_curso, 'sin_empezar', b.sin_empezar, 'actualizado_en', b.actualizado_en),
         now()
    from ui.formacion_base() b;
$$;

create or replace function ui.m_formacion_avance(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select b.hechas::numeric, (b.matriculados * b.lecciones)::numeric,
         jsonb_build_object('lecciones', b.lecciones,
                            'promedio', case when b.matriculados > 0 then round(b.hechas::numeric / b.matriculados, 1) end,
                            'por_leccion', b.por_leccion, 'actualizado_en', b.actualizado_en),
         now()
    from ui.formacion_base() b;
$$;

-- Con la RLS de quien mira: `certificados` se lee con el equipo o con la casilla.
create or replace function ui.m_formacion_certificados(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select count(*)::numeric, null::numeric,
         jsonb_build_object('entregados', count(*) filter (where c.entregado_en is not null),
                            'sin_entregar', count(*) filter (where c.entregado_en is null),
                            'actualizado_en', greatest(max(c.emitido_en), max(c.entregado_en))),
         now()
    from public.certificados c;
$$;

-- -----------------------------------------------------------------------------
-- 4) LAS FUENTES DE LAS TABLAS
-- -----------------------------------------------------------------------------
-- 4.1 El avance por área y oficio: cuentas, con la puerta del tablero.
create or replace function ui.formacion_avance()
returns table (
  id text, area_id uuid, area text, familia text, matriculados integer, sin_empezar integer, en_curso integer,
  completados integer, lecciones_promedio numeric, avance numeric, busqueda text
)
language sql stable security definer set search_path = public, ui, pg_catalog as $$
  with c as (select id from public.cursos where clave = 'ajito'),
  n as (select count(*)::numeric as lecciones from public.lecciones l join c on c.id = l.curso_id where l.activa),
  m as (
    select m.id, m.estado, e.area_id, coalesce(m.familia_oficio, e.familia_oficio, 'generico') as familia,
           (select count(*) from public.avances av where av.matricula_id = m.id and av.estado = 'completada') as hechas
      from public.matriculas m
      join c on c.id = m.curso_id
      join public.empleados e on e.id = m.empleado_id
  )
  select coalesce(m.area_id::text, 'sin-area') || '|' || m.familia, m.area_id, coalesce(ar.nombre, 'Sin área asignada'), m.familia,
         count(*)::int,
         (count(*) filter (where m.estado = 'pendiente'))::int,
         (count(*) filter (where m.estado = 'en_curso'))::int,
         (count(*) filter (where m.estado = 'completado'))::int,
         round(avg(m.hechas), 1),
         case when (select lecciones from n) > 0 then round(100 * sum(m.hechas) / (count(*) * (select lecciones from n)), 1) end,
         ui.plano(coalesce(ar.nombre, 'sin area') || ' ' || m.familia)
    from m
    left join public.areas ar on ar.id = m.area_id
   -- ⚠️ Corre como su dueña: la puerta es esta línea (la misma de `adiestramiento_avance`).
   where public.es_editor() or public.puede('modulo:adiestramiento', 'ver')
   group by m.area_id, ar.nombre, m.familia;
$$;
comment on function ui.formacion_avance() is
  'El avance del curso por área y oficio, sin nombres. Corre como su dueña y se cierra con el equipo o la casilla de Adiestramiento.';

-- 4.2 El avance por persona, lección por lección. Con la RLS de quien mira: el
-- equipo ve a todos; cualquier otro, solo su propia matrícula.
create or replace function ui.formacion_personas()
returns table (
  id uuid, empleado_id uuid, nombre text, ficha text, cargo text, area text, familia text, estado text,
  lecciones_hechas integer, ultimo_toque timestamptz, dias_callado integer, certificado text,
  l0 text, l1 text, l2 text, l3 text, l4 text, l5 text, l6 text, l7 text, l8 text, busqueda text
)
language sql stable security invoker set search_path = public, ui, pg_catalog as $$
  with c as (select id from public.cursos where clave = 'ajito'),
  av as (
    select av.matricula_id, l.numero, av.estado
      from public.avances av join public.lecciones l on l.id = av.leccion_id
  )
  select m.id, e.id, e.nombre_completo, e.ficha, e.cargo, coalesce(ar.nombre, 'Sin área asignada'),
         coalesce(m.familia_oficio, e.familia_oficio, 'generico'), m.estado,
         (select count(*) from av where av.matricula_id = m.id and av.estado = 'completada')::int,
         m.ultimo_toque,
         case when m.estado <> 'completado' then extract(day from now() - coalesce(m.ultimo_toque, m.created_at))::int end,
         (select ce.codigo from public.certificados ce where ce.matricula_id = m.id limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 0 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 1 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 2 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 3 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 4 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 5 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 6 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 7 limit 1),
         (select case when av.estado = 'completada' then 'hecha' else 'va' end from av where av.matricula_id = m.id and av.numero = 8 limit 1),
         ui.plano(e.nombre_completo || ' ' || coalesce(e.ficha, '') || ' ' || coalesce(e.cargo, '') || ' ' || coalesce(ar.nombre, ''))
    from public.matriculas m
    join c on c.id = m.curso_id
    join public.empleados e on e.id = m.empleado_id
    left join public.areas ar on ar.id = e.area_id;
$$;

-- 4.3 Los certificados emitidos. Con la RLS de `certificados`. Sin cédula: la
-- tabla dice la ficha; la cédula va solo en la hoja impresa.
drop function if exists ui.formacion_certificados();
create or replace function ui.formacion_certificados()
returns table (
  id uuid, codigo text, nombre text, ficha text, cargo text, area text, emitido_en timestamptz,
  entregado_en timestamptz, entregado text, por_entregar boolean, busqueda text
)
language sql stable security invoker set search_path = public, ui, pg_catalog as $$
  select c.id, c.codigo, c.nombre_completo, c.ficha, c.cargo, c.area_nombre, c.emitido_en, c.entregado_en,
         case when c.entregado_en is null then 'no' else 'si' end, c.entregado_en is null,
         ui.plano(c.codigo || ' ' || c.nombre_completo || ' ' || coalesce(c.ficha, '') || ' ' || coalesce(c.area_nombre, ''))
    from public.certificados c;
$$;

-- Nadie sin sesión; con sesión, cada función decide (la puerta o la RLS).
do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'ui' and (p.proname like 'm\_formacion\_%' or p.proname like 'formacion\_%')
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) EL CONTENIDO DEL REGISTRO
-- -----------------------------------------------------------------------------
insert into ui.metrica (clave, nombre, definicion, unidad, modulo, recurso, accion, dueno, fuente, consulta, href, con_fecha, con_escenario, orden) values
  ('formacion_matriculados', 'Matriculados en el curso',
   'Personas con matrícula en el curso de Ajito, en cualquier estado (sin empezar, en curso o terminado), contra las personas activas del padrón de nivel planta o administrativo, que son a quienes les toca. Quien se matriculó solo («Recorrer el curso») cuenta en los matriculados aunque no sea de esos niveles. Es el estado de hoy.',
   'personas', 'NUC-FOR', 'modulo:adiestramiento', 'ver', 'Director de Capital Humano', 'Curso de Ajito: matrículas y padrón',
   'ui.m_formacion_matriculados', '/sistema/nucleo/formacion/avance', false, false, 70),
  ('formacion_completaron', 'Terminaron el curso',
   'Matrículas del curso de Ajito en estado terminado: las nueve lecciones completadas (la lección 8 da el curso por terminado al abrirse el turno del certificado). El total son todas las matrículas. Es el estado de hoy.',
   'personas', 'NUC-FOR', 'modulo:adiestramiento', 'ver', 'Director de Capital Humano', 'Curso de Ajito: matrículas',
   'ui.m_formacion_completaron', '/sistema/nucleo/formacion/avance', false, false, 71),
  ('formacion_avance', 'Lecciones completadas',
   'Lecciones activas del curso de Ajito completadas por las personas matriculadas, sumando a todos. El total es lo que falta para que todos terminen: matriculados por lecciones activas. El detalle trae, por lección, cuántos la terminaron y cuántos van por ella. Es el estado de hoy.',
   'lecciones', 'NUC-FOR', 'modulo:adiestramiento', 'ver', 'Director de Capital Humano', 'Curso de Ajito: avances por lección',
   'ui.m_formacion_avance', '/sistema/nucleo/formacion/avance', false, false, 72),
  ('formacion_certificados', 'Certificados emitidos',
   'Certificados del curso de Ajito emitidos al terminar las nueve lecciones, de los que puedes ver. El detalle separa los entregados en mano de los que faltan por entregar. Es el estado de hoy.',
   'certificados', 'NUC-FOR', 'modulo:certificados', 'ver', 'Director de Capital Humano', 'Curso de Ajito: certificados',
   'ui.m_formacion_certificados', '/sistema/nucleo/formacion/certificados', false, false, 73)
on conflict (clave) do update set
  nombre = excluded.nombre, definicion = excluded.definicion, unidad = excluded.unidad, modulo = excluded.modulo,
  recurso = excluded.recurso, accion = excluded.accion, dueno = excluded.dueno, fuente = excluded.fuente,
  consulta = excluded.consulta, href = excluded.href, con_fecha = excluded.con_fecha,
  con_escenario = excluded.con_escenario, orden = excluded.orden, actualizado_en = now();
