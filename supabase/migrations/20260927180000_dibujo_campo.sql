-- =============================================================================
-- La pregunta de campo de la lección 4 también se dibuja
-- =============================================================================
--
-- 27 de septiembre de 2026, a pedido de Gabriel. La pregunta de cierre de «Ajito
-- dibuja» es «¿hay algo en tu trabajo que sería más fácil de explicar con un
-- dibujo?», y lo natural es que Ajito lo dibuje. Pero no es un pedido de dibujo:
-- es lo que la persona sabe de su puesto. Así que el dibujo es un extra, y hay un
-- veredicto que en los otros dos ejercicios no hacía falta: `nada`, que la
-- respuesta no describe nada que se pueda dibujar —«no se me ocurre»—. Entonces
-- Ajito contesta la pregunta sin dibujo, y sin la negativa del guion.
-- -----------------------------------------------------------------------------

alter table public.respuestas drop constraint if exists respuestas_dibujo_veredicto_check;
alter table public.respuestas
  add constraint respuestas_dibujo_veredicto_check
  check (dibujo_veredicto is null or dibujo_veredicto in ('va', 'persona', 'no_va', 'nada'));
