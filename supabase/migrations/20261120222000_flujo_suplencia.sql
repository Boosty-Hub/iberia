-- =============================================================================
-- PLATAFORMA IBERIA · suplencia de administración en las rutas operativas
--
-- La regla de R6 (M1) «nadie decide dos pasos de la misma solicitud» traba una
-- ruta de N pasos cuando sus aprobadores todavía no tienen cuenta: todos caen
-- en suplencia y hacen falta N administradores distintos. Decisión (20-nov):
--   · Cada ruta dice si permite la suplencia repetida (editable en Rutas de
--     aprobación). De fábrica: sí en requisición de personal y ficha de
--     proceso; NO en escenarios de estructura y de procesos ni en nivel de IA,
--     que son doble firma.
--   · Solo cubre pasos sin aprobador con cuenta (o en conflicto), nunca un paso
--     con aprobador real, y nunca a quien pidió ni al autor del objeto.
--   · Todo paso decidido por alguien que no era su aprobador queda marcado
--     `por_suplencia`, visible en la ruta y en la auditoría.
-- La salida de fondo es enlazar las cuentas de los aprobadores (Gerente
-- General, directores, RRHH) a sus fichas antes de producción.
-- =============================================================================

alter table flujo.ruta add column if not exists permite_suplencia_repetida boolean not null default false;
update flujo.ruta set permite_suplencia_repetida = true where tipo_objeto in ('requisicion_personal', 'proceso');

alter table flujo.paso add column if not exists por_suplencia boolean not null default false;

create or replace function flujo.marcar_suplencia()
returns trigger language plpgsql as $$
begin
  if old.decision = 'pendiente' and new.decision in ('aprobado', 'rechazado', 'devuelto') then
    new.por_suplencia := new.decidido_por is distinct from old.aprobador_perfil;
  end if;
  return new;
end;
$$;
drop trigger if exists marcar_suplencia on flujo.paso;
create trigger marcar_suplencia before update on flujo.paso
  for each row execute function flujo.marcar_suplencia();

create or replace function privado.puede_decidir_de(p_perfil uuid, p_paso uuid)
returns boolean
language sql
stable
security definer
set search_path = flujo, public
as $$
  with x as (
    select p.*, s.estado as s_estado, s.paso_actual, s.creado_por as pidio,
           privado.autor_de_solicitud(s.tipo_objeto, s.objeto_id) as autor,
           coalesce(r.permite_suplencia_repetida, false) as suplencia_repetida
      from flujo.paso p join flujo.solicitud s on s.id = p.solicitud_id
      left join flujo.ruta r on r.id = s.ruta_id
     where p.id = p_paso
  ), y as (
    select x.*,
           -- El aprobador resuelto que no puede firmar: el paso queda «sin cuenta».
           (x.aprobador_perfil is not null and (
               x.aprobador_perfil is not distinct from x.pidio
            or x.aprobador_perfil is not distinct from x.autor
            or not exists (select 1 from public.profiles pr where pr.id = x.aprobador_perfil and pr.activo)
            or exists (select 1 from flujo.paso q where q.solicitud_id = x.solicitud_id and q.id <> x.id
                          and q.decidido_por = x.aprobador_perfil and q.decision in ('aprobado', 'rechazado', 'devuelto')))) as en_conflicto
      from x
  )
  select coalesce((
    select y.s_estado = 'en_curso' and y.decision = 'pendiente' and y.paso_actual = y.orden
       and p_perfil is not null
       and exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo)
       and y.pidio is distinct from p_perfil
       and y.autor is distinct from p_perfil
       -- Nadie decide dos pasos de la misma solicitud. Única excepción, y solo
       -- si la ruta lo permite (operativas: requisición, ficha de proceso): la
       -- suplencia de administración en pasos cuyo aprobador no tiene cuenta,
       -- que queda marcada (flujo.paso.por_suplencia). Las rutas de doble firma
       -- (escenarios, nivel de IA) nunca la permiten.
       and (not exists (select 1 from flujo.paso q where q.solicitud_id = y.solicitud_id and q.id <> y.id
                         and q.decidido_por = p_perfil and q.decision in ('aprobado', 'rechazado', 'devuelto'))
            or (y.suplencia_repetida
                and ((y.aprobador_perfil is null and coalesce(y.regla ->> 'resolutor', '') <> 'rol') or y.en_conflicto)
                and not exists (select 1 from flujo.paso q where q.solicitud_id = y.solicitud_id and q.id <> y.id
                                 and q.decidido_por = p_perfil and q.decision in ('aprobado', 'rechazado', 'devuelto')
                                 and not q.por_suplencia)))
       and (
            (y.aprobador_perfil = p_perfil and not y.en_conflicto)
         or (y.aprobador_perfil is null and y.regla ->> 'resolutor' = 'rol'
             and exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo and pr.rol_id::text = y.regla ->> 'rol_id'))
         or ((y.aprobador_perfil is null and coalesce(y.regla ->> 'resolutor', '') <> 'rol') or y.en_conflicto)
             and (privado.puede_perfil(p_perfil, 'sistema:aprobaciones', 'editar')
                  or exists (select 1 from public.profiles pr where pr.id = p_perfil and pr.activo and pr.rol = 'admin'))
       )
      from y), false);
$$;
revoke all on function privado.puede_decidir_de(uuid, uuid) from public, anon, authenticated;
