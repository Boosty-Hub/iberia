-- =============================================================================
-- Un proceso puede ser «propuesto»
-- =============================================================================
--
-- Reunión del equipo, 25 de septiembre de 2026: la marca «Nuevo» se leía como si
-- el levantamiento hubiera descubierto procesos que no existían, cuando lo que
-- encontró es que se hacen todos los días y nadie los escribió. Pasó a decir «No
-- documentado» —el estado `NUEVO` de la base no cambia de nombre: significa «no
-- figuraba en el inventario de partida»—.
--
-- Lo único nuevo de verdad es lo que el programa propone, y para eso hace falta un
-- estado propio: `PROPUESTO`. Hoy lo lleva un solo proceso, la gestión de la
-- transformación y adopción tecnológica, que abrió el programa mismo.
--
-- ⚠️ `sembrar:procesos` pisa esta tabla desde el inventario del taller. Si el
-- taller sigue diciendo `NUEVO` para ese proceso, la próxima siembra lo devuelve.
-- El cambio tiene que ir también al taller (PENDIENTES.md).
-- -----------------------------------------------------------------------------

alter table public.procesos drop constraint if exists procesos_estado_check;
alter table public.procesos
  add constraint procesos_estado_check
  check (estado in ('VIGENTE', 'NUEVO', 'PROPUESTO', 'NO SE EJECUTA', 'SIN EVIDENCIA'));

update public.procesos
   set estado = 'PROPUESTO'
 where nombre = 'Gestión de la Transformación y Adopción Tecnológica'
   and estado = 'NUEVO';
