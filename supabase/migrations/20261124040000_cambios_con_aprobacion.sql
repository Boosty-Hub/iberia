-- Toda edición de la estructura pasa por aprobación (24-nov-2026, Gabriel: «las ediciones son escenarios también que
-- tienen que pasar por aprobación», en estructura y en procesos).
--
-- Decisiones de Gabriel (Telegram, 24-nov):
--   1A · cada quien edita en su «borrador de cambios»: los cambios se acumulan y se envían juntos, con fecha de vigencia.
--   2  · todo pasa por aprobación: unidades, plazas, dependencias, dotación, movimientos de personas, cargos, costos,
--        plan de dotación y el cruce SGC ↔ informe.
--   3A · un solo paso: aprueba quien tenga la casilla «Aprobar cambios» (`sistema:cambios` · editar); el nivel
--        administrador siempre. La misma regla para los escenarios y las versiones de proceso.
--   4A · sin excepciones: nada entra a la realidad sin firma. Y quien hizo el cambio no lo aprueba.
--
-- Cómo funciona:
--   · El borrador de cambios es un `org.escenario` de tipo 'cambios' (uno abierto por persona). Cada edición es una fila
--     de `org.cambio`: la función de siempre (`crear_plaza`, `editar_plaza`, `asignar_ocupacion`, …) con sus
--     argumentos. Para `editar_unidad` y `editar_plaza` se guarda solo lo que cambia (`parche`) y al ejecutar se
--     completa con el estado del momento: así dos cambios sobre la misma plaza no se pisan.
--   · Al proponer, el lote entero se SIMULA contra la realidad de hoy y se deshace: si algo no cuadra, el error sale en
--     el acto, con el mensaje de siempre.
--   · Al aprobarse, el lote se ejecuta en orden, en la fecha elegida, a nombre de su autor (la auditoría dice quién lo
--     hizo; la solicitud, quién lo aprobó). Si la realidad cambió y ya no cuadra, la firma falla y nada se aplica.
--   · Las funciones de edición directa dejan de estar abiertas a las sesiones, y las tablas reales ya no se escriben
--     por la API (antes, quien tenía «editar» podía cambiar filas sin versionar).

-- ── 1 · El borrador de cambios ───────────────────────────────────────────────

alter table org.escenario add column if not exists tipo text not null default 'diseno';
do $$ begin
  alter table org.escenario add constraint escenario_tipo_check check (tipo in ('diseno', 'cambios'));
exception when duplicate_object then null; end $$;
create unique index if not exists escenario_cambios_abierto on org.escenario (creado_por)
  where tipo = 'cambios' and estado = 'borrador';

-- El autor ve sus borradores de cambios aunque no tenga la casilla de escenarios; quien aprueba cambios los ve todos.
drop policy if exists "ver mis cambios y los que apruebo" on org.escenario;
create policy "ver mis cambios y los que apruebo" on org.escenario for select to authenticated
  using (tipo = 'cambios' and (creado_por = (select auth.uid()) or (select public.puede('sistema:cambios', 'ver'))));

create table if not exists org.cambio (
  id           uuid primary key default gen_random_uuid(),
  escenario_id uuid not null references org.escenario (id) on delete cascade,
  orden        bigint generated always as identity,
  funcion      text not null check (funcion in (
                 'crear_unidad', 'editar_unidad', 'cerrar_unidad',
                 'crear_plaza', 'editar_plaza', 'cerrar_plaza',
                 'asignar_ocupacion', 'mover_ocupacion', 'terminar_ocupacion',
                 'crear_cargo', 'editar_cargo',
                 'fijar_costo_referencia', 'crear_componente_costo', 'editar_componente_costo', 'retirar_componente_costo',
                 'fijar_parametro', 'aprobar_plan_dotacion', 'editar_cruce')),
  args         jsonb not null default '{}',
  parche       jsonb,
  descripcion  text not null,
  objeto       text,
  objeto_ref   uuid,
  creado_en    timestamptz not null default now()
);
create index if not exists cambio_escenario on org.cambio (escenario_id, orden);
alter table org.cambio enable row level security;
grant select on org.cambio to authenticated;
grant all on org.cambio to service_role;
drop policy if exists "ver los cambios de un lote visible" on org.cambio;
create policy "ver los cambios de un lote visible" on org.cambio for select to authenticated
  using (exists (select 1 from org.escenario e where e.id = escenario_id));

-- ── 2 · Cargos y cruce: de update directo a funciones (para poder proponerlos) ─

-- La clave del cargo, como la arma la app (`claveDe`): minúsculas, sin tildes, guiones; si ya existe, «-2», «-3»…
create or replace function org.clave_cargo_libre(p_nombre text)
returns text
language plpgsql stable set search_path = org, public as $$
declare
  v_base text := trim(both '-' from regexp_replace(lower(translate(coalesce(p_nombre, ''), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]+', '-', 'g'));
  v_clave text;
  n int := 2;
begin
  if v_base = '' then v_base := 'cargo'; end if;
  v_clave := v_base;
  while exists (select 1 from org.cargo where clave = v_clave) loop
    v_clave := v_base || '-' || n; n := n + 1;
  end loop;
  return v_clave;
end;
$$;

create or replace function org.crear_cargo(p_nombre text, p_familia text, p_nivel text, p_sinonimos text[], p_proposito text)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare v_id uuid; v_nombre text := trim(coalesce(p_nombre, ''));
begin
  if not (public.puede('sistema:estructura', 'crear') or public.puede('sistema:estructura', 'editar')) then
    raise exception 'Tu rol no puede crear cargos.' using errcode = 'insufficient_privilege';
  end if;
  if length(v_nombre) < 3 then raise exception 'El nombre del cargo necesita al menos tres letras.' using errcode = 'check_violation'; end if;
  if exists (select 1 from org.cargo where lower(nombre) = lower(v_nombre)) then
    raise exception '«%» ya está en el catálogo.', v_nombre using errcode = 'unique_violation';
  end if;
  insert into org.cargo (clave, nombre, familia, nivel, sinonimos, proposito)
  values (org.clave_cargo_libre(v_nombre), v_nombre, nullif(trim(p_familia), ''), nullif(trim(p_nivel), '')::smallint,
          coalesce(p_sinonimos, '{}'), nullif(trim(p_proposito), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- El cargo nuevo de una requisición: lo crea su autor, con el permiso de crear en la estructura, y entra con la
-- requisición a su ruta de aprobación (como hasta hoy, pero sin escribir la tabla por la API).
create or replace function org.crear_cargo_de_requisicion(p_nombre text, p_familia text)
returns uuid
language plpgsql security definer set search_path = org, public, extensions as $$
begin
  if not public.puede('sistema:estructura', 'crear') then
    raise exception 'Crear un cargo es de Desarrollo Organizacional. Elige uno del catálogo o pídeles que lo creen.' using errcode = 'insufficient_privilege';
  end if;
  return org.crear_cargo(p_nombre, p_familia, null, '{}', null);
end;
$$;
revoke all on function org.crear_cargo_de_requisicion(text, text) from public, anon;
grant execute on function org.crear_cargo_de_requisicion(text, text) to authenticated;

-- Un campo del cargo: nombre, familia, nivel, sinónimos (separados por «;»), propósito o activo.
create or replace function org.editar_cargo(p_id uuid, p_campo text, p_valor text)
returns void
language plpgsql security invoker set search_path = org, public, extensions as $$
declare v_valor text := nullif(trim(coalesce(p_valor, '')), '');
begin
  perform org.exigir_permiso('sistema:estructura', 'editar', 'Tu rol no puede editar cargos.');
  if not exists (select 1 from org.cargo where id = p_id) then raise exception 'Ese cargo no existe.' using errcode = 'no_data_found'; end if;
  case p_campo
    when 'nombre' then
      if length(coalesce(v_valor, '')) < 3 then raise exception 'El nombre del cargo necesita al menos tres letras.' using errcode = 'check_violation'; end if;
      update org.cargo set nombre = v_valor where id = p_id;
    when 'familia' then update org.cargo set familia = v_valor where id = p_id;
    when 'nivel' then update org.cargo set nivel = v_valor::smallint where id = p_id;
    when 'proposito' then update org.cargo set proposito = v_valor where id = p_id;
    when 'sinonimos' then
      update org.cargo set sinonimos = coalesce((select array_agg(trim(x)) from unnest(string_to_array(coalesce(v_valor, ''), ';')) x where trim(x) <> ''), '{}') where id = p_id;
    when 'activo' then update org.cargo set activo = coalesce(v_valor, 'true')::boolean where id = p_id;
    else raise exception 'Campo de cargo no válido: %', p_campo using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

create or replace function sgc.editar_cruce(p_id uuid, p_campo text, p_valor text)
returns void
language plpgsql security invoker set search_path = sgc, public as $$
begin
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Tu rol no puede corregir el cruce.' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from sgc.proceso_cruce where id = p_id) then raise exception 'Ese par del cruce no existe.' using errcode = 'no_data_found'; end if;
  case p_campo
    when 'tipo' then update sgc.proceso_cruce set tipo = p_valor where id = p_id;
    when 'confirmado' then update sgc.proceso_cruce set confirmado = coalesce(nullif(p_valor, ''), 'true')::boolean where id = p_id;
    when 'nota' then update sgc.proceso_cruce set nota = nullif(trim(p_valor), '') where id = p_id;
    else raise exception 'Campo del cruce no válido: %', p_campo using errcode = 'invalid_parameter_value';
  end case;
end;
$$;

-- ── 3 · Ejecutar un cambio ───────────────────────────────────────────────────
-- Cada función de siempre, con la fecha del lote. Corre dentro de las funciones `security definer` de abajo: la
-- base no le pone RLS, pero cada función vuelve a pedir el permiso de quien figura en sesión (el autor).

create or replace function org.ejecutar_cambio(c org.cambio, d date)
returns void
language plpgsql security invoker set search_path = org, sgc, public, extensions as $$
declare
  a jsonb := c.args;
  pa jsonb := coalesce(c.parche, '{}');
  u org.unidad;
  p org.plaza;
  t text;
  u_ref uuid := (a ->> 'p_ref')::uuid;
begin
  case c.funcion
    when 'crear_unidad' then
      perform org.crear_unidad(a ->> 'p_clave', a ->> 'p_nombre', a ->> 'p_tipo', (a ->> 'p_padre_ref')::uuid, a ->> 'p_sede', d, a ->> 'p_codigo', a ->> 'p_nota');
    when 'editar_unidad' then
      select * into u from org.unidad where ref = u_ref and escenario_id is null and vigencia @> d;
      if not found then raise exception 'La unidad ya no está vigente.' using errcode = 'no_data_found'; end if;
      perform org.editar_unidad(u.ref, d,
        case when pa ? 'nombre' then pa ->> 'nombre' else u.nombre end,
        case when pa ? 'tipo' then pa ->> 'tipo' else u.tipo end,
        case when pa ? 'padre_ref' then (pa ->> 'padre_ref')::uuid else u.padre_ref end,
        coalesce(case when pa ? 'sede' then pa ->> 'sede' else u.sede end, ''),
        coalesce(case when pa ? 'codigo' then pa ->> 'codigo' else u.codigo_organigrama end, ''),
        coalesce(pa ->> 'certeza', ''), '');
    when 'cerrar_unidad' then
      perform org.cerrar_unidad((a ->> 'p_ref')::uuid, d, a ->> 'p_motivo');
    when 'crear_plaza' then
      perform org.crear_plaza((a ->> 'p_unidad_ref')::uuid, (a ->> 'p_cargo_id')::uuid, (a ->> 'p_dotacion')::int,
        (a ->> 'p_reporta_a_ref')::uuid, a ->> 'p_tipo_nomina', a ->> 'p_sede', a ->> 'p_estado', d, a ->> 'p_nota');
    when 'editar_plaza' then
      select * into p from org.plaza where ref = u_ref and escenario_id is null and vigencia @> d;
      if not found then raise exception 'La plaza ya no está vigente.' using errcode = 'no_data_found'; end if;
      perform org.editar_plaza(p.ref, d,
        case when pa ? 'dotacion' then (pa ->> 'dotacion')::int else p.dotacion end,
        case when pa ? 'reporta_a_ref' then (pa ->> 'reporta_a_ref')::uuid else p.reporta_a_ref end,
        case when pa ? 'estado' then pa ->> 'estado' else p.estado end,
        coalesce(case when pa ? 'tipo_nomina' then pa ->> 'tipo_nomina' else p.tipo_nomina end, ''),
        coalesce(case when pa ? 'sede' then pa ->> 'sede' else p.sede end, ''),
        case when pa ? 'unidad_ref' then (pa ->> 'unidad_ref')::uuid else p.unidad_ref end,
        coalesce(pa ->> 'certeza', ''), '');
    when 'cerrar_plaza' then
      perform org.cerrar_plaza((a ->> 'p_ref')::uuid, d, a ->> 'p_motivo');
    when 'asignar_ocupacion' then
      perform org.asignar_ocupacion((a ->> 'p_plaza_ref')::uuid, (a ->> 'p_empleado_id')::uuid, a ->> 'p_tipo', d,
        coalesce((a ->> 'p_excede')::boolean, false), a ->> 'p_motivo');
    when 'mover_ocupacion' then
      perform org.mover_ocupacion((a ->> 'p_id')::uuid, (a ->> 'p_plaza_destino')::uuid, d, a ->> 'p_tipo',
        coalesce((a ->> 'p_excede')::boolean, false), a ->> 'p_motivo');
    when 'terminar_ocupacion' then
      perform org.terminar_ocupacion((a ->> 'p_id')::uuid, d, a ->> 'p_motivo');
    when 'crear_cargo' then
      perform org.crear_cargo(a ->> 'p_nombre', a ->> 'p_familia', a ->> 'p_nivel',
        (select coalesce(array_agg(x), '{}') from jsonb_array_elements_text(coalesce(a -> 'p_sinonimos', '[]')) x), a ->> 'p_proposito');
    when 'editar_cargo' then
      perform org.editar_cargo((a ->> 'p_id')::uuid, a ->> 'p_campo', a ->> 'p_valor');
    when 'fijar_costo_referencia' then
      perform org.fijar_costo_referencia((a ->> 'p_cargo')::uuid, (a ->> 'p_salario')::numeric, a ->> 'p_moneda',
        (a ->> 'p_bonos_usd')::numeric, d, a ->> 'p_fuente');
    when 'crear_componente_costo' then
      perform org.crear_componente_costo(a ->> 'p_nombre', a ->> 'p_forma', (a ->> 'p_valor')::numeric, a ->> 'p_base',
        (a ->> 'p_tope')::numeric, a ->> 'p_piso', a ->> 'p_moneda', a ->> 'p_aplica_a', a ->> 'p_base_legal', a ->> 'p_fuente',
        coalesce((a ->> 'p_por_confirmar')::boolean, false), d, a ->> 'p_nota');
    when 'editar_componente_costo' then
      perform org.editar_componente_costo((a ->> 'p_id')::uuid, d, a ->> 'p_forma', (a ->> 'p_valor')::numeric, a ->> 'p_base',
        (a ->> 'p_tope')::numeric, a ->> 'p_piso', a ->> 'p_moneda', a ->> 'p_aplica_a', a ->> 'p_base_legal', a ->> 'p_fuente',
        coalesce((a ->> 'p_por_confirmar')::boolean, false), a ->> 'p_nota');
    when 'retirar_componente_costo' then
      perform org.retirar_componente_costo((a ->> 'p_id')::uuid, d);
    when 'fijar_parametro' then
      perform org.fijar_parametro(a ->> 'p_clave', (a ->> 'p_valor')::numeric, d, a ->> 'p_fuente', coalesce((a ->> 'p_por_confirmar')::boolean, false));
    when 'aprobar_plan_dotacion' then
      perform org.aprobar_plan_dotacion((a ->> 'p_plan')::uuid);
    when 'editar_cruce' then
      perform sgc.editar_cruce((a ->> 'p_id')::uuid, a ->> 'p_campo', a ->> 'p_valor');
  end case;
end;
$$;

-- Simula un lote (más un cambio nuevo) y lo deshace. Devuelve null si cuadra, o el mensaje del primer error.
create or replace function org.simular_cambios(p_esc uuid, p_nuevo org.cambio, p_fecha date)
returns text
language plpgsql security definer set search_path = org, public, extensions as $$
declare c org.cambio;
begin
  begin
    for c in select * from org.cambio where escenario_id = p_esc order by orden loop
      perform org.ejecutar_cambio(c, p_fecha);
    end loop;
    if p_nuevo.funcion is not null then perform org.ejecutar_cambio(p_nuevo, p_fecha); end if;
    raise exception using errcode = 'P0001', message = '__simulacion_ok__';
  exception when others then
    if sqlerrm = '__simulacion_ok__' then return null; end if;
    return sqlerrm;
  end;
end;
$$;
revoke all on function org.simular_cambios(uuid, org.cambio, date) from public, anon, authenticated;

-- Proponer un cambio: va al borrador de quien lo hace (se abre si no hay), después de simularlo con todo lo anterior.
create or replace function org.proponer_cambio(p_funcion text, p_args jsonb, p_descripcion text,
                                               p_parche jsonb default null, p_objeto text default null, p_objeto_ref uuid default null)
returns jsonb
language plpgsql security definer set search_path = org, public, extensions as $$
declare
  v_yo uuid := auth.uid();
  v_esc uuid;
  v_nuevo org.cambio;
  v_error text;
  v_n int;
begin
  if v_yo is null then raise exception 'Sesión requerida' using errcode = 'insufficient_privilege'; end if;
  select id into v_esc from org.escenario where tipo = 'cambios' and estado = 'borrador' and creado_por = v_yo;
  if v_esc is null then
    insert into org.escenario (nombre, descripcion, alcance, tipo, creado_por)
    values (format('Cambios de %s', coalesce((select nombre_completo from public.profiles where id = v_yo), 'la plataforma')),
            null, 'estructura', 'cambios', v_yo)
    returning id into v_esc;
  end if;
  v_nuevo := row(gen_random_uuid(), v_esc, 0, p_funcion, coalesce(p_args, '{}'), p_parche, coalesce(nullif(trim(p_descripcion), ''), p_funcion),
                 p_objeto, p_objeto_ref, now())::org.cambio;
  v_error := org.simular_cambios(v_esc, v_nuevo, org.hoy());
  if v_error is not null then raise exception '%', v_error using errcode = 'check_violation'; end if;
  insert into org.cambio (escenario_id, funcion, args, parche, descripcion, objeto, objeto_ref)
  values (v_esc, p_funcion, coalesce(p_args, '{}'), p_parche, v_nuevo.descripcion, p_objeto, p_objeto_ref);
  select count(*) into v_n from org.cambio where escenario_id = v_esc;
  return jsonb_build_object('escenario', v_esc, 'cambios', v_n);
end;
$$;
revoke all on function org.proponer_cambio(text, jsonb, text, jsonb, text, uuid) from public, anon;
grant execute on function org.proponer_cambio(text, jsonb, text, jsonb, text, uuid) to authenticated;

create or replace function org.quitar_cambio(p_id uuid)
returns void
language plpgsql security definer set search_path = org, public as $$
begin
  delete from org.cambio c using org.escenario e
   where c.id = p_id and e.id = c.escenario_id and e.tipo = 'cambios' and e.estado = 'borrador' and e.creado_por = auth.uid();
  if not found then raise exception 'Ese cambio no está en tu borrador.' using errcode = 'no_data_found'; end if;
end;
$$;
revoke all on function org.quitar_cambio(uuid) from public, anon;
grant execute on function org.quitar_cambio(uuid) to authenticated;

create or replace function org.descartar_cambios(p_esc uuid)
returns void
language plpgsql security definer set search_path = org, public as $$
begin
  perform set_config('flujo.aplicando', 'on', true);
  update org.escenario set estado = 'descartado'
   where id = p_esc and tipo = 'cambios' and estado = 'borrador' and creado_por = auth.uid();
  if not found then raise exception 'Ese borrador no es tuyo o ya se envió.' using errcode = 'no_data_found'; end if;
end;
$$;
revoke all on function org.descartar_cambios(uuid) from public, anon;
grant execute on function org.descartar_cambios(uuid) to authenticated;

create or replace function org.enviar_cambios(p_esc uuid, p_vigente_desde date, p_nota text default null)
returns uuid
language plpgsql security definer set search_path = org, flujo, public, extensions as $$
declare
  e org.escenario;
  v_error text;
  v_n int;
begin
  perform set_config('flujo.aplicando', 'on', true);
  select * into e from org.escenario where id = p_esc for update;
  if not found or e.tipo <> 'cambios' or e.creado_por is distinct from auth.uid() then
    raise exception 'Ese borrador de cambios no es tuyo.' using errcode = 'insufficient_privilege';
  end if;
  if e.estado <> 'borrador' then raise exception 'Ese borrador ya se envió.' using errcode = 'check_violation'; end if;
  if p_vigente_desde < org.hoy() then raise exception 'La vigencia retroactiva no se permite.' using errcode = 'check_violation'; end if;
  select count(*) into v_n from org.cambio where escenario_id = p_esc;
  if v_n = 0 then raise exception 'No hay cambios que enviar.' using errcode = 'check_violation'; end if;
  v_error := org.simular_cambios(p_esc, null, p_vigente_desde);
  if v_error is not null then raise exception 'Hay un cambio que ya no cuadra: %', v_error using errcode = 'check_violation'; end if;
  update org.escenario set estado = 'en_aprobacion', vigente_desde = p_vigente_desde,
         descripcion = coalesce(nullif(trim(p_nota), ''), descripcion)
   where id = p_esc;
  return flujo.iniciar('cambios', p_esc, format('%s · %s cambio(s)', e.nombre, v_n),
                       (select ref from org.unidad where escenario_id is null and padre_ref is null and vigencia @> org.hoy() limit 1), '{}');
end;
$$;
revoke all on function org.enviar_cambios(uuid, date, text) from public, anon;
grant execute on function org.enviar_cambios(uuid, date, text) to authenticated;

-- Un lote devuelto vuelve a ser el borrador de su autor. Si mientras tanto abrió otro, los cambios devueltos se suman a
-- ese (van primero, por su orden) y el lote devuelto se cierra: uno solo abierto por persona.
create or replace function org.devolver_cambios(p_esc uuid)
returns void
language plpgsql security definer set search_path = org, public as $$
declare e org.escenario; v_abierto uuid;
begin
  perform set_config('flujo.aplicando', 'on', true);
  select * into e from org.escenario where id = p_esc;
  select id into v_abierto from org.escenario
   where tipo = 'cambios' and estado = 'borrador' and creado_por = e.creado_por and id <> p_esc;
  if v_abierto is null then
    update org.escenario set estado = 'borrador' where id = p_esc;
  else
    update org.cambio set escenario_id = v_abierto where escenario_id = p_esc;
    update org.escenario set estado = 'descartado', descripcion = concat_ws(' · ', descripcion, 'Devuelto: sus cambios pasaron al borrador abierto')
     where id = p_esc;
  end if;
end;
$$;
revoke all on function org.devolver_cambios(uuid) from public, anon, authenticated;

-- Aplicar un lote aprobado: en orden, en su fecha, a nombre de su autor.
create or replace function org.publicar_cambios(p_esc uuid)
returns void
language plpgsql security definer set search_path = org, public, extensions as $$
declare
  e org.escenario;
  d date;
  c org.cambio;
  v_sub text := current_setting('request.jwt.claim.sub', true);
begin
  perform set_config('flujo.aplicando', 'on', true);
  select * into e from org.escenario where id = p_esc;
  d := greatest(coalesce(e.vigente_desde, org.hoy()), org.hoy());
  perform set_config('request.jwt.claim.sub', e.creado_por::text, true);
  begin
    for c in select * from org.cambio where escenario_id = p_esc order by orden loop
      perform org.ejecutar_cambio(c, d);
    end loop;
  exception when others then
    perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
    raise exception 'No se pudo aplicar «%»: %. Devuélvelo a su autor para que lo corrija.', c.descripcion, sqlerrm using errcode = 'check_violation';
  end;
  perform set_config('request.jwt.claim.sub', coalesce(v_sub, ''), true);
  update org.escenario set estado = 'publicado', publicado_en = now() where id = p_esc;
end;
$$;
revoke all on function org.publicar_cambios(uuid) from public, anon, authenticated;

-- ── 4 · La ruta: un solo paso, quien tenga la casilla ────────────────────────

alter table flujo.ruta_paso add column if not exists permiso text;
alter table flujo.ruta_paso drop constraint if exists ruta_paso_resolutor_check;
alter table flujo.ruta_paso add constraint ruta_paso_resolutor_check
  check (resolutor in ('cargo', 'plaza', 'jefe_unidad', 'director_unidad', 'rol', 'permiso'));
alter table flujo.ruta_paso drop constraint if exists ruta_paso_permiso_check;
alter table flujo.ruta_paso add constraint ruta_paso_permiso_check
  check (resolutor <> 'permiso' or permiso ~ '^[a-z]+:[a-z0-9-]+:(ver|crear|editar|eliminar)$');

-- flujo.iniciar: igual que antes, con el permiso del paso en su regla.
CREATE OR REPLACE FUNCTION flujo.iniciar(p_tipo text, p_objeto uuid, p_titulo text, p_unidad uuid, p_contexto jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'flujo', 'org', 'public'
AS $function$
declare
  v_ruta flujo.ruta;
  v_sol uuid;
  s record;
  v_plaza uuid;
  v_perfil uuid;
  v_aplica boolean;
  v_primero int;
begin
  select * into v_ruta from flujo.ruta where tipo_objeto = p_tipo and activa and vigencia @> current_date;
  if not found then
    raise exception 'No hay una ruta de aprobación activa para «%»', p_tipo using errcode = 'no_data_found';
  end if;
  insert into flujo.solicitud (tipo_objeto, objeto_id, ruta_id, titulo, creado_por)
  values (p_tipo, p_objeto, v_ruta.id, p_titulo, auth.uid()) returning id into v_sol;

  for s in select * from flujo.ruta_paso where ruta_id = v_ruta.id order by orden loop
    v_aplica := true;
    if s.condicion is not null then
      select bool_and(case jsonb_typeof(c.value)
                        when 'array' then c.value @> to_jsonb(p_contexto -> c.key) or (p_contexto -> c.key) is null and false
                        else (p_contexto -> c.key) = c.value end)
        into v_aplica from jsonb_each(s.condicion) c;
      v_aplica := coalesce(v_aplica, true);
    end if;

    v_plaza := case s.resolutor
      when 'plaza' then s.plaza_ref
      when 'cargo' then (select p.ref from org.plaza p where p.cargo_id = s.cargo_id and p.escenario_id is null
                          and p.vigencia @> current_date order by p.dotacion, p.ref limit 1)
      when 'jefe_unidad' then org.plaza_jefe_de(p_unidad)
      when 'director_unidad' then org.plaza_jefe_de(org.direccion_de(p_unidad))
      else null end;
    v_perfil := case when v_plaza is not null then org.perfil_de_plaza(v_plaza) end;

    insert into flujo.paso (solicitud_id, orden, nombre, accion, ve_costos, hito, aprobador_plaza_ref, aprobador_perfil, regla, decision)
    values (v_sol, s.orden, s.nombre, s.accion, s.ve_costos, s.hito, v_plaza, v_perfil,
            jsonb_build_object('ruta', v_ruta.nombre, 'ruta_paso_id', s.id, 'resolutor', s.resolutor, 'rol_id', s.rol_id,
                               'permiso', s.permiso,
                               'sin_cuenta', v_plaza is not null and v_perfil is null, 'condicion', s.condicion),
            case when v_aplica then 'pendiente' else 'omitido' end);
  end loop;

  select min(orden) into v_primero from flujo.paso where solicitud_id = v_sol and decision = 'pendiente';
  update flujo.solicitud set paso_actual = v_primero,
         estado = case when v_primero is null then 'aprobada' else 'en_curso' end
   where id = v_sol;
  return v_sol;
end;
$function$;

-- Quién decide: lo de antes, más el paso «por permiso» (cualquiera con la casilla; el nivel administrador siempre).
CREATE OR REPLACE FUNCTION privado.puede_decidir_de(p_perfil uuid, p_paso uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'flujo', 'public'
AS $function$
  with x as (
    select p.*, s.estado as s_estado, s.paso_actual, s.creado_por as pidio,
           privado.autor_de_solicitud(s.tipo_objeto, s.objeto_id) as autor,
           coalesce(r.permite_suplencia_repetida, false) as suplencia_repetida
      from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
      left join flujo.ruta r on r.id = s.ruta_id
     where p.id = p_paso
  ), y as (
    select x.*,
           (x.aprobador_perfil is not null and (
               x.aprobador_perfil is not distinct from x.pidio
            or x.aprobador_perfil is not distinct from x.autor
            or not exists (select 1 from public.profiles pr where pr.id = x.aprobador_perfil and pr.activo)
            or exists (select 1 from flujo.paso q where q.solicitud_id = x.solicitud_id and q.id <> x.id
                          and q.decidido_por = x.aprobador_perfil and q.decision in ('aprobado', 'rechazado', 'devuelto')))) as en_conflicto
      from x
  )
  select coalesce((
    select y.s_estado = 'en_curso' and y.decision = 'pendiente' and y.paso_actual = y.orden
       and p_perfil is not null
       and exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo)
       and y.pidio is distinct from p_perfil
       and y.autor is distinct from p_perfil
       and (not exists (select 1 from flujo.paso q where q.solicitud_id = y.solicitud_id and q.id <> y.id
                         and q.decidido_por = p_perfil and q.decision in ('aprobado', 'rechazado', 'devuelto'))
            or (y.suplencia_repetida
                and ((y.aprobador_perfil is null and coalesce(y.regla ->> 'resolutor', '') not in ('rol', 'permiso')) or y.en_conflicto)
                and not exists (select 1 from flujo.paso q where q.solicitud_id = y.solicitud_id and q.id <> y.id
                                 and q.decidido_por = p_perfil and q.decision in ('aprobado', 'rechazado', 'devuelto')
                                 and not q.por_suplencia)))
       and (
            (y.aprobador_perfil = p_perfil and not y.en_conflicto)
         or (y.aprobador_perfil is null and y.regla ->> 'resolutor' = 'rol'
             and exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo and pr.rol_id::text = y.regla ->> 'rol_id'))
         or (y.regla ->> 'resolutor' = 'permiso'
             and (privado.puede_perfil(p_perfil, split_part(y.regla ->> 'permiso', ':', 1) || ':' || split_part(y.regla ->> 'permiso', ':', 2),
                                       split_part(y.regla ->> 'permiso', ':', 3))
                  or exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo and pr.rol = 'admin')))
         or ((y.aprobador_perfil is null and coalesce(y.regla ->> 'resolutor', '') not in ('rol', 'permiso')) or y.en_conflicto)
             and (privado.puede_perfil(p_perfil, 'sistema:aprobaciones', 'editar')
                  or exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo and pr.rol = 'admin'))
       )
      from y), false);
$function$;

CREATE OR REPLACE FUNCTION privado.autor_de_solicitud(p_tipo text, p_objeto uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'org', 'sgc', 'ia', 'public'
AS $function$
  select case p_tipo
    when 'requisicion_personal' then (select creado_por from org.requisicion where id = p_objeto)
    when 'escenario_estructura' then (select creado_por from org.escenario where id = p_objeto)
    when 'escenario_procesos' then (select creado_por from org.escenario where id = p_objeto)
    when 'cambios' then (select creado_por from org.escenario where id = p_objeto)
    when 'proceso' then (select creado_por from sgc.proceso where id = p_objeto)
    when 'nivel_ia' then (select pedido_por from ia.cambio_nivel where id = p_objeto)
  end;
$function$;

-- flujo.al_decidir: el mismo de antes, más el lote de cambios.
CREATE OR REPLACE FUNCTION flujo.al_decidir(p_tipo text, p_objeto uuid, p_accion text, p_hito boolean, p_decision text, p_estado_solicitud text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'flujo', 'org', 'sgc', 'public'
AS $function$
begin
  perform set_config('flujo.aplicando', 'on', true);
  if p_tipo = 'requisicion_personal' then
    if p_decision = 'rechazado' then
      update org.requisicion set estado = 'rechazada' where id = p_objeto;
    elsif p_decision = 'devuelto' then
      update org.requisicion set estado = 'devuelta' where id = p_objeto;
    elsif p_hito then
      update org.requisicion set estado = 'aprobada' where id = p_objeto;
      perform org.aplicar_requisicion(p_objeto);
    elsif p_accion = 'recibir' then
      update org.requisicion set estado = 'en_seleccion' where id = p_objeto;
    end if;
  elsif p_tipo = 'proceso' then
    if p_decision = 'rechazado' or p_decision = 'devuelto' then
      update sgc.proceso set estado = 'borrador' where id = p_objeto and estado = 'en_revision';
    elsif p_estado_solicitud = 'aprobada' then
      perform sgc.publicar_proceso(p_objeto);
    end if;
  elsif p_tipo = 'escenario_estructura' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform org.publicar_escenario(p_objeto);
    end if;
  elsif p_tipo = 'escenario_procesos' then
    if p_decision in ('rechazado', 'devuelto') then
      update org.escenario set estado = 'borrador' where id = p_objeto;
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform sgc.publicar_escenario_procesos(p_objeto);
    end if;
  elsif p_tipo = 'cambios' then
    if p_decision = 'rechazado' then
      update org.escenario set estado = 'descartado' where id = p_objeto;
    elsif p_decision = 'devuelto' then
      perform org.devolver_cambios(p_objeto);
    elsif p_estado_solicitud = 'aprobada' then
      update org.escenario set estado = 'aprobado' where id = p_objeto;
      perform org.publicar_cambios(p_objeto);
    end if;
  elsif p_tipo = 'nivel_ia' then
    perform ia.al_decidir_nivel(p_objeto, p_decision, p_estado_solicitud);
  end if;
end;
$function$;

-- Las rutas: los cambios, los escenarios y las versiones de proceso, en un solo paso por casilla.
do $$
declare v_ruta uuid; t record;
begin
  for t in select * from (values
      ('cambios', 'Cambios a la estructura', 'Las ediciones de estructura, personas, cargos, costos, plan y cruce, en lote'),
      ('escenario_estructura', 'Escenario de estructura', null),
      ('escenario_procesos', 'Escenario de procesos', null),
      ('proceso', 'Versión de un proceso', null)) as x(tipo, nombre, descripcion) loop
    select id into v_ruta from flujo.ruta where tipo_objeto = t.tipo and activa and vigencia @> current_date;
    if v_ruta is null then
      insert into flujo.ruta (tipo_objeto, nombre, descripcion, activa) values (t.tipo, t.nombre, t.descripcion, true) returning id into v_ruta;
    end if;
    delete from flujo.ruta_paso where ruta_id = v_ruta;
    insert into flujo.ruta_paso (ruta_id, orden, nombre, resolutor, permiso, accion, hito)
    values (v_ruta, 1, 'Aprueba quien tiene «Aprobar cambios»', 'permiso', 'sistema:cambios:editar', 'aprobar', true);
    update flujo.ruta set permite_suplencia_repetida = false where id = v_ruta;
  end loop;
end $$;

-- ── 5 · Las tablas reales ya no se escriben por la API ───────────────────────
-- Lo real cambia solo por las funciones del flujo (publicar) o por proponer (que simula y deshace). Las filas de un
-- escenario de diseño siguen con sus políticas «diseñar escenario».

do $$
declare t text;
begin
  foreach t in array array['org.unidad', 'org.plaza', 'org.ocupacion', 'org.cargo', 'org.costo_referencia', 'org.componente_costo',
                           'control.parametro', 'sgc.proceso_cruce'] loop
    execute format('drop policy if exists "crear con permiso" on %s', t);
    execute format('drop policy if exists "editar con permiso" on %s', t);
    execute format('drop policy if exists "eliminar con permiso" on %s', t);
  end loop;
end $$;

revoke execute on function org.crear_unidad(text, text, text, uuid, text, date, text, text) from authenticated, public;
revoke execute on function org.editar_unidad(uuid, date, text, text, uuid, text, text, text, text) from authenticated, public;
revoke execute on function org.cerrar_unidad(uuid, date, text) from authenticated, public;
revoke execute on function org.crear_plaza(uuid, uuid, integer, uuid, text, text, text, date, text) from authenticated, public;
revoke execute on function org.editar_plaza(uuid, date, integer, uuid, text, text, text, uuid, text, text) from authenticated, public;
revoke execute on function org.cerrar_plaza(uuid, date, text) from authenticated, public;
revoke execute on function org.asignar_ocupacion(uuid, uuid, text, date, boolean, text) from authenticated, public;
revoke execute on function org.mover_ocupacion(uuid, uuid, date, text, boolean, text) from authenticated, public;
revoke execute on function org.terminar_ocupacion(uuid, date, text) from authenticated, public;
revoke execute on function org.crear_cargo(text, text, text, text[], text) from authenticated, public;
revoke execute on function org.editar_cargo(uuid, text, text) from authenticated, public;
revoke execute on function org.fijar_costo_referencia(uuid, numeric, text, numeric, date, text) from authenticated, public;
revoke execute on function org.crear_componente_costo(text, text, numeric, text, numeric, text, text, text, text, text, boolean, date, text) from authenticated, public;
revoke execute on function org.editar_componente_costo(uuid, date, text, numeric, text, numeric, text, text, text, text, text, boolean, text) from authenticated, public;
revoke execute on function org.retirar_componente_costo(uuid, date) from authenticated, public;
revoke execute on function org.fijar_parametro(text, numeric, date, text, boolean) from authenticated, public;
revoke execute on function org.aprobar_plan_dotacion(uuid) from authenticated, public;
revoke execute on function sgc.editar_cruce(uuid, text, text) from authenticated, public;
revoke execute on function org.ejecutar_cambio(org.cambio, date) from authenticated, public;
