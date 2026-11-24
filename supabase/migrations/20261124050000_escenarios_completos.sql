-- El escenario de estructura admite todas las ediciones y no pisa la realidad (24-nov-2026, Gabriel: «cuando se crea el
-- escenario debe también tener cambios en los puestos o dependencias o todas las ediciones»).
--
--   · La comparación cuenta todo lo que se edita: en la plaza, reporta a, estado, nómina y sede; en la unidad, sede y
--     código. Antes no veía la nómina, la sede ni el código, y al publicar se perdían en silencio.
--   · Enviar y publicar se niegan si una plaza que el escenario cierra tiene gente vigente en esa fecha: hay que moverla
--     antes (por «Mis cambios») o ajustar el escenario. Antes la gente quedaba en una plaza cerrada.
--   · Enviar y publicar se niegan si algo que el escenario cambia se editó en la realidad después de su fecha base:
--     publicar habría pisado ese cambio sin avisar. El escenario se rehace o se ajusta.

create or replace function org.comparar_escenario(p_escenario uuid)
returns table (objeto text, ref uuid, cambio text, antes jsonb, despues jsonb)
language sql stable security invoker set search_path = org, public, extensions as $$
  with e as (select fecha_base from org.escenario where id = p_escenario),
  ur as (select * from org.unidad, e where escenario_id is null and vigencia @> e.fecha_base),
  ue as (select * from org.unidad where escenario_id = p_escenario),
  pr as (select * from org.plaza, e where escenario_id is null and vigencia @> e.fecha_base),
  pe as (select * from org.plaza where escenario_id = p_escenario)
  select 'unidad', coalesce(ue.ref, ur.ref),
         case when ur.ref is null then 'alta' when ue.ref is null then 'baja'
              when ue.nombre <> ur.nombre then 'renombre'
              when ue.padre_ref is distinct from ur.padre_ref then 'movimiento' else 'cambio' end,
         case when ur.ref is not null then jsonb_build_object('nombre', ur.nombre, 'tipo', ur.tipo, 'padre_ref', ur.padre_ref, 'sede', ur.sede, 'codigo', ur.codigo_organigrama) end,
         case when ue.ref is not null then jsonb_build_object('nombre', ue.nombre, 'tipo', ue.tipo, 'padre_ref', ue.padre_ref, 'sede', ue.sede, 'codigo', ue.codigo_organigrama) end
    from ue full join ur on ur.ref = ue.ref
   where ur.ref is null or ue.ref is null
      or (ue.nombre, ue.tipo, ue.padre_ref, ue.sede, ue.codigo_organigrama) is distinct from (ur.nombre, ur.tipo, ur.padre_ref, ur.sede, ur.codigo_organigrama)
  union all
  select 'plaza', coalesce(pe.ref, pr.ref),
         case when pr.ref is null then 'alta' when pe.ref is null then 'baja'
              when pe.dotacion <> pr.dotacion then 'dotacion'
              when pe.unidad_ref is distinct from pr.unidad_ref then 'movimiento' else 'cambio' end,
         case when pr.ref is not null then jsonb_build_object('cargo_id', pr.cargo_id, 'unidad_ref', pr.unidad_ref, 'dotacion', pr.dotacion, 'reporta_a_ref', pr.reporta_a_ref,
                                                             'estado', pr.estado, 'tipo_nomina', pr.tipo_nomina, 'sede', pr.sede) end,
         case when pe.ref is not null then jsonb_build_object('cargo_id', pe.cargo_id, 'unidad_ref', pe.unidad_ref, 'dotacion', pe.dotacion, 'reporta_a_ref', pe.reporta_a_ref,
                                                             'estado', pe.estado, 'tipo_nomina', pe.tipo_nomina, 'sede', pe.sede) end
    from pe full join pr on pr.ref = pe.ref
   where pr.ref is null or pe.ref is null
      or (pe.cargo_id, pe.unidad_ref, pe.dotacion, pe.reporta_a_ref, pe.estado, pe.tipo_nomina, pe.sede)
         is distinct from (pr.cargo_id, pr.unidad_ref, pr.dotacion, pr.reporta_a_ref, pr.estado, pr.tipo_nomina, pr.sede);
$$;

-- Lo que impide enviar o publicar un escenario a una fecha: devuelve los motivos, o nada.
create or replace function org.choques_escenario(p_esc uuid, p_fecha date)
returns setof text
language sql stable security definer set search_path = org, public as $$
  with e as (select * from org.escenario where id = p_esc),
  c as (select * from org.comparar_escenario(p_esc))
  -- Gente vigente en una plaza que el escenario cierra.
  select format('La plaza «%s» cierra en el escenario y tiene a %s: muévelas antes por «Mis cambios» o deja la plaza.',
                coalesce(cg.nombre, 'una plaza'), string_agg(em.nombre_completo, ', '))
    from c
    join org.ocupacion o on o.plaza_ref = c.ref and o.vigencia @> p_fecha and not isempty(o.vigencia)
    join public.empleados em on em.id = o.empleado_id
    left join org.plaza pr on pr.ref = c.ref and pr.escenario_id is null and pr.vigencia @> (select fecha_base from e)
    left join org.cargo cg on cg.id = pr.cargo_id
   where c.objeto = 'plaza' and c.cambio = 'baja'
   group by cg.nombre
  union all
  -- Algo que el escenario cambia se editó en la realidad después de su fecha base.
  select format('%s se cambió en la realidad el %s, después de la fecha base del escenario (%s): publicarlo pisaría ese cambio. Rehaz el escenario o ajústalo.',
                coalesce(x.nombre, 'La plaza de ' || cg2.nombre, 'Un objeto'), to_char(lower(x.vigencia), 'DD-MM-YYYY'), to_char((select fecha_base from e), 'DD-MM-YYYY'))
    from c
    join lateral (
      select vigencia, null::uuid as cargo_id, nombre from org.unidad where c.objeto = 'unidad' and ref = c.ref and escenario_id is null
         and lower(vigencia) > (select fecha_base from e)
      union all
      select vigencia, cargo_id, null from org.plaza where c.objeto = 'plaza' and ref = c.ref and escenario_id is null
         and lower(vigencia) > (select fecha_base from e)
      order by 1 desc limit 1
    ) x on true
    left join org.cargo cg2 on cg2.id = x.cargo_id;
$$;
revoke all on function org.choques_escenario(uuid, date) from public, anon;
grant execute on function org.choques_escenario(uuid, date) to authenticated;

CREATE OR REPLACE FUNCTION org.enviar_escenario(p_esc uuid, p_vigente_desde date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'flujo', 'public'
AS $function$
declare
  e org.escenario;
  v_choques text;
begin
  perform set_config('flujo.aplicando', 'on', true);
  if not public.puede('sistema:escenarios', 'editar') then
    raise exception 'Sin permiso' using errcode = 'insufficient_privilege';
  end if;
  select * into e from org.escenario where id = p_esc for update;
  if e.estado <> 'borrador' then raise exception 'Solo se envía un escenario en borrador'; end if;
  if p_vigente_desde < current_date then raise exception 'La vigencia retroactiva no se permite'; end if;
  if not exists (select 1 from org.comparar_escenario(p_esc)) then raise exception 'El escenario no tiene cambios contra la realidad.' using errcode = 'check_violation'; end if;
  select string_agg(m, E'\n') into v_choques from org.choques_escenario(p_esc, p_vigente_desde) m;
  if v_choques is not null then raise exception '%', v_choques using errcode = 'check_violation'; end if;
  update org.escenario set estado = 'en_aprobacion', vigente_desde = p_vigente_desde where id = p_esc;
  return flujo.iniciar('escenario_estructura', p_esc, format('Escenario · %s', e.nombre),
                       (select ref from org.unidad where escenario_id is null and padre_ref is null and vigencia @> current_date limit 1), '{}');
end;
$function$;

-- publicar_escenario: lo mismo de antes, con la misma comprobación al momento de aplicar (la realidad pudo cambiar
-- mientras se firmaba).
CREATE OR REPLACE FUNCTION org.publicar_escenario(p_esc uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'public'
AS $function$
declare
  e org.escenario;
  d date;
  c record;
  v_hasta date;
  v_choques text;
begin
  perform set_config('flujo.aplicando', 'on', true);
  select * into e from org.escenario where id = p_esc;
  d := coalesce(e.vigente_desde, org.hoy());
  select string_agg(m, E'\n') into v_choques from org.choques_escenario(p_esc, d) m;
  if v_choques is not null then
    raise exception 'No se pudo publicar: %. Devuélvelo a su autor.', v_choques using errcode = 'check_violation';
  end if;
  for c in select * from org.comparar_escenario(p_esc) loop
    if c.objeto = 'unidad' then
      update org.unidad set vigencia = org.cerrada_en(vigencia, d)
       where ref = c.ref and escenario_id is null and vigencia @> d;
      if c.cambio = 'baja' then
        update org.unidad set vigencia = 'empty'::daterange
         where ref = c.ref and escenario_id is null and lower(vigencia) > d;
      else
        select min(lower(vigencia)) into v_hasta from org.unidad
         where ref = c.ref and escenario_id is null and not isempty(vigencia) and lower(vigencia) > d;
        insert into org.unidad (ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, vigencia, fuente, certeza, nota)
        select ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, daterange(d, v_hasta),
               format('Escenario «%s»', e.nombre), 'hecho', nota
          from org.unidad where ref = c.ref and escenario_id = p_esc;
      end if;
    else
      update org.plaza set vigencia = org.cerrada_en(vigencia, d)
       where ref = c.ref and escenario_id is null and vigencia @> d;
      if c.cambio = 'baja' then
        update org.plaza set vigencia = 'empty'::daterange
         where ref = c.ref and escenario_id is null and lower(vigencia) > d;
      else
        select min(lower(vigencia)) into v_hasta from org.plaza
         where ref = c.ref and escenario_id is null and not isempty(vigencia) and lower(vigencia) > d;
        insert into org.plaza (ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, vigencia, fuente, certeza, nota)
        select ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, daterange(d, v_hasta),
               format('Escenario «%s»', e.nombre), 'hecho', nota
          from org.plaza where ref = c.ref and escenario_id = p_esc;
      end if;
    end if;
  end loop;
  update org.escenario set estado = 'publicado', publicado_en = now() where id = p_esc;
end;
$function$;
