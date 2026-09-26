-- =============================================================================
-- «No soy yo»: la corrección que alguien le hace a su propia ficha del padrón
-- =============================================================================
--
-- 26 de septiembre de 2026, a pedido de Gabriel. La lección 0 le muestra a cada
-- quien su nombre, su cargo y su área tal como vienen de Capital Humano, y Ajito
-- pregunta si está bien. Quien dice que no escribe cómo se llama y en qué área
-- trabaja, y eso queda aquí: es la marca que el guion promete para Capital
-- Humano. El curso sigue igual.
--
-- No se corrige el padrón en el acto. El padrón es de Capital Humano —de ahí
-- salen los certificados— y lo que escribe una persona en el teléfono es un
-- aviso, no un dato: el equipo lo lee en `/dashboard/empleados`, se lo pasa a
-- Capital Humano y lo marca resuelto.
--
-- Lo que decía el padrón se congela en la fila con un trigger, no lo manda el
-- navegador: así la comparación «decía esto, escribió aquello» no se puede
-- inventar, y sigue leyéndose igual después de que el padrón se corrija.
-- -----------------------------------------------------------------------------

create table if not exists public.correcciones_padron (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 120),
  area text check (area is null or char_length(area) <= 120),
  nombre_padron text not null default '',
  cargo_padron text,
  area_padron text,
  resuelta_en timestamptz,
  resuelta_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists correcciones_padron_empleado on public.correcciones_padron (empleado_id);
create index if not exists correcciones_padron_abiertas
  on public.correcciones_padron (created_at) where resuelta_en is null;

comment on table public.correcciones_padron is
  'Lo que alguien corrigió de su ficha en la lección 0 («No soy yo»). Aviso para Capital Humano, no dato.';

-- Congela lo que decía el padrón y no deja que quien corrige se la dé por resuelta.
create or replace function public.congelar_correccion_padron()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select e.nombre_completo, e.cargo, a.nombre
    into new.nombre_padron, new.cargo_padron, new.area_padron
    from public.empleados e
    left join public.areas a on a.id = e.area_id
   where e.id = new.empleado_id;

  new.nombre := btrim(new.nombre);
  new.area := nullif(btrim(coalesce(new.area, '')), '');

  if not public.es_editor() then
    new.resuelta_en := null;
    new.resuelta_por := null;
  end if;
  return new;
end;
$$;

drop trigger if exists congelar_correccion_padron on public.correcciones_padron;
create trigger congelar_correccion_padron
  before insert on public.correcciones_padron
  for each row execute function public.congelar_correccion_padron();

-- --- RLS -----------------------------------------------------------------------
-- Como las respuestas del curso: la escribe y la lee su dueño, y la leen los
-- editores. Resolverla es de editores. Nadie de afuera del equipo la ve — dice
-- de alguien que el padrón lo tiene mal, y eso es de Capital Humano.

alter table public.correcciones_padron enable row level security;

create policy "corrijo mi ficha" on public.correcciones_padron
  for insert to authenticated
  with check (empleado_id = public.mi_empleado());

create policy "veo mis correcciones" on public.correcciones_padron
  for select to authenticated
  using (empleado_id = public.mi_empleado() or public.es_editor());

create policy "editores resuelven correcciones" on public.correcciones_padron
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());
