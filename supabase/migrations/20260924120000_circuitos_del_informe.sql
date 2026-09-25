-- =============================================================================
-- LOS CIRCUITOS DEL INFORME · el flujo, los sistemas y el espejo
--
-- La parte de arquitectura del informe se abre con tres dibujos del mismo
-- circuito: dónde espera el trabajo (12 puntos), por dónde viaja el dato (15
-- puntos) y el sistema Iberia como espejo de JD con sus módulos. Son vistas
-- interactivas y necesitan su contenido **en tiempo de lectura**, así que va en
-- la base por las mismas tres razones que el mapa de procesos
-- (`20260918120000_mapa_de_procesos.sql`):
--
--   · `contenido/*` no está en git, por el NDA: leerlo del disco daría una
--     página que funciona en local y sale vacía al desplegar.
--   · Un módulo TypeScript con estos textos iría a un repositorio público.
--   · `public/` se sirve sin sesión, y el informe la exige.
--
-- El código solo trae la geometría del anillo y los nombres genéricos de las
-- estaciones. Todo lo que es de Iberia —cifras, sistemas, qué pasa en cada
-- punto, qué cubre cada módulo— vive aquí.
--
-- ⚠️ **El taller manda.** `contenido/circuitos/circuitos.json` es la fuente y
-- `npm run sembrar:circuitos` lo vuelca aquí, pisando. Si alguien edita estas
-- tablas a mano, la próxima siembra lo reemplaza, igual que el inventario.
-- =============================================================================

create table if not exists public.informe_circuito_puntos (
  -- La clave es estable (T1…T12, S1…S15) porque de ella cuelgan los enlaces
  -- entre circuitos y módulos: «este punto lo atiende el módulo 4».
  id text primary key,
  circuito text not null check (circuito in ('flujo', 'sistemas')),
  numero integer not null check (numero > 0),
  titulo text not null,
  -- En el flujo: el área donde ocurre. En los sistemas va vacío.
  donde text,
  -- Solo el flujo lleva fase: la propuesta de Fase 2, la 3, o sin asignar.
  fase text check (fase in ('2', '3', 'sin')),
  -- Solo los sistemas llevan tipo de trombo.
  tipo text check (tipo in ('duplicacion', 'doble_esfuerzo', 'choque', 'puente_roto', 'dato_fuera', 'punto_unico')),
  sistemas text[] not null default '{}',
  que_pasa text not null,
  cifras jsonb not null default '[]'::jsonb,
  -- [{ "tipo": "erp|regla|captura|ia", "texto": "…" }]
  destapes jsonb not null default '[]'::jsonb,
  -- Dónde se dibuja sobre el anillo, en coordenadas del viewBox 1080×520.
  pos_x numeric not null,
  pos_y numeric not null,
  -- Rótulo corto de los puntos que atraviesan todo el circuito y se dibujan al centro.
  centro text,
  updated_at timestamptz not null default now(),
  unique (circuito, numero)
);

create table if not exists public.informe_modulos (
  id text primary key,
  numero integer not null unique check (numero > 0),
  -- La ola en que se construye: base, 1 (Fase 2), 2, 3 (Fase 3).
  ola text not null check (ola in ('base', '1', '2', '3')),
  -- El nombre partido en renglones, como se dibuja bajo el bloque.
  nombre text[] not null,
  titulo text not null,
  -- [{ "texto": "…", "ia": true|false }] — cada capacidad dice si es IA o no,
  -- que es como el informe cumple lo que promete la propuesta: dónde interviene
  -- la IA y dónde no.
  cubre jsonb not null default '[]'::jsonb,
  nota text,
  lee text not null,
  postea text not null,
  deja_atras text not null,
  cifras jsonb not null default '[]'::jsonb,
  -- Los puntos de los circuitos que destapa (claves de informe_circuito_puntos).
  destapa text[] not null default '{}',
  dispositivo text not null,
  pos_x numeric not null,
  updated_at timestamptz not null default now()
);

-- Los rótulos de los dibujos: la tesis de cada circuito, cómo cruza el dato
-- cada tramo, los relojes, lo que dicen el panel de JD y el espejo.
create table if not exists public.informe_circuito_textos (
  clave text primary key check (clave in ('flujo', 'sistemas', 'espejo')),
  contenido jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.informe_circuito_puntos enable row level security;
alter table public.informe_modulos enable row level security;
alter table public.informe_circuito_textos enable row level security;

-- Lectura: cualquiera con sesión, igual que el mapa. Las vistas viven dentro
-- de secciones del informe, y quien no puede ver la sección no encuentra la
-- puerta.
create policy "con sesión se leen los puntos de los circuitos"
  on public.informe_circuito_puntos for select to authenticated using (true);
create policy "con sesión se leen los módulos"
  on public.informe_modulos for select to authenticated using (true);
create policy "con sesión se leen los textos de los circuitos"
  on public.informe_circuito_textos for select to authenticated using (true);

-- Escritura: solo editores, y en la práctica solo el sembrador.
create policy "editores escriben los puntos de los circuitos"
  on public.informe_circuito_puntos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());
create policy "editores escriben los módulos"
  on public.informe_modulos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());
create policy "editores escriben los textos de los circuitos"
  on public.informe_circuito_textos for all to authenticated
  using (public.es_editor()) with check (public.es_editor());

comment on table public.informe_circuito_puntos is
  'Los puntos de los circuitos del informe (flujo y sistemas). Reflejo de contenido/circuitos/circuitos.json; se siembra con sembrar:circuitos.';
comment on table public.informe_modulos is
  'Los módulos del sistema Iberia, el espejo de JD. Reflejo de contenido/circuitos/circuitos.json.';
comment on table public.informe_circuito_textos is
  'Los rótulos de los tres dibujos de circuitos del informe. Reflejo de contenido/circuitos/circuitos.json.';
