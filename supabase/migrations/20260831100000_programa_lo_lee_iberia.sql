-- =============================================================================
-- EL PROGRAMA · lo lee Iberia, no solo Boosty
--
-- La migración original cerró `hitos` y `registros_horas` a los editores, con
-- este razonamiento: «un lector de Iberia no ve lo que cuesta cada perfil ni
-- cuántas horas van consumidas: eso se le entrega en el reporte mensual,
-- redactado, no crudo».
--
-- **Eso cambió, y por decisión de Gabriel.** El módulo del programa es la vista
-- que Iberia abre para saber en qué se le está trabajando: qué horas se le han
-- dedicado, quién las dedicó y cómo va su calendario. Un reporte mensual en PDF
-- llega una vez al mes; la pregunta «¿en qué están?» aparece cualquier martes.
--
-- Lo que NO cambia es qué se le muestra. La reserva no estaba en el dato crudo
-- sino en dos cosas concretas, y esas se resuelven en la pantalla, no en la RLS:
--
--   · **La tarifa por perfil y el valor en dólares no se pintan.** El precio está
--     firmado en el contrato; un contador de dinero corriendo en pantalla no
--     informa, negocia.
--   · **El sobreconsumo no se pinta como alarma.** Las horas se administran como
--     promedio dentro de la fase (cláusula 8) y el riesgo de la implementación es
--     de Boosty (cláusula 5), así que un mes por encima es información, no un
--     problema del cliente. Se muestra la cifra; no se le pone un triángulo rojo.
--
-- Escribir sigue siendo solo de editores: Iberia lee su programa, no lo carga.
-- =============================================================================

drop policy if exists "editores leen hitos"  on public.hitos;
drop policy if exists "editores leen horas"  on public.registros_horas;

-- Mismo patrón que `entrevistas`, `hallazgos` y `archivos`: con sesión se lee.
create policy "con sesion se leen los hitos"
  on public.hitos for select to authenticated using (true);

create policy "con sesion se leen las horas"
  on public.registros_horas for select to authenticated using (true);

comment on table public.registros_horas is
  'Consumo de la bolsa de 107 h/mes de la cláusula 8. Se tarifa por perfil, no '
  'por persona: la misma persona puede cargar como perfiles distintos según lo '
  'que estuviera haciendo. Lo lee Iberia — la tarifa y el valor en dinero no se '
  'pintan en pantalla, viven en `lib/programa.ts`.';

comment on table public.hitos is
  'Lo que pasó en el programa y lo que está previsto. Lo lee Iberia, así que la '
  'descripción de cada hito se escribe para ese lector: lo interno va en '
  '`PENDIENTES.md`. Las sesiones del levantamiento no se repiten aquí: viven en '
  '`entrevistas` y la vista `linea_de_tiempo` las une.';
