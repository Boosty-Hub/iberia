-- =============================================================================
-- Adiestramiento · bucket privado para la voz de Ajito
--
-- Los 70 audios de las lecciones son material de Iberia como todo lo demás:
-- bucket privado, nada servido por URL pública. La aplicación los entrega por
-- `/canal/adiestramiento/[numero]/audio/[pieza]`, que exige sesión, comprueba
-- que quien pide tenga matrícula y firma un enlace de 60 segundos.
--
-- La diferencia con el bucket de `archivos`: aquí **cualquiera con sesión de
-- empleado lee**, no solo los editores. Es el curso — si no lo puede oír la
-- operadora de envasado, no sirve de nada. Escribir sigue siendo cosa de
-- editores: los audios se suben desde `scripts/subir-audios.mjs`.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('adiestramiento', 'adiestramiento', false)
on conflict (id) do nothing;

create policy "adiestramiento storage: lectura con sesion"
  on storage.objects for select to authenticated
  using (bucket_id = 'adiestramiento');

create policy "adiestramiento storage: editores suben"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'adiestramiento' and public.es_editor());

create policy "adiestramiento storage: editores actualizan"
  on storage.objects for update to authenticated
  using (bucket_id = 'adiestramiento' and public.es_editor());

create policy "adiestramiento storage: editores borran"
  on storage.objects for delete to authenticated
  using (bucket_id = 'adiestramiento' and public.es_editor());
