-- =============================================================================
-- Adiestramiento · bucket para lo que manda la gente
--
-- Las notas de voz y las fotos de los ejercicios van aparte de los audios de
-- Ajito, y con reglas distintas. Los audios de las lecciones los oye cualquiera
-- con matrícula; **una nota de voz la oye quien la grabó, y nadie más**.
--
-- Esa es la promesa de la lección 0 —«tu supervisor no lo lee»— llevada al
-- almacenamiento. La tabla `respuestas` ya la cumple; sin esto, el archivo se
-- quedaba fuera: cualquiera con sesión podía bajarse la foto de otro si daba
-- con la ruta. Adivinar un UUID es difícil, pero «difícil de adivinar» no es un
-- permiso.
--
-- La ruta lleva el dueño dentro y la política lo comprueba:
--
--     respuestas/{empleado_id}/{leccion}/{clave}-{marca}.webm
--                 └── (storage.foldername(name))[2]
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('adiestramiento-respuestas', 'adiestramiento-respuestas', false)
on conflict (id) do nothing;

-- Cada quien escribe bajo su propia carpeta y no bajo la de otro.
create policy "respuestas media: subo lo mio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'adiestramiento-respuestas'
    and (storage.foldername(name))[1] = 'respuestas'
    and (storage.foldername(name))[2] = public.mi_empleado()::text
  );

create policy "respuestas media: leo lo mio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'adiestramiento-respuestas'
    and (storage.foldername(name))[2] = public.mi_empleado()::text
  );

-- Los editores de Boosty leen todo: de ahí sale el material del informe. Es la
-- misma excepción que ya tiene la tabla `respuestas`, ni una más.
create policy "respuestas media: editores"
  on storage.objects for all to authenticated
  using (bucket_id = 'adiestramiento-respuestas' and public.es_editor())
  with check (bucket_id = 'adiestramiento-respuestas' and public.es_editor());
