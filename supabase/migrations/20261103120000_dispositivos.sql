-- =============================================================================
-- Los teléfonos a los que se les avisa: las notificaciones de la app de iOS
-- =============================================================================
--
-- 23 de octubre de 2026 (PEN-14661). La app de Iberia es el canal envuelto en
-- Capacitor, y lo que la hace una app y no una página —la regla 4.2 de la App
-- Store— es lo nativo: avisos en el teléfono y enlaces que abren la app. Para
-- avisar hace falta saber a qué teléfono, y eso es esta tabla: el token que Apple
-- le da a cada instalación, colgado de la cuenta que la está usando.
--
-- Dos cosas avisan, y nada más por ahora (`lib/notificaciones.ts`):
--   · un mensaje nuevo en una conversación del canal, a los demás participantes;
--   · un recordatorio del curso de Ajito, cuando el equipo lo da por mandado.
--
-- ── Quién lee esto ───────────────────────────────────────────────────────────
--
-- Un token no sirve para escribirle a nadie sin la clave de APNs del equipo,
-- pero identifica un aparato: no se lee desde el cliente salvo el propio. Quien
-- manda un aviso no lee la tabla: pide los tokens a una función `security
-- definer` que comprueba por dentro que puede —que participa en la conversación,
-- o que es del equipo y tiene los recordatorios—, igual que `participo_en`.
-- No se usa la clave de servicio: `AGENTS.md` la reserva para provisionar.
--
-- ── El token es del aparato, no de la persona ────────────────────────────────
--
-- Único por sí solo, nunca por (perfil, token): un teléfono que pasa de una
-- persona a otra —o en el que se cierra la sesión y entra otra— tiene que
-- llevarse el token a la cuenta nueva, no dejar viva la fila de la anterior y
-- mandarle a esta los mensajes de aquella. Por eso el alta va por
-- `registrar_dispositivo()`: con la RLS de «lo propio», la fila del otro no se
-- puede tocar y el `insert` chocaría con el índice único.
--
-- ¿Hace falta el trigger de «lo propio» (`AGENTS.md`, Seguridad)? No: la única
-- columna de acceso es `perfil_id`, y el `with check` de las políticas ya impide
-- ponerle una ajena. No hay rol, estado ni organización que proteger.
-- -----------------------------------------------------------------------------

create table if not exists public.dispositivos (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references public.profiles (id) on delete cascade,
  token       text not null unique
              check (char_length(token) between 20 and 512),
  plataforma  text not null default 'ios'
              check (plataforma in ('ios', 'android')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists dispositivos_perfil on public.dispositivos (perfil_id);

comment on table public.dispositivos is
  'El token de notificaciones de cada instalación de la app, con la cuenta que la usa. Único por token: el token es del aparato.';

drop trigger if exists dispositivos_updated_at on public.dispositivos;
create trigger dispositivos_updated_at
  before update on public.dispositivos
  for each row execute function public.set_updated_at();

-- --- RLS -----------------------------------------------------------------------
-- Cada quien con lo suyo, y nadie más. El `select` propio no es por leer: sin él
-- el `delete ... where token = …` del cierre de sesión filtra la fila en
-- silencio y dice cero borradas (`AGENTS.md`, el reinicio del curso).

alter table public.dispositivos enable row level security;
revoke all on table public.dispositivos from anon;

create policy "veo mis dispositivos" on public.dispositivos
  for select to authenticated
  using (perfil_id = auth.uid());

create policy "registro mi dispositivo" on public.dispositivos
  for insert to authenticated
  with check (perfil_id = auth.uid());

create policy "actualizo mi dispositivo" on public.dispositivos
  for update to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid());

create policy "borro mi dispositivo" on public.dispositivos
  for delete to authenticated
  using (perfil_id = auth.uid());

-- --- El alta -------------------------------------------------------------------
-- La llama la app cada vez que entra al canal con permiso de avisos: Apple puede
-- cambiar el token, y así la fila queda al día. Si el token estaba en otra
-- cuenta, pasa a esta. Solo con sesión, y solo a nombre de quien llama.

create or replace function public.registrar_dispositivo(p_token text, p_plataforma text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta una sesión para registrar el teléfono';
  end if;

  insert into public.dispositivos (perfil_id, token, plataforma)
  values (auth.uid(), p_token, p_plataforma)
  on conflict (token) do update
    set perfil_id = excluded.perfil_id,
        plataforma = excluded.plataforma,
        updated_at = now();
end;
$$;

revoke execute on function public.registrar_dispositivo(text, text) from public, anon;
grant execute on function public.registrar_dispositivo(text, text) to authenticated;

-- --- A quién se le avisa de un mensaje -------------------------------------------
-- Los teléfonos de los OTROS participantes, nunca los de quien escribe, y solo si
-- quien pregunta participa en la conversación: es la misma frontera que la RLS
-- de `mensajes`. Quien silenció la conversación no recibe aviso.

create or replace function public.dispositivos_de_conversacion(p_conversacion uuid)
returns table (token text, plataforma text)
language sql
stable
security definer
set search_path = public
as $$
  select d.token, d.plataforma
    from public.conversacion_participantes p
    join public.empleados e on e.id = p.empleado_id and e.activo
    join public.dispositivos d on d.perfil_id = e.perfil_id
   where p.conversacion_id = p_conversacion
     and public.participo_en(p_conversacion)
     and p.empleado_id is distinct from public.mi_empleado()
     and not p.silenciado
     and d.perfil_id <> auth.uid();
$$;

revoke execute on function public.dispositivos_de_conversacion(uuid) from public, anon;
grant execute on function public.dispositivos_de_conversacion(uuid) to authenticated;

-- --- A quién se le avisa de un recordatorio --------------------------------------
-- Solo el equipo, y con la casilla de los recordatorios: la misma doble llave que
-- la acción que los manda (`requerirPermiso('modulo:recordatorios', 'editar')`
-- en la app, `es_editor()` en la RLS de `recordatorios`). Solo recordatorios ya
-- mandados: el aviso acompaña al mensaje, no lo adelanta.
--
-- `leccion` es la primera que le falta, para que el aviso abra el curso donde se
-- quedó y no en el índice. Nula si ya las terminó todas.

create or replace function public.dispositivos_de_recordatorios(p_recordatorios uuid[])
returns table (recordatorio_id uuid, token text, plataforma text, leccion smallint)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         d.token,
         d.plataforma,
         (select min(l.numero)
            from public.lecciones l
           where l.curso_id = m.curso_id
             and l.activa
             and not exists (
               select 1 from public.avances a
                where a.matricula_id = m.id
                  and a.leccion_id = l.id
                  and a.estado = 'completada'
             ))
    from public.recordatorios r
    join public.matriculas m on m.id = r.matricula_id
    join public.empleados e on e.id = m.empleado_id and e.activo
    join public.dispositivos d on d.perfil_id = e.perfil_id
   where r.id = any (p_recordatorios)
     and r.estado = 'enviado'
     and public.es_editor()
     and public.puede('modulo:recordatorios', 'editar');
$$;

revoke execute on function public.dispositivos_de_recordatorios(uuid[]) from public, anon;
grant execute on function public.dispositivos_de_recordatorios(uuid[]) to authenticated;

-- --- Olvidar un token que Apple ya no reconoce -----------------------------------
-- Cuando APNs contesta 410, `Unregistered` o `BadDeviceToken`, la app se
-- desinstaló o el token caducó: se borra para no seguir intentándolo. Quien lo
-- borra es quien mandó el aviso, que no es su dueño, así que va por aquí y no por
-- la RLS. Solo puede borrar lo que pudo haber recibido de las dos funciones de
-- arriba —un token suyo, de alguien con quien comparte conversación, o cualquiera
-- si es del equipo—: nada que no haya podido ver. Si se borrara uno bueno, la app
-- lo vuelve a registrar la próxima vez que se abre.

create or replace function public.descartar_dispositivo(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.dispositivos d
   where d.token = p_token
     and (
       d.perfil_id = auth.uid()
       or public.es_editor()
       or exists (
         select 1
           from public.empleados e
           join public.conversacion_participantes p on p.empleado_id = e.id
          where e.perfil_id = d.perfil_id
            and public.participo_en(p.conversacion_id)
       )
     );
$$;

revoke execute on function public.descartar_dispositivo(text) from public, anon;
grant execute on function public.descartar_dispositivo(text) to authenticated;
