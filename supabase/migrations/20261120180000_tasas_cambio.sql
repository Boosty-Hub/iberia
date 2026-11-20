-- =============================================================================
-- PLATAFORMA IBERIA · tasas de cambio: BCV (dólar y euro) y paralelo, con brecha
--
-- Decisión de Gabriel (20-nov-2026): la oficial se toma de bcv.org.ve y se
-- verifica contra DolarApi; el paralelo, de DolarApi. Plan en el Anexo E §6.
--
--   · Solo inserción: una corrección es una fila nueva con motivo; la anterior
--     pasa a «reemplazada». Nunca se edita una tasa.
--   · `fecha_valor`: la tasa que el BCV publica el día D rige el día hábil
--     siguiente. La vigente de un día es la última con fecha_valor <= ese día.
--   · El paralelo es referencia de mercado, uso interno, NUNCA para facturar,
--     contabilizar ni fijar precios. Lo leen solo quienes tienen
--     `sistema:tasas-paralelo`, y cada lectura del día queda registrada.
-- =============================================================================

create table if not exists control.tasa_cambio (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('oficial', 'paralelo')),
  fuente        text not null check (fuente in ('bcv_web', 'bcv_xls', 'dolarapi', 'manual')),
  moneda        text not null check (moneda in ('USD', 'EUR')),
  lado          text not null default 'venta' check (lado in ('compra', 'venta', 'promedio')),
  tasa          numeric(20, 8) not null check (tasa > 0),
  fecha_valor   date not null,
  publicada_en  timestamptz,
  capturada_en  timestamptz not null default now(),
  metodo        text not null check (metodo in ('web', 'xls', 'api', 'manual', 'cruce')),
  estado        text not null default 'vigente' check (estado in ('vigente', 'reemplazada')),
  reemplaza_id  bigint references control.tasa_cambio (id),
  verificada_con text,            -- p. ej. «dolarapi 918,7662 · coincide»
  motivo        text,
  creado_por    uuid default auth.uid() references public.profiles (id),
  payload       jsonb
);
-- Una sola oficial vigente por moneda y fecha valor. El paralelo guarda varias
-- capturas por día (9, 13 y 17 h); la del día es la última.
create unique index if not exists tasa_oficial_unica
  on control.tasa_cambio (moneda, fecha_valor) where tipo = 'oficial' and estado = 'vigente';
create index if not exists tasa_busqueda_idx on control.tasa_cambio (tipo, moneda, fecha_valor desc, capturada_en desc);
alter table control.tasa_cambio enable row level security;

-- La tasa no se edita: solo se marca reemplazada.
create or replace function control.tasa_inmutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Una tasa no se borra: se reemplaza con motivo' using errcode = 'insufficient_privilege';
  end if;
  if (new.tasa, new.fecha_valor, new.moneda, new.tipo, new.fuente) is distinct from (old.tasa, old.fecha_valor, old.moneda, old.tipo, old.fuente) then
    raise exception 'Una tasa no se edita: se carga una nueva que la reemplaza' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger tasa_inmutable before update or delete on control.tasa_cambio
  for each row execute function control.tasa_inmutable();
create trigger auditar after insert or update on control.tasa_cambio
  for each row execute function control.auditar();

grant select, insert on control.tasa_cambio to authenticated;
grant all on control.tasa_cambio to service_role;
-- La oficial la lee cualquiera con sesión; el paralelo, solo con su permiso.
create policy "leer oficiales" on control.tasa_cambio for select to authenticated
  using (tipo = 'oficial' or public.puede('sistema:tasas-paralelo', 'ver'));
-- La carga manual (respaldo) pide editar tasas; el resto lo carga el capturador.
create policy "cargar a mano" on control.tasa_cambio for insert to authenticated
  with check (public.puede('sistema:tasas', 'editar') and fuente = 'manual' and metodo = 'manual'
              and coalesce(trim(motivo), '') <> '' and creado_por = auth.uid()
              and (tipo = 'oficial' or public.puede('sistema:tasas-paralelo', 'ver')));

-- Quién leyó el paralelo y cuándo (una fila por persona y día).
create table if not exists control.lectura_paralelo (
  perfil_id uuid not null references public.profiles (id),
  dia       date not null default (now() at time zone 'America/Caracas')::date,
  primera   timestamptz not null default now(),
  primary key (perfil_id, dia)
);
alter table control.lectura_paralelo enable row level security;
grant select on control.lectura_paralelo to authenticated;
grant all on control.lectura_paralelo to service_role;
create policy "auditoría lee las lecturas" on control.lectura_paralelo for select to authenticated
  using (public.puede('sistema:auditoria', 'ver'));

-- Las tasas de un día, para la barra: oficial USD y EUR vigentes (con la de la
-- víspera para la variación) y, con permiso, el paralelo y la brecha. Registra
-- la lectura del paralelo.
create or replace function control.tasas_del_dia(p_dia date default null)
returns jsonb
language plpgsql security definer set search_path = control, public as $$
declare
  d date := coalesce(p_dia, (now() at time zone 'America/Caracas')::date);
  v_usd record; v_usd_ant record; v_eur record; v_par record; v_par_ant record;
  v_ve_par boolean := public.puede('sistema:tasas-paralelo', 'ver');
  r jsonb;
begin
  select tasa, fecha_valor, capturada_en, verificada_con into v_usd from control.tasa_cambio
   where tipo = 'oficial' and moneda = 'USD' and estado = 'vigente' and fecha_valor <= d order by fecha_valor desc limit 1;
  select tasa, fecha_valor into v_usd_ant from control.tasa_cambio
   where tipo = 'oficial' and moneda = 'USD' and estado = 'vigente' and fecha_valor < v_usd.fecha_valor order by fecha_valor desc limit 1;
  select tasa, fecha_valor into v_eur from control.tasa_cambio
   where tipo = 'oficial' and moneda = 'EUR' and estado = 'vigente' and fecha_valor <= d order by fecha_valor desc limit 1;
  r := jsonb_build_object(
    'dia', d,
    'usd', v_usd.tasa, 'usd_fecha_valor', v_usd.fecha_valor, 'usd_capturada', v_usd.capturada_en, 'usd_verificada', v_usd.verificada_con,
    'usd_anterior', v_usd_ant.tasa,
    'eur', v_eur.tasa, 'eur_fecha_valor', v_eur.fecha_valor,
    've_paralelo', v_ve_par);
  if v_ve_par then
    select tasa, fecha_valor, capturada_en into v_par from control.tasa_cambio
     where tipo = 'paralelo' and moneda = 'USD' and estado = 'vigente' and fecha_valor <= d order by fecha_valor desc, capturada_en desc limit 1;
    select tasa into v_par_ant from control.tasa_cambio
     where tipo = 'paralelo' and moneda = 'USD' and estado = 'vigente' and fecha_valor < v_par.fecha_valor order by fecha_valor desc, capturada_en desc limit 1;
    r := r || jsonb_build_object(
      'paralelo', v_par.tasa, 'paralelo_capturada', v_par.capturada_en,
      'brecha', case when v_usd.tasa > 0 and v_par.tasa is not null then round((v_par.tasa / v_usd.tasa - 1) * 100, 2) end,
      'brecha_anterior', case when v_usd_ant.tasa > 0 and v_par_ant.tasa is not null then round((v_par_ant.tasa / v_usd_ant.tasa - 1) * 100, 2) end);
    if auth.uid() is not null then
      insert into control.lectura_paralelo (perfil_id) values (auth.uid()) on conflict do nothing;
    end if;
  end if;
  return r;
end;
$$;
grant execute on function control.tasas_del_dia(date) to authenticated;

-- La serie diaria para el historial y los gráficos: la oficial vigente de cada
-- día (escalón: los días sin publicación heredan la última) y, con permiso, el
-- último paralelo de cada día y la brecha.
create or replace function control.serie_tasas(p_desde date, p_hasta date default null)
returns table (dia date, usd numeric, eur numeric, usd_fecha_valor date, paralelo numeric, brecha numeric)
language sql stable security definer set search_path = control, public as $$
  with dias as (
    select g::date as dia from generate_series(p_desde, coalesce(p_hasta, (now() at time zone 'America/Caracas')::date), interval '1 day') g
  )
  select d.dia, u.tasa, e.tasa, u.fecha_valor,
         case when public.puede('sistema:tasas-paralelo', 'ver') then p.tasa end,
         case when public.puede('sistema:tasas-paralelo', 'ver') and u.tasa > 0 and p.tasa is not null then round((p.tasa / u.tasa - 1) * 100, 2) end
    from dias d
    left join lateral (select tasa, fecha_valor from control.tasa_cambio where tipo = 'oficial' and moneda = 'USD' and estado = 'vigente' and fecha_valor <= d.dia order by fecha_valor desc limit 1) u on true
    left join lateral (select tasa from control.tasa_cambio where tipo = 'oficial' and moneda = 'EUR' and estado = 'vigente' and fecha_valor <= d.dia order by fecha_valor desc limit 1) e on true
    left join lateral (select tasa from control.tasa_cambio where tipo = 'paralelo' and moneda = 'USD' and estado = 'vigente' and fecha_valor = d.dia order by capturada_en desc limit 1) p on true
   order by d.dia;
$$;
grant execute on function control.serie_tasas(date, date) to authenticated;

-- El costo de personal sigue leyendo org.tasa_cambio: el capturador también la
-- alimenta con la oficial USD (una fila por fecha valor).
comment on table control.tasa_cambio is 'Tasas BCV (USD, EUR) y paralelo USD, solo inserción, con fecha valor. El paralelo es referencia interna: nunca para facturar.';
