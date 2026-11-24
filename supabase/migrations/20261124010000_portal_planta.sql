-- Portal planta (24-nov-2026, pedido de Gabriel). El canal pasa a llamarse «Portal planta» en lo que se ve; las
-- rutas (/canal) no cambian porque van compiladas en las apps. Esta migración trae:
--
--  1. Grupos: crearlos pide la casilla `modulo:grupos` (acción «ver», que es la única que admite un rol de nivel
--     lectura como Personal de planta). Meterse solo a un grupo es solo para los ABIERTOS: hasta hoy la política
--     «me uno o me sacan» dejaba a cualquiera meterse a un grupo cerrado con su id. El coordinador (quien lo
--     creó o quien tenga rol coordinador) mete y saca gente; el equipo del canal (`modulo:reportes` editar),
--     también, desde /sistema.
--  2. Administración de grupos desde /sistema: detalle con miembros y mensajes (decisión de Gabriel: el admin lee
--     los mensajes de los GRUPOS; los directos siguen fuera), agregar, quitar, coordinador, renombrar, archivar.
--     Toda lectura de mensajes queda registrada en `canal_grupo_lecturas`.
--  3. Comentarios: solo se comenta donde la publicación lo permite; el equipo los ve todos y los oculta o restaura.
--  4. Las secciones del portal se prenden y se apagan (`canal_modulos`).

-- 1) Grupos ---------------------------------------------------------------------------------------------------

-- Coordina quien creó el grupo o quien tiene rol coordinador en él.
create or replace function public.coordino_grupo(grupo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.grupos g where g.id = grupo and g.creador_id = public.mi_empleado())
      or exists (select 1 from public.grupo_miembros m
                  where m.grupo_id = grupo and m.empleado_id = public.mi_empleado() and m.rol = 'coordinador');
$$;

-- ¿El grupo es abierto y está activo? (para unirse solo). Fuera del esquema expuesto: no dice nada de un grupo
-- cerrado a quien pregunte por la API.
create or replace function privado.grupo_abierto(p_grupo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.grupos where id = p_grupo and tipo = 'abierto' and activo);
$$;
revoke execute on function privado.grupo_abierto(uuid) from public, anon;
grant execute on function privado.grupo_abierto(uuid) to authenticated;

drop policy if exists "creo grupos" on public.grupos;
create policy "creo grupos" on public.grupos for insert to authenticated
  with check (creador_id = (select public.mi_empleado()) and (select public.puede('modulo:grupos', 'ver')));

drop policy if exists "coordino mi grupo" on public.grupos;
create policy "coordino mi grupo" on public.grupos for update to authenticated
  using (public.coordino_grupo(id) or (select public.puede_publicar()));

drop policy if exists "me uno o me sacan" on public.grupo_miembros;
drop policy if exists "me uno a un abierto" on public.grupo_miembros;
drop policy if exists "el coordinador arma el grupo" on public.grupo_miembros;
drop policy if exists "salgo o me sacan" on public.grupo_miembros;
drop policy if exists "el coordinador cambia roles" on public.grupo_miembros;

-- Unirse solo: a un abierto, y como miembro (nadie se nombra coordinador a sí mismo).
create policy "me uno a un abierto" on public.grupo_miembros for insert to authenticated
  with check (empleado_id = (select public.mi_empleado()) and rol = 'miembro' and privado.grupo_abierto(grupo_id));
-- El coordinador mete gente (también al crear el grupo se mete él, como coordinador: es el creador).
create policy "el coordinador arma el grupo" on public.grupo_miembros for insert to authenticated
  with check (public.coordino_grupo(grupo_id));
create policy "salgo o me sacan" on public.grupo_miembros for delete to authenticated
  using (empleado_id = (select public.mi_empleado()) or public.coordino_grupo(grupo_id));
create policy "el coordinador cambia roles" on public.grupo_miembros for update to authenticated
  using (public.coordino_grupo(grupo_id)) with check (public.coordino_grupo(grupo_id));

-- Quien sale (o lo sacan) de un grupo sale también de su conversación: si no, seguía leyéndola como participante.
create or replace function privado.grupo_miembro_salida()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.conversacion_participantes cp
   using public.conversaciones c
   where c.id = cp.conversacion_id and c.grupo_id = old.grupo_id and cp.empleado_id = old.empleado_id;
  return old;
end;
$$;
revoke execute on function privado.grupo_miembro_salida() from public, anon, authenticated;
drop trigger if exists grupo_miembro_salida on public.grupo_miembros;
create trigger grupo_miembro_salida after delete on public.grupo_miembros
  for each row execute function privado.grupo_miembro_salida();

-- 2) Administración de grupos desde /sistema ------------------------------------------------------------------

create table if not exists public.canal_grupo_lecturas (
  id bigint generated always as identity primary key,
  grupo_id uuid not null references public.grupos (id) on delete cascade,
  leido_por uuid not null,
  leido_en timestamptz not null default now()
);
alter table public.canal_grupo_lecturas enable row level security;
revoke all on public.canal_grupo_lecturas from anon, authenticated;
drop policy if exists "el equipo ve quién leyó" on public.canal_grupo_lecturas;
create policy "el equipo ve quién leyó" on public.canal_grupo_lecturas for select to authenticated
  using ((select public.puede('modulo:reportes', 'editar')));
grant select on public.canal_grupo_lecturas to authenticated;

-- El grupo con sus miembros y, si se piden, sus mensajes (los últimos 300). Leer los mensajes queda registrado.
create or replace function ui.canal_grupo(p_grupo uuid, p_con_mensajes boolean default false)
returns jsonb language plpgsql security definer set search_path = public, ui as $$
declare
  v jsonb;
begin
  if not public.puede('modulo:reportes', case when p_con_mensajes then 'editar' else 'ver' end) then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
           'id', g.id, 'nombre', g.nombre, 'proposito', g.proposito, 'tipo', g.tipo, 'activo', g.activo,
           'creado_en', g.created_at, 'creador', ec.nombre_completo,
           'miembros', coalesce((
             select jsonb_agg(jsonb_build_object('empleado_id', e.id, 'nombre', e.nombre_completo, 'cargo', e.cargo,
                                                 'rol', m.rol, 'desde', m.created_at)
                              order by (m.rol = 'coordinador') desc, e.nombre_completo)
               from public.grupo_miembros m join public.empleados e on e.id = m.empleado_id
              where m.grupo_id = g.id), '[]'::jsonb))
    into v
    from public.grupos g left join public.empleados ec on ec.id = g.creador_id
   where g.id = p_grupo;
  if v is null then
    raise exception 'No se encontró el grupo' using errcode = 'no_data_found';
  end if;
  if p_con_mensajes then
    insert into public.canal_grupo_lecturas (grupo_id, leido_por) values (p_grupo, auth.uid());
    v := v || jsonb_build_object('mensajes', coalesce((
      select jsonb_agg(s.x order by s.creado_en)
        from (select jsonb_build_object('id', ms.id, 'autor', e.nombre_completo, 'texto', ms.texto, 'estado', ms.estado,
                                        'creado_en', ms.created_at) x, ms.created_at creado_en
                from public.mensajes ms
                join public.conversaciones c on c.id = ms.conversacion_id
                join public.empleados e on e.id = ms.autor_id
               where c.grupo_id = p_grupo and ms.estado <> 'eliminado'
               order by ms.created_at desc limit 300) s
    ), '[]'::jsonb));
  end if;
  return v;
end;
$$;

-- Agregar, quitar o nombrar coordinador a alguien.
create or replace function ui.canal_grupo_miembro(p_grupo uuid, p_empleado uuid, p_accion text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from public.grupos where id = p_grupo) then
    raise exception 'No se encontró el grupo' using errcode = 'no_data_found';
  end if;
  case p_accion
    when 'agregar' then
      if not exists (select 1 from public.empleados where id = p_empleado and activo) then
        raise exception 'Esa persona no está activa en el padrón' using errcode = 'no_data_found';
      end if;
      insert into public.grupo_miembros (grupo_id, empleado_id, rol) values (p_grupo, p_empleado, 'miembro')
        on conflict (grupo_id, empleado_id) do nothing;
    when 'quitar' then delete from public.grupo_miembros where grupo_id = p_grupo and empleado_id = p_empleado;
    when 'coordinador' then update public.grupo_miembros set rol = 'coordinador' where grupo_id = p_grupo and empleado_id = p_empleado;
    when 'miembro' then update public.grupo_miembros set rol = 'miembro' where grupo_id = p_grupo and empleado_id = p_empleado;
    else raise exception 'Acción no válida' using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- Renombrar, cambiar propósito o tipo, archivar y restaurar. Archivar no borra nada.
create or replace function ui.canal_grupo_editar(p_grupo uuid, p_nombre text, p_proposito text, p_tipo text, p_activo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo is not null and p_tipo not in ('abierto', 'cerrado') then
    raise exception 'Tipo no válido' using errcode = 'invalid_parameter_value';
  end if;
  update public.grupos
     set nombre = coalesce(nullif(left(trim(p_nombre), 120), ''), nombre),
         proposito = case when p_proposito is null then proposito else nullif(left(trim(p_proposito), 400), '') end,
         tipo = coalesce(p_tipo, tipo),
         activo = coalesce(p_activo, activo)
   where id = p_grupo;
  if not found then
    raise exception 'No se encontró el grupo' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Personas activas del padrón para sumar a un grupo (nombre, cargo, área), con búsqueda.
create or replace function ui.canal_personas(p_buscar text default null)
returns table (id uuid, nombre text, cargo text, area text)
language plpgsql stable security definer set search_path = public, ui as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  return query
  select e.id, e.nombre_completo, e.cargo, a.nombre
    from public.empleados e left join public.areas a on a.id = e.area_id
   where e.activo
     and (p_buscar is null or ui.plano(e.nombre_completo || ' ' || coalesce(e.cargo, '')) like '%' || ui.plano(p_buscar) || '%')
   order by e.nombre_completo
   limit 40;
end;
$$;

-- 3) Comentarios ----------------------------------------------------------------------------------------------

-- Se comenta solo donde la publicación está publicada y lo permite.
create or replace function privado.permite_comentar(p_publicacion uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.publicaciones where id = p_publicacion and estado = 'publicado' and permite_comentarios);
$$;
revoke execute on function privado.permite_comentar(uuid) from public, anon;
grant execute on function privado.permite_comentar(uuid) to authenticated;

drop policy if exists "comento" on public.comentarios;
create policy "comento" on public.comentarios for insert to authenticated
  with check (empleado_id = (select public.mi_empleado()) and estado = 'visible' and privado.permite_comentar(publicacion_id));

-- Todos los comentarios para el equipo, con su publicación y su autor.
create or replace function ui.canal_comentarios()
returns table (id uuid, publicacion_id uuid, publicacion text, autor text, texto text, estado text,
               creado_en timestamptz, reportes integer, busqueda text)
language plpgsql stable security definer set search_path = public, ui as $$
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  return query
  select c.id, c.publicacion_id, coalesce(p.titulo, '(sin título)'), e.nombre_completo, c.texto, c.estado, c.created_at,
         (select count(*)::int from public.reportes r where r.tipo = 'comentario' and r.contenido_id = c.id),
         ui.plano(coalesce(p.titulo, '') || ' ' || e.nombre_completo || ' ' || c.texto)
    from public.comentarios c
    join public.publicaciones p on p.id = c.publicacion_id
    join public.empleados e on e.id = c.empleado_id
   where c.estado <> 'eliminado';
end;
$$;

create or replace function ui.canal_comentario_estado(p_comentario uuid, p_estado text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  if p_estado not in ('visible', 'oculto') then
    raise exception 'Estado no válido' using errcode = 'invalid_parameter_value';
  end if;
  update public.comentarios set estado = p_estado, moderado_por = case when p_estado = 'oculto' then public.mi_empleado() else null end
   where id = p_comentario and estado <> 'eliminado';
  if not found then
    raise exception 'No se encontró el comentario' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Permitir o no comentarios en una publicación, desde el admin.
create or replace function ui.canal_publicacion_comentarios(p_publicacion uuid, p_permite boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  update public.publicaciones set permite_comentarios = p_permite where id = p_publicacion;
end;
$$;

-- 4) Secciones del portal -------------------------------------------------------------------------------------

create table if not exists public.canal_modulos (
  clave text primary key,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  orden integer not null default 0,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid
);
alter table public.canal_modulos enable row level security;
revoke all on public.canal_modulos from anon, authenticated;
grant select on public.canal_modulos to authenticated;
drop policy if exists "todos leen las secciones" on public.canal_modulos;
create policy "todos leen las secciones" on public.canal_modulos for select to authenticated using (true);

insert into public.canal_modulos (clave, nombre, descripcion, orden) values
  ('tareas', 'Tareas', 'Mis tareas, crear tareas y su calendario', 10),
  ('grupos', 'Grupos', 'Los grupos y sus conversaciones', 20),
  ('mensajes', 'Mensajes', 'Las conversaciones directas y de grupo', 30),
  ('gente', 'Gente', 'El directorio y las conexiones', 40),
  ('adiestramiento', 'Formación', 'El curso de Ajito', 50),
  ('avisos', 'Avisos', 'Los avisos de la plataforma', 60)
on conflict (clave) do nothing;

create or replace function ui.canal_modulo_activar(p_clave text, p_activo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  update public.canal_modulos set activo = p_activo, actualizado_en = now(), actualizado_por = auth.uid()
   where clave = p_clave;
  if not found then
    raise exception 'No existe esa sección' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function ui.canal_grupo(uuid, boolean), ui.canal_grupo_miembro(uuid, uuid, text),
  ui.canal_grupo_editar(uuid, text, text, text, boolean), ui.canal_personas(text), ui.canal_comentarios(),
  ui.canal_comentario_estado(uuid, text), ui.canal_publicacion_comentarios(uuid, boolean),
  ui.canal_modulo_activar(text, boolean) from public, anon;
grant execute on function ui.canal_grupo(uuid, boolean), ui.canal_grupo_miembro(uuid, uuid, text),
  ui.canal_grupo_editar(uuid, text, text, text, boolean), ui.canal_personas(text), ui.canal_comentarios(),
  ui.canal_comentario_estado(uuid, text), ui.canal_publicacion_comentarios(uuid, boolean),
  ui.canal_modulo_activar(text, boolean) to authenticated;

-- La casilla nueva, de fábrica, para quien ya publica (Consultor); los demás roles la marcan en Roles y permisos.
insert into public.rol_permisos (rol_id, recurso, ver, crear, editar, eliminar)
select r.id, 'modulo:grupos', true, false, false, false from public.roles r where r.clave in ('consultor')
on conflict do nothing;

-- 5) El nombre en el registro de módulos de la plataforma.
update control.modulo set nombre = 'Portal planta' where codigo = 'NUC-CAN';

-- 6) La tabla de grupos del admin abre el detalle de cada uno (columna `acciones`, la lista de botones de la fila).
drop function if exists ui.canal_grupos();
create function ui.canal_grupos()
returns table (
  id uuid, nombre text, proposito text, tipo text, activo boolean, area text, creado_en timestamptz,
  miembros integer, coordinadores text, mensajes_30d integer, ultimo_mensaje timestamptz, busqueda text, acciones text
)
language plpgsql stable security definer set search_path = public, ui as $$
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  return query
  select g.id, g.nombre, g.proposito, g.tipo, g.activo, a.nombre, g.created_at,
         (select count(*)::int from public.grupo_miembros gm where gm.grupo_id = g.id),
         (select string_agg(e.nombre_completo, ', ' order by e.nombre_completo)
            from public.grupo_miembros gm join public.empleados e on e.id = gm.empleado_id
           where gm.grupo_id = g.id and (gm.rol = 'coordinador' or gm.empleado_id = g.creador_id)),
         (select count(*)::int from public.mensajes m join public.conversaciones c on c.id = m.conversacion_id
           where c.grupo_id = g.id and m.estado <> 'eliminado' and m.created_at >= now() - interval '30 days'),
         (select max(m.created_at) from public.mensajes m join public.conversaciones c on c.id = m.conversacion_id
           where c.grupo_id = g.id),
         ui.plano(g.nombre || ' ' || coalesce(g.proposito, '') || ' ' || coalesce(a.nombre, '')),
         'gestionar'::text
    from public.grupos g
    left join public.areas a on a.id = g.area_id;
end;
$$;
revoke execute on function ui.canal_grupos() from public, anon;
grant execute on function ui.canal_grupos() to authenticated;

-- Si cada publicación recibe comentarios (para el admin).
create or replace function ui.canal_publicaciones_permiten()
returns table (id uuid, permite_comentarios boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puede('modulo:reportes', 'ver') then
    raise exception 'Sin permiso para administrar el portal' using errcode = 'insufficient_privilege';
  end if;
  return query select p.id, p.permite_comentarios from public.publicaciones p;
end;
$$;
revoke execute on function ui.canal_publicaciones_permiten() from public, anon;
grant execute on function ui.canal_publicaciones_permiten() to authenticated;
