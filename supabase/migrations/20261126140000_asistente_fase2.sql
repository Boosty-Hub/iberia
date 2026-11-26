-- =============================================================================
-- ASISTENTE DE IA · FASE 2 · consultas a la plataforma con alcance
--
--  · El asistente nunca ve más que el usuario: cada consulta corre con el token
--    de la sesión de quien pregunta (la RLS de siempre). Encima va el ALCANCE:
--    qué fuentes puede consultar el asistente por cada rol, con excepciones por
--    persona. Lo que ve = lo que el usuario puede ver Y lo que su alcance permite.
--  · Una fuente es una tabla de la plataforma (las mismas definiciones de
--    `lib/plataforma/tablas*.ts`), las métricas del registro o los documentos
--    del SGC. Una fuente que no está en `asistente.fuente` está APAGADA: lo
--    nuevo nace apagado para todos.
--  · Cada consulta queda en `asistente.consulta_fuente` (qué, con qué filtros y
--    cuántas filas; nunca el contenido).
--  · Los documentos del SGC se buscan por página (`asistente.documento_pagina`),
--    con el texto completo de Postgres en español; la RLS pregunta por el
--    archivo con la sesión de quien busca, así que los perímetros cierran igual.
-- =============================================================================

create table if not exists asistente.fuente (
  clave        text primary key check (clave ~ '^[a-z0-9:_-]{2,60}$'),
  encendida    boolean not null default false,
  sensible     boolean not null default false,
  nota         text check (nota is null or length(nota) <= 500),
  actualizado_por uuid references public.profiles (id),
  actualizado_en  timestamptz not null default now()
);
alter table asistente.fuente enable row level security;

create table if not exists asistente.alcance_rol (
  rol_id    uuid not null references public.roles (id) on delete cascade,
  fuente    text not null check (fuente ~ '^[a-z0-9:_-]{2,60}$'),
  permitido boolean not null default true,
  primary key (rol_id, fuente)
);
alter table asistente.alcance_rol enable row level security;

create table if not exists asistente.alcance_usuario (
  perfil_id uuid not null references public.profiles (id) on delete cascade,
  fuente    text not null check (fuente ~ '^[a-z0-9:_-]{2,60}$'),
  permitido boolean not null,
  primary key (perfil_id, fuente)
);
alter table asistente.alcance_usuario enable row level security;

create table if not exists asistente.consulta_fuente (
  id          uuid primary key default gen_random_uuid(),
  turno_id    uuid references asistente.turno (id) on delete set null,
  perfil_id   uuid not null references public.profiles (id) on delete cascade,
  fuente      text not null,
  parametros  jsonb not null default '{}'::jsonb,
  filas       integer not null default 0,
  creado_en   timestamptz not null default now()
);
create index if not exists consulta_fuente_perfil_idx on asistente.consulta_fuente (perfil_id, creado_en desc);
create index if not exists consulta_fuente_turno_idx on asistente.consulta_fuente (turno_id);
alter table asistente.consulta_fuente enable row level security;

-- Administración: leer y escribir el alcance pide la casilla del asistente.
do $$
declare t text;
begin
  foreach t in array array['fuente', 'alcance_rol', 'alcance_usuario'] loop
    execute format('drop policy if exists "leo %1$s" on asistente.%1$I', t);
    execute format('create policy "leo %1$s" on asistente.%1$I for select to authenticated using ((select public.puede(''sistema:asistente-admin'', ''ver'')))', t);
    execute format('drop policy if exists "escribo %1$s" on asistente.%1$I', t);
    execute format('create policy "escribo %1$s" on asistente.%1$I for all to authenticated using ((select public.puede(''sistema:asistente-admin'', ''editar''))) with check ((select public.puede(''sistema:asistente-admin'', ''editar'')))', t);
  end loop;
end $$;
grant select, insert, update, delete on asistente.fuente, asistente.alcance_rol, asistente.alcance_usuario to authenticated;

-- El registro de consultas: lo escribe el servidor; lo ve su autor y la administración.
drop policy if exists "veo consultas" on asistente.consulta_fuente;
create policy "veo consultas" on asistente.consulta_fuente for select to authenticated
  using (perfil_id = (select auth.uid()) or (select public.puede('sistema:asistente-admin', 'ver')));
grant select on asistente.consulta_fuente to authenticated;
grant all on asistente.fuente, asistente.alcance_rol, asistente.alcance_usuario, asistente.consulta_fuente to service_role;

-- Las fuentes que el ALCANCE le permite a quien pregunta (encendidas y permitidas
-- por su excepción o, si no tiene, por su rol). El permiso de la pantalla de cada
-- fuente lo revisa el servidor con `mis_permisos()`, y la RLS, al consultar.
create or replace function asistente.mi_alcance()
returns table (fuente text, sensible boolean)
language sql stable security definer set search_path = asistente, public as $$
  select f.clave, f.sensible
    from asistente.fuente f
    join public.profiles p on p.id = auth.uid() and p.activo
    left join asistente.alcance_usuario u on u.perfil_id = p.id and u.fuente = f.clave
    left join asistente.alcance_rol r on r.rol_id = p.rol_id and r.fuente = f.clave
   where f.encendida and coalesce(u.permitido, r.permitido, false);
$$;
revoke all on function asistente.mi_alcance() from public, anon;
grant execute on function asistente.mi_alcance() to authenticated;

-- -----------------------------------------------------------------------------
-- Documentos del SGC, por página
-- -----------------------------------------------------------------------------
-- Sin tildes y en minúsculas, inmutable (para el índice): «Procedimiento» y «procedimiento», «área» y «area».
create or replace function asistente.plano(t text) returns text
language sql immutable parallel safe as $$
  select translate(lower(coalesce(t, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou');
$$;

create table if not exists asistente.documento_pagina (
  archivo_id   uuid not null references sgc.documento_archivo (id) on delete cascade,
  documento_id uuid not null references sgc.documento (id) on delete cascade,
  pagina       integer not null check (pagina >= 1),
  texto        text not null check (length(texto) <= 20000),
  vector       tsvector generated always as (to_tsvector('spanish', asistente.plano(texto))) stored,
  primary key (archivo_id, pagina)
);
create index if not exists documento_pagina_vector_idx on asistente.documento_pagina using gin (vector);
create index if not exists documento_pagina_documento_idx on asistente.documento_pagina (documento_id);
alter table asistente.documento_pagina enable row level security;

-- Se lee una página si quien busca puede leer su archivo (la RLS de
-- `sgc.documento_archivo` corre con su sesión: los perímetros cierran igual).
drop policy if exists "leo paginas de lo que veo" on asistente.documento_pagina;
create policy "leo paginas de lo que veo" on asistente.documento_pagina for select to authenticated
  using (exists (select 1 from sgc.documento_archivo a where a.id = documento_pagina.archivo_id));
grant select on asistente.documento_pagina to authenticated;
grant all on asistente.documento_pagina to service_role;

-- La búsqueda: corre con la sesión de quien busca (security invoker), así que
-- solo encuentra lo que la RLS le deja. Devuelve la página y un extracto.
create or replace function asistente.buscar_documentos(p_consulta text, p_limite integer default 12)
returns table (documento_id uuid, codigo text, titulo text, estado text, archivo_id uuid, archivo text, pagina integer, extracto text, rango real)
language sql stable security invoker set search_path = asistente, sgc, public as $$
  with q as (select websearch_to_tsquery('spanish', asistente.plano(p_consulta)) as c)
  select d.id, d.codigo, d.titulo, d.estado, a.id, a.nombre, p.pagina,
         ts_headline('spanish', p.texto, q.c, 'MaxWords=45, MinWords=15, MaxFragments=2, FragmentDelimiter=" … "'),
         ts_rank(p.vector, q.c)
    from asistente.documento_pagina p
    join q on p.vector @@ q.c
    join sgc.documento_archivo a on a.id = p.archivo_id
    join sgc.documento d on d.id = p.documento_id
   order by ts_rank(p.vector, q.c) desc
   limit least(greatest(coalesce(p_limite, 12), 1), 40);
$$;
revoke all on function asistente.buscar_documentos(text, integer) from public, anon;
grant execute on function asistente.buscar_documentos(text, integer) to authenticated;
