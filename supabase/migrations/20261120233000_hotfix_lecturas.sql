-- =============================================================================
-- HOTFIX en producción (20-nov-2026, autorizado por Gabriel por Telegram)
--
-- 1) Transcripciones y hallazgos: los leía cualquier sesión por la API (desde
--    agosto). Son el perímetro «solo Boosty»: el informe va sin citas y el
--    expediente no se comparte con el cliente. Ahora solo el equipo editor.
--    Efecto conocido: la portada del informe cuenta «hallazgos validados» con
--    la sesión de quien lee; para un lector de Iberia da 0 hasta que la portada
--    use una función que cuente (pendiente en la rama).
-- 2) Empleados: la política «actualizo mi ficha» dejaba que cualquiera con su
--    ficha enlazada se diera permiso de publicar o moderar, o se cambiara cargo
--    y área. El trigger lo impide (el mismo de integracion_canal).
-- =============================================================================

drop policy if exists "segmentos legibles con sesion" on public.transcripcion_segmentos;
drop policy if exists "segmentos solo del equipo" on public.transcripcion_segmentos;
create policy "segmentos solo del equipo" on public.transcripcion_segmentos
  for select to authenticated using (public.es_editor());

drop policy if exists "hallazgos legibles con sesion" on public.hallazgos;
drop policy if exists "hallazgos solo del equipo" on public.hallazgos;
create policy "hallazgos solo del equipo" on public.hallazgos
  for select to authenticated using (public.es_editor());

create or replace function privado.empleados_proteger_acceso()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Sin usuario (clave de servicio, migraciones, scripts) y el equipo editor
  -- administran el padrón como siempre.
  if auth.uid() is null or public.es_editor() then
    return new;
  end if;
  -- Quién publica y quién modera en el canal: la casilla de moderación del canal.
  if (new.puede_publicar, new.es_moderador) is distinct from (old.puede_publicar, old.es_moderador)
     and not public.puede('modulo:reportes', 'editar') then
    raise exception 'Solo quien administra el canal decide quién publica o modera'
      using errcode = 'insufficient_privilege';
  end if;
  -- La identidad, el lugar en la organización y el enlace con la cuenta son del
  -- padrón (Capital Humano), no de la persona.
  if (new.cedula, new.ficha, new.nombre_completo, new.cargo, new.area_id, new.sede, new.nivel,
      new.tipo_nomina, new.familia_oficio, new.activo, new.perfil_id, new.fecha_ingreso)
     is distinct from
     (old.cedula, old.ficha, old.nombre_completo, old.cargo, old.area_id, old.sede, old.nivel,
      old.tipo_nomina, old.familia_oficio, old.activo, old.perfil_id, old.fecha_ingreso) then
    raise exception 'Esos datos los cambia Capital Humano en el padrón'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
revoke execute on function privado.empleados_proteger_acceso() from public, anon, authenticated;

drop trigger if exists a_empleados_proteger_acceso on public.empleados;
create trigger a_empleados_proteger_acceso
  before update on public.empleados
  for each row execute function privado.empleados_proteger_acceso();
