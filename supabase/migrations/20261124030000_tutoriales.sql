-- Los videos tutoriales de los módulos (24-nov-2026, Gabriel: «un botón arriba que diga ver tutorial y se abra un
-- popup», en todas las pestañas de Organización y autoridad y de Procesos).
--
-- Un tutorial por pestaña, por su ruta (`/sistema/nucleo/organizacion/plazas`). El video (mp4) y su póster viven en
-- el bucket privado `tutoriales`; los graba `scripts/plataforma/tutoriales/grabar.mjs` con la app real contra el
-- proyecto de PRUEBAS. Se ve con el mismo permiso que la pestaña (`recurso`): el tutorial de Costos muestra cifras
-- del perímetro de nómina, y el de Requisiciones, su flujo.

create table if not exists ui.tutorial (
  ruta           text primary key,
  modulo         text not null,
  titulo         text not null,
  descripcion    text,
  recurso        text not null,
  archivo        text not null,
  poster         text,
  duracion_seg   integer,
  orden          integer not null default 0,
  actualizado_en timestamptz not null default now()
);

alter table ui.tutorial enable row level security;
grant select on ui.tutorial to authenticated;
grant all on ui.tutorial to service_role;

drop policy if exists "ver los tutoriales que se pueden abrir" on ui.tutorial;
create policy "ver los tutoriales que se pueden abrir" on ui.tutorial for select to authenticated
  using ((select public.puede(recurso, 'ver')) or (select public.puede(recurso, 'crear')));

insert into storage.buckets (id, name, public, file_size_limit)
values ('tutoriales', 'tutoriales', false, 52428800)
on conflict (id) do update set public = false;

-- El video y el póster se leen si quien mira puede abrir el tutorial (la RLS de `ui.tutorial` corre con su sesión).
drop policy if exists "tutoriales: leer lo que se puede abrir" on storage.objects;
create policy "tutoriales: leer lo que se puede abrir" on storage.objects for select to authenticated
  using (
    bucket_id = 'tutoriales'
    and exists (select 1 from ui.tutorial t where t.archivo = storage.objects.name or t.poster = storage.objects.name)
  );
