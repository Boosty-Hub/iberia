-- =============================================================================
-- PLATAFORMA IBERIA · R2 · Procesos y documentos con el diseño data-first
-- (Anexo E §9 y §10 R2)
--
-- La base de la Etapa 1 no cambia: esto suma las FUENTES de las tablas nuevas
-- (todas en `ui`, filtrables, ordenables y paginables por PostgREST) y una tabla
-- pequeña para que la conciliación de documentos sea una cola que se vacía.
--
--   1) `sgc.xx()`: el XX de un código II-XX-…
--   2) `ui.procesos(al, esc)`: el catálogo de cuatro niveles en orden de árbol,
--      con dueño, documentos, ficha, ciclo abierto y las alertas de calidad del
--      dato (dueño vacante, ficha sin indicadores, código dudoso). Suma los
--      procesos nuevos que todavía son borrador. Con la RLS de quien mira.
--   3) `ui.cruce_procesos()`: SGC ↔ informe de la Fase 1, una fila por cruce.
--   4) `ui.escenarios_procesos()`: los escenarios de procesos con sus deltas.
--   5) `ui.validacion_procesos()`: la secuencia de New Iberia por macroproceso
--      («cómo es → mejoras → revisión → proceso optimizado»), de `sgc.proceso`
--      y `flujo` (security definer, con el permiso comprobado adentro).
--   6) `sgc.documento_conciliacion` + `ui.documentos()` +
--      `ui.conciliacion_documentos()`: la biblioteca y su cola (sin determinar,
--      obsoleto, código reutilizado, datos sensibles), con la decisión trazada.
--   7) `ui.historial_procesos()` y `ui.historial_documentos()`: la auditoría de
--      cada módulo, legible y filtrable (security definer: la auditoría la lee
--      quien tiene `sistema:auditoria`, y el perímetro sigue cerrado).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) El XX de un código del SGC: «II-64-11-001» → «64».
-- -----------------------------------------------------------------------------
create or replace function sgc.xx(p text)
returns text language sql immutable set search_path = pg_catalog as $$
  select substring(coalesce(p, '') from '^II-(\d{2})');
$$;
grant execute on function sgc.xx(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 2) El catálogo de procesos
-- -----------------------------------------------------------------------------
drop function if exists ui.procesos(date, uuid);
create or replace function ui.procesos(p_al date default null, p_escenario uuid default null)
returns table (
  ref uuid, nivel smallint, nivel_nombre text, padre_ref uuid, padre text, macro_ref uuid, macro text,
  ruta text, nombre_arbol text, nombre text, tipo text, tipo_nombre text,
  codigo_sgc text, codigo_informe text, codigo text,
  estado_operativo text, estado_operativo_nombre text,
  version integer, ciclo text, ciclo_version integer,
  dueno_plaza_ref uuid, dueno text, dueno_estado text, area text,
  docs_total integer, docs_vigentes integer, tiene_ficha boolean, indicadores integer, salud text,
  codigo_dudoso boolean, motivo_codigo text, dueno_ficha_difiere boolean, con_nota_ficha boolean,
  alerta_vacante boolean, alerta_sin_indicadores boolean,
  diff text, acciones text, busqueda text
)
language sql stable security invoker set search_path = ui, sgc, org, public, extensions as $$
  with recursive par as (
    select coalesce(p_al, org.hoy()) as dia,
           (select e.id from org.escenario e where e.id = p_escenario and e.alcance = 'procesos') as esc
  ),
  l as (select x.* from par, sgc.lienzo(par.dia, par.esc) x),
  -- Lo que el lienzo no trae: la ficha, el área y el padre de la versión que se ve.
  vis as (
    select l.ref, l.nivel, pr.padre_ref, l.nombre, l.tipo, l.codigo_sgc, l.codigo_informe, l.orden,
           l.estado_operativo, l.version, l.tiene_ficha, l.docs_total, l.docs_vigentes,
           l.dueno_plaza_ref, l.dueno, l.dueno_estado, l.salud, l.diff, pr.ficha, pr.area_texto, pr.dueno_texto
      from l cross join par
      join sgc.proceso pr on pr.ref = l.ref and pr.version = l.version
                         and pr.esc = coalesce(par.esc, '00000000-0000-0000-0000-000000000000'::uuid)
    union all
    -- Los procesos nuevos que solo existen como borrador o en revisión (la realidad, hoy).
    select n.ref, n.nivel, n.padre_ref, n.nombre, n.tipo, n.codigo_sgc, n.codigo_informe, n.orden,
           n.estado_operativo, n.version, sgc.ficha_llena(n.ficha), 0, 0,
           n.dueno_plaza_ref,
           coalesce((select concat_ws(' · ', c.nombre, u.nombre)
                       from org.plaza pl
                       left join org.cargo c on c.id = pl.cargo_id
                       left join org.unidad u on u.ref = pl.unidad_ref and u.escenario_id is null and u.vigencia @> par.dia
                      where pl.ref = n.dueno_plaza_ref and pl.escenario_id is null and pl.vigencia @> par.dia limit 1),
                    nullif(btrim(n.dueno_texto), '')),
           case when n.dueno_plaza_ref is not null then 'asignado'
                when nullif(btrim(n.dueno_texto), '') is not null then 'sin_plaza' else 'sin_dueno' end,
           'revision', 'nuevo', n.ficha, n.area_texto, n.dueno_texto
      from sgc.proceso n cross join par
     where par.esc is null and n.escenario_id is null and n.estado in ('borrador', 'en_revision')
       and not exists (select 1 from sgc.proceso v where v.ref = n.ref and v.escenario_id is null
                         and v.estado in ('vigente', 'aprobada', 'reemplazada', 'retirada'))
  ),
  base as (
    select v.*, case when exists (select 1 from vis q where q.ref = v.padre_ref) then v.padre_ref end as padre_vis from vis v
  ),
  num as (
    select b.*,
           lpad(row_number() over (partition by b.padre_vis
                  order by case b.tipo when 'estrategico' then 0 when 'operativo' then 1 when 'soporte' then 2 else 3 end,
                           b.orden, b.nombre)::text, 4, '0') as rn
      from base b
  ),
  -- El orden de lectura del árbol, el macroproceso de cada nodo y el XX heredado.
  arbol as (
    select n.ref, n.rn::text as ruta, n.ref as macro_ref, 0 as prof,
           sgc.xx(n.codigo_sgc) as xx, null::text as xx_padre, null::text as informe_padre
      from num n where n.padre_vis is null
    union all
    select n.ref, a.ruta || '.' || n.rn, a.macro_ref, a.prof + 1,
           coalesce(sgc.xx(n.codigo_sgc), a.xx), a.xx, p.codigo_informe
      from num n
      join arbol a on n.padre_vis = a.ref
      join num p on p.ref = a.ref
     where a.prof < 8
  ),
  rep as (
    select x.codigo_sgc, count(*) as n from vis x where x.codigo_sgc is not null group by x.codigo_sgc
  ),
  abierto as (
    select distinct on (a.ref) a.ref, a.estado, a.version
      from sgc.proceso a
     where a.escenario_id is null and a.estado in ('borrador', 'en_revision', 'aprobada')
     order by a.ref, a.version desc
  ),
  filas as (
    select n.*, a.ruta, a.macro_ref, a.prof, a.xx, a.xx_padre, a.informe_padre,
           ab.estado as ab_estado, ab.version as ab_version,
           nullif(concat_ws('; ',
             case when n.codigo_sgc is not null and n.codigo_sgc !~ '^II-\d{2}(-\d{2}){0,2}(-\d{3})?$' then 'formato no reconocido' end,
             case when coalesce(r.n, 0) > 1 then 'el código se repite en otro proceso' end,
             case when sgc.xx(n.codigo_sgc) is not null and a.xx_padre is not null and sgc.xx(n.codigo_sgc) <> a.xx_padre
                  then format('XX distinto del padre (II-%s)', a.xx_padre) end,
             case when sgc.xx(n.ficha #>> '{origen,codigo}') is not null and a.xx is not null
                       and sgc.xx(n.ficha #>> '{origen,codigo}') <> a.xx
                  then format('la hoja de origen usa %s', n.ficha #>> '{origen,codigo}') end,
             case when n.codigo_informe is not null and a.informe_padre is not null
                       and n.codigo_informe not like a.informe_padre || '.%'
                  then format('el código del informe no cuelga de %s', a.informe_padre) end
           ), '') as motivo,
           case when jsonb_typeof(n.ficha -> 'indicadores') = 'array' then jsonb_array_length(n.ficha -> 'indicadores') else 0 end as n_ind,
           nullif(btrim(coalesce(n.ficha ->> 'dueno_segun_ficha', n.ficha ->> 'dueno')), '') as dueno_ficha
      from num n
      join arbol a on a.ref = n.ref
      left join rep r on r.codigo_sgc = n.codigo_sgc
      left join abierto ab on ab.ref = n.ref
  )
  select f.ref, f.nivel,
         (array['Macroproceso', 'Proceso', 'Subproceso', 'Actividad'])[f.nivel + 1],
         f.padre_ref, (select q.nombre from vis q where q.ref = f.padre_ref limit 1),
         f.macro_ref, (select q.nombre from vis q where q.ref = f.macro_ref limit 1),
         -- La sangría va con espacios largos (U+2003): el navegador no los junta.
         f.ruta, repeat(chr(8195), f.prof * 2) || f.nombre, f.nombre, f.tipo, ui.etiqueta('tipo_proceso', f.tipo),
         f.codigo_sgc, f.codigo_informe, coalesce(f.codigo_sgc, f.codigo_informe),
         f.estado_operativo, ui.etiqueta('estado_operativo', f.estado_operativo),
         f.version,
         case when (select esc from par) is not null then 'escenario'
              else coalesce(f.ab_estado, 'vigente') end,
         f.ab_version,
         f.dueno_plaza_ref, f.dueno, f.dueno_estado, coalesce(nullif(btrim(f.area_texto), '—'), null),
         f.docs_total, f.docs_vigentes, f.tiene_ficha, f.n_ind, f.salud,
         f.motivo is not null, f.motivo,
         f.dueno_ficha is not null and ui.plano(coalesce(f.dueno, '')) not like '%' || ui.plano(f.dueno_ficha) || '%',
         nullif(btrim(coalesce(f.ficha ->> 'nota_ficha', f.ficha ->> 'nota')), '') is not null,
         f.dueno_estado = 'vacante',
         f.tiene_ficha and f.n_ind = 0,
         f.diff,
         case when (select esc from par) is not null then 'ficha'
              else concat_ws(',',
                     case when f.nivel < 3 and f.diff is distinct from 'nuevo' and public.puede('sistema:procesos', 'crear') then 'hijo' end,
                     case when f.nivel > 0 and f.diff is distinct from 'nuevo' and coalesce(f.ab_estado, '') <> 'en_revision'
                               and public.puede('sistema:procesos', 'editar') then 'mover' end,
                     'ficha') end,
         ui.plano(concat_ws(' ', f.codigo_sgc, f.codigo_informe, f.nombre, f.dueno, f.area_texto, f.dueno_texto))
    from filas f;
$$;
comment on function ui.procesos(date, uuid) is
  'El catálogo de procesos para la tabla (R2): cuatro niveles en orden de árbol, con su ciclo, dueño, documentos y alertas.';
grant execute on function ui.procesos(date, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3) El cruce SGC ↔ informe
-- -----------------------------------------------------------------------------
drop function if exists ui.cruce_procesos();
create or replace function ui.cruce_procesos()
returns table (
  id uuid, proceso_ref uuid, codigo_sgc text, proceso text, nivel smallint,
  informe text, informe_codigo text, informe_macro text, informe_estado text, informe_area text,
  tipo text, confirmado boolean, nota text, busqueda text
)
language sql stable security invoker set search_path = ui, sgc, public, extensions as $$
  select c.id, c.proceso_ref, c.codigo_sgc, p.nombre, p.nivel,
         coalesce(ip.nombre, m.nombre),
         case when m.id is null then null
              else concat_ws('.', case m.nivel when 'Estratégico' then '1' when 'Operativo' then '2' when 'Soporte' then '3' else '?' end,
                             m.numero::text, ip.orden::text) end,
         m.nombre, ip.estado, ip.area,
         c.tipo, c.confirmado, c.nota,
         ui.plano(concat_ws(' ', c.codigo_sgc, p.nombre, ip.nombre, m.nombre, c.nota))
    from sgc.proceso_cruce c
    left join sgc.proceso p on p.ref = c.proceso_ref and p.escenario_id is null and p.estado = 'vigente'
    left join public.procesos ip on ip.id = c.informe_proceso_id
    left join public.macroprocesos m on m.id = coalesce(c.informe_macro_id, ip.macroproceso_id);
$$;
grant execute on function ui.cruce_procesos() to authenticated;

-- -----------------------------------------------------------------------------
-- 4) Los escenarios de procesos con sus deltas contra la realidad
-- -----------------------------------------------------------------------------
drop function if exists ui.escenarios_procesos();
create or replace function ui.escenarios_procesos()
returns table (
  id uuid, nombre text, descripcion text, estado text, raiz text, fecha_base date, vigente_desde date,
  creado_en timestamptz, publicado_en timestamptz, altas integer, bajas integer, cambios integer, total integer,
  borradores_abiertos integer, acciones text, busqueda text
)
language sql stable security invoker set search_path = ui, sgc, org, public, extensions as $$
  select e.id, e.nombre, e.descripcion, e.estado,
         coalesce((select p.nombre from sgc.proceso p where p.ref = e.proceso_raiz_ref and p.escenario_id is null
                    order by (p.estado = 'vigente') desc, p.version desc limit 1),
                  case when e.proceso_raiz_ref is null then 'Catálogo completo' end),
         e.fecha_base, e.vigente_desde, e.creado_en, e.publicado_en,
         coalesce(d.altas, 0), coalesce(d.bajas, 0), coalesce(d.cambios, 0),
         coalesce(d.altas, 0) + coalesce(d.bajas, 0) + coalesce(d.cambios, 0),
         coalesce(d.abiertos, 0),
         case when e.estado = 'borrador' then 'abrir,mapa' else 'abrir' end,
         ui.plano(concat_ws(' ', e.nombre, e.descripcion))
    from org.escenario e
    left join lateral (
      select count(*) filter (where c.cambio = 'alta')::int as altas,
             count(*) filter (where c.cambio = 'baja')::int as bajas,
             count(*) filter (where c.cambio = 'cambio')::int as cambios,
             count(*) filter (where c.borrador_abierto)::int as abiertos
        from sgc.comparar_escenario_procesos(e.id) c
       where e.estado in ('borrador', 'en_aprobacion', 'aprobado')
    ) d on true
   where e.alcance = 'procesos';
$$;
grant execute on function ui.escenarios_procesos() to authenticated;

-- -----------------------------------------------------------------------------
-- 5) La validación por departamento (New Iberia)
-- -----------------------------------------------------------------------------
-- security definer: cuenta solicitudes de `flujo` que la RLS solo deja ver a
-- quien participa. Devuelve cuentas, no contenido, y exige ver procesos.
drop function if exists ui.validacion_procesos();
create or replace function ui.validacion_procesos()
returns table (
  macro_ref uuid, macro text, codigo text, tipo text, tipo_nombre text, dueno text,
  procesos integer, con_ficha integer, sin_ficha integer, borradores integer, en_revision integer,
  aprobadas integer, validados integer, avance numeric, etapa text, siguiente text,
  solicitudes integer, espera_dias integer, busqueda text
)
language plpgsql stable security definer set search_path = ui, sgc, flujo, org, public, extensions as $$
#variable_conflict use_column
begin
  if not public.puede('sistema:procesos', 'ver') then
    raise exception 'Sin permiso para ver procesos' using errcode = 'insufficient_privilege';
  end if;
  return query
  with recursive vig as (
    select p.* from sgc.proceso p where p.escenario_id is null and p.estado = 'vigente'
  ),
  nuevos as (
    select p.* from sgc.proceso p
     where p.escenario_id is null and p.estado in ('borrador', 'en_revision')
       and not exists (select 1 from vig v where v.ref = p.ref)
  ),
  todos as (select r.ref, r.padre_ref, r.nivel from vig r union all select n.ref, n.padre_ref, n.nivel from nuevos n),
  arbol as (
    select t.ref, t.ref as macro_ref, 0 as prof from todos t where t.nivel = 0
    union all
    select t.ref, a.macro_ref, a.prof + 1 from todos t join arbol a on t.padre_ref = a.ref where a.prof < 8
  ),
  abiertos as (
    select distinct on (p.ref) p.ref, p.id, p.estado from sgc.proceso p
     where p.escenario_id is null and p.estado in ('borrador', 'en_revision', 'aprobada')
     order by p.ref, p.version desc
  ),
  nodo as (
    select a.macro_ref, a.ref,
           coalesce(sgc.ficha_llena(r.ficha), false) as ficha,
           ab.estado as abierto, ab.id as abierto_id,
           exists (select 1 from flujo.solicitud s where s.tipo_objeto = 'proceso' and s.objeto_id = r.id and s.estado = 'aprobada') as validado
      from arbol a
      left join vig r on r.ref = a.ref
      left join abiertos ab on ab.ref = a.ref
     where a.prof > 0
  ),
  sol as (
    select n.macro_ref, count(*)::int as n, max(now()::date - s.creado_en::date)::int as dias
      from nodo n join flujo.solicitud s on s.tipo_objeto = 'proceso' and s.objeto_id = n.abierto_id and s.estado = 'en_curso'
     group by n.macro_ref
  ),
  cuenta as (
    select n.macro_ref,
           count(*)::int as procesos,
           count(*) filter (where n.ficha)::int as con_ficha,
           count(*) filter (where not n.ficha)::int as sin_ficha,
           count(*) filter (where n.abierto = 'borrador')::int as borradores,
           count(*) filter (where n.abierto = 'en_revision')::int as en_revision,
           count(*) filter (where n.abierto = 'aprobada')::int as aprobadas,
           count(*) filter (where n.validado)::int as validados
      from nodo n group by n.macro_ref
  )
  select m.ref, m.nombre, coalesce(m.codigo_sgc, m.codigo_informe), m.tipo, ui.etiqueta('tipo_proceso', m.tipo),
         coalesce((select concat_ws(' · ', c.nombre, u.nombre) from org.plaza pl
                     left join org.cargo c on c.id = pl.cargo_id
                     left join org.unidad u on u.ref = pl.unidad_ref and u.escenario_id is null and u.vigencia @> current_date
                    where pl.ref = m.dueno_plaza_ref and pl.escenario_id is null and pl.vigencia @> current_date limit 1),
                  nullif(btrim(m.dueno_texto), '')),
         coalesce(k.procesos, 0), coalesce(k.con_ficha, 0), coalesce(k.sin_ficha, 0), coalesce(k.borradores, 0),
         coalesce(k.en_revision, 0), coalesce(k.aprobadas, 0), coalesce(k.validados, 0),
         case when coalesce(k.procesos, 0) = 0 then 0 else round(100.0 * k.validados / k.procesos, 1) end,
         case when coalesce(k.procesos, 0) > 0 and k.validados = k.procesos then 'optimizado'
              when coalesce(k.en_revision, 0) + coalesce(k.aprobadas, 0) > 0 then 'revision'
              when coalesce(k.borradores, 0) > 0 then 'mejoras'
              else 'como_es' end,
         case when coalesce(k.procesos, 0) > 0 and k.validados = k.procesos then 'Revisión periódica (cada 24 meses)'
              when coalesce(k.en_revision, 0) > 0 then format('Decidir %s en la bandeja%s', k.en_revision,
                     case when s.dias is not null then format(' · la más vieja espera %s d', s.dias) else '' end)
              when coalesce(k.aprobadas, 0) > 0 then format('%s aprobada(s) esperan su fecha', k.aprobadas)
              when coalesce(k.borradores, 0) > 0 then format('Enviar %s borrador(es) a revisión', k.borradores)
              when coalesce(k.sin_ficha, 0) > 0 then format('Levantar «cómo es» de %s proceso(s) sin ficha', k.sin_ficha)
              when coalesce(k.procesos, 0) = 0 then 'Definir sus procesos'
              else 'Abrir borradores con las mejoras y agendar el comité' end,
         coalesce(s.n, 0), s.dias,
         ui.plano(concat_ws(' ', m.nombre, m.codigo_sgc, m.codigo_informe, m.dueno_texto))
    from vig m
    left join cuenta k on k.macro_ref = m.ref
    left join sol s on s.macro_ref = m.ref
   where m.nivel = 0;
end;
$$;
revoke execute on function ui.validacion_procesos() from public, anon;
grant execute on function ui.validacion_procesos() to authenticated;

-- -----------------------------------------------------------------------------
-- 6) DOCUMENTOS: la decisión de la conciliación, la biblioteca y la cola
-- -----------------------------------------------------------------------------
create table if not exists sgc.documento_conciliacion (
  id           uuid primary key default gen_random_uuid(),
  documento_id uuid not null references sgc.documento (id) on delete cascade,
  motivo       text not null check (motivo in ('sin_determinar', 'obsoleto', 'codigo_reutilizado', 'datos_sensibles')),
  resolucion   text not null check (length(btrim(resolucion)) >= 3),
  decidido_por uuid not null default auth.uid() references public.profiles (id),
  decidido_en  timestamptz not null default now(),
  unique (documento_id, motivo)
);
alter table sgc.documento_conciliacion enable row level security;
grant select, insert, update, delete on sgc.documento_conciliacion to authenticated;
grant all on sgc.documento_conciliacion to service_role;

-- Se ve lo que se ve del documento (el perímetro lo cierra la política de `sgc.documento`).
drop policy if exists "ver la conciliación de documentos" on sgc.documento_conciliacion;
create policy "ver la conciliación de documentos" on sgc.documento_conciliacion for select to authenticated
  using (public.puede('sistema:documentos', 'ver') and exists (select 1 from sgc.documento d where d.id = documento_id));
drop policy if exists "decidir la conciliación de documentos" on sgc.documento_conciliacion;
create policy "decidir la conciliación de documentos" on sgc.documento_conciliacion for insert to authenticated
  with check (public.puede('sistema:documentos', 'editar') and decidido_por = auth.uid()
              and exists (select 1 from sgc.documento d where d.id = documento_id));
drop policy if exists "corregir la conciliación de documentos" on sgc.documento_conciliacion;
create policy "corregir la conciliación de documentos" on sgc.documento_conciliacion for update to authenticated
  using (public.puede('sistema:documentos', 'editar')) with check (public.puede('sistema:documentos', 'editar') and decidido_por = auth.uid());
drop policy if exists "reabrir la conciliación de documentos" on sgc.documento_conciliacion;
create policy "reabrir la conciliación de documentos" on sgc.documento_conciliacion for delete to authenticated
  using (public.puede('sistema:documentos', 'editar'));

drop trigger if exists auditar on sgc.documento_conciliacion;
create trigger auditar after insert or update or delete on sgc.documento_conciliacion
  for each row execute function control.auditar();

-- La biblioteca. Con la RLS de quien mira: sin `sistema:perimetros`, los
-- documentos de perímetro no existen.
drop function if exists ui.documentos();
create or replace function ui.documentos()
returns table (
  id uuid, codigo text, titulo text, estado text, tipo_yy text, tipo_nombre text, tipo_etiqueta text,
  proceso_xx text, proceso_xx_etiqueta text, proceso_ref uuid, proceso text, macro_ref uuid, macro text,
  familia text, perimetro text, perimetro_nombre text, datos_sensibles boolean, version text, fecha date,
  destino text, alias_texto text, n_alias integer, n_archivos integer, codigo_repetido boolean,
  pendientes integer, busqueda text
)
language sql stable security invoker set search_path = ui, sgc, org, public, extensions as $$
  with recursive tipos as (
    select t.yy, string_agg(distinct t.nombre, ' · ' order by t.nombre) as nombre from sgc.tipo_documento t group by t.yy
  ),
  vig as (select p.ref, p.padre_ref, p.nombre, p.nivel, p.codigo_sgc from sgc.proceso p where p.escenario_id is null and p.estado = 'vigente'),
  arbol as (
    select r.ref, r.ref as macro_ref, 0 as prof from vig r where r.nivel = 0
    union all
    select r.ref, a.macro_ref, a.prof + 1 from vig r join arbol a on r.padre_ref = a.ref where a.prof < 8
  ),
  xx as (select distinct on (sgc.xx(r.codigo_sgc)) sgc.xx(r.codigo_sgc) as xx, r.nombre from vig r
          where r.codigo_sgc ~ '^II-\d{2}$' order by sgc.xx(r.codigo_sgc), r.nivel),
  d as (select x.*, count(*) over (partition by x.codigo) as usos from sgc.documento x),
  hechos as (select c.documento_id, array_agg(c.motivo) as motivos from sgc.documento_conciliacion c group by c.documento_id)
  select d.id, d.codigo, d.titulo, d.estado, d.tipo_yy, t.nombre,
         case when d.tipo_yy is null then null else concat_ws(' · ', d.tipo_yy, t.nombre) end,
         d.proceso_xx, case when d.proceso_xx is null then null else concat_ws(' · ', d.proceso_xx, xx.nombre) end,
         d.proceso_ref, p.nombre, a.macro_ref, m.nombre,
         d.familia, d.perimetro, ui.etiqueta('perimetro', d.perimetro), d.datos_sensibles, d.version, d.fecha,
         d.destino, nullif(array_to_string(d.alias, ', '), ''), cardinality(d.alias), cardinality(d.archivos),
         d.usos > 1,
         ((d.estado = 'sin_determinar' and not ('sin_determinar' = any (coalesce(h.motivos, '{}'))))::int
          + (d.estado = 'obsoleto' and not ('obsoleto' = any (coalesce(h.motivos, '{}'))))::int
          + (d.usos > 1 and not ('codigo_reutilizado' = any (coalesce(h.motivos, '{}'))))::int
          + (d.datos_sensibles and not ('datos_sensibles' = any (coalesce(h.motivos, '{}'))))::int),
         ui.plano(concat_ws(' ', d.codigo, d.titulo, array_to_string(d.alias, ' '), d.familia, p.nombre))
    from d
    left join tipos t on t.yy = d.tipo_yy
    left join xx on xx.xx = d.proceso_xx
    left join vig p on p.ref = d.proceso_ref
    left join arbol a on a.ref = d.proceso_ref
    left join vig m on m.ref = a.macro_ref
    left join hechos h on h.documento_id = d.id;
$$;
comment on function ui.documentos() is 'La biblioteca de documentos para la tabla (R2), con la RLS de quien mira.';
grant execute on function ui.documentos() to authenticated;

-- La cola de conciliación: una fila por documento y motivo, pendiente o decidida.
drop function if exists ui.conciliacion_documentos();
create or replace function ui.conciliacion_documentos()
returns table (
  clave text, id uuid, codigo text, titulo text, estado text, motivo text, situacion text, prioridad integer,
  detalle text, perimetro text, perimetro_nombre text, proceso text, resolucion text, decidido_por text,
  decidido_en timestamptz, acciones text, busqueda text
)
language sql stable security invoker set search_path = ui, sgc, flujo, public, extensions as $$
  with d as (
    select x.*, count(*) over (partition by x.codigo) as usos,
           (select string_agg(distinct y.titulo, ' · ') from sgc.documento y where y.codigo = x.codigo and y.id <> x.id) as otros
      from sgc.documento x
  ),
  m as (
    select d.*, 'datos_sensibles'::text as motivo, 0 as orden,
           'Trae datos personales o credenciales: sanear antes de difundir' as det from d where d.datos_sensibles
    union all
    select d.*, 'codigo_reutilizado', 1, format('El código lo usan %s documentos: %s', d.usos, d.otros) from d where d.usos > 1
    union all
    select d.*, 'sin_determinar', 2, coalesce('Evidencia: ' || nullif(btrim(d.evidencia_estado), ''), 'Sin evidencia del estado') from d where d.estado = 'sin_determinar'
    union all
    select d.*, 'obsoleto', 3, coalesce('Evidencia: ' || nullif(btrim(d.evidencia_estado), ''), 'Confirmar que se retira de la circulación') from d where d.estado = 'obsoleto'
  )
  select m.id::text || ':' || m.motivo, m.id, m.codigo, m.titulo, m.estado, m.motivo,
         case when c.id is null then 'pendiente' else 'decidido' end,
         case when c.id is null then m.orden else 9 end,
         m.det, m.perimetro, ui.etiqueta('perimetro', m.perimetro),
         (select p.nombre from sgc.proceso p where p.ref = m.proceso_ref and p.escenario_id is null and p.estado = 'vigente' limit 1),
         c.resolucion,
         (select n.nombre from flujo.nombres(array[c.decidido_por]) n limit 1),
         c.decidido_en,
         case when c.id is null and public.puede('sistema:documentos', 'editar') then 'resolver,ficha' else 'ficha' end,
         ui.plano(concat_ws(' ', m.codigo, m.titulo, array_to_string(m.alias, ' '), c.resolucion))
    from m
    left join sgc.documento_conciliacion c on c.documento_id = m.id and c.motivo = m.motivo;
$$;
grant execute on function ui.conciliacion_documentos() to authenticated;

-- -----------------------------------------------------------------------------
-- 7) HISTORIAL legible por módulo
-- -----------------------------------------------------------------------------
-- Qué campos cambiaron entre el antes y el después (sin el ruido de columnas generadas).
create or replace function ui.campos_cambiados(p_antes jsonb, p_despues jsonb)
returns text language sql immutable set search_path = pg_catalog as $$
  select string_agg(k, ', ' order by k)
    from (select jsonb_object_keys(coalesce(p_despues, '{}'::jsonb)) as k) x
   where k not in ('esc', 'tipo_cat', 'estado_cat', 'perim_cat', 'busqueda', 'creado_en')
     and (p_antes -> k) is distinct from (p_despues -> k);
$$;

drop function if exists ui.historial_procesos();
create or replace function ui.historial_procesos()
returns table (
  id bigint, en timestamptz, accion text, objeto_tipo text, ref uuid, objeto text, codigo text, version integer,
  estado text, quien text, cambios text, busqueda text
)
language plpgsql stable security definer set search_path = ui, control, sgc, public, extensions as $$
#variable_conflict use_column
begin
  if not (public.puede('sistema:procesos', 'ver') and public.puede('sistema:auditoria', 'ver')) then
    raise exception 'El historial lo ve quien tiene el permiso de auditoría' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.en,
         case when a.accion = 'INSERT' then 'creado' when a.accion = 'DELETE' then 'eliminado'
              when (a.antes ->> 'estado') is distinct from (a.despues ->> 'estado') then 'estado'
              else 'modificado' end,
         case a.tabla when 'proceso' then 'Proceso' else 'Cruce' end,
         nullif(coalesce(f ->> 'ref', f ->> 'proceso_ref'), '')::uuid,
         coalesce(f ->> 'nombre', (select p.nombre from sgc.proceso p where p.ref = nullif(f ->> 'proceso_ref', '')::uuid
                                     and p.escenario_id is null order by p.version desc limit 1)),
         coalesce(f ->> 'codigo_sgc', f ->> 'codigo_informe'),
         nullif(f ->> 'version', '')::int,
         case when a.accion = 'UPDATE' and (a.antes ->> 'estado') is distinct from (a.despues ->> 'estado')
              then concat_ws(' → ', a.antes ->> 'estado', a.despues ->> 'estado') else f ->> 'estado' end,
         coalesce((select coalesce(nullif(btrim(pr.nombre_completo), ''), pr.email) from public.profiles pr where pr.id = a.actor), 'Sistema'),
         case when a.accion = 'UPDATE' then ui.campos_cambiados(a.antes, a.despues) end,
         ui.plano(concat_ws(' ', f ->> 'nombre', f ->> 'codigo_sgc', f ->> 'codigo_informe', f ->> 'nota'))
    from control.auditoria a
    cross join lateral (select coalesce(a.despues, a.antes) as f) x
   where a.esquema = 'sgc' and a.tabla in ('proceso', 'proceso_cruce')
     and (a.tabla <> 'proceso' or (f ->> 'escenario_id') is null);
end;
$$;
revoke execute on function ui.historial_procesos() from public, anon;
grant execute on function ui.historial_procesos() to authenticated;

drop function if exists ui.historial_documentos();
create or replace function ui.historial_documentos()
returns table (
  id bigint, en timestamptz, accion text, objeto_tipo text, documento_id uuid, codigo text, objeto text,
  estado text, quien text, cambios text, busqueda text
)
language plpgsql stable security definer set search_path = ui, control, sgc, public, extensions as $$
#variable_conflict use_column
declare
  v_perimetros boolean := public.puede('sistema:perimetros', 'ver');
begin
  if not (public.puede('sistema:documentos', 'ver') and public.puede('sistema:auditoria', 'ver')) then
    raise exception 'El historial lo ve quien tiene el permiso de auditoría' using errcode = 'insufficient_privilege';
  end if;
  return query
  select a.id, a.en,
         case when a.tabla = 'documento_conciliacion' then
                case a.accion when 'DELETE' then 'reabierto' else 'conciliado' end
              when a.accion = 'INSERT' then 'creado' when a.accion = 'DELETE' then 'eliminado'
              when (a.antes ->> 'estado') is distinct from (a.despues ->> 'estado') then 'estado'
              else 'modificado' end,
         case a.tabla when 'documento' then 'Documento' else 'Conciliación' end,
         doc.id, doc.codigo, doc.titulo,
         case when a.tabla = 'documento_conciliacion' then
                concat_ws(' · ', replace(f ->> 'motivo', '_', ' '), f ->> 'resolucion')
              when a.accion = 'UPDATE' and (a.antes ->> 'estado') is distinct from (a.despues ->> 'estado')
              then concat_ws(' → ', a.antes ->> 'estado', a.despues ->> 'estado') else f ->> 'estado' end,
         coalesce((select coalesce(nullif(btrim(pr.nombre_completo), ''), pr.email) from public.profiles pr where pr.id = a.actor), 'Sistema'),
         case when a.accion = 'UPDATE' then ui.campos_cambiados(a.antes, a.despues) end,
         ui.plano(concat_ws(' ', doc.codigo, doc.titulo, f ->> 'resolucion'))
    from control.auditoria a
    cross join lateral (select coalesce(a.despues, a.antes) as f) x
    join lateral (
      select dd.id, dd.codigo, dd.titulo, dd.perimetro from sgc.documento dd
       where dd.id = nullif(case when a.tabla = 'documento' then f ->> 'id' else f ->> 'documento_id' end, '')::uuid
    ) doc on true
   where a.esquema = 'sgc' and a.tabla in ('documento', 'documento_conciliacion')
     and (doc.perimetro = 'general' or v_perimetros);
end;
$$;
revoke execute on function ui.historial_documentos() from public, anon;
grant execute on function ui.historial_documentos() to authenticated;
grant execute on function ui.campos_cambiados(jsonb, jsonb) to authenticated;
