-- =============================================================================
-- R6 · Endurecer (Anexo E §10)
--
-- Los aprobadores de un cambio de nivel de IA (`nivel_ia`, R4) no recibían el
-- aviso «Te toca decidir»: R3 solo avisa sobre los tipos de objeto que tienen
-- ficha, y `nivel_ia` no la tiene. Ahora:
--   · `privado.puede_ver_objeto_de` conoce `nivel_ia`: lo ve quien gobierna la
--     IA (`sistema:ia` · ver) o quien tiene un paso de esa solicitud.
--   · `privado.titulo_objeto` lo nombra («Nivel de IA · NUC-PRO-IA-01: N1 → N2»).
--   · `nucleo.al_mover_solicitud` avisa también por `nivel_ia`, sin línea de
--     tiempo (un cambio de nivel no es un objeto con ficha: su historia vive en
--     `ia.actividad`), con enlace a la bandeja y, a quien pidió, al Gobierno de IA.
--   · Los pasos de `nivel_ia` que hoy esperan decisión reciben su aviso.
-- `escenario_procesos` ya avisaba (R3 lo lleva a «escenario»): no cambia.
-- La RLS no cambia.
-- =============================================================================

create or replace function privado.puede_ver_objeto_de(p_perfil uuid, p_tipo text, p_id uuid)
returns boolean language plpgsql stable security definer set search_path = org, sgc, flujo, public as $$
begin
  if p_perfil is null or p_id is null
     or not exists (select 1 from public.profiles where id = p_perfil and activo) then
    return false;
  end if;
  case p_tipo
    when 'unidad', 'plaza', 'cargo', 'persona' then
      return privado.puede_perfil(p_perfil, 'sistema:estructura', 'ver');
    when 'proceso' then
      return privado.puede_perfil(p_perfil, 'sistema:procesos', 'ver');
    when 'documento' then
      return privado.puede_perfil(p_perfil, 'sistema:documentos', 'ver')
         and exists (select 1 from sgc.documento d where d.id = p_id
                      and (d.perimetro = 'general' or privado.puede_perfil(p_perfil, 'sistema:perimetros', 'ver')));
    when 'requisicion' then
      return exists (select 1 from org.requisicion r where r.id = p_id
                      and (r.creado_por = p_perfil or privado.puede_perfil(p_perfil, 'sistema:requisiciones', 'ver')))
          or exists (select 1 from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
                      where s.objeto_id = p_id and p.aprobador_perfil = p_perfil);
    when 'escenario' then
      return privado.puede_perfil(p_perfil, 'sistema:escenarios', 'ver')
          or exists (select 1 from org.escenario e where e.id = p_id and e.creado_por = p_perfil)
          or exists (select 1 from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
                      where s.objeto_id = p_id and p.aprobador_perfil = p_perfil);
    when 'nivel_ia' then
      return privado.puede_perfil(p_perfil, 'sistema:ia', 'ver')
          or exists (select 1 from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
                      where s.tipo_objeto = 'nivel_ia' and s.objeto_id = p_id and p.aprobador_perfil = p_perfil);
    else
      return false;
  end case;
end;
$$;

create or replace function privado.titulo_objeto(p_tipo text, p_id uuid)
returns text language sql stable security definer set search_path = org, sgc, public as $$
  select coalesce(case p_tipo
    when 'unidad' then (select u.nombre from org.unidad u where u.ref = p_id and u.escenario_id is null
                         order by upper_inf(u.vigencia) desc, lower(u.vigencia) desc limit 1)
    when 'plaza' then (select c.nombre || coalesce(' · ' || u.nombre, '')
                         from org.plaza p join org.cargo c on c.id = p.cargo_id
                         left join lateral (select x.nombre from org.unidad x where x.ref = p.unidad_ref and x.escenario_id is null
                                             order by upper_inf(x.vigencia) desc, lower(x.vigencia) desc limit 1) u on true
                        where p.ref = p_id and p.escenario_id is null
                        order by upper_inf(p.vigencia) desc, lower(p.vigencia) desc limit 1)
    when 'cargo' then (select nombre from org.cargo where id = p_id)
    when 'persona' then (select nombre_completo from public.empleados where id = p_id)
    when 'requisicion' then (select 'Requisición N.º ' || numero from org.requisicion where id = p_id)
    when 'escenario' then (select 'Escenario «' || nombre || '»' from org.escenario where id = p_id)
    when 'proceso' then (select coalesce(codigo_sgc || ' · ', '') || nombre from sgc.proceso where ref = p_id and escenario_id is null
                          order by (estado = 'vigente') desc, version desc limit 1)
    when 'documento' then (select codigo || ' · ' || titulo from sgc.documento where id = p_id)
    when 'nivel_ia' then (select format('Nivel de IA · %s: %s → %s', k.capacidad, k.de, k.a) from ia.cambio_nivel k where k.id = p_id)
  end, 'un objeto');
$$;

-- La de R3 (20261120202000), más `nivel_ia`: solo avisos, sin línea de tiempo.
create or replace function nucleo.al_mover_solicitud()
returns trigger language plpgsql security definer set search_path = nucleo, flujo, public as $$
declare
  o record;
  p flujo.paso;
  v_anterior flujo.paso;
  v_con_linea boolean;
  v_enlace_cierre text;
begin
  select * into o from privado.objeto_de_solicitud(new.tipo_objeto, new.objeto_id);
  v_con_linea := o.tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento');
  if not v_con_linea and o.tipo is distinct from 'nivel_ia' then return null; end if;
  -- Lo que no tiene ficha lleva a su pantalla.
  v_enlace_cierre := case when o.tipo = 'nivel_ia' then '/sistema/administracion/ia' end;

  if tg_op = 'INSERT' then
    if v_con_linea then
      insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, datos, creado_en)
      values (o.tipo, o.id, 'aprobacion', new.creado_por,
              jsonb_build_object('accion', 'enviada', 'solicitud_id', new.id, 'titulo', new.titulo, 'pedido_por', new.creado_por,
                                 'resumen', 'se envió a aprobación'),
              new.creado_en);
    end if;
    return null;
  end if;

  -- Lo que avisaba «te toca decidir» sobre este objeto ya no aplica cuando la
  -- solicitud avanza o se cierra: se da por leído (los avisos nuevos van abajo).
  if new.paso_actual is distinct from old.paso_actual or new.estado is distinct from old.estado then
    update nucleo.notificacion set leida_en = now()
     where tipo = 'aprobacion' and enlace = '/sistema/bandeja' and objeto_tipo = o.tipo and objeto_id = o.id and leida_en is null;
  end if;

  -- Un paso se vuelve el actual: avisar a quien puede decidirlo.
  if new.estado = 'en_curso' and new.paso_actual is not null
     and (new.paso_actual is distinct from old.paso_actual or old.estado <> 'en_curso') then
    select * into p from flujo.paso where solicitud_id = new.id and orden = new.paso_actual;
    insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle, enlace)
    select a, 'aprobacion', o.tipo, o.id, new.creado_por,
           format('Te toca decidir «%s»: %s', p.nombre, new.titulo),
           'Pidió ' || coalesce(privado.nombre_perfil(new.creado_por), '—'), '/sistema/bandeja'
      from privado.aprobadores_de_paso(p.id) a;
    -- Y a quien pidió, que avanzó (si no es el primer paso).
    if old.paso_actual is not null and new.paso_actual > old.paso_actual and new.creado_por is not null then
      select * into v_anterior from flujo.paso where solicitud_id = new.id and orden = old.paso_actual;
      insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle, enlace)
      values (new.creado_por, 'aprobacion', o.tipo, o.id, v_anterior.decidido_por,
              format('%s: se aprobó «%s» y pasa a «%s»', new.titulo, v_anterior.nombre, p.nombre),
              nullif(trim(v_anterior.comentario), ''), v_enlace_cierre);
    end if;
  end if;

  -- Se cerró: avisar a quien pidió (salvo que la cierre él mismo).
  if old.estado = 'en_curso' and new.estado <> 'en_curso' then
    if new.creado_por is not null and new.creado_por is distinct from auth.uid() then
      select * into v_anterior from flujo.paso where solicitud_id = new.id and decidido_en is not null
       order by decidido_en desc limit 1;
      insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle, enlace)
      values (new.creado_por, 'aprobacion', o.tipo, o.id, v_anterior.decidido_por,
              format('Tu solicitud «%s» quedó %s', new.titulo,
                     case new.estado when 'aprobada' then 'aprobada' when 'rechazada' then 'rechazada'
                                     when 'devuelta' then 'devuelta para corregir' else 'cancelada' end),
              case when new.estado in ('rechazada', 'devuelta') then nullif(trim(v_anterior.comentario), '') end,
              v_enlace_cierre);
    end if;
    if new.estado = 'cancelada' and v_con_linea then
      insert into nucleo.evento (objeto_tipo, objeto_id, tipo, autor, datos)
      values (o.tipo, o.id, 'aprobacion', auth.uid(),
              jsonb_build_object('accion', 'cancelada', 'solicitud_id', new.id, 'titulo', new.titulo, 'pedido_por', new.creado_por,
                                 'resumen', 'se canceló la solicitud'));
    end if;
  end if;
  return null;
exception when others then
  -- Un aviso que falla no tumba la aprobación (la misma regla de los avisos del canal).
  raise warning 'nucleo.al_mover_solicitud: %', sqlerrm;
  return null;
end;
$$;

-- Lo que ya espera decisión: su aviso, una vez.
insert into nucleo.notificacion (destinatario, tipo, objeto_tipo, objeto_id, actor, texto, detalle, enlace, creado_en)
select a, 'aprobacion', 'nivel_ia', s.objeto_id, s.creado_por,
       format('Te toca decidir «%s»: %s', p.nombre, s.titulo),
       'Pidió ' || coalesce(privado.nombre_perfil(s.creado_por), '—'), '/sistema/bandeja',
       coalesce((select max(q.decidido_en) from flujo.paso q where q.solicitud_id = s.id), s.creado_en)
  from flujo.solicitud s
  join flujo.paso p on p.solicitud_id = s.id and p.orden = s.paso_actual and p.decision = 'pendiente'
  cross join lateral privado.aprobadores_de_paso(p.id) a
 where s.estado = 'en_curso' and s.tipo_objeto = 'nivel_ia'
   and not exists (select 1 from nucleo.notificacion n where n.destinatario = a and n.tipo = 'aprobacion'
                    and n.objeto_tipo = 'nivel_ia' and n.objeto_id = s.objeto_id and n.leida_en is null);
