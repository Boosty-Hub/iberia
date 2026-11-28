-- Los documentos del SGC viven en la plataforma (27-nov-2026, Gabriel por Telegram: «que la información de los documentos
-- esté dentro del aplicativo… que la edición se dé dentro de la plataforma… que se vean las versiones»).
--
-- Decisiones de Gabriel:
--   · Manda el mapa del informe (1.1–3.8); el código II-XX-YY-NNN queda como código del documento.
--   · Se transcriben los vigentes y sus versiones anteriores.
--   · Aprueban el dueño del proceso y Gestión de la Calidad.
--   · Se trabaja macroproceso por macroproceso.
--
-- Dos piezas:
--   1. `sgc.documento_proceso`: a qué proceso va cada documento. La revisión de los 1.307 documentos (lectura por
--      dentro, 27-nov) deja cada enlace como «sugerido»; quien edita procesos lo confirma, lo cambia o lo descarta. Un
--      documento tiene un proceso principal y puede «aplicar también» en otros.
--   2. `sgc.documento_version`: el texto del documento por secciones y bloques (párrafo, lista, tabla, paso, decisión,
--      referencia). Ciclo: transcripción (lo pasó la IA o una persona desde el original, por validar) → borrador →
--      en revisión → vigente → reemplazada. Las versiones anteriores halladas en los archivos entran como «histórica».
--      Una sola vigente por documento. Toda vigente pasa por la ruta «Documento del SGC»: dueño del proceso y Gestión
--      de la Calidad; quien la escribió no la aprueba (regla del flujo).
--
-- Quién ve: lo que ve del documento (la política de `sgc.documento` cierra los perímetros). Nadie escribe directo: todo
-- entra por las funciones de abajo, o por el script de carga con la clave de servicio.

-- ── 1 · Enlaces documento ↔ proceso ──────────────────────────────────────────

create table if not exists sgc.documento_proceso (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references sgc.documento (id) on delete cascade,
  proceso_ref   uuid not null,
  rol           text not null default 'principal' check (rol in ('principal', 'tambien')),
  estado        text not null default 'sugerido' check (estado in ('sugerido', 'confirmado', 'descartado')),
  confianza     text check (confianza in ('alta', 'media', 'baja')),
  razon         text,
  origen        text not null default 'revision',
  decidido_por  uuid references public.profiles (id),
  decidido_en   timestamptz,
  creado_en     timestamptz not null default now(),
  unique (documento_id, proceso_ref)
);
create index if not exists documento_proceso_proceso on sgc.documento_proceso (proceso_ref) where estado <> 'descartado';
create unique index if not exists documento_proceso_un_principal on sgc.documento_proceso (documento_id)
  where rol = 'principal' and estado <> 'descartado';
alter table sgc.documento_proceso enable row level security;
grant select on sgc.documento_proceso to authenticated;
grant all on sgc.documento_proceso to service_role;
drop policy if exists "ver enlaces de documentos" on sgc.documento_proceso;
create policy "ver enlaces de documentos" on sgc.documento_proceso for select to authenticated
  using ((select public.puede('sistema:documentos', 'ver')) and exists (select 1 from sgc.documento d where d.id = documento_id));
drop trigger if exists auditar on sgc.documento_proceso;
create trigger auditar after insert or update or delete on sgc.documento_proceso
  for each row execute function control.auditar();

-- Confirma un enlace (y, si viene `p_proceso`, lo mueve a ese proceso). Al confirmar el principal, `sgc.documento`
-- queda apuntando a ese proceso, para que el resto de la plataforma (biblioteca, asistente) lo vea igual.
create or replace function sgc.confirmar_enlace(p_id uuid, p_proceso uuid default null)
returns void
language plpgsql security definer set search_path = sgc, public as $$
declare
  e sgc.documento_proceso;
begin
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Sin permiso para editar procesos' using errcode = 'insufficient_privilege';
  end if;
  select * into e from sgc.documento_proceso where id = p_id for update;
  if not found then raise exception 'El enlace no existe'; end if;
  if p_proceso is not null and p_proceso <> e.proceso_ref then
    if not exists (select 1 from sgc.proceso where ref = p_proceso and escenario_id is null and estado = 'vigente') then
      raise exception 'El proceso no existe o no está vigente';
    end if;
    delete from sgc.documento_proceso where documento_id = e.documento_id and proceso_ref = p_proceso and id <> e.id;
    update sgc.documento_proceso set proceso_ref = p_proceso where id = p_id;
  end if;
  update sgc.documento_proceso set estado = 'confirmado', decidido_por = auth.uid(), decidido_en = now() where id = p_id;
  if e.rol = 'principal' then
    update sgc.documento set proceso_ref = coalesce(p_proceso, e.proceso_ref) where id = e.documento_id;
  end if;
end;
$$;

create or replace function sgc.descartar_enlace(p_id uuid)
returns void
language plpgsql security definer set search_path = sgc, public as $$
begin
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Sin permiso para editar procesos' using errcode = 'insufficient_privilege';
  end if;
  update sgc.documento_proceso set estado = 'descartado', decidido_por = auth.uid(), decidido_en = now() where id = p_id;
end;
$$;

-- Confirma de una vez los enlaces sugeridos de un proceso.
create or replace function sgc.confirmar_enlaces_proceso(p_proceso uuid)
returns integer
language plpgsql security definer set search_path = sgc, public as $$
declare
  n integer := 0;
  e record;
begin
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Sin permiso para editar procesos' using errcode = 'insufficient_privilege';
  end if;
  for e in select id from sgc.documento_proceso where proceso_ref = p_proceso and estado = 'sugerido' loop
    perform sgc.confirmar_enlace(e.id, null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ── 2 · El texto del documento, por versiones ────────────────────────────────

create table if not exists sgc.documento_version (
  id            uuid primary key default gen_random_uuid(),
  documento_id  uuid not null references sgc.documento (id) on delete cascade,
  numero        integer not null,
  etiqueta      text,                 -- «Actualización 2024», «Rev. 0 firmada»…
  fecha         date,                 -- fecha de la versión según el documento (actualización)
  estado        text not null check (estado in ('transcripcion', 'historica', 'borrador', 'en_revision', 'vigente', 'reemplazada')),
  -- { "control": {"elaboro","reviso","aprobo","elaboracion","actualizacion","version_original"},
  --   "secciones": [ {"titulo", "bloques": [ {"tipo":"parrafo","texto"} | {"tipo":"lista","items"} |
  --                   {"tipo":"tabla","filas"} | {"tipo":"paso","responsable","actividad"} |
  --                   {"tipo":"decision","pregunta","si","no"} | {"tipo":"referencia","codigo","titulo"} ] } ] }
  contenido     jsonb not null default '{"secciones": []}'::jsonb,
  origen        text not null default 'edicion' check (origen in ('transcripcion', 'edicion')),
  archivo_ruta  text,                 -- el archivo del levantamiento del que salió la transcripción
  motivo        text,                 -- por qué se cambió (lo pide la revisión)
  creado_por    uuid default auth.uid() references public.profiles (id),
  creado_en     timestamptz not null default now(),
  vigente_desde date,
  reemplazada_en date,
  unique (documento_id, numero)
);
create index if not exists documento_version_documento on sgc.documento_version (documento_id, numero desc);
create unique index if not exists documento_version_una_vigente on sgc.documento_version (documento_id) where estado = 'vigente';
create unique index if not exists documento_version_un_borrador on sgc.documento_version (documento_id)
  where estado in ('borrador', 'en_revision');
alter table sgc.documento_version enable row level security;
grant select on sgc.documento_version to authenticated;
grant all on sgc.documento_version to service_role;
drop policy if exists "ver versiones de documentos" on sgc.documento_version;
create policy "ver versiones de documentos" on sgc.documento_version for select to authenticated
  using ((select public.puede('sistema:documentos', 'ver')) and exists (select 1 from sgc.documento d where d.id = documento_id)
         and (estado not in ('borrador') or creado_por = (select auth.uid()) or (select public.puede('sistema:cambios', 'editar'))));
drop trigger if exists auditar on sgc.documento_version;
create trigger auditar after insert or update or delete on sgc.documento_version
  for each row execute function control.auditar();

-- Guarda una sección en el borrador de quien edita. Si no hay borrador, lo abre copiando la vigente (o, si aún no hay
-- vigente, la transcripción). Una sección nueva va con p_seccion = -1.
create or replace function sgc.guardar_seccion_documento(p_documento uuid, p_seccion integer, p_titulo text, p_bloques jsonb, p_motivo text default null)
returns uuid
language plpgsql security definer set search_path = sgc, public as $$
declare
  b sgc.documento_version;
  base sgc.documento_version;
  v_secs jsonb;
begin
  if not public.puede('sistema:documentos', 'editar') then
    raise exception 'Sin permiso para editar documentos' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from sgc.documento where id = p_documento) then raise exception 'El documento no existe'; end if;
  if jsonb_typeof(p_bloques) <> 'array' then raise exception 'La sección viene mal formada'; end if;
  select * into b from sgc.documento_version where documento_id = p_documento and estado in ('borrador', 'en_revision') for update;
  if found and b.estado = 'en_revision' then
    raise exception 'Hay una versión en revisión: espera a que se apruebe o se devuelva';
  end if;
  if found and b.creado_por is distinct from auth.uid() then
    raise exception 'Otra persona tiene un borrador abierto de este documento';
  end if;
  if not found then
    select * into base from sgc.documento_version where documento_id = p_documento and estado = 'vigente';
    if not found then
      select * into base from sgc.documento_version where documento_id = p_documento and estado = 'transcripcion' order by numero desc limit 1;
    end if;
    insert into sgc.documento_version (documento_id, numero, etiqueta, fecha, estado, contenido, origen, motivo, creado_por)
    values (p_documento, coalesce((select max(numero) from sgc.documento_version where documento_id = p_documento), 0) + 1,
            null, current_date, 'borrador', coalesce(base.contenido, '{"secciones": []}'::jsonb), 'edicion', p_motivo, auth.uid())
    returning * into b;
  end if;
  v_secs := coalesce(b.contenido -> 'secciones', '[]'::jsonb);
  if p_seccion is null or p_seccion < 0 or p_seccion >= jsonb_array_length(v_secs) then
    v_secs := v_secs || jsonb_build_array(jsonb_build_object('titulo', p_titulo, 'bloques', p_bloques));
  else
    v_secs := jsonb_set(v_secs, array[p_seccion::text], jsonb_build_object('titulo', coalesce(p_titulo, v_secs -> p_seccion ->> 'titulo'), 'bloques', p_bloques));
  end if;
  update sgc.documento_version
     set contenido = jsonb_set(contenido, '{secciones}', v_secs), motivo = coalesce(p_motivo, motivo)
   where id = b.id;
  return b.id;
end;
$$;

create or replace function sgc.descartar_borrador_documento(p_version uuid)
returns void
language plpgsql security definer set search_path = sgc, public as $$
begin
  delete from sgc.documento_version where id = p_version and estado = 'borrador' and creado_por = auth.uid();
  if not found then raise exception 'Solo se descarta tu propio borrador'; end if;
end;
$$;

-- Envía a revisión: un borrador propio, o una transcripción (la primera versión validada de un documento).
create or replace function sgc.enviar_documento(p_version uuid, p_motivo text default null)
returns uuid
language plpgsql security definer set search_path = sgc, flujo, org, public as $$
declare
  v sgc.documento_version;
  d sgc.documento;
  v_unidad uuid;
begin
  if not public.puede('sistema:documentos', 'editar') then
    raise exception 'Sin permiso para editar documentos' using errcode = 'insufficient_privilege';
  end if;
  select * into v from sgc.documento_version where id = p_version for update;
  if not found then raise exception 'La versión no existe'; end if;
  if v.estado = 'borrador' and v.creado_por is distinct from auth.uid() then raise exception 'Solo envías tu propio borrador'; end if;
  if v.estado not in ('borrador', 'transcripcion') then raise exception 'Solo se envía un borrador o una transcripción'; end if;
  if exists (select 1 from sgc.documento_version where documento_id = v.documento_id and estado = 'en_revision') then
    raise exception 'Ya hay una versión de este documento en revisión';
  end if;
  if v.estado = 'transcripcion' then
    -- La transcripción pasa a borrador de quien la envía, para que el flujo la trate como cualquier cambio.
    if exists (select 1 from sgc.documento_version where documento_id = v.documento_id and estado = 'borrador') then
      raise exception 'Hay un borrador abierto de este documento: envíalo o descártalo primero';
    end if;
  end if;
  select * into d from sgc.documento where id = v.documento_id;
  select pl.unidad_ref into v_unidad
    from sgc.proceso p join org.plaza pl on pl.ref = p.dueno_plaza_ref and pl.escenario_id is null
   where p.ref = d.proceso_ref and p.escenario_id is null and p.estado = 'vigente' limit 1;
  update sgc.documento_version set estado = 'en_revision', motivo = coalesce(p_motivo, motivo),
         creado_por = case when estado = 'transcripcion' then auth.uid() else creado_por end
   where id = p_version;
  return flujo.iniciar('documento_version', p_version, format('%s %s · versión %s', d.codigo, d.titulo, v.numero), v_unidad, '{}');
end;
$$;

-- Publica (lo llama el flujo al aprobarse): la nueva queda vigente y la anterior, reemplazada.
create or replace function sgc.publicar_documento_version(p_id uuid)
returns void
language plpgsql security definer set search_path = sgc, public as $$
declare
  v sgc.documento_version;
begin
  select * into v from sgc.documento_version where id = p_id;
  update sgc.documento_version set estado = 'reemplazada', reemplazada_en = current_date
   where documento_id = v.documento_id and estado = 'vigente';
  -- Las transcripciones que quedaron sin enviar de ese documento ya no hacen falta: pasan a históricas.
  update sgc.documento_version set estado = 'historica' where documento_id = v.documento_id and estado = 'transcripcion';
  update sgc.documento_version set estado = 'vigente', vigente_desde = current_date where id = p_id;
  update sgc.documento set estado = 'vigente', fecha = current_date where id = v.documento_id;
end;
$$;

revoke execute on function sgc.publicar_documento_version(uuid) from public, anon, authenticated;
grant execute on function sgc.confirmar_enlace(uuid, uuid) to authenticated;
grant execute on function sgc.descartar_enlace(uuid) to authenticated;
grant execute on function sgc.confirmar_enlaces_proceso(uuid) to authenticated;
grant execute on function sgc.guardar_seccion_documento(uuid, integer, text, jsonb, text) to authenticated;
grant execute on function sgc.descartar_borrador_documento(uuid) to authenticated;
grant execute on function sgc.enviar_documento(uuid, text) to authenticated;

-- ── 3 · El flujo: autor, decisión y ruta ─────────────────────────────────────

CREATE OR REPLACE FUNCTION privado.autor_de_solicitud(p_tipo text, p_objeto uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'org', 'sgc', 'ia', 'public'
AS $function$
  select case p_tipo
    when 'requisicion_personal' then (select creado_por from org.requisicion where id = p_objeto)
    when 'escenario_estructura' then (select creado_por from org.escenario where id = p_objeto)
    when 'escenario_procesos' then (select creado_por from org.escenario where id = p_objeto)
    when 'cambios' then (select creado_por from org.escenario where id = p_objeto)
    when 'proceso' then (select creado_por from sgc.proceso where id = p_objeto)
    when 'nivel_ia' then (select pedido_por from ia.cambio_nivel where id = p_objeto)
    when 'documento_version' then (select creado_por from sgc.documento_version where id = p_objeto)
  end;
$function$;

CREATE OR REPLACE FUNCTION flujo.al_decidir(p_tipo text, p_objeto uuid, p_accion text, p_hito boolean, p_decision text, p_estado_solicitud text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'flujo', 'org', 'sgc', 'public'
AS $function$
begin
  perform set_config('flujo.aplicando', 'on', true);
  if p_tipo = 'requisicion_personal' then
    if p_decision = 'rechazado' then
      update org.requisicion set estado = 'rechazada' where id = p_objeto;
    elsif p_decision = 'devuelto' then
      update org.requisicion set estado = 'devuelta' where id = p_objeto;
    elsif p_hito then
      update org.requisicion set estado = 'aprobada' where id = p_objeto;
      perform org.aplicar_requisicion(p_objeto);
    elsif p_accion = 'recibir' then
      update org.requisicion set estado = 'en_seleccion' where id = p_objeto;
    end if;
  elsif p_tipo = 'proceso' then
    if p_decision = 'rechazado' or p_decision = 'devuelto' then
      update sgc.proceso set estado = 'borrador' where id = p_objeto and estado = 'en_revision';
    elsif p_estado_solicitud = 'aprobada' then
      perform sgc.publicar_proceso(p_objeto);
    end if;
  elsif p_tipo = 'escenario_estructura' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform org.publicar_escenario(p_objeto);
    end if;
  elsif p_tipo = 'escenario_procesos' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform sgc.publicar_escenario_procesos(p_objeto);
    end if;
  elsif p_tipo = 'cambios' then
    if p_decision = 'rechazado' then
      update org.escenario set estado = 'descartado' where id = p_objeto;
    elsif p_decision = 'devuelto' then
      perform org.devolver_cambios(p_objeto);
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform org.publicar_cambios(p_objeto);
    end if;
  elsif p_tipo = 'nivel_ia' then
    perform ia.al_decidir_nivel(p_objeto, p_decision, p_estado_solicitud);
  elsif p_tipo = 'documento_version' then
    if p_decision in ('rechazado', 'devuelto') then
      update sgc.documento_version set estado = 'borrador' where id = p_objeto and estado = 'en_revision';
    elsif p_estado_solicitud = 'aprobada' then
      perform sgc.publicar_documento_version(p_objeto);
    end if;
  end if;
end;
$function$;

-- La ruta: primero el dueño del proceso (jefe de la unidad dueña), después Gestión de la Calidad.
do $$
declare v_ruta uuid;
begin
  select id into v_ruta from flujo.ruta where tipo_objeto = 'documento_version' and activa and vigencia @> current_date;
  if v_ruta is null then
    insert into flujo.ruta (tipo_objeto, nombre, descripcion, activa)
    values ('documento_version', 'Documento del SGC', 'Versión nueva de un documento: la revisa el dueño del proceso y la aprueba Gestión de la Calidad', true)
    returning id into v_ruta;
  end if;
  delete from flujo.ruta_paso where ruta_id = v_ruta;
  insert into flujo.ruta_paso (ruta_id, orden, nombre, resolutor, accion, hito)
  values (v_ruta, 1, 'Dueño del proceso', 'jefe_unidad', 'aprobar', false);
  insert into flujo.ruta_paso (ruta_id, orden, nombre, resolutor, permiso, accion, hito)
  values (v_ruta, 2, 'Gestión de la Calidad', 'permiso', 'sistema:cambios:editar', 'aprobar', true);
  update flujo.ruta set permite_suplencia_repetida = false where id = v_ruta;
end $$;
