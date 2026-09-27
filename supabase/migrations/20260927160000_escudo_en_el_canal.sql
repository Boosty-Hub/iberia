-- =============================================================================
-- «Publicarlo en el canal»: el escudo de la lección 4, en el feed
-- =============================================================================
--
-- 27 de septiembre de 2026, a pedido de Gabriel. Debajo del escudo, el guion
-- ofrece «Publicarlo en el canal» o «Solo para mí», y hasta hoy los dos botones
-- hacían lo mismo: avanzar. Ahora el primero lo publica en el feed, en «Nuestra
-- gente», con el título «Este es el escudo que construí con Ajito».
--
-- Tres piezas, porque publicar en el feed es de pocos (`puede_publicar()`) y el
-- escudo vive en la carpeta privada de su dueño, que nadie más lee:
--
--  1. El bucket `canal`, para las imágenes del feed. Lo lee cualquiera con
--     sesión —es el feed—, y cada quien escribe solo en `escudos/<su empleado>/`.
--  2. `publicar_mi_escudo()`, `security definer` como la emisión del certificado:
--     publica **solo el escudo propio**, solo si el dibujo pasó el filtro, y una
--     vez —darle dos veces devuelve la misma publicación—.
--  3. `publicaciones.imagen_ruta` y `respuesta_id`: de dónde sale la imagen, y
--     de qué respuesta salió la publicación.
-- -----------------------------------------------------------------------------

alter table public.publicaciones
  add column if not exists imagen_ruta text,
  add column if not exists respuesta_id uuid references public.respuestas (id) on delete set null;

create unique index if not exists publicaciones_respuesta_unica
  on public.publicaciones (respuesta_id) where respuesta_id is not null;

comment on column public.publicaciones.imagen_ruta is
  'Ruta de la imagen en el bucket canal. La sirve /canal/publicacion/[id]/imagen con sesión.';
comment on column public.publicaciones.respuesta_id is
  'La respuesta del adiestramiento de la que salió: el escudo que alguien decidió publicar.';

-- --- 1) el bucket del feed -----------------------------------------------------

insert into storage.buckets (id, name, public)
values ('canal', 'canal', false)
on conflict (id) do nothing;

create policy "canal storage: lectura con sesion"
  on storage.objects for select to authenticated
  using (bucket_id = 'canal');

create policy "canal storage: mi escudo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'canal'
    and (storage.foldername(name))[1] = 'escudos'
    and (storage.foldername(name))[2] = public.mi_empleado()::text
  );

create policy "canal storage: reemplazo mi escudo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'canal'
    and (storage.foldername(name))[1] = 'escudos'
    and (storage.foldername(name))[2] = public.mi_empleado()::text
  );

create policy "canal storage: editores administran"
  on storage.objects for all to authenticated
  using (bucket_id = 'canal' and public.es_editor())
  with check (bucket_id = 'canal' and public.es_editor());

-- --- 2) publicar el escudo propio ------------------------------------------------

create or replace function public.publicar_mi_escudo(p_respuesta uuid, p_imagen_ruta text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := public.mi_empleado();
  r record;
  ya uuid;
  nueva uuid := gen_random_uuid();
begin
  if yo is null then
    raise exception 'Solo quien está en el padrón puede publicar su escudo';
  end if;

  select re.id, re.clave_paso, re.dibujo, re.dibujo_veredicto
    into r
    from public.respuestas re
    join public.matriculas m on m.id = re.matricula_id
   where re.id = p_respuesta and m.empleado_id = yo;

  if r.id is null then
    raise exception 'Ese escudo no es tuyo';
  end if;
  if r.clave_paso <> 'escudo' or r.dibujo is null or r.dibujo_veredicto is distinct from 'va' then
    raise exception 'Eso no es un escudo que se pueda publicar';
  end if;
  if p_imagen_ruta is null or p_imagen_ruta not like 'escudos/' || yo::text || '/%' then
    raise exception 'La imagen tiene que estar en tu carpeta de escudos';
  end if;

  -- Una vez por escudo: el segundo toque devuelve la publicación que ya existe.
  select id into ya from public.publicaciones where respuesta_id = p_respuesta;
  if ya is not null then
    return ya;
  end if;

  insert into public.publicaciones (
    id, tipo, titulo, imagen_ruta, imagen_url, audiencia, autor_id, estado,
    oficial, fijado, permite_comentarios, publicado_en, respuesta_id
  ) values (
    nueva, 'nuestra_gente', 'Este es el escudo que construí con Ajito', p_imagen_ruta,
    '/canal/publicacion/' || nueva::text || '/imagen', 'todos', yo, 'publicado',
    false, false, true, now(), p_respuesta
  );

  return nueva;
end;
$$;

revoke execute on function public.publicar_mi_escudo(uuid, text) from public, anon;
grant execute on function public.publicar_mi_escudo(uuid, text) to authenticated;
