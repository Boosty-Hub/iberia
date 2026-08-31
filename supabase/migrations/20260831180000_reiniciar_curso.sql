-- =============================================================================
-- REINICIAR EL CURSO · las políticas de borrado que faltaban
--
-- El adiestramiento se escribió para avanzar, nunca para retroceder: `avances`,
-- `respuestas` y `certificados` tienen políticas de SELECT, INSERT y UPDATE, y
-- **ninguna de DELETE**. Eso está bien para el alumno —nadie debe poder borrarle
-- el avance a nadie, ni el suyo— pero deja al equipo consultor sin forma de
-- volver a recorrer una lección más que entrando a la base a mano.
--
-- ⚠️ Y fallaba en silencio, que es lo peor. Sin política de DELETE, Postgres no
-- da error: filtra las filas y `delete()` devuelve cero afectadas. El botón de
-- reiniciar decía «curso reiniciado» y los avances seguían ahí.
--
-- Solo editores. Un `delete` de estas tablas borra el trabajo de una persona: el
-- audio que grabó, la foto que mandó, el certificado que se ganó. La cláusula 5
-- del contrato hace de ese material la base del informe.
--
-- El certificado ya tenía su propia guarda contra la falsificación —solo lo
-- emite `emitir_mi_certificado()`, `security definer`, que comprueba las nueve
-- lecciones—. Poder borrarlo no la toca: para volver a tenerlo hay que volver a
-- completar el curso.
-- =============================================================================

create policy "editores borran avances"
  on public.avances for delete to authenticated
  using (public.es_editor());

create policy "editores borran respuestas"
  on public.respuestas for delete to authenticated
  using (public.es_editor());

create policy "editores borran certificados"
  on public.certificados for delete to authenticated
  using (public.es_editor());
