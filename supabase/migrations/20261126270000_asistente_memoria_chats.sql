-- =============================================================================
-- Asistente de IA: la memoria en tres capas (26-nov-2026, pedido de Gabriel)
-- =============================================================================
--
-- 1. Resumen vivo por chat: cada tanto, un modelo chico resume lo conversado
--    (decisiones, cifras acordadas, pendientes). El asistente recibe el resumen
--    más los últimos mensajes completos: no pierde el hilo, cuesta menos y un chat
--    largo no se corta.
-- 2. Buscar en los chats anteriores: una herramienta del asistente que busca en
--    las conversaciones de la persona (las suyas y las compartidas con ella),
--    solo con el servidor y nunca desde un chat compartido.
-- 3. La memoria aprende sola: del mismo resumen salen hechos estables de cómo
--    trabaja la persona, que se guardan sin pedir permiso (decisión de Gabriel) y
--    se ven y se borran en «Mi memoria», marcados como aprendidos.
-- =============================================================================

alter table asistente.chat add column if not exists resumen text check (resumen is null or length(resumen) <= 4000);
alter table asistente.chat add column if not exists resumen_hasta timestamptz;
alter table asistente.chat add column if not exists resumen_mensajes integer not null default 0;

alter table asistente.memoria add column if not exists aprendido boolean not null default false;

-- La búsqueda en español, sobre el texto de los mensajes y los resúmenes.
create index if not exists mensaje_busqueda_idx on asistente.mensaje using gin (to_tsvector('spanish', coalesce(texto, '')));
create index if not exists chat_resumen_busqueda_idx on asistente.chat using gin (to_tsvector('spanish', coalesce(resumen, '') || ' ' || coalesce(titulo, '')));

-- Lo que la persona dijo o le respondieron en sus chats (menos el actual), lo más pertinente primero. Solo el servidor:
-- el ejecutor la llama con el id de quien pregunta, después de comprobar que el chat no es compartido.
create or replace function asistente.buscar_en_chats(p_perfil uuid, p_texto text, p_excluir uuid default null, p_limite integer default 8)
returns table (chat_id uuid, titulo text, fecha timestamptz, fragmento text)
language sql stable security definer set search_path = asistente, public as $$
  with q as (select websearch_to_tsquery('spanish', left(coalesce(p_texto, ''), 300)) as consulta),
  mios as (
    select c.id, c.titulo, c.resumen from asistente.chat c
     where (c.id <> coalesce(p_excluir, '00000000-0000-0000-0000-000000000000'::uuid))
       and exists (select 1 from asistente.participante p where p.chat_id = c.id and p.perfil_id = p_perfil)
  ),
  por_mensaje as (
    select m.chat_id, m.creado_en as fecha,
           ts_headline('spanish', m.texto, q.consulta, 'MaxWords=40, MinWords=15, MaxFragments=2, FragmentDelimiter=" … "') as fragmento,
           ts_rank(to_tsvector('spanish', coalesce(m.texto, '')), q.consulta) as rango
      from asistente.mensaje m join mios on mios.id = m.chat_id, q
     where to_tsvector('spanish', coalesce(m.texto, '')) @@ q.consulta
  ),
  por_resumen as (
    select mios.id as chat_id, now() as fecha, 'Resumen del chat: ' || left(mios.resumen, 600) as fragmento,
           ts_rank(to_tsvector('spanish', coalesce(mios.resumen, '') || ' ' || coalesce(mios.titulo, '')), q.consulta) * 1.5 as rango
      from mios, q
     where mios.resumen is not null and to_tsvector('spanish', coalesce(mios.resumen, '') || ' ' || coalesce(mios.titulo, '')) @@ q.consulta
  ),
  todo as (
    select * from por_mensaje union all select * from por_resumen
  ),
  mejor as (
    select distinct on (t.chat_id) t.chat_id, t.fecha, t.fragmento, t.rango from todo t order by t.chat_id, t.rango desc
  )
  select mejor.chat_id, c.titulo, mejor.fecha, mejor.fragmento
    from mejor join asistente.chat c on c.id = mejor.chat_id
   order by mejor.rango desc, mejor.fecha desc
   limit greatest(1, least(coalesce(p_limite, 8), 12));
$$;
revoke all on function asistente.buscar_en_chats(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function asistente.buscar_en_chats(uuid, text, uuid, integer) to service_role;

notify pgrst, 'reload schema';
