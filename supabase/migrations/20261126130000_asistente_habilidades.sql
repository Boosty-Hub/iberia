-- =============================================================================
-- ASISTENTE DE IA · habilidades propias de Iberia (formato SKILL.md, subidas a la
-- API de habilidades de Anthropic con scripts/asistente/subir-habilidad.mjs).
-- La primera: `formato-iberia`, para que todo documento salga con la marca.
-- =============================================================================

alter table asistente.config add column if not exists habilidades text[] not null default '{}';
comment on column asistente.config.habilidades is
  'Ids de las habilidades propias (custom skills de Anthropic) que se montan en el entorno de código de cada chat, además de xlsx, docx, pptx y pdf.';
