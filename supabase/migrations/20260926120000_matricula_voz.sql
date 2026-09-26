-- =============================================================================
-- Con qué voz oye cada quien a Ajito
-- =============================================================================
--
-- 26 de septiembre de 2026, decisión de Gabriel: el curso tiene dos voces, una
-- de mujer y una de hombre, y cada quien escoge. La elección vale para toda la
-- clase y para las devoluciones, así que vive en la matrícula —es del curso, no
-- de la persona— y la leen la ruta que sirve los audios y la que genera la
-- devolución. Ver `VOCES` en `lib/voz.ts`.
--
-- La cambia su dueño con la política que ya existe («avanzo en mi matricula»);
-- no hace falta una nueva. Quien no ha elegido oye la de siempre: la de mujer.
-- -----------------------------------------------------------------------------

alter table public.matriculas
  add column if not exists voz text not null default 'mujer'
  check (voz in ('mujer', 'hombre'));

comment on column public.matriculas.voz is
  'Con qué voz oye a Ajito: mujer (Paola) u hombre (Sebastián). Ver VOCES en lib/voz.ts.';
