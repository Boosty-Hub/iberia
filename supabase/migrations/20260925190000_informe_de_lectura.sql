-- =============================================================================
-- El informe es de lectura, y el mapa es su sección
-- =============================================================================
--
-- Decisión de Gabriel, 25 de septiembre de 2026:
--
--   · El módulo de hallazgos del panel se fue. Los hallazgos se leen en el
--     informe, cada uno en su punto del circuito (`informe_hallazgos`). La tabla
--     `hallazgos` se queda —es el catálogo con la cita de cada uno, lo que
--     sostiene el expediente—, pero ya no tiene pantalla.
--   · El editor del informe se fue. El informe se escribe en las sesiones de
--     trabajo y se carga con los scripts, con la clave de servicio: en el panel
--     no se edita. Por eso las casillas «editar» y «eliminar» de las secciones
--     no significan nada y salen de la matriz.
--   · «El mapa de procesos» abre directo el mapa interactivo. El mapa deja de
--     ser un recurso aparte: se ve con la casilla «ver» de su sección.
--
-- Nada de esto borra contenido: solo filas de permisos.
-- -----------------------------------------------------------------------------

-- 1) Los dos módulos que ya no existen.
delete from public.rol_permisos where recurso in ('modulo:hallazgos', 'modulo:informe');

-- 2) El mapa se ve con el permiso de su sección.
--    Quien veía el mapa sin ver la sección conserva la vista: ahora son lo mismo.
update public.rol_permisos rp
   set ver = true
  from public.rol_permisos mapa
 where mapa.rol_id = rp.rol_id
   and mapa.recurso = 'informe:mapa-interactivo'
   and mapa.ver
   and rp.recurso = 'informe:mapa-procesos';

drop policy if exists "el mapa se lee con su permiso" on public.macroprocesos;
create policy "el mapa se lee con el permiso de su sección"
  on public.macroprocesos for select to authenticated
  using (
    public.es_editor()
    or public.puede('informe:mapa-procesos', 'ver')
    -- Las fichas marcan «Nuevo» con esta tabla: sin ella, el lector que ve las
    -- fichas y no el mapa se quedaría sin la marca.
    or public.puede('informe:fichas-procesos', 'ver')
  );

drop policy if exists "los procesos se leen con el permiso del mapa" on public.procesos;
create policy "los procesos se leen con el permiso de su sección"
  on public.procesos for select to authenticated
  using (
    public.es_editor()
    or public.puede('informe:mapa-procesos', 'ver')
    or public.puede('informe:fichas-procesos', 'ver')
  );

delete from public.rol_permisos where recurso = 'informe:mapa-interactivo';

-- 3) Las secciones: solo «ver».
update public.rol_permisos
   set editar = false, eliminar = false, crear = false
 where recurso like 'informe:%'
   and (editar or eliminar or crear);

create or replace function public.permisos_de_fabrica_seccion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- Una sección nueva la ven el equipo y el lector; nadie la edita desde el
    -- panel, porque el panel ya no edita el informe.
    insert into public.rol_permisos (rol_id, recurso, ver)
    select id, 'informe:' || new.slug, true
      from public.roles where clave in ('consultor', 'lector')
    on conflict (rol_id, recurso) do nothing;
  elsif tg_op = 'UPDATE' and new.slug is distinct from old.slug then
    update public.rol_permisos set recurso = 'informe:' || new.slug
     where recurso = 'informe:' || old.slug;
  elsif tg_op = 'DELETE' then
    delete from public.rol_permisos where recurso = 'informe:' || old.slug;
  end if;
  return null;
end;
$$;
