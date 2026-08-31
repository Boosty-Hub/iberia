-- =============================================================================
-- Una partida de horas no es un día de una persona.
--
-- El tope original de 24 h daba por hecho que cada fila era una jornada, y por
-- eso servía de cazafallos del cero de más. Pero el registro real no funciona
-- así: «el canal de comunicación interna, 36 h» es un bloque de trabajo con la
-- fecha en que se entregó, no una jornada imposible. Con el tope en 24 había que
-- partir cada entregable en trozos y fechas inventadas, que es exactamente la
-- clase de dato que después nadie puede defender delante del cliente.
--
-- El cazafallos se conserva, solo que calibrado a lo que sí es imposible: nadie
-- carga un bloque de más de 160 horas contra un solo entregable dentro de una
-- fase de cinco meses. Eso sigue atrapando el cero de más en cualquier cifra
-- realista.
-- =============================================================================

alter table public.registros_horas
  drop constraint if exists registros_horas_horas_check;

alter table public.registros_horas
  add constraint registros_horas_horas_check
  check (horas > 0 and horas <= 160);

comment on column public.registros_horas.horas is
  'Horas de la partida. Una partida es un bloque de trabajo con la fecha en que '
  'se entregó, no una jornada: «el canal, 36 h» es una sola fila. El tope de 160 '
  'es cazafallos de tecleo, no un límite de negocio.';
