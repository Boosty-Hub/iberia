-- =============================================================================
-- Mis archivos: carpetas personales y compartidas (pedido de Gabriel, 26-nov-2026)
-- =============================================================================
--
-- Cada persona tiene su árbol de carpetas y archivos. Lo ve solo su dueño o a
-- quien él le comparta un archivo o una carpeta (compartir una carpeta comparte
-- todo lo que cuelga de ella). Se cita en el chat del asistente con «/».
--
-- Los archivos siguen siendo filas de `asistente.archivo`, con dos orígenes nuevos
-- que NO son dueños de su objeto en Storage (no lo borran ni cuentan en la cuota):
--   · `referencia`: apunta a un objeto de otro bucket (los documentos del SGC, el
--     expediente, el curso…). Solo los crea el servidor (la importación de
--     `scripts/asistente/importar-storage.mjs`), nunca una sesión.
--   · `biblioteca`: un archivo de la biblioteca adjuntado a un chat (copia la
--     dirección del original; `fuente_id` dice cuál).
-- `aviso` marca lo que viene de un lugar privado (las respuestas de los
-- trabajadores, un documento de perímetro sensible): compartirlo pide
-- confirmación expresa.
--
-- Descargar va por `/sistema/archivos/[id]/descargar`: la fila se lee con la
-- sesión (la RLS es la autorización) y el enlace lo firma el servidor, porque
-- los buckets de origen tienen sus propias políticas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Carpetas
-- -----------------------------------------------------------------------------
create table if not exists asistente.carpeta (
  id         uuid primary key default gen_random_uuid(),
  dueno      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  padre_id   uuid references asistente.carpeta (id) on delete cascade,
  nombre     text not null check (length(trim(nombre)) between 1 and 200 and nombre !~ '[/\\]'),
  creado_en  timestamptz not null default now()
);
create unique index if not exists carpeta_nombre_unico
  on asistente.carpeta (dueno, coalesce(padre_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nombre));
create index if not exists carpeta_padre_idx on asistente.carpeta (padre_id);
alter table asistente.carpeta enable row level security;

-- -----------------------------------------------------------------------------
-- 2) El archivo: carpeta, bucket, origen sin objeto propio y aviso
-- -----------------------------------------------------------------------------
alter table asistente.archivo add column if not exists carpeta_id uuid references asistente.carpeta (id) on delete cascade;
alter table asistente.archivo add column if not exists bucket text not null default 'asistente';
alter table asistente.archivo add column if not exists fuente_id uuid references asistente.archivo (id) on delete set null;
alter table asistente.archivo add column if not exists aviso text check (aviso is null or length(aviso) <= 300);
alter table asistente.archivo drop constraint if exists archivo_bucket_check;
alter table asistente.archivo add constraint archivo_bucket_check
  check (bucket in ('asistente', 'documentos', 'archivos', 'adiestramiento', 'adiestramiento-respuestas', 'canal', 'tutoriales'));
alter table asistente.archivo drop constraint if exists archivo_origen_check;
alter table asistente.archivo add constraint archivo_origen_check
  check (origen in ('subido', 'generado', 'microsoft', 'referencia', 'biblioteca'));
-- Lo que es dueño de su objeto vive siempre en el bucket del asistente; las referencias y los adjuntos de la
-- biblioteca apuntan a cualquiera de los buckets.
alter table asistente.archivo drop constraint if exists archivo_dueno_objeto_check;
alter table asistente.archivo add constraint archivo_dueno_objeto_check
  check (origen in ('referencia', 'biblioteca') or bucket = 'asistente');
-- La ruta deja de ser única a secas: varias filas (un adjunto de la biblioteca, una referencia) apuntan al mismo objeto.
alter table asistente.archivo drop constraint if exists archivo_ruta_key;
create unique index if not exists archivo_objeto_propio on asistente.archivo (bucket, ruta) where origen in ('subido', 'generado', 'microsoft');
create unique index if not exists archivo_referencia_unica on asistente.archivo (dueno, bucket, ruta) where origen = 'referencia';
create index if not exists archivo_carpeta_idx on asistente.archivo (carpeta_id);

-- -----------------------------------------------------------------------------
-- 3) Compartir una carpeta
-- -----------------------------------------------------------------------------
alter table asistente.compartido drop constraint if exists compartido_tipo_check;
alter table asistente.compartido add constraint compartido_tipo_check check (tipo in ('archivo', 'html', 'carpeta'));

-- ¿Esta carpeta, o alguna de las que la contienen, me la compartieron? Sube por el árbol (máx. 30 niveles).
create or replace function privado.carpeta_compartida_conmigo(p_carpeta uuid)
returns boolean
language sql stable security definer set search_path = asistente, public as $$
  with recursive arriba as (
    select c.id, c.padre_id, 1 as n from asistente.carpeta c where c.id = p_carpeta
    union all
    select c.id, c.padre_id, a.n + 1 from asistente.carpeta c join arriba a on c.id = a.padre_id where a.n < 30
  )
  select exists (select 1 from arriba a join asistente.compartido s on s.tipo = 'carpeta' and s.objeto_id = a.id and s.con = auth.uid());
$$;
revoke all on function privado.carpeta_compartida_conmigo(uuid) from public, anon;
grant execute on function privado.carpeta_compartida_conmigo(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4) RLS
-- -----------------------------------------------------------------------------
drop policy if exists "veo carpetas" on asistente.carpeta;
create policy "veo carpetas" on asistente.carpeta for select to authenticated
  using (dueno = (select auth.uid()) or privado.carpeta_compartida_conmigo(id));
-- Crear, renombrar, mover y borrar: solo el dueño, y siempre dentro de su propio árbol (lo revisa el trigger).
drop policy if exists "creo carpetas" on asistente.carpeta;
create policy "creo carpetas" on asistente.carpeta for insert to authenticated
  with check (dueno = (select auth.uid()) and (select public.puede('sistema:archivos', 'crear')));
drop policy if exists "cambio mis carpetas" on asistente.carpeta;
create policy "cambio mis carpetas" on asistente.carpeta for update to authenticated
  using (dueno = (select auth.uid())) with check (dueno = (select auth.uid()));
drop policy if exists "borro mis carpetas" on asistente.carpeta;
create policy "borro mis carpetas" on asistente.carpeta for delete to authenticated using (dueno = (select auth.uid()));
grant select, insert, delete on asistente.carpeta to authenticated;
grant update (nombre, padre_id) on asistente.carpeta to authenticated;
grant all on asistente.carpeta to service_role;

-- El padre tiene que ser del mismo dueño, y mover no puede crear un ciclo.
create or replace function asistente.t_carpeta_arbol()
returns trigger language plpgsql security definer set search_path = asistente, public as $$
declare
  v_cursor uuid := new.padre_id;
  v_n int := 0;
begin
  if new.padre_id is null then return new; end if;
  if not exists (select 1 from asistente.carpeta where id = new.padre_id and dueno = new.dueno) then
    raise exception 'La carpeta de destino no es tuya' using errcode = 'insufficient_privilege';
  end if;
  while v_cursor is not null and v_n < 40 loop
    if v_cursor = new.id then raise exception 'No se puede mover una carpeta dentro de sí misma'; end if;
    select padre_id into v_cursor from asistente.carpeta where id = v_cursor;
    v_n := v_n + 1;
  end loop;
  return new;
end;
$$;
drop trigger if exists b_carpeta_arbol on asistente.carpeta;
create trigger b_carpeta_arbol before insert or update of padre_id on asistente.carpeta for each row execute function asistente.t_carpeta_arbol();

-- El archivo se ve si es mío, si es de un chat donde participo, si me lo compartieron o si está en una carpeta
-- que me compartieron.
drop policy if exists "veo archivos" on asistente.archivo;
create policy "veo archivos" on asistente.archivo for select to authenticated
  using (dueno = (select auth.uid())
         or (chat_id is not null and privado.participo_en_chat(chat_id))
         or privado.compartido_conmigo('archivo', id)
         or (carpeta_id is not null and privado.carpeta_compartida_conmigo(carpeta_id)));

-- Subir con sesión sigue siendo solo `subido`, al bucket del asistente y a la carpeta propia de Storage. Una sesión
-- nunca crea una `referencia` (le daría lectura de cualquier objeto por la ruta de descarga) ni una `biblioteca`
-- (eso lo hace el servidor después de comprobar que el original se puede leer). La carpeta, si va, es propia.
drop policy if exists "subo archivos" on asistente.archivo;
create policy "subo archivos" on asistente.archivo for insert to authenticated
  with check (dueno = (select auth.uid()) and origen = 'subido' and estado = 'subiendo' and anthropic_file_id is null
              and bucket = 'asistente' and fuente_id is null and aviso is null
              and (chat_id is null or privado.participo_en_chat(chat_id))
              and (proyecto_id is null or exists (select 1 from asistente.proyecto p where p.id = proyecto_id and p.dueno = (select auth.uid())))
              and (carpeta_id is null or exists (select 1 from asistente.carpeta c where c.id = carpeta_id and c.dueno = (select auth.uid())))
              and ((select privado.asistente_habilitado()) or (select public.puede('sistema:archivos', 'crear')))
              and ruta like (select auth.uid())::text || '/%');

-- -----------------------------------------------------------------------------
-- 5) La cuota cuenta solo lo que es dueño de su objeto
-- -----------------------------------------------------------------------------
do $$
declare
  d text;
  n text;
begin
  d := pg_get_functiondef('asistente.politica_de(uuid)'::regprocedure);
  -- Idempotente: si ya filtra por origen, se deja (y se limpia si quedó repetido).
  if position('and origen in (''subido'', ''generado'', ''microsoft'')' in d) > 0 then
    n := replace(d, ' and origen in (''subido'', ''generado'', ''microsoft'') and origen in (''subido'', ''generado'', ''microsoft'')', ' and origen in (''subido'', ''generado'', ''microsoft'')');
    if n <> d then execute n; end if;
    return;
  end if;
  n := replace(d, 'where dueno = p_perfil and estado <> ''error''', 'where dueno = p_perfil and estado <> ''error'' and origen in (''subido'', ''generado'', ''microsoft'')');
  if n = d then raise exception 'politica_de: no se encontró el cálculo de la cuota'; end if;
  execute n;
end $$;

-- -----------------------------------------------------------------------------
-- 6) ¿Esa persona tiene Mis archivos? (para compartir; solo el servidor)
-- -----------------------------------------------------------------------------
create or replace function asistente.tiene_archivos(p_perfil uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select privado.puede_perfil(p_perfil, 'sistema:archivos', 'ver');
$$;
revoke all on function asistente.tiene_archivos(uuid) from public, anon, authenticated;
grant execute on function asistente.tiene_archivos(uuid) to service_role;

-- Con quién se comparte: las personas activas con Mis archivos (solo nombres), para quien también lo tiene.
create or replace function asistente.personas_con_archivos()
returns table (perfil_id uuid, nombre text)
language sql stable security definer set search_path = asistente, public as $$
  select p.id, coalesce(nullif(p.nombre_completo, ''), 'Sin nombre')
    from public.profiles p
   where p.activo and p.id <> auth.uid() and public.puede('sistema:archivos', 'ver')
     and privado.puede_perfil(p.id, 'sistema:archivos', 'ver')
   order by 2;
$$;
revoke all on function asistente.personas_con_archivos() from public, anon;
grant execute on function asistente.personas_con_archivos() to authenticated;

-- -----------------------------------------------------------------------------
-- 7) La casilla: de fábrica, quien tiene el asistente tiene sus archivos
-- -----------------------------------------------------------------------------
insert into public.rol_permisos (rol_id, recurso, ver, crear, editar, eliminar)
select rp.rol_id, 'sistema:archivos', true, true, false, false
  from public.rol_permisos rp
 where rp.recurso = 'sistema:asistente' and rp.ver
on conflict do nothing;

notify pgrst, 'reload schema';
