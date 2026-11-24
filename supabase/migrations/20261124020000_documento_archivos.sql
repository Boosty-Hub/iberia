-- Los archivos de origen de cada documento, cargados (24-nov-2026, Gabriel: «que se puedan descargar y que al darle
-- clic abra el preview»).
--
-- Cada archivo del levantamiento (Procesos Iberia) se convierte a PDF optimizado —Word y Excel con Office, los PDF
-- recomprimidos— y se sube al bucket privado `documentos` como `pdf/<huella>.pdf`. Mientras el proyecto siga en el
-- plan gratis (1 GB de Storage), solo entran los PDF; los originales (.doc, .xls… unos 5,4 GB) quedan anotados en
-- `original_ruta = null` y se suben con el plan de pago, con el mismo script.
--
-- Estados:
--   disponible      el PDF está en el bucket.
--   pendiente_plan  convertido o convertible, espera el plan de pago (no cupo).
--   sin_conversion  formato que no se convierte a PDF (Visio, Publisher, InfoPath): sube el original con el plan.
--   retenido        el documento trae datos personales o credenciales: se sanea antes de subirlo.
--   falta           citado en el listado, pero el archivo no está en la copia del repositorio.
--
-- Quién ve: lo mismo que ve del documento. La política de `sgc.documento` ya cierra los perímetros sensibles, y las
-- de aquí y del bucket preguntan por el documento con la RLS de quien mira. Nadie escribe con su sesión: carga el
-- script con la clave de servicio.

create table if not exists sgc.documento_archivo (
  id              uuid primary key default gen_random_uuid(),
  documento_id    uuid not null references sgc.documento (id) on delete cascade,
  nombre          text not null,
  formato         text not null,
  huella          text not null,
  tamano_original bigint,
  estado          text not null check (estado in ('disponible', 'pendiente_plan', 'sin_conversion', 'retenido', 'falta')),
  pdf_ruta        text,
  pdf_tamano      bigint,
  paginas         integer,
  original_ruta   text,
  orden           integer not null default 0,
  actualizado_en  timestamptz not null default now(),
  unique (documento_id, huella),
  check (estado <> 'disponible' or pdf_ruta is not null)
);
create index if not exists documento_archivo_documento on sgc.documento_archivo (documento_id, orden);
create index if not exists documento_archivo_pdf on sgc.documento_archivo (pdf_ruta) where pdf_ruta is not null;
create index if not exists documento_archivo_original on sgc.documento_archivo (original_ruta) where original_ruta is not null;

alter table sgc.documento_archivo enable row level security;
grant select on sgc.documento_archivo to authenticated;
grant all on sgc.documento_archivo to service_role;

drop policy if exists "ver los archivos de los documentos" on sgc.documento_archivo;
create policy "ver los archivos de los documentos" on sgc.documento_archivo for select to authenticated
  using ((select public.puede('sistema:documentos', 'ver')) and exists (select 1 from sgc.documento d where d.id = documento_id));

-- El bucket: privado, con tope de 50 MB por archivo (el del plan gratis) y solo PDF hasta el plan de pago.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Se lee un objeto si es el PDF o el original de un archivo que quien mira puede ver (la RLS de
-- `sgc.documento_archivo` y la de `sgc.documento` corren con su sesión).
drop policy if exists "documentos: leer lo que se ve" on storage.objects;
create policy "documentos: leer lo que se ve" on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and exists (select 1 from sgc.documento_archivo a where a.pdf_ruta = storage.objects.name or a.original_ruta = storage.objects.name)
  );

-- Cuántos hay cargados, para la ficha y el resumen (con la RLS de quien mira).
comment on table sgc.documento_archivo is
  'Archivos de origen de cada documento del SGC: el PDF optimizado en el bucket documentos y, con el plan de pago, el original.';
