-- =============================================================================
-- Reportar contenido y bloquear personas en el canal
-- =============================================================================
--
-- 6 de noviembre de 2026. La guía 1.2 de la App Store (contenido generado por
-- usuarios) pide, para una app donde la gente se escribe, tres cosas que el canal
-- no tenía: poder reportar lo que se lee, poder bloquear a quien molesta, y que
-- alguien del lado de la empresa reciba esos reportes. Esta migración pone la
-- parte de la base; la interfaz está en `app/canal` y en `/dashboard/reportes`.
--
-- ── Bloquear ─────────────────────────────────────────────────────────────────
--
-- `bloqueos(bloqueador, bloqueado)`. Mientras A bloquea a B:
--
--   · A no ve lo de B: ni sus publicaciones, ni sus comentarios, ni sus mensajes
--     (en un grupo, los mensajes de B se ocultan solo para A: el grupo sigue).
--   · B no puede abrirle una conversación directa a A, ni escribirle en la que ya
--     tenían, ni pedirle conexión. En un grupo B escribe igual; A no lo lee.
--   · A no recibe avisos al teléfono de lo que B escribe.
--   · Los comunicados `oficial` se ven siempre: son la comunicación obligatoria de
--     la empresa y ocultar uno por haber bloqueado a quien lo firmó dejaría a
--     alguien sin enterarse de lo que la empresa tiene que decirle a todos.
--
-- Todo eso lo hace la base, no la pantalla. Y **a B nunca se le dice**: B no puede
-- leer `bloqueos` (cada quien lee solo los suyos), y lo único que ve es que su
-- mensaje no sale. ⚠️ Residual aceptado: una escritura rechazada es observable por
-- quien la prueba a propósito contra la API (intentar escribirle a A y ver que la
-- base lo rechaza); es el precio de rechazar en vez de aceptar y descartar. Lo que
-- sí está cerrado es preguntárselo a la base directamente (ver abajo).
--
-- ⚠️ Las preguntas viven en funciones `security definer` y no en la política
-- misma: «¿A bloqueó a B?» lee `bloqueos`, y B no tiene permiso de leer esa fila.
-- Es la misma salida que `participo_en` (AGENTS.md, «Trampas conocidas»).
--
-- 🔴 Pero una función `security definer` con EXECUTE para `authenticated` en el
-- esquema `public` es una función que PostgREST expone: cualquier empleado podría
-- llamar `me_bloqueo(a)` por la API y averiguar, sin efectos, quién lo bloqueó. Las
-- políticas necesitan que el rol que consulta pueda ejecutar la función, así que
-- revocar no alcanza. Por eso toda función que responde «¿esa persona me bloqueó?»
-- vive en el esquema `privado`, que **no está entre los esquemas expuestos de la
-- API** (los de Supabase son `public` y `graphql_public`): desde la API no se puede
-- llamar, y desde una política sí. Solo `he_bloqueado` («¿yo la bloqueé?») queda en
-- `public`: contesta únicamente sobre los bloqueos propios, que ya se leen.
--
-- ── Reportar ─────────────────────────────────────────────────────────────────
--
-- `reportes`: una fila por (quien reporta, qué reporta). Solo se escribe por
-- `reportar_contenido()`: la función comprueba que quien reporta puede ver lo que
-- reporta, que no es suyo, y **congela un extracto** de lo reportado. Así el
-- equipo lee el reporte sin tener acceso a las conversaciones —un mensaje directo
-- sigue siendo privado salvo el que alguien reportó— y el reporte sigue diciendo
-- lo mismo aunque el autor lo edite o lo borre después.
--
-- Lo lee quien tenga la casilla `modulo:reportes`. **Quien reporta no se ve desde
-- el lado de quien fue reportado**: la tabla no se lee fuera del equipo, y el
-- reporte no cambia nada visible para el autor.
--
-- Ocultar lo reportado no destruye nada: mensajes y comentarios pasan a `oculto`,
-- una publicación a `archivado`, y se restauran con la misma función. Una
-- publicación que ya estaba archivada, o un mensaje ya eliminado, no se toca.
-- -----------------------------------------------------------------------------

-- --- Los bloqueos --------------------------------------------------------------

create table if not exists public.bloqueos (
  id            uuid primary key default gen_random_uuid(),
  bloqueador_id uuid not null references public.empleados (id) on delete cascade,
  bloqueado_id  uuid not null references public.empleados (id) on delete cascade,
  created_at    timestamptz not null default now(),
  check (bloqueador_id <> bloqueado_id),
  unique (bloqueador_id, bloqueado_id)
);

comment on table public.bloqueos is
  'Quién bloqueó a quién en el canal. Cada quien lee solo los suyos: la persona bloqueada no se entera.';

alter table public.bloqueos enable row level security;
revoke all on table public.bloqueos from anon, authenticated;
grant select, insert, delete on table public.bloqueos to authenticated;

create policy "veo mis bloqueos" on public.bloqueos
  for select to authenticated
  using (bloqueador_id = public.mi_empleado());

create policy "bloqueo yo" on public.bloqueos
  for insert to authenticated
  with check (bloqueador_id = public.mi_empleado());

create policy "desbloqueo yo" on public.bloqueos
  for delete to authenticated
  using (bloqueador_id = public.mi_empleado());

-- --- Las preguntas que las políticas necesitan ------------------------------------

-- ¿Yo bloqueé a esta persona? Es lo que esconde su contenido de mis ojos.
create or replace function public.he_bloqueado(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bloqueos b
     where b.bloqueador_id = public.mi_empleado()
       and b.bloqueado_id = p_otro
  );
$$;

-- --- El esquema que la API no expone ------------------------------------------
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

comment on schema privado is
  'Funciones que las políticas RLS necesitan y que PostgREST no debe exponer. No añadirlo a los esquemas expuestos de la API.';

-- ¿Esa persona me bloqueó a mí? Es lo que le impide escribirme. Solo se llama
-- desde las políticas y las funciones de abajo: nunca desde la API.
create or replace function privado.me_bloqueo(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.bloqueos b
     where b.bloqueador_id = p_otro
       and b.bloqueado_id = public.mi_empleado()
  );
$$;

-- Hay un bloqueo entre las dos, en el sentido que sea.
create or replace function privado.hay_bloqueo(p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.he_bloqueado(p_otro) or privado.me_bloqueo(p_otro);
$$;

-- ¿Este hilo directo tiene un bloqueo entre quien pregunta y la otra persona?
-- Un grupo nunca se cierra por un bloqueo: sigue funcionando para los demás.
create or replace function privado.conversacion_bloqueada(p_conversacion uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.conversaciones c
      join public.conversacion_participantes p on p.conversacion_id = c.id
     where c.id = p_conversacion
       and c.tipo = 'directa'
       and p.empleado_id is distinct from public.mi_empleado()
       and privado.hay_bloqueo(p.empleado_id)
  );
$$;

-- ¿Sumar a `p_otro` a este hilo cruzaría un bloqueo? Solo cuenta en hilos
-- directos: abrirle a alguien una conversación que esa persona bloqueó.
create or replace function privado.bloqueo_al_sumar(p_conversacion uuid, p_otro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversaciones c
     where c.id = p_conversacion
       and c.tipo = 'directa'
       and privado.hay_bloqueo(p_otro)
  );
$$;

revoke execute on function public.he_bloqueado(uuid) from public, anon;
grant execute on function public.he_bloqueado(uuid) to authenticated;

revoke execute on function privado.me_bloqueo(uuid) from public, anon;
revoke execute on function privado.hay_bloqueo(uuid) from public, anon;
revoke execute on function privado.conversacion_bloqueada(uuid) from public, anon;
revoke execute on function privado.bloqueo_al_sumar(uuid, uuid) from public, anon;
grant execute on function privado.me_bloqueo(uuid) to authenticated;
grant execute on function privado.hay_bloqueo(uuid) to authenticated;
grant execute on function privado.conversacion_bloqueada(uuid) to authenticated;
grant execute on function privado.bloqueo_al_sumar(uuid, uuid) to authenticated;

-- --- Mensajes -------------------------------------------------------------------
-- Leer: no los de quien bloqueé, y solo los visibles (un mensaje que el equipo
-- ocultó deja de leerse para todos). Escribir: no en un hilo directo donde hay un
-- bloqueo, de ninguno de los dos lados.

drop policy if exists "leo mis mensajes" on public.mensajes;
create policy "leo mis mensajes" on public.mensajes
  for select to authenticated
  using (
    estado = 'visible'
    and public.participo_en(conversacion_id)
    and not public.he_bloqueado(autor_id)
  );

drop policy if exists "escribo donde participo" on public.mensajes;
create policy "escribo donde participo" on public.mensajes
  for insert to authenticated
  with check (
    autor_id = public.mi_empleado()
    and public.participo_en(conversacion_id)
    and not privado.conversacion_bloqueada(conversacion_id)
  );

-- --- Abrir una conversación -------------------------------------------------------
-- Mi propia fila entra siempre. La de la otra persona, no si cruza un bloqueo.

drop policy if exists "armo la conversacion" on public.conversacion_participantes;
create policy "armo la conversacion" on public.conversacion_participantes
  for insert to authenticated
  with check (
    empleado_id = public.mi_empleado()
    or (
      public.participo_en(conversacion_id)
      and public.cabe_otro_participante(conversacion_id)
      and not privado.bloqueo_al_sumar(conversacion_id, empleado_id)
    )
  );

-- Los no leídos del pie no cuentan lo de quien bloqueé.
create or replace function public.mensajes_sin_leer()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.conversacion_participantes p
   where p.empleado_id = public.mi_empleado()
     and exists (
       select 1 from public.mensajes m
        where m.conversacion_id = p.conversacion_id
          and m.autor_id <> p.empleado_id
          and m.estado = 'visible'
          and not public.he_bloqueado(m.autor_id)
          and (p.visto_en is null or m.created_at > p.visto_en)
     );
$$;

-- --- Comentarios ------------------------------------------------------------------
-- Los de quien bloqueé no se ven (el conteo del feed, que cuenta lo que la RLS
-- deja ver, tampoco los suma).

drop policy if exists "comentarios visibles" on public.comentarios;
create policy "comentarios visibles" on public.comentarios
  for select to authenticated
  using (
    (estado = 'visible' or empleado_id = public.mi_empleado() or public.puede_publicar())
    and not public.he_bloqueado(empleado_id)
  );

-- --- Publicaciones ------------------------------------------------------------------
-- ⚠️ Las políticas se suman con OR, y «publican los autorizados» era `for all`:
-- también autorizaba el SELECT de cualquier publicación a quien puede publicar,
-- así que filtrar solo «feed publicado» no habría escondido nada a esas personas.
-- Se parte en insert, update y delete, y el SELECT queda en una sola política.
--
-- Lo oficial se ve siempre, hayas bloqueado a quien lo firmó o no.

drop policy if exists "publican los autorizados" on public.publicaciones;

create policy "publican los autorizados: crear" on public.publicaciones
  for insert to authenticated
  with check (public.puede_publicar());

create policy "publican los autorizados: editar" on public.publicaciones
  for update to authenticated
  using (public.puede_publicar()) with check (public.puede_publicar());

create policy "publican los autorizados: borrar" on public.publicaciones
  for delete to authenticated
  using (public.puede_publicar());

drop policy if exists "feed publicado" on public.publicaciones;
create policy "feed publicado" on public.publicaciones
  for select to authenticated
  using (
    (estado = 'publicado' or public.puede_publicar())
    and (oficial or autor_id is null or not public.he_bloqueado(autor_id))
  );

-- --- Conexiones -----------------------------------------------------------------------
-- Quien fue bloqueado no puede pedirle conexión a quien lo bloqueó, y quien
-- bloqueó no ve las solicitudes ni las conexiones de esa persona.

drop policy if exists "mis conexiones" on public.conexiones;
create policy "mis conexiones" on public.conexiones
  for select to authenticated
  using (
    (solicita_id = public.mi_empleado() or recibe_id = public.mi_empleado())
    and not public.he_bloqueado(
      case when solicita_id = public.mi_empleado() then recibe_id else solicita_id end
    )
  );

drop policy if exists "solicito conexion" on public.conexiones;
create policy "solicito conexion" on public.conexiones
  for insert to authenticated
  with check (
    solicita_id = public.mi_empleado()
    and not privado.hay_bloqueo(recibe_id)
  );

-- --- Los avisos al teléfono ---------------------------------------------------------------
-- La misma función de `dispositivos`, con una condición más: quien bloqueó a
-- quien escribe no recibe el aviso. Quien llama es quien escribió (`mi_empleado()`).
-- ⚠️ Residual aceptado: quien escribe puede notar que a una persona del hilo no le
-- salen teléfonos. Es el mismo sondeo de una escritura rechazada, y no más.

create or replace function public.dispositivos_de_conversacion(p_conversacion uuid)
returns table (token text, plataforma text)
language sql
stable
security definer
set search_path = public
as $$
  select d.token, d.plataforma
    from public.conversacion_participantes p
    join public.empleados e on e.id = p.empleado_id and e.activo
    join public.dispositivos d on d.perfil_id = e.perfil_id
   where p.conversacion_id = p_conversacion
     and public.participo_en(p_conversacion)
     and p.empleado_id is distinct from public.mi_empleado()
     and not p.silenciado
     and d.perfil_id <> auth.uid()
     and not exists (
       select 1 from public.bloqueos b
        where b.bloqueador_id = p.empleado_id
          and b.bloqueado_id = public.mi_empleado()
     );
$$;

-- --- Los reportes -------------------------------------------------------------------------

create table if not exists public.reportes (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('publicacion', 'comentario', 'mensaje')),
  -- Sin llave foránea: apunta a tres tablas. El reporte conserva su extracto
  -- aunque lo reportado se borre.
  contenido_id  uuid not null,
  reportante_id uuid not null references public.empleados (id) on delete cascade,
  -- Quién escribió lo reportado. Nulo si lo firma la empresa, o si ya no está.
  autor_id      uuid references public.empleados (id) on delete set null,
  motivo        text not null check (motivo in (
                  'ofensivo', 'acoso', 'inapropiado', 'falso', 'privacidad', 'spam', 'otro')),
  detalle       text check (detalle is null or length(detalle) <= 500),
  -- Lo reportado, tal como estaba al reportarlo, y dónde.
  extracto      text not null default '',
  contexto      text not null default '',
  estado        text not null default 'abierto' check (estado in ('abierto', 'revisado')),
  -- El equipo lo ocultó (y se puede restaurar). El contenido sigue en su tabla.
  oculto        boolean not null default false,
  revisado_por  uuid references public.profiles (id) on delete set null,
  revisado_en   timestamptz,
  created_at    timestamptz not null default now(),
  -- Un reporte por persona y por cosa: reportar dos veces no abre dos.
  unique (reportante_id, tipo, contenido_id)
);

comment on table public.reportes is
  'Lo que la gente del canal reporta. Solo lo lee el equipo (modulo:reportes); quien fue reportado no ve quién lo reportó.';

create index if not exists reportes_estado_idx on public.reportes (estado, created_at desc);
create index if not exists reportes_contenido_idx on public.reportes (tipo, contenido_id);

alter table public.reportes enable row level security;
revoke all on table public.reportes from anon, authenticated;
grant select on table public.reportes to authenticated;

-- Nadie escribe la tabla directamente: ni quien reporta (lo hace
-- `reportar_contenido()`, que comprueba que puede ver lo reportado y congela el
-- extracto) ni el equipo (revisa y oculta por las funciones de abajo).
create policy "el equipo lee los reportes" on public.reportes
  for select to authenticated
  using (public.puede('modulo:reportes', 'ver'));

-- --- Reportar -------------------------------------------------------------------------------

create or replace function public.reportar_contenido(
  p_tipo text,
  p_contenido uuid,
  p_motivo text,
  p_detalle text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  yo        uuid := public.mi_empleado();
  v_autor   uuid;
  v_extracto text;
  v_contexto text;
begin
  if yo is null then
    raise exception 'Hace falta una sesión con ficha del padrón para reportar';
  end if;

  if p_tipo = 'mensaje' then
    -- Solo se reporta lo que se puede leer: un mensaje de un hilo donde participo.
    select m.autor_id,
           m.texto,
           case when c.tipo = 'grupo' then coalesce(g.nombre, 'Grupo') else 'Conversación directa' end
      into v_autor, v_extracto, v_contexto
      from public.mensajes m
      join public.conversaciones c on c.id = m.conversacion_id
      left join public.grupos g on g.id = c.grupo_id
     where m.id = p_contenido
       and m.estado = 'visible'
       and public.participo_en(m.conversacion_id);

  elsif p_tipo = 'comentario' then
    select c.empleado_id, c.texto, 'En «' || p.titulo || '»'
      into v_autor, v_extracto, v_contexto
      from public.comentarios c
      join public.publicaciones p on p.id = c.publicacion_id
     where c.id = p_contenido
       and c.estado = 'visible'
       and p.estado = 'publicado';

  elsif p_tipo = 'publicacion' then
    select p.autor_id,
           p.titulo || coalesce(E'\n' || p.bajada, ''),
           coalesce(initcap(p.tipo), 'Publicación')
      into v_autor, v_extracto, v_contexto
      from public.publicaciones p
     where p.id = p_contenido
       and p.estado = 'publicado';

  else
    raise exception 'Ese tipo de contenido no se puede reportar';
  end if;

  if not found then
    raise exception 'No se encontró lo que quieres reportar';
  end if;

  if v_autor is not distinct from yo then
    raise exception 'No puedes reportar lo que tú escribiste';
  end if;

  insert into public.reportes
    (tipo, contenido_id, reportante_id, autor_id, motivo, detalle, extracto, contexto)
  values
    (p_tipo, p_contenido, yo, v_autor, p_motivo,
     nullif(btrim(coalesce(p_detalle, '')), ''),
     left(coalesce(v_extracto, ''), 1000), left(v_contexto, 200))
  on conflict (reportante_id, tipo, contenido_id) do nothing;
end;
$$;

revoke execute on function public.reportar_contenido(text, uuid, text, text) from public, anon;
grant execute on function public.reportar_contenido(text, uuid, text, text) to authenticated;

-- --- Revisar y ocultar ------------------------------------------------------------------------

-- Marca un reporte como revisado, o lo reabre.
create or replace function public.revisar_reporte(p_reporte uuid, p_revisado boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'No tienes permiso para revisar reportes';
  end if;

  update public.reportes
     set estado = case when p_revisado then 'revisado' else 'abierto' end,
         revisado_por = case when p_revisado then auth.uid() else null end,
         revisado_en = case when p_revisado then now() else null end
   where id = p_reporte;
end;
$$;

-- Oculta lo reportado —o lo devuelve— y da por revisados todos los reportes de
-- esa misma cosa. No borra nada: es el `estado` de la fila de origen.
create or replace function public.ocultar_contenido_reportado(p_reporte uuid, p_ocultar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reportes;
begin
  if not public.puede('modulo:reportes', 'editar') then
    raise exception 'No tienes permiso para moderar el canal';
  end if;

  select * into r from public.reportes where id = p_reporte;
  if not found then
    raise exception 'No se encontró el reporte';
  end if;

  if r.tipo = 'mensaje' then
    update public.mensajes
       set estado = case when p_ocultar then 'oculto' else 'visible' end
     where id = r.contenido_id
       and estado = case when p_ocultar then 'visible' else 'oculto' end;
  elsif r.tipo = 'comentario' then
    update public.comentarios
       set estado = case when p_ocultar then 'oculto' else 'visible' end,
           moderado_por = case when p_ocultar then public.mi_empleado() else null end
     where id = r.contenido_id
       and estado = case when p_ocultar then 'visible' else 'oculto' end;
  else
    update public.publicaciones
       set estado = case when p_ocultar then 'archivado' else 'publicado' end
     where id = r.contenido_id
       and estado = case when p_ocultar then 'publicado' else 'archivado' end;
  end if;

  update public.reportes
     set oculto = p_ocultar,
         estado = 'revisado',
         revisado_por = auth.uid(),
         revisado_en = now()
   where tipo = r.tipo and contenido_id = r.contenido_id;
end;
$$;

revoke execute on function public.revisar_reporte(uuid, boolean) from public, anon;
revoke execute on function public.ocultar_contenido_reportado(uuid, boolean) from public, anon;
grant execute on function public.revisar_reporte(uuid, boolean) to authenticated;
grant execute on function public.ocultar_contenido_reportado(uuid, boolean) to authenticated;

-- --- La casilla ------------------------------------------------------------------------------------
-- El nivel administrador la tiene sola. El equipo de Boosty, de fábrica; los roles
-- de Iberia, si se la marcan en «Roles y permisos».

insert into public.rol_permisos (rol_id, recurso, ver, editar)
select r.id, 'modulo:reportes', true, true
  from public.roles r
 where r.clave = 'consultor'
on conflict (rol_id, recurso) do nothing;
