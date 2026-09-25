-- =============================================================================
-- Los hallazgos, en el circuito del negocio
--
-- Decisión de Gabriel, 25 de septiembre: el informe abre con lo que se
-- encontró, y los hallazgos no van sueltos sino ubicados en el circuito —cada
-- uno en el punto donde ocurre, con su nivel—. Dos cosas en la base:
--
--   1. Una parte nueva del informe, «Lo que encontramos», antes del
--      levantamiento. El orden queda: apertura → lo que encontramos → cómo
--      funciona hoy → qué proponemos.
--   2. La tabla que ubica cada hallazgo en el circuito. Se siembra desde el
--      taller `contenido/circuitos/circuitos.json` con `sembrar:circuitos`,
--      como los puntos y los módulos.
-- =============================================================================

alter table public.informe_secciones drop constraint if exists informe_secciones_parte_check;
alter table public.informe_secciones
  add constraint informe_secciones_parte_check
  check (parte in ('portada', 'hallazgos', 'levantamiento', 'arquitectura', 'anexos'));

create table if not exists public.informe_hallazgos (
  codigo   text primary key check (codigo ~ '^H-\d{2}$'),
  -- El título exacto del `### H-NN · Título` de la sección: de él sale el ancla.
  titulo   text not null,
  patron   text not null,
  nivel    text not null check (nivel in ('critico', 'atencion', 'funciona')),
  -- Dónde golpea en el circuito del flujo, y con qué punto del de sistemas se
  -- relaciona. Un hallazgo transversal —el ataque, el gobierno— no tiene punto.
  punto    text references public.informe_circuito_puntos (id) on delete set null,
  sistema  text references public.informe_circuito_puntos (id) on delete set null,
  orden    int not null,
  updated_at timestamptz not null default now()
);

create trigger informe_hallazgos_updated_at
  before update on public.informe_hallazgos
  for each row execute function public.set_updated_at();

comment on table public.informe_hallazgos is
  'Cada hallazgo del informe ubicado en el circuito del negocio, con su nivel. Reflejo de contenido/circuitos/circuitos.json; se siembra con sembrar:circuitos.';

alter table public.informe_hallazgos enable row level security;

create policy "con sesión se leen los hallazgos del circuito"
  on public.informe_hallazgos for select to authenticated using (true);

create policy "editores escriben los hallazgos del circuito"
  on public.informe_hallazgos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());
