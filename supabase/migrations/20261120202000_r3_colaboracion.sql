-- =============================================================================
-- PLATAFORMA IBERIA · R3 · Trabajo en equipo (Anexo E §8, §10)
--
-- La línea de tiempo de cada objeto (comentarios, @menciones, decisiones de
-- aprobación y, desde R4, la IA con su nivel), seguir un objeto, el centro de
-- notificaciones y las tareas con vencimiento. Esquema `nucleo`.
--
-- Reglas:
--  · Lo de un objeto lo lee quien puede leer el objeto: `nucleo.puede_ver_objeto`
--    responde con el permiso del módulo de cada tipo (y el perímetro en los
--    documentos, y quien pidió o firma en requisiciones y escenarios).
--  · Un comentario se escribe solo como uno mismo; se edita u oculta solo el
--    propio y dentro de 15 minutos. La auditoría guarda el original.
--  · Las notificaciones son de su destinatario y solo las escriben funciones de
--    la base: nadie se fabrica un aviso ni se lo fabrica a otro.
--  · Nadie recibe un aviso de un objeto que no puede ver (ni por mención, ni por
--    seguir, ni por tarea).
--  · Las preguntas «¿puede ESA persona…?» viven en `privado` (no expuesto):
--    expuestas, cualquiera averiguaría los permisos de otro (ver AGENTS.md,
--    «Reportar y bloquear»).
-- =============================================================================

create schema if not exists nucleo;
create schema if not exists privado;
grant usage on schema nucleo to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 0) PERMISOS DE OTRA PERSONA (privado)
-- -----------------------------------------------------------------------------

-- La misma regla que `public.puede`, para un perfil dado. Si una cambia, cambia
-- la otra (ver «La regla vive dos veces» en AGENTS.md: esta es la tercera copia,
-- solo para decidir a quién se avisa).
create or replace function privado.puede_perfil(p_perfil uuid, p_recurso text, p_accion text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case
      when p.rol = 'admin' then true
      else coalesce((
        select case p_accion when 'ver' then rp.ver when 'crear' then rp.crear
                             when 'editar' then rp.editar when 'eliminar' then rp.eliminar else false end
          from public.rol_permisos rp where rp.rol_id = p.rol_id and rp.recurso = p_recurso), false)
    end
    from public.profiles p where p.id = p_perfil and p.activo), false);
$$;

-- ¿Puede esa persona leer ese objeto? Los tipos espejan las fichas.
create or replace function privado.puede_ver_objeto_de(p_perfil uuid, p_tipo text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = org, sgc, flujo, public as $$
begin
  if p_perfil is null or p_id is null
     or not exists (select 1 from public.profiles where id = p_perfil and activo) then
    return false;
  end if;
  case p_tipo
    when 'unidad', 'plaza', 'cargo', 'persona' then
      return privado.puede_perfil(p_perfil, 'sistema:estructura', 'ver');
    when 'proceso' then
      return privado.puede_perfil(p_perfil, 'sistema:procesos', 'ver');
    when 'documento' then
      return privado.puede_perfil(p_perfil, 'sistema:documentos', 'ver')
         and exists (select 1 from sgc.documento d where d.id = p_id
                      and (d.perimetro = 'general' or privado.puede_perfil(p_perfil, 'sistema:perimetros', 'ver')));
    when 'requisicion' then
      return exists (select 1 from org.requisicion r where r.id = p_id
                      and (r.creado_por = p_perfil or privado.puede_perfil(p_perfil, 'sistema:requisiciones', 'ver')))
          or exists (select 1 from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
                      where s.objeto_id = p_id and p.aprobador_perfil = p_perfil);
    when 'escenario' then
      return privado.puede_perfil(p_perfil, 'sistema:escenarios', 'ver')
          or exists (select 1 from org.escenario e where e.id = p_id and e.creado_por = p_perfil)
          or exists (select 1 from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
                      where s.objeto_id = p_id and p.aprobador_perfil = p_perfil);
    else
      return false;
  end case;
end;
$$;

-- El nombre que se lee de una persona.
create or replace function privado.nombre_perfil(p_perfil uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(nombre_completo), ''), email) from public.profiles where id = p_perfil;
$$;

-- Cómo se llama un objeto en un aviso (solo se le manda a quien puede verlo).
create or replace function privado.titulo_objeto(p_tipo text, p_id uuid)
returns text language sql stable security definer set search_path = org, sgc, public as $$
  select coalesce(case p_tipo
    when 'unidad' then (select u.nombre from org.unidad u where u.ref = p_id and u.escenario_id is null
                         order by upper_inf(u.vigencia) desc, lower(u.vigencia) desc limit 1)
    when 'plaza' then (select c.nombre || coalesce(' · ' || u.nombre, '')
                         from org.plaza p join org.cargo c on c.id = p.cargo_id
                         left join lateral (select x.nombre from org.unidad x where x.ref = p.unidad_ref and x.escenario_id is null
                                             order by upper_inf(x.vigencia) desc, lower(x.vigencia) desc limit 1) u on true
                        where p.ref = p_id and p.escenario_id is null
                        order by upper_inf(p.vigencia) desc, lower(p.vigencia) desc limit 1)
    when 'cargo' then (select nombre from org.cargo where id = p_id)
    when 'persona' then (select nombre_completo from public.empleados where id = p_id)
    when 'requisicion' then (select 'Requisición N.º ' || numero from org.requisicion where id = p_id)
    when 'escenario' then (select 'Escenario «' || nombre || '»' from org.escenario where id = p_id)
    when 'proceso' then (select coalesce(codigo_sgc || ' · ', '') || nombre from sgc.proceso where ref = p_id and escenario_id is null
                          order by (estado = 'vigente') desc, version desc limit 1)
    when 'documento' then (select codigo || ' · ' || titulo from sgc.documento where id = p_id)
  end, 'un objeto');
$$;

-- El objeto de una solicitud de aprobación, en el vocabulario de las fichas.
-- Los procesos se firman por versión; la ficha es la del proceso (`ref`).
create or replace function privado.objeto_de_solicitud(p_tipo text, p_objeto uuid, out tipo text, out id uuid)
language sql stable security definer set search_path = sgc, public as $$
  select case p_tipo
           when 'requisicion_personal' then 'requisicion'
           when 'proceso' then 'proceso'
           when 'escenario_estructura' then 'escenario'
           when 'escenario_procesos' then 'escenario'
           else p_tipo end,
         case when p_tipo = 'proceso' then coalesce((select ref from sgc.proceso where sgc.proceso.id = p_objeto), p_objeto)
              else p_objeto end;
$$;

-- Quién puede decidir un paso (para avisarle), sin quien pidió.
create or replace function privado.aprobadores_de_paso(p_paso uuid)
returns setof uuid language sql stable security definer set search_path = flujo, public as $$
  with p as (select p.*, s.creado_por from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id where p.id = p_paso)
  select x.id from (
    select p.aprobador_perfil as id from p where p.aprobador_perfil is not null
    union
    select pr.id from p join public.profiles pr on pr.activo and pr.rol_id::text = p.regla ->> 'rol_id'
     where p.aprobador_perfil is null and p.regla ->> 'resolutor' = 'rol'
    union
    select pr.id from p join public.profiles pr on pr.activo
     where p.aprobador_perfil is null and coalesce(p.regla ->> 'resolutor', '') <> 'rol'
       and privado.puede_perfil(pr.id, 'sistema:aprobaciones', 'editar')
  ) x, p
  where x.id is distinct from p.creado_por;
$$;

-- Solo las de aquí: las de bloqueos del canal (mismo esquema) SÍ las ejecuta
-- `authenticated`, porque sus políticas las llaman.
revoke execute on function privado.puede_perfil(uuid, text, text), privado.puede_ver_objeto_de(uuid, text, uuid), privado.nombre_perfil(uuid),
  privado.titulo_objeto(text, uuid), privado.objeto_de_solicitud(text, uuid), privado.aprobadores_de_paso(uuid)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 1) TABLAS
-- -----------------------------------------------------------------------------

-- Lo que pasó en un objeto: comentarios, menciones, decisiones, IA, sistema.
-- Los cambios de datos NO se copian aquí: viven en `control.auditoria` y la
-- línea de tiempo los lee de allá (`nucleo.cambios`).
create table if not exists nucleo.evento (
  id           uuid primary key default gen_random_uuid(),
  objeto_tipo  text not null check (objeto_tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento')),
  objeto_id    uuid not null,
  tipo         text not null check (tipo in ('comentario', 'mencion', 'cambio', 'aprobacion', 'ia', 'sistema')),
  autor        uuid references public.profiles (id) on delete set null,
  actor_es_ia  boolean not null default false,
  capacidad_ia text,
  nivel_ia     text check (nivel_ia in ('N1', 'N2', 'N3', 'N4')),
  texto        text check (texto is null or length(texto) <= 4000),
  datos        jsonb not null default '{}'::jsonb,
  padre_id     uuid references nucleo.evento (id) on delete set null,
  creado_en    timestamptz not null default now(),
  editado_en   timestamptz,
  oculto       boolean not null default false,
  -- La IA dice qué capacidad y con qué nivel; una persona no lleva nivel.
  constraint evento_ia_coherente check ((actor_es_ia and capacidad_ia is not null and nivel_ia is not null) or (not actor_es_ia and nivel_ia is null))
);
create index if not exists evento_objeto_idx on nucleo.evento (objeto_tipo, objeto_id, creado_en desc);
create index if not exists evento_padre_idx on nucleo.evento (padre_id) where padre_id is not null;
alter table nucleo.evento enable row level security;

create table if not exists nucleo.seguimiento (
  perfil      uuid not null references public.profiles (id) on delete cascade,
  objeto_tipo text not null,
  objeto_id   uuid not null,
  creado_en   timestamptz not null default now(),
  primary key (perfil, objeto_tipo, objeto_id)
);
create index if not exists seguimiento_objeto_idx on nucleo.seguimiento (objeto_tipo, objeto_id);
alter table nucleo.seguimiento enable row level security;

create table if not exists nucleo.notificacion (
  id           uuid primary key default gen_random_uuid(),
  destinatario uuid not null references public.profiles (id) on delete cascade,
  tipo         text not null check (tipo in ('mencion', 'aprobacion', 'ia', 'sistema', 'seguimiento', 'tarea')),
  objeto_tipo  text,
  objeto_id    uuid,
  evento_id    uuid references nucleo.evento (id) on delete set null,
  actor        uuid references public.profiles (id) on delete set null,
  texto        text not null,
  detalle      text,
  -- A dónde lleva si no es un objeto con ficha (la bandeja, Mis tareas).
  enlace       text check (enlace is null or enlace like '/sistema%'),
  creado_en    timestamptz not null default now(),
  leida_en     timestamptz
);
create index if not exists notificacion_destinatario_idx on nucleo.notificacion (destinatario, creado_en desc);
create index if not exists notificacion_no_leidas_idx on nucleo.notificacion (destinatario) where leida_en is null;
alter table nucleo.notificacion enable row level security;

create table if not exists nucleo.tarea (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(trim(titulo)) between 3 and 200),
  detalle      text check (detalle is null or length(detalle) <= 2000),
  objeto_tipo  text check (objeto_tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento')),
  objeto_id    uuid,
  asignada_a   uuid not null references public.profiles (id),
  vence        date,
  estado       text not null default 'abierta' check (estado in ('abierta', 'hecha', 'cancelada')),
  creada_por   uuid not null default auth.uid() references public.profiles (id),
  creado_en    timestamptz not null default now(),
  cerrada_en   timestamptz,
  constraint tarea_objeto_completo check ((objeto_tipo is null) = (objeto_id is null))
);
create index if not exists tarea_asignada_idx on nucleo.tarea (asignada_a, estado, vence);
create index if not exists tarea_creada_idx on nucleo.tarea (creada_por, estado);
alter table nucleo.tarea enable row level security;

-- -----------------------------------------------------------------------------
-- 2) ¿PUEDO VER ESTE OBJETO? (expuesta: responde solo por quien pregunta)
-- -----------------------------------------------------------------------------
create or replace function nucleo.puede_ver_objeto(p_tipo text, p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select privado.puede_ver_objeto_de(auth.uid(), p_tipo, p_id);
$$;

-- -----------------------------------------------------------------------------
-- 3) RLS
-- -----------------------------------------------------------------------------
grant select, update on nucleo.evento to authenticated;
grant select, insert, delete on nucleo.seguimiento to authenticated;
grant select on nucleo.notificacion to authenticated;
grant select, insert, update, delete on nucleo.tarea to authenticated;
grant all on all tables in schema nucleo to service_role;

-- Un comentario oculto solo lo lee su autor (la auditoría guarda el original).
create policy "ver eventos del objeto" on nucleo.evento for select to authenticated
  using (nucleo.puede_ver_objeto(objeto_tipo, objeto_id) and (not oculto or autor = auth.uid()));
-- Comentar va solo por `nucleo.comentar` (pone al autor = quien llama, valida
-- el hilo y las menciones): no hay política de INSERT.
create policy "editar lo propio" on nucleo.evento for update to authenticated
  using (tipo = 'comentario' and autor = auth.uid())
  with check (tipo = 'comentario' and autor = auth.uid());

create policy "mis seguimientos" on nucleo.seguimiento for select to authenticated using (perfil = auth.uid());
create policy "seguir lo que veo" on nucleo.seguimiento for insert to authenticated
  with check (perfil = auth.uid() and nucleo.puede_ver_objeto(objeto_tipo, objeto_id));
create policy "dejar de seguir" on nucleo.seguimiento for delete to authenticated using (perfil = auth.uid());

create policy "mis notificaciones" on nucleo.notificacion for select to authenticated using (destinatario = auth.uid());

create policy "mis tareas" on nucleo.tarea for select to authenticated
  using (asignada_a = auth.uid() or creada_por = auth.uid());
create policy "crear tareas" on nucleo.tarea for insert to authenticated
  with check (creada_por = auth.uid() and (objeto_id is null or nucleo.puede_ver_objeto(objeto_tipo, objeto_id)));
create policy "llevar mis tareas" on nucleo.tarea for update to authenticated
  using (asignada_a = auth.uid() or creada_por = auth.uid())
  with check (asignada_a = auth.uid() or creada_por = auth.uid());
create policy "borrar lo que creé" on nucleo.tarea for delete to authenticated using (creada_por = auth.uid());

-- -----------------------------------------------------------------------------
-- 4) COMENTARIOS: la ventana de 15 minutos y la auditoría
-- -----------------------------------------------------------------------------
create or replace function nucleo.evento_proteger()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- mantenimiento con la clave de servicio
  if old.tipo <> 'comentario' or old.autor is distinct from auth.uid() then
    raise exception 'Solo se corrige un comentario propio' using errcode = 'insufficient_privilege';
  end if;
  if old.creado_en < now() - interval '15 minutes' then
    raise exception 'Pasaron más de 15 minutos: el comentario ya no se edita ni se oculta' using errcode = 'check_violation';
  end if;
  -- Solo cambian el texto y si está oculto; lo demás queda como nació.
  new.id := old.id; new.objeto_tipo := old.objeto_tipo; new.objeto_id := old.objeto_id; new.tipo := old.tipo;
  new.autor := old.autor; new.actor_es_ia := old.actor_es_ia; new.capacidad_ia := old.capacidad_ia;
  new.nivel_ia := old.nivel_ia; new.datos := old.datos; new.padre_id := old.padre_id; new.creado_en := old.creado_en;
  if coalesce(trim(new.texto), '') = '' then
    raise exception 'El comentario no puede quedar vacío' using errcode = 'check_violation';
  end if;
  new.editado_en := case when new.texto is distinct from old.texto then now() else old.editado_en end;
  return new;
end;
$$;
create trigger evento_proteger before update on nucleo.evento
  for each row execute function nucleo.evento_proteger();
-- La auditoría guarda el antes y el después de cada corrección.
create trigger auditar after update or delete on nucleo.evento
  for each row execute function control.auditar();

-- Comentar (con menciones): valida, guarda, avisa a los mencionados que pueden
-- ver el objeto y deja a quien comenta siguiendo el objeto.
create or replace function nucleo.comentar(p_tipo text, p_id uuid, p_texto text, p_padre uuid default null, p_menciones uuid[] default '{}')
returns uuid
language plpgsql security definer set search_path = nucleo, public as $$
declare
  v_id uuid;
  v_padre uuid := p_padre;
  v_menciones uuid[];
  v_titulo text;
  v_autor text;
begin
  if auth.uid() is null then raise exception 'Sin sesión' using errcode = 'insufficient_privilege'; end if;
  if coalesce(trim(p_texto), '') = '' then raise exception 'Escribe algo antes de comentar' using errcode = 'check_violation'; end if;
  if length(p_texto) > 4000 then raise exception 'El comentario pasa de 4.000 caracteres' using errcode = 'check_violation'; end if;
  if not nucleo.puede_ver_objeto(p_tipo, p_id) then
    raise exception 'Ese objeto no está a tu alcance' using errcode = 'insufficient_privilege';
  end if;
  -- Las respuestas van a un solo nivel: responder a una respuesta cuelga del hilo.
  if v_padre is not null then
    select coalesce(e.padre_id, e.id) into v_padre from nucleo.evento e
     where e.id = p_padre and e.objeto_tipo = p_tipo and e.objeto_id = p_id;
    if v_padre is null then raise exception 'El comentario al que respondes no es de este objeto' using errcode = 'check_violation'; end if;
  end if;

  select coalesce(array_agg(distinct m), '{}') into v_menciones
    from unnest(coalesce(p_menciones, '{}')) m
   where m is distinct from auth.uid() and privado.puede_ver_objeto_de(m, p_tipo, p_id);

  insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, texto, padre_id, datos)
  values (p_tipo, p_id, 'comentario', auth.uid(), trim(p_texto), v_padre,
          case when cardinality(v_menciones) > 0 then jsonb_build_object('menciones', to_jsonb(v_menciones)) else '{}'::jsonb end)
  returning id into v_id;

  if cardinality(v_menciones) > 0 then
    v_titulo := privado.titulo_objeto(p_tipo, p_id);
    v_autor := privado.nombre_perfil(auth.uid());
    insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, evento_id, actor, texto, detalle)
    select m, 'mencion', p_tipo, p_id, v_id, auth.uid(), format('%s te mencionó en %s', v_autor, v_titulo), left(trim(p_texto), 200)
      from unnest(v_menciones) m;
  end if;

  insert into nucleo.seguimiento (perfil, objeto_tipo, objeto_id) values (auth.uid(), p_tipo, p_id) on conflict do nothing;
  return v_id;
end;
$$;

-- A quién se puede mencionar en un objeto: personas activas que pueden verlo.
-- `profiles` solo la lee su dueño; esto da nombre y cargo, nada más.
create or replace function nucleo.mencionables(p_tipo text, p_id uuid, p_q text default '')
returns table (id uuid, nombre text, cargo text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_q text := lower(coalesce(trim(p_q), ''));
begin
  if not nucleo.puede_ver_objeto(p_tipo, p_id) then return; end if;
  return query
  select p.id, coalesce(nullif(trim(p.nombre_completo), ''), p.email), p.cargo
    from public.profiles p
   where p.activo and p.id <> auth.uid()
     and (v_q = '' or ui.plano(coalesce(p.nombre_completo, '') || ' ' || p.email) like '%' || ui.plano(v_q) || '%')
     and privado.puede_ver_objeto_de(p.id, p_tipo, p_id)
   order by p.nombre_completo nulls last
   limit 8;
end;
$$;

-- A quién se le puede asignar una tarea: quien entra a la plataforma.
create or replace function nucleo.personas(p_q text default '')
returns table (id uuid, nombre text, cargo text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.nombre_completo), ''), p.email), p.cargo
    from public.profiles p
   where auth.uid() is not null and p.activo
     and (p.rol = 'admin' or exists (select 1 from public.rol_permisos rp where rp.rol_id = p.rol_id and rp.recurso like 'sistema:%' and rp.ver))
     and (coalesce(trim(p_q), '') = '' or ui.plano(coalesce(p.nombre_completo, '') || ' ' || p.email) like '%' || ui.plano(trim(p_q)) || '%')
   order by (p.id = auth.uid()) desc, p.nombre_completo nulls last
   limit 10;
$$;

-- Los nombres de quienes aparecen en una línea de tiempo (autores y actores).
create or replace function nucleo.nombres(p_ids uuid[])
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.nombre_completo), ''), p.email)
    from public.profiles p where auth.uid() is not null and p.id = any (p_ids);
$$;

-- Cómo se llaman unos objetos, solo los que quien pregunta puede ver (tareas,
-- notificaciones). Los que no están a su alcance no salen.
create or replace function nucleo.titulos_objetos(p_tipos text[], p_ids uuid[])
returns table (tipo text, id uuid, titulo text)
language sql stable security definer set search_path = public as $$
  select x.t, x.i, privado.titulo_objeto(x.t, x.i)
    from unnest(p_tipos, p_ids) as x(t, i)
   where nucleo.puede_ver_objeto(x.t, x.i);
$$;
revoke execute on function nucleo.titulos_objetos(text[], uuid[]) from public, anon;
grant execute on function nucleo.titulos_objetos(text[], uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) LOS CAMBIOS DEL OBJETO (de la auditoría), para quien puede ver el objeto
--    Solo el diff de las columnas que cambiaron, sin las técnicas.
-- -----------------------------------------------------------------------------
create or replace function nucleo.cambios(p_tipo text, p_id uuid, p_limite integer default 60)
returns table (id bigint, en timestamptz, accion text, tabla text, actor uuid, actor_nombre text, cambios jsonb, extra jsonb)
language plpgsql stable security definer set search_path = control, org, sgc, public as $$
declare
  v_ids text[];
  v_tablas text[];
begin
  if not nucleo.puede_ver_objeto(p_tipo, p_id) then return; end if;
  case p_tipo
    when 'unidad' then
      v_tablas := array['org.unidad'];
      select array_agg(u.id::text) into v_ids from org.unidad u where u.ref = p_id and u.escenario_id is null;
    when 'plaza' then
      v_tablas := array['org.plaza', 'org.ocupacion'];
      select array_agg(x) into v_ids from (
        select p.id::text x from org.plaza p where p.ref = p_id and p.escenario_id is null
        union all select o.id::text from org.ocupacion o where o.plaza_ref = p_id) s;
    when 'cargo' then v_tablas := array['org.cargo']; v_ids := array[p_id::text];
    when 'persona' then
      v_tablas := array['org.ocupacion'];
      select array_agg(o.id::text) into v_ids from org.ocupacion o where o.empleado_id = p_id;
    when 'requisicion' then v_tablas := array['org.requisicion']; v_ids := array[p_id::text];
    when 'escenario' then v_tablas := array['org.escenario']; v_ids := array[p_id::text];
    when 'proceso' then
      v_tablas := array['sgc.proceso'];
      select array_agg(p.id::text) into v_ids from sgc.proceso p where p.ref = p_id and p.escenario_id is null;
    when 'documento' then v_tablas := array['sgc.documento']; v_ids := array[p_id::text];
    else return;
  end case;
  if v_ids is null then return; end if;

  return query
  select a.id, a.en, a.accion, a.esquema || '.' || a.tabla, a.actor, privado.nombre_perfil(a.actor),
         case when a.accion = 'UPDATE' then (
           select jsonb_object_agg(k, jsonb_build_array(a.antes -> k, a.despues -> k))
             from jsonb_object_keys(a.despues) k
            where k not in ('id', 'ref', 'busqueda', 'esc', 'escenario_id', 'creado_en', 'creado_por', 'actualizado_en',
                            'updated_at', 'origen_cat', 'nomina_cat', 'tipo_cat', 'impacto', 'solicitud_id')
              and (a.antes -> k) is distinct from (a.despues -> k))
         end,
         (select jsonb_object_agg(k, v) from jsonb_each(coalesce(a.despues, a.antes)) e(k, v)
           where k in ('nombre', 'titulo', 'version', 'vigencia', 'estado', 'tipo', 'dotacion', 'cantidad', 'numero', 'empleado_id', 'plaza_ref'))
    from control.auditoria a
   where a.esquema || '.' || a.tabla = any (v_tablas) and a.registro_id = any (v_ids)
   order by a.en desc
   limit least(greatest(coalesce(p_limite, 60), 1), 200);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) SEGUIR: cada evento nuevo avisa a quien sigue el objeto (menos al autor,
--    a los mencionados —ya tienen el suyo— y a quien ya no puede verlo).
-- -----------------------------------------------------------------------------
create or replace function nucleo.avisar_seguidores()
returns trigger language plpgsql security definer set search_path = nucleo, public as $$
declare
  v_titulo text;
  v_quien text;
  v_texto text;
  v_menciones uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(new.datos -> 'menciones') x), '{}');
  v_pidio uuid := nullif(new.datos ->> 'pedido_por', '')::uuid;
begin
  if not exists (select 1 from nucleo.seguimiento s where s.objeto_tipo = new.objeto_tipo and s.objeto_id = new.objeto_id) then
    return null;
  end if;
  v_titulo := privado.titulo_objeto(new.objeto_tipo, new.objeto_id);
  v_quien := case when new.actor_es_ia then 'La IA (' || coalesce(new.capacidad_ia, 'capacidad') || ')'
                  else coalesce(privado.nombre_perfil(new.autor), 'El sistema') end;
  v_texto := case new.tipo
    when 'comentario' then format('%s %s en %s', v_quien, case when new.padre_id is null then 'comentó' else 'respondió' end, v_titulo)
    when 'aprobacion' then format('%s: %s', v_titulo, coalesce(new.datos ->> 'resumen', 'novedad en su aprobación'))
    when 'ia' then format('%s propone algo en %s (%s)', v_quien, v_titulo, new.nivel_ia)
    else format('Novedad en %s', v_titulo) end;

  insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, evento_id, actor, texto, detalle)
  select s.perfil, 'seguimiento', new.objeto_tipo, new.objeto_id, new.id, new.autor, v_texto, left(new.texto, 200)
    from nucleo.seguimiento s
   where s.objeto_tipo = new.objeto_tipo and s.objeto_id = new.objeto_id
     and s.perfil is distinct from new.autor
     and not (s.perfil = any (v_menciones))
     and s.perfil is distinct from v_pidio      -- quien pidió ya recibe su aviso de la aprobación
     and privado.puede_ver_objeto_de(s.perfil, new.objeto_tipo, new.objeto_id);
  return null;
exception when others then
  raise warning 'nucleo.avisar_seguidores: %', sqlerrm;
  return null;
end;
$$;
create trigger avisar_seguidores after insert on nucleo.evento
  for each row execute function nucleo.avisar_seguidores();

-- -----------------------------------------------------------------------------
-- 7) NOTIFICACIONES: marcar leídas (la tabla no se escribe desde la API)
-- -----------------------------------------------------------------------------
create or replace function nucleo.marcar_leidas(p_ids uuid[] default null)
returns integer language sql security definer set search_path = nucleo, public as $$
  with x as (
    update nucleo.notificacion set leida_en = now()
     where destinatario = auth.uid() and leida_en is null and (p_ids is null or id = any (p_ids))
    returning 1)
  select count(*)::int from x;
$$;

create or replace function nucleo.no_leidas()
returns integer language sql stable security definer set search_path = nucleo, public as $$
  select count(*)::int from nucleo.notificacion where destinatario = auth.uid() and leida_en is null;
$$;

-- -----------------------------------------------------------------------------
-- 8) TAREAS: quién la cambia, a quién se le asigna y el aviso
-- -----------------------------------------------------------------------------
create or replace function nucleo.tarea_reglas()
returns trigger language plpgsql security definer set search_path = nucleo, public as $$
begin
  if tg_op = 'UPDATE' then
    new.creada_por := old.creada_por;
    new.creado_en := old.creado_en;
    -- Reasignar o mover la tarea a otro objeto es de quien la creó.
    if (new.asignada_a is distinct from old.asignada_a or new.objeto_id is distinct from old.objeto_id)
       and auth.uid() is not null and auth.uid() is distinct from old.creada_por then
      raise exception 'Solo quien creó la tarea la reasigna' using errcode = 'insufficient_privilege';
    end if;
    new.cerrada_en := case when new.estado = 'abierta' then null
                           when old.estado = 'abierta' then now() else old.cerrada_en end;
  end if;
  if not exists (select 1 from public.profiles where id = new.asignada_a and activo) then
    raise exception 'Esa persona no tiene una cuenta activa' using errcode = 'check_violation';
  end if;
  if new.objeto_id is not null and not privado.puede_ver_objeto_de(new.asignada_a, new.objeto_tipo, new.objeto_id) then
    raise exception 'Esa persona no puede ver ese objeto: asígnasela a alguien con acceso' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger tarea_reglas before insert or update on nucleo.tarea
  for each row execute function nucleo.tarea_reglas();

create or replace function nucleo.tarea_avisar()
returns trigger language plpgsql security definer set search_path = nucleo, public as $$
begin
  if new.asignada_a is distinct from new.creada_por
     and (tg_op = 'INSERT' or new.asignada_a is distinct from old.asignada_a) then
    insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle, enlace)
    values (new.asignada_a, 'tarea', new.objeto_tipo, new.objeto_id, new.creada_por,
            format('%s te asignó una tarea: %s', coalesce(privado.nombre_perfil(new.creada_por), 'Alguien'), new.titulo),
            case when new.vence is not null then 'Vence el ' || to_char(new.vence, 'DD/MM/YYYY') end,
            case when new.objeto_id is null then '/sistema/tareas' end);
  end if;
  -- Quien creó la tarea se entera cuando se cierra.
  if tg_op = 'UPDATE' and old.estado = 'abierta' and new.estado <> 'abierta'
     and new.creada_por is distinct from coalesce(auth.uid(), new.asignada_a) then
    insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, enlace)
    values (new.creada_por, 'tarea', new.objeto_tipo, new.objeto_id, auth.uid(),
            format('%s %s la tarea: %s', coalesce(privado.nombre_perfil(auth.uid()), 'Alguien'),
                   case new.estado when 'hecha' then 'terminó' else 'canceló' end, new.titulo),
            case when new.objeto_id is null then '/sistema/tareas' end);
  end if;
  return null;
exception when others then
  raise warning 'nucleo.tarea_avisar: %', sqlerrm;
  return null;
end;
$$;
create trigger tarea_avisar after insert or update on nucleo.tarea
  for each row execute function nucleo.tarea_avisar();

-- -----------------------------------------------------------------------------
-- 9) APROBACIONES → línea de tiempo y avisos
-- -----------------------------------------------------------------------------

-- Cada decisión queda en la línea de tiempo del objeto.
create or replace function nucleo.al_decidir_paso()
returns trigger language plpgsql security definer set search_path = nucleo, flujo, public as $$
declare
  s flujo.solicitud;
  o record;
begin
  if old.decision <> 'pendiente' or new.decision not in ('aprobado', 'rechazado', 'devuelto') then return null; end if;
  select * into s from flujo.solicitud where id = new.solicitud_id;
  select * into o from privado.objeto_de_solicitud(s.tipo_objeto, s.objeto_id);
  if o.tipo not in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento') then return null; end if;
  insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, texto, datos, creado_en)
  values (o.tipo, o.id, 'aprobacion', new.decidido_por, nullif(trim(new.comentario), ''),
          jsonb_build_object('accion', new.decision, 'paso', new.nombre, 'orden', new.orden, 'solicitud_id', s.id,
                             'titulo', s.titulo, 'pedido_por', s.creado_por,
                             'resumen', format('%s «%s»', case new.decision when 'aprobado' then 'se aprobó' when 'rechazado' then 'se rechazó' else 'se devolvió' end, new.nombre)),
          coalesce(new.decidido_en, now()));
  return null;
exception when others then
  -- Una línea de tiempo que falla no tumba la decisión.
  raise warning 'nucleo.al_decidir_paso: %', sqlerrm;
  return null;
end;
$$;
create trigger nucleo_al_decidir after update of decision on flujo.paso
  for each row execute function nucleo.al_decidir_paso();

-- La solicitud: enviada (a la línea de tiempo), un paso que se vuelve el actual
-- (aviso a quien le toca), avance y cierre (aviso a quien pidió).
create or replace function nucleo.al_mover_solicitud()
returns trigger language plpgsql security definer set search_path = nucleo, flujo, public as $$
declare
  o record;
  p flujo.paso;
  v_anterior flujo.paso;
begin
  select * into o from privado.objeto_de_solicitud(new.tipo_objeto, new.objeto_id);
  if o.tipo not in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento') then return null; end if;

  if tg_op = 'INSERT' then
    insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, datos, creado_en)
    values (o.tipo, o.id, 'aprobacion', new.creado_por,
            jsonb_build_object('accion', 'enviada', 'solicitud_id', new.id, 'titulo', new.titulo, 'pedido_por', new.creado_por,
                               'resumen', 'se envió a aprobación'),
            new.creado_en);
    return null;
  end if;

  -- Lo que avisaba «te toca decidir» sobre este objeto ya no aplica cuando la
  -- solicitud avanza o se cierra: se da por leído (los avisos nuevos van abajo).
  if new.paso_actual is distinct from old.paso_actual or new.estado is distinct from old.estado then
    update nucleo.notificacion set leida_en = now()
     where tipo = 'aprobacion' and enlace = '/sistema/bandeja' and objeto_tipo = o.tipo and objeto_id = o.id and leida_en is null;
  end if;

  -- Un paso se vuelve el actual: avisar a quien puede decidirlo.
  if new.estado = 'en_curso' and new.paso_actual is not null
     and (new.paso_actual is distinct from old.paso_actual or old.estado <> 'en_curso') then
    select * into p from flujo.paso where solicitud_id = new.id and orden = new.paso_actual;
    insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle, enlace)
    select a, 'aprobacion', o.tipo, o.id, new.creado_por,
           format('Te toca decidir «%s»: %s', p.nombre, new.titulo),
           'Pidió ' || coalesce(privado.nombre_perfil(new.creado_por), '—'), '/sistema/bandeja'
      from privado.aprobadores_de_paso(p.id) a;
    -- Y a quien pidió, que avanzó (si no es el primer paso).
    if old.paso_actual is not null and new.paso_actual > old.paso_actual and new.creado_por is not null then
      select * into v_anterior from flujo.paso where solicitud_id = new.id and orden = old.paso_actual;
      insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle)
      values (new.creado_por, 'aprobacion', o.tipo, o.id, v_anterior.decidido_por,
              format('%s: se aprobó «%s» y pasa a «%s»', new.titulo, v_anterior.nombre, p.nombre),
              nullif(trim(v_anterior.comentario), ''));
    end if;
  end if;

  -- Se cerró: avisar a quien pidió (salvo que la cierre él mismo).
  if old.estado = 'en_curso' and new.estado <> 'en_curso' then
    if new.creado_por is not null and new.creado_por is distinct from auth.uid() then
      select * into v_anterior from flujo.paso where solicitud_id = new.id and decidido_en is not null
       order by decidido_en desc limit 1;
      insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle)
      values (new.creado_por, 'aprobacion', o.tipo, o.id, v_anterior.decidido_por,
              format('Tu solicitud «%s» quedó %s', new.titulo,
                     case new.estado when 'aprobada' then 'aprobada' when 'rechazada' then 'rechazada'
                                     when 'devuelta' then 'devuelta para corregir' else 'cancelada' end),
              case when new.estado in ('rechazada', 'devuelta') then nullif(trim(v_anterior.comentario), '') end);
    end if;
    if new.estado = 'cancelada' then
      insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, datos)
      values (o.tipo, o.id, 'aprobacion', auth.uid(),
              jsonb_build_object('accion', 'cancelada', 'solicitud_id', new.id, 'titulo', new.titulo, 'pedido_por', new.creado_por,
                                 'resumen', 'se canceló la solicitud'));
    end if;
  end if;
  return null;
exception when others then
  -- Un aviso que falla no tumba la aprobación (la misma regla de los avisos del canal).
  raise warning 'nucleo.al_mover_solicitud: %', sqlerrm;
  return null;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10) LO QUE YA HABÍA: decisiones pasadas a la línea de tiempo, y un aviso por
--     cada paso que hoy espera decisión. Antes de crear el trigger de la
--     solicitud, para que no se dispare con esto.
-- -----------------------------------------------------------------------------
insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, datos, creado_en)
select o.tipo, o.id, 'aprobacion', s.creado_por,
       jsonb_build_object('accion', 'enviada', 'solicitud_id', s.id, 'titulo', s.titulo, 'pedido_por', s.creado_por, 'resumen', 'se envió a aprobación'),
       s.creado_en
  from flujo.solicitud s cross join lateral privado.objeto_de_solicitud(s.tipo_objeto, s.objeto_id) o
 where o.tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento')
   and not exists (select 1 from nucleo.evento e where e.tipo = 'aprobacion' and e.datos ->> 'solicitud_id' = s.id::text and e.datos ->> 'accion' = 'enviada');

insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, texto, datos, creado_en)
select o.tipo, o.id, 'aprobacion', p.decidido_por, nullif(trim(p.comentario), ''),
       jsonb_build_object('accion', p.decision, 'paso', p.nombre, 'orden', p.orden, 'solicitud_id', s.id, 'titulo', s.titulo,
                          'pedido_por', s.creado_por,
                          'resumen', format('%s «%s»', case p.decision when 'aprobado' then 'se aprobó' when 'rechazado' then 'se rechazó' else 'se devolvió' end, p.nombre)),
       p.decidido_en
  from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
  cross join lateral privado.objeto_de_solicitud(s.tipo_objeto, s.objeto_id) o
 where p.decision in ('aprobado', 'rechazado', 'devuelto') and p.decidido_en is not null
   and o.tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento')
   and not exists (select 1 from nucleo.evento e where e.tipo = 'aprobacion' and e.datos ->> 'solicitud_id' = s.id::text
                    and (e.datos ->> 'orden')::int = p.orden);

insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle, enlace, creado_en)
select a, 'aprobacion', o.tipo, o.id, s.creado_por,
       format('Te toca decidir «%s»: %s', p.nombre, s.titulo),
       'Pidió ' || coalesce(privado.nombre_perfil(s.creado_por), '—'), '/sistema/bandeja',
       coalesce((select max(q.decidido_en) from flujo.paso q where q.solicitud_id = s.id), s.creado_en)
  from flujo.solicitud s
  join flujo.paso p on p.solicitud_id = s.id and p.orden = s.paso_actual and p.decision = 'pendiente'
  cross join lateral privado.objeto_de_solicitud(s.tipo_objeto, s.objeto_id) o
  cross join lateral privado.aprobadores_de_paso(p.id) a
 where s.estado = 'en_curso';

create trigger nucleo_al_mover after insert or update of paso_actual, estado on flujo.solicitud
  for each row execute function nucleo.al_mover_solicitud();

-- -----------------------------------------------------------------------------
-- 11) PERMISOS DE EJECUCIÓN
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema nucleo from public, anon;
grant execute on function nucleo.puede_ver_objeto(text, uuid), nucleo.comentar(text, uuid, text, uuid, uuid[]),
  nucleo.mencionables(text, uuid, text), nucleo.personas(text), nucleo.nombres(uuid[]),
  nucleo.cambios(text, uuid, integer), nucleo.marcar_leidas(uuid[]), nucleo.no_leidas()
  to authenticated;
