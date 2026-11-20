-- =============================================================================
-- PLATAFORMA IBERIA · ETAPA 1 · Organización y dotación: la edición con fecha
-- efectiva que usan las pantallas de `/sistema/nucleo/organizacion`.
--
-- Regla de la casa: **nada se corrige en el sitio y nada se borra**. Un cambio
-- de estructura cierra la versión vigente (límite superior de la vigencia =
-- la fecha del cambio) e inserta la versión nueva desde esa fecha. Si la
-- versión vigente nació ese mismo día, queda con vigencia vacía: reemplazada,
-- pero a la vista en el historial y en la auditoría.
--
-- Las funciones son `security invoker`: corren con la RLS de quien llama, y
-- además piden el permiso de la matriz por su nombre, para que el mensaje diga
-- qué falta. **La fecha nunca va hacia atrás**: hoy (en Caracas) o después.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0) AYUDAS
-- -----------------------------------------------------------------------------

-- «Hoy» es el de Caracas, no el de UTC: de 8 p. m. a medianoche la base ya vive
-- en mañana y rechazaría como retroactivo un cambio de hoy.
create or replace function org.hoy()
returns date language sql stable set search_path = pg_catalog as $$
  select (now() at time zone 'America/Caracas')::date;
$$;

create or replace function org.exigir_permiso(p_recurso text, p_accion text, p_mensaje text)
returns void language plpgsql stable set search_path = public as $$
begin
  if not public.puede(p_recurso, p_accion) then
    raise exception '%', p_mensaje using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create or replace function org.exigir_fecha(p_fecha date)
returns void language plpgsql stable set search_path = org, public as $$
begin
  if p_fecha is null then
    raise exception 'Indica desde qué fecha rige el cambio.' using errcode = 'check_violation';
  end if;
  if p_fecha < org.hoy() then
    raise exception 'El % ya pasó: un cambio rige desde hoy o desde una fecha futura, nunca hacia atrás.',
      to_char(p_fecha, 'DD-MM-YYYY') using errcode = 'check_violation';
  end if;
end;
$$;

-- El cierre de una versión en `p_fecha`: si nació ese día, vigencia vacía.
create or replace function org.cerrada_en(p_vigencia daterange, p_fecha date)
returns daterange language sql immutable as $$
  select case when lower(p_vigencia) >= p_fecha then 'empty'::daterange
              else daterange(lower(p_vigencia), p_fecha) end;
$$;

-- -----------------------------------------------------------------------------
-- 1) UNIDADES
-- -----------------------------------------------------------------------------

create or replace function org.crear_unidad(
  p_clave text, p_nombre text, p_tipo text, p_padre_ref uuid, p_sede text, p_fecha date,
  p_codigo text default null, p_nota text default null)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v_ref uuid := gen_random_uuid();
  v_clave text := p_clave;
  n int := 2;
begin
  perform org.exigir_permiso('sistema:estructura', 'crear', 'Tu rol no puede crear unidades.');
  perform org.exigir_fecha(p_fecha);
  if length(trim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'El nombre de la unidad necesita al menos tres letras.' using errcode = 'check_violation';
  end if;
  if p_padre_ref is not null and not exists (
      select 1 from org.unidad where ref = p_padre_ref and escenario_id is null and vigencia @> p_fecha) then
    raise exception 'La unidad superior no está vigente en esa fecha.' using errcode = 'check_violation';
  end if;
  while exists (select 1 from org.unidad where clave = v_clave and escenario_id is null) loop
    v_clave := p_clave || '-' || n;
    n := n + 1;
  end loop;
  insert into org.unidad (ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, orden, vigencia, fuente, certeza, nota)
  values (v_ref, v_clave, trim(p_nombre), p_tipo, p_padre_ref, nullif(trim(p_codigo), ''), nullif(p_sede, ''),
          coalesce((select max(orden) + 1 from org.unidad where padre_ref is not distinct from p_padre_ref and escenario_id is null), 0),
          daterange(p_fecha, null), 'Alta en la plataforma', 'hecho', nullif(trim(p_nota), ''));
  return v_ref;
end;
$$;

-- Renombrar, cambiar de tipo, mover (otro padre), cambiar sede o código, y
-- confirmar lo que la carga dejó como inferencia.
create or replace function org.editar_unidad(
  p_ref uuid, p_fecha date, p_nombre text, p_tipo text, p_padre_ref uuid, p_sede text,
  p_codigo text default null, p_certeza text default null, p_nota text default null)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v org.unidad;
  v_id uuid;
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_certeza text;
begin
  perform org.exigir_permiso('sistema:estructura', 'editar', 'Tu rol no puede editar la estructura.');
  perform org.exigir_fecha(p_fecha);
  select * into v from org.unidad where ref = p_ref and escenario_id is null and vigencia @> p_fecha for update;
  if not found then
    raise exception 'La unidad no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
  if length(v_nombre) < 3 then
    raise exception 'El nombre de la unidad necesita al menos tres letras.' using errcode = 'check_violation';
  end if;
  if p_padre_ref is not null then
    if p_padre_ref = p_ref then
      raise exception 'Una unidad no puede depender de sí misma.' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from org.unidad where ref = p_padre_ref and escenario_id is null and vigencia @> p_fecha) then
      raise exception 'La unidad superior no está vigente en esa fecha.' using errcode = 'check_violation';
    end if;
    if exists (
      with recursive d as (
        select ref from org.unidad where padre_ref = p_ref and escenario_id is null and vigencia @> p_fecha
        union
        select u.ref from org.unidad u join d on u.padre_ref = d.ref where u.escenario_id is null and u.vigencia @> p_fecha
      ) select 1 from d where ref = p_padre_ref) then
      raise exception 'No puedes poner la unidad debajo de una que depende de ella.' using errcode = 'check_violation';
    end if;
  end if;
  v_certeza := coalesce(nullif(p_certeza, ''), v.certeza);
  if (v.nombre, v.tipo, v.padre_ref, v.sede, v.codigo_organigrama, v.certeza, v.nota)
     is not distinct from (v_nombre, p_tipo, p_padre_ref, nullif(p_sede, ''), nullif(trim(p_codigo), ''), v_certeza, coalesce(nullif(trim(p_nota), ''), v.nota)) then
    raise exception 'No hay cambios que guardar.' using errcode = 'check_violation';
  end if;

  update org.unidad set vigencia = org.cerrada_en(vigencia, p_fecha) where id = v.id;
  insert into org.unidad (ref, clave, nombre, tipo, padre_ref, codigo_organigrama, sede, area_id, orden, vigencia, fuente, certeza, nota)
  values (v.ref, v.clave, v_nombre, p_tipo, p_padre_ref, nullif(trim(p_codigo), ''), nullif(p_sede, ''), v.area_id, v.orden,
          daterange(p_fecha, upper(v.vigencia)), 'Edición en la plataforma', v_certeza, coalesce(nullif(trim(p_nota), ''), v.nota))
  returning id into v_id;
  return v_id;
end;
$$;

-- Cerrar una unidad: solo vacía. Lo que cuelga de ella se mueve o se cierra antes.
create or replace function org.cerrar_unidad(p_ref uuid, p_fecha date, p_motivo text)
returns void
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v org.unidad;
  n int;
begin
  perform org.exigir_permiso('sistema:estructura', 'editar', 'Tu rol no puede editar la estructura.');
  perform org.exigir_fecha(p_fecha);
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe el motivo del cierre.' using errcode = 'check_violation';
  end if;
  select * into v from org.unidad where ref = p_ref and escenario_id is null and vigencia @> p_fecha for update;
  if not found then
    raise exception 'La unidad no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
  select count(distinct ref) into n from org.unidad
   where padre_ref = p_ref and escenario_id is null and vigencia && daterange(p_fecha, null);
  if n > 0 then
    raise exception 'De esta unidad dependen % unidad(es) en esa fecha: muévelas o ciérralas primero.', n using errcode = 'check_violation';
  end if;
  select count(distinct ref) into n from org.plaza
   where unidad_ref = p_ref and escenario_id is null and vigencia && daterange(p_fecha, null);
  if n > 0 then
    raise exception 'La unidad tiene % plaza(s) en esa fecha: ciérralas o muévelas primero.', n using errcode = 'check_violation';
  end if;
  update org.unidad set vigencia = org.cerrada_en(vigencia, p_fecha),
         nota = concat_ws(' · ', nota, format('Cerrada el %s: %s', to_char(p_fecha, 'DD-MM-YYYY'), trim(p_motivo)))
   where id = v.id;
  -- Una versión programada para después del cierre queda sin efecto.
  update org.unidad set vigencia = 'empty'::daterange
   where ref = p_ref and escenario_id is null and lower(vigencia) > p_fecha;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) PLAZAS
-- -----------------------------------------------------------------------------

create or replace function org.crear_plaza(
  p_unidad_ref uuid, p_cargo_id uuid, p_dotacion integer, p_reporta_a_ref uuid, p_tipo_nomina text,
  p_sede text, p_estado text, p_fecha date, p_nota text default null)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v_ref uuid := gen_random_uuid();
begin
  perform org.exigir_permiso('sistema:estructura', 'crear', 'Tu rol no puede crear plazas.');
  perform org.exigir_fecha(p_fecha);
  if coalesce(p_dotacion, 0) < 1 then
    raise exception 'La dotación aprobada es de al menos 1.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from org.unidad where ref = p_unidad_ref and escenario_id is null and vigencia @> p_fecha) then
    raise exception 'La unidad no está vigente en esa fecha.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from org.cargo where id = p_cargo_id and activo) then
    raise exception 'Ese cargo no existe o está inactivo.' using errcode = 'check_violation';
  end if;
  if p_reporta_a_ref is not null and not exists (
      select 1 from org.plaza where ref = p_reporta_a_ref and escenario_id is null and vigencia @> p_fecha) then
    raise exception 'La plaza a la que reporta no está vigente en esa fecha.' using errcode = 'check_violation';
  end if;
  if coalesce(p_estado, 'aprobada') = 'cerrada' then
    raise exception 'Una plaza nueva no nace cerrada.' using errcode = 'check_violation';
  end if;
  insert into org.plaza (ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, vigencia, fuente, certeza, nota)
  values (v_ref, p_unidad_ref, p_cargo_id, p_reporta_a_ref, p_dotacion, nullif(p_tipo_nomina, ''), nullif(p_sede, ''),
          coalesce(nullif(p_estado, ''), 'aprobada'), daterange(p_fecha, null), 'Alta en la plataforma', 'hecho', nullif(trim(p_nota), ''));
  return v_ref;
end;
$$;

-- Cambiar dotación, a quién reporta, estado, tipo de nómina, sede o unidad.
-- Bajar la dotación por debajo de la gente que hay se permite: el excedente se
-- ve como «por encima de la dotación», que es lo que pasa de verdad.
create or replace function org.editar_plaza(
  p_ref uuid, p_fecha date, p_dotacion integer, p_reporta_a_ref uuid, p_estado text, p_tipo_nomina text,
  p_sede text, p_unidad_ref uuid default null, p_certeza text default null, p_nota text default null)
returns jsonb
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v org.plaza;
  v_id uuid;
  v_unidad uuid;
  v_certeza text;
  v_gente int;
begin
  perform org.exigir_permiso('sistema:estructura', 'editar', 'Tu rol no puede editar la estructura.');
  perform org.exigir_fecha(p_fecha);
  select * into v from org.plaza where ref = p_ref and escenario_id is null and vigencia @> p_fecha for update;
  if not found then
    raise exception 'La plaza no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
  if coalesce(p_dotacion, 0) < 1 then
    raise exception 'La dotación aprobada es de al menos 1. Para quitar la plaza, ciérrala.' using errcode = 'check_violation';
  end if;
  if coalesce(p_estado, '') = 'cerrada' then
    raise exception 'Para cerrar la plaza usa «Cerrar plaza»: así se comprueba que no quede gente adentro.' using errcode = 'check_violation';
  end if;
  v_unidad := coalesce(p_unidad_ref, v.unidad_ref);
  if v_unidad <> v.unidad_ref and not exists (
      select 1 from org.unidad where ref = v_unidad and escenario_id is null and vigencia @> p_fecha) then
    raise exception 'La unidad de destino no está vigente en esa fecha.' using errcode = 'check_violation';
  end if;
  if p_reporta_a_ref is not null then
    if p_reporta_a_ref = p_ref then
      raise exception 'Una plaza no puede reportarse a sí misma.' using errcode = 'check_violation';
    end if;
    if not exists (select 1 from org.plaza where ref = p_reporta_a_ref and escenario_id is null and vigencia @> p_fecha) then
      raise exception 'La plaza a la que reporta no está vigente en esa fecha.' using errcode = 'check_violation';
    end if;
    if exists (
      with recursive d as (
        select ref from org.plaza where reporta_a_ref = p_ref and escenario_id is null and vigencia @> p_fecha
        union
        select q.ref from org.plaza q join d on q.reporta_a_ref = d.ref where q.escenario_id is null and q.vigencia @> p_fecha
      ) select 1 from d where ref = p_reporta_a_ref) then
      raise exception 'Esa plaza le reporta (directa o indirectamente) a esta: el reporte quedaría en círculo.' using errcode = 'check_violation';
    end if;
  end if;
  v_certeza := coalesce(nullif(p_certeza, ''), v.certeza);
  if (v.dotacion, v.reporta_a_ref, v.estado, v.tipo_nomina, v.sede, v.unidad_ref, v.certeza, v.nota)
     is not distinct from (p_dotacion, p_reporta_a_ref, coalesce(nullif(p_estado, ''), v.estado), nullif(p_tipo_nomina, ''),
                           nullif(p_sede, ''), v_unidad, v_certeza, coalesce(nullif(trim(p_nota), ''), v.nota)) then
    raise exception 'No hay cambios que guardar.' using errcode = 'check_violation';
  end if;

  update org.plaza set vigencia = org.cerrada_en(vigencia, p_fecha) where id = v.id;
  insert into org.plaza (ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, vigencia, fuente, certeza, nota)
  values (v.ref, v_unidad, v.cargo_id, p_reporta_a_ref, p_dotacion, nullif(p_tipo_nomina, ''), nullif(p_sede, ''),
          coalesce(nullif(p_estado, ''), v.estado), daterange(p_fecha, upper(v.vigencia)), 'Edición en la plataforma',
          v_certeza, coalesce(nullif(trim(p_nota), ''), v.nota))
  returning id into v_id;

  select count(*) into v_gente from org.ocupacion
   where plaza_ref = p_ref and tipo = 'titular' and vigencia @> p_fecha;
  return jsonb_build_object('id', v_id, 'titulares', v_gente, 'dotacion', p_dotacion,
                            'por_encima', greatest(v_gente - p_dotacion, 0));
end;
$$;

create or replace function org.cerrar_plaza(p_ref uuid, p_fecha date, p_motivo text)
returns void
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v org.plaza;
  n int;
begin
  perform org.exigir_permiso('sistema:estructura', 'editar', 'Tu rol no puede editar la estructura.');
  perform org.exigir_fecha(p_fecha);
  if length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe el motivo del cierre.' using errcode = 'check_violation';
  end if;
  select * into v from org.plaza where ref = p_ref and escenario_id is null and vigencia @> p_fecha for update;
  if not found then
    raise exception 'La plaza no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
  select count(*) into n from org.ocupacion
   where plaza_ref = p_ref and vigencia && daterange(p_fecha, null) and not isempty(vigencia);
  if n > 0 then
    raise exception 'La plaza tiene % persona(s) en esa fecha: termina o mueve sus ocupaciones primero.', n using errcode = 'check_violation';
  end if;
  select count(distinct ref) into n from org.plaza
   where reporta_a_ref = p_ref and escenario_id is null and vigencia && daterange(p_fecha, null);
  if n > 0 then
    raise exception '% plaza(s) le reportan a esta: cámbiales a quién reportan primero.', n using errcode = 'check_violation';
  end if;
  update org.plaza set vigencia = org.cerrada_en(vigencia, p_fecha),
         nota = concat_ws(' · ', nota, format('Cerrada el %s: %s', to_char(p_fecha, 'DD-MM-YYYY'), trim(p_motivo)))
   where id = v.id;
  update org.plaza set vigencia = 'empty'::daterange
   where ref = p_ref and escenario_id is null and lower(vigencia) > p_fecha;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3) OCUPACIONES: quién está en qué plaza, con fecha
-- -----------------------------------------------------------------------------

-- El trigger de cupo, con una salvedad: cerrar o acortar una ocupación no suma
-- gente a la plaza, así que no se vuelve a medir (antes, cerrar el mismo día que
-- empezó dejaba la vigencia vacía y el trigger decía «la plaza no existe»).
create or replace function org.ocupacion_cabe()
returns trigger language plpgsql set search_path = org, public, extensions as $$
declare
  v_dotacion integer;
  v_ocupadas integer;
begin
  if new.tipo <> 'titular' or new.excede_dotacion then return new; end if;
  if tg_op = 'UPDATE' and new.plaza_ref = old.plaza_ref and old.tipo = 'titular' and not old.excede_dotacion
     and (isempty(new.vigencia) or new.vigencia <@ old.vigencia) then
    return new;
  end if;
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

create or replace function org.asignar_ocupacion(
  p_plaza_ref uuid, p_empleado_id uuid, p_tipo text, p_fecha date, p_excede boolean default false, p_motivo text default null)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v_id uuid;
  v_otra record;
begin
  if not (public.puede('sistema:estructura', 'crear') or public.puede('sistema:estructura', 'editar')) then
    raise exception 'Tu rol no puede asignar personas a plazas.' using errcode = 'insufficient_privilege';
  end if;
  perform org.exigir_fecha(p_fecha);
  if not exists (select 1 from org.plaza where ref = p_plaza_ref and escenario_id is null and vigencia @> p_fecha and estado <> 'cerrada') then
    raise exception 'La plaza no está vigente en esa fecha.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.empleados where id = p_empleado_id and activo) then
    raise exception 'Esa persona no está activa en el padrón.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from org.ocupacion where plaza_ref = p_plaza_ref and empleado_id = p_empleado_id
              and vigencia && daterange(p_fecha, null) and not isempty(vigencia)) then
    raise exception 'Esa persona ya está en esta plaza en esa fecha.' using errcode = 'check_violation';
  end if;
  if coalesce(p_tipo, 'titular') = 'titular' then
    select c.nombre as cargo, u.nombre as unidad, lower(o.vigencia) as desde into v_otra
      from org.ocupacion o
      join org.plaza p on p.ref = o.plaza_ref and p.escenario_id is null and p.vigencia @> greatest(lower(o.vigencia), p_fecha)
      join org.cargo c on c.id = p.cargo_id
      join org.unidad u on u.ref = p.unidad_ref and u.escenario_id is null and u.vigencia @> greatest(lower(o.vigencia), p_fecha)
     where o.empleado_id = p_empleado_id and o.tipo = 'titular' and o.vigencia && daterange(p_fecha, null) and not isempty(o.vigencia)
     limit 1;
    if found then
      raise exception 'Esa persona ya es titular de «%» en %, desde el %. Para cambiarla de plaza usa «Mover».',
        v_otra.cargo, v_otra.unidad, to_char(v_otra.desde, 'DD-MM-YYYY') using errcode = 'check_violation';
    end if;
  end if;
  insert into org.ocupacion (plaza_ref, empleado_id, tipo, vigencia, motivo, certeza, excede_dotacion)
  values (p_plaza_ref, p_empleado_id, coalesce(nullif(p_tipo, ''), 'titular'), daterange(p_fecha, null),
          nullif(trim(p_motivo), ''), 'manual', coalesce(p_excede, false))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function org.terminar_ocupacion(p_id uuid, p_fecha date, p_motivo text default null)
returns void
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v org.ocupacion;
begin
  perform org.exigir_permiso('sistema:estructura', 'editar', 'Tu rol no puede editar ocupaciones.');
  perform org.exigir_fecha(p_fecha);
  select * into v from org.ocupacion where id = p_id for update;
  if not found or isempty(v.vigencia) or not (v.vigencia && daterange(p_fecha, null)) then
    raise exception 'Esa ocupación ya no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
  update org.ocupacion
     set vigencia = org.cerrada_en(vigencia, p_fecha),
         motivo = concat_ws(' · ', motivo, format('Termina el %s%s', to_char(p_fecha, 'DD-MM-YYYY'),
                                                   coalesce(': ' || nullif(trim(p_motivo), ''), '')))
   where id = p_id;
end;
$$;

-- Mover: termina la ocupación en su plaza y abre otra en la de destino, desde
-- la misma fecha, en una sola transacción (si el destino está lleno, no se
-- mueve nada).
create or replace function org.mover_ocupacion(
  p_id uuid, p_plaza_destino uuid, p_fecha date, p_tipo text default null, p_excede boolean default false, p_motivo text default null)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v org.ocupacion;
begin
  perform org.exigir_permiso('sistema:estructura', 'editar', 'Tu rol no puede mover personas entre plazas.');
  select * into v from org.ocupacion where id = p_id;
  if not found then
    raise exception 'Esa ocupación no existe.' using errcode = 'no_data_found';
  end if;
  if v.plaza_ref = p_plaza_destino then
    raise exception 'La plaza de destino es la misma.' using errcode = 'check_violation';
  end if;
  perform org.terminar_ocupacion(p_id, p_fecha, coalesce(nullif(trim(p_motivo), ''), 'movimiento a otra plaza'));
  return org.asignar_ocupacion(p_plaza_destino, v.empleado_id, coalesce(nullif(p_tipo, ''), v.tipo), p_fecha, p_excede,
                               coalesce(nullif(trim(p_motivo), ''), 'Movimiento interno'));
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) PLAN DE DOTACIÓN: versión en borrador → aprobada (congelada)
-- -----------------------------------------------------------------------------

-- Un plan aprobado o reemplazado no se toca: el cambio es una versión nueva.
create or replace function org.plan_congelado()
returns trigger language plpgsql set search_path = org, public as $$
declare
  v_estado text;
begin
  if tg_table_name = 'plan_dotacion_linea' then
    select estado into v_estado from org.plan_dotacion where id = coalesce(new.plan_id, old.plan_id);
    if v_estado is distinct from 'borrador' then
      raise exception 'Ese plan de dotación está %: para cambiarlo, crea una versión nueva.', v_estado using errcode = 'check_violation';
    end if;
  else
    if tg_op = 'DELETE' then
      if old.estado <> 'borrador' then
        raise exception 'Un plan aprobado no se borra.' using errcode = 'check_violation';
      end if;
      return old;
    end if;
    if old.estado = 'reemplazado'
       or (old.estado = 'aprobado' and (new.estado <> 'reemplazado' or (new.anio, new.version, new.nota) is distinct from (old.anio, old.version, old.nota))) then
      raise exception 'Ese plan de dotación está congelado: para cambiarlo, crea una versión nueva.' using errcode = 'check_violation';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists plan_congelado on org.plan_dotacion_linea;
create trigger plan_congelado before insert or update or delete on org.plan_dotacion_linea
  for each row execute function org.plan_congelado();
drop trigger if exists plan_congelado on org.plan_dotacion;
create trigger plan_congelado before update or delete on org.plan_dotacion
  for each row execute function org.plan_congelado();

-- Abre la versión siguiente del plan de un año, copiando la última; si es la
-- primera del año, parte de la dotación aprobada de hoy. Si ya hay un borrador,
-- lo devuelve.
create or replace function org.nuevo_plan_dotacion(p_anio integer, p_nota text default null)
returns uuid
language plpgsql security invoker set search_path = org, public as $$
declare
  v_id uuid;
  v_base uuid;
  v_version int;
begin
  perform org.exigir_permiso('sistema:dotacion', 'editar', 'Tu rol no puede editar el plan de dotación.');
  select id into v_id from org.plan_dotacion where anio = p_anio and estado = 'borrador' limit 1;
  if found then return v_id; end if;
  select id into v_base from org.plan_dotacion where anio = p_anio order by version desc limit 1;
  select coalesce(max(version), 0) + 1 into v_version from org.plan_dotacion where anio = p_anio;
  insert into org.plan_dotacion (anio, version, estado, nota)
  values (p_anio, v_version, 'borrador', nullif(trim(p_nota), '')) returning id into v_id;
  if v_base is not null then
    insert into org.plan_dotacion_linea (plan_id, unidad_ref, cargo_id, cantidad, nota)
    select v_id, unidad_ref, cargo_id, cantidad, nota from org.plan_dotacion_linea where plan_id = v_base;
  else
    insert into org.plan_dotacion_linea (plan_id, unidad_ref, cargo_id, cantidad, nota)
    select v_id, unidad_ref, cargo_id, sum(dotacion), null
      from org.plaza
     where escenario_id is null and vigencia @> org.hoy() and estado <> 'cerrada'
     group by unidad_ref, cargo_id;
  end if;
  return v_id;
end;
$$;

-- Guarda varias líneas de un borrador: [{unidad_ref, cargo_id, cantidad, nota}].
create or replace function org.guardar_lineas_plan(p_plan uuid, p_lineas jsonb)
returns integer
language plpgsql security invoker set search_path = org, public as $$
declare
  n int;
begin
  perform org.exigir_permiso('sistema:dotacion', 'editar', 'Tu rol no puede editar el plan de dotación.');
  if not exists (select 1 from org.plan_dotacion where id = p_plan and estado = 'borrador') then
    raise exception 'Solo se edita un plan en borrador.' using errcode = 'check_violation';
  end if;
  insert into org.plan_dotacion_linea (plan_id, unidad_ref, cargo_id, cantidad, nota)
  select p_plan, (l ->> 'unidad_ref')::uuid, (l ->> 'cargo_id')::uuid, (l ->> 'cantidad')::int, nullif(trim(l ->> 'nota'), '')
    from jsonb_array_elements(p_lineas) l
   where l ->> 'cantidad' is not null
  on conflict (plan_id, unidad_ref, cargo_id) do update
     set cantidad = excluded.cantidad, nota = coalesce(excluded.nota, org.plan_dotacion_linea.nota);
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function org.aprobar_plan_dotacion(p_plan uuid)
returns void
language plpgsql security invoker set search_path = org, public as $$
declare
  v org.plan_dotacion;
begin
  perform org.exigir_permiso('sistema:dotacion', 'editar', 'Tu rol no puede aprobar el plan de dotación.');
  select * into v from org.plan_dotacion where id = p_plan for update;
  if not found or v.estado <> 'borrador' then
    raise exception 'Solo se aprueba un plan en borrador.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from org.plan_dotacion_linea where plan_id = p_plan) then
    raise exception 'El plan no tiene líneas.' using errcode = 'check_violation';
  end if;
  update org.plan_dotacion set estado = 'reemplazado' where anio = v.anio and estado = 'aprobado';
  update org.plan_dotacion set estado = 'aprobado', aprobado_por = auth.uid(), aprobado_en = now() where id = p_plan;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) COSTOS · perímetro de nómina (`sistema:costos`)
-- -----------------------------------------------------------------------------

-- El costo de referencia de un cargo, con vigencia: cierra el que rige y abre
-- el nuevo desde la fecha.
create or replace function org.fijar_costo_referencia(
  p_cargo uuid, p_salario numeric, p_moneda text, p_bonos_usd numeric, p_fecha date, p_fuente text default null)
returns uuid
language plpgsql security invoker set search_path = org, public, extensions as $$
declare
  v org.costo_referencia;
  v_hasta date;
  v_id uuid;
begin
  perform org.exigir_permiso('sistema:costos', 'editar', 'Tu rol no puede editar costos.');
  perform org.exigir_fecha(p_fecha);
  if p_salario is null or p_salario < 0 or coalesce(p_bonos_usd, 0) < 0 then
    raise exception 'El salario de referencia y los bonos no pueden ser negativos.' using errcode = 'check_violation';
  end if;
  select * into v from org.costo_referencia where cargo_id = p_cargo and vigencia @> p_fecha for update;
  if found then
    update org.costo_referencia set vigencia = org.cerrada_en(vigencia, p_fecha) where id = v.id;
    v_hasta := upper(v.vigencia);
  else
    select min(lower(vigencia)) into v_hasta from org.costo_referencia where cargo_id = p_cargo and lower(vigencia) > p_fecha;
  end if;
  insert into org.costo_referencia (cargo_id, salario_mensual, moneda, bonos_usd_mensual, vigencia, fuente)
  values (p_cargo, p_salario, coalesce(nullif(p_moneda, ''), 'VES'), coalesce(p_bonos_usd, 0), daterange(p_fecha, v_hasta),
          nullif(trim(p_fuente), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function org.crear_componente_costo(
  p_nombre text, p_forma text, p_valor numeric, p_base text, p_tope numeric, p_piso text, p_moneda text,
  p_aplica_a text, p_base_legal text, p_fuente text, p_por_confirmar boolean, p_fecha date, p_nota text default null)
returns uuid
language plpgsql security invoker set search_path = org, public as $$
declare
  v_id uuid;
begin
  perform org.exigir_permiso('sistema:costos', 'editar', 'Tu rol no puede editar costos.');
  perform org.exigir_fecha(p_fecha);
  if length(trim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Ponle nombre al componente.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from org.componente_costo where lower(nombre) = lower(trim(p_nombre)) and vigencia && daterange(p_fecha, null)) then
    raise exception 'Ya hay un componente «%» vigente: edítalo en vez de crear otro.', trim(p_nombre) using errcode = 'check_violation';
  end if;
  insert into org.componente_costo (nombre, forma, valor, base, tope_salarios_minimos, piso_parametro, moneda, aplica_a,
                                    base_legal, fuente, por_confirmar, orden, vigencia, nota)
  values (trim(p_nombre), p_forma, p_valor, coalesce(nullif(p_base, ''), 'salario_normal'), p_tope, nullif(p_piso, ''),
          case when p_forma = 'monto_mensual' then coalesce(nullif(p_moneda, ''), 'VES') end, coalesce(nullif(p_aplica_a, ''), 'todos'),
          nullif(trim(p_base_legal), ''), nullif(trim(p_fuente), ''), coalesce(p_por_confirmar, true),
          coalesce((select max(orden) + 1 from org.componente_costo), 1), daterange(p_fecha, null), nullif(trim(p_nota), ''))
  returning id into v_id;
  return v_id;
end;
$$;

-- Editar un componente es cerrar su versión y abrir otra con el mismo nombre.
create or replace function org.editar_componente_costo(
  p_id uuid, p_fecha date, p_forma text, p_valor numeric, p_base text, p_tope numeric, p_piso text, p_moneda text,
  p_aplica_a text, p_base_legal text, p_fuente text, p_por_confirmar boolean, p_nota text default null)
returns uuid
language plpgsql security invoker set search_path = org, public as $$
declare
  v org.componente_costo;
  v_id uuid;
begin
  perform org.exigir_permiso('sistema:costos', 'editar', 'Tu rol no puede editar costos.');
  perform org.exigir_fecha(p_fecha);
  select * into v from org.componente_costo where id = p_id and vigencia @> p_fecha for update;
  if not found then
    raise exception 'Ese componente no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
  update org.componente_costo set vigencia = org.cerrada_en(vigencia, p_fecha) where id = v.id;
  insert into org.componente_costo (nombre, forma, valor, base, tope_salarios_minimos, piso_parametro, moneda, aplica_a,
                                    base_legal, fuente, por_confirmar, orden, vigencia, nota)
  values (v.nombre, p_forma, p_valor, coalesce(nullif(p_base, ''), 'salario_normal'), p_tope, nullif(p_piso, ''),
          case when p_forma = 'monto_mensual' then coalesce(nullif(p_moneda, ''), 'VES') end, coalesce(nullif(p_aplica_a, ''), 'todos'),
          nullif(trim(p_base_legal), ''), nullif(trim(p_fuente), ''), coalesce(p_por_confirmar, true), v.orden,
          daterange(p_fecha, upper(v.vigencia)), coalesce(nullif(trim(p_nota), ''), v.nota))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function org.retirar_componente_costo(p_id uuid, p_fecha date)
returns void
language plpgsql security invoker set search_path = org, public as $$
begin
  perform org.exigir_permiso('sistema:costos', 'editar', 'Tu rol no puede editar costos.');
  perform org.exigir_fecha(p_fecha);
  update org.componente_costo set vigencia = org.cerrada_en(vigencia, p_fecha) where id = p_id and vigencia @> p_fecha;
  if not found then
    raise exception 'Ese componente no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Parámetros de los cálculos (salario mínimo, ingreso mínimo integral…), con vigencia.
create or replace function org.fijar_parametro(
  p_clave text, p_valor numeric, p_fecha date, p_fuente text default null, p_por_confirmar boolean default true)
returns uuid
language plpgsql security invoker set search_path = org, control, public, extensions as $$
declare
  v control.parametro;
  v_id uuid;
begin
  perform org.exigir_permiso('sistema:costos', 'editar', 'Tu rol no puede editar los parámetros de costo.');
  perform org.exigir_fecha(p_fecha);
  if p_valor is null or p_valor < 0 then
    raise exception 'El valor no puede quedar vacío ni ser negativo.' using errcode = 'check_violation';
  end if;
  select * into v from control.parametro where clave = p_clave and vigencia @> p_fecha for update;
  if not found then
    raise exception 'Ese parámetro no está vigente en esa fecha.' using errcode = 'no_data_found';
  end if;
  update control.parametro set vigencia = org.cerrada_en(vigencia, p_fecha) where id = v.id;
  insert into control.parametro (clave, nombre, valor, unidad, vigencia, fuente, por_confirmar)
  values (v.clave, v.nombre, p_valor, v.unidad, daterange(p_fecha, upper(v.vigencia)),
          coalesce(nullif(trim(p_fuente), ''), v.fuente), coalesce(p_por_confirmar, true))
  returning id into v_id;
  return v_id;
end;
$$;

-- El costo mensual de referencia de cada cargo que lo tiene, a una fecha. Con
-- la RLS de quien pregunta: sin `sistema:costos` no devuelve nada.
create or replace function org.costo_cargos(p_fecha date default null)
returns table (cargo_id uuid, costo jsonb)
language sql stable security invoker set search_path = org, control, public as $$
  select c.id, org.costo_mensual(c.id, coalesce(p_fecha, org.hoy()))
    from org.cargo c
   where exists (select 1 from org.costo_referencia r where r.cargo_id = c.id and r.vigencia @> coalesce(p_fecha, org.hoy()));
$$;

-- La tasa también deja rastro.
drop trigger if exists auditar on org.tasa_cambio;
create trigger auditar after insert or update or delete on org.tasa_cambio
  for each row execute function control.auditar();

-- -----------------------------------------------------------------------------
-- 6) CONCILIACIÓN: se resuelve con permiso de editar el módulo al que pertenece
-- -----------------------------------------------------------------------------

create or replace function control.puede_conciliar(p_modulo text)
returns boolean language sql stable set search_path = public as $$
  select case p_modulo
    when 'NUC-ORG' then public.puede('sistema:estructura', 'editar')
    when 'NUC-PRO' then public.puede('sistema:procesos', 'editar')
    when 'NUC-DOC' then public.puede('sistema:documentos', 'editar')
    else public.es_admin() end;
$$;

-- La política anterior dejaba resolver cualquier punto con editar cualquiera
-- de los tres módulos.
drop policy if exists "resolver conciliación" on control.conciliacion;
create policy "resolver conciliación" on control.conciliacion for update to authenticated
  using (control.puede_conciliar(modulo)) with check (control.puede_conciliar(modulo));

create or replace function control.resolver_conciliacion(p_id uuid, p_estado text, p_resolucion text default null)
returns void
language plpgsql security invoker set search_path = control, public as $$
declare
  v control.conciliacion;
begin
  select * into v from control.conciliacion where id = p_id for update;
  if not found then
    raise exception 'Ese punto de conciliación no existe.' using errcode = 'no_data_found';
  end if;
  if not control.puede_conciliar(v.modulo) then
    raise exception 'Para resolver un punto de % necesitas poder editar ese módulo.', v.modulo using errcode = 'insufficient_privilege';
  end if;
  if p_estado not in ('abierto', 'resuelto', 'descartado') then
    raise exception 'Estado no válido.' using errcode = 'check_violation';
  end if;
  if p_estado <> 'abierto' and length(trim(coalesce(p_resolucion, ''))) < 5 then
    raise exception 'Escribe cómo se resolvió, o por qué se descarta.' using errcode = 'check_violation';
  end if;
  update control.conciliacion
     set estado = p_estado,
         resolucion = case when p_estado = 'abierto' then resolucion else trim(p_resolucion) end,
         resuelto_por = case when p_estado = 'abierto' then null else auth.uid() end,
         resuelto_en = case when p_estado = 'abierto' then null else now() end
   where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7) PRIVILEGIOS
-- -----------------------------------------------------------------------------
grant execute on function org.hoy(), org.exigir_permiso(text, text, text), org.exigir_fecha(date),
  org.cerrada_en(daterange, date) to authenticated;
grant execute on function control.puede_conciliar(text), control.resolver_conciliacion(uuid, text, text) to authenticated;
grant execute on all functions in schema org to service_role;
grant execute on function control.puede_conciliar(text), control.resolver_conciliacion(uuid, text, text) to service_role;
