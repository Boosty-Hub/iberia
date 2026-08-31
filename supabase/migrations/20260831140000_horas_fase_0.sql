-- =============================================================================
-- HORAS · una imputación para la etapa anterior
--
-- `consumeBolsa()` corta por **mes calendario**, no por día, y eso está bien: el
-- fee se factura por mes y una fila mensual que mezclara horas que cuentan con
-- horas que no, no se podría leer. Pero tiene un efecto que hasta ahora se
-- tragaba en silencio: el contrato se firmó el 6 de agosto, así que **todo el
-- trabajo del 1 al 5 de agosto cae del lado de la Fase 1** aunque sea el cierre
-- de la etapa anterior —el deck de la sesión de lanzamiento y la negociación
-- contractual con Travieso Evans—, ya cobrado dentro de los USD 4.700 de la
-- Fase 0.
--
-- Cargarlo contra las 107 h mensuales es contarlo dos veces, igual que pasaba
-- con el curso de planta antes de que existiera `fase_2`. Se resuelve del mismo
-- modo: una imputación propia.
--
--   bolsa      consume las 107 h/mes de la fase en curso  (lo normal)
--   fase_0     etapa anterior, ya facturada aparte — no descuenta
--   fase_2     entregable que se factura aparte en la Fase 2 — no descuenta
--   adicional  fuera de la bolsa, aprobado por escrito ANTES de ejecutarlo
--
-- La partida se sigue registrando en los cuatro casos: el expediente tiene que
-- estar completo. Lo que cambia es contra qué se mide.
-- =============================================================================

alter table public.registros_horas
  drop constraint if exists registros_horas_imputacion_check;

alter table public.registros_horas
  add constraint registros_horas_imputacion_check
  check (imputacion in ('bolsa', 'fase_0', 'fase_2', 'adicional'));

comment on column public.registros_horas.imputacion is
  'Contra qué se mide la partida. `bolsa` consume las 107 h/mes de la fase; '
  '`fase_0` es la etapa anterior a la firma, ya facturada aparte; `fase_2` es '
  'entregable que se factura aparte y no descuenta; `adicional` es fuera de '
  'bolsa con aprobación previa y por escrito (cláusula 8).';
