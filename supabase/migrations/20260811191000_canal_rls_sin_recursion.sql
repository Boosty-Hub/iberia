-- =============================================================================
-- Canal · romper la recursión de las políticas
--
-- Las políticas de conversacion_participantes y grupo_miembros se preguntaban
-- por sí mismas ("soy participante si existe una fila donde soy participante"),
-- y Postgres lo corta con «infinite recursion detected in policy». El síntoma
-- era mudo: abrir una conversación desde el directorio no hacía nada.
--
-- La salida es la de siempre en Postgres: sacar la pregunta a una función
-- SECURITY DEFINER, que consulta la tabla sin volver a pasar por RLS. Cada
-- función responde solo por quien la llama, así que no abre nada nuevo.
-- =============================================================================

create or replace function public.participo_en(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversacion_participantes p
     where p.conversacion_id = conv
       and p.empleado_id = public.mi_empleado()
  );
$$;

create or replace function public.soy_miembro(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.grupo_miembros m
     where m.grupo_id = grupo
       and m.empleado_id = public.mi_empleado()
  );
$$;

create or replace function public.coordino_grupo(grupo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.grupos g
     where g.id = grupo and g.creador_id = public.mi_empleado()
  );
$$;

-- Cuántos participan ya en un hilo: es lo que impide convertir un 1:1 ajeno
-- en un grupo agregando gente.
create or replace function public.cabe_otro_participante(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversaciones c
     where c.id = conv
       and (
         c.tipo = 'grupo'
         or (select count(*) from public.conversacion_participantes p
              where p.conversacion_id = c.id) < 2
       )
  );
$$;

-- --- conversacion_participantes ----------------------------------------------

drop policy if exists "mi participacion" on public.conversacion_participantes;
create policy "mi participacion" on public.conversacion_participantes
  for select to authenticated
  using (
    empleado_id = public.mi_empleado()
    or public.participo_en(conversacion_id)
  );

drop policy if exists "armo la conversacion" on public.conversacion_participantes;
create policy "armo la conversacion" on public.conversacion_participantes
  for insert to authenticated
  with check (
    empleado_id = public.mi_empleado()
    or (
      public.participo_en(conversacion_id)
      and public.cabe_otro_participante(conversacion_id)
    )
  );

-- --- conversaciones -----------------------------------------------------------

drop policy if exists "mis conversaciones" on public.conversaciones;
create policy "mis conversaciones" on public.conversaciones
  for select to authenticated
  using (public.participo_en(id) or public.soy_miembro(grupo_id));

drop policy if exists "abro conversaciones" on public.conversaciones;
create policy "abro conversaciones" on public.conversaciones
  for insert to authenticated
  with check (tipo = 'directa' or public.soy_miembro(grupo_id));

-- --- mensajes ------------------------------------------------------------------

drop policy if exists "leo mis mensajes" on public.mensajes;
create policy "leo mis mensajes" on public.mensajes
  for select to authenticated
  using (estado <> 'eliminado' and public.participo_en(conversacion_id));

drop policy if exists "escribo donde participo" on public.mensajes;
create policy "escribo donde participo" on public.mensajes
  for insert to authenticated
  with check (autor_id = public.mi_empleado() and public.participo_en(conversacion_id));

-- --- grupos y miembros ----------------------------------------------------------

drop policy if exists "grupos visibles" on public.grupos;
create policy "grupos visibles" on public.grupos
  for select to authenticated
  using (tipo = 'abierto' or public.soy_miembro(id) or public.puede_publicar());

drop policy if exists "miembros de mis grupos" on public.grupo_miembros;
create policy "miembros de mis grupos" on public.grupo_miembros
  for select to authenticated
  using (empleado_id = public.mi_empleado() or public.soy_miembro(grupo_id));

drop policy if exists "me uno o me sacan" on public.grupo_miembros;
create policy "me uno o me sacan" on public.grupo_miembros
  for all to authenticated
  using (empleado_id = public.mi_empleado() or public.coordino_grupo(grupo_id))
  with check (empleado_id = public.mi_empleado() or public.coordino_grupo(grupo_id));
