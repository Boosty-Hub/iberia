-- =============================================================================
-- EL EMPUJÓN
--
-- El curso es a su ritmo y los gerentes piden que avancen. Entre esas dos cosas
-- hay un hueco: doscientas personas matriculadas que empiezan la lección 0 un
-- martes y no vuelven. MAIA lo resuelve con recordatorios que escalan —a los 2,
-- 5, 8 y 13 días— y es de lo mejor que tiene. Esto es eso, con dos diferencias
-- que importan:
--
--  1. AQUÍ NO HAY CORREO. La vía es WhatsApp, que es la que ya funciona en esta
--     planta, y el mensaje lleva el enlace personal — que es la credencial. Eso
--     ya está resuelto en `accesos`; aquí solo se decide a quién y cuándo.
--
--  2. LA CUENTA DE WHATSAPP BUSINESS TODAVÍA NO EXISTE. Así que el sistema
--     tiene que servir **sin ella**: prepara los mensajes, los deja listos para
--     copiar, y quien los mande a mano marca que ya salieron. El día que llegue
--     la cuenta se enciende un interruptor y los mismos mensajes salen solos.
--     Un empujón que solo funciona con la integración terminada no empuja nada
--     durante los dos meses que tarde la integración.
--
-- La conexión se configura desde el panel y no desde el `.env` a propósito: la
-- va a pegar quien tenga la cuenta de Meta delante, y esa persona no despliega.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) LA CONEXIÓN CON WHATSAPP
-- -----------------------------------------------------------------------------

create table if not exists public.ajustes_whatsapp (
  -- Fila única. La restricción lo dice mejor que un comentario.
  id            boolean primary key default true check (id),

  activo        boolean not null default false,

  -- De la cuenta de WhatsApp Business, en la consola de Meta.
  id_numero     text,          -- Phone Number ID
  token         text,          -- token permanente del usuario del sistema
  plantilla     text,          -- nombre de la plantilla aprobada por Meta

  -- Cómo se ve el número para quien recibe, solo para mostrarlo en el panel.
  numero_visible text,

  -- Resultado de la última prueba de conexión, para no adivinar si sirve.
  probado_en    timestamptz,
  probado_ok    boolean,
  probado_detalle text,

  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references public.profiles (id) on delete set null
);

comment on table public.ajustes_whatsapp is
  'La conexión con WhatsApp Business. Se configura desde /dashboard/adiestramiento '
  'y no desde el .env porque la pega quien tenga la consola de Meta delante, que '
  'no es quien despliega.';

comment on column public.ajustes_whatsapp.token is
  'Secreto. La RLS lo deja solo a los administradores, y el panel nunca lo '
  'muestra de vuelta: enseña una marca de que existe y permite reemplazarlo.';

insert into public.ajustes_whatsapp (id) values (true) on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2) EL REGISTRO DE LO ENVIADO
-- -----------------------------------------------------------------------------

create table if not exists public.recordatorios (
  id            uuid primary key default gen_random_uuid(),
  matricula_id  uuid not null references public.matriculas (id) on delete cascade,

  -- A los cuántos días de silencio. Es lo que evita mandar dos veces el mismo:
  -- la pareja (matrícula, escalón) es única.
  escalon       int not null check (escalon > 0),

  via           text not null default 'a_mano'
                check (via in ('whatsapp', 'a_mano', 'canal')),
  estado        text not null default 'preparado'
                check (estado in ('preparado', 'enviado', 'fallido')),

  -- Se guarda el texto que se mandó, no solo la plantilla: si mañana se cambia
  -- la redacción, el registro tiene que seguir diciendo qué leyó esa persona.
  mensaje       text not null,
  detalle       text,          -- el error, cuando lo hubo

  enviado_en    timestamptz,
  created_at    timestamptz not null default now(),

  unique (matricula_id, escalon)
);

create index if not exists recordatorios_matricula_idx
  on public.recordatorios (matricula_id);

comment on table public.recordatorios is
  'Qué empujón se le dio a quién y cuándo. La pareja (matrícula, escalón) es '
  'única: nadie recibe dos veces el mismo recordatorio, aunque el panel se abra '
  'diez veces el mismo día.';

-- -----------------------------------------------------------------------------
-- 3) A QUIÉN LE TOCA HOY
-- -----------------------------------------------------------------------------
--
-- Los días se cuentan desde el último toque, y si nunca tocó nada, desde que se
-- matriculó. El escalón que corresponde es el más alto ya vencido — así quien
-- lleva veinte días callado recibe el de los 13 y no una ristra de cuatro.

create or replace view public.recordatorios_pendientes
with (security_invoker = on) as
select
  m.id                                   as matricula_id,
  m.curso_id,
  e.id                                   as empleado_id,
  e.nombre_completo,
  m.nombre_corto,
  e.telefono,
  e.cargo,
  a.nombre                               as area_nombre,
  m.familia_oficio,
  m.estado,
  coalesce(m.ultimo_toque, m.created_at) as callado_desde,
  extract(day from now() - coalesce(m.ultimo_toque, m.created_at))::int as dias,
  (select count(*) from public.avances av
    where av.matricula_id = m.id and av.estado = 'completada')          as lecciones_hechas,
  (select max(r.escalon) from public.recordatorios r
    where r.matricula_id = m.id and r.estado <> 'fallido')              as ultimo_escalon
from public.matriculas m
join public.empleados e on e.id = m.empleado_id
left join public.areas a on a.id = e.area_id
join public.cursos c on c.id = m.curso_id
where m.estado <> 'completado'
  and e.activo
  and c.abierto;

comment on view public.recordatorios_pendientes is
  'Quién lleva días sin tocar el curso, con cuántas lecciones hechas y qué '
  'escalón se le mandó ya. Qué escalón toca ahora lo decide la aplicación, no '
  'la vista: la escalera está escrita en el guion y se cambia ahí.';

-- -----------------------------------------------------------------------------
-- 4) RLS
-- -----------------------------------------------------------------------------

alter table public.ajustes_whatsapp enable row level security;
alter table public.recordatorios    enable row level security;

-- El token es un secreto de la integración. Solo administradores, y el panel
-- además nunca lo pinta de vuelta.
create policy "solo administradores ven la conexion" on public.ajustes_whatsapp
  for select to authenticated using (public.es_admin());

create policy "solo administradores configuran la conexion" on public.ajustes_whatsapp
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- El recordatorio dice que a fulano se le está insistiendo. Lo ven los editores
-- de Boosty, que son quienes empujan. Su supervisor no — la misma línea que con
-- las respuestas del curso.
create policy "editores gestionan los recordatorios" on public.recordatorios
  for all to authenticated
  using (public.es_editor()) with check (public.es_editor());
