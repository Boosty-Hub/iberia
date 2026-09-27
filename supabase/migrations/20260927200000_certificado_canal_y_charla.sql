-- =============================================================================
-- El certificado en el canal, y la conversación libre con Ajito
-- =============================================================================
--
-- 27 de septiembre de 2026, a pedido de Gabriel. Dos cosas del cierre del curso:
--
--  1. **El certificado se publica en el feed**, como el escudo de la lección 4:
--     «Terminé el curso de Ajito y este es mi certificado», en «Nuestra gente».
--     Lo decide la persona con un botón debajo de su certificado. La imagen que se
--     publica **no lleva la cédula**: el feed lo leen las doscientas personas de
--     Iberia, y la cédula es de quien la tiene, no del canal.
--
--  2. **«Preguntarle algo a Ajito» abre una conversación de verdad.** Con
--     `asistente_libre_activo` encendido, la lección 8 se despide con «yo me quedo
--     aquí contigo» y ese botón. Hasta hoy el botón cerraba la lección y ya: no
--     había a dónde ir. Ahora abre un chat con Ajito, con varias conversaciones,
--     y lo que se habla se guarda como las respuestas del curso — lo lee quien lo
--     escribió y los editores de Boosty, nadie más.
-- -----------------------------------------------------------------------------

-- --- 1) el certificado en el feed ------------------------------------------------

alter table public.publicaciones
  add column if not exists certificado_id uuid references public.certificados (id) on delete set null;

create unique index if not exists publicaciones_certificado_unico
  on public.publicaciones (certificado_id) where certificado_id is not null;

comment on column public.publicaciones.certificado_id is
  'El certificado del curso de Ajito que alguien decidió publicar. Uno por certificado.';

-- La copia que se publica va en la carpeta del dueño, como el escudo.
create policy "canal storage: mi certificado"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'canal'
    and (storage.foldername(name))[1] = 'certificados'
    and (storage.foldername(name))[2] = public.mi_empleado()::text
  );

create policy "canal storage: reemplazo mi certificado"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'canal'
    and (storage.foldername(name))[1] = 'certificados'
    and (storage.foldername(name))[2] = public.mi_empleado()::text
  );

-- `security definer` como `publicar_mi_escudo`: publicar en el feed es de pocos
-- (`puede_publicar()`), así que esto publica **solo el certificado propio**, una
-- vez —darle dos veces devuelve la misma publicación—.
create or replace function public.publicar_mi_certificado(p_imagen_ruta text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := public.mi_empleado();
  cert uuid;
  ya uuid;
  nueva uuid := gen_random_uuid();
begin
  if yo is null then
    raise exception 'Solo quien está en el padrón puede publicar su certificado';
  end if;

  select c.id into cert
    from public.certificados c
    join public.matriculas m on m.id = c.matricula_id
   where m.empleado_id = yo
   order by c.emitido_en desc
   limit 1;

  if cert is null then
    raise exception 'Todavía no tienes certificado';
  end if;
  if p_imagen_ruta is null or p_imagen_ruta not like 'certificados/' || yo::text || '/%' then
    raise exception 'La imagen tiene que estar en tu carpeta de certificados';
  end if;

  select id into ya from public.publicaciones where certificado_id = cert;
  if ya is not null then
    return ya;
  end if;

  insert into public.publicaciones (
    id, tipo, titulo, imagen_ruta, imagen_url, audiencia, autor_id, estado,
    oficial, fijado, permite_comentarios, publicado_en, certificado_id
  ) values (
    nueva, 'nuestra_gente', 'Terminé el curso de Ajito y este es mi certificado', p_imagen_ruta,
    '/canal/publicacion/' || nueva::text || '/imagen', 'todos', yo, 'publicado',
    false, false, true, now(), cert
  );

  return nueva;
end;
$$;

revoke execute on function public.publicar_mi_certificado(text) from public, anon;
grant execute on function public.publicar_mi_certificado(text) to authenticated;

-- --- 2) la conversación libre con Ajito ------------------------------------------

create table if not exists public.charlas_ajito (
  id            uuid primary key default gen_random_uuid(),
  matricula_id  uuid not null references public.matriculas (id) on delete cascade,
  -- Lo primero que se le dijo, recortado: es como se encuentra después en la lista.
  titulo        text not null default 'Conversación con Ajito',
  created_at    timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

create index if not exists charlas_ajito_matricula
  on public.charlas_ajito (matricula_id, actualizada_en desc);

comment on table public.charlas_ajito is
  'Las conversaciones libres con Ajito, después del curso (asistente_libre_activo). '
  'Las lee su autor y los editores, como las respuestas del curso.';

create table if not exists public.charla_mensajes (
  id            uuid primary key default gen_random_uuid(),
  charla_id     uuid not null references public.charlas_ajito (id) on delete cascade,
  -- Repetida de la charla para que la política no tenga que pasar por otra tabla.
  matricula_id  uuid not null references public.matriculas (id) on delete cascade,
  de            text not null check (de in ('persona', 'ajito')),
  texto         text,
  entrada       text not null default 'texto' check (entrada in ('texto', 'voz', 'foto')),
  -- De la persona: su foto o su nota de voz. De Ajito: el dibujo que hizo.
  media_url     text,
  -- Ajito: el audio de lo que contestó, en el bucket privado.
  audio         text,
  -- La persona pidió un dibujo: qué pidió (lo decide el modelo) y qué dijo el
  -- filtro. Con esto la respuesta se arma en tres peticiones sin perder el hilo.
  pedido_dibujo text,
  dibujo_veredicto text check (dibujo_veredicto in ('va', 'persona', 'no_va')),
  -- Se le pidió respuesta a Ajito y no salió: fecha sin mensaje de Ajito detrás.
  fallo_en      timestamptz,
  created_at    timestamptz not null default now(),
  check (texto is not null or media_url is not null)
);

create index if not exists charla_mensajes_charla
  on public.charla_mensajes (charla_id, created_at);
create index if not exists charla_mensajes_tope
  on public.charla_mensajes (matricula_id, created_at) where de = 'persona';

alter table public.charlas_ajito enable row level security;
alter table public.charla_mensajes enable row level security;

-- Lo propio, con `matricula_mia()` como las respuestas: sin pasar otra vez por la
-- RLS de matrículas. Los mensajes de Ajito también los escribe la sesión de la
-- persona —la ruta que llama al modelo corre con su sesión—: quien quisiera
-- inventarse uno solo se lo estaría diciendo a sí mismo.
create policy "mis charlas" on public.charlas_ajito
  for select to authenticated
  using (public.matricula_mia(matricula_id) or public.es_editor());

create policy "abro charla" on public.charlas_ajito
  for insert to authenticated
  with check (public.matricula_mia(matricula_id));

create policy "renombro mi charla" on public.charlas_ajito
  for update to authenticated
  using (public.matricula_mia(matricula_id))
  with check (public.matricula_mia(matricula_id));

create policy "borro mi charla" on public.charlas_ajito
  for delete to authenticated
  using (public.matricula_mia(matricula_id));

create policy "editores charlas" on public.charlas_ajito
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

create policy "mis mensajes con ajito" on public.charla_mensajes
  for select to authenticated
  using (public.matricula_mia(matricula_id) or public.es_editor());

-- Y la charla tiene que ser la suya, de la misma matrícula: sin esto se podía
-- colgar un mensaje de la charla de otro sabiendo su id.
create policy "escribo en mi charla" on public.charla_mensajes
  for insert to authenticated
  with check (
    public.matricula_mia(matricula_id)
    and exists (
      select 1 from public.charlas_ajito c
       where c.id = charla_id and c.matricula_id = charla_mensajes.matricula_id
    )
  );

create policy "completo mi mensaje" on public.charla_mensajes
  for update to authenticated
  using (public.matricula_mia(matricula_id))
  with check (public.matricula_mia(matricula_id));

create policy "editores mensajes con ajito" on public.charla_mensajes
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());
