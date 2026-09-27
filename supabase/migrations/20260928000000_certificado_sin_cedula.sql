-- =============================================================================
-- El certificado sin cédula: con el número de ficha
-- =============================================================================
--
-- 27 de septiembre de 2026. El listado de Capital Humano llegó sin cédulas —el
-- padrón las hizo opcionales el 22 de agosto—, pero el certificado las seguía
-- exigiendo: `certificados.cedula` era `not null`, y la emisión fallaba en silencio
-- para cualquiera de las 276 personas del padrón real. Lo cazó Gabriel antes de
-- mandarle a Martha Álvarez su acceso para revisar el curso: al final de la
-- lección 8 le iba a salir «tu certificado se está preparando» en vez del
-- certificado.
--
-- Ahora el certificado congela también el número de ficha, que es con lo que
-- Capital Humano identifica a cada persona, y lo muestra cuando no hay cédula.
-- La cédula, si está, sigue saliendo.
-- -----------------------------------------------------------------------------

alter table public.certificados
  alter column cedula drop not null,
  add column if not exists ficha text;

comment on column public.certificados.cedula is
  'La cédula al emitir, si la ficha la tenía. El listado de Capital Humano no las trae.';
comment on column public.certificados.ficha is
  'El número de ficha de Capital Humano al emitir. Se muestra cuando no hay cédula.';

create or replace function public.emitir_mi_certificado(p_matricula uuid)
returns public.certificados
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empleado    uuid := public.mi_empleado();
  v_curso       uuid;
  v_activas     int;
  v_completadas int;
  v_nombre      text;
  v_cedula      text;
  v_ficha       text;
  v_cargo       text;
  v_area        text;
  v_numero      int;
  v_fila        public.certificados;
begin
  if v_empleado is null then
    raise exception 'Sin ficha en el padrón';
  end if;

  -- 1) La matrícula tiene que ser suya. Se leen de paso los datos que van
  --    congelados en el certificado: si mañana cambia de cargo, el papel sigue
  --    diciendo lo que era el día que lo hizo.
  select m.curso_id, e.nombre_completo, e.cedula, e.ficha, e.cargo, a.nombre
    into v_curso, v_nombre, v_cedula, v_ficha, v_cargo, v_area
    from public.matriculas m
    join public.empleados e on e.id = m.empleado_id
    left join public.areas a on a.id = e.area_id
   where m.id = p_matricula
     and m.empleado_id = v_empleado;

  if v_curso is null then
    raise exception 'Esa matrícula no es tuya';
  end if;

  -- 2) Y el curso tiene que estar terminado de verdad. No basta con que la
  --    matrícula diga «completado»: se cuentan las lecciones.
  select count(*) into v_activas
    from public.lecciones where curso_id = v_curso and activa;

  select count(*) into v_completadas
    from public.avances av
    join public.lecciones l on l.id = av.leccion_id
   where av.matricula_id = p_matricula
     and av.estado = 'completada'
     and l.activa;

  if v_completadas < v_activas then
    raise exception 'Todavía te faltan lecciones';
  end if;

  -- Ya lo tiene: se devuelve el mismo. Emitir dos veces no puede dar dos
  -- códigos distintos para la misma persona.
  select * into v_fila from public.certificados where matricula_id = p_matricula;
  if found then
    return v_fila;
  end if;

  select count(*) + 1 into v_numero from public.certificados;

  insert into public.certificados
    (matricula_id, codigo, nombre_completo, cedula, ficha, cargo, area_nombre)
  values (
    p_matricula,
    'IB-AJITO-' || to_char(now(), 'YYYY') || '-' || lpad(v_numero::text, 4, '0'),
    v_nombre, v_cedula, v_ficha, v_cargo, v_area
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

comment on function public.emitir_mi_certificado(uuid) is
  'Emite el certificado del curso a quien terminó las nueve lecciones. Es '
  'security definer porque la política de la tabla —correctamente— no deja al '
  'trabajador escribir en ella: aquí se comprueba que la matrícula es suya y '
  'que el curso está completo antes de insertar. La cédula es opcional: sin '
  'ella, el certificado lleva el número de ficha.';

-- Los que ya están emitidos, con su número de ficha.
update public.certificados c
   set ficha = e.ficha
  from public.matriculas m
  join public.empleados e on e.id = m.empleado_id
 where m.id = c.matricula_id
   and c.ficha is null;
