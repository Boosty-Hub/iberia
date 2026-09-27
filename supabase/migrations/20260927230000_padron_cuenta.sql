-- =============================================================================
-- El padrón dice qué cuenta tiene cada ficha, y su número de ficha
-- =============================================================================
--
-- 27 de septiembre de 2026. Gabriel matriculó a Martha Fuentes desde el padrón y
-- ella seguía sin entrar al canal. En el padrón hay dos Martha Fuentes: la ficha
-- de muestra de agosto, «Martha Fuentes», y la de Capital Humano, «Martha Beatriz
-- Fuentes Quintero», ficha 4837. Se matriculó la de muestra, al acuñarle el enlace
-- se le creó una cuenta nueva, y la cuenta de verdad de Martha —la de su correo
-- de Iberia— siguió sin ficha. Nada en la pantalla distinguía una ficha de la
-- otra ni decía de quién era la cuenta.
--
-- La vista suma dos columnas al final: el número de ficha de Capital Humano
-- —sin número, la ficha se cargó a mano— y el correo de la cuenta enlazada.
-- -----------------------------------------------------------------------------

create or replace view public.padron_estado
with (security_invoker = off) as
select
  e.id,
  e.cedula,
  e.nombre_completo,
  e.cargo,
  e.nivel,
  e.tipo_nomina,
  e.sede,
  e.telefono,
  e.email,
  e.activo,
  e.familia_oficio,
  e.area_id,
  ar.nombre                          as area_nombre,
  (e.perfil_id is not null)          as tiene_cuenta,
  m.id                               as matricula_id,
  m.estado                           as estado_matricula,
  m.ultimo_toque,
  (select count(*) from public.avances av
    where av.matricula_id = m.id and av.estado = 'completada') as lecciones_hechas,
  (select max(ac.expira_en) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_expira,
  (select max(ac.enviado_en) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_enviado,
  (select coalesce(sum(ac.usos), 0) from public.accesos ac
    where ac.empleado_id = e.id and ac.motivo = 'curso')       as acceso_usos,
  e.ficha,
  pf.email                           as cuenta_email
from public.empleados e
left join public.areas ar on ar.id = e.area_id
left join public.cursos c on c.clave = 'ajito'
left join public.matriculas m on m.empleado_id = e.id and m.curso_id = c.id
left join public.profiles pf on pf.id = e.perfil_id
-- Lo único que cierra esta vista. Sin esto, `security_invoker = off` la abriría
-- a cualquiera con sesión.
where public.es_editor();

comment on view public.padron_estado is
  'El padrón con lo que hace falta para decidir: teléfono, cuenta —y su correo—, '
  'número de ficha, matrícula, avance y estado del enlace. Corre como su dueña para '
  'poder mirar `accesos` —que niega el SELECT a todos— y se cierra con el filtro por '
  'es_editor(). Nunca expone el hash del token.';

grant select on public.padron_estado to authenticated;
