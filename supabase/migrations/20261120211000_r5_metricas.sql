-- =============================================================================
-- PLATAFORMA IBERIA · R5 · Registro de métricas, Mi día por rol y Ctrl K completo
-- (Anexo E §2.5, §2.6, §2.9 y §10 R5; capítulo 03 §13, DAT-SEM)
--
-- El problema que resuelve: la misma cifra salía distinta según la pantalla
-- («procesos con ficha» era 48/205 en Mi día y 46/185 en Procesos › Resumen,
-- porque cada página contaba a su manera). Desde aquí **cada métrica se define
-- una sola vez**, en una función, y todas las pantallas la leen del registro.
--
--   1) RENDIMIENTO DE LA RLS: las políticas de `org`, `sgc`, `flujo`, `control`
--      y `nucleo` llamaban `puede()` y `auth.uid()` por fila. Se envuelven en
--      `(select …)` para que Postgres las evalúe una vez por consulta (initPlan,
--      la recomendación de Supabase). La regla no cambia: solo cuándo se evalúa.
--   2) `ui.metrica`: el registro (clave, nombre, definición en palabras, unidad,
--      módulo, permiso, dueño, fuente, función y tabla de origen). Es la semilla
--      de DAT-SEM (`semantica.metrica` cuando llegue el espejo de JD).
--   3) Una función `ui.m_*` por métrica, todas con la misma firma
--      `(p_al date, p_escenario uuid) → (valor, total, detalle, calculado_en)`.
--      security invoker (la RLS de quien mira), salvo dos que cuentan lo que la
--      RLS no deja abrir y lo dicen (ver cada una).
--   4) `ui.metrica(clave, al, esc)` y `ui.metricas(claves[], al, esc)`: el
--      despachador. Revisa el permiso del registro, ejecuta la función y
--      devuelve definición + valor en un solo JSON.
--   5) `ui.portada_rol`: qué cifras ve cada rol en Mi día (editable en
--      Administración › Portadas).
--   6) `ui.reciente`: los últimos objetos que abrió cada persona (Ctrl K).
--   7) `ui.buscar` completo: objetos (unidades, plazas, cargos, personas,
--      procesos, documentos, requisiciones, escenarios) y módulos, sin tildes,
--      con la RLS de quien busca, paginado por sección.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) RLS: `puede()` y `auth.uid()` una vez por consulta, no una vez por fila
-- -----------------------------------------------------------------------------
-- Solo se tocan las llamadas con argumentos literales (`puede('sistema:x'::text,
-- 'ver'::text)` y `auth.uid()`): las que dependen de la fila (`puede(recurso,
-- …)`, `flujo.firmo_en(id)`) se quedan como están. Es idempotente: lo que ya
-- está envuelto no se vuelve a envolver.
do $$
declare
  p record;
  q text;
  c text;
  -- (?<!SELECT ) evita envolver dos veces; pg_policies devuelve la expresión deparseada.
  re_puede constant text := '(?<!SELECT )(?<![A-Za-z_.])((public\.)?puede\(''[^'']*''::text, ''[^'']*''::text\))';
  re_uid constant text := '(?<!SELECT )(auth\.uid\(\))';
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
      from pg_policies
     where schemaname in ('org', 'sgc', 'flujo', 'control', 'nucleo')
       and (coalesce(qual, '') ~ 'puede\(''|auth\.uid\(\)' or coalesce(with_check, '') ~ 'puede\(''|auth\.uid\(\)')
  loop
    q := p.qual;
    c := p.with_check;
    if q is not null then
      q := regexp_replace(regexp_replace(q, re_puede, '( SELECT \1)', 'g'), re_uid, '( SELECT \1)', 'g');
    end if;
    if c is not null then
      c := regexp_replace(regexp_replace(c, re_puede, '( SELECT \1)', 'g'), re_uid, '( SELECT \1)', 'g');
    end if;
    if q is distinct from p.qual and c is distinct from p.with_check then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, q, c);
    elsif q is distinct from p.qual then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, q);
    elsif c is distinct from p.with_check then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, c);
    end if;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2) EL REGISTRO DE MÉTRICAS
-- -----------------------------------------------------------------------------
create table if not exists ui.metrica (
  clave        text primary key check (clave ~ '^[a-z][a-z0-9_]{2,60}$'),
  nombre       text not null check (length(btrim(nombre)) between 3 and 80),
  -- Qué se cuenta, en palabras del área, con lo que entra y lo que no.
  definicion   text not null check (length(btrim(definicion)) >= 20),
  unidad       text not null,
  modulo       text references control.modulo (codigo) on update cascade on delete set null,
  -- El permiso que hace falta para ver la cifra (el mismo de su pantalla).
  recurso      text not null check (recurso ~ '^(modulo|sistema):[a-z0-9-]+$'),
  accion       text not null default 'ver' check (accion in ('ver', 'crear', 'editar')),
  dueno        text,                       -- el cargo que responde por la definición
  fuente       text not null,              -- de dónde sale, legible
  -- La función que la calcula: siempre `ui.m_*`, con la firma común.
  consulta     text not null check (consulta ~ '^ui\.m_[a-z0-9_]+$'),
  -- La tabla que la origina: un clic en la cifra lleva ahí.
  href         text check (href is null or href ~ '^/sistema(/|$|\?)'),
  -- ¿Depende de «Datos al»? Las que no, son el estado de hoy y lo dicen.
  con_fecha    boolean not null default true,
  con_escenario boolean not null default false,
  estado       text not null default 'vigente' check (estado in ('borrador', 'vigente', 'retirada')),
  version      integer not null default 1,
  orden        integer not null default 100,
  actualizado_en timestamptz not null default now()
);
comment on table ui.metrica is
  'Registro de métricas (semilla de DAT-SEM): cada cifra de la plataforma se define una sola vez, con su función ui.m_*.';

alter table ui.metrica enable row level security;
grant select on ui.metrica to authenticated;
grant update (nombre, definicion, dueno, fuente, href, orden, actualizado_en) on ui.metrica to authenticated;
grant all on ui.metrica to service_role;
drop policy if exists "leer el registro" on ui.metrica;
create policy "leer el registro" on ui.metrica for select to authenticated using (true);
-- La redacción (nombre, definición, dueño) la corrige quien administra roles;
-- la fórmula no se toca desde la pantalla: es una migración.
drop policy if exists "corregir la redacción" on ui.metrica;
create policy "corregir la redacción" on ui.metrica for update to authenticated
  using ((select public.puede('modulo:roles', 'editar'))) with check ((select public.puede('modulo:roles', 'editar')));

drop trigger if exists auditar on ui.metrica;
create trigger auditar after insert or update or delete on ui.metrica
  for each row execute function control.auditar();

-- La hora del último cambio de una tabla, según la auditoría (para el sello).
-- Devuelve solo una marca de tiempo: corre como dueña porque la auditoría la lee
-- quien tiene `sistema:auditoria`.
create or replace function ui.ultimo_cambio(p_esquema text, p_tablas text[])
returns timestamptz language sql stable security definer set search_path = control, public as $$
  select max(a.en) from control.auditoria a where a.esquema = p_esquema and a.tabla = any (p_tablas);
$$;
revoke execute on function ui.ultimo_cambio(text, text[]) from public, anon;
grant execute on function ui.ultimo_cambio(text, text[]) to authenticated;
create index if not exists auditoria_tabla_en_idx on control.auditoria (esquema, tabla, en desc);

-- -----------------------------------------------------------------------------
-- 3) LAS FUNCIONES DE LAS MÉTRICAS
--    Firma común: (p_al date, p_escenario uuid) → (valor, total, detalle, calculado_en)
-- -----------------------------------------------------------------------------

-- 3.1 DOTACIÓN. Una sola base: las mismas filas de la tabla Plazas
-- (`ui.plazas(al, esc)`), así el pie de la tabla y la cifra son el mismo número.
create or replace function ui.dotacion_base(p_al date, p_escenario uuid)
returns table (plazas integer, aprobada integer, ocupada integer, vacantes integer, por_encima integer,
               plazas_por_encima integer, plazas_vacias integer)
language sql stable security invoker set search_path = ui, org, public as $$
  select count(*)::int, coalesce(sum(p.dotacion), 0)::int, coalesce(sum(p.ocupadas), 0)::int,
         coalesce(sum(p.vacantes), 0)::int, coalesce(sum(p.exceso), 0)::int,
         (count(*) filter (where p.exceso > 0))::int, (count(*) filter (where p.ocupadas = 0))::int
    from ui.plazas(p_al, p_escenario) p;
$$;

create or replace function ui.m_dotacion_aprobada(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select b.aprobada::numeric, null::numeric,
         jsonb_build_object('plazas', b.plazas, 'actualizado_en', ui.ultimo_cambio('org', array['unidad', 'plaza', 'ocupacion', 'cargo'])),
         now()
    from ui.dotacion_base(p_al, p_escenario) b;
$$;

create or replace function ui.m_dotacion_ocupada(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select b.ocupada::numeric, b.aprobada::numeric,
         jsonb_build_object('plazas', b.plazas, 'por_encima', b.por_encima, 'vacantes', b.vacantes,
                            'actualizado_en', ui.ultimo_cambio('org', array['unidad', 'plaza', 'ocupacion', 'cargo'])),
         now()
    from ui.dotacion_base(p_al, p_escenario) b;
$$;

create or replace function ui.m_dotacion_vacantes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select b.vacantes::numeric, b.aprobada::numeric,
         jsonb_build_object('plazas_vacias', b.plazas_vacias, 'actualizado_en', ui.ultimo_cambio('org', array['unidad', 'plaza', 'ocupacion', 'cargo'])),
         now()
    from ui.dotacion_base(p_al, p_escenario) b;
$$;

create or replace function ui.m_dotacion_por_encima(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select b.por_encima::numeric, null::numeric,
         jsonb_build_object('plazas_por_encima', b.plazas_por_encima, 'actualizado_en', ui.ultimo_cambio('org', array['unidad', 'plaza', 'ocupacion', 'cargo'])),
         now()
    from ui.dotacion_base(p_al, p_escenario) b;
$$;

-- En requisición: la misma columna de la tabla Dotación (`ui.dotacion`, que
-- cuenta todas las requisiciones vivas aunque quien mira no pueda abrirlas: es
-- una cifra, no su contenido, y se cierra por dentro con `sistema:dotacion`).
create or replace function ui.m_dotacion_en_requisicion(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, public as $$
  select coalesce(sum(d.en_requisicion), 0)::numeric, null::numeric,
         jsonb_build_object('plan', sum(d.plan), 'anio', extract(year from coalesce(p_al, org.hoy()))::int,
                            'actualizado_en', ui.ultimo_cambio('org', array['requisicion', 'plan_dotacion', 'plan_dotacion_linea'])),
         now()
    from ui.dotacion(p_al, null) d;
$$;

-- 3.2 REQUISICIONES (estado de hoy; con la RLS: quien no tiene
-- `sistema:requisiciones` ve las suyas y las que firma).
create or replace function ui.m_requisiciones_abiertas(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = org, ui, public as $$
  select (count(*) filter (where q.estado in ('en_aprobacion', 'aprobada', 'en_seleccion')))::numeric,
         count(*)::numeric,
         jsonb_build_object(
           'en_aprobacion', count(*) filter (where q.estado = 'en_aprobacion'),
           'aprobada', count(*) filter (where q.estado = 'aprobada'),
           'en_seleccion', count(*) filter (where q.estado = 'en_seleccion'),
           'aprobada_o_seleccion', count(*) filter (where q.estado in ('aprobada', 'en_seleccion')),
           'personas', coalesce(sum(q.cantidad) filter (where q.estado in ('en_aprobacion', 'aprobada', 'en_seleccion')), 0),
           'actualizado_en', greatest(max(q.creado_en), ui.ultimo_cambio('org', array['requisicion']))),
         now()
    from org.requisicion q;
$$;

create or replace function ui.m_mis_requisiciones(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = org, ui, public as $$
  select (count(*) filter (where q.estado in ('borrador', 'en_aprobacion', 'aprobada', 'en_seleccion')))::numeric,
         count(*)::numeric,
         jsonb_build_object(
           'borrador', count(*) filter (where q.estado = 'borrador'),
           'en_aprobacion', count(*) filter (where q.estado = 'en_aprobacion'),
           'aprobada', count(*) filter (where q.estado in ('aprobada', 'en_seleccion')),
           'actualizado_en', greatest(max(q.creado_en), ui.ultimo_cambio('org', array['requisicion']))),
         now()
    from org.requisicion q
   where q.creado_por = (select auth.uid());
$$;

-- 3.3 PROCESOS. Una sola base: los nodos del mapa a la fecha (`sgc.lienzo`), la
-- misma de la que sale el catálogo. En la realidad, la versión que regía ese
-- día; en un escenario, sus nodos, sin los que el escenario quita.
create or replace function ui.procesos_base(p_al date, p_escenario uuid)
returns table (ref uuid, nivel smallint, tiene_ficha boolean, dueno_estado text, salud text, version integer)
language sql stable security invoker set search_path = ui, sgc, org, public as $$
  select l.ref, l.nivel, l.tiene_ficha, l.dueno_estado, l.salud, l.version
    from sgc.lienzo(p_al, (select e.id from org.escenario e where e.id = p_escenario and e.alcance = 'procesos')) l
   where l.diff is distinct from 'quitado';
$$;

create or replace function ui.m_procesos_catalogo(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, sgc, public as $$
  select count(*)::numeric, null::numeric,
         jsonb_build_object(
           'macro', count(*) filter (where b.nivel = 0),
           'proceso', count(*) filter (where b.nivel = 1),
           'subproceso', count(*) filter (where b.nivel = 2),
           'actividad', count(*) filter (where b.nivel = 3),
           -- Los nuevos que solo existen como borrador salen en el catálogo marcados «nuevo», pero no cuentan.
           'nuevos_en_borrador', (select count(distinct n.ref) from sgc.proceso n
                                   where p_escenario is null and n.escenario_id is null and n.estado in ('borrador', 'en_revision')
                                     and not exists (select 1 from sgc.proceso v where v.ref = n.ref and v.escenario_id is null
                                                       and v.estado in ('vigente', 'aprobada', 'reemplazada', 'retirada'))),
           'actualizado_en', ui.ultimo_cambio('sgc', array['proceso'])),
         now()
    from ui.procesos_base(p_al, p_escenario) b;
$$;

create or replace function ui.m_procesos_con_ficha(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, sgc, public as $$
  select (count(*) filter (where b.tiene_ficha))::numeric, count(*)::numeric,
         jsonb_build_object('macros_con_ficha', (select count(*) from ui.procesos_base(p_al, p_escenario) m where m.nivel = 0 and m.tiene_ficha),
                            'actualizado_en', ui.ultimo_cambio('sgc', array['proceso'])),
         now()
    from ui.procesos_base(p_al, p_escenario) b
   where b.nivel between 1 and 3;
$$;

create or replace function ui.m_procesos_con_dueno(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, sgc, public as $$
  select (count(*) filter (where b.dueno_estado in ('asignado', 'vacante')))::numeric, count(*)::numeric,
         jsonb_build_object('vacante', count(*) filter (where b.dueno_estado = 'vacante'),
                            'sin_plaza', count(*) filter (where b.dueno_estado = 'sin_plaza'),
                            'sin_dueno', count(*) filter (where b.dueno_estado = 'sin_dueno'),
                            'actualizado_en', ui.ultimo_cambio('sgc', array['proceso'])),
         now()
    from ui.procesos_base(p_al, p_escenario) b;
$$;

create or replace function ui.m_procesos_sin_documentar(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, sgc, public as $$
  select (count(*) filter (where b.salud = 'sin_documentar'))::numeric, count(*)::numeric,
         jsonb_build_object('en_revision', count(*) filter (where b.salud = 'revision'),
                            'documentados', count(*) filter (where b.salud = 'vigente'),
                            'actualizado_en', ui.ultimo_cambio('sgc', array['proceso', 'documento'])),
         now()
    from ui.procesos_base(p_al, p_escenario) b;
$$;

-- En revisión: la versión abierta más reciente de cada proceso (la misma columna
-- «Ciclo» del catálogo). Es el estado de hoy: el ciclo no tiene historia por fecha.
create or replace function ui.m_procesos_en_revision(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = ui, sgc, public as $$
  with abierto as (
    select distinct on (a.ref) a.ref, a.estado
      from sgc.proceso a
     where a.escenario_id is null and a.estado in ('borrador', 'en_revision', 'aprobada')
     order by a.ref, a.version desc
  )
  select (count(*) filter (where estado = 'en_revision'))::numeric, null::numeric,
         jsonb_build_object('borradores', count(*) filter (where estado = 'borrador'),
                            'aprobadas_por_publicar', count(*) filter (where estado = 'aprobada'),
                            'actualizado_en', ui.ultimo_cambio('sgc', array['proceso'])),
         now()
    from abierto;
$$;

-- Validados: corre como dueña porque cuenta solicitudes de `flujo` que la RLS
-- solo deja ver a quien participa (igual que `ui.validacion_procesos`). Devuelve
-- cuentas, no contenido, y exige ver procesos.
create or replace function ui.m_procesos_validados(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql stable security definer set search_path = ui, sgc, flujo, org, public as $$
begin
  if not public.puede('sistema:procesos', 'ver') then
    raise exception 'Sin permiso para ver procesos' using errcode = 'insufficient_privilege';
  end if;
  return query
  with b as (
    select b.ref, b.version from ui.procesos_base(p_al, null) b where b.nivel between 1 and 3
  )
  select (count(*) filter (where exists (
            select 1 from sgc.proceso p join flujo.solicitud s on s.tipo_objeto = 'proceso' and s.objeto_id = p.id and s.estado = 'aprobada'
             where p.ref = b.ref and p.version = b.version and p.escenario_id is null)))::numeric,
         count(*)::numeric,
         jsonb_build_object('actualizado_en', ui.ultimo_cambio('flujo', array['solicitud'])),
         now()
    from b;
end;
$$;

-- 3.4 DOCUMENTOS (estado de hoy; con la RLS: sin `sistema:perimetros`, los
-- documentos de perímetro no existen ni cuentan).
create or replace function ui.m_documentos_vigentes(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = sgc, ui, public as $$
  select (count(*) filter (where d.estado = 'vigente'))::numeric, count(*)::numeric,
         jsonb_build_object('con_proceso', count(*) filter (where d.estado = 'vigente' and d.proceso_ref is not null),
                            'actualizado_en', greatest(max(d.creado_en), ui.ultimo_cambio('sgc', array['documento']))),
         now()
    from sgc.documento d;
$$;

create or replace function ui.m_documentos_inventario(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = sgc, ui, public as $$
  with d as (select x.*, count(*) over (partition by x.codigo) as usos from sgc.documento x)
  select count(*)::numeric, null::numeric,
         jsonb_build_object(
           'vigente', count(*) filter (where d.estado = 'vigente'),
           'sin_determinar', count(*) filter (where d.estado = 'sin_determinar'),
           'borrador', count(*) filter (where d.estado = 'borrador'),
           'obsoleto', count(*) filter (where d.estado = 'obsoleto'),
           'retirado', count(*) filter (where d.estado = 'retirado'),
           'datos_sensibles', count(*) filter (where d.datos_sensibles),
           'codigo_repetido', count(*) filter (where d.usos > 1),
           'actualizado_en', greatest(max(d.creado_en), ui.ultimo_cambio('sgc', array['documento']))),
         now()
    from d;
$$;

-- En conciliación: los puntos pendientes de la cola (un documento puede tener
-- más de un motivo). Las mismas filas de la pestaña Conciliación.
create or replace function ui.m_documentos_en_conciliacion(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = sgc, ui, public as $$
  select (count(*) filter (where c.situacion = 'pendiente'))::numeric, count(*)::numeric,
         jsonb_build_object(
           'sin_determinar', count(*) filter (where c.situacion = 'pendiente' and c.motivo = 'sin_determinar'),
           'obsoleto', count(*) filter (where c.situacion = 'pendiente' and c.motivo = 'obsoleto'),
           'codigo_reutilizado', count(*) filter (where c.situacion = 'pendiente' and c.motivo = 'codigo_reutilizado'),
           'datos_sensibles', count(*) filter (where c.situacion = 'pendiente' and c.motivo = 'datos_sensibles'),
           'decididos', count(*) filter (where c.situacion = 'decidido'),
           'actualizado_en', ui.ultimo_cambio('sgc', array['documento', 'documento_conciliacion'])),
         now()
    from ui.conciliacion_documentos() c;
$$;

-- 3.5 TASAS. Todas salen de `control.tasas_del_dia` (la misma de la barra): la
-- vigente por fecha valor <= el día. Son volátiles porque esa función registra
-- cada lectura del paralelo.
create or replace function ui.tasa_estado(p_fecha_valor date, p_al date)
returns text language sql immutable as $$
  select case when p_fecha_valor is null then 'sin_dato'
              when p_fecha_valor < p_al - 4 then 'atrasado' else 'al_dia' end;
$$;

create or replace function ui.m_tasa_bcv_usd(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql volatile security invoker set search_path = ui, control, public as $$
declare
  d date := coalesce(p_al, org.hoy());
  t jsonb := control.tasas_del_dia(d);
begin
  return query
  select (t ->> 'usd')::numeric, null::numeric,
         jsonb_build_object(
           'fecha_valor', t ->> 'usd_fecha_valor', 'anterior', (t ->> 'usd_anterior')::numeric,
           'variacion', case when (t ->> 'usd_anterior')::numeric > 0
                             then round(((t ->> 'usd')::numeric / (t ->> 'usd_anterior')::numeric - 1) * 100, 2) end,
           'verificada', t ->> 'usd_verificada',
           'actualizado_en', t ->> 'usd_capturada',
           'estado', ui.tasa_estado((t ->> 'usd_fecha_valor')::date, d),
           'serie', (select jsonb_agg(s.usd order by s.dia) from control.serie_tasas(d - 29, d) s)),
         now();
end;
$$;

create or replace function ui.m_tasa_bcv_eur(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql volatile security invoker set search_path = ui, control, public as $$
declare
  d date := coalesce(p_al, org.hoy());
  t jsonb := control.tasas_del_dia(d);
  ant numeric;
begin
  select x.tasa into ant from control.tasa_cambio x
   where x.tipo = 'oficial' and x.moneda = 'EUR' and x.estado = 'vigente' and x.fecha_valor < (t ->> 'eur_fecha_valor')::date
   order by x.fecha_valor desc limit 1;
  return query
  select (t ->> 'eur')::numeric, null::numeric,
         jsonb_build_object(
           'fecha_valor', t ->> 'eur_fecha_valor', 'anterior', ant,
           'variacion', case when ant > 0 then round(((t ->> 'eur')::numeric / ant - 1) * 100, 2) end,
           'actualizado_en', t ->> 'usd_capturada',
           'estado', ui.tasa_estado((t ->> 'eur_fecha_valor')::date, d),
           'serie', (select jsonb_agg(s.eur order by s.dia) from control.serie_tasas(d - 29, d) s)),
         now();
end;
$$;

create or replace function ui.m_tasa_paralelo(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql volatile security invoker set search_path = ui, control, public as $$
declare
  d date := coalesce(p_al, org.hoy());
  t jsonb := control.tasas_del_dia(d);
begin
  return query
  select (t ->> 'paralelo')::numeric, null::numeric,
         jsonb_build_object('actualizado_en', t ->> 'paralelo_capturada',
                            'estado', case when t ->> 'paralelo' is null then 'sin_dato' else 'al_dia' end,
                            'serie', (select jsonb_agg(s.paralelo order by s.dia) from control.serie_tasas(d - 29, d) s)),
         now();
end;
$$;

create or replace function ui.m_brecha_cambiaria(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language plpgsql volatile security invoker set search_path = ui, control, public as $$
declare
  d date := coalesce(p_al, org.hoy());
  t jsonb := control.tasas_del_dia(d);
begin
  return query
  select (t ->> 'brecha')::numeric, null::numeric,
         jsonb_build_object('anterior', (t ->> 'brecha_anterior')::numeric,
                            'hace_30', (select s.brecha from control.serie_tasas(d - 29, d) s where s.brecha is not null order by s.dia limit 1),
                            'actualizado_en', t ->> 'paralelo_capturada',
                            'estado', case when t ->> 'brecha' is null then 'sin_dato' else 'al_dia' end,
                            'serie', (select jsonb_agg(s.brecha order by s.dia) from control.serie_tasas(d - 29, d) s)),
         now();
end;
$$;

-- 3.6 LO MÍO (Mi día): tareas y decisiones de quien mira. Estado de hoy.
create or replace function ui.m_mis_tareas(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = nucleo, ui, public as $$
  select count(*)::numeric, null::numeric,
         jsonb_build_object('vencidas', count(*) filter (where t.vence < org.hoy()),
                            'vencen_hoy', count(*) filter (where t.vence = org.hoy()),
                            'actualizado_en', max(t.creado_en)),
         now()
    from nucleo.tarea t
   where t.asignada_a = (select auth.uid()) and t.estado = 'abierta';
$$;

create or replace function ui.m_por_decidir(p_al date default null, p_escenario uuid default null)
returns table (valor numeric, total numeric, detalle jsonb, calculado_en timestamptz)
language sql stable security invoker set search_path = flujo, ui, public as $$
  select count(*)::numeric, null::numeric,
         jsonb_build_object('mas_de_5_dias', count(*) filter (where b.esperando_desde < now() - interval '5 days'),
                            'actualizado_en', max(b.esperando_desde)),
         now()
    from flujo.bandeja() b;
$$;

do $$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'ui' and (p.proname like 'm\_%' or p.proname in ('dotacion_base', 'procesos_base'))
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4) EL DESPACHADOR
-- -----------------------------------------------------------------------------
-- Lee la definición, revisa el permiso del registro (el mismo de la pantalla de
-- origen), ejecuta la función con la sesión de quien pregunta y devuelve todo en
-- un JSON. Sin permiso devuelve la definición con `permitida = false` y sin
-- cifra. Si la función falla, el error viaja en el JSON y no tumba la página.
create or replace function ui.metrica(p_clave text, p_al date default null, p_escenario uuid default null)
returns jsonb
language plpgsql volatile security invoker set search_path = ui, public, pg_catalog as $$
declare
  m ui.metrica;
  r record;
  base jsonb;
  t0 timestamptz := clock_timestamp();
  fn regproc;
begin
  select * into m from ui.metrica where clave = p_clave and estado <> 'retirada';
  if not found then
    raise exception 'No hay una métrica «%» en el registro', p_clave using errcode = 'no_data_found';
  end if;
  base := jsonb_build_object(
    'clave', m.clave, 'nombre', m.nombre, 'definicion', m.definicion, 'unidad', m.unidad, 'modulo', m.modulo,
    'recurso', m.recurso, 'accion', m.accion, 'dueno', m.dueno, 'fuente', m.fuente, 'href', m.href, 'version', m.version,
    'con_fecha', m.con_fecha, 'con_escenario', m.con_escenario,
    'al', coalesce(p_al, org.hoy()), 'escenario', case when m.con_escenario then p_escenario end);
  if not public.puede(m.recurso, m.accion) then
    return base || jsonb_build_object('permitida', false);
  end if;
  fn := to_regproc(m.consulta);
  if fn is null then
    return base || jsonb_build_object('permitida', true, 'error', format('La función %s no existe', m.consulta));
  end if;
  begin
    execute format('select * from %s($1, $2)', fn) into r
      using coalesce(p_al, org.hoy()), case when m.con_escenario then p_escenario end;
  exception when others then
    return base || jsonb_build_object('permitida', true, 'error', sqlerrm);
  end;
  return base || jsonb_build_object(
    'permitida', true, 'valor', r.valor, 'total', r.total, 'detalle', coalesce(r.detalle, '{}'::jsonb),
    'calculado_en', r.calculado_en, 'ms', round(extract(epoch from clock_timestamp() - t0) * 1000));
end;
$$;
revoke execute on function ui.metrica(text, date, uuid) from public, anon;
grant execute on function ui.metrica(text, date, uuid) to authenticated;

-- Varias de una vez, en el orden pedido (sin lista: todas las vigentes del registro).
create or replace function ui.metricas(p_claves text[] default null, p_al date default null, p_escenario uuid default null)
returns setof jsonb
language plpgsql volatile security invoker set search_path = ui, public, pg_catalog as $$
declare c text;
begin
  for c in
    select m.clave from ui.metrica m
     where (p_claves is null and m.estado = 'vigente') or m.clave = any (p_claves)
     order by coalesce(array_position(p_claves, m.clave), 0), m.orden, m.clave
  loop
    return next ui.metrica(c, p_al, p_escenario);
  end loop;
end;
$$;
revoke execute on function ui.metricas(text[], date, uuid) from public, anon;
grant execute on function ui.metricas(text[], date, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5) EL CONTENIDO DEL REGISTRO
-- -----------------------------------------------------------------------------
insert into ui.metrica (clave, nombre, definicion, unidad, modulo, recurso, accion, dueno, fuente, consulta, href, con_fecha, con_escenario, orden) values
  ('dotacion_aprobada', 'Dotación aprobada',
   'Suma de la dotación (puestos aprobados) de todas las plazas vigentes en la fecha de «Datos al». Una plaza cerrada deja de estar vigente desde su fecha de cierre. En un escenario de estructura, cuenta las plazas del escenario en lugar de las que reemplaza. Es el pie de la columna «Dotación» de la tabla Plazas.',
   'puestos', 'NUC-ORG', 'sistema:estructura', 'ver', 'Director de Capital Humano', 'Estructura: plazas vigentes (organigramas II-21-14 y ediciones)',
   'ui.m_dotacion_aprobada', '/sistema/nucleo/organizacion/plazas', true, true, 10),
  ('dotacion_ocupada', 'Dotación ocupada',
   'Personas titulares en plazas vigentes en la fecha de «Datos al», contra la dotación aprobada. Cuenta solo la ocupación de tipo titular vigente ese día (no encargadurías ni suplencias). Una plaza con más titulares que su dotación suma todos: el exceso se ve en «Por encima». Es el pie de la columna «Ocupadas» de la tabla Plazas.',
   'personas', 'NUC-ORG', 'sistema:estructura', 'ver', 'Director de Capital Humano', 'Estructura: plazas y titulares vigentes',
   'ui.m_dotacion_ocupada', '/sistema/nucleo/organizacion/plazas?orden=ocupadas&dir=desc', true, true, 11),
  ('dotacion_vacantes', 'Vacantes',
   'Puestos aprobados sin titular en la fecha de «Datos al»: por cada plaza, la dotación menos sus titulares, si es positiva. Una plaza por encima de su dotación no resta vacantes de otra. Es el pie de la columna «Vacantes» de la tabla Plazas.',
   'puestos', 'NUC-ORG', 'sistema:estructura', 'ver', 'Director de Capital Humano', 'Estructura: plazas y titulares vigentes',
   'ui.m_dotacion_vacantes', '/sistema/nucleo/organizacion/plazas?orden=vacantes&dir=desc', true, true, 12),
  ('dotacion_por_encima', 'Por encima de la dotación',
   'Titulares por encima de la dotación aprobada en la fecha de «Datos al»: por cada plaza, sus titulares menos su dotación, si es positivo. Es un hallazgo de la estructura, no un error de carga. Es el pie de la columna «Por encima» de la tabla Plazas.',
   'personas', 'NUC-ORG', 'sistema:estructura', 'ver', 'Director de Capital Humano', 'Estructura: plazas y titulares vigentes',
   'ui.m_dotacion_por_encima', '/sistema/nucleo/organizacion/plazas?orden=exceso&dir=desc', true, true, 13),
  ('dotacion_en_requisicion', 'En requisición',
   'Personas pedidas en requisiciones de personal vivas (en aprobación, aprobadas o en selección), sumando la cantidad de cada una. Cuenta todas las requisiciones aunque quien mira no pueda abrirlas: es una cifra, no su contenido. Es el estado de hoy. Es el pie de la columna «En requisición» de la tabla Dotación.',
   'personas', 'NUC-ORG', 'sistema:dotacion', 'ver', 'Gerente de Recursos Humanos', 'Requisiciones de personal (II-21-40-001) y plan de dotación',
   'ui.m_dotacion_en_requisicion', '/sistema/nucleo/organizacion/dotacion', false, false, 14),
  ('requisiciones_abiertas', 'Requisiciones abiertas',
   'Requisiciones de personal en aprobación, aprobadas o en selección, de las que puedes ver (con el permiso de requisiciones, todas; sin él, las tuyas y las que firmas). No cuenta borradores, cubiertas, rechazadas ni canceladas. Es el estado de hoy.',
   'requisiciones', 'NUC-ORG', 'sistema:requisiciones', 'ver', 'Gerente de Recursos Humanos', 'Requisiciones de personal (II-21-40-001)',
   'ui.m_requisiciones_abiertas', '/sistema/nucleo/organizacion/requisiciones?f.estado=en_aprobacion&f.estado=aprobada&f.estado=en_seleccion', false, false, 20),
  ('mis_requisiciones', 'Mis requisiciones',
   'Requisiciones que pediste tú y siguen vivas: en borrador, en aprobación, aprobadas o en selección. El total son todas las que has pedido. Es el estado de hoy.',
   'requisiciones', 'NUC-ORG', 'sistema:requisiciones', 'crear', 'Gerente de Recursos Humanos', 'Requisiciones de personal (II-21-40-001)',
   'ui.m_mis_requisiciones', '/sistema/nucleo/organizacion/requisiciones?f.mia=si', false, false, 21),
  ('procesos_catalogo', 'Procesos en el catálogo',
   'Nodos del mapa de procesos de los cuatro niveles (macroproceso, proceso, subproceso y actividad) en la versión que regía en la fecha de «Datos al». No cuenta los procesos nuevos que solo existen como borrador (salen en el catálogo marcados «nuevo»). En un escenario de procesos, cuenta los del escenario sin los que quita.',
   'procesos', 'NUC-PRO', 'sistema:procesos', 'ver', 'Gerente de Calidad y Desarrollo', 'Catálogo del SGC (sgc.proceso)',
   'ui.m_procesos_catalogo', '/sistema/nucleo/procesos/catalogo', true, true, 30),
  ('procesos_con_ficha', 'Procesos con ficha PHVA',
   'Procesos, subprocesos y actividades (niveles 1 a 3, sin macroprocesos) cuya versión vigente en la fecha de «Datos al» tiene ficha PHVA con contenido: algún campo escrito entre objetivo, alcance, indicadores, proveedores, entradas, salidas, clientes, recursos, riesgos, oportunidades, actividades, requisitos o registros. El total son los procesos de niveles 1 a 3 a esa fecha.',
   'procesos', 'NUC-PRO', 'sistema:procesos', 'ver', 'Gerente de Calidad y Desarrollo', 'Catálogo del SGC (sgc.proceso)',
   'ui.m_procesos_con_ficha', '/sistema/nucleo/procesos/catalogo?f.tiene_ficha=true&f.nivel_nombre=Proceso&f.nivel_nombre=Subproceso&f.nivel_nombre=Actividad', true, true, 31),
  ('procesos_con_dueno', 'Procesos con dueño casado',
   'Procesos del catálogo (los cuatro niveles, a la fecha de «Datos al») cuyo dueño es una plaza de la estructura vigente, tenga o no titular. No cuenta los que solo nombran un dueño en texto ni los que no tienen dueño. El total es el catálogo.',
   'procesos', 'NUC-PRO', 'sistema:procesos', 'ver', 'Gerente de Calidad y Desarrollo', 'Catálogo del SGC y plazas de la estructura',
   'ui.m_procesos_con_dueno', '/sistema/nucleo/procesos/catalogo?f.dueno_estado=asignado&f.dueno_estado=vacante', true, true, 32),
  ('procesos_en_revision', 'Procesos en revisión',
   'Procesos cuya versión abierta más reciente está en revisión del comité (enviada a aprobación). Cuenta también los procesos nuevos. Los borradores y las aprobadas por publicar van aparte en el detalle. Es el estado de hoy.',
   'procesos', 'NUC-PRO', 'sistema:procesos', 'ver', 'Gerente de Calidad y Desarrollo', 'Catálogo del SGC y rutas de aprobación',
   'ui.m_procesos_en_revision', '/sistema/nucleo/procesos/catalogo?f.ciclo=en_revision', false, false, 33),
  ('procesos_sin_documentar', 'Procesos sin documentar',
   'Procesos del catálogo (los cuatro niveles, a la fecha de «Datos al») sin ficha PHVA con contenido, sin documentos vinculados y sin revisión abierta. El total es el catálogo.',
   'procesos', 'NUC-PRO', 'sistema:procesos', 'ver', 'Gerente de Calidad y Desarrollo', 'Catálogo del SGC e inventario documental',
   'ui.m_procesos_sin_documentar', '/sistema/nucleo/procesos/catalogo?f.salud=sin_documentar', true, true, 34),
  ('procesos_validados', 'Procesos validados en la plataforma',
   'Procesos de niveles 1 a 3 cuya versión vigente en la fecha de «Datos al» pasó por la ruta de aprobación de la plataforma y fue aprobada. Cuenta solicitudes que la RLS no deja abrir: devuelve la cifra, no su contenido. El total son los procesos de niveles 1 a 3 a esa fecha.',
   'procesos', 'NUC-PRO', 'sistema:procesos', 'ver', 'Gerente de Calidad y Desarrollo', 'Catálogo del SGC y solicitudes aprobadas (flujo)',
   'ui.m_procesos_validados', '/sistema/nucleo/procesos/validacion', true, false, 35),
  ('documentos_vigentes', 'Documentos vigentes',
   'Documentos del inventario del SGC en estado vigente, de los que puedes ver: sin el permiso de perímetros, los de nómina, servicio médico, PCP y fórmulas no cuentan. El total es todo el inventario que puedes ver. Es el estado de hoy.',
   'documentos', 'NUC-DOC', 'sistema:documentos', 'ver', 'Gerente de Calidad y Desarrollo', 'Inventario documental del SGC (sgc.documento)',
   'ui.m_documentos_vigentes', '/sistema/nucleo/documentos', false, false, 40),
  ('documentos_inventario', 'Documentos en el inventario',
   'Todos los documentos del inventario del SGC que puedes ver, en cualquier estado (vigente, sin determinar, borrador, obsoleto o retirado). Sin el permiso de perímetros, los documentos de perímetro no cuentan. Es el estado de hoy.',
   'documentos', 'NUC-DOC', 'sistema:documentos', 'ver', 'Gerente de Calidad y Desarrollo', 'Inventario documental del SGC (sgc.documento)',
   'ui.m_documentos_inventario', '/sistema/nucleo/documentos?ver=todos', false, false, 41),
  ('documentos_en_conciliacion', 'Documentos en conciliación',
   'Puntos pendientes de la cola de conciliación de documentos: estado sin determinar, obsoleto por confirmar, código reutilizado o datos sensibles, sin decisión registrada. Un documento puede tener más de un punto. Es el estado de hoy.',
   'puntos', 'NUC-DOC', 'sistema:documentos', 'ver', 'Gerente de Calidad y Desarrollo', 'Inventario del SGC y decisiones de conciliación',
   'ui.m_documentos_en_conciliacion', '/sistema/nucleo/documentos/conciliacion', false, false, 42),
  ('tasa_bcv_usd', 'BCV · dólar',
   'Tasa oficial del dólar publicada por el BCV, vigente en la fecha de «Datos al»: la última con fecha valor igual o anterior a ese día (la que se publica hoy rige el día hábil siguiente). Se marca atrasada si la fecha valor tiene más de cuatro días.',
   'Bs', 'FIN-TAS', 'sistema:inicio', 'ver', 'Gerente de Tesorería', 'bcv.org.ve',
   'ui.m_tasa_bcv_usd', '/sistema/finanzas/tasas', true, false, 50),
  ('tasa_bcv_eur', 'BCV · euro',
   'Tasa oficial del euro publicada por el BCV, vigente en la fecha de «Datos al»: la última con fecha valor igual o anterior a ese día.',
   'Bs', 'FIN-TAS', 'sistema:inicio', 'ver', 'Gerente de Tesorería', 'bcv.org.ve',
   'ui.m_tasa_bcv_eur', '/sistema/finanzas/tasas', true, false, 51),
  ('tasa_paralelo', 'Paralelo · dólar',
   'Último dólar paralelo capturado con fecha igual o anterior a «Datos al». Referencia de mercado de uso interno: nunca para facturar. Cada lectura queda registrada.',
   'Bs', 'FIN-TAS', 'sistema:tasas-paralelo', 'ver', 'Gerente de Tesorería', 've.dolarapi.com',
   'ui.m_tasa_paralelo', '/sistema/finanzas/tasas', true, false, 52),
  ('brecha_cambiaria', 'Brecha cambiaria',
   'Diferencia porcentual entre el paralelo y el BCV del dólar vigentes en la fecha de «Datos al»: paralelo ÷ BCV − 1. Uso interno. Cada lectura queda registrada.',
   '%', 'FIN-TAS', 'sistema:tasas-paralelo', 'ver', 'Gerente de Tesorería', 'paralelo ÷ BCV − 1',
   'ui.m_brecha_cambiaria', '/sistema/finanzas/tasas', true, false, 53),
  ('mis_tareas', 'Mis tareas',
   'Tareas abiertas asignadas a ti, de cualquier objeto. Las vencidas son las que tienen fecha de vencimiento anterior a hoy (hora de Caracas). Es el estado de hoy.',
   'tareas', null, 'sistema:inicio', 'ver', null, 'Tareas de la plataforma (nucleo.tarea)',
   'ui.m_mis_tareas', '/sistema/tareas', false, false, 60),
  ('por_decidir', 'Por decidir',
   'Pasos de aprobación que esperan tu decisión hoy: los asignados a ti o a tu plaza en una solicitud en curso. Es lo mismo que «Te toca decidir» y la bandeja.',
   'pasos', null, 'sistema:inicio', 'ver', null, 'Rutas de aprobación (flujo.bandeja)',
   'ui.m_por_decidir', '/sistema/bandeja', false, false, 61)
on conflict (clave) do update set
  nombre = excluded.nombre, definicion = excluded.definicion, unidad = excluded.unidad, modulo = excluded.modulo,
  recurso = excluded.recurso, accion = excluded.accion, dueno = excluded.dueno, fuente = excluded.fuente,
  consulta = excluded.consulta, href = excluded.href, con_fecha = excluded.con_fecha,
  con_escenario = excluded.con_escenario, orden = excluded.orden, actualizado_en = now();

-- El módulo DAT-SEM ya tiene su primera pantalla: el registro.
update control.modulo set ruta = '/sistema/datos/metricas', recurso = 'sistema:inicio', estado = 'en_construccion'
 where codigo = 'DAT-SEM';

-- -----------------------------------------------------------------------------
-- 6) LA PORTADA POR ROL
-- -----------------------------------------------------------------------------
create table if not exists ui.portada_rol (
  rol_id     uuid primary key references public.roles (id) on delete cascade,
  metricas   text[] not null default '{}' check (cardinality(metricas) <= 8),
  orden      integer not null default 0,
  actualizado_por uuid references public.profiles (id) default auth.uid(),
  actualizado_en  timestamptz not null default now()
);
comment on table ui.portada_rol is 'Las cifras que ve cada rol en Mi día, en su orden. Las edita Administración › Portadas.';

-- Cada clave tiene que existir en el registro.
create or replace function ui.portada_validar()
returns trigger language plpgsql set search_path = ui, public as $$
declare malas text[];
begin
  select array_agg(x) into malas from unnest(new.metricas) x where not exists (select 1 from ui.metrica m where m.clave = x);
  if malas is not null then
    raise exception 'Estas métricas no existen en el registro: %', array_to_string(malas, ', ') using errcode = 'check_violation';
  end if;
  -- Sin repetidas, en el orden en que se pusieron.
  new.metricas := array(select u.x from unnest(new.metricas) with ordinality u(x, i) group by u.x order by min(u.i));
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;
drop trigger if exists portada_validar on ui.portada_rol;
create trigger portada_validar before insert or update on ui.portada_rol
  for each row execute function ui.portada_validar();
drop trigger if exists auditar on ui.portada_rol;
create trigger auditar after insert or update or delete on ui.portada_rol
  for each row execute function control.auditar();

alter table ui.portada_rol enable row level security;
grant select, insert, update, delete on ui.portada_rol to authenticated;
grant all on ui.portada_rol to service_role;
drop policy if exists "leer portadas" on ui.portada_rol;
create policy "leer portadas" on ui.portada_rol for select to authenticated using (true);
drop policy if exists "administrar portadas" on ui.portada_rol;
create policy "administrar portadas" on ui.portada_rol for all to authenticated
  using ((select public.puede('modulo:roles', 'editar'))) with check ((select public.puede('modulo:roles', 'editar')));

-- Las portadas de partida (se pueden cambiar en la pantalla).
insert into ui.portada_rol (rol_id, metricas, orden)
select r.id,
       case r.clave
         when 'administrador' then array['dotacion_ocupada', 'procesos_con_ficha', 'documentos_vigentes', 'requisiciones_abiertas', 'tasa_bcv_usd']
         when 'consultor' then array['dotacion_ocupada', 'procesos_con_ficha', 'documentos_vigentes', 'requisiciones_abiertas', 'tasa_bcv_usd']
         when 'lector' then array['dotacion_ocupada', 'dotacion_por_encima', 'procesos_con_ficha', 'brecha_cambiaria']
         when 'usuario-iberia' then array['mis_requisiciones', 'mis_tareas', 'tasa_bcv_usd']
       end,
       case r.clave when 'administrador' then 1 when 'consultor' then 2 when 'lector' then 3 else 4 end
  from public.roles r
 where r.clave in ('administrador', 'consultor', 'lector', 'usuario-iberia')
on conflict (rol_id) do nothing;

-- -----------------------------------------------------------------------------
-- 7) RECIENTES (Ctrl K): los últimos objetos que abrió cada quien
-- -----------------------------------------------------------------------------
create table if not exists ui.reciente (
  perfil     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  tipo       text not null check (tipo in ('unidad', 'plaza', 'cargo', 'persona', 'proceso', 'documento', 'requisicion', 'escenario')),
  objeto_id  uuid not null,
  titulo     text not null check (length(titulo) <= 200),
  detalle    text check (detalle is null or length(detalle) <= 200),
  abierto_en timestamptz not null default now(),
  primary key (perfil, tipo, objeto_id)
);
create index if not exists reciente_perfil_idx on ui.reciente (perfil, abierto_en desc);
alter table ui.reciente enable row level security;
grant select, delete on ui.reciente to authenticated;
grant all on ui.reciente to service_role;
drop policy if exists "mis recientes" on ui.reciente;
create policy "mis recientes" on ui.reciente for select to authenticated using (perfil = (select auth.uid()));
drop policy if exists "borrar mis recientes" on ui.reciente;
create policy "borrar mis recientes" on ui.reciente for delete to authenticated using (perfil = (select auth.uid()));

-- Registrar una apertura: solo si quien abre puede ver el objeto. Guarda los 20
-- más nuevos por persona (la paleta muestra 8).
create or replace function ui.registrar_reciente(p_tipo text, p_id uuid, p_titulo text, p_detalle text default null)
returns void language plpgsql security definer set search_path = ui, nucleo, public as $$
begin
  if auth.uid() is null or p_tipo not in ('unidad', 'plaza', 'cargo', 'persona', 'proceso', 'documento', 'requisicion', 'escenario') then
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
revoke execute on function ui.registrar_reciente(text, uuid, text, text) from public, anon;
grant execute on function ui.registrar_reciente(text, uuid, text, text) to authenticated;

-- Los últimos 8 que todavía puedes ver (si te quitaron el permiso, no salen).
create or replace function ui.recientes(p_limite integer default 8)
returns table (tipo text, id text, titulo text, detalle text, abierto_en timestamptz)
language sql stable security invoker set search_path = ui, nucleo, public as $$
  select r.tipo, r.objeto_id::text, r.titulo, r.detalle, r.abierto_en
    from ui.reciente r
   where r.perfil = (select auth.uid()) and nucleo.puede_ver_objeto(r.tipo, r.objeto_id)
   order by r.abierto_en desc
   limit least(greatest(coalesce(p_limite, 8), 1), 20);
$$;
grant execute on function ui.recientes(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- 8) LA BÚSQUEDA DE CTRL K, COMPLETA
-- -----------------------------------------------------------------------------
-- security invoker: cada bloque lee su tabla con la RLS de quien busca (sin
-- estructura no salen unidades, plazas, cargos ni personas; sin perímetro no
-- salen sus documentos; sin escenarios, no salen escenarios). Todo sin tildes ni
-- mayúsculas. Paginado por sección: `p_tipo` + `p_desde` traen la página
-- siguiente de una sola sección, y cada fila trae el total de su sección.
drop function if exists ui.buscar(text, integer);
drop function if exists ui.buscar(text, integer, text, integer);
create or replace function ui.buscar(p_q text, p_limite integer default 6, p_tipo text default null, p_desde integer default 0)
returns table (tipo text, id text, codigo text, titulo text, detalle text, href text, rango integer, total integer)
language sql stable security invoker set search_path = ui, org, sgc, control, public, extensions as $$
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
  ) r(tipo, id, codigo, titulo, detalle, href, rango, total);
$$;
comment on function ui.buscar(text, integer, text, integer) is
  'La búsqueda de Ctrl K (R5): objetos y módulos sin tildes, con la RLS de quien busca, paginada por sección.';
revoke execute on function ui.buscar(text, integer, text, integer) from public, anon;
grant execute on function ui.buscar(text, integer, text, integer) to authenticated;

notify pgrst, 'reload schema';
