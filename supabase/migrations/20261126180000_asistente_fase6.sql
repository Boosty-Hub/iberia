-- =============================================================================
-- Asistente de IA · fase 6: el motor local
-- =============================================================================
--
--  · Un servidor de modelos de Iberia con API compatible con OpenAI (Ollama,
--    vLLM, llama.cpp) como tercer motor. La dirección va en la config; la clave,
--    si la tiene, en el entorno (`ASISTENTE_LOCAL_CLAVE`), nunca en una tabla.
--  · Lo que cada motor puede hacer es DATO (`asistente.capacidad_motor`): con el
--    motor local activo, lo que no puede sale apagado y con su motivo, en el chat
--    y en el panel, y el servidor lo vuelve a revisar.
--  · Dos modos: híbrido (los archivos los procesa Anthropic, decisión 19: el
--    archivo sale de Iberia) y todo adentro (sin archivos mientras no haya un
--    entorno de código propio).
-- =============================================================================

alter table asistente.config
  add column if not exists local_url text check (local_url is null or local_url ~ '^https?://[^\s]+$'),
  add column if not exists local_modo text not null default 'hibrido' check (local_modo in ('hibrido', 'adentro'));

-- El nombre con que se le pide el modelo al proveedor, si no es el id (Ollama: «qwen3:32b»).
alter table asistente.modelo add column if not exists nombre_api text check (nombre_api is null or length(nombre_api) between 1 and 200);

create table if not exists asistente.capacidad_motor (
  motor        text not null check (motor in ('anthropic', 'openai', 'local')),
  capacidad    text not null check (capacidad in ('conversar', 'herramientas', 'archivos', 'busqueda', 'investigacion')),
  disponible   boolean not null,
  -- Solo en modo híbrido (los archivos van a Anthropic).
  solo_hibrido boolean not null default false,
  motivo       text check (motivo is null or length(motivo) <= 300),
  orden        smallint not null default 0,
  primary key (motor, capacidad)
);
alter table asistente.capacidad_motor enable row level security;

insert into asistente.capacidad_motor (motor, capacidad, disponible, solo_hibrido, motivo, orden) values
  ('anthropic', 'conversar', true, false, null, 1),
  ('anthropic', 'herramientas', true, false, null, 2),
  ('anthropic', 'archivos', true, false, null, 3),
  ('anthropic', 'busqueda', true, false, null, 4),
  ('anthropic', 'investigacion', true, false, null, 5),
  ('openai', 'conversar', true, false, null, 1),
  ('openai', 'herramientas', true, false, null, 2),
  ('openai', 'archivos', true, false, 'Los archivos los procesa Anthropic (decisión 19).', 3),
  ('openai', 'busqueda', true, false, null, 4),
  ('openai', 'investigacion', true, false, 'Sin reanudación por tramos: un trabajo de más de 15 minutos se corta.', 5),
  ('local', 'conversar', true, false, 'La calidad depende del modelo y del equipo.', 1),
  ('local', 'herramientas', false, false, 'Las fuentes de la plataforma, la memoria y las tareas se encienden después de probar que el modelo maneja herramientas de forma confiable.', 2),
  ('local', 'archivos', true, true, 'En modo híbrido los procesa Anthropic y el archivo sale de Iberia. En modo todo adentro hace falta un entorno de código propio.', 3),
  ('local', 'busqueda', false, false, 'El motor local no trae buscador de internet.', 4),
  ('local', 'investigacion', false, false, 'Necesita búsqueda en internet.', 5)
on conflict (motor, capacidad) do nothing;

drop policy if exists "leo las capacidades" on asistente.capacidad_motor;
create policy "leo las capacidades" on asistente.capacidad_motor for select to authenticated using (true);
-- La administración solo enciende o apaga lo del motor local (lo de los proveedores es un hecho, no una opción).
drop policy if exists "ajusto el motor local" on asistente.capacidad_motor;
create policy "ajusto el motor local" on asistente.capacidad_motor for update to authenticated
  using (motor = 'local' and (select public.puede('sistema:asistente-admin', 'editar')))
  with check (motor = 'local' and (select public.puede('sistema:asistente-admin', 'editar')));
grant select, update (disponible) on asistente.capacidad_motor to authenticated;
grant all on asistente.capacidad_motor to service_role;

-- Lo que puede el motor activo, con el modo resuelto: [{capacidad, disponible, motivo}].
create or replace function asistente.capacidades(p_motor text default null)
returns jsonb
language sql stable security definer set search_path = asistente, public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'capacidad', k.capacidad,
           'disponible', k.disponible and (not k.solo_hibrido or c.local_modo = 'hibrido'),
           'motivo', case when k.solo_hibrido and c.local_modo <> 'hibrido' then 'En modo todo adentro no hay entorno de código para archivos (hace falta uno propio).' else k.motivo end
         ) order by k.orden), '[]'::jsonb)
    from asistente.config c
    join asistente.capacidad_motor k on k.motor = coalesce(p_motor, c.motor)
   where c.id;
$$;
revoke all on function asistente.capacidades(text) from public, anon;
grant execute on function asistente.capacidades(text) to authenticated, service_role;

-- La administración da de alta y de baja los modelos del motor local (los de los proveedores vienen en las migraciones).
drop policy if exists "agrego modelos locales" on asistente.modelo;
create policy "agrego modelos locales" on asistente.modelo for insert to authenticated
  with check (proveedor = 'local' and (select public.puede('sistema:asistente-admin', 'editar')));
drop policy if exists "quito modelos locales" on asistente.modelo;
create policy "quito modelos locales" on asistente.modelo for delete to authenticated
  using (proveedor = 'local' and (select public.puede('sistema:asistente-admin', 'editar')));
grant insert, delete on asistente.modelo to authenticated;
