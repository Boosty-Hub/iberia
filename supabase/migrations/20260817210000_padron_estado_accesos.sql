-- =============================================================================
-- ARREGLO · el padrón decía «sin acuñar» de enlaces que existían
--
-- `padron_estado` se creó con `security_invoker = on`, que es el ajuste correcto
-- por defecto: la vista respeta la RLS de quien la consulta. Pero dentro lleva
-- una subconsulta a `accesos`, y la política de esa tabla **niega el SELECT a
-- todo el mundo** —a propósito, porque ahí viven los hashes de los tokens—.
--
-- Resultado: la subconsulta volvía vacía siempre y la columna del enlace decía
-- «sin acuñar» aunque estuviera acuñado y mandado. Un panel que dice que a
-- alguien no se le ha mandado su enlace cuando sí, lleva a mandárselo dos veces.
--
-- La salida es la misma que ya usa `accesos_estado`: la vista corre como su
-- dueña —saltándose la política— y **el filtro por `es_editor()` es lo que la
-- cierra**. Se enseñan fechas y contadores; el hash no sale de aquí.
--
-- Lo cazó mirar la captura, no una comprobación: el número de arriba y la
-- columna de la derecha decían cosas distintas de la misma persona.
-- =============================================================================

drop view if exists public.padron_estado;

create view public.padron_estado
with (security_invoker = off) as
select
  e.id,
  e.cedula,
  e.nombre_completo,
  e.cargo,
  e.nivel,
  e.tipo_nomina,
  e.sede,
  e.telefono,
  e.email,
  e.activo,
  e.familia_oficio,
  e.area_id,
  ar.nombre                          as area_nombre,
  (e.perfil_id is not null)          as tiene_cuenta,
  m.id                               as matricula_id,
  m.estado                           as estado_matricula,
  m.ultimo_toque,
  (select count(*) from public.avances av
    where av.matricula_id = m.id and av.estado = 'completada') as lecciones_hechas,
  (select max(ac.expira_en) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_expira,
  (select max(ac.enviado_en) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_enviado,
  (select coalesce(sum(ac.usos), 0) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_usos
from public.empleados e
left join public.areas ar on ar.id = e.area_id
left join public.cursos c on c.clave = 'ajito'
left join public.matriculas m on m.empleado_id = e.id and m.curso_id = c.id
-- Lo único que cierra esta vista. Sin esto, `security_invoker = off` la abriría
-- a cualquiera con sesión.
where public.es_editor();

comment on view public.padron_estado is
  'El padrón con lo que hace falta para decidir: teléfono, cuenta, matrícula, '
  'avance y estado del enlace. Corre como su dueña para poder mirar `accesos` '
  '—que niega el SELECT a todos— y se cierra con el filtro por es_editor(). '
  'Nunca expone el hash del token.';

grant select on public.padron_estado to authenticated;
