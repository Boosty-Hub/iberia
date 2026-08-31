-- =============================================================================
-- No todo lo que se trabaja se le cobra a la bolsa de la fase.
--
-- El programa de formación de planta **se cobra aparte**: la cláusula 8 lo pone
-- bajo licenciamiento propio de USD 60 por despliegue individual, facturable a
-- partir de su activación en la Fase 2. Cargar sus horas contra las 107 mensuales
-- de la Fase 1 sería cobrarlo dos veces — una en la bolsa y otra en el
-- licenciamiento— y además desfigura el reporte: hoy hace ver un sobreconsumo
-- del mes 1 que no es tal.
--
-- El booleano `adicional` no alcanzaba para decir esto. Se reemplaza por
-- `imputacion`, que distingue las tres cosas que sí son distintas:
--
--   bolsa      consume las 107 h/mes de la fase en curso  (lo normal)
--   fase_2     entregable que se factura aparte en la Fase 2
--   adicional  fuera de la bolsa, aprobado por escrito ANTES de ejecutarlo
--
-- Las horas se siguen registrando en los tres casos. Lo que cambia es contra qué
-- se miden.
-- =============================================================================

-- La vista mira `adicional`, así que hay que tumbarla antes de poder soltar la
-- columna. Se vuelve a crear más abajo, ya con la imputación.
drop view if exists public.consumo_mensual;

alter table public.registros_horas
  add column if not exists imputacion text not null default 'bolsa'
    check (imputacion in ('bolsa', 'fase_2', 'adicional'));

-- Lo que estaba marcado como adicional pasa a la nueva columna.
update public.registros_horas set imputacion = 'adicional' where adicional;

alter table public.registros_horas drop column if exists adicional;

create index if not exists horas_imputacion_idx on public.registros_horas (imputacion);

comment on column public.registros_horas.imputacion is
  'Contra qué se mide la partida. `bolsa` consume las 107 h/mes de la fase; '
  '`fase_2` es entregable que se factura aparte y no descuenta; `adicional` es '
  'fuera de bolsa con aprobación previa y por escrito (cláusula 8).';

-- -----------------------------------------------------------------------------
-- La vista de consumo mensual solo cuenta lo que consume bolsa.
-- -----------------------------------------------------------------------------

create or replace view public.consumo_mensual
with (security_invoker = on) as
select
  date_trunc('month', r.fecha)::date      as mes,
  r.perfil,
  r.imputacion,
  sum(r.horas)                            as horas
from public.registros_horas r
group by 1, 2, 3;

comment on view public.consumo_mensual is
  'Horas por mes, perfil e imputación. Solo `imputacion = bolsa` se mide contra '
  'las 107 mensuales; el resto se registra pero se reporta aparte.';
