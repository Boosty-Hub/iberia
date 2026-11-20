-- =============================================================================
-- PLATAFORMA IBERIA · Privacidad del programa (20-nov-2026)
--
-- Cierra lo que quedó abierto después de `seguimiento_privacidad`, antes de que
-- ~200 personas de planta tengan cuenta:
--
--   1) FILAS. `entrevistas`, `sesion_participantes` y `archivos` (y los binarios
--      del bucket `archivos`) los leía cualquier sesión. Ahora el equipo editor o
--      la casilla de su módulo: `modulo:entrevistas` · ver (sesiones y
--      participantes) y `modulo:archivos` · ver (expediente y bucket).
--   2) COLUMNAS «solo Boosty». `entrevistas.notas_consultor` y `fireflies_url`
--      (y `busqueda`, que indexa las notas) dejan de salir por la API; el equipo
--      los lee por `entrevistas_internas()`. `personas.email`, `telefono` y
--      `notas` no los lee ninguna pantalla: ya no salen. `certificados.cedula`
--      sale por `cedulas_certificados()`: a su dueño, al equipo editor y a quien
--      además de `modulo:certificados` · ver tiene `modulo:empleados` · editar.
--   3) CIFRAS. Lo que contaba sesiones con la sesión de quien lee sigue dando la
--      cifra a quien la ve, con funciones que cuentan (no que devuelven filas):
--      `cuenta_entrevistas()` (portada del informe), `hallazgos_por_estado()`
--      (sesión y su ficha), `sesiones_linea()` (línea de tiempo de Consumos),
--      `ui.m_programa_sesiones` (corre como dueña y pide la casilla), y las vistas
--      `ui.programa_entrevistas` / `ui.programa_archivos` corren como su dueña con
--      la casilla adentro.
-- Funciones security definer: search_path fijo, EXECUTE revocado de PUBLIC y anon.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) FILAS: la casilla del módulo o el equipo
-- -----------------------------------------------------------------------------
drop policy if exists "entrevistas legibles con sesion" on public.entrevistas;
drop policy if exists "entrevistas con la casilla" on public.entrevistas;
create policy "entrevistas con la casilla" on public.entrevistas
  for select to authenticated
  using ((select public.es_editor()) or (select public.puede('modulo:entrevistas', 'ver')));

drop policy if exists "participantes legibles con sesion" on public.sesion_participantes;
drop policy if exists "participantes con la casilla" on public.sesion_participantes;
create policy "participantes con la casilla" on public.sesion_participantes
  for select to authenticated
  using ((select public.es_editor()) or (select public.puede('modulo:entrevistas', 'ver')));

drop policy if exists "archivos legibles con sesion" on public.archivos;
drop policy if exists "archivos con la casilla" on public.archivos;
create policy "archivos con la casilla" on public.archivos
  for select to authenticated
  using ((select public.es_editor()) or (select public.puede('modulo:archivos', 'ver')));

drop policy if exists "archivos storage: lectura con sesion" on storage.objects;
drop policy if exists "archivos storage: lectura con la casilla" on storage.objects;
create policy "archivos storage: lectura con la casilla" on storage.objects
  for select to authenticated
  using (bucket_id = 'archivos' and ((select public.es_editor()) or (select public.puede('modulo:archivos', 'ver'))));

-- -----------------------------------------------------------------------------
-- 2) COLUMNAS «solo Boosty»
-- -----------------------------------------------------------------------------
revoke select on public.entrevistas from anon, authenticated;
grant select (id, codigo, entrevistado_nombre, entrevistado_cargo, area_id, sede, fecha_entrevista, duracion_minutos,
              entrevistador, estado, resumen, fireflies_meta, created_by, created_at, updated_at, tipo, titulo, entrevistado_id)
  on public.entrevistas to authenticated;

create or replace function public.entrevistas_internas(p_ids uuid[])
returns table (id uuid, notas_consultor text, fireflies_url text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.notas_consultor, e.fireflies_url
    from public.entrevistas e
   where public.es_editor() and e.id = any (p_ids);
$$;
revoke execute on function public.entrevistas_internas(uuid[]) from public, anon;
grant execute on function public.entrevistas_internas(uuid[]) to authenticated, service_role;
comment on function public.entrevistas_internas(uuid[]) is
  'Notas del consultor y enlace de Fireflies: solo el equipo editor. La tabla ya no los sirve por la API.';

revoke select on public.personas from anon, authenticated;
grant select (id, nombre_completo, cargo, area_id, organizacion, sede, es_lider_programa, created_at, updated_at, busqueda)
  on public.personas to authenticated;

revoke select on public.certificados from anon, authenticated;
grant select (id, matricula_id, codigo, nombre_completo, cargo, area_nombre, emitido_en, entregado_en, created_at, ficha)
  on public.certificados to authenticated;

create or replace function public.cedulas_certificados(p_ids uuid[])
returns table (id uuid, cedula text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.cedula
    from public.certificados c
   where c.id = any (p_ids)
     and (public.matricula_mia(c.matricula_id)
          or public.es_editor()
          or (public.puede('modulo:certificados', 'ver') and public.puede('modulo:empleados', 'editar')));
$$;
revoke execute on function public.cedulas_certificados(uuid[]) from public, anon;
grant execute on function public.cedulas_certificados(uuid[]) to authenticated, service_role;
comment on function public.cedulas_certificados(uuid[]) is
  'La cédula congelada en el certificado: a su dueño, al equipo editor y a modulo:certificados·ver + modulo:empleados·editar.';

-- -----------------------------------------------------------------------------
-- 3) CIFRAS que siguen saliendo a quien las ve
-- -----------------------------------------------------------------------------
-- Portada del informe: las entrevistas (tipo «entrevista»), como antes.
create or replace function public.cuenta_entrevistas()
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.entrevistas where tipo = 'entrevista';
$$;
revoke execute on function public.cuenta_entrevistas() from public, anon;
grant execute on function public.cuenta_entrevistas() to authenticated;

-- Hallazgos de una sesión: los validados a quien abre la sesión; propuestos y
-- descartados, solo al equipo.
create or replace function public.hallazgos_por_estado(p_entrevista uuid)
returns table (estado text, n integer)
language sql stable security definer set search_path = '' as $$
  select h.estado, count(*)::integer
    from public.hallazgos h
   where h.entrevista_id = p_entrevista
     and (public.es_editor() or (h.estado = 'validado' and public.puede('modulo:entrevistas', 'ver')))
   group by h.estado;
$$;
revoke execute on function public.hallazgos_por_estado(uuid) from public, anon;
grant execute on function public.hallazgos_por_estado(uuid) to authenticated;

-- Línea de tiempo de Consumos (`modulo:programa`): las sesiones con sus datos de
-- calendario, también para quien no abre las entrevistas. Sin resumen ni notas.
create or replace function public.sesiones_linea()
returns table (id uuid, fecha date, titulo text, descripcion text, tipo text, estado text, duracion_minutos integer)
language sql stable security definer set search_path = '' as $$
  select e.id, e.fecha_entrevista, coalesce(e.titulo, e.entrevistado_nombre, e.codigo), e.entrevistado_cargo, e.tipo, e.estado,
         e.duracion_minutos
    from public.entrevistas e
   where e.fecha_entrevista is not null
     and (public.es_editor() or public.puede('modulo:programa', 'ver') or public.puede('modulo:entrevistas', 'ver'));
$$;
revoke execute on function public.sesiones_linea() from public, anon;
grant execute on function public.sesiones_linea() to authenticated;

create or replace view public.linea_de_tiempo with (security_invoker = on) as
select 'hito'::text as origen, h.id, h.fecha, h.titulo, h.descripcion, h.tipo, h.entregable, h.estado,
       null::integer as duracion_minutos
  from public.hitos h
union all
select 'sesion'::text as origen, s.id, s.fecha, s.titulo, s.descripcion, s.tipo,
       case when s.tipo = 'formacion' then 'formacion' else 'levantamiento' end as entregable,
       case when s.estado = 'programada' then 'previsto' else 'hecho' end as estado,
       s.duracion_minutos
  from public.sesiones_linea() s;

-- La métrica de Consumos corre como dueña y pide su casilla (como las del canal).
create or replace function ui.m_programa_sesiones(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamp with time zone)
language plpgsql stable security definer set search_path = ui, public as $$
begin
  if not (public.es_editor() or public.puede('modulo:programa', 'ver')) then
    raise exception 'Sin permiso para ver las sesiones del programa' using errcode = 'insufficient_privilege';
  end if;
  return query
  with p as (select coalesce(p_al, org.hoy()) as al),
  s as (select e.* from public.entrevistas e, p where e.fecha_entrevista is not null and e.fecha_entrevista <= p.al)
  select (select count(*) from s where s.estado <> 'programada')::numeric,
         (select count(*) from public.entrevistas e where e.fecha_entrevista is not null)::numeric,
         jsonb_build_object(
           'ent', (select count(*) from s where s.estado <> 'programada' and s.codigo like 'ENT-%'),
           'ses', (select count(*) from s where s.estado <> 'programada' and s.codigo like 'SES-%'),
           'for', (select count(*) from s where s.estado <> 'programada' and s.codigo like 'FOR-%'),
           'programadas', (select count(*) from public.entrevistas e where e.estado = 'programada'),
           'actualizado_en', (select max(e.updated_at) from public.entrevistas e)),
         now();
end;
$$;
revoke execute on function ui.m_programa_sesiones(date, uuid) from public, anon;
grant execute on function ui.m_programa_sesiones(date, uuid) to authenticated;

-- Las tablas del levantamiento: corren como su dueña y la casilla va adentro
-- (ya estaba en su WHERE). Así cuentan participantes, transcripción y hallazgos
-- validados aunque esas tablas estén cerradas, y nunca exponen las notas.
alter view ui.programa_entrevistas set (security_invoker = false, security_barrier = true);
alter view ui.programa_archivos set (security_invoker = false, security_barrier = true);
