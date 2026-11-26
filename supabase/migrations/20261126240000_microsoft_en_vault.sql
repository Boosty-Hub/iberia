-- =============================================================================
-- Asistente de IA · el certificado de Microsoft 365, en Vault
-- =============================================================================
--
-- La llave privada y el certificado de la app de Iberia en Entra suman ~3,4 KB.
-- Las funciones de Netlify corren en AWS Lambda, que limita a 4 KB el total de
-- variables de entorno: en el entorno no caben junto a las demás. Van cifrados en
-- Supabase Vault y solo el servidor (clave de servicio) los lee. Se cargan con
-- scripts/asistente/subir-certificado-microsoft.mjs.
-- =============================================================================

create or replace function asistente.guardar_credencial_microsoft(p_clave text, p_certificado text)
returns void
language plpgsql security definer set search_path = asistente, public, vault as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'asistente_m365_clave';
  if v_id is null then perform vault.create_secret(p_clave, 'asistente_m365_clave', 'Llave privada del certificado de la app de Microsoft 365 del asistente');
  else perform vault.update_secret(v_id, p_clave); end if;
  select id into v_id from vault.secrets where name = 'asistente_m365_certificado';
  if v_id is null then perform vault.create_secret(p_certificado, 'asistente_m365_certificado', 'Certificado público (.cer en base64) de la app de Microsoft 365 del asistente');
  else perform vault.update_secret(v_id, p_certificado); end if;
end;
$$;
revoke all on function asistente.guardar_credencial_microsoft(text, text) from public, anon, authenticated;
grant execute on function asistente.guardar_credencial_microsoft(text, text) to service_role;

create or replace function asistente.credencial_microsoft()
returns jsonb
language sql stable security definer set search_path = asistente, public, vault as $$
  select jsonb_build_object(
    'clave', (select decrypted_secret from vault.decrypted_secrets where name = 'asistente_m365_clave'),
    'certificado', (select decrypted_secret from vault.decrypted_secrets where name = 'asistente_m365_certificado'));
$$;
revoke all on function asistente.credencial_microsoft() from public, anon, authenticated;
grant execute on function asistente.credencial_microsoft() to service_role;
