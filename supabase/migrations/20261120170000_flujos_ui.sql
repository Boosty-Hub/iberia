-- =============================================================================
-- PLATAFORMA IBERIA · ETAPA 1 · lo que necesitan las pantallas de flujos:
-- la bandeja, la requisición hasta el ingreso, el editor de escenarios y las
-- rutas de aprobación.
--
-- No toca `flujo.al_decidir` (lo amplía otra migración para los escenarios de
-- procesos). Todo lo que decide sigue en la base: la pantalla solo pregunta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) ESCENARIOS DE ESTRUCTURA: quien diseña edita las filas del escenario, nunca
--    la realidad, y solo mientras el escenario es un borrador.
-- -----------------------------------------------------------------------------
create or replace function org.escenario_en_borrador(p_esc uuid)
returns boolean language sql stable security definer set search_path = org, public as $$
  select exists (select 1 from org.escenario where id = p_esc and estado = 'borrador' and alcance = 'estructura');
$$;

do $$
declare
  t text;
begin
  foreach t in array array['unidad', 'plaza'] loop
    -- Quien ve escenarios ve la estructura: sin la realidad no hay contra qué comparar.
    execute format('create policy "ver con escenarios" on org.%I for select to authenticated using (public.puede(''sistema:escenarios'', ''ver''))', t);
    execute format($p$create policy "diseñar escenario: crear" on org.%I for insert to authenticated
      with check (escenario_id is not null and org.escenario_en_borrador(escenario_id)
                  and (public.puede('sistema:escenarios', 'crear') or public.puede('sistema:escenarios', 'editar')))$p$, t);
    execute format($p$create policy "diseñar escenario: editar" on org.%I for update to authenticated
      using (escenario_id is not null and org.escenario_en_borrador(escenario_id) and public.puede('sistema:escenarios', 'editar'))
      with check (escenario_id is not null and org.escenario_en_borrador(escenario_id) and public.puede('sistema:escenarios', 'editar'))$p$, t);
    execute format($p$create policy "diseñar escenario: quitar" on org.%I for delete to authenticated
      using (escenario_id is not null and org.escenario_en_borrador(escenario_id) and public.puede('sistema:escenarios', 'editar'))$p$, t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) RUTAS: un paso se quita con «editar» (el recurso no tiene «eliminar»). Las
--    solicitudes en curso no cambian: sus pasos se copiaron al iniciarse.
-- -----------------------------------------------------------------------------
create policy "quitar pasos con editar" on flujo.ruta_paso for delete to authenticated
  using (public.puede('sistema:aprobaciones', 'editar'));

-- -----------------------------------------------------------------------------
-- 3) NOMBRES Y PLAZAS para la línea de tiempo y la bandeja. `profiles` solo lo
--    lee su dueño o un administrador; quien sigue una solicitud necesita saber
--    quién la firmó, y nada más que el nombre.
-- -----------------------------------------------------------------------------
create or replace function flujo.nombres(p_ids uuid[])
returns table (id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(trim(p.nombre_completo), ''), p.email)
    from public.profiles p
   where auth.uid() is not null and p.id = any (p_ids);
$$;

-- Qué cargo y qué unidad es una plaza (vigente hoy, o su última versión).
create or replace function org.describir_plazas(p_refs uuid[])
returns table (ref uuid, cargo text, unidad text)
language sql stable security definer set search_path = org, public as $$
  select distinct on (p.ref) p.ref, c.nombre, u.nombre
    from org.plaza p
    join org.cargo c on c.id = p.cargo_id
    left join lateral (select x.nombre from org.unidad x where x.ref = p.unidad_ref and x.escenario_id is null
                        order by upper_inf(x.vigencia) desc, lower(x.vigencia) desc limit 1) u on true
   where auth.uid() is not null and p.ref = any (p_refs) and p.escenario_id is null
   order by p.ref, (p.vigencia @> current_date) desc, lower(p.vigencia) desc;
$$;

-- Quién ocupa hoy las plazas de una unidad: para «a quién reemplaza».
create or replace function org.ocupantes_de_unidad(p_unidad uuid)
returns table (plaza_ref uuid, cargo_id uuid, cargo text, empleado_id uuid, nombre text, tipo text)
language plpgsql stable security definer set search_path = org, public as $$
begin
  if not (public.puede('sistema:requisiciones', 'crear') or public.puede('sistema:estructura', 'ver')) then
    raise exception 'Sin permiso' using errcode = 'insufficient_privilege';
  end if;
  return query
  select p.ref, p.cargo_id, c.nombre, e.id, e.nombre_completo, o.tipo
    from org.plaza p
    join org.cargo c on c.id = p.cargo_id
    join org.ocupacion o on o.plaza_ref = p.ref and o.vigencia @> current_date
    join public.empleados e on e.id = o.empleado_id
   where p.unidad_ref = p_unidad and p.escenario_id is null and p.vigencia @> current_date
   order by c.nombre, e.nombre_completo;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) LA BANDEJA: lo que quien llama puede decidir ahora, de cualquier tipo.
-- -----------------------------------------------------------------------------
create or replace function flujo.bandeja()
returns table (
  paso_id uuid, solicitud_id uuid, tipo_objeto text, objeto_id uuid, titulo text,
  paso text, orden integer, accion text, hito boolean, ve_costos boolean, regla jsonb,
  aprobador_plaza_ref uuid, aprobador_perfil uuid, pedido_por uuid, pedido_por_nombre text,
  pedido_en timestamptz, esperando_desde timestamptz
)
language sql stable security definer set search_path = flujo, public as $$
  select p.id, s.id, s.tipo_objeto, s.objeto_id, s.titulo,
         p.nombre, p.orden, p.accion, p.hito, p.ve_costos, p.regla,
         p.aprobador_plaza_ref, p.aprobador_perfil, s.creado_por,
         coalesce(nullif(trim(pr.nombre_completo), ''), pr.email), s.creado_en,
         coalesce((select max(q.decidido_en) from flujo.paso q where q.solicitud_id = s.id), s.creado_en)
    from flujo.paso p
    join flujo.solicitud s on s.id = p.solicitud_id
    left join public.profiles pr on pr.id = s.creado_por
   where s.estado = 'en_curso' and p.orden = s.paso_actual and p.decision = 'pendiente'
     and flujo.puede_decidir(p.id)
   order by 17;
$$;

-- -----------------------------------------------------------------------------
-- 5) REQUISICIÓN: cancelar, candidato y fecha, y el ingreso
-- -----------------------------------------------------------------------------

-- Cancela una requisición que no se ha aprobado. Si está en la ruta, la
-- solicitud se cierra y los pasos que faltaban quedan omitidos con el motivo.
create or replace function org.cancelar_requisicion(p_req uuid, p_motivo text default null)
returns void
language plpgsql security definer set search_path = org, flujo, public as $$
declare
  q org.requisicion;
begin
  select * into q from org.requisicion where id = p_req for update;
  if not found then raise exception 'La requisición no existe'; end if;
  if q.creado_por is distinct from auth.uid() and not public.puede('sistema:requisiciones', 'editar') then
    raise exception 'Solo quien la pidió o Recursos Humanos la cancela' using errcode = 'insufficient_privilege';
  end if;
  if q.estado not in ('borrador', 'devuelta', 'en_aprobacion') then
    raise exception 'Solo se cancela una requisición que no se ha aprobado' using errcode = 'check_violation';
  end if;
  update org.requisicion set estado = 'cancelada' where id = p_req;
  if q.solicitud_id is not null then
    update flujo.paso set decision = 'omitido', decidido_por = auth.uid(), decidido_en = now(),
           comentario = 'Requisición cancelada' || coalesce(': ' || nullif(trim(p_motivo), ''), '')
     where solicitud_id = q.solicitud_id and decision = 'pendiente';
    update flujo.solicitud set estado = 'cancelada', paso_actual = null, cerrado_en = now()
     where id = q.solicitud_id and estado = 'en_curso';
  end if;
end;
$$;

-- Desarrollo Organizacional anota el candidato y la fecha de ingreso. Lo hace
-- quien puede decidir el paso «completar» que está en curso, o Recursos Humanos.
create or replace function org.registrar_candidato(p_req uuid, p_candidato text, p_fecha date)
returns void
language plpgsql security definer set search_path = org, flujo, public as $$
declare
  q org.requisicion;
begin
  select * into q from org.requisicion where id = p_req for update;
  if not found then raise exception 'La requisición no existe'; end if;
  if not (public.puede('sistema:requisiciones', 'editar')
          or exists (select 1 from flujo.paso p where p.solicitud_id = q.solicitud_id and p.accion = 'completar'
                       and flujo.puede_decidir(p.id))) then
    raise exception 'Este paso no te toca' using errcode = 'insufficient_privilege';
  end if;
  if q.estado not in ('aprobada', 'en_seleccion') then
    raise exception 'El candidato se registra con la requisición aprobada' using errcode = 'check_violation';
  end if;
  if coalesce(length(trim(p_candidato)), 0) < 3 then
    raise exception 'Escribe el nombre del candidato' using errcode = 'check_violation';
  end if;
  update org.requisicion set candidato = trim(p_candidato), fecha_ingreso = p_fecha where id = p_req;
end;
$$;

-- El ingreso: crea la ocupación en la plaza de la requisición y, cuando entran
-- tantas personas como se pidieron, la marca cubierta. Si es un reemplazo,
-- cierra antes la ocupación de quien se fue.
create or replace function org.cubrir_requisicion(p_req uuid, p_empleado uuid, p_fecha date)
returns text
language plpgsql security definer set search_path = org, public as $$
declare
  q org.requisicion;
  v_motivo text;
  v_n integer;
begin
  if not public.puede('sistema:requisiciones', 'editar') then
    raise exception 'Registrar el ingreso es de Recursos Humanos' using errcode = 'insufficient_privilege';
  end if;
  select * into q from org.requisicion where id = p_req for update;
  if not found then raise exception 'La requisición no existe'; end if;
  if q.estado not in ('aprobada', 'en_seleccion') then
    raise exception 'Solo se registra el ingreso de una requisición aprobada' using errcode = 'check_violation';
  end if;
  if q.plaza_ref is null then
    raise exception 'La requisición no tiene plaza: falta aprobarla o elegir la vacante' using errcode = 'check_violation';
  end if;
  if p_fecha is null then raise exception 'Falta la fecha de ingreso' using errcode = 'check_violation'; end if;
  if not exists (select 1 from public.empleados where id = p_empleado and activo) then
    raise exception 'Esa persona no está en el padrón activo' using errcode = 'foreign_key_violation';
  end if;

  v_motivo := format('Requisición %s', q.numero);
  if q.reemplaza_empleado_id is not null then
    update org.ocupacion set vigencia = daterange(lower(vigencia), p_fecha)
     where empleado_id = q.reemplaza_empleado_id and plaza_ref = q.plaza_ref
       and upper_inf(vigencia) and lower(vigencia) < p_fecha;
  end if;

  insert into org.ocupacion (plaza_ref, empleado_id, tipo, vigencia, motivo, certeza)
  values (q.plaza_ref, p_empleado, case when q.origen = 'pasante' then 'pasante' else 'titular' end,
          daterange(p_fecha, null), v_motivo, 'manual');

  select count(*) into v_n from org.ocupacion where plaza_ref = q.plaza_ref and motivo = v_motivo;
  update org.requisicion
     set fecha_ingreso = coalesce(fecha_ingreso, p_fecha),
         estado = case when v_n >= q.cantidad then 'cubierta' else estado end
   where id = p_req returning estado into q.estado;
  return q.estado;
end;
$$;

-- Las funciones nuevas de `org` y `flujo` ya las puede ejecutar `authenticated`
-- por los privilegios por defecto (20261120130000); cada una comprueba su permiso.
-- No se repite el `grant … on all functions`: devolvería la ejecución a las que
-- otras migraciones revocaron a propósito.
