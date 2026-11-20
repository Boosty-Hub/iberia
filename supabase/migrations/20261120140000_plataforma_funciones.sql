-- =============================================================================
-- PLATAFORMA IBERIA · ETAPA 1 · la lógica: conciliación, costo de una plaza,
-- impacto de una requisición, rutas de aprobación, ciclo de los procesos y
-- publicación de escenarios
--
-- Regla de la casa: **la base decide**. Quién aprueba, si el paso es el que
-- toca, si quien pide puede aprobar lo suyo (no), qué pasa con la plaza al
-- aprobarse: todo vive aquí, no en la pantalla.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) CONCILIACIÓN: lo que la carga inicial no pudo decidir sola
-- -----------------------------------------------------------------------------
create table if not exists control.conciliacion (
  id          uuid primary key default gen_random_uuid(),
  modulo      text not null,                  -- NUC-ORG, NUC-PRO, NUC-DOC
  tipo        text not null check (tipo in ('contradiccion', 'faltante', 'sin_casar', 'inferencia', 'decision')),
  descripcion text not null,
  objeto      text,                           -- clave o código afectado
  fuente      text,
  responsable text,                           -- cargo que lo resuelve
  estado      text not null default 'abierto' check (estado in ('abierto', 'resuelto', 'descartado')),
  resolucion  text,
  resuelto_por uuid references public.profiles (id),
  resuelto_en timestamptz,
  creado_en   timestamptz not null default now(),
  unique (modulo, tipo, descripcion)
);
alter table control.conciliacion enable row level security;
grant select, insert, update on control.conciliacion to authenticated;
grant all on control.conciliacion to service_role;
create policy "ver conciliación" on control.conciliacion for select to authenticated
  using (public.puede('sistema:estructura', 'ver') or public.puede('sistema:procesos', 'ver') or public.puede('sistema:documentos', 'ver'));
create policy "resolver conciliación" on control.conciliacion for update to authenticated
  using (public.puede('sistema:estructura', 'editar') or public.puede('sistema:procesos', 'editar') or public.puede('sistema:documentos', 'editar'))
  with check (true);
create trigger auditar after insert or update or delete on control.conciliacion
  for each row execute function control.auditar();

-- El hito de una ruta: el paso cuya aprobación «aprueba» el objeto (en la
-- requisición, la firma del Gerente General); lo que sigue es ejecución.
alter table flujo.ruta_paso add column if not exists hito boolean not null default false;
alter table flujo.paso add column if not exists hito boolean not null default false;

-- -----------------------------------------------------------------------------
-- 2) AYUDAS DE ESTRUCTURA
-- -----------------------------------------------------------------------------

-- La cuenta (perfil) del titular de una plaza hoy, si la tiene.
create or replace function org.perfil_de_plaza(p_plaza uuid, p_fecha date default current_date)
returns uuid language sql stable security definer set search_path = org, public as $$
  select e.perfil_id from org.ocupacion o join public.empleados e on e.id = o.empleado_id
   where o.plaza_ref = p_plaza and o.vigencia @> p_fecha and e.perfil_id is not null
   order by (o.tipo = 'titular') desc, lower(o.vigencia) limit 1;
$$;

-- La plaza que encabeza una unidad: la que no reporta a otra plaza de la misma unidad.
create or replace function org.plaza_jefe_de(p_unidad uuid, p_fecha date default current_date)
returns uuid language sql stable security definer set search_path = org, public as $$
  select p.ref from org.plaza p
   where p.unidad_ref = p_unidad and p.escenario_id is null and p.vigencia @> p_fecha
     and not exists (select 1 from org.plaza q
                      where q.ref = p.reporta_a_ref and q.unidad_ref = p_unidad
                        and q.escenario_id is null and q.vigencia @> p_fecha)
   order by p.dotacion, p.ref limit 1;
$$;

-- La unidad de tipo dirección (o la dirección general) que contiene a una unidad.
create or replace function org.direccion_de(p_unidad uuid, p_fecha date default current_date)
returns uuid language plpgsql stable security definer set search_path = org, public as $$
declare
  v_ref uuid := p_unidad;
  v_tipo text;
  v_padre uuid;
  i int := 0;
begin
  loop
    select tipo, padre_ref into v_tipo, v_padre from org.unidad
     where ref = v_ref and escenario_id is null and vigencia @> p_fecha;
    if v_tipo in ('direccion', 'direccion_general') or v_padre is null or i > 12 then
      return v_ref;
    end if;
    v_ref := v_padre;
    i := i + 1;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) COSTO DE UN CARGO · perímetro de nómina
-- -----------------------------------------------------------------------------
-- `security invoker`: corre con los permisos de quien pregunta, así que sin
-- `sistema:costos` la RLS le devuelve vacío y la función devuelve nulo. El costo
-- es de REFERENCIA del cargo, no el salario de nadie.
create or replace function org.costo_mensual(p_cargo uuid, p_fecha date default current_date, p_tasa numeric default null)
returns jsonb
language plpgsql stable security invoker set search_path = org, control, public as $$
declare
  r record;
  c record;
  v_tasa numeric := p_tasa;
  v_sm numeric;
  s numeric; b numeric; si numeric;
  v_util numeric := 30; v_vac numeric := 15;
  v_base numeric; v_monto numeric; v_piso numeric;
  v_total numeric;
  v_lineas jsonb := '[]'::jsonb;
  v_pendiente boolean := false;
begin
  select * into r from org.costo_referencia where cargo_id = p_cargo and vigencia @> p_fecha;
  if not found then return null; end if;
  if v_tasa is null then
    select ves_por_usd into v_tasa from org.tasa_cambio where fecha <= p_fecha order by fecha desc limit 1;
  end if;
  select valor into v_sm from control.parametro where clave = 'salario_minimo_ves' and vigencia @> p_fecha;

  s := case when r.moneda = 'USD' then r.salario_mensual * v_tasa else r.salario_mensual end;
  b := r.bonos_usd_mensual * v_tasa;
  select coalesce(max(valor) filter (where nombre ilike 'utilidades%'), 30),
         coalesce(max(valor) filter (where nombre ilike 'bono vacacional%'), 15)
    into v_util, v_vac
    from org.componente_costo where vigencia @> p_fecha;
  si := s + s / 30 * v_util / 12 + s / 30 * v_vac / 12;
  v_total := s + coalesce(b, 0);

  for c in select * from org.componente_costo where vigencia @> p_fecha order by orden loop
    v_base := case c.base when 'salario_normal' then s when 'salario_integral' then si
                          when 'salario_y_bonos' then s + coalesce(b, 0) else 0 end;
    if c.piso_parametro is not null then
      select case when unidad = 'USD' then valor * v_tasa else valor end into v_piso
        from control.parametro where clave = c.piso_parametro and vigencia @> p_fecha;
      v_base := greatest(v_base, coalesce(v_piso, 0));
    end if;
    if c.tope_salarios_minimos is not null and v_sm is not null then
      v_base := least(v_base, c.tope_salarios_minimos * v_sm);
    end if;
    v_monto := case c.forma
      when 'porcentaje' then v_base * c.valor / 100
      when 'dias_anuales' then v_base / 30 * c.valor / 12
      when 'monto_mensual' then case when c.moneda = 'USD' then c.valor * v_tasa else c.valor end
    end;
    v_total := v_total + coalesce(v_monto, 0);
    v_pendiente := v_pendiente or c.por_confirmar;
    v_lineas := v_lineas || jsonb_build_object('nombre', c.nombre, 'monto_ves', round(v_monto, 2), 'por_confirmar', c.por_confirmar);
  end loop;

  return jsonb_build_object(
    'salario_ves', round(s, 2), 'bonos_ves', round(b, 2), 'componentes', v_lineas,
    'total_ves', round(v_total, 2), 'total_usd', case when v_tasa > 0 then round(v_total / v_tasa, 2) end,
    'tasa', v_tasa, 'fecha', p_fecha, 'por_confirmar', v_pendiente);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) IMPACTO DE UNA REQUISICIÓN (sin costos: esos van aparte, en el perímetro)
-- -----------------------------------------------------------------------------
create or replace function org.impacto_requisicion(p_req uuid)
returns jsonb
language plpgsql stable security definer set search_path = org, sgc, flujo, public as $$
declare
  q org.requisicion;
  v_hoy date := current_date;
  v_aprobada int; v_ocupada int; v_plan int;
  v_jefe uuid; v_tramo int;
  v_procesos jsonb; v_rutas jsonb; v_subordinadas int;
begin
  select * into q from org.requisicion where id = p_req;
  if not found then return null; end if;

  select coalesce(sum(dotacion), 0) into v_aprobada from org.plaza
   where unidad_ref = q.unidad_ref and escenario_id is null and vigencia @> v_hoy and estado <> 'cerrada';
  select count(*) into v_ocupada from org.ocupacion o join org.plaza p on p.ref = o.plaza_ref
   where p.unidad_ref = q.unidad_ref and p.escenario_id is null and p.vigencia @> v_hoy
     and o.tipo = 'titular' and o.vigencia @> v_hoy;
  select l.cantidad into v_plan from org.plan_dotacion_linea l join org.plan_dotacion d on d.id = l.plan_id
   where d.anio = extract(year from v_hoy) and d.estado = 'aprobado' and l.unidad_ref = q.unidad_ref and l.cargo_id = q.cargo_id;

  v_jefe := org.plaza_jefe_de(q.unidad_ref);
  select count(*) into v_tramo from org.plaza where reporta_a_ref = v_jefe and escenario_id is null and vigencia @> v_hoy;

  -- Dependencias del cargo en la unidad: procesos que dirige, rutas donde firma,
  -- plazas que le reportan.
  select coalesce(jsonb_agg(jsonb_build_object('nombre', pr.nombre, 'codigo', coalesce(pr.codigo_sgc, pr.codigo_informe))), '[]')
    into v_procesos
    from sgc.proceso pr join org.plaza p on p.ref = pr.dueno_plaza_ref
   where p.cargo_id = q.cargo_id and pr.estado = 'vigente' and pr.escenario_id is null;
  select coalesce(jsonb_agg(jsonb_build_object('ruta', r.nombre, 'paso', rp.nombre)), '[]')
    into v_rutas
    from flujo.ruta_paso rp join flujo.ruta r on r.id = rp.ruta_id
   where rp.cargo_id = q.cargo_id and r.activa;
  select count(*) into v_subordinadas from org.plaza s join org.plaza p on p.ref = s.reporta_a_ref
   where p.cargo_id = q.cargo_id and p.unidad_ref = q.unidad_ref
     and s.escenario_id is null and s.vigencia @> v_hoy and p.escenario_id is null and p.vigencia @> v_hoy;

  return jsonb_build_object(
    'fecha', v_hoy,
    'dotacion_aprobada', v_aprobada,
    'dotacion_ocupada', v_ocupada,
    'dotacion_despues', v_aprobada + case when q.origen in ('cargo_nuevo', 'tiempo_determinado', 'pasante') then q.cantidad else 0 end,
    'plan_del_anio', v_plan,
    'fuera_de_plan', q.origen = 'cargo_nuevo' and (v_plan is null or v_aprobada + q.cantidad > v_plan),
    'tramo_jefe_antes', v_tramo,
    'tramo_jefe_despues', v_tramo + case when q.origen = 'cargo_nuevo' and q.plaza_ref is null then 1 else 0 end,
    'procesos_del_cargo', v_procesos,
    'rutas_donde_firma', v_rutas,
    'plazas_que_le_reportan', v_subordinadas
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) RUTAS DE APROBACIÓN
-- -----------------------------------------------------------------------------

-- Abre una solicitud sobre un objeto con la ruta activa de su tipo. Cada paso
-- resuelve quién firma DESDE LA ESTRUCTURA, y guarda cómo lo resolvió.
create or replace function flujo.iniciar(p_tipo text, p_objeto uuid, p_titulo text, p_unidad uuid, p_contexto jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = flujo, org, public as $$
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
    -- La condición se cumple si cada clave del paso coincide con el contexto
    -- (un arreglo = cualquiera de sus valores).
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
                               'sin_cuenta', v_plaza is not null and v_perfil is null, 'condicion', s.condicion),
            case when v_aplica then 'pendiente' else 'omitido' end);
  end loop;

  select min(orden) into v_primero from flujo.paso where solicitud_id = v_sol and decision = 'pendiente';
  update flujo.solicitud set paso_actual = v_primero,
         estado = case when v_primero is null then 'aprobada' else 'en_curso' end
   where id = v_sol;
  return v_sol;
end;
$$;

-- ¿Puede quien llama decidir este paso? El aprobador resuelto; si el paso cae
-- en una plaza sin cuenta (vacante o sin acceso), quien administra aprobaciones;
-- si es por rol, quien tenga ese rol. Nunca quien abrió la solicitud.
create or replace function flujo.puede_decidir(p_paso uuid)
returns boolean language sql stable security definer set search_path = flujo, public as $$
  select coalesce((
    select s.estado = 'en_curso' and p.decision = 'pendiente' and s.paso_actual = p.orden
       and s.creado_por is distinct from auth.uid()
       and (p.aprobador_perfil = auth.uid()
            or (p.regla ->> 'resolutor' = 'rol' and exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.rol_id::text = p.regla ->> 'rol_id'))
            or (p.aprobador_perfil is null and public.puede('sistema:aprobaciones', 'editar'))
            or public.es_admin())
      from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
     where p.id = p_paso), false);
$$;

create or replace function flujo.decidir(p_paso uuid, p_decision text, p_comentario text default null)
returns text
language plpgsql security definer set search_path = flujo, org, sgc, public as $$
declare
  p flujo.paso;
  s flujo.solicitud;
  v_siguiente int;
begin
  if p_decision not in ('aprobado', 'rechazado', 'devuelto') then
    raise exception 'Decisión no válida' using errcode = 'check_violation';
  end if;
  if not flujo.puede_decidir(p_paso) then
    raise exception 'Este paso no te toca, ya se decidió, o es tu propia solicitud' using errcode = 'insufficient_privilege';
  end if;
  if p_decision in ('rechazado', 'devuelto') and coalesce(trim(p_comentario), '') = '' then
    raise exception 'Rechazar o devolver pide un motivo' using errcode = 'check_violation';
  end if;

  update flujo.paso set decision = p_decision, comentario = p_comentario, decidido_por = auth.uid(), decidido_en = now()
   where id = p_paso returning * into p;
  select * into s from flujo.solicitud where id = p.solicitud_id;

  if p_decision = 'aprobado' then
    select min(orden) into v_siguiente from flujo.paso where solicitud_id = s.id and decision = 'pendiente';
    update flujo.solicitud set paso_actual = v_siguiente,
           estado = case when v_siguiente is null then 'aprobada' else 'en_curso' end,
           cerrado_en = case when v_siguiente is null then now() end
     where id = s.id returning * into s;
  else
    update flujo.solicitud set estado = case p_decision when 'rechazado' then 'rechazada' else 'devuelta' end,
           paso_actual = null, cerrado_en = now()
     where id = s.id returning * into s;
  end if;

  perform flujo.al_decidir(s.tipo_objeto, s.objeto_id, p.accion, p.hito, p_decision, s.estado);
  return s.estado;
end;
$$;

-- Lo que cada tipo de objeto hace al decidirse un paso.
create or replace function flujo.al_decidir(p_tipo text, p_objeto uuid, p_accion text, p_hito boolean, p_decision text, p_estado_solicitud text)
returns void
language plpgsql security definer set search_path = flujo, org, sgc, public as $$
begin
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
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6) REQUISICIÓN DE PERSONAL
-- -----------------------------------------------------------------------------

create or replace function org.enviar_requisicion(p_req uuid)
returns uuid
language plpgsql security definer set search_path = org, flujo, public as $$
declare
  q org.requisicion;
  v_impacto jsonb;
  v_sol uuid;
  v_cargo text;
begin
  select * into q from org.requisicion where id = p_req for update;
  if not found then raise exception 'La requisición no existe'; end if;
  if q.creado_por is distinct from auth.uid() and not public.puede('sistema:requisiciones', 'editar') then
    raise exception 'Solo quien la pidió o Recursos Humanos la envía' using errcode = 'insufficient_privilege';
  end if;
  if q.estado not in ('borrador', 'devuelta') then
    raise exception 'Solo se envía un borrador o una requisición devuelta' using errcode = 'check_violation';
  end if;

  v_impacto := org.impacto_requisicion(p_req);
  select nombre into v_cargo from org.cargo where id = q.cargo_id;
  v_sol := flujo.iniciar('requisicion_personal', p_req,
                         format('Requisición %s · %s (%s)', q.numero, v_cargo, q.cantidad), q.unidad_ref,
                         jsonb_build_object('origen', q.origen, 'fuera_de_plan', v_impacto -> 'fuera_de_plan'));
  update org.requisicion set estado = 'en_aprobacion', impacto = v_impacto, solicitud_id = v_sol where id = p_req;

  -- El costo, congelado aparte (perímetro). Se calcula con permisos de servicio
  -- porque quien pide no ve costos; lo leen solo los pasos y roles con costos.
  insert into org.requisicion_costo (requisicion_id, impacto_costo)
  values (p_req, (select jsonb_build_object('por_plaza', org.costo_mensual_servicio(q.cargo_id), 'cantidad', q.cantidad)))
  on conflict (requisicion_id) do update set impacto_costo = excluded.impacto_costo;
  return v_sol;
end;
$$;

-- El cálculo de costo con los permisos de la función (para congelarlo al enviar).
create or replace function org.costo_mensual_servicio(p_cargo uuid)
returns jsonb language sql stable security definer set search_path = org, control, public as $$
  select org.costo_mensual(p_cargo);
$$;
revoke execute on function org.costo_mensual_servicio(uuid) from authenticated, public;

-- Al aprobarse (el hito): un cargo nuevo crea su plaza «en creación» o sube la
-- dotación de la que ya existe, con fecha de hoy. La versión anterior se cierra.
create or replace function org.aplicar_requisicion(p_req uuid)
returns void
language plpgsql security definer set search_path = org, public as $$
declare
  q org.requisicion;
  v org.plaza;
begin
  select * into q from org.requisicion where id = p_req;
  if q.origen not in ('cargo_nuevo', 'tiempo_determinado', 'pasante') or q.plaza_ref is not null then
    return;   -- una vacante no cambia la estructura: la plaza ya existe
  end if;
  select * into v from org.plaza
   where unidad_ref = q.unidad_ref and cargo_id = q.cargo_id and escenario_id is null and vigencia @> current_date
   limit 1;
  if found then
    update org.plaza set vigencia = daterange(lower(vigencia), current_date) where id = v.id;
    insert into org.plaza (ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, vigencia, fuente, certeza, nota)
    values (v.ref, v.unidad_ref, v.cargo_id, v.reporta_a_ref, v.dotacion + q.cantidad, v.tipo_nomina, v.sede, v.estado,
            daterange(current_date, null), format('Requisición %s', q.numero), 'hecho', v.nota);
    update org.requisicion set plaza_ref = v.ref where id = p_req;
  else
    insert into org.plaza (unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, estado, vigencia, fuente, certeza)
    values (q.unidad_ref, q.cargo_id, org.plaza_jefe_de(q.unidad_ref), q.cantidad, q.tipo_nomina, 'en_creacion',
            daterange(current_date, null), format('Requisición %s', q.numero), 'hecho')
    returning * into v;
    update org.requisicion set plaza_ref = v.ref where id = p_req;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) CICLO DE LOS PROCESOS: borrador → revisión → vigente
-- -----------------------------------------------------------------------------

-- Abre un borrador nuevo a partir de la versión vigente (o devuelve el que ya hay).
create or replace function sgc.nuevo_borrador(p_ref uuid)
returns uuid
language plpgsql security invoker set search_path = sgc, public as $$
declare
  v sgc.proceso;
  v_id uuid;
begin
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Sin permiso para editar procesos' using errcode = 'insufficient_privilege';
  end if;
  select id into v_id from sgc.proceso where ref = p_ref and escenario_id is null and estado in ('borrador', 'en_revision');
  if found then return v_id; end if;
  select * into v from sgc.proceso where ref = p_ref and escenario_id is null and estado = 'vigente';
  if not found then raise exception 'El proceso no tiene versión vigente'; end if;
  insert into sgc.proceso (ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe,
                           estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha, estado, version, fuente, nota)
  values (v.ref, v.clave, v.nivel, v.padre_ref, v.orden, v.nombre, v.tipo, v.codigo_sgc, v.generacion, v.codigo_informe,
          v.estado_operativo, v.dueno_plaza_ref, v.dueno_texto, v.area_texto, v.ficha, 'borrador', v.version + 1, v.fuente, v.nota)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function sgc.enviar_proceso(p_id uuid)
returns uuid
language plpgsql security definer set search_path = sgc, flujo, org, public as $$
declare
  v sgc.proceso;
  v_unidad uuid;
begin
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Sin permiso para editar procesos' using errcode = 'insufficient_privilege';
  end if;
  select * into v from sgc.proceso where id = p_id for update;
  if v.estado <> 'borrador' then raise exception 'Solo se envía un borrador'; end if;
  select unidad_ref into v_unidad from org.plaza where ref = v.dueno_plaza_ref and escenario_id is null limit 1;
  update sgc.proceso set estado = 'en_revision' where id = p_id;
  return flujo.iniciar('proceso', p_id, format('%s · versión %s', v.nombre, v.version), v_unidad, '{}');
end;
$$;

-- Publica: cierra la vigente hoy y abre la nueva desde hoy.
create or replace function sgc.publicar_proceso(p_id uuid)
returns void
language plpgsql security definer set search_path = sgc, public as $$
declare
  v sgc.proceso;
begin
  select * into v from sgc.proceso where id = p_id;
  update sgc.proceso set estado = 'reemplazada', vigencia = daterange(lower(vigencia), current_date)
   where ref = v.ref and escenario_id is null and estado = 'vigente' and lower(vigencia) < current_date;
  -- Una vigente que nació hoy mismo se reemplaza sin rango vacío.
  update sgc.proceso set estado = 'reemplazada', vigencia = null
   where ref = v.ref and escenario_id is null and estado = 'vigente';
  update sgc.proceso set estado = 'vigente', vigencia = daterange(current_date, null) where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8) ESCENARIOS DE ESTRUCTURA: enviar y publicar
-- -----------------------------------------------------------------------------

create or replace function org.enviar_escenario(p_esc uuid, p_vigente_desde date)
returns uuid
language plpgsql security definer set search_path = org, flujo, public as $$
declare
  e org.escenario;
begin
  if not public.puede('sistema:escenarios', 'editar') then
    raise exception 'Sin permiso' using errcode = 'insufficient_privilege';
  end if;
  select * into e from org.escenario where id = p_esc for update;
  if e.estado <> 'borrador' then raise exception 'Solo se envía un escenario en borrador'; end if;
  if p_vigente_desde < current_date then raise exception 'La vigencia retroactiva no se permite'; end if;
  update org.escenario set estado = 'en_aprobacion', vigente_desde = p_vigente_desde where id = p_esc;
  return flujo.iniciar('escenario_estructura', p_esc, format('Escenario · %s', e.nombre),
                       (select ref from org.unidad where escenario_id is null and padre_ref is null and vigencia @> current_date limit 1), '{}');
end;
$$;

-- Aplica a la realidad lo que el escenario cambia, con su fecha. Lo de antes
-- queda cerrado, no borrado.
create or replace function org.publicar_escenario(p_esc uuid)
returns void
language plpgsql security definer set search_path = org, public as $$
declare
  e org.escenario;
  d date;
  c record;
begin
  select * into e from org.escenario where id = p_esc;
  d := coalesce(e.vigente_desde, current_date);
  for c in select * from org.comparar_escenario(p_esc) loop
    if c.objeto = 'unidad' then
      update org.unidad set vigencia = daterange(lower(vigencia), d)
       where ref = c.ref and escenario_id is null and vigencia @> d and lower(vigencia) < d;
      if c.cambio <> 'baja' then
        insert into org.unidad (ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, vigencia, fuente, certeza, nota)
        select ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, daterange(d, null),
               format('Escenario «%s»', e.nombre), 'hecho', nota
          from org.unidad where ref = c.ref and escenario_id = p_esc;
      end if;
    else
      update org.plaza set vigencia = daterange(lower(vigencia), d)
       where ref = c.ref and escenario_id is null and vigencia @> d and lower(vigencia) < d;
      if c.cambio <> 'baja' then
        insert into org.plaza (ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, vigencia, fuente, certeza, nota)
        select ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, daterange(d, null),
               format('Escenario «%s»', e.nombre), 'hecho', nota
          from org.plaza where ref = c.ref and escenario_id = p_esc;
      end if;
    end if;
  end loop;
  update org.escenario set estado = 'publicado', publicado_en = now() where id = p_esc;
end;
$$;

grant execute on all functions in schema org, sgc, flujo to authenticated;
revoke execute on function org.costo_mensual_servicio(uuid) from authenticated;
revoke execute on function org.aplicar_requisicion(uuid) from authenticated;
revoke execute on function org.publicar_escenario(uuid) from authenticated;
revoke execute on function sgc.publicar_proceso(uuid) from authenticated;
revoke execute on function flujo.al_decidir(text, uuid, text, boolean, text, text) from authenticated;
revoke execute on function flujo.iniciar(text, uuid, text, uuid, jsonb) from authenticated;
