-- =============================================================================
-- EMITIR EL CERTIFICADO
--
-- La tabla `certificados` existe desde la migración del módulo, pero nadie
-- podía crear uno: la política deja escribir solo a los editores de Boosty, y
-- eso está bien — **el certificado no se lo puede fabricar quien lo recibe**.
-- Es lo que lo hace valer algo, y va registrado en Capital Humano.
--
-- La salida no es aflojar la política, es una función `security definer` que
-- comprueba lo que hay que comprobar antes de insertar:
--
--   1. Que la matrícula sea de quien llama.
--   2. Que el curso esté de verdad terminado — todas las lecciones activas.
--
-- Así el trabajador dispara la emisión al terminar la novena lección, pero no
-- puede emitirse uno a mano ni emitirle uno a otro.
--
-- El código va legible a propósito: se imprime, se entrega en mano y alguien de
-- Capital Humano lo va a teclear para verificarlo. `IB-AJITO-2026-0042` se
-- copia de un papel sin equivocarse; un uuid, no.
-- =============================================================================

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
  select m.curso_id, e.nombre_completo, e.cedula, e.cargo, a.nombre
    into v_curso, v_nombre, v_cedula, v_cargo, v_area
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
    (matricula_id, codigo, nombre_completo, cedula, cargo, area_nombre)
  values (
    p_matricula,
    'IB-AJITO-' || to_char(now(), 'YYYY') || '-' || lpad(v_numero::text, 4, '0'),
    v_nombre, v_cedula, v_cargo, v_area
  )
  returning * into v_fila;

  return v_fila;
end;
$$;

comment on function public.emitir_mi_certificado(uuid) is
  'Emite el certificado del curso a quien terminó las nueve lecciones. Es '
  'security definer porque la política de la tabla —correctamente— no deja al '
  'trabajador escribir en ella: aquí se comprueba que la matrícula es suya y '
  'que el curso está completo antes de insertar.';

revoke all on function public.emitir_mi_certificado(uuid) from public;
grant execute on function public.emitir_mi_certificado(uuid) to authenticated;
