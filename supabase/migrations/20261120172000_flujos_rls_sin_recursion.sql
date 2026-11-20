-- =============================================================================
-- PLATAFORMA IBERIA · las políticas de solicitudes y pasos, sin recursión
--
-- «ver solicitudes» preguntaba por `flujo.paso` y «ver pasos» por
-- `flujo.solicitud`: cada una dispara la RLS de la otra y Postgres responde
-- `infinite recursion detected in policy for relation "paso"` (42P17). Lo
-- sufría la requisición, cuya política también pregunta por los pasos: quien la
-- pidió no podía abrirla. Es la trampa conocida de AGENTS.md: la pregunta va en
-- una función `security definer`, que consulta sin volver a pasar por la RLS.
-- =============================================================================

-- ¿Quien llama tiene un paso asignado en esta solicitud?
create or replace function flujo.firmo_en(p_solicitud uuid)
returns boolean language sql stable security definer set search_path = flujo, public as $$
  select exists (select 1 from flujo.paso where solicitud_id = p_solicitud and aprobador_perfil = auth.uid());
$$;

-- ¿Quien llama abrió esta solicitud?
create or replace function flujo.pedi_yo(p_solicitud uuid)
returns boolean language sql stable security definer set search_path = flujo, public as $$
  select exists (select 1 from flujo.solicitud where id = p_solicitud and creado_por = auth.uid());
$$;

-- ¿Quien llama firma algún paso de alguna solicitud sobre este objeto?
create or replace function flujo.firmo_objeto(p_objeto uuid)
returns boolean language sql stable security definer set search_path = flujo, public as $$
  select exists (select 1 from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
                  where s.objeto_id = p_objeto and p.aprobador_perfil = auth.uid());
$$;

drop policy if exists "ver solicitudes" on flujo.solicitud;
create policy "ver solicitudes" on flujo.solicitud for select to authenticated
  using (creado_por = auth.uid() or public.puede('sistema:aprobaciones', 'ver') or flujo.firmo_en(id));

drop policy if exists "ver pasos" on flujo.paso;
create policy "ver pasos" on flujo.paso for select to authenticated
  using (aprobador_perfil = auth.uid() or public.puede('sistema:aprobaciones', 'ver') or flujo.pedi_yo(solicitud_id));

drop policy if exists "ver requisiciones" on org.requisicion;
create policy "ver requisiciones" on org.requisicion for select to authenticated
  using (creado_por = auth.uid() or public.puede('sistema:requisiciones', 'ver') or flujo.firmo_objeto(id));
