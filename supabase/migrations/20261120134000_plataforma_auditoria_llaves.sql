-- La auditoría identifica la fila por su llave, y no todas las tablas auditadas
-- tienen `id`: el registro de módulos va por código, los catálogos por (tipo,
-- clave), la matriz por (rol, recurso) y el costo de la requisición por la
-- requisición.
create or replace function control.auditar()
returns trigger
language plpgsql
security definer
set search_path = control, public, extensions
as $$
declare
  v_previo text;
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_fila jsonb := coalesce(v_despues, v_antes);
  v_id text := coalesce(
    v_fila ->> 'id',
    v_fila ->> 'codigo',
    v_fila ->> 'requisicion_id',
    case when v_fila ? 'rol_id' then (v_fila ->> 'rol_id') || ':' || (v_fila ->> 'recurso') end,
    case when v_fila ? 'tipo' and v_fila ? 'clave' then (v_fila ->> 'tipo') || ':' || (v_fila ->> 'clave') end,
    md5(v_fila::text));
begin
  perform pg_advisory_xact_lock(hashtext('control.auditoria'));
  select hash into v_previo from control.auditoria order by id desc limit 1;
  insert into control.auditoria (esquema, tabla, registro_id, accion, antes, despues, hash_previo, hash)
  values (tg_table_schema, tg_table_name, v_id, tg_op, v_antes, v_despues, v_previo,
          encode(extensions.digest(coalesce(v_previo, '') || tg_table_schema || tg_table_name || v_id || tg_op
                 || coalesce(v_antes::text, '') || coalesce(v_despues::text, '') || clock_timestamp()::text, 'sha256'), 'hex'));
  return coalesce(new, old);
end;
$$;
