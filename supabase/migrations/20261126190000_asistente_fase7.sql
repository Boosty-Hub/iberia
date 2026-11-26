-- =============================================================================
-- Asistente de IA · fase 7: conector de Microsoft 365
-- =============================================================================
--
--  · Cada persona conecta SU cuenta de Microsoft de Iberia con permisos
--    delegados (nunca una llave maestra sobre los buzones): el asistente lee su
--    correo, su calendario, sus archivos de OneDrive y SharePoint y sus chats de
--    Teams, solo lo que esa persona ya ve en Microsoft, y solo lectura.
--  · El token de renovación va cifrado en Supabase Vault, a nombre de la
--    persona; el de acceso no se guarda (dura una hora y se pide al usarlo).
--    Desconectar borra los dos. Si Iberia retira el acceso, deja de servir.
--  · La aplicación de Iberia en Entra se autentica con CERTIFICADO (la llave
--    privada vive en el entorno del servidor, nunca en la base); aquí solo van
--    los dos identificadores, que no son secretos.
--  · En la matriz de alcance, Microsoft 365 son cuatro fuentes (`m365:correo`,
--    `m365:calendario`, `m365:archivos`, `m365:teams`), que la aplicación agrega
--    al catálogo: nacen apagadas, como todas.
-- =============================================================================

alter table asistente.config
  add column if not exists microsoft_tenant text check (microsoft_tenant is null or microsoft_tenant ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  add column if not exists microsoft_cliente text check (microsoft_cliente is null or microsoft_cliente ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');

create table if not exists asistente.conexion_microsoft (
  perfil_id    uuid primary key references public.profiles (id) on delete cascade,
  cuenta       text not null check (length(cuenta) <= 320),
  nombre       text check (nombre is null or length(nombre) <= 200),
  -- El token de renovación, en Vault (vault.secrets.id). Nunca en claro aquí.
  secreto_id   uuid not null,
  conectado_en timestamptz not null default now(),
  renovado_en  timestamptz,
  usado_en     timestamptz
);
alter table asistente.conexion_microsoft enable row level security;
drop policy if exists "veo mi conexion" on asistente.conexion_microsoft;
create policy "veo mi conexion" on asistente.conexion_microsoft for select to authenticated using (perfil_id = (select auth.uid()));
grant select on asistente.conexion_microsoft to authenticated;
grant all on asistente.conexion_microsoft to service_role;

-- El paso intermedio del inicio de sesión (estado y verificador PKCE). Solo servicio; vive 10 minutos.
create table if not exists asistente.microsoft_estado (
  estado      text primary key check (length(estado) between 32 and 128),
  perfil_id   uuid not null references public.profiles (id) on delete cascade,
  verificador text not null check (length(verificador) between 43 and 128),
  creado_en   timestamptz not null default now()
);
alter table asistente.microsoft_estado enable row level security;
grant all on asistente.microsoft_estado to service_role;

-- Guardar (o rotar) el token de renovación: solo el servidor.
create or replace function asistente.guardar_microsoft(p_perfil uuid, p_cuenta text, p_nombre text, p_renovacion text)
returns void
language plpgsql security definer set search_path = asistente, public, vault as $$
declare
  v_id uuid;
begin
  select secreto_id into v_id from asistente.conexion_microsoft where perfil_id = p_perfil;
  if v_id is not null and exists (select 1 from vault.secrets where id = v_id) then
    perform vault.update_secret(v_id, p_renovacion);
    update asistente.conexion_microsoft set renovado_en = now(),
      cuenta = coalesce(p_cuenta, cuenta), nombre = coalesce(p_nombre, nombre) where perfil_id = p_perfil;
  else
    v_id := vault.create_secret(p_renovacion, 'asistente_m365_' || p_perfil::text || '_' || extract(epoch from clock_timestamp())::bigint, 'Token de renovación de Microsoft 365 del asistente');
    insert into asistente.conexion_microsoft (perfil_id, cuenta, nombre, secreto_id)
      values (p_perfil, coalesce(p_cuenta, ''), p_nombre, v_id)
      on conflict (perfil_id) do update set cuenta = excluded.cuenta, nombre = excluded.nombre, secreto_id = excluded.secreto_id, conectado_en = now(), renovado_en = null;
  end if;
end;
$$;
revoke all on function asistente.guardar_microsoft(uuid, text, text, text) from public, anon, authenticated;
grant execute on function asistente.guardar_microsoft(uuid, text, text, text) to service_role;

create or replace function asistente.renovacion_microsoft(p_perfil uuid)
returns text
language sql stable security definer set search_path = asistente, public, vault as $$
  select s.decrypted_secret from asistente.conexion_microsoft c join vault.decrypted_secrets s on s.id = c.secreto_id where c.perfil_id = p_perfil;
$$;
revoke all on function asistente.renovacion_microsoft(uuid) from public, anon, authenticated;
grant execute on function asistente.renovacion_microsoft(uuid) to service_role;

-- Desconectar: la persona (lo suyo) o el servidor (cuando Microsoft ya no acepta el token). Borra la fila y el secreto.
create or replace function asistente.borrar_microsoft(p_perfil uuid)
returns void
language plpgsql security definer set search_path = asistente, public, vault as $$
declare
  v_id uuid;
begin
  delete from asistente.conexion_microsoft where perfil_id = p_perfil returning secreto_id into v_id;
  if v_id is not null then delete from vault.secrets where id = v_id; end if;
end;
$$;
revoke all on function asistente.borrar_microsoft(uuid) from public, anon, authenticated;
grant execute on function asistente.borrar_microsoft(uuid) to service_role;

create or replace function asistente.desconectar_microsoft()
returns void
language sql security definer set search_path = asistente, public as $$
  select asistente.borrar_microsoft(auth.uid()) where auth.uid() is not null;
$$;
revoke all on function asistente.desconectar_microsoft() from public, anon;
grant execute on function asistente.desconectar_microsoft() to authenticated;

-- Lo que trae el asistente de OneDrive o SharePoint queda como un archivo del chat: su origen se dice.
alter table asistente.archivo drop constraint if exists archivo_origen_check;
alter table asistente.archivo add constraint archivo_origen_check check (origen in ('subido', 'generado', 'microsoft'));
