-- =============================================================================
-- R6 · Seguridad (revisión independiente del 20-nov-2026)
--
-- Cierra lo que la revisión probó contra el proyecto de pruebas:
--   A1  sgc.proceso se publicaba sin aprobación (UPDATE estado='vigente') y una
--       versión vigente se reescribía bajándola a borrador y subiéndola otra vez.
--   A2  Un escenario en aprobación se cambiaba (plazas, unidades, procesos) y la
--       firma publicaba lo cambiado, no lo que se envió.
--   A3  Una requisición nacía «aprobada» sin solicitud, o cambiaba su cantidad
--       en plena ruta y la firma del hito aplicaba la cantidad nueva.
--   A4  control.auditoria dejaba leer el paralelo y los documentos de perímetro
--       a quien tiene auditoría pero no esos permisos.
--   M1  Una sola persona firmaba todos los pasos de una solicitud (incluida la
--       «doble aprobación» de nivel de IA), y el autor del objeto firmaba si lo
--       enviaba otro.
--   M2  ia.registrar_llamada / ia.explicar_propuestas los llamaba cualquiera:
--       gasto inventado (tumbaba la IA de todos) y eventos «de la IA» falsos.
--       El tope de 40 preguntas no era atómico.
--   M3  control.conciliacion se firmaba a nombre de otra persona.
--   M4  serie_tasas y la tabla directa leían el paralelo sin registrar la lectura.
--   Bajos: impacto_requisicion y describir_plazas sin permiso; EXECUTE a PUBLIC
--       en todas las funciones de los esquemas de la plataforma.
--
-- El patrón de A1–A3: los triggers de guardia dejan pasar un cambio de estado
-- solo si viene de una función legítima del flujo. Esa función marca la
-- transacción (`set_config('flujo.aplicando','on',true)`) y, como es SECURITY
-- DEFINER, corre como su dueño: el trigger exige las dos cosas (la marca Y que
-- `current_user` no sea `authenticated`/`anon`), así que la marca no se puede
-- falsificar desde una sesión aunque alguien lograra fijarla. El mantenimiento
-- con la clave de servicio (sin `auth.uid()`, rol `service_role`/`postgres`)
-- también pasa.
-- =============================================================================

-- ── Guardias: ¿lo hace el flujo? ────────────────────────────────────────────
-- Se escribe en línea en cada trigger (no como función): un helper SECURITY
-- DEFINER vería siempre `current_user = postgres` y lo dejaría pasar todo.

create or replace function privado.estado_escenario(p_esc uuid)
returns text
language sql
stable
security definer
set search_path = org, public
as $$
  select estado from org.escenario where id = p_esc;
$$;
revoke all on function privado.estado_escenario(uuid) from public, anon;
grant execute on function privado.estado_escenario(uuid) to authenticated;

-- A1 · sgc.proceso -----------------------------------------------------------
create or replace function sgc.proceso_guardia()
returns trigger
language plpgsql
set search_path = sgc, public
as $$
declare
  v_flujo boolean := current_user not in ('authenticated', 'anon')
                     and (coalesce(current_setting('flujo.aplicando', true), '') = 'on' or auth.uid() is null);
begin
  if v_flujo then return coalesce(new, old); end if;

  -- Filas de un escenario: solo mientras el escenario está en borrador.
  if tg_op in ('UPDATE', 'DELETE') and old.escenario_id is not null then
    if coalesce(privado.estado_escenario(old.escenario_id), 'borrador') <> 'borrador'
       and not (tg_op = 'DELETE' and privado.estado_escenario(old.escenario_id) = 'descartado') then
      raise exception 'Ese escenario ya no está en borrador: lo que se envió a aprobación no se cambia' using errcode = 'check_violation';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.escenario_id is not null then
    if privado.estado_escenario(new.escenario_id) is distinct from 'borrador' then
      raise exception 'Ese escenario ya no está en borrador: lo que se envió a aprobación no se cambia' using errcode = 'check_violation';
    end if;
    if new.estado not in ('borrador', 'retirada') then
      raise exception 'Dentro de un escenario un proceso solo está en borrador o retirado' using errcode = 'check_violation';
    end if;
  end if;

  -- Filas de la realidad: el estado, la vigencia y la versión los mueve el flujo.
  if tg_op = 'INSERT' and new.escenario_id is null and new.estado <> 'borrador' then
    raise exception 'Un proceso nace en borrador: se publica cuando su solicitud se aprueba' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'UPDATE' and (old.escenario_id is null or new.escenario_id is null) then
    if old.escenario_id is distinct from new.escenario_id then
      raise exception 'Un proceso no se mueve entre la realidad y un escenario' using errcode = 'insufficient_privilege';
    end if;
    if old.estado <> 'borrador' then
      raise exception 'Solo se edita un borrador: lo enviado, aprobado o publicado lo mueve su flujo de aprobación' using errcode = 'insufficient_privilege';
    end if;
    if new.estado <> 'borrador' or new.vigencia is distinct from old.vigencia or new.version is distinct from old.version
       or new.ref is distinct from old.ref or new.creado_por is distinct from old.creado_por then
      raise exception 'El estado, la vigencia y la versión de un proceso los cambia su flujo de aprobación' using errcode = 'insufficient_privilege';
    end if;
  end if;
  if tg_op = 'DELETE' and old.escenario_id is null and old.estado <> 'borrador' then
    raise exception 'Solo se borra un borrador: lo publicado se retira con fecha' using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists a_proceso_guardia on sgc.proceso;
create trigger a_proceso_guardia before insert or update or delete on sgc.proceso
  for each row execute function sgc.proceso_guardia();

-- A2 · org.escenario y las filas de escenario de org.unidad / org.plaza -------
create or replace function org.escenario_guardia()
returns trigger
language plpgsql
set search_path = org, public
as $$
declare
  v_flujo boolean := current_user not in ('authenticated', 'anon')
                     and (coalesce(current_setting('flujo.aplicando', true), '') = 'on' or auth.uid() is null);
begin
  if v_flujo then return coalesce(new, old); end if;
  if tg_op = 'INSERT' then
    if new.estado <> 'borrador' or new.publicado_en is not null or new.vigente_desde is not null then
      raise exception 'Un escenario nace en borrador' using errcode = 'insufficient_privilege';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.estado <> 'borrador' then
      raise exception 'Solo se edita un escenario en borrador: lo enviado lo mueve su flujo de aprobación' using errcode = 'insufficient_privilege';
    end if;
    if new.estado not in ('borrador', 'descartado')
       or (new.alcance, new.creado_por, new.creado_en) is distinct from (old.alcance, old.creado_por, old.creado_en)
       or new.publicado_en is distinct from old.publicado_en or new.vigente_desde is distinct from old.vigente_desde then
      raise exception 'Un escenario en borrador solo se renombra, se describe o se descarta: enviarlo es la función enviar' using errcode = 'insufficient_privilege';
    end if;
  else
    if old.estado not in ('borrador', 'descartado') then
      raise exception 'Un escenario enviado o publicado no se borra' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists a_escenario_guardia on org.escenario;
create trigger a_escenario_guardia before insert or update or delete on org.escenario
  for each row execute function org.escenario_guardia();

create or replace function org.fila_escenario_guardia()
returns trigger
language plpgsql
set search_path = org, public
as $$
declare
  v_flujo boolean := current_user not in ('authenticated', 'anon')
                     and (coalesce(current_setting('flujo.aplicando', true), '') = 'on' or auth.uid() is null);
begin
  if v_flujo then return coalesce(new, old); end if;
  if tg_op in ('UPDATE', 'DELETE') and old.escenario_id is not null
     and coalesce(privado.estado_escenario(old.escenario_id), 'borrador') <> 'borrador'
     and not (tg_op = 'DELETE' and privado.estado_escenario(old.escenario_id) = 'descartado') then
    raise exception 'Ese escenario ya no está en borrador: lo que se envió a aprobación no se cambia' using errcode = 'check_violation';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.escenario_id is not null
     and privado.estado_escenario(new.escenario_id) is distinct from 'borrador' then
    raise exception 'Ese escenario ya no está en borrador: lo que se envió a aprobación no se cambia' using errcode = 'check_violation';
  end if;
  if tg_op = 'UPDATE' and old.escenario_id is distinct from new.escenario_id then
    raise exception 'Una fila no se mueve entre la realidad y un escenario' using errcode = 'insufficient_privilege';
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists a_fila_escenario_guardia on org.plaza;
create trigger a_fila_escenario_guardia before insert or update or delete on org.plaza
  for each row execute function org.fila_escenario_guardia();
drop trigger if exists a_fila_escenario_guardia on org.unidad;
create trigger a_fila_escenario_guardia before insert or update or delete on org.unidad
  for each row execute function org.fila_escenario_guardia();

-- A3 · org.requisicion ---------------------------------------------------------
create or replace function org.requisicion_guardia()
returns trigger
language plpgsql
set search_path = org, public
as $$
declare
  v_flujo boolean := current_user not in ('authenticated', 'anon')
                     and (coalesce(current_setting('flujo.aplicando', true), '') = 'on' or auth.uid() is null);
begin
  if v_flujo then return new; end if;
  if tg_op = 'INSERT' then
    if new.estado <> 'borrador' or new.impacto is not null or new.solicitud_id is not null
       or new.candidato is not null or new.fecha_ingreso is not null then
      raise exception 'Una requisición nace en borrador: el impacto, la ruta y el ingreso los pone su flujo' using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;
  if old.estado not in ('borrador', 'devuelta') then
    raise exception 'Solo se corrige una requisición en borrador o devuelta: lo enviado lo mueve su flujo de aprobación' using errcode = 'insufficient_privilege';
  end if;
  if new.estado is distinct from old.estado
     or (new.numero, new.creado_por, new.creado_en) is distinct from (old.numero, old.creado_por, old.creado_en)
     or new.impacto is distinct from old.impacto or new.solicitud_id is distinct from old.solicitud_id
     or new.candidato is distinct from old.candidato or new.fecha_ingreso is distinct from old.fecha_ingreso then
    raise exception 'El estado, el impacto, la ruta y el ingreso de una requisición los cambia su flujo (enviar, cancelar, decidir)' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists a_requisicion_guardia on org.requisicion;
create trigger a_requisicion_guardia before insert or update on org.requisicion
  for each row execute function org.requisicion_guardia();

-- La política de «lo propio» ya no ofrece «cancelada»: cancelar es la función.
drop policy if exists "editar requisiciones" on org.requisicion;
create policy "editar requisiciones" on org.requisicion for update to authenticated
  using ((creado_por = (select auth.uid()) and estado in ('borrador', 'devuelta')) or (select public.puede('sistema:requisiciones', 'editar')))
  with check ((creado_por = (select auth.uid()) and estado in ('borrador', 'devuelta')) or (select public.puede('sistema:requisiciones', 'editar')));
drop policy if exists "crear requisiciones" on org.requisicion;
create policy "crear requisiciones" on org.requisicion for insert to authenticated
  with check ((select public.puede('sistema:requisiciones', 'crear')) and creado_por = (select auth.uid()) and estado = 'borrador');

-- ── A4 · Auditoría: los perímetros también por esta puerta ─────────────────
drop policy if exists "leer auditoría" on control.auditoria;
create policy "leer auditoría" on control.auditoria for select to authenticated
using (
  (select public.puede('sistema:auditoria', 'ver'))
  and ((select public.puede('sistema:costos', 'ver'))
       or not ((esquema = 'org' and tabla in ('componente_costo', 'costo_referencia', 'requisicion_costo', 'tasa_cambio'))
               or (esquema = 'control' and tabla = 'parametro')))
  and ((select public.puede('sistema:tasas-paralelo', 'ver'))
       or not (esquema = 'control' and tabla = 'tasa_cambio' and coalesce(despues, antes) ->> 'tipo' = 'paralelo'))
  and ((select public.puede('sistema:perimetros', 'ver'))
       or not (esquema = 'sgc' and tabla = 'documento' and coalesce(coalesce(despues, antes) ->> 'perimetro', 'general') <> 'general'))
);

-- ── M3 · Conciliación: se resuelve solo por la función, a nombre propio ───────
-- La política de UPDATE dejaba escribir la fila entera (`resuelto_por` de otra
-- persona). Ahora la función es SECURITY DEFINER (pide el permiso por dentro y
-- firma con auth.uid()) y la tabla no se actualiza directo.
drop policy if exists "resolver conciliación" on control.conciliacion;
revoke update on control.conciliacion from authenticated;
alter function control.resolver_conciliacion(uuid, text, text) security definer;

-- ── M1 · Separación de funciones en las aprobaciones ─────────────────────────
-- El autor del objeto (quien lo escribió), además de quien lo envió.
create or replace function privado.autor_de_solicitud(p_tipo text, p_objeto uuid)
returns uuid
language sql
stable
security definer
set search_path = org, sgc, ia, public
as $$
  select case p_tipo
    when 'requisicion_personal' then (select creado_por from org.requisicion where id = p_objeto)
    when 'escenario_estructura' then (select creado_por from org.escenario where id = p_objeto)
    when 'escenario_procesos' then (select creado_por from org.escenario where id = p_objeto)
    when 'proceso' then (select creado_por from sgc.proceso where id = p_objeto)
    when 'nivel_ia' then (select pedido_por from ia.cambio_nivel where id = p_objeto)
  end;
$$;
revoke all on function privado.autor_de_solicitud(text, uuid) from public, anon, authenticated;

/*
 * ¿Puede esta persona decidir este paso? (M1, 20-nov-2026)
 *
 *  · El paso es el actual, está pendiente y la solicitud sigue en curso.
 *  · Nunca decide quien envió la solicitud ni el autor del objeto (aunque lo
 *    haya enviado otra persona).
 *  · Nadie decide dos pasos de la misma solicitud: una «doble aprobación» son
 *    dos personas distintas, no una que firma dos veces.
 *  · El paso con aprobador resuelto (la cuenta de quien ocupa la plaza) lo
 *    decide esa persona. Si esa persona quedó en conflicto —es quien pidió, el
 *    autor, ya firmó otro paso o no tiene la cuenta activa—, el paso cae al
 *    mismo carril que uno «sin cuenta»: si no, la solicitud se trabaría.
 *  · El paso sin aprobador con cuenta (o en conflicto) lo decide quien
 *    administra aprobaciones (`sistema:aprobaciones` · editar) o el nivel
 *    administrador. `es_admin()` ya no pasa por encima de un aprobador resuelto.
 *
 * ⚠️ Con estas reglas una ruta de N pasos «sin cuenta» necesita N personas
 * distintas con aprobaciones · editar. En el proyecto de pruebas los empleados
 * no tienen cuenta: las pruebas de punta a punta usan admin, consultor y la
 * cuenta de pruebas «aprobador» (rol consultor) para una ruta de dos pasos
 * cuyo pedido hace una cuarta persona.
 */
create or replace function privado.puede_decidir_de(p_perfil uuid, p_paso uuid)
returns boolean
language sql
stable
security definer
set search_path = flujo, public
as $$
  with x as (
    select p.*, s.estado as s_estado, s.paso_actual, s.creado_por as pidio,
           privado.autor_de_solicitud(s.tipo_objeto, s.objeto_id) as autor
      from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
     where p.id = p_paso
  ), y as (
    select x.*,
           -- El aprobador resuelto que no puede firmar: el paso queda «sin cuenta».
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
       and not exists (select 1 from flujo.paso q where q.solicitud_id = y.solicitud_id and q.id <> y.id
                         and q.decidido_por = p_perfil and q.decision in ('aprobado', 'rechazado', 'devuelto'))
       and (
            (y.aprobador_perfil = p_perfil and not y.en_conflicto)
         or (y.aprobador_perfil is null and y.regla ->> 'resolutor' = 'rol'
             and exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo and pr.rol_id::text = y.regla ->> 'rol_id'))
         or ((y.aprobador_perfil is null and coalesce(y.regla ->> 'resolutor', '') <> 'rol') or y.en_conflicto)
             and (privado.puede_perfil(p_perfil, 'sistema:aprobaciones', 'editar')
                  or exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo and pr.rol = 'admin'))
       )
      from y), false);
$$;
revoke all on function privado.puede_decidir_de(uuid, uuid) from public, anon, authenticated;

create or replace function flujo.puede_decidir(p_paso uuid)
returns boolean
language sql
stable
security definer
set search_path = flujo, public
as $$
  -- Las reglas, con su porqué, en privado.puede_decidir_de (R6 · M1).
  select privado.puede_decidir_de(auth.uid(), p_paso);
$$;

-- Los avisos «te toca decidir» siguen exactamente la misma regla.
create or replace function privado.aprobadores_de_paso(p_paso uuid)
returns setof uuid
language sql
stable
security definer
set search_path = flujo, public
as $$
  select pr.id from public.profiles pr
   where pr.activo and privado.puede_decidir_de(pr.id, p_paso);
$$;

-- flujo.decidir: bloquea el paso antes de mirar si te toca (dos decisiones a
-- la vez sobre el mismo paso ya no pasan las dos).
create or replace function flujo.decidir(p_paso uuid, p_decision text, p_comentario text default null)
returns text
language plpgsql
security definer
set search_path = flujo, org, sgc, public
as $$
declare
  p flujo.paso;
  s flujo.solicitud;
  v_siguiente int;
begin
  if p_decision not in ('aprobado', 'rechazado', 'devuelto') then
    raise exception 'Decisión no válida' using errcode = 'check_violation';
  end if;
  perform 1 from flujo.paso where id = p_paso for update;
  if not flujo.puede_decidir(p_paso) then
    raise exception 'Este paso no te toca: ya se decidió, es tu propia solicitud o tu objeto, o ya firmaste otro paso de ella' using errcode = 'insufficient_privilege';
  end if;
  if p_decision in ('rechazado', 'devuelto') and coalesce(trim(p_comentario), '') = '' then
    raise exception 'Rechazar o devolver pide un motivo' using errcode = 'check_violation';
  end if;

  update flujo.paso set decision = p_decision, comentario = p_comentario, decidido_por = auth.uid(), decidido_en = now()
   where id = p_paso and decision = 'pendiente' returning * into p;
  if not found then
    raise exception 'Ese paso ya se decidió' using errcode = 'check_violation';
  end if;
  select * into s from flujo.solicitud where id = p.solicitud_id for update;

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

-- ── M2 · El registro de la IA lo escribe el servidor, y los topes son atómicos
-- Reservas de gasto en curso: una llamada al modelo reserva antes de salir y
-- libera al registrarse (lo que no se registra caduca a los 15 minutos).
create table if not exists ia.reserva (
  id uuid primary key default gen_random_uuid(),
  perfil uuid not null references public.profiles (id) on delete cascade,
  capacidad text not null,
  monto_usd numeric(10, 5) not null check (monto_usd >= 0),
  creado_en timestamptz not null default now()
);
alter table ia.reserva enable row level security;
-- Sin políticas: solo la clave de servicio y las funciones de servicio.
revoke all on ia.reserva from public, anon, authenticated;
grant all on ia.reserva to service_role;

create or replace function ia.reservar_llamada_servicio(p_perfil uuid, p_capacidad text, p_tope_persona integer default null, p_reserva_usd numeric default 0.10)
returns uuid
language plpgsql
security definer
set search_path = ia, public
as $$
declare
  c ia.capacidad;
  v_inicio timestamptz := ((now() at time zone 'America/Caracas')::date)::timestamp at time zone 'America/Caracas';
  v_hechas integer;
  v_id uuid;
begin
  if p_perfil is null or not exists (select 1 from public.profiles where id = p_perfil and activo) then
    raise exception 'Sin sesión' using errcode = 'insufficient_privilege';
  end if;
  -- Un solo turno a la vez: contar y reservar es una sola operación.
  perform pg_advisory_xact_lock(hashtext('ia.reserva'));
  if not coalesce((select encendido from ia.interruptor_general), false) then
    raise exception 'La IA está apagada en toda la plataforma (interruptor general).' using errcode = 'insufficient_privilege';
  end if;
  select * into c from ia.capacidad where codigo = p_capacidad;
  if not found then raise exception 'Esa capacidad no existe.' using errcode = 'no_data_found'; end if;
  if not c.encendida or c.nivel_actual = 'N0' then
    raise exception 'La capacidad % está apagada.', c.codigo using errcode = 'insufficient_privilege';
  end if;
  delete from ia.reserva where creado_en < now() - interval '15 minutes';
  if p_tope_persona is not null then
    select (select count(*) from ia.actividad a
             where a.capacidad = p_capacidad and a.pedido_por = p_perfil and a.creado_en >= v_inicio
               and a.accion in ('respondio', 'explico', 'error'))
         + (select count(*) from ia.reserva r where r.capacidad = p_capacidad and r.perfil = p_perfil)
      into v_hechas;
    if v_hechas >= p_tope_persona then
      raise exception 'Llegaste a las % preguntas de hoy. Mañana sigues; mientras, la búsqueda (Ctrl K) funciona sin IA.', p_tope_persona
        using errcode = 'check_violation';
    end if;
  end if;
  if ia.gastado_hoy() + coalesce((select sum(monto_usd) from ia.reserva), 0) + greatest(coalesce(p_reserva_usd, 0), 0) > ia.tope_diario() then
    raise exception 'Se alcanzó el tope diario de gasto de la IA (US$ %). Sigue por el camino manual; mañana vuelve.', to_char(ia.tope_diario(), 'FM990.00')
      using errcode = 'insufficient_privilege';
  end if;
  insert into ia.reserva (perfil, capacidad, monto_usd) values (p_perfil, p_capacidad, greatest(coalesce(p_reserva_usd, 0), 0))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function ia.registrar_llamada_servicio(
  p_perfil uuid, p_reserva uuid, p_capacidad text, p_accion text, p_resumen text, p_evidencia jsonb,
  p_tokens_entrada integer, p_tokens_salida integer, p_costo_usd numeric, p_latencia_ms integer, p_modelo text,
  p_objeto_tipo text default null, p_objeto_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ia, public
as $$
declare
  v_id uuid;
  v_nivel text;
begin
  if p_perfil is null or not exists (select 1 from public.profiles where id = p_perfil and activo) then
    raise exception 'Sin sesión' using errcode = 'insufficient_privilege';
  end if;
  if p_accion not in ('respondio', 'explico', 'bloqueo', 'error') then
    raise exception 'Acción no válida para una llamada' using errcode = 'check_violation';
  end if;
  if p_objeto_id is not null and not privado.puede_ver_objeto_de(p_perfil, p_objeto_tipo, p_objeto_id) then
    raise exception 'Ese objeto no está al alcance de quien pidió' using errcode = 'insufficient_privilege';
  end if;
  if p_reserva is not null then delete from ia.reserva where id = p_reserva and perfil = p_perfil; end if;
  select nivel_actual into v_nivel from ia.capacidad where codigo = p_capacidad;
  insert into ia.actividad (capacidad, nivel, accion, objeto_tipo, objeto_id, resumen, evidencia, actor_es_ia, pedido_por,
                            tokens_entrada, tokens_salida, costo_usd, latencia_ms, modelo)
  values (p_capacidad, case when v_nivel = 'N0' then null else v_nivel end, p_accion, p_objeto_tipo, p_objeto_id,
          left(coalesce(nullif(trim(p_resumen), ''), '—'), 1000), coalesce(p_evidencia, '[]'::jsonb),
          p_accion in ('respondio', 'explico'), p_perfil,
          greatest(coalesce(p_tokens_entrada, 0), 0), greatest(coalesce(p_tokens_salida, 0), 0),
          greatest(coalesce(p_costo_usd, 0), 0), p_latencia_ms, left(p_modelo, 60))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function ia.explicar_propuestas_servicio(p_perfil uuid, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ia, public
as $$
declare
  v_n integer;
begin
  if p_perfil is null then raise exception 'Sin sesión' using errcode = 'insufficient_privilege'; end if;
  with x as (
    select (e ->> 'id')::uuid as id, left(trim(e ->> 'texto'), 1200) as texto
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) e
     where e ->> 'id' ~ '^[0-9a-f-]{36}$' and coalesce(trim(e ->> 'texto'), '') <> ''
  ), u as (
    update ia.propuesta p set explicacion = x.texto
      from x
     where p.id = x.id and p.pedido_por = p_perfil and p.estado in ('pendiente', 'aceptada')
       and p.creado_en > now() - interval '10 minutes' and p.explicacion is null
    returning 1
  )
  select count(*) into v_n from u;
  return v_n;
end;
$$;

create or replace function ia.liberar_reserva_servicio(p_perfil uuid, p_reserva uuid)
returns void
language sql
security definer
set search_path = ia, public
as $$
  delete from ia.reserva where id = p_reserva and perfil = p_perfil;
$$;
revoke all on function ia.liberar_reserva_servicio(uuid, uuid) from public, anon, authenticated;
grant execute on function ia.liberar_reserva_servicio(uuid, uuid) to service_role;

revoke all on function ia.reservar_llamada_servicio(uuid, text, integer, numeric) from public, anon, authenticated;
revoke all on function ia.registrar_llamada_servicio(uuid, uuid, text, text, text, jsonb, integer, integer, numeric, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function ia.explicar_propuestas_servicio(uuid, jsonb) from public, anon, authenticated;
grant execute on function ia.reservar_llamada_servicio(uuid, text, integer, numeric) to service_role;
grant execute on function ia.registrar_llamada_servicio(uuid, uuid, text, text, text, jsonb, integer, integer, numeric, integer, text, text, uuid) to service_role;
grant execute on function ia.explicar_propuestas_servicio(uuid, jsonb) to service_role;
-- Las de sesión ya no se llaman desde una sesión.
revoke all on function ia.registrar_llamada(text, text, text, jsonb, integer, integer, numeric, integer, text, text, uuid) from public, anon, authenticated;
revoke all on function ia.explicar_propuestas(jsonb) from public, anon, authenticated;

-- ── M4 · El paralelo se lee solo por funciones que registran la lectura ─────
create or replace function control.serie_tasas(p_desde date, p_hasta date default null)
returns table(dia date, usd numeric, eur numeric, usd_fecha_valor date, paralelo numeric, brecha numeric)
language plpgsql
security definer
set search_path = control, public
as $$
declare
  v_ve boolean := public.puede('sistema:tasas-paralelo', 'ver');
begin
  if v_ve and auth.uid() is not null then
    insert into control.lectura_paralelo (perfil_id) values (auth.uid()) on conflict do nothing;
  end if;
  return query
  with dias as (
    select g::date as dia from generate_series(p_desde, coalesce(p_hasta, (now() at time zone 'America/Caracas')::date), interval '1 day') g
  )
  select d.dia, u.tasa, e.tasa, u.fecha_valor,
         case when v_ve then p.tasa end,
         case when v_ve and u.tasa > 0 and p.tasa is not null then round((p.tasa / u.tasa - 1) * 100, 2) end
    from dias d
    left join lateral (select t.tasa, t.fecha_valor from control.tasa_cambio t where t.tipo = 'oficial' and t.moneda = 'USD' and t.estado = 'vigente' and t.fecha_valor <= d.dia order by t.fecha_valor desc limit 1) u on true
    left join lateral (select t.tasa from control.tasa_cambio t where t.tipo = 'oficial' and t.moneda = 'EUR' and t.estado = 'vigente' and t.fecha_valor <= d.dia order by t.fecha_valor desc limit 1) e on true
    left join lateral (select t.tasa from control.tasa_cambio t where t.tipo = 'paralelo' and t.moneda = 'USD' and t.estado = 'vigente' and t.fecha_valor = d.dia order by t.capturada_en desc limit 1) p on true
   order by d.dia;
end;
$$;

-- El historial (tabla y CSV) por RPC: con el paralelo, si lo puedes ver, y
-- registrando la lectura.
create or replace function control.historial_tasas()
returns setof control.tasa_cambio
language plpgsql
security definer
set search_path = control, public
as $$
declare
  v_ve boolean := public.puede('sistema:tasas-paralelo', 'ver');
begin
  if not public.puede('sistema:tasas', 'ver') then return; end if;
  if v_ve and auth.uid() is not null then
    insert into control.lectura_paralelo (perfil_id) values (auth.uid()) on conflict do nothing;
  end if;
  return query select t.* from control.tasa_cambio t where t.tipo = 'oficial' or v_ve;
end;
$$;

-- La tabla directa ya no entrega el paralelo: solo las funciones que registran.
drop policy if exists "leer oficiales" on control.tasa_cambio;
create policy "leer oficiales" on control.tasa_cambio for select to authenticated
  using (tipo = 'oficial');

-- ── Bajos · Funciones que respondían sin preguntar el permiso ────────────────
create or replace function org.describir_plazas(p_refs uuid[])
returns table(ref uuid, cargo text, unidad text)
language sql
stable
security definer
set search_path = org, public
as $$
  select distinct on (p.ref) p.ref, c.nombre, u.nombre
    from org.plaza p
    join org.cargo c on c.id = p.cargo_id
    left join lateral (select x.nombre from org.unidad x where x.ref = p.unidad_ref and x.escenario_id is null
                        order by upper_inf(x.vigencia) desc, lower(x.vigencia) desc limit 1) u on true
   where auth.uid() is not null and p.ref = any (p_refs) and p.escenario_id is null
     and (public.puede('sistema:estructura', 'ver') or public.puede('sistema:aprobaciones', 'ver')
          or public.puede('sistema:requisiciones', 'crear'))
   order by p.ref, (p.vigencia @> current_date) desc, lower(p.vigencia) desc;
$$;

-- ── A1–A3 · Los caminos legítimos marcan la transacción ─────────────────────
-- Mismo cuerpo que tenían (tomado de la base de pruebas el 20-nov-2026, después
-- de r6_endurecer), con una línea más al empezar: la marca que las guardias
-- reconocen. sgc.enviar_proceso además rechaza una fila de escenario, y
-- org.impacto_requisicion responde solo a quien ve la requisición.

-- flujo.al_decidir: camino legítimo del flujo, con la marca de la transacción.
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
  elsif p_tipo = 'nivel_ia' then
    perform ia.al_decidir_nivel(p_objeto, p_decision, p_estado_solicitud);
  end if;
end;
$function$;

-- org.enviar_requisicion: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION org.enviar_requisicion(p_req uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'flujo', 'public'
AS $function$
declare
  q org.requisicion;
  v_impacto jsonb;
  v_sol uuid;
  v_cargo text;
begin
  perform set_config('flujo.aplicando', 'on', true);
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
$function$;

-- org.aplicar_requisicion: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION org.aplicar_requisicion(p_req uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'public'
AS $function$
declare
  q org.requisicion;
  v org.plaza;
begin
  perform set_config('flujo.aplicando', 'on', true);
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
$function$;

-- org.cubrir_requisicion: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION org.cubrir_requisicion(p_req uuid, p_empleado uuid, p_fecha date)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'public'
AS $function$
declare
  q org.requisicion;
  v_motivo text;
  v_n integer;
begin
  perform set_config('flujo.aplicando', 'on', true);
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
$function$;

-- org.cancelar_requisicion: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION org.cancelar_requisicion(p_req uuid, p_motivo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'flujo', 'public'
AS $function$
declare
  q org.requisicion;
begin
  perform set_config('flujo.aplicando', 'on', true);
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
$function$;

-- org.registrar_candidato: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION org.registrar_candidato(p_req uuid, p_candidato text, p_fecha date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'flujo', 'public'
AS $function$
declare
  q org.requisicion;
begin
  perform set_config('flujo.aplicando', 'on', true);
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
$function$;

-- org.enviar_escenario: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION org.enviar_escenario(p_esc uuid, p_vigente_desde date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'org', 'flujo', 'public'
AS $function$
declare
  e org.escenario;
begin
  perform set_config('flujo.aplicando', 'on', true);
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
$function$;

-- org.publicar_escenario: camino legítimo del flujo, con la marca de la transacción.
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
begin
  perform set_config('flujo.aplicando', 'on', true);
  select * into e from org.escenario where id = p_esc;
  d := coalesce(e.vigente_desde, org.hoy());
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

-- sgc.enviar_proceso: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION sgc.enviar_proceso(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sgc', 'flujo', 'org', 'public'
AS $function$
declare
  v sgc.proceso;
  v_unidad uuid;
begin
  perform set_config('flujo.aplicando', 'on', true);
  if not public.puede('sistema:procesos', 'editar') then
    raise exception 'Sin permiso para editar procesos' using errcode = 'insufficient_privilege';
  end if;
  select * into v from sgc.proceso where id = p_id for update;
  if not found or v.escenario_id is not null or v.estado <> 'borrador' then
    raise exception 'Solo se envía un borrador de la realidad (no una fila de escenario)' using errcode = 'check_violation';
  end if;
  select unidad_ref into v_unidad from org.plaza where ref = v.dueno_plaza_ref and escenario_id is null limit 1;
  update sgc.proceso set estado = 'en_revision' where id = p_id;
  return flujo.iniciar('proceso', p_id, format('%s · versión %s', v.nombre, v.version), v_unidad, '{}');
end;
$function$;

-- sgc.publicar_proceso: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION sgc.publicar_proceso(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sgc', 'public'
AS $function$
declare
  v sgc.proceso;
begin
  perform set_config('flujo.aplicando', 'on', true);
  select * into v from sgc.proceso where id = p_id;
  update sgc.proceso set estado = 'reemplazada', vigencia = daterange(lower(vigencia), current_date)
   where ref = v.ref and escenario_id is null and estado = 'vigente' and lower(vigencia) < current_date;
  -- Una vigente que nació hoy mismo se reemplaza sin rango vacío.
  update sgc.proceso set estado = 'reemplazada', vigencia = null
   where ref = v.ref and escenario_id is null and estado = 'vigente';
  update sgc.proceso set estado = 'vigente', vigencia = daterange(current_date, null) where id = p_id;
end;
$function$;

-- sgc.enviar_escenario_procesos: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION sgc.enviar_escenario_procesos(p_esc uuid, p_vigente_desde date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sgc', 'org', 'flujo', 'public'
AS $function$
declare
  e org.escenario;
  v_unidad uuid;
begin
  perform set_config('flujo.aplicando', 'on', true);
  if not public.puede('sistema:escenarios', 'editar') then
    raise exception 'Sin permiso para enviar escenarios' using errcode = 'insufficient_privilege';
  end if;
  select * into e from org.escenario where id = p_esc for update;
  if not found or e.alcance <> 'procesos' then raise exception 'El escenario de procesos no existe'; end if;
  if e.estado <> 'borrador' then raise exception 'Solo se envía un escenario en borrador' using errcode = 'check_violation'; end if;
  if p_vigente_desde is null or p_vigente_desde < current_date then
    raise exception 'La vigencia retroactiva no se permite' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from sgc.comparar_escenario_procesos(p_esc)) then
    raise exception 'El escenario no cambia nada respecto de la realidad' using errcode = 'check_violation';
  end if;
  if exists (select 1 from sgc.comparar_escenario_procesos(p_esc) where borrador_abierto) then
    raise exception 'Hay procesos de este escenario con un borrador abierto en la realidad: ciérralo antes de enviar'
      using errcode = 'check_violation';
  end if;
  select p.unidad_ref into v_unidad
    from sgc.proceso x join org.plaza p on p.ref = x.dueno_plaza_ref and p.escenario_id is null
   where x.ref = e.proceso_raiz_ref and x.escenario_id is null and x.estado = 'vigente' limit 1;
  update org.escenario set estado = 'en_aprobacion', vigente_desde = p_vigente_desde where id = p_esc;
  return flujo.iniciar('escenario_procesos', p_esc, format('Escenario de procesos · %s', e.nombre), v_unidad, '{}');
end;
$function$;

-- sgc.publicar_escenario_procesos: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION sgc.publicar_escenario_procesos(p_esc uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sgc', 'org', 'public'
AS $function$
declare
  e org.escenario;
  d date;
  v_ya boolean;
  c record;
  v_ver integer;
begin
  perform set_config('flujo.aplicando', 'on', true);
  select * into e from org.escenario where id = p_esc for update;
  if e.estado = 'publicado' then return; end if;
  d := greatest(coalesce(e.vigente_desde, current_date), current_date);
  v_ya := d <= current_date;

  for c in select * from sgc.comparar_escenario_procesos(p_esc) loop
    if c.cambio in ('baja', 'cambio') then
      update sgc.proceso
         set estado = case when not v_ya then 'vigente'
                           when c.cambio = 'baja' then 'retirada' else 'reemplazada' end,
             vigencia = case when lower(vigencia) >= d then null else daterange(lower(vigencia), d) end
       where ref = c.ref and escenario_id is null and estado = 'vigente';
    end if;
    if c.cambio in ('alta', 'cambio') then
      select coalesce(max(version), 0) + 1 into v_ver from sgc.proceso where ref = c.ref and escenario_id is null;
      insert into sgc.proceso (ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe,
                               estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha, estado, version,
                               vigencia, fuente, nota, creado_por)
      select ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe,
             estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha,
             case when v_ya then 'vigente' else 'aprobada' end, v_ver,
             daterange(d, null), fuente || array[format('escenario:%s', e.id)], nota, e.creado_por
        from sgc.proceso where ref = c.ref and escenario_id = p_esc;
    end if;
  end loop;
  update org.escenario set estado = 'publicado', publicado_en = now() where id = p_esc;
end;
$function$;

-- sgc.activar_programados: camino legítimo del flujo, con la marca de la transacción.
CREATE OR REPLACE FUNCTION sgc.activar_programados()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'sgc', 'public'
AS $function$
declare
  n integer := 0;
  m integer;
begin
  perform set_config('flujo.aplicando', 'on', true);
  update sgc.proceso p
     set estado = case when exists (select 1 from sgc.proceso q
                                     where q.ref = p.ref and q.escenario_id is null and q.estado = 'aprobada'
                                       and lower(q.vigencia) <= current_date)
                       then 'reemplazada' else 'retirada' end
   where p.escenario_id is null and p.estado = 'vigente'
     and upper(p.vigencia) is not null and upper(p.vigencia) <= current_date;
  get diagnostics n = row_count;
  update sgc.proceso set estado = 'vigente'
   where escenario_id is null and estado = 'aprobada' and lower(vigencia) <= current_date;
  get diagnostics m = row_count;
  return n + m;
end;
$function$;

-- org.impacto_requisicion: solo responde a quien ve la requisición (bajo).
CREATE OR REPLACE FUNCTION org.impacto_requisicion(p_req uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'org', 'sgc', 'flujo', 'public'
AS $function$
declare
  q org.requisicion;
  v_hoy date := current_date;
  v_aprobada int; v_ocupada int; v_plan int;
  v_jefe uuid; v_tramo int;
  v_procesos jsonb; v_rutas jsonb; v_subordinadas int;
begin
  select * into q from org.requisicion where id = p_req;
  if not found then return null; end if;
  if auth.uid() is not null and not privado.puede_ver_objeto_de(auth.uid(), 'requisicion', p_req)
     and not public.puede('sistema:requisiciones', 'editar') then
    return null;
  end if;

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
$function$;


-- ── Bajos · EXECUTE: nada para PUBLIC/anon; a authenticated, solo lo que se usa ──
-- Lista calculada el 20-nov-2026: lo que la app llama por RPC (grep de app/, lib/,
-- components/), lo que nombran las políticas y los CHECK, las funciones de ui.metrica
-- (se ejecutan por nombre) y, por cierre, lo que llaman las funciones INVOKER de esa
-- lista y los triggers INVOKER (corren como la sesión). Las SECURITY DEFINER internas
-- (al_decidir, publicar_*, aplicar_requisicion, perfil_de_plaza, plaza_jefe_de,
-- valor_legible, diff_legible…) quedan solo para su dueño y para service_role.
revoke execute on all functions in schema org from public, anon, authenticated;
revoke execute on all functions in schema sgc from public, anon, authenticated;
revoke execute on all functions in schema flujo from public, anon, authenticated;
revoke execute on all functions in schema control from public, anon, authenticated;
revoke execute on all functions in schema ui from public, anon, authenticated;
revoke execute on all functions in schema nucleo from public, anon, authenticated;
revoke execute on all functions in schema ia from public, anon, authenticated;
grant execute on function control.cargar_tasa_manual(p_tipo text, p_moneda text, p_tasa numeric, p_fecha_valor date, p_motivo text) to authenticated;
grant execute on function control.puede_conciliar(p_modulo text) to authenticated;
grant execute on function control.resolver_conciliacion(p_id uuid, p_estado text, p_resolucion text) to authenticated;
grant execute on function control.serie_tasas(p_desde date, p_hasta date) to authenticated;
grant execute on function control.tasas_del_dia(p_dia date) to authenticated;
grant execute on function flujo.bandeja() to authenticated;
grant execute on function flujo.decidir(p_paso uuid, p_decision text, p_comentario text) to authenticated;
grant execute on function flujo.firmo_en(p_solicitud uuid) to authenticated;
grant execute on function flujo.firmo_objeto(p_objeto uuid) to authenticated;
grant execute on function flujo.nombres(p_ids uuid[]) to authenticated;
grant execute on function flujo.pedi_yo(p_solicitud uuid) to authenticated;
grant execute on function flujo.puede_decidir(p_paso uuid) to authenticated;
grant execute on function ia.candidatos_clasificacion(p_limite integer) to authenticated;
grant execute on function ia.decidir_propuesta(p_id uuid, p_decision text, p_motivo text, p_cambios jsonb) to authenticated;
grant execute on function ia.deshacer(p_id uuid, p_motivo text) to authenticated;
grant execute on function ia.encender(p_codigo text, p_encendida boolean, p_motivo text) to authenticated;
grant execute on function ia.estado() to authenticated;
grant execute on function ia.fijar_interruptor(p_encendido boolean, p_motivo text) to authenticated;
grant execute on function ia.fijar_tope(p_usd numeric, p_motivo text) to authenticated;
grant execute on function ia.mis_propuestas(p_limite integer) to authenticated;
grant execute on function ia.n(p text) to authenticated;
grant execute on function ia.pedir_cambio_nivel(p_codigo text, p_nivel text, p_motivo text, p_evidencia text) to authenticated;
grant execute on function ia.proponer_clasificacion(p_items jsonb) to authenticated;
grant execute on function ia.revisar_plazas() to authenticated;
grant execute on function ia.tablero() to authenticated;
grant execute on function nucleo.cambios(p_tipo text, p_id uuid, p_limite integer) to authenticated;
grant execute on function nucleo.comentar(p_tipo text, p_id uuid, p_texto text, p_padre uuid, p_menciones uuid[]) to authenticated;
grant execute on function nucleo.marcar_leidas(p_ids uuid[]) to authenticated;
grant execute on function nucleo.mencionables(p_tipo text, p_id uuid, p_q text) to authenticated;
grant execute on function nucleo.no_leidas() to authenticated;
grant execute on function nucleo.nombres(p_ids uuid[]) to authenticated;
grant execute on function nucleo.personas(p_q text) to authenticated;
grant execute on function nucleo.puede_ver_objeto(p_tipo text, p_id uuid) to authenticated;
grant execute on function nucleo.titulos_objetos(p_tipos text[], p_ids uuid[]) to authenticated;
grant execute on function org.aprobar_plan_dotacion(p_plan uuid) to authenticated;
grant execute on function org.asignar_ocupacion(p_plaza_ref uuid, p_empleado_id uuid, p_tipo text, p_fecha date, p_excede boolean, p_motivo text) to authenticated;
grant execute on function org.cancelar_requisicion(p_req uuid, p_motivo text) to authenticated;
grant execute on function org.cerrada_en(p_vigencia daterange, p_fecha date) to authenticated;
grant execute on function org.cerrar_plaza(p_ref uuid, p_fecha date, p_motivo text) to authenticated;
grant execute on function org.cerrar_unidad(p_ref uuid, p_fecha date, p_motivo text) to authenticated;
grant execute on function org.comparar_escenario(p_escenario uuid) to authenticated;
grant execute on function org.costo_mensual(p_cargo uuid, p_fecha date, p_tasa numeric) to authenticated;
grant execute on function org.crear_componente_costo(p_nombre text, p_forma text, p_valor numeric, p_base text, p_tope numeric, p_piso text, p_moneda text, p_aplica_a text, p_base_legal text, p_fuente text, p_por_confirmar boolean, p_fecha date, p_nota text) to authenticated;
grant execute on function org.crear_escenario_estructura(p_nombre text, p_descripcion text, p_fecha date) to authenticated;
grant execute on function org.crear_plaza(p_unidad_ref uuid, p_cargo_id uuid, p_dotacion integer, p_reporta_a_ref uuid, p_tipo_nomina text, p_sede text, p_estado text, p_fecha date, p_nota text) to authenticated;
grant execute on function org.crear_unidad(p_clave text, p_nombre text, p_tipo text, p_padre_ref uuid, p_sede text, p_fecha date, p_codigo text, p_nota text) to authenticated;
grant execute on function org.cubrir_requisicion(p_req uuid, p_empleado uuid, p_fecha date) to authenticated;
grant execute on function org.dependencias(p_cargo uuid, p_plaza uuid) to authenticated;
grant execute on function org.describir_plazas(p_refs uuid[]) to authenticated;
grant execute on function org.direccion_de(p_unidad uuid, p_fecha date) to authenticated;
grant execute on function org.editar_componente_costo(p_id uuid, p_fecha date, p_forma text, p_valor numeric, p_base text, p_tope numeric, p_piso text, p_moneda text, p_aplica_a text, p_base_legal text, p_fuente text, p_por_confirmar boolean, p_nota text) to authenticated;
grant execute on function org.editar_plaza(p_ref uuid, p_fecha date, p_dotacion integer, p_reporta_a_ref uuid, p_estado text, p_tipo_nomina text, p_sede text, p_unidad_ref uuid, p_certeza text, p_nota text) to authenticated;
grant execute on function org.editar_unidad(p_ref uuid, p_fecha date, p_nombre text, p_tipo text, p_padre_ref uuid, p_sede text, p_codigo text, p_certeza text, p_nota text) to authenticated;
grant execute on function org.enviar_escenario(p_esc uuid, p_vigente_desde date) to authenticated;
grant execute on function org.enviar_requisicion(p_req uuid) to authenticated;
grant execute on function org.escenario_en_borrador(p_esc uuid) to authenticated;
grant execute on function org.estructura_al(p_fecha date, p_escenario uuid) to authenticated;
grant execute on function org.exigir_fecha(p_fecha date) to authenticated;
grant execute on function org.exigir_permiso(p_recurso text, p_accion text, p_mensaje text) to authenticated;
grant execute on function org.fijar_costo_referencia(p_cargo uuid, p_salario numeric, p_moneda text, p_bonos_usd numeric, p_fecha date, p_fuente text) to authenticated;
grant execute on function org.fijar_parametro(p_clave text, p_valor numeric, p_fecha date, p_fuente text, p_por_confirmar boolean) to authenticated;
grant execute on function org.guardar_lineas_plan(p_plan uuid, p_lineas jsonb) to authenticated;
grant execute on function org.hoy() to authenticated;
grant execute on function org.impacto_requisicion(p_req uuid) to authenticated;
grant execute on function org.lienzo(p_fecha date, p_escenario uuid) to authenticated;
grant execute on function org.mover_ocupacion(p_id uuid, p_plaza_destino uuid, p_fecha date, p_tipo text, p_excede boolean, p_motivo text) to authenticated;
grant execute on function org.nuevo_plan_dotacion(p_anio integer, p_nota text) to authenticated;
grant execute on function org.ocupantes_de_unidad(p_unidad uuid) to authenticated;
grant execute on function org.paso_actual_requisicion(p_req uuid) to authenticated;
grant execute on function org.registrar_candidato(p_req uuid, p_candidato text, p_fecha date) to authenticated;
grant execute on function org.retirar_componente_costo(p_id uuid, p_fecha date) to authenticated;
grant execute on function org.tasa_bcv(p_fecha date) to authenticated;
grant execute on function org.terminar_ocupacion(p_id uuid, p_fecha date, p_motivo text) to authenticated;
grant execute on function sgc.activar_programados() to authenticated;
grant execute on function sgc.buscar_documentos(p_texto text, p_estado text, p_xx text, p_yy text, p_familia text, p_perimetro text, p_proceso uuid, p_desde integer, p_limite integer) to authenticated;
grant execute on function sgc.comparar_escenario_procesos(p_escenario uuid) to authenticated;
grant execute on function sgc.conteo_documentos() to authenticated;
grant execute on function sgc.crear_escenario_procesos(p_nombre text, p_descripcion text, p_raiz uuid) to authenticated;
grant execute on function sgc.enviar_escenario_procesos(p_esc uuid, p_vigente_desde date) to authenticated;
grant execute on function sgc.enviar_proceso(p_id uuid) to authenticated;
grant execute on function sgc.ficha_llena(p_ficha jsonb) to authenticated;
grant execute on function sgc.lienzo(p_fecha date, p_escenario uuid) to authenticated;
grant execute on function sgc.nuevo_borrador(p_ref uuid) to authenticated;
grant execute on function sgc.opciones_documentos() to authenticated;
grant execute on function sgc.plano(p text) to authenticated;
grant execute on function sgc.xx(p text) to authenticated;
grant execute on function ui.alertas_organizacion(p_al date) to authenticated;
grant execute on function ui.buscar(p_q text, p_limite integer, p_tipo text, p_desde integer) to authenticated;
grant execute on function ui.cargos(p_al date) to authenticated;
grant execute on function ui.componentes_costo(p_fecha date) to authenticated;
grant execute on function ui.conciliacion() to authenticated;
grant execute on function ui.conciliacion_documentos() to authenticated;
grant execute on function ui.costo_unidades(p_fecha date) to authenticated;
grant execute on function ui.costos_cargo(p_fecha date) to authenticated;
grant execute on function ui.cruce_procesos() to authenticated;
grant execute on function ui.documentos() to authenticated;
grant execute on function ui.dotacion(p_al date, p_anio integer) to authenticated;
grant execute on function ui.dotacion_base(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.escenarios() to authenticated;
grant execute on function ui.escenarios_procesos() to authenticated;
grant execute on function ui.etiqueta(p_tipo text, p_clave text) to authenticated;
grant execute on function ui.fuente_legible(p text) to authenticated;
grant execute on function ui.historial_documentos() to authenticated;
grant execute on function ui.historial_org() to authenticated;
grant execute on function ui.historial_procesos() to authenticated;
grant execute on function ui.m_brecha_cambiaria(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_documentos_en_conciliacion(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_documentos_inventario(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_documentos_vigentes(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_dotacion_aprobada(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_dotacion_en_requisicion(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_dotacion_ocupada(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_dotacion_por_encima(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_dotacion_vacantes(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_mis_requisiciones(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_mis_tareas(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_por_decidir(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_procesos_catalogo(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_procesos_con_dueno(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_procesos_con_ficha(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_procesos_en_revision(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_procesos_sin_documentar(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_procesos_validados(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_requisiciones_abiertas(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_tasa_bcv_eur(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_tasa_bcv_usd(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.m_tasa_paralelo(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.metrica(p_clave text, p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.metricas(p_claves text[], p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.parametros_costo(p_fecha date) to authenticated;
grant execute on function ui.personas(p_al date) to authenticated;
grant execute on function ui.plano(p text) to authenticated;
grant execute on function ui.plazas(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.procesos(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.procesos_base(p_al date, p_escenario uuid) to authenticated;
grant execute on function ui.recientes(p_limite integer) to authenticated;
grant execute on function ui.registrar_reciente(p_tipo text, p_id uuid, p_titulo text, p_detalle text) to authenticated;
grant execute on function ui.requisiciones() to authenticated;
grant execute on function ui.tasa_estado(p_fecha_valor date, p_al date) to authenticated;
grant execute on function ui.ultimo_cambio(p_esquema text, p_tablas text[]) to authenticated;
grant execute on function ui.validacion_procesos() to authenticated;
grant execute on function control.historial_tasas() to authenticated;
grant execute on all functions in schema org to service_role;
grant execute on all functions in schema sgc to service_role;
grant execute on all functions in schema flujo to service_role;
grant execute on all functions in schema control to service_role;
grant execute on all functions in schema ui to service_role;
grant execute on all functions in schema nucleo to service_role;
grant execute on all functions in schema ia to service_role;
alter default privileges in schema org revoke execute on functions from public;
alter default privileges in schema sgc revoke execute on functions from public;
alter default privileges in schema flujo revoke execute on functions from public;
alter default privileges in schema control revoke execute on functions from public;
alter default privileges in schema ui revoke execute on functions from public;
alter default privileges in schema nucleo revoke execute on functions from public;
alter default privileges in schema ia revoke execute on functions from public;
grant execute on function ia.motivo_bloqueo(p_codigo text) to authenticated;
