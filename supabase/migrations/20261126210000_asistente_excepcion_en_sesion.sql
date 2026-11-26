-- =============================================================================
-- Asistente de IA: la excepción por persona también abre las pantallas
-- =============================================================================
--
-- Lo encontró el recorrido con las cuentas de Gabriel (26-nov-2026): la
-- excepción «Habilitado» de Administración › Asistente de IA › Usuarios ya
-- valía en la base (`politica_de`), pero las pantallas solo miraban la casilla
-- del rol, y a la persona la devolvían a Mi día. La sesión la lee con esta
-- función (la tabla de excepciones solo la lee la administración).
-- =============================================================================

create or replace function asistente.mi_excepcion()
returns boolean
language sql stable security definer set search_path = asistente, public as $$
  select habilitado from asistente.politica_usuario where perfil_id = auth.uid();
$$;
revoke all on function asistente.mi_excepcion() from public, anon;
grant execute on function asistente.mi_excepcion() to authenticated;
