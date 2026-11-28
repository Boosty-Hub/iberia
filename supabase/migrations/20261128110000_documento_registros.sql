-- Los registros de los documentos: los formatos LLENOS que trae el archivo de origen (28-nov-2026, Gabriel: «todo debe
-- estar transcrito en la plataforma y que tenga opción editable. El archivo es soporte para ver que en efecto sí está la
-- info en la plataforma»).
--
-- Un formato (por ejemplo II-01-40-001 Minuta de Reunión Gerencial) tiene su texto —la plantilla— en
-- `sgc.documento_version`; cada minuta llena que aparece entre sus archivos es un REGISTRO del proceso y va aquí,
-- transcrita por secciones y bloques, con el archivo del que salió. Se puede corregir (decisión de Gabriel: editable); toda
-- corrección queda en la auditoría con el valor anterior (`control.auditar`), así que nada se pierde.

create table if not exists sgc.documento_registro (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references sgc.documento (id) on delete cascade,
  titulo        text not null,
  fecha         date,
  contenido     jsonb not null default '{"secciones": []}'::jsonb,
  archivo_ruta  text,
  origen        text not null default 'transcripcion' check (origen in ('transcripcion', 'captura')),
  nota          text,
  creado_por    uuid default auth.uid() references public.profiles (id),
  creado_en     timestamptz not null default now(),
  editado_por   uuid references public.profiles (id),
  editado_en    timestamptz,
  unique (documento_id, archivo_ruta)
);
create index if not exists documento_registro_documento on sgc.documento_registro (documento_id, fecha desc);
alter table sgc.documento_registro enable row level security;
grant select on sgc.documento_registro to authenticated;
grant all on sgc.documento_registro to service_role;
drop policy if exists "ver registros de documentos" on sgc.documento_registro;
create policy "ver registros de documentos" on sgc.documento_registro for select to authenticated
  using ((select public.puede('sistema:documentos', 'ver')) and exists (select 1 from sgc.documento d where d.id = documento_id));
drop trigger if exists auditar on sgc.documento_registro;
create trigger auditar after insert or update or delete on sgc.documento_registro
  for each row execute function control.auditar();

-- Corrige una sección de un registro. La versión anterior queda en la auditoría.
create or replace function sgc.editar_registro(p_id uuid, p_seccion integer, p_titulo text, p_bloques jsonb)
returns void
language plpgsql security definer set search_path = sgc, public as $$
declare
  r sgc.documento_registro;
  v_secs jsonb;
begin
  if not public.puede('sistema:documentos', 'editar') then
    raise exception 'Sin permiso para editar documentos' using errcode = 'insufficient_privilege';
  end if;
  select * into r from sgc.documento_registro where id = p_id for update;
  if not found then raise exception 'El registro no existe'; end if;
  if not exists (select 1 from sgc.documento where id = r.documento_id) then raise exception 'El registro no existe'; end if;
  if jsonb_typeof(p_bloques) <> 'array' then raise exception 'La sección viene mal formada'; end if;
  v_secs := coalesce(r.contenido -> 'secciones', '[]'::jsonb);
  if p_seccion is null or p_seccion < 0 or p_seccion >= jsonb_array_length(v_secs) then
    v_secs := v_secs || jsonb_build_array(jsonb_build_object('titulo', p_titulo, 'bloques', p_bloques));
  else
    v_secs := jsonb_set(v_secs, array[p_seccion::text], jsonb_build_object('titulo', coalesce(p_titulo, v_secs -> p_seccion ->> 'titulo'), 'bloques', p_bloques));
  end if;
  update sgc.documento_registro
     set contenido = jsonb_set(contenido, '{secciones}', v_secs), editado_por = auth.uid(), editado_en = now()
   where id = p_id;
end;
$$;
grant execute on function sgc.editar_registro(uuid, integer, text, jsonb) to authenticated;
