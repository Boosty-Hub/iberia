-- =============================================================================
-- PLATAFORMA IBERIA · El lienzo del organigrama y del mapa de procesos
--
--   · `org.lienzo(fecha, escenario)`: las unidades y las plazas como nodos
--     planos, con el padre de cada uno, su dotación aprobada, lo ocupado, las
--     vacantes, lo que está por encima, si es inferido y —solo con
--     `sistema:costos`— el costo mensual de referencia.
--   · `sgc.lienzo(fecha, escenario)`: los procesos de los cuatro niveles a una
--     fecha, con su código, su estado operativo, si tienen ficha PHVA, sus
--     documentos, su dueño (y si la plaza dueña está vacante) y la salud
--     documental que sale de todo eso.
--
-- Con escenario, los nodos son los del escenario y cada uno trae su `diff`
-- contra la realidad: `nuevo`, `movido`, `cambiado` o `quitado`. Lo quitado
-- viene también, con su padre de la realidad, para dibujarlo tachado.
--
-- El lienzo solo dibuja: las cuentas se hacen aquí, una vez. Las dos son
-- `security invoker`: corren con la RLS de quien pregunta, así que sin
-- `sistema:estructura` o `sistema:procesos` vuelven vacías.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) EL ORGANIGRAMA
-- -----------------------------------------------------------------------------
-- La fecha de un escenario es su fecha base: contra esa realidad se copió y
-- contra esa se compara (igual que `org.comparar_escenario`).
create or replace function org.lienzo(p_fecha date default null, p_escenario uuid default null)
returns table (
  id            text,       -- 'u:<ref>' o 'p:<ref>'
  ref           uuid,
  padre         text,       -- el id del nodo padre (nulo en la raíz)
  clase         text,       -- 'unidad' | 'plaza'
  tipo          text,       -- tipo de unidad, o familia del cargo
  nombre        text,       -- nombre de la unidad, o del cargo
  orden         integer,
  codigo        text,       -- código del organigrama (unidades)
  sede          text,
  estado        text,       -- estado de la plaza
  aprob         integer,    -- dotación aprobada (propia de la plaza; 0 en la unidad)
  ocu           integer,    -- titulares
  vacantes      integer,
  excede        integer,    -- titulares por encima de la dotación
  inferido      boolean,
  personas      text[],     -- nombres de los titulares (solo nombre: nada de contacto)
  costo_ves     numeric,    -- costo mensual de la plaza (dotación × costo del cargo); nulo sin permiso
  costo_usd     numeric,
  diff          text,       -- con escenario: 'nuevo' | 'movido' | 'cambiado' | 'quitado'
  antes         jsonb       -- con escenario: cómo está en la realidad lo que cambió
)
language sql stable security invoker set search_path = org, public, extensions as $$
  with par as (
    select p_escenario as escenario,
           coalesce((select e.fecha_base from org.escenario e where e.id = p_escenario), p_fecha, org.hoy()) as dia,
           public.puede('sistema:costos', 'ver') as con_costo
  ),
  -- Lo que se dibuja: la realidad a la fecha, o las filas del escenario.
  uv as (
    select u.* from org.unidad u, par
     where (par.escenario is null and u.escenario_id is null and u.vigencia @> par.dia)
        or (par.escenario is not null and u.escenario_id = par.escenario and not isempty(u.vigencia))
  ),
  pv as (
    select p.* from org.plaza p, par
     where (par.escenario is null and p.escenario_id is null and p.vigencia @> par.dia)
        or (par.escenario is not null and p.escenario_id = par.escenario and not isempty(p.vigencia))
  ),
  -- La realidad contra la que se compara (solo con escenario).
  ur as (
    select u.* from org.unidad u, par
     where par.escenario is not null and u.escenario_id is null and u.vigencia @> par.dia
  ),
  pr as (
    select p.* from org.plaza p, par
     where par.escenario is not null and p.escenario_id is null and p.vigencia @> par.dia
  ),
  -- Los titulares a la fecha, por plaza (la ocupación no tiene escenario: es la gente de hoy).
  tit as (
    select o.plaza_ref, count(*)::int as n,
           array_agg(coalesce(em.nombre_completo, 'Persona fuera del padrón') order by em.nombre_completo) as nombres
      from org.ocupacion o cross join par
      left join public.empleados em on em.id = o.empleado_id
     where o.tipo = 'titular' and o.vigencia @> par.dia
     group by o.plaza_ref
  ),
  costo as (
    select c.id as cargo_id, org.costo_mensual(c.id, par.dia) as j
      from org.cargo c, par
     where par.con_costo and c.id in (select pv.cargo_id from pv union select pr.cargo_id from pr)
  ),
  unidades as (
    select 'u:' || u.ref::text as id, u.ref, case when u.padre_ref is null then null else 'u:' || u.padre_ref::text end as padre,
           'unidad'::text as clase, u.tipo, u.nombre, u.orden, u.codigo_organigrama as codigo, u.sede,
           null::text as estado, 0 as aprob, 0 as ocu, 0 as vacantes, 0 as excede,
           u.certeza = 'inferencia' as inferido, null::text[] as personas, null::numeric as costo_ves, null::numeric as costo_usd,
           case when par.escenario is null then null
                when r.ref is null then 'nuevo'
                when u.padre_ref is distinct from r.padre_ref then 'movido'
                when (u.nombre, u.tipo, u.sede) is distinct from (r.nombre, r.tipo, r.sede) then 'cambiado' end as diff,
           case when par.escenario is not null and r.ref is not null
                 and (u.nombre, u.tipo, u.sede, u.padre_ref) is distinct from (r.nombre, r.tipo, r.sede, r.padre_ref)
                then jsonb_build_object('nombre', r.nombre, 'tipo', r.tipo, 'sede', r.sede, 'padre_ref', r.padre_ref,
                                        'padre', (select x.nombre from ur x where x.ref = r.padre_ref)) end as antes
      from uv u cross join par
      left join ur r on r.ref = u.ref
    union all
    -- Lo que el escenario cierra: se dibuja tachado, donde estaba.
    select 'u:' || r.ref::text, r.ref, case when r.padre_ref is null then null else 'u:' || r.padre_ref::text end,
           'unidad', r.tipo, r.nombre, r.orden, r.codigo_organigrama, r.sede,
           null, 0, 0, 0, 0, r.certeza = 'inferencia', null, null, null,
           'quitado', jsonb_build_object('nombre', r.nombre, 'tipo', r.tipo, 'padre_ref', r.padre_ref)
      from ur r
     where not exists (select 1 from uv u where u.ref = r.ref)
  ),
  plazas as (
    select 'p:' || p.ref::text as id, p.ref, 'u:' || p.unidad_ref::text as padre,
           'plaza'::text as clase, c.familia as tipo, c.nombre, 100000 as orden, null::text as codigo, p.sede,
           p.estado, p.dotacion as aprob, coalesce(t.n, 0) as ocu,
           greatest(p.dotacion - coalesce(t.n, 0), 0) as vacantes, greatest(coalesce(t.n, 0) - p.dotacion, 0) as excede,
           p.certeza = 'inferencia' as inferido, t.nombres as personas,
           round((k.j ->> 'total_ves')::numeric * p.dotacion, 2) as costo_ves,
           round((k.j ->> 'total_usd')::numeric * p.dotacion, 2) as costo_usd,
           case when par.escenario is null then null
                when r.ref is null then 'nuevo'
                when p.unidad_ref is distinct from r.unidad_ref then 'movido'
                when (p.cargo_id, p.dotacion, p.reporta_a_ref, p.estado) is distinct from (r.cargo_id, r.dotacion, r.reporta_a_ref, r.estado)
                  then 'cambiado' end as diff,
           case when par.escenario is not null and r.ref is not null
                 and (p.cargo_id, p.dotacion, p.reporta_a_ref, p.estado, p.unidad_ref)
                     is distinct from (r.cargo_id, r.dotacion, r.reporta_a_ref, r.estado, r.unidad_ref)
                then jsonb_build_object('dotacion', r.dotacion, 'unidad_ref', r.unidad_ref,
                                        'unidad', (select x.nombre from ur x where x.ref = r.unidad_ref),
                                        'cargo', (select cc.nombre from org.cargo cc where cc.id = r.cargo_id),
                                        'estado', r.estado,
                                        'costo_ves', round((kr.j ->> 'total_ves')::numeric * r.dotacion, 2)) end as antes
      from pv p cross join par
      left join org.cargo c on c.id = p.cargo_id
      left join tit t on t.plaza_ref = p.ref
      left join costo k on k.cargo_id = p.cargo_id
      left join pr r on r.ref = p.ref
      left join costo kr on kr.cargo_id = r.cargo_id
    union all
    select 'p:' || r.ref::text, r.ref, 'u:' || r.unidad_ref::text,
           'plaza', c.familia, c.nombre, 100000, null, r.sede,
           r.estado, r.dotacion, coalesce(t.n, 0),
           greatest(r.dotacion - coalesce(t.n, 0), 0), greatest(coalesce(t.n, 0) - r.dotacion, 0),
           r.certeza = 'inferencia', t.nombres,
           round((k.j ->> 'total_ves')::numeric * r.dotacion, 2), round((k.j ->> 'total_usd')::numeric * r.dotacion, 2),
           'quitado', jsonb_build_object('dotacion', r.dotacion, 'unidad_ref', r.unidad_ref, 'cargo', c.nombre)
      from pr r
      left join org.cargo c on c.id = r.cargo_id
      left join tit t on t.plaza_ref = r.ref
      left join costo k on k.cargo_id = r.cargo_id
     where not exists (select 1 from pv p where p.ref = r.ref)
  )
  select * from unidades
  union all
  select * from plazas
  order by clase desc, orden, nombre;
$$;

comment on function org.lienzo(date, uuid) is
  'Nodos planos del organigrama a una fecha (o de un escenario, con su diff contra la realidad). Lo dibuja el lienzo.';

-- -----------------------------------------------------------------------------
-- 2) EL MAPA DE PROCESOS
-- -----------------------------------------------------------------------------
-- ¿Tiene ficha PHVA? Lo mismo que `fichaVacia()` de la pantalla: algún campo
-- de la ficha con texto, o alguna lista con algo.
create or replace function sgc.ficha_llena(p_ficha jsonb)
returns boolean language sql immutable set search_path = pg_catalog as $$
  select coalesce(bool_or(
           case jsonb_typeof(kv.value)
             when 'string' then btrim(kv.value #>> '{}') <> ''
             when 'array'  then jsonb_array_length(kv.value) > 0
             when 'object' then exists (select 1 from jsonb_each(kv.value) a
                                         where (jsonb_typeof(a.value) = 'array' and jsonb_array_length(a.value) > 0)
                                            or (jsonb_typeof(a.value) = 'string' and btrim(a.value #>> '{}') <> ''))
             else false end), false)
    from jsonb_each(coalesce(p_ficha, '{}'::jsonb)) kv
   where kv.key in ('objetivo', 'alcance', 'indicadores', 'proveedores', 'entradas', 'salidas', 'clientes',
                    'recursos', 'riesgos', 'oportunidades', 'actividades', 'requisitos', 'registros');
$$;

create or replace function sgc.lienzo(p_fecha date default null, p_escenario uuid default null)
returns table (
  id               text,      -- 'r:<ref>'
  ref              uuid,
  padre            text,
  nivel            smallint,
  nombre           text,
  tipo             text,      -- estrategico | operativo | soporte
  codigo_sgc       text,
  codigo_informe   text,
  orden            integer,
  estado_operativo text,
  version          integer,
  tiene_ficha      boolean,
  docs_total       integer,
  docs_vigentes    integer,
  revision_abierta boolean,   -- hay un borrador o una revisión abierta en la realidad
  dueno_plaza_ref  uuid,
  dueno            text,      -- «Cargo · Unidad», o lo que dice la fuente
  dueno_estado     text,      -- 'asignado' | 'vacante' | 'sin_plaza' | 'sin_dueno'
  salud            text,      -- 'vigente' | 'revision' | 'sin_documentar'
  diff             text,
  antes            jsonb
)
language sql stable security invoker set search_path = sgc, org, public, extensions as $$
  with par as (
    select p_escenario as escenario, coalesce(p_fecha, org.hoy()) as dia
  ),
  -- La realidad a la fecha: la versión que regía ese día (vigente, programada,
  -- o la que después se reemplazó o retiró).
  rf as (
    select distinct on (p.ref) p.*
      from sgc.proceso p, par
     where p.escenario_id is null and p.estado in ('vigente', 'aprobada', 'reemplazada', 'retirada')
       and p.vigencia @> par.dia
     order by p.ref, p.version desc
  ),
  -- Contra qué compara un escenario: la realidad vigente (igual que `comparar_escenario_procesos`).
  rv as (
    select p.* from sgc.proceso p, par
     where par.escenario is not null and p.escenario_id is null and p.estado = 'vigente'
  ),
  vis as (
    select p.*, null::text as diff, null::jsonb as antes
      from rf p, par where par.escenario is null
    union all
    select e.*,
           case when r.ref is null then 'nuevo'
                when e.estado = 'retirada' then 'quitado'
                when e.padre_ref is distinct from r.padre_ref then 'movido'
                when (e.nombre, e.dueno_plaza_ref, e.dueno_texto, e.tipo, e.estado_operativo, e.codigo_sgc, e.codigo_informe, e.ficha, e.orden)
                     is distinct from
                     (r.nombre, r.dueno_plaza_ref, r.dueno_texto, r.tipo, r.estado_operativo, r.codigo_sgc, r.codigo_informe, r.ficha, r.orden)
                  then 'cambiado' end,
           case when r.ref is not null then jsonb_build_object(
                  'nombre', r.nombre, 'padre_ref', r.padre_ref,
                  'padre', (select x.nombre from rv x where x.ref = r.padre_ref),
                  'estado_operativo', r.estado_operativo, 'dueno_plaza_ref', r.dueno_plaza_ref) end
      from sgc.proceso e cross join par
      left join rv r on r.ref = e.ref
     where par.escenario is not null and e.escenario_id = par.escenario
       and not (e.estado = 'retirada' and r.ref is null)   -- nació y murió en el escenario: no hay nada que tachar
  ),
  docs as (
    select d.proceso_ref, count(*)::int as total, (count(*) filter (where d.estado = 'vigente'))::int as vigentes
      from sgc.documento d where d.proceso_ref is not null group by d.proceso_ref
  ),
  abiertos as (
    select distinct p.ref from sgc.proceso p
     where p.escenario_id is null and p.estado in ('borrador', 'en_revision')
  ),
  -- La plaza dueña, con su cargo, su unidad y sus titulares a la fecha.
  duenos as (
    select pl.ref, c.nombre as cargo, u.nombre as unidad,
           (select count(*) from org.ocupacion o
             where o.plaza_ref = pl.ref and o.tipo = 'titular' and o.vigencia @> par.dia)::int as titulares
      from org.plaza pl cross join par
      left join org.cargo c on c.id = pl.cargo_id
      left join org.unidad u on u.ref = pl.unidad_ref and u.escenario_id is null and u.vigencia @> par.dia
     where pl.escenario_id is null and pl.vigencia @> par.dia
       and pl.ref in (select v.dueno_plaza_ref from vis v where v.dueno_plaza_ref is not null)
  )
  select 'r:' || v.ref::text,
         v.ref,
         case when v.padre_ref is null then null else 'r:' || v.padre_ref::text end,
         v.nivel, v.nombre, v.tipo, v.codigo_sgc, v.codigo_informe, v.orden, v.estado_operativo, v.version,
         sgc.ficha_llena(v.ficha),
         coalesce(d.total, 0), coalesce(d.vigentes, 0),
         a.ref is not null,
         v.dueno_plaza_ref,
         coalesce(case when du.ref is not null then concat_ws(' · ', du.cargo, du.unidad) end, nullif(btrim(v.dueno_texto), '')),
         case when v.dueno_plaza_ref is null and nullif(btrim(v.dueno_texto), '') is null then 'sin_dueno'
              when v.dueno_plaza_ref is null then 'sin_plaza'
              when du.ref is null or du.titulares = 0 then 'vacante'
              else 'asignado' end,
         case when a.ref is not null or (coalesce(d.total, 0) > 0 and coalesce(d.vigentes, 0) = 0) then 'revision'
              when coalesce(d.vigentes, 0) > 0 or sgc.ficha_llena(v.ficha) then 'vigente'
              else 'sin_documentar' end,
         v.diff, v.antes
    from vis v
    left join docs d on d.proceso_ref = v.ref
    left join abiertos a on a.ref = v.ref
    left join duenos du on du.ref = v.dueno_plaza_ref
   order by v.nivel, v.orden, v.nombre;
$$;

comment on function sgc.lienzo(date, uuid) is
  'Nodos planos del mapa de procesos a una fecha (o de un escenario, con su diff contra la realidad). Lo dibuja el lienzo.';

revoke execute on function org.lienzo(date, uuid) from anon;
revoke execute on function sgc.lienzo(date, uuid) from anon;
grant execute on function org.lienzo(date, uuid) to authenticated;
grant execute on function sgc.lienzo(date, uuid) to authenticated;
grant execute on function sgc.ficha_llena(jsonb) to authenticated;
