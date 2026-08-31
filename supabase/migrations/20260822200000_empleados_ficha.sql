-- =============================================================================
-- El padrón real llegó, y no trae cédula.
--
-- El listado de Capital Humano de julio de 2026 son 276 personas con **ficha**
-- —el número de nómina, único y estable— pero sin cédula, sin teléfono y sin
-- correo. La ficha es la clave con la que Capital Humano identifica a su gente y
-- es contra la que va a venir el segundo archivo con los datos de contacto.
--
-- Dos cambios, y los dos son de honestidad del dato:
--
--  · Se añade `ficha`. Es la clave del empleador y el puente para cruzar este
--    padrón con lo que falte.
--  · `cedula` pasa a ser opcional. Inventarle una cédula a 276 personas para
--    satisfacer una restricción sería meter dato falso en la tabla de la que
--    después salen los certificados. Prefiero que esté vacía y que se note.
--
-- ⚠️ Sin cédula no se puede acuñar el enlace personal: el correo interno se
-- deriva de ella. Eso es correcto — el enlace tampoco se puede mandar sin
-- teléfono, y las dos cosas vienen en el mismo archivo pendiente.
-- =============================================================================

alter table public.empleados
  add column if not exists ficha text;

-- Única cuando está, libre cuando no: durante la transición conviven las fichas
-- de muestra sembradas a mano y las del padrón real.
create unique index if not exists empleados_ficha_unica
  on public.empleados (ficha)
  where ficha is not null;

alter table public.empleados alter column cedula drop not null;

comment on column public.empleados.ficha is
  'Número de nómina de Capital Humano. Es la clave estable del empleador y el '
  'puente para cruzar el padrón con los datos de contacto que faltan.';

comment on column public.empleados.cedula is
  'Opcional: el padrón de julio de 2026 no la trae. Sin cédula no se puede '
  'acuñar el enlace personal, porque el correo interno se deriva de ella.';
