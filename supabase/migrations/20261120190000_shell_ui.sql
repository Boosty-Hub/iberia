-- =============================================================================
-- PLATAFORMA IBERIA · R0 · el armazón nuevo (Anexo E §3 y §4)
--
--   1) El esquema `ui`: lo que la interfaz necesita y no es dato de negocio.
--   2) `ui.vista`: las vistas guardadas de `TablaDatos` (personal, compartida,
--      bloqueada), con RLS.
--   3) `ui.buscar()`: la búsqueda de la paleta Ctrl K, sin tildes, con la RLS de
--      quien busca (security invoker: lo que no puede leer no aparece).
--   4) `ui.plazas()`: la fuente de la tabla de plazas (filtrable, ordenable y
--      paginable por PostgREST), con ocupadas y vacantes al día pedido.
--   5) `ui.etiqueta()`: la etiqueta de una clave de catálogo, para pintar.
--   6) El registro de módulos lo lee cualquiera con sesión (es el menú), y se
--      registra FIN-TAS. NUC-FLU pasa a Administración (rutas de aprobación):
--      la bandeja personal vive en «Mi día».
--   7) `control.cargar_tasa_manual()`: el respaldo manual de las tasas, que
--      reemplaza la vigente con motivo (la tabla no se actualiza por la API).
-- =============================================================================

create schema if not exists ui;
grant usage on schema ui to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1) Texto comparable: sin tildes y en minúsculas.
-- -----------------------------------------------------------------------------
create or replace function ui.plano(p text)
returns text language sql stable set search_path = extensions, public as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p, '')));
$$;

-- La etiqueta de una clave de catálogo. Las etiquetas no son reservadas, y la
-- tabla de catálogos solo la lee quien los administra.
create or replace function ui.etiqueta(p_tipo text, p_clave text)
returns text language sql stable security definer set search_path = control, public as $$
  select coalesce((select etiqueta from control.catalogo where tipo = p_tipo and clave = p_clave), p_clave);
$$;
grant execute on function ui.plano(text), ui.etiqueta(text, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Vistas guardadas
-- -----------------------------------------------------------------------------
create table if not exists ui.vista (
  id           uuid primary key default gen_random_uuid(),
  tabla        text not null check (tabla ~ '^[a-z0-9-]+$'),
  modulo       text references control.modulo (codigo) on update cascade on delete set null,
  -- El permiso con el que se lee el módulo: una vista compartida solo le
  -- aparece a quien puede abrirlo. La vista guarda filtros, no datos: lo que
  -- trae lo decide la RLS de quien la abre.
  recurso      text check (recurso is null or recurso ~ '^(modulo|sistema):[a-z0-9-]+$'),
  ruta         text not null check (ruta ~ '^/sistema(/|$)'),
  nombre       text not null check (length(trim(nombre)) between 2 and 80),
  alcance      text not null default 'personal' check (alcance in ('personal', 'compartida', 'bloqueada')),
  parametros   jsonb not null default '{}'::jsonb check (jsonb_typeof(parametros) = 'object'),
  propietario  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  creado_en    timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists vista_tabla_idx on ui.vista (tabla);
create index if not exists vista_propietario_idx on ui.vista (propietario);
alter table ui.vista enable row level security;

grant select, insert, update, delete on ui.vista to authenticated;
grant all on ui.vista to service_role;

create policy "ver las mías y las compartidas" on ui.vista for select to authenticated
  using (propietario = auth.uid()
         or (alcance <> 'personal' and (recurso is null or public.puede(recurso, 'ver'))));
-- Personal: cualquiera. Compartida: quien ve el módulo. Bloqueada: solo administración.
create policy "guardar las mías" on ui.vista for insert to authenticated
  with check (propietario = auth.uid()
              and (alcance = 'personal'
                   or (alcance = 'compartida' and (recurso is null or public.puede(recurso, 'ver')))
                   or (alcance = 'bloqueada' and public.es_admin())));
create policy "editar las mías, las bloqueadas solo administración" on ui.vista for update to authenticated
  using ((propietario = auth.uid() and alcance <> 'bloqueada') or public.es_admin())
  with check ((propietario = auth.uid() and alcance <> 'bloqueada') or public.es_admin());
create policy "borrar las mías, las bloqueadas solo administración" on ui.vista for delete to authenticated
  using ((propietario = auth.uid() and alcance <> 'bloqueada') or public.es_admin());

-- El dueño no cambia, y la fecha de edición la pone la base.
create or replace function ui.vista_proteger()
returns trigger language plpgsql as $$
begin
  if new.propietario is distinct from old.propietario then
    raise exception 'Una vista no cambia de dueño' using errcode = 'insufficient_privilege';
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;
drop trigger if exists vista_proteger on ui.vista;
create trigger vista_proteger before update on ui.vista
  for each row execute function ui.vista_proteger();

-- -----------------------------------------------------------------------------
-- 3) La búsqueda de la paleta (Ctrl K)
--
-- security invoker: cada bloque lee su tabla con la RLS de quien busca, así que
-- sin permiso de estructura no salen unidades, sin perímetro no salen sus
-- documentos, etc. Los módulos salen todos: son el menú.
-- -----------------------------------------------------------------------------
create or replace function ui.buscar(p_q text, p_limite integer default 6)
returns table (tipo text, id text, codigo text, titulo text, detalle text, href text, rango integer)
language sql stable security invoker set search_path = ui, org, sgc, control, public, extensions as $$
  with q as (
    select ui.plano(trim(p_q)) as t, least(greatest(coalesce(p_limite, 6), 1), 20) as n, org.hoy() as hoy
  )
  select * from (
    (select 'modulo'::text, m.codigo, m.codigo, m.nombre, m.dominio,
            coalesce(m.ruta, '/sistema/modulo/' || m.codigo),
            case when ui.plano(m.codigo) like q.t || '%' then 0 else 1 end
       from control.modulo m, q
      where length(q.t) >= 2 and ui.plano(m.codigo || ' ' || m.nombre || ' ' || m.dominio) like '%' || q.t || '%'
      order by 7, m.orden limit (select n from q))
    union all
    (select 'unidad', u.ref::text, u.codigo_organigrama, u.nombre, ui.etiqueta('tipo_unidad', u.tipo),
            '/sistema/nucleo/organizacion/unidades/' || u.ref,
            case when ui.plano(u.nombre) like q.t || '%' then 0 else 1 end
       from org.unidad u, q
      where length(q.t) >= 2 and u.escenario_id is null and u.vigencia @> q.hoy
        and ui.plano(u.nombre || ' ' || coalesce(u.codigo_organigrama, '') || ' ' || u.clave) like '%' || q.t || '%'
      order by 7, u.nombre limit (select n from q))
    union all
    (select 'cargo', c.id::text, null, c.nombre, coalesce(c.familia, 'Cargo'),
            '/sistema/nucleo/organizacion/cargos/' || c.id,
            case when ui.plano(c.nombre) like q.t || '%' then 0 else 1 end
       from org.cargo c, q
      where length(q.t) >= 2 and c.activo
        and ui.plano(c.nombre || ' ' || array_to_string(c.sinonimos, ' ')) like '%' || q.t || '%'
      order by 7, c.nombre limit (select n from q))
    union all
    (select 'plaza', p.ref::text, null, c.nombre,
            coalesce(u.nombre, 'Sin unidad') || ' · dotación ' || p.dotacion,
            '/sistema/nucleo/organizacion/unidades/' || p.unidad_ref,
            case when ui.plano(c.nombre) like q.t || '%' then 0 else 1 end
       from org.plaza p
       join org.cargo c on c.id = p.cargo_id
       cross join q
       left join org.unidad u on u.ref = p.unidad_ref and u.escenario_id is null and u.vigencia @> q.hoy
      where length(q.t) >= 3 and p.escenario_id is null and p.vigencia @> q.hoy
        and ui.plano(c.nombre || ' ' || coalesce(u.nombre, '')) like '%' || q.t || '%'
      order by 7, c.nombre limit (select n from q))
    union all
    (select 'proceso', p.ref::text, coalesce(p.codigo_sgc, p.codigo_informe), p.nombre, 'Nivel ' || p.nivel,
            '/sistema/nucleo/procesos/' || p.ref,
            case when ui.plano(coalesce(p.codigo_sgc, '')) like q.t || '%' then 0
                 when ui.plano(p.nombre) like q.t || '%' then 1 else 2 end
       from sgc.proceso p, q
      where length(q.t) >= 2 and p.escenario_id is null and p.estado = 'vigente'
        and ui.plano(coalesce(p.codigo_sgc, '') || ' ' || coalesce(p.codigo_informe, '') || ' ' || p.nombre) like '%' || q.t || '%'
      order by 7, p.nivel, p.nombre limit (select n from q))
    union all
    (select 'documento', d.id::text, d.codigo, d.titulo, initcap(replace(d.estado, '_', ' ')),
            '/sistema/nucleo/documentos/' || d.id,
            case when ui.plano(d.codigo) like q.t || '%' then 0 else 1 end
       from sgc.documento d, q
      where length(q.t) >= 2
        and ui.plano(d.codigo || ' ' || d.titulo || ' ' || array_to_string(d.alias, ' ')) like '%' || q.t || '%'
      order by 7, d.codigo limit (select n from q))
    union all
    (select 'requisicion', r.id::text, 'N.º ' || r.numero, c.nombre, initcap(replace(r.estado, '_', ' ')),
            '/sistema/nucleo/organizacion/requisiciones/' || r.id,
            case when r.numero::text = q.t then 0 else 1 end
       from org.requisicion r
       join org.cargo c on c.id = r.cargo_id
       cross join q
      where length(q.t) >= 1
        and (r.numero::text = ltrim(q.t, 'n.º# ') or ui.plano(c.nombre || ' ' || r.justificacion) like '%' || q.t || '%')
      order by 7, r.numero desc limit (select n from q))
  ) r(tipo, id, codigo, titulo, detalle, href, rango);
$$;
grant execute on function ui.buscar(text, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Plazas al día pedido, para la tabla (PostgREST filtra, ordena y pagina
--    sobre el resultado). Con la RLS de quien consulta.
-- -----------------------------------------------------------------------------
drop function if exists ui.plazas(date, uuid);
create or replace function ui.plazas(p_al date default null, p_escenario uuid default null)
returns table (
  ref uuid, unidad_ref uuid, unidad text, unidad_tipo text, cargo_id uuid, cargo text, familia text,
  dotacion integer, ocupadas integer, vacantes integer, exceso integer,
  tipo_nomina text, nomina text, sede text, sede_nombre text, estado text, certeza text,
  busqueda text
)
language sql stable security invoker set search_path = ui, org, public as $$
  with d as (select coalesce(p_al, org.hoy()) as dia)
  select p.ref, p.unidad_ref, u.nombre, ui.etiqueta('tipo_unidad', u.tipo), c.id, c.nombre, c.familia,
         p.dotacion, o.n, greatest(p.dotacion - o.n, 0), greatest(o.n - p.dotacion, 0),
         p.tipo_nomina, ui.etiqueta('tipo_nomina', p.tipo_nomina),
         coalesce(p.sede, u.sede), ui.etiqueta('sede', coalesce(p.sede, u.sede)),
         p.estado, p.certeza,
         ui.plano(coalesce(u.nombre, '') || ' ' || c.nombre || ' ' || coalesce(c.familia, ''))
    from org.plaza p
    cross join d
    join org.cargo c on c.id = p.cargo_id
    left join lateral (
      select x.nombre, x.tipo, x.sede from org.unidad x
       where x.ref = p.unidad_ref and x.vigencia @> d.dia
         and (x.escenario_id is null or x.escenario_id = p_escenario)
       order by (x.escenario_id is null) limit 1
    ) u on true
    left join lateral (
      select count(*)::integer as n from org.ocupacion oc
       where oc.plaza_ref = p.ref and oc.tipo = 'titular' and oc.vigencia @> d.dia
    ) o on true
   where p.vigencia @> d.dia
     and (p.escenario_id is null and (p_escenario is null
            or not exists (select 1 from org.plaza e where e.ref = p.ref and e.escenario_id = p_escenario and e.vigencia @> d.dia))
          or p.escenario_id = p_escenario);
$$;
grant execute on function ui.plazas(date, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) El registro de módulos es el menú: lo lee cualquiera con sesión. Las
--    políticas se suman con OR; la de «ver con permiso» queda.
-- -----------------------------------------------------------------------------
drop policy if exists "leer el registro de módulos" on control.modulo;
create policy "leer el registro de módulos" on control.modulo for select to authenticated using (true);

insert into control.modulo (codigo, nombre, dominio, fase, estado, ruta, recurso, descripcion, orden) values
  ('FIN-TAS', 'Tasas de cambio', 'Finanzas', 'R0 (barra y pantalla) → F2 (multimoneda)', 'en_construccion',
   '/sistema/finanzas/tasas', 'sistema:tasas',
   'BCV dólar y euro con fecha valor, paralelo y brecha (uso interno). Contabilidad y facturas usan solo la oficial.', 39)
on conflict (codigo) do update set
  nombre = excluded.nombre, estado = excluded.estado, ruta = excluded.ruta, recurso = excluded.recurso,
  descripcion = excluded.descripcion, fase = excluded.fase;

-- Las rutas de aprobación se administran; la bandeja personal es de «Mi día».
update control.modulo set ruta = '/sistema/administracion/aprobaciones', recurso = 'sistema:aprobaciones'
 where codigo = 'NUC-FLU' and ruta = '/sistema/bandeja';

-- -----------------------------------------------------------------------------
-- 6) Carga manual de una tasa (respaldo). La tabla es de solo inserción y no
--    tiene política de UPDATE: reemplazar la vigente lo hace esta función, con
--    el permiso y el motivo, y deja la nueva enlazada a la que reemplaza.
-- -----------------------------------------------------------------------------
create or replace function control.cargar_tasa_manual(
  p_tipo text, p_moneda text, p_tasa numeric, p_fecha_valor date, p_motivo text
)
returns bigint
language plpgsql security definer set search_path = control, public as $$
declare
  v_ant bigint;
  v_id bigint;
begin
  if not public.puede('sistema:tasas', 'editar') then
    raise exception 'No tienes permiso para cargar tasas' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo = 'paralelo' and not public.puede('sistema:tasas-paralelo', 'ver') then
    raise exception 'No tienes permiso para el paralelo' using errcode = 'insufficient_privilege';
  end if;
  if p_tipo not in ('oficial', 'paralelo') or p_moneda not in ('USD', 'EUR') or (p_tipo = 'paralelo' and p_moneda <> 'USD') then
    raise exception 'Tipo o moneda no válidos' using errcode = 'check_violation';
  end if;
  if p_tasa is null or p_tasa <= 0 then
    raise exception 'La tasa tiene que ser mayor que cero' using errcode = 'check_violation';
  end if;
  if coalesce(length(trim(p_motivo)), 0) < 5 then
    raise exception 'El motivo es obligatorio' using errcode = 'check_violation';
  end if;
  if p_fecha_valor is null or p_fecha_valor > org.hoy() + 7 then
    raise exception 'La fecha valor no puede estar a más de una semana' using errcode = 'check_violation';
  end if;

  if p_tipo = 'oficial' then
    select id into v_ant from control.tasa_cambio
     where tipo = 'oficial' and moneda = p_moneda and fecha_valor = p_fecha_valor and estado = 'vigente'
     for update;
    if v_ant is not null then
      update control.tasa_cambio set estado = 'reemplazada' where id = v_ant;
    end if;
  end if;

  insert into control.tasa_cambio (tipo, fuente, moneda, lado, tasa, fecha_valor, publicada_en, metodo,
                                   estado, reemplaza_id, motivo, creado_por)
  values (p_tipo, 'manual', p_moneda, 'venta', round(p_tasa, 8), p_fecha_valor, now(), 'manual',
          'vigente', v_ant, trim(p_motivo), auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function control.cargar_tasa_manual(text, text, numeric, date, text) from public;
grant execute on function control.cargar_tasa_manual(text, text, numeric, date, text) to authenticated;

comment on schema ui is 'Lo que la interfaz necesita y no es dato de negocio: vistas guardadas, búsqueda y fuentes de tablas.';
