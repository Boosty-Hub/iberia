-- =============================================================================
-- EL ENLACE ES LA CREDENCIAL
--
-- Nadie de planta tiene correo corporativo. La vía que ya funciona es WhatsApp,
-- y por eso desde el principio el diseño dice que **el enlace personal es la
-- credencial**: la persona toca el enlace que le llegó y está dentro, sin
-- usuario, sin clave y sin recordar nada. La tabla `accesos` está en el esquema
-- desde la primera migración del canal para eso, guardando el hash y nunca el
-- token — pero no había nada que la usara.
--
-- Esto la pone a trabajar.
--
--  1. EL TOKEN NO SE GUARDA. Se guarda su SHA-256. Quien lea la tabla —incluido
--     quien tenga la clave de servicio— no puede suplantar a nadie: solo puede
--     comprobar un token que le presenten. Es la misma razón por la que una
--     contraseña no se guarda en claro.
--
--  2. SE PUEDE VOLVER A USAR HASTA QUE CADUQUE. El curso son nueve lecciones a
--     lo largo de semanas: un enlace de un solo uso obligaría a mandar uno
--     nuevo cada vez, que es exactamente el trámite que esto viene a quitar.
--     Se cuenta cada uso, que es lo que permite ver si alguien está entrando.
--
--  3. Y POR ESO CADUCA. Un enlace en un chat de WhatsApp es una credencial
--     reenviable. Ciento veinte días cubre la Fase 1 completa y no deja la
--     puerta abierta para siempre.
-- =============================================================================

alter table public.accesos
  add column if not exists motivo text not null default 'canal'
    check (motivo in ('canal', 'curso')),
  add column if not exists usos int not null default 0,
  add column if not exists ultimo_uso timestamptz,
  add column if not exists mensaje text;

comment on column public.accesos.motivo is
  'Para qué se acuñó. El del curso lleva a la lección donde se quedó; el del '
  'canal, al inicio.';

comment on column public.accesos.usos is
  'Cuántas veces se ha entrado con él. Un enlace con cero usos a los diez días '
  'de mandado dice que no llegó, no que la persona no quiere.';

comment on column public.accesos.mensaje is
  'El texto con el que se mandó. Se guarda porque si mañana se cambia la '
  'redacción, el registro tiene que seguir diciendo qué leyó esa persona.';

create index if not exists accesos_empleado_motivo_idx
  on public.accesos (empleado_id, motivo);

-- -----------------------------------------------------------------------------
-- Lo que el panel puede ver
-- -----------------------------------------------------------------------------
--
-- La política de `accesos` niega el SELECT a todo el mundo, y así tiene que
-- seguir: es donde viven los hashes. Pero el panel necesita saber a quién se le
-- mandó su enlace y si lo ha usado. Esta vista enseña eso y **nunca el hash**.
--
-- `security_invoker = off` la hace correr como su dueña, saltándose la política
-- de la tabla; el filtro por `es_editor()` de dentro es lo que la cierra.

create or replace view public.accesos_estado
with (security_invoker = off) as
select
  a.id,
  a.empleado_id,
  a.motivo,
  a.canal,
  a.enviado_en,
  a.expira_en,
  a.usado_en,
  a.ultimo_uso,
  a.usos,
  a.mensaje,
  a.created_at,
  (a.expira_en > now()) as vigente
from public.accesos a
where public.es_editor();

comment on view public.accesos_estado is
  'Los accesos sin el hash, para el panel. La tabla de abajo niega el SELECT a '
  'todo el mundo y así debe seguir: aquí se eligen a mano las columnas que no '
  'son secreto.';

grant select on public.accesos_estado to authenticated;

-- -----------------------------------------------------------------------------
-- El padrón con su estado, para el módulo de empleados
-- -----------------------------------------------------------------------------
--
-- Junta en una fila lo que hay que mirar para decidir a quién matricular y a
-- quién mandarle el enlace: si tiene teléfono, si tiene cuenta, si tiene
-- matrícula, cuánto lleva del curso y si su enlace está vivo. Sin esto el panel
-- haría cinco consultas por persona y doscientas personas son mil consultas.

create or replace view public.padron_estado
with (security_invoker = on) as
select
  e.id,
  e.cedula,
  e.nombre_completo,
  e.cargo,
  e.nivel,
  e.tipo_nomina,
  e.sede,
  e.telefono,
  e.email,
  e.activo,
  e.familia_oficio,
  e.area_id,
  ar.nombre                          as area_nombre,
  (e.perfil_id is not null)          as tiene_cuenta,
  m.id                               as matricula_id,
  m.estado                           as estado_matricula,
  m.ultimo_toque,
  (select count(*) from public.avances av
    where av.matricula_id = m.id and av.estado = 'completada') as lecciones_hechas,
  (select max(ac.expira_en) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_expira,
  (select max(ac.enviado_en) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_enviado,
  (select coalesce(sum(ac.usos), 0) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_usos
from public.empleados e
left join public.areas ar on ar.id = e.area_id
left join public.cursos c on c.clave = 'ajito'
left join public.matriculas m on m.empleado_id = e.id and m.curso_id = c.id;

comment on view public.padron_estado is
  'El padrón con lo que hace falta para decidir: teléfono, cuenta, matrícula, '
  'avance y estado del enlace. Es lo que lee /dashboard/empleados.';
