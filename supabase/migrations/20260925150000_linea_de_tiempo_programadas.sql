-- =============================================================================
-- La línea de tiempo ya no da por hecha una sesión que solo está programada
--
-- La vista ponía `'hecho'` a toda sesión con fecha. ENT-029 está programada
-- para el 15 de septiembre y no se ha hecho, y el programa —que lee Iberia— la
-- mostraba como hecha. Una programada sale como prevista; el resto, como hecha.
-- =============================================================================

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
  case when e.estado = 'programada' then 'previsto' else 'hecho' end,
  e.duracion_minutos
from public.entrevistas e
where e.fecha_entrevista is not null;

comment on view public.linea_de_tiempo is
  'Los hitos del programa y las sesiones del levantamiento en un solo hilo, '
  'ordenables por fecha. Las sesiones se leen de `entrevistas`, no se copian; '
  'una programada sale como prevista.';
