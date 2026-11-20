-- =============================================================================
-- PLATAFORMA IBERIA · Seguimiento del hotfix: privacidad del padrón y huecos
-- que dejó la integración del programa (20-nov-2026)
--
-- 🔴 Tiene que salir a producción ANTES de mandar los enlaces a la planta.
--
--   1) EL PADRÓN. «directorio visible» (= activo) dejaba a cualquier sesión leer
--      cédula, teléfono y correo de las ~300 fichas. La RLS decide filas, no
--      columnas, así que se cierra con PRIVILEGIOS DE COLUMNA: `authenticated`
--      pierde el SELECT de la tabla entera y lo recupera solo sobre las columnas
--      del directorio (nombre, cargo, área, foto y lo que la app necesita para
--      funcionar: nivel, sede, ficha, oficio, banderas del canal). Cédula,
--      teléfono, correo, fecha de ingreso y tipo de nómina ya no salen por la
--      API —ni en `select=*`, ni en un filtro, ni en un orden, ni embebidas—.
--      Escribir no cambia (las políticas y el trigger de columnas siguen igual),
--      y tampoco la clave de servicio, las vistas que corren como su dueña
--      (`padron_estado`) ni las funciones `security definer`.
--      El dato de contacto se lee por `public.contacto_empleados(p_ids)`:
--        · cada quien, lo suyo;
--        · todo, el equipo editor y quien tenga `modulo:empleados` · editar
--          (Capital Humano);
--        · el teléfono, también `modulo:recordatorios` · editar (el empujón lo
--          manda por WhatsApp; hoy ya lo leía).
--      `recordatorios_pendientes` (security_invoker) toma el teléfono de ahí.
--   2) LAS PERSONAS DEL LEVANTAMIENTO (`personas`: correo, teléfono y las notas
--      del consultor sobre cada entrevistado) también las leía cualquier sesión.
--      Ahora el equipo y quien tiene `modulo:entrevistas` · ver, que es donde la
--      app las enseña.
--   3) LA PORTADA DEL INFORME contaba «hallazgos validados» con la sesión de quien
--      lee; tras el hotfix un lector veía 0. `public.hallazgos_validados()` da
--      solo la cuenta.
--   4) LA LÍNEA DE TIEMPO de las fichas del programa: `entrevista` (modulo:
--      entrevistas · ver), `archivo` (modulo:archivos · ver) y `actividad`
--      (modulo:calendario · ver; su id es `calendario_actividades.ref`). Con eso
--      comentarios, menciones, seguimiento, tareas y recientes funcionan ahí.
--   5) CTRL K busca sesiones (código, título, fecha) con la casilla de
--      entrevistas. Nunca el texto de la transcripción ni las notas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) EMPLEADOS: el dato de contacto deja de salir por la API
-- -----------------------------------------------------------------------------
revoke select on public.empleados from anon, authenticated;
grant select (id, ficha, nombre_completo, cargo, area_id, sede, nivel, familia_oficio, foto_url, activo,
              perfil_id, puede_publicar, es_moderador, created_at, updated_at, busqueda)
  on public.empleados to authenticated;

-- El acceso al contacto: una sola puerta, que pregunta adentro.
create or replace function public.contacto_empleados(p_ids uuid[] default null)
returns table (empleado_id uuid, cedula text, telefono text, email text)
language sql stable security definer set search_path = '' as $$
  with k as (
    select auth.uid() as yo,
           public.es_editor() or public.puede('modulo:empleados', 'editar') as completo,
           public.puede('modulo:recordatorios', 'editar') as telefonos
  )
  select e.id,
         case when k.completo or e.perfil_id = k.yo then e.cedula end,
         case when k.completo or k.telefonos or e.perfil_id = k.yo then e.telefono end,
         case when k.completo or e.perfil_id = k.yo then e.email end
    from public.empleados e cross join k
   where (p_ids is null or e.id = any (p_ids))
     and (k.completo or k.telefonos or (k.yo is not null and e.perfil_id = k.yo));
$$;
revoke execute on function public.contacto_empleados(uuid[]) from public, anon;
grant execute on function public.contacto_empleados(uuid[]) to authenticated, service_role;
comment on function public.contacto_empleados(uuid[]) is
  'Cédula, teléfono y correo del padrón: lo propio a cada quien; todo al equipo editor y a modulo:empleados·editar; el teléfono también a modulo:recordatorios·editar. La tabla ya no los sirve por la API.';

-- El empujón: misma vista (security_invoker), el teléfono por la puerta nueva.
create or replace view public.recordatorios_pendientes with (security_invoker = on) as
select m.id as matricula_id,
       m.curso_id,
       e.id as empleado_id,
       e.nombre_completo,
       m.nombre_corto,
       c.telefono,
       e.cargo,
       a.nombre as area_nombre,
       m.familia_oficio,
       m.estado,
       coalesce(m.ultimo_toque, m.created_at) as callado_desde,
       (extract(day from (now() - coalesce(m.ultimo_toque, m.created_at))))::integer as dias,
       (select count(*) from public.avances av
         where av.matricula_id = m.id and av.estado = 'completada') as lecciones_hechas,
       (select max(r.escalon) from public.recordatorios r
         where r.matricula_id = m.id and r.estado <> 'fallido') as ultimo_escalon
  from public.matriculas m
  join public.empleados e on e.id = m.empleado_id
  left join public.areas a on a.id = e.area_id
  join public.cursos cu on cu.id = m.curso_id
  left join public.contacto_empleados(null) c on c.empleado_id = e.id
 where m.estado <> 'completado' and e.activo and cu.abierto;

-- -----------------------------------------------------------------------------
-- 2) PERSONAS DEL LEVANTAMIENTO: solo quien abre las entrevistas
-- -----------------------------------------------------------------------------
drop policy if exists "personas legibles con sesion" on public.personas;
drop policy if exists "personas con la casilla de entrevistas" on public.personas;
create policy "personas con la casilla de entrevistas" on public.personas
  for select to authenticated
  using ((select public.es_editor()) or (select public.puede('modulo:entrevistas', 'ver')));

-- -----------------------------------------------------------------------------
-- 3) PORTADA DEL INFORME: la cuenta de hallazgos validados, sin abrir la tabla
-- -----------------------------------------------------------------------------
create or replace function public.hallazgos_validados()
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.hallazgos where estado = 'validado';
$$;
revoke execute on function public.hallazgos_validados() from public, anon;
grant execute on function public.hallazgos_validados() to authenticated;

-- -----------------------------------------------------------------------------
-- 4) LÍNEA DE TIEMPO de entrevista, archivo y actividad
-- -----------------------------------------------------------------------------
alter table nucleo.evento drop constraint if exists evento_objeto_tipo_check;
alter table nucleo.evento add constraint evento_objeto_tipo_check
  check (objeto_tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento',
                         'entrevista', 'archivo', 'actividad'));
alter table nucleo.tarea drop constraint if exists tarea_objeto_tipo_check;
alter table nucleo.tarea add constraint tarea_objeto_tipo_check
  check (objeto_tipo in ('unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento',
                         'entrevista', 'archivo', 'actividad'));
alter table ui.reciente drop constraint if exists reciente_tipo_check;
alter table ui.reciente add constraint reciente_tipo_check
  check (tipo in ('unidad', 'plaza', 'cargo', 'persona', 'proceso', 'documento', 'requisicion', 'escenario',
                  'entrevista', 'archivo', 'actividad'));

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
    -- Programa (PRG): las mismas casillas que abren su módulo y su ficha.
    when 'entrevista' then
      return privado.puede_perfil(p_perfil, 'modulo:entrevistas', 'ver')
         and exists (select 1 from public.entrevistas x where x.id = p_id);
    when 'archivo' then
      return privado.puede_perfil(p_perfil, 'modulo:archivos', 'ver')
         and exists (select 1 from public.archivos x where x.id = p_id);
    when 'actividad' then
      return privado.puede_perfil(p_perfil, 'modulo:calendario', 'ver')
         and exists (select 1 from public.calendario_actividades x where x.ref = p_id);
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
    when 'entrevista' then (select x.codigo || ' · ' || coalesce(nullif(btrim(x.titulo), ''), nullif(btrim(x.entrevistado_nombre), ''), 'Sesión')
                              from public.entrevistas x where x.id = p_id)
    when 'archivo' then (select x.nombre from public.archivos x where x.id = p_id)
    when 'actividad' then (select x.titulo from public.calendario_actividades x where x.ref = p_id)
  end, 'un objeto');
$$;

create or replace function ui.registrar_reciente(p_tipo text, p_id uuid, p_titulo text, p_detalle text default null)
returns void language plpgsql security definer set search_path = ui, nucleo, public as $$
begin
  if auth.uid() is null or p_tipo not in ('unidad', 'plaza', 'cargo', 'persona', 'proceso', 'documento', 'requisicion', 'escenario',
                                          'entrevista', 'archivo', 'actividad') then
    return;
  end if;
  if not nucleo.puede_ver_objeto(p_tipo, p_id) then
    return;
  end if;
  insert into ui.reciente (perfil, tipo, objeto_id, titulo, detalle, abierto_en)
  values (auth.uid(), p_tipo, p_id, left(coalesce(nullif(btrim(p_titulo), ''), '(sin título)'), 200), left(p_detalle, 200), now())
  on conflict (perfil, tipo, objeto_id) do update set titulo = excluded.titulo, detalle = excluded.detalle, abierto_en = now();
  delete from ui.reciente r
   where r.perfil = auth.uid()
     and (r.tipo, r.objeto_id) not in (select x.tipo, x.objeto_id from ui.reciente x where x.perfil = auth.uid()
                                        order by x.abierto_en desc limit 20);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5) CTRL K: las sesiones del levantamiento (código, título, fecha)
-- -----------------------------------------------------------------------------
create or replace function ui.buscar(p_q text, p_limite integer default 6, p_tipo text default null, p_desde integer default 0)
returns table (tipo text, id text, codigo text, titulo text, detalle text, href text, rango integer, total integer)
language sql stable set search_path = ui, org, sgc, control, public, extensions as $$
  with q as (
    select ui.plano(btrim(p_q)) as t,
           least(greatest(coalesce(p_limite, 6), 1), 50) as n,
           greatest(coalesce(p_desde, 0), 0) as desde,
           org.hoy() as hoy,
           -- «N.º 12», «#12», «req 12»: el número de una requisición.
           nullif(substring(ui.plano(btrim(p_q)) from '^(?:n\.?\s*º?|#|req\.?\s*)?\s*(\d{1,7})$'), '') as num
  )
  select * from (
    (select 'modulo'::text, m.codigo, m.codigo, m.nombre, m.dominio,
            coalesce(m.ruta, '/sistema/modulo/' || m.codigo),
            case when ui.plano(m.codigo) like q.t || '%' then 0 when ui.plano(m.nombre) like q.t || '%' then 1 else 2 end,
            (count(*) over ())::int
       from control.modulo m, q
      where (p_tipo is null or p_tipo = 'modulo') and length(q.t) >= 2
        and ui.plano(m.codigo || ' ' || m.nombre || ' ' || m.dominio) like '%' || q.t || '%'
      order by 7, m.orden offset (select desde from q) limit (select n from q))
    union all
    (select 'unidad', u.ref::text, u.codigo_organigrama, u.nombre, ui.etiqueta('tipo_unidad', u.tipo),
            '/sistema/nucleo/organizacion/unidades/' || u.ref,
            case when ui.plano(u.nombre) like q.t || '%' then 0 else 1 end,
            (count(*) over ())::int
       from org.unidad u, q
      where (p_tipo is null or p_tipo = 'unidad') and length(q.t) >= 2 and u.escenario_id is null and u.vigencia @> q.hoy
        and ui.plano(u.nombre || ' ' || coalesce(u.codigo_organigrama, '') || ' ' || u.clave) like '%' || q.t || '%'
      order by 7, u.nombre offset (select desde from q) limit (select n from q))
    union all
    (select 'plaza', p.ref::text, null, c.nombre,
            coalesce(u.nombre, 'Sin unidad') || ' · dotación ' || p.dotacion,
            '/sistema/nucleo/organizacion/plazas?ficha=plaza:' || p.ref,
            case when ui.plano(c.nombre) like q.t || '%' then 0 else 1 end,
            (count(*) over ())::int
       from org.plaza p
       join org.cargo c on c.id = p.cargo_id
       cross join q
       left join org.unidad u on u.ref = p.unidad_ref and u.escenario_id is null and u.vigencia @> q.hoy
      where (p_tipo is null or p_tipo = 'plaza') and length(q.t) >= 2 and p.escenario_id is null and p.vigencia @> q.hoy
        and ui.plano(c.nombre || ' ' || coalesce(u.nombre, '')) like '%' || q.t || '%'
      order by 7, c.nombre, u.nombre offset (select desde from q) limit (select n from q))
    union all
    (select 'cargo', c.id::text, null, c.nombre, coalesce(c.familia, 'Cargo'),
            '/sistema/nucleo/organizacion/cargos/' || c.id,
            case when ui.plano(c.nombre) like q.t || '%' then 0 else 1 end,
            (count(*) over ())::int
       from org.cargo c, q
      where (p_tipo is null or p_tipo = 'cargo') and length(q.t) >= 2 and c.activo
        and ui.plano(c.nombre || ' ' || array_to_string(c.sinonimos, ' ')) like '%' || q.t || '%'
      order by 7, c.nombre offset (select desde from q) limit (select n from q))
    union all
    -- Personas: solo por el nombre, y solo quien ocupa una plaza hoy (la ocupación
    -- pide `sistema:estructura`). Nada de cédula, teléfono ni correo.
    (select 'persona', x.id::text, null, x.nombre, x.cargo,
            '/sistema/nucleo/organizacion/personas?ficha=persona:' || x.id,
            x.rango, (count(*) over ())::int
       from (
         select distinct on (e.id) e.id, e.nombre_completo as nombre, c.nombre as cargo,
                case when ui.plano(e.nombre_completo) like q.t || '%' then 0 else 1 end as rango
           from org.ocupacion o
           join public.empleados e on e.id = o.empleado_id
           join org.plaza p on p.ref = o.plaza_ref and p.escenario_id is null
           join org.cargo c on c.id = p.cargo_id
           cross join q
          where (p_tipo is null or p_tipo = 'persona') and length(q.t) >= 3
            and o.vigencia @> q.hoy and p.vigencia @> q.hoy
            and ui.plano(e.nombre_completo) like '%' || q.t || '%'
          order by e.id, (o.tipo = 'titular') desc
       ) x
      order by x.rango, x.nombre offset (select desde from q) limit (select n from q))
    union all
    (select 'proceso', p.ref::text, coalesce(p.codigo_sgc, p.codigo_informe), p.nombre,
            (array['Macroproceso', 'Proceso', 'Subproceso', 'Actividad'])[p.nivel + 1],
            '/sistema/nucleo/procesos/' || p.ref,
            case when ui.plano(coalesce(p.codigo_sgc, '')) like q.t || '%' or ui.plano(coalesce(p.codigo_informe, '')) like q.t || '%' then 0
                 when ui.plano(p.nombre) like q.t || '%' then 1 else 2 end,
            (count(*) over ())::int
       from sgc.proceso p, q
      where (p_tipo is null or p_tipo = 'proceso') and length(q.t) >= 2 and p.escenario_id is null and p.estado = 'vigente'
        and ui.plano(coalesce(p.codigo_sgc, '') || ' ' || coalesce(p.codigo_informe, '') || ' ' || p.nombre) like '%' || q.t || '%'
      order by 7, p.nivel, p.nombre offset (select desde from q) limit (select n from q))
    union all
    (select 'documento', d.id::text, d.codigo, d.titulo, initcap(replace(d.estado, '_', ' ')),
            '/sistema/nucleo/documentos/' || d.id,
            case when ui.plano(d.codigo) like q.t || '%' then 0
                 when ui.plano(array_to_string(d.alias, ' ')) like '%' || q.t || '%' then 1 else 2 end,
            (count(*) over ())::int
       from sgc.documento d, q
      where (p_tipo is null or p_tipo = 'documento') and length(q.t) >= 2
        and ui.plano(d.codigo || ' ' || d.titulo || ' ' || array_to_string(d.alias, ' ')) like '%' || q.t || '%'
      order by 7, (d.estado = 'vigente') desc, d.codigo offset (select desde from q) limit (select n from q))
    union all
    (select 'requisicion', r.id::text, 'N.º ' || r.numero, c.nombre, initcap(replace(r.estado, '_', ' ')),
            '/sistema/nucleo/organizacion/requisiciones/' || r.id,
            case when r.numero::text = q.num then 0 else 1 end,
            (count(*) over ())::int
       from org.requisicion r
       join org.cargo c on c.id = r.cargo_id
       cross join q
      where (p_tipo is null or p_tipo = 'requisicion') and length(q.t) >= 1
        and (r.numero::text = q.num or (length(q.t) >= 3 and ui.plano(c.nombre || ' ' || coalesce(r.justificacion, '')) like '%' || q.t || '%'))
      order by 7, r.numero desc offset (select desde from q) limit (select n from q))
    union all
    (select 'escenario', e.id::text, null, e.nombre,
            (case e.alcance when 'procesos' then 'Escenario de procesos' else 'Escenario de estructura' end) || ' · ' || replace(e.estado, '_', ' '),
            case e.alcance when 'procesos' then '/sistema/nucleo/procesos/escenarios/' else '/sistema/nucleo/escenarios/' end || e.id,
            case when ui.plano(e.nombre) like q.t || '%' then 0 else 1 end,
            (count(*) over ())::int
       from org.escenario e, q
      where (p_tipo is null or p_tipo = 'escenario') and length(q.t) >= 2
        and ui.plano(e.nombre || ' ' || coalesce(e.descripcion, '')) like '%' || q.t || '%'
      order by 7, (e.estado in ('borrador', 'en_aprobacion')) desc, e.creado_en desc offset (select desde from q) limit (select n from q))
    union all
    -- Sesiones del levantamiento: código, título (o entrevistado) y fecha, con la
    -- casilla de entrevistas. Nunca el resumen, las notas ni la transcripción.
    (select 'entrevista', s.id::text, s.codigo,
            coalesce(nullif(btrim(s.titulo), ''), nullif(btrim(s.entrevistado_nombre), ''), s.codigo),
            (case s.tipo when 'entrevista' then 'Entrevista' when 'reunion' then 'Reunión' when 'visita' then 'Visita'
                         when 'taller' then 'Taller' when 'formacion' then 'Formación' else 'Sesión' end)
              || coalesce(' · ' || to_char(s.fecha_entrevista, 'DD/MM/YYYY'), ''),
            '/sistema/programa/levantamiento/entrevistas/' || s.id,
            case when ui.plano(s.codigo) like q.t || '%' then 0
                 when ui.plano(coalesce(s.titulo, '') || ' ' || coalesce(s.entrevistado_nombre, '')) like q.t || '%' then 1 else 2 end,
            (count(*) over ())::int
       from public.entrevistas s, q
      where (p_tipo is null or p_tipo = 'entrevista') and length(q.t) >= 2
        and (select public.puede('modulo:entrevistas', 'ver'))
        and ui.plano(s.codigo || ' ' || coalesce(s.titulo, '') || ' ' || coalesce(s.entrevistado_nombre, '')) like '%' || q.t || '%'
      order by 7, s.fecha_entrevista desc nulls last, s.codigo offset (select desde from q) limit (select n from q))
  ) r(tipo, id, codigo, titulo, detalle, href, rango, total);
$$;
