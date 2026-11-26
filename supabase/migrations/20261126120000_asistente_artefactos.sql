-- =============================================================================
-- ASISTENTE DE IA · los HTML pasan a ser ARTEFACTOS (Gabriel, 26-nov-2026: «ya
-- todos los usuarios utilizaban los artefactos»).
--
-- Un artefacto es una pieza viva del chat —tablero, reporte, documento,
-- diagrama— con versiones: cuando la persona monta datos nuevos o pide un
-- cambio, el asistente actualiza el MISMO artefacto (versión 2, 3…) en vez de
-- crear otro. `grupo` reúne las versiones; `tipo` dice cómo se pinta.
-- =============================================================================

alter table asistente.html add column if not exists grupo uuid;
update asistente.html set grupo = id where grupo is null;
alter table asistente.html alter column grupo set not null;
alter table asistente.html alter column grupo set default gen_random_uuid();
alter table asistente.html add column if not exists tipo text not null default 'html';
alter table asistente.html drop constraint if exists html_tipo_check;
alter table asistente.html add constraint html_tipo_check check (tipo in ('html', 'documento', 'svg'));
create unique index if not exists html_grupo_version on asistente.html (grupo, version);

comment on table asistente.html is
  'Artefactos del asistente (HTML interactivo, documento en Markdown, SVG), con versiones: las filas de un mismo `grupo` son las versiones de un artefacto.';
