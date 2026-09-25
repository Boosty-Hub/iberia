-- =============================================================================
-- Roles y permisos
--
-- Hasta aquí había tres roles escritos en un CHECK (admin, consultor, lector) y
-- cada página decidía con `esEditor()`. Ahora los roles se crean desde el panel,
-- llevan una matriz de permisos —ver, crear, editar, eliminar— por módulo, por
-- sección del informe y por lección del curso, y se asignan a cada usuario.
--
-- ⚠️ **El nivel es el techo, la matriz afina por debajo.** Cada rol tiene un
-- `nivel` que es el viejo `profiles.rol`, y un trigger lo mantiene copiado ahí:
-- así todas las políticas que ya preguntan por `es_editor()` o `es_admin()`
-- siguen valiendo tal cual, y ningún rol nuevo puede dar más de lo que su nivel
-- deja escribir en la base. Un rol de nivel lectura solo puede ver; uno de nivel
-- consultor no administra usuarios ni roles; el nivel administrador lo puede
-- todo, y por eso la matriz de un rol administrador no se edita: así nadie se
-- deja al programa sin quien lo administre desmarcando una casilla.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) LOS ROLES
-- -----------------------------------------------------------------------------

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  clave       text not null unique check (clave ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre      text not null check (length(trim(nombre)) between 2 and 60),
  descripcion text,
  nivel       text not null check (nivel in ('admin', 'consultor', 'lector')),
  -- Los cuatro de fábrica. No se borran ni cambian de nivel: son a los que cae
  -- quien se crea sin rol, y el de administrador es el que garantiza el acceso.
  sistema     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger roles_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

comment on table public.roles is
  'Roles configurables. `nivel` es el techo de seguridad y se copia a profiles.rol; la matriz de rol_permisos afina por debajo.';

-- -----------------------------------------------------------------------------
-- 2) LA MATRIZ
-- -----------------------------------------------------------------------------
-- Un recurso es `modulo:<clave>`, `informe:<slug>` o `leccion:<numero>`. El
-- inventario vive en lib/permisos.ts (los módulos) y en la base (las secciones
-- y las lecciones), así que una sección nueva aparece sola en la matriz.

create table if not exists public.rol_permisos (
  rol_id   uuid not null references public.roles (id) on delete cascade,
  recurso  text not null check (recurso ~ '^(modulo|informe|leccion):[a-z0-9-]+$'),
  ver      boolean not null default false,
  crear    boolean not null default false,
  editar   boolean not null default false,
  eliminar boolean not null default false,
  primary key (rol_id, recurso)
);

create index if not exists rol_permisos_recurso_idx on public.rol_permisos (recurso);

-- Quien crea, edita o elimina, ve: una casilla de editar sin la de ver es una
-- pantalla que no se puede abrir. Y el techo del nivel se cumple aquí, en la
-- base, no solo en el formulario.
create or replace function public.rol_permisos_normalizar()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_nivel text;
begin
  select nivel into v_nivel from public.roles where id = new.rol_id;

  new.ver := new.ver or new.crear or new.editar or new.eliminar;

  if new.recurso in ('modulo:usuarios', 'modulo:roles') and v_nivel <> 'admin'
     and new.ver then
    raise exception 'Solo un rol de nivel administrador gestiona usuarios y roles'
      using errcode = 'check_violation';
  end if;

  if v_nivel = 'lector' and (new.crear or new.editar or new.eliminar) then
    raise exception 'Un rol de nivel lectura solo puede ver (%)', new.recurso
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger rol_permisos_normalizar
  before insert or update on public.rol_permisos
  for each row execute function public.rol_permisos_normalizar();

-- -----------------------------------------------------------------------------
-- 3) EL ROL DE CADA USUARIO
-- -----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists rol_id uuid references public.roles (id) on delete restrict;

create index if not exists profiles_rol_id_idx on public.profiles (rol_id);

-- Los de fábrica, antes de enlazar a nadie.
insert into public.roles (clave, nombre, descripcion, nivel, sistema) values
  ('administrador', 'Administrador',
   'Control total, incluida la gestión de usuarios, roles y permisos.', 'admin', true),
  ('consultor', 'Consultor Boosty',
   'El equipo consultor: levanta, escribe el informe y opera el curso.', 'consultor', true),
  ('lector', 'Lector Iberia',
   'La dirección de Iberia: lee el informe publicado y el programa.', 'lector', true),
  ('personal-planta', 'Personal de planta',
   'Quien entra con su enlace personal: el canal y el curso de Ajito, nada más.', 'lector', true)
on conflict (clave) do nothing;

-- `rol` sigue existiendo porque todas las políticas lo leen, pero ya no se
-- escribe a mano: sale del rol asignado. Si alguien lo cambia directo —el
-- script de crear usuarios, un rol en los metadatos—, se busca el rol de
-- fábrica de ese nivel para que los dos campos nunca digan cosas distintas.
create or replace function public.profiles_sincronizar_rol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.rol_id is distinct from old.rol_id then
    if new.rol_id is null then
      select id into new.rol_id from public.roles
        where sistema and nivel = coalesce(new.rol, 'lector')
          and clave <> 'personal-planta'
        order by clave limit 1;
    end if;
    select nivel into new.rol from public.roles where id = new.rol_id;
  elsif new.rol is distinct from old.rol then
    select id into new.rol_id from public.roles
      where sistema and nivel = new.rol and clave <> 'personal-planta'
      order by clave limit 1;
  end if;
  return new;
end;
$$;

create trigger profiles_sincronizar_rol
  before insert or update of rol, rol_id on public.profiles
  for each row execute function public.profiles_sincronizar_rol();

-- 🔴 **Nadie se sube el rol a sí mismo.** La política «actualizar perfil propio»
-- deja a cada quien escribir su fila entera —RLS no restringe columnas—, así que
-- hasta hoy un lector podía ponerse `rol = 'admin'` con una llamada a la API y la
-- base lo aceptaba. Comprobado el 25 de septiembre con una cuenta de prueba. Lo
-- que decide el acceso —rol, estado, organización, correo— solo lo cambia un
-- administrador o la clave de servicio (que no trae `auth.uid()`). El nombre y
-- el cargo siguen siendo de cada quien.
create or replace function public.profiles_proteger_acceso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.es_admin()
     and (new.rol is distinct from old.rol
          or new.rol_id is distinct from old.rol_id
          or new.activo is distinct from old.activo
          or new.organizacion is distinct from old.organizacion
          or new.email is distinct from old.email
          or new.id is distinct from old.id) then
    raise exception 'Solo un administrador cambia el rol, el estado o la organización de una cuenta'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

-- Se llama «a_…» para correr antes que la sincronización: los triggers del
-- mismo momento se disparan por orden alfabético.
create trigger a_profiles_proteger_acceso
  before update on public.profiles
  for each row execute function public.profiles_proteger_acceso();

-- Los que ya existen quedan con el rol de fábrica de su nivel.
update public.profiles p
   set rol_id = r.id
  from public.roles r
 where p.rol_id is null
   and r.sistema and r.nivel = p.rol and r.clave <> 'personal-planta';

-- El personal de planta entra con su enlace y es de `empleados`. Si alguien del
-- padrón tiene una cuenta de lectura, es la del enlace: pasa a su rol propio.
update public.profiles p
   set rol_id = (select id from public.roles where clave = 'personal-planta')
 where p.rol = 'lector'
   and exists (select 1 from public.empleados e where e.perfil_id = p.id);

alter table public.profiles alter column rol_id set not null;

-- Si cambia el nivel de un rol, cambia el de toda la gente que lo tiene.
create or replace function public.roles_propagar_nivel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.nivel is distinct from old.nivel then
    if old.sistema then
      raise exception 'Un rol de fábrica no cambia de nivel' using errcode = 'check_violation';
    end if;
    update public.profiles set rol = new.nivel where rol_id = new.id;
    -- Lo que el nivel nuevo ya no deja hacer se apaga en la matriz.
    if new.nivel = 'lector' then
      update public.rol_permisos
         set crear = false, editar = false, eliminar = false
       where rol_id = new.id;
    end if;
    if new.nivel <> 'admin' then
      delete from public.rol_permisos
       where rol_id = new.id and recurso in ('modulo:usuarios', 'modulo:roles');
    end if;
  end if;
  return new;
end;
$$;

create trigger roles_propagar_nivel
  before update of nivel on public.roles
  for each row execute function public.roles_propagar_nivel();

-- ⚠️ **Nunca sin administrador.** Un cambio de rol, de nivel o una desactivación
-- que deje el programa sin nadie activo de nivel administrador se rechaza. Es la
-- misma guarda que ya tenía «un admin no puede degradarse a sí mismo», pero en
-- la base y para todos los caminos.
create or replace function public.garantizar_un_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where rol = 'admin' and activo) then
    raise exception 'Tiene que quedar al menos un administrador activo'
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger profiles_garantizar_admin
  after update or delete on public.profiles
  deferrable initially deferred
  for each row execute function public.garantizar_un_admin();

-- El alta automática acepta el rol por su clave (`rol_clave`) además del nivel.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre_completo, cargo, organizacion, rol, rol_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'nombre_completo',
    new.raw_user_meta_data ->> 'cargo',
    coalesce(new.raw_user_meta_data ->> 'organizacion', 'boosty'),
    coalesce(new.raw_user_meta_data ->> 'rol', 'lector'),
    (select id from public.roles where clave = new.raw_user_meta_data ->> 'rol_clave')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) LA PREGUNTA
-- -----------------------------------------------------------------------------

-- ¿Puede el usuario de esta sesión hacer `accion` sobre `recurso`? El nivel
-- administrador puede todo; el resto, lo que diga la matriz de su rol.
create or replace function public.puede(p_recurso text, p_accion text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when p.rol = 'admin' then true
      else coalesce((
        select case p_accion
          when 'ver' then rp.ver
          when 'crear' then rp.crear
          when 'editar' then rp.editar
          when 'eliminar' then rp.eliminar
          else false
        end
        from public.rol_permisos rp
        where rp.rol_id = p.rol_id and rp.recurso = p_recurso
      ), false)
    end
    from public.profiles p
    where p.id = auth.uid() and p.activo
  ), false);
$$;

-- La matriz de quien pregunta, de una vez: la app la lee al abrir la sesión.
create or replace function public.mis_permisos()
returns table (recurso text, ver boolean, crear boolean, editar boolean, eliminar boolean)
language sql
stable
security definer
set search_path = public
as $$
  select rp.recurso, rp.ver, rp.crear, rp.editar, rp.eliminar
    from public.profiles p
    join public.rol_permisos rp on rp.rol_id = p.rol_id
   where p.id = auth.uid() and p.activo;
$$;

-- -----------------------------------------------------------------------------
-- 5) RLS DE LAS TABLAS NUEVAS
-- -----------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.rol_permisos enable row level security;

-- El nombre de un rol no es secreto: se pinta en la cabecera de cada quien.
create policy "con sesión se leen los roles"
  on public.roles for select to authenticated using (true);

create policy "administradores crean roles"
  on public.roles for insert to authenticated with check (public.es_admin());

create policy "administradores editan roles"
  on public.roles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy "administradores borran roles que no son de fábrica"
  on public.roles for delete to authenticated using (public.es_admin() and not sistema);

-- La matriz completa la ve quien administra; cada quien, la de su rol.
create policy "matriz legible por administradores y por su dueño"
  on public.rol_permisos for select to authenticated
  using (public.es_admin()
         or rol_id = (select rol_id from public.profiles where id = auth.uid()));

create policy "administradores escriben la matriz"
  on public.rol_permisos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- -----------------------------------------------------------------------------
-- 6) LA MATRIZ ENTRA EN LAS POLÍTICAS DEL INFORME, EL MAPA Y EL CURSO
-- -----------------------------------------------------------------------------
-- El resto de módulos se gobierna en el servidor de la app (`requerirPermiso`),
-- con el nivel como techo en la base. Estas tres se cierran también aquí porque
-- son las que se abren fuera del panel, a gente que no es del equipo.

-- Informe: además de publicado (o ser del equipo), su casilla de «ver».
drop policy if exists "informe publicado legible con sesion" on public.informe_secciones;
create policy "informe legible según su permiso"
  on public.informe_secciones for select to authenticated
  using (public.puede('informe:' || slug, 'ver') and (publicado or public.es_editor()));

drop policy if exists "editores gestionan informe" on public.informe_secciones;
create policy "editores crean secciones"
  on public.informe_secciones for insert to authenticated
  with check (public.es_editor() and public.puede('modulo:informe', 'crear'));
create policy "editores editan las secciones que les tocan"
  on public.informe_secciones for update to authenticated
  using (public.es_editor() and public.puede('informe:' || slug, 'editar'))
  with check (public.es_editor() and public.puede('informe:' || slug, 'editar'));
create policy "editores borran las secciones que les tocan"
  on public.informe_secciones for delete to authenticated
  using (public.es_editor() and public.puede('informe:' || slug, 'eliminar'));

-- El mapa interactivo es el inventario entero de procesos: se ve con su permiso.
drop policy if exists "con sesión se lee el mapa" on public.macroprocesos;
create policy "el mapa se lee con su permiso"
  on public.macroprocesos for select to authenticated
  using (public.es_editor() or public.puede('informe:mapa-interactivo', 'ver'));

drop policy if exists "con sesión se leen los procesos" on public.procesos;
create policy "los procesos se leen con el permiso del mapa"
  on public.procesos for select to authenticated
  using (public.es_editor() or public.puede('informe:mapa-interactivo', 'ver'));

-- Curso: cada lección, con su casilla. El equipo las ve todas para operarlo.
drop policy if exists "lecciones visibles" on public.lecciones;
create policy "lecciones visibles según su permiso"
  on public.lecciones for select to authenticated
  using (public.es_editor() or (activa and public.puede('leccion:' || numero, 'ver')));

-- -----------------------------------------------------------------------------
-- 7) LA MATRIZ DE FÁBRICA · reproduce lo que cada nivel podía hacer ayer
-- -----------------------------------------------------------------------------

-- Consultor: todo lo que no es administrar usuarios ni roles.
insert into public.rol_permisos (rol_id, recurso, ver, crear, editar, eliminar)
select r.id, x.recurso, true, x.crear, x.editar, x.eliminar
  from public.roles r
  cross join (values
    ('modulo:panel',          false, false, false),
    ('modulo:entrevistas',    true,  true,  true),
    ('modulo:archivos',       true,  false, true),
    ('modulo:hallazgos',      true,  true,  true),
    ('modulo:informe',        true,  false, false),
    ('modulo:programa',       true,  false, true),
    ('modulo:empleados',      false, true,  false),
    ('modulo:adiestramiento', false, true,  false),
    ('modulo:recordatorios',  false, true,  false),
    ('modulo:certificados',   false, false, false),
    ('modulo:canal',          false, false, false),
    ('informe:mapa-interactivo', false, false, false)
  ) as x(recurso, crear, editar, eliminar)
 where r.clave = 'consultor'
on conflict (rol_id, recurso) do nothing;

insert into public.rol_permisos (rol_id, recurso, ver, editar, eliminar)
select r.id, 'informe:' || s.slug, true, true, true
  from public.roles r cross join public.informe_secciones s
 where r.clave = 'consultor'
on conflict (rol_id, recurso) do nothing;

insert into public.rol_permisos (rol_id, recurso, ver)
select r.id, 'leccion:' || l.numero, true
  from public.roles r cross join public.lecciones l
 where r.clave = 'consultor'
on conflict (rol_id, recurso) do nothing;

-- Lector Iberia: lo que ya podía abrir, en lectura.
insert into public.rol_permisos (rol_id, recurso, ver)
select r.id, x.recurso, true
  from public.roles r
  cross join (values
    ('modulo:panel'), ('modulo:entrevistas'), ('modulo:archivos'), ('modulo:hallazgos'),
    ('modulo:informe'), ('modulo:programa'), ('modulo:adiestramiento'), ('modulo:canal'),
    ('informe:mapa-interactivo')
  ) as x(recurso)
 where r.clave = 'lector'
on conflict (rol_id, recurso) do nothing;

insert into public.rol_permisos (rol_id, recurso, ver)
select r.id, 'informe:' || s.slug, true
  from public.roles r cross join public.informe_secciones s
 where r.clave = 'lector'
on conflict (rol_id, recurso) do nothing;

insert into public.rol_permisos (rol_id, recurso, ver)
select r.id, 'leccion:' || l.numero, true
  from public.roles r cross join public.lecciones l
 where r.clave = 'lector'
on conflict (rol_id, recurso) do nothing;

-- Personal de planta: el canal y las nueve lecciones.
insert into public.rol_permisos (rol_id, recurso, ver)
select r.id, 'modulo:canal', true from public.roles r where r.clave = 'personal-planta'
on conflict (rol_id, recurso) do nothing;

insert into public.rol_permisos (rol_id, recurso, ver)
select r.id, 'leccion:' || l.numero, true
  from public.roles r cross join public.lecciones l
 where r.clave = 'personal-planta'
on conflict (rol_id, recurso) do nothing;

-- -----------------------------------------------------------------------------
-- 8) LO QUE NACE DESPUÉS
-- -----------------------------------------------------------------------------
-- Una sección o una lección nueva entra en la matriz de los roles de fábrica con
-- lo que su nivel veía ayer, para que el equipo no la pierda de vista el día que
-- el generador la crea. En un rol creado desde el panel entra apagada: quien lo
-- administra decide si esa gente la ve.

create or replace function public.permisos_de_fabrica_seccion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.rol_permisos (rol_id, recurso, ver, editar, eliminar)
    select id, 'informe:' || new.slug, true, nivel = 'consultor', nivel = 'consultor'
      from public.roles where clave in ('consultor', 'lector')
    on conflict (rol_id, recurso) do nothing;
  elsif tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    update public.rol_permisos set recurso = 'informe:' || new.slug
     where recurso = 'informe:' || old.slug;
  elsif tg_op = 'DELETE' then
    delete from public.rol_permisos where recurso = 'informe:' || old.slug;
  end if;
  return null;
end;
$$;

create trigger informe_secciones_permisos
  after insert or update of slug or delete on public.informe_secciones
  for each row execute function public.permisos_de_fabrica_seccion();

create or replace function public.permisos_de_fabrica_leccion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.rol_permisos (rol_id, recurso, ver)
  select id, 'leccion:' || new.numero, true
    from public.roles where clave in ('consultor', 'lector', 'personal-planta')
  on conflict (rol_id, recurso) do nothing;
  return null;
end;
$$;

create trigger lecciones_permisos
  after insert on public.lecciones
  for each row execute function public.permisos_de_fabrica_leccion();
