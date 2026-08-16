-- =============================================================================
-- Adiestramiento · corrección de copia: «ratos» → «clases»
--
-- La descripción del curso decía «nueve ratos de tres minutos». En Venezuela
-- «rato» no funciona como unidad contable —«nueve ratos» no se entiende de una—,
-- y el registro del proyecto es modismo venezolano. Se dice «clases»: es lo que
-- son, se entiende sin pensarlo y va con «adiestramiento», que es la palabra que
-- usa la casa.
--
-- Va en migración aparte y no editando `20260816120000`, que ya corrió: una
-- migración aplicada se deja como corrió. Sobre una base nueva esto se ejecuta
-- detrás de la siembra y converge igual.
-- =============================================================================

update public.cursos
   set descripcion = replace(descripcion, 'Nueve ratos', 'Nueve clases'),
       updated_at  = now()
 where clave = 'ajito'
   and descripcion like '%Nueve ratos%';
