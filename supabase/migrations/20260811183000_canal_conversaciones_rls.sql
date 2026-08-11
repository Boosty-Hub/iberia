-- =============================================================================
-- Canal · abrir conversaciones
--
-- La migración anterior dejó conversaciones y participantes con lectura pero
-- sin inserción: se podían leer los hilos existentes y no crear ninguno. Aquí
-- se abre la puerta, con el cuidado de que nadie convierta un 1:1 ajeno en un
-- grupo agregándose gente.
--
-- Nota sobre la regla de conexión (pares solicitan, hacia arriba se escribe
-- directo): se aplica en la aplicación, no aquí. Es una norma de convivencia
-- entre compañeros de la misma empresa, no un límite de seguridad — todos los
-- que llegan a estas tablas ya están dentro del padrón de Iberia.
-- =============================================================================

drop policy if exists "abro conversaciones" on public.conversaciones;
create policy "abro conversaciones" on public.conversaciones
  for insert to authenticated
  with check (
    tipo = 'directa'
    or exists (
      select 1 from public.grupo_miembros m
       where m.grupo_id = conversaciones.grupo_id
         and m.empleado_id = public.mi_empleado()
    )
  );

drop policy if exists "armo la conversacion" on public.conversacion_participantes;
create policy "armo la conversacion" on public.conversacion_participantes
  for insert to authenticated
  with check (
    -- Me sumo yo: siempre puedo.
    empleado_id = public.mi_empleado()
    -- O sumo a alguien más, y solo si el hilo es de grupo o todavía está
    -- vacío del otro lado. Una conversación directa no se convierte en grupo.
    or (
      exists (
        select 1 from public.conversacion_participantes p
         where p.conversacion_id = conversacion_participantes.conversacion_id
           and p.empleado_id = public.mi_empleado()
      )
      and exists (
        select 1 from public.conversaciones c
         where c.id = conversacion_participantes.conversacion_id
           and (
             c.tipo = 'grupo'
             or (select count(*) from public.conversacion_participantes p2
                  where p2.conversacion_id = c.id) < 2
           )
      )
    )
  );

-- Un grupo tiene un solo hilo. Sin esto, dos personas abriendo el grupo a la
-- vez crearían dos conversaciones paralelas y cada quien hablaría sola.
create unique index if not exists conversaciones_grupo_idx
  on public.conversaciones (grupo_id) where grupo_id is not null;

-- El hilo de un grupo lo ve quien es miembro del grupo, aunque todavía no
-- figure como participante: si no, nadie podría encontrarlo para entrar.
drop policy if exists "mis conversaciones" on public.conversaciones;
create policy "mis conversaciones" on public.conversaciones
  for select to authenticated
  using (
    exists (
      select 1 from public.conversacion_participantes p
       where p.conversacion_id = conversaciones.id
         and p.empleado_id = public.mi_empleado()
    )
    or exists (
      select 1 from public.grupo_miembros m
       where m.grupo_id = conversaciones.grupo_id
         and m.empleado_id = public.mi_empleado()
    )
  );

-- Cuántas conversaciones tienen algo que todavía no he leído. Va en una
-- función porque el layout lo pregunta en cada pantalla: una consulta, no una
-- por hilo.
create or replace function public.mensajes_sin_leer()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.conversacion_participantes p
   where p.empleado_id = public.mi_empleado()
     and exists (
       select 1 from public.mensajes m
        where m.conversacion_id = p.conversacion_id
          and m.autor_id <> p.empleado_id
          and m.estado = 'visible'
          and (p.visto_en is null or m.created_at > p.visto_en)
     );
$$;

-- Marcar el hilo como visto es actualizar mi propia fila, nada más.
drop policy if exists "marco mi visto" on public.conversacion_participantes;
create policy "marco mi visto" on public.conversacion_participantes
  for update to authenticated
  using (empleado_id = public.mi_empleado())
  with check (empleado_id = public.mi_empleado());
