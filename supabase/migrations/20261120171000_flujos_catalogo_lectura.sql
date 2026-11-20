-- =============================================================================
-- PLATAFORMA IBERIA · los catálogos se LEEN con sesión
--
-- `control.catalogo` solo se leía con `sistema:catalogos` ver, que es permiso de
-- quien administra las listas. Pero cualquier formulario las necesita: quien
-- pide una requisición (rol «Usuario Iberia») veía el origen y el tipo de nómina
-- vacíos. Las etiquetas de un catálogo no son información sensible; escribirlas
-- sigue pidiendo `sistema:catalogos` crear o editar.
-- =============================================================================
create policy "leer catálogos con sesión" on control.catalogo for select to authenticated using (true);
