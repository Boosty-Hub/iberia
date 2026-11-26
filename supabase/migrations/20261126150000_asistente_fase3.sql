-- =============================================================================
-- ASISTENTE DE IA · FASE 3 · proyectos, memoria y atajos
--
--  · Proyecto: instrucciones y archivos fijos de su dueño; todo chat del
--    proyecto los recibe. Las instrucciones del proyecto se suman a las de la
--    empresa, nunca las reemplazan.
--  · Memoria: hechos de cómo trabaja cada quien (su área, cómo quiere los
--    informes), con su origen. Nunca datos de las fuentes ni de terceros. El
--    dueño la ve, la corrige, la borra y la apaga. No entra a chats compartidos.
--  · Atajos «/»: instrucciones probadas, de la empresa (los crea la
--    administración) o personales.
-- =============================================================================

create table if not exists asistente.proyecto (
  id            uuid primary key default gen_random_uuid(),
  dueno         uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  nombre        text not null check (length(trim(nombre)) between 1 and 120),
  instrucciones text not null default '' check (length(instrucciones) <= 10000),
  creado_en     timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists proyecto_dueno_idx on asistente.proyecto (dueno, actualizado_en desc);
alter table asistente.proyecto enable row level security;

alter table asistente.chat add column if not exists proyecto_id uuid references asistente.proyecto (id) on delete set null;
alter table asistente.archivo add column if not exists proyecto_id uuid references asistente.proyecto (id) on delete set null;
create index if not exists chat_proyecto_idx on asistente.chat (proyecto_id);
create index if not exists archivo_proyecto_idx on asistente.archivo (proyecto_id);

drop policy if exists "mis proyectos" on asistente.proyecto;
create policy "mis proyectos" on asistente.proyecto for all to authenticated
  using (dueno = (select auth.uid())) with check (dueno = (select auth.uid()) and (select privado.asistente_habilitado()));
grant select, insert, update, delete on asistente.proyecto to authenticated;

-- Un chat solo cuelga de un proyecto propio.
create or replace function asistente.t_chat_proyecto()
returns trigger language plpgsql security definer set search_path = asistente, public as $$
begin
  if new.proyecto_id is not null and not exists (select 1 from asistente.proyecto p where p.id = new.proyecto_id and p.dueno = new.dueno) then
    raise exception 'El proyecto no es del dueño del chat' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
drop trigger if exists b_chat_proyecto on asistente.chat;
create trigger b_chat_proyecto before insert or update of proyecto_id on asistente.chat for each row execute function asistente.t_chat_proyecto();

-- Los archivos de un proyecto los ve su dueño (ya cubierto por «veo archivos»: dueno = auth.uid()).
-- Subirlos a un proyecto: el proyecto tiene que ser propio.
drop policy if exists "subo archivos" on asistente.archivo;
create policy "subo archivos" on asistente.archivo for insert to authenticated
  with check (dueno = (select auth.uid()) and origen = 'subido' and estado = 'subiendo' and anthropic_file_id is null
              and (chat_id is null or privado.participo_en_chat(chat_id))
              and (proyecto_id is null or exists (select 1 from asistente.proyecto p where p.id = proyecto_id and p.dueno = (select auth.uid())))
              and (select privado.asistente_habilitado())
              and ruta like (select auth.uid())::text || '/%');

-- El chat: además de título y archivado, su dueño puede moverlo a un proyecto propio.
create or replace function asistente.t_chat_proteger()
returns trigger language plpgsql as $$
begin
  if current_user = 'authenticated' then
    if new.dueno is distinct from old.dueno or new.compartido is distinct from old.compartido
       or new.contenedor_id is distinct from old.contenedor_id or new.contenedor_usado_en is distinct from old.contenedor_usado_en
       or new.motor is distinct from old.motor or new.modelo is distinct from old.modelo or new.esfuerzo is distinct from old.esfuerzo
       or new.creado_en is distinct from old.creado_en then
      raise exception 'Solo se cambian el título, el proyecto y el archivado' using errcode = 'insufficient_privilege';
    end if;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Memoria
-- -----------------------------------------------------------------------------
create table if not exists asistente.memoria (
  id          uuid primary key default gen_random_uuid(),
  dueno       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  texto       text not null check (length(trim(texto)) between 3 and 500),
  origen_chat uuid references asistente.chat (id) on delete set null,
  creado_en   timestamptz not null default now(),
  usado_en    timestamptz not null default now()
);
create index if not exists memoria_dueno_idx on asistente.memoria (dueno, usado_en desc);
alter table asistente.memoria enable row level security;
drop policy if exists "mi memoria" on asistente.memoria;
create policy "mi memoria" on asistente.memoria for all to authenticated
  using (dueno = (select auth.uid())) with check (dueno = (select auth.uid()));
grant select, insert, update, delete on asistente.memoria to authenticated;

create table if not exists asistente.preferencia (
  perfil_id  uuid primary key references public.profiles (id) on delete cascade default auth.uid(),
  memoria    boolean not null default true,
  actualizado_en timestamptz not null default now()
);
alter table asistente.preferencia enable row level security;
drop policy if exists "mis preferencias" on asistente.preferencia;
create policy "mis preferencias" on asistente.preferencia for all to authenticated
  using (perfil_id = (select auth.uid())) with check (perfil_id = (select auth.uid()));
grant select, insert, update, delete on asistente.preferencia to authenticated;

-- -----------------------------------------------------------------------------
-- Atajos «/»
-- -----------------------------------------------------------------------------
create table if not exists asistente.atajo (
  id          uuid primary key default gen_random_uuid(),
  -- null = de la empresa (lo ven todos los que tienen el asistente).
  dueno       uuid references public.profiles (id) on delete cascade,
  comando     text not null check (comando ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  titulo      text not null check (length(trim(titulo)) between 2 and 80),
  instruccion text not null check (length(trim(instruccion)) between 5 and 4000),
  modelo      text,
  esfuerzo    text check (esfuerzo is null or esfuerzo in ('low', 'medium', 'high', 'xhigh', 'max')),
  creado_por  uuid references public.profiles (id) default auth.uid(),
  creado_en   timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists atajo_comando_empresa on asistente.atajo (comando) where dueno is null;
create unique index if not exists atajo_comando_propio on asistente.atajo (dueno, comando) where dueno is not null;
alter table asistente.atajo enable row level security;
drop policy if exists "veo atajos" on asistente.atajo;
create policy "veo atajos" on asistente.atajo for select to authenticated
  using (dueno = (select auth.uid()) or (dueno is null and (select privado.asistente_habilitado())) or (select public.puede('sistema:asistente-admin', 'ver')));
drop policy if exists "mis atajos" on asistente.atajo;
create policy "mis atajos" on asistente.atajo for all to authenticated
  using (dueno = (select auth.uid())) with check (dueno = (select auth.uid()));
drop policy if exists "atajos de la empresa" on asistente.atajo;
create policy "atajos de la empresa" on asistente.atajo for all to authenticated
  using (dueno is null and (select public.puede('sistema:asistente-admin', 'editar')))
  with check (dueno is null and (select public.puede('sistema:asistente-admin', 'editar')));
grant select, insert, update, delete on asistente.atajo to authenticated;

grant all on asistente.proyecto, asistente.memoria, asistente.preferencia, asistente.atajo to service_role;

-- Tres atajos de la empresa para empezar (la administración los cambia).
insert into asistente.atajo (dueno, comando, titulo, instruccion) values
  (null, 'informe-semanal', 'Informe semanal', 'Prepárame el informe semanal de {área} de la semana del {fecha}: lo hecho, lo pendiente, los riesgos y las cifras clave. Formato Word de Iberia, una página.'),
  (null, 'acta', 'Acta de reunión', 'Con estas notas, redacta el acta de la reunión: asistentes, temas tratados, acuerdos (con responsable y fecha) y próximos pasos. Formato Word de Iberia.\n\nNotas:\n{pega aquí las notas}'),
  (null, 'resumen-excel', 'Resumen de un Excel', 'Analiza el Excel que te adjunto: explícame qué contiene, revisa la calidad del dato y devuélveme un Excel con una hoja Resumen y los totales por {columna}.')
on conflict do nothing;
