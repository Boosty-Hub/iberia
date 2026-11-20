-- =============================================================================
-- PLATAFORMA IBERIA · privilegios del rol de servicio en los esquemas nuevos, y
-- la ocupación por encima de la dotación como dato visible, no como error
-- =============================================================================

-- Supabase da privilegios por defecto solo en `public`. En los esquemas nuevos
-- el rol de servicio (importaciones, funciones del servidor) los necesita
-- explícitos; `authenticated` ya los tiene tabla por tabla, con RLS.
grant all on all tables in schema org, sgc, flujo, control to service_role;
grant all on all sequences in schema org, sgc, flujo, control to service_role;
grant execute on all functions in schema org, sgc, flujo, control to service_role;
alter default privileges in schema org, sgc, flujo, control grant all on tables to service_role;
alter default privileges in schema org, sgc, flujo, control grant all on sequences to service_role;
alter default privileges in schema org, sgc, flujo, control grant execute on functions to service_role;
grant execute on all functions in schema org, sgc, flujo to authenticated;
alter default privileges in schema org, sgc, flujo grant execute on functions to authenticated;

-- Hay plazas con más gente que su dotación (36 embaladores para 25 en el
-- organigrama de 2023). Es un hallazgo, no un error de carga: la base deja
-- registrar la ocupación de más **solo si se marca**, y el tablero de dotación
-- la muestra como «por encima de la dotación».
alter table org.ocupacion add column if not exists excede_dotacion boolean not null default false;

create or replace function org.ocupacion_cabe()
returns trigger language plpgsql set search_path = org, public, extensions as $$
declare
  v_dotacion integer;
  v_ocupadas integer;
begin
  if new.tipo <> 'titular' or new.excede_dotacion then return new; end if;
  select dotacion into v_dotacion from org.plaza
   where ref = new.plaza_ref and escenario_id is null and vigencia && new.vigencia
   order by lower(vigencia) desc limit 1;
  if v_dotacion is null then
    raise exception 'La plaza no existe en esa fecha' using errcode = 'foreign_key_violation';
  end if;
  select count(*) into v_ocupadas from org.ocupacion
   where plaza_ref = new.plaza_ref and tipo = 'titular' and not excede_dotacion
     and vigencia && new.vigencia and id <> new.id;
  if v_ocupadas >= v_dotacion then
    raise exception 'La plaza ya tiene % titular(es) para su dotación de %. Si es así de verdad, márcala «por encima de la dotación».', v_ocupadas, v_dotacion
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
