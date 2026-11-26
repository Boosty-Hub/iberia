-- =============================================================================
-- ASISTENTE DE IA · FASE 4 · chats compartidos y compartir archivos
--
--  · Chat compartido: el dueño invita a otros que tengan el asistente; todos ven
--    lo que hay en el chat (compartir es a propósito, decisión P1). Cada mensaje
--    nuevo consulta con los permisos y el alcance de quien lo escribe, y el gasto
--    va a quien escribe. La memoria personal no entra.
--  · Compartir un archivo o un artefacto con otra persona: el servidor revisa
--    antes el LINAJE (las fuentes de la plataforma que alimentaron el turno que
--    lo produjo) contra los permisos y el alcance de quien recibe.
-- =============================================================================

-- Los nombres de quienes participan (el directorio no se abre por aquí: solo
-- los de este chat, y solo a quien participa).
create or replace function asistente.participantes(p_chat uuid)
returns table (perfil_id uuid, nombre text, rol text)
language sql stable security definer set search_path = asistente, public as $$
  select p.perfil_id, coalesce(nullif(pr.nombre_completo, ''), 'Sin nombre'), p.rol
    from asistente.participante p join public.profiles pr on pr.id = p.perfil_id
   where p.chat_id = p_chat and privado.participo_en_chat(p_chat)
   order by p.desde;
$$;
revoke all on function asistente.participantes(uuid) from public, anon;
grant execute on function asistente.participantes(uuid) to authenticated;

-- Las personas con el asistente habilitado (para invitar o compartir): solo nombres.
create or replace function asistente.personas_con_asistente()
returns table (perfil_id uuid, nombre text)
language sql stable security definer set search_path = asistente, public as $$
  select p.id, coalesce(nullif(p.nombre_completo, ''), 'Sin nombre')
    from public.profiles p
   where p.activo and p.id <> auth.uid() and privado.asistente_habilitado()
     and coalesce((asistente.politica_de(p.id) ->> 'habilitado')::boolean, false)
   order by 2;
$$;
revoke all on function asistente.personas_con_asistente() from public, anon;
grant execute on function asistente.personas_con_asistente() to authenticated;

-- Invitar: solo el dueño, solo a quien tiene el asistente. El chat pasa a compartido.
create or replace function asistente.invitar(p_chat uuid, p_perfil uuid)
returns void
language plpgsql security definer set search_path = asistente, public as $$
begin
  if not exists (select 1 from asistente.chat c where c.id = p_chat and c.dueno = auth.uid()) then
    raise exception 'Solo el dueño del chat invita' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce((asistente.politica_de(auth.uid()) ->> 'puede_compartir')::boolean, false) then
    raise exception 'Tu política no te deja compartir' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce((asistente.politica_de(p_perfil) ->> 'habilitado')::boolean, false) then
    raise exception 'Esa persona no tiene el asistente de IA habilitado' using errcode = 'check_violation';
  end if;
  insert into asistente.participante (chat_id, perfil_id, rol) values (p_chat, p_perfil, 'participante') on conflict do nothing;
  update asistente.chat set compartido = true where id = p_chat;
end;
$$;
revoke all on function asistente.invitar(uuid, uuid) from public, anon;
grant execute on function asistente.invitar(uuid, uuid) to authenticated;

-- Sacar: el dueño saca a cualquiera (menos a sí mismo); cada quien se sale solo.
drop policy if exists "salgo o saco" on asistente.participante;
create policy "salgo o saco" on asistente.participante for delete to authenticated
  using (rol <> 'dueno' and (perfil_id = (select auth.uid())
         or exists (select 1 from asistente.chat c where c.id = chat_id and c.dueno = (select auth.uid()))));
grant delete on asistente.participante to authenticated;

-- Las fuentes que ya aparecen en un chat (para avisar al invitar, decisión P1).
create or replace function asistente.fuentes_del_chat(p_chat uuid)
returns table (fuente text, veces bigint)
language sql stable security definer set search_path = asistente, public as $$
  select q.fuente, count(*) from asistente.consulta_fuente q join asistente.turno t on t.id = q.turno_id
   where t.chat_id = p_chat and privado.participo_en_chat(p_chat)
   group by q.fuente order by 2 desc;
$$;
revoke all on function asistente.fuentes_del_chat(uuid) from public, anon;
grant execute on function asistente.fuentes_del_chat(uuid) to authenticated;

-- Un mensaje para el grupo, sin turno (no le pregunta al asistente): ya lo
-- permite «escribo mis mensajes» (turno_id null).

-- -----------------------------------------------------------------------------
-- Compartir un archivo o un artefacto
-- -----------------------------------------------------------------------------
create table if not exists asistente.compartido (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null check (tipo in ('archivo', 'html')),
  objeto_id  uuid not null,
  con        uuid not null references public.profiles (id) on delete cascade,
  por        uuid not null references public.profiles (id) on delete cascade,
  -- Las fuentes de la plataforma que lo alimentaron, revisadas al compartir.
  linaje     text[] not null default '{}',
  creado_en  timestamptz not null default now(),
  unique (tipo, objeto_id, con)
);
create index if not exists compartido_con_idx on asistente.compartido (con, creado_en desc);
alter table asistente.compartido enable row level security;
drop policy if exists "veo lo compartido" on asistente.compartido;
create policy "veo lo compartido" on asistente.compartido for select to authenticated
  using (con = (select auth.uid()) or por = (select auth.uid()));
-- Lo escribe el servidor después de revisar el linaje; quien compartió lo retira.
drop policy if exists "retiro lo que comparti" on asistente.compartido;
create policy "retiro lo que comparti" on asistente.compartido for delete to authenticated using (por = (select auth.uid()));
grant select, delete on asistente.compartido to authenticated;
grant all on asistente.compartido to service_role;

create or replace function privado.compartido_conmigo(p_tipo text, p_objeto uuid)
returns boolean
language sql stable security definer set search_path = asistente, public as $$
  select exists (select 1 from asistente.compartido c where c.tipo = p_tipo and c.objeto_id = p_objeto and c.con = auth.uid());
$$;
revoke all on function privado.compartido_conmigo(text, uuid) from public, anon;
grant execute on function privado.compartido_conmigo(text, uuid) to authenticated, service_role;

drop policy if exists "veo archivos" on asistente.archivo;
create policy "veo archivos" on asistente.archivo for select to authenticated
  using (dueno = (select auth.uid()) or (chat_id is not null and privado.participo_en_chat(chat_id)) or privado.compartido_conmigo('archivo', id));
drop policy if exists "veo html" on asistente.html;
create policy "veo html" on asistente.html for select to authenticated
  using (dueno = (select auth.uid()) or (chat_id is not null and privado.participo_en_chat(chat_id)) or privado.compartido_conmigo('html', id));

drop policy if exists "asistente: leo lo mio y lo de mis chats" on storage.objects;
create policy "asistente: leo lo mio y lo de mis chats" on storage.objects for select to authenticated
  using (
    bucket_id = 'asistente'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or exists (select 1 from asistente.archivo a where a.ruta = storage.objects.name
                     and ((a.chat_id is not null and privado.participo_en_chat(a.chat_id)) or privado.compartido_conmigo('archivo', a.id)))
         or exists (select 1 from asistente.html h where h.ruta = storage.objects.name
                     and ((h.chat_id is not null and privado.participo_en_chat(h.chat_id)) or privado.compartido_conmigo('html', h.id))))
  );
