-- =============================================================================
-- Que las casillas de Ajito abran lo que dicen
-- =============================================================================
--
-- 27 de septiembre de 2026. Gabriel armó el rol «Marketing» —«ve lo relacionado
-- con Ajito»— con las nueve lecciones, Adiestramiento y Certificados, y se lo dio
-- a Martha Álvarez. No veía nada de eso. Las casillas estaban bien puestas; lo
-- que no las oía era la base:
--
--  1. **El tablero del curso salía en cero.** `adiestramiento_avance` se escribió
--     para las gerencias —«el avance por área y por oficio, sin una sola
--     respuesta»—, pero corría con `security_invoker`, y la RLS de `matriculas`
--     solo le deja ver la suya a quien no es del equipo. Ninguna gerencia lo vio
--     nunca con datos. Ahora corre como su dueña y se cierra por dentro con la
--     casilla de Adiestramiento, como `padron_estado`. Sigue sin nombres ni
--     respuestas: son cuentas por área y por oficio.
--  2. **Certificados salía vacío.** Su política dejaba leer el propio y los del
--     equipo. Ahora también a quien tiene la casilla de Certificados, que es para
--     lo que existe esa pantalla: verlos e imprimirlos.
--  3. **Las lecciones pedían matrícula**, y la matrícula la pone el equipo desde
--     el padrón —a planta y administrativo—. Una gerente con las lecciones en su
--     rol se encontraba con «este curso no es para tu nivel». Ahora quien tiene
--     alguna lección en su rol se matricula al tocar «Recorrer el curso», con
--     `matricularme()`, que lo comprueba.
-- -----------------------------------------------------------------------------

-- --- 1) el tablero ---------------------------------------------------------------

create or replace view public.adiestramiento_avance
with (security_invoker = off) as
select
  m.curso_id,
  e.area_id,
  a.nombre                        as area_nombre,
  e.familia_oficio,
  count(*)                                                as matriculados,
  count(*) filter (where m.estado = 'completado')         as completados,
  count(*) filter (where m.estado = 'en_curso')           as en_curso,
  count(*) filter (where m.estado = 'pendiente')          as sin_empezar,
  coalesce(avg((
    select count(*) from public.avances av
     where av.matricula_id = m.id and av.estado = 'completada'
  )), 0)::numeric(4,1)                                    as lecciones_promedio
from public.matriculas m
join public.empleados e on e.id = m.empleado_id
left join public.areas a on a.id = e.area_id
-- ⚠️ Corre como su dueña, así que la RLS de las tablas de adentro no aplica: la
-- puerta es esta línea. Sin ella, cualquiera con sesión leería el tablero.
where public.es_editor() or public.puede('modulo:adiestramiento', 'ver')
group by m.curso_id, e.area_id, a.nombre, e.familia_oficio;

comment on view public.adiestramiento_avance is
  'El avance del curso por área y por oficio, sin nombres ni respuestas. Lo lee el '
  'equipo y quien tiene la casilla de Adiestramiento. Corre como su dueña.';

revoke all on public.adiestramiento_avance from anon;
grant select on public.adiestramiento_avance to authenticated;

-- --- 2) los certificados -----------------------------------------------------------

drop policy if exists "mi certificado" on public.certificados;
create policy "mi certificado" on public.certificados
  for select to authenticated
  using (
    public.matricula_mia(matricula_id)
    or public.es_editor()
    or public.puede('modulo:certificados', 'ver')
  );

-- --- 3) matricularse con las lecciones del rol --------------------------------------

create or replace function public.matricularme(p_curso text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo        uuid := public.mi_empleado();
  v_curso   uuid;
  v_abierto boolean;
  v_familia text;
  ya        uuid;
  nueva     uuid := gen_random_uuid();
begin
  if yo is null then
    raise exception 'Sin ficha en el padrón';
  end if;

  select id, abierto into v_curso, v_abierto from public.cursos where clave = p_curso;
  if v_curso is null or not v_abierto then
    raise exception 'El curso no está abierto';
  end if;

  -- La casilla es la decisión: sin ninguna lección en su rol, no hay curso que
  -- recorrer. La matrícula que pone el equipo desde el padrón no pasa por aquí.
  if not exists (
    select 1 from public.lecciones l
     where l.curso_id = v_curso and l.activa and public.puede('leccion:' || l.numero, 'ver')
  ) then
    raise exception 'Tu rol no tiene lecciones de este curso';
  end if;

  select id into ya from public.matriculas where curso_id = v_curso and empleado_id = yo;
  if ya is not null then
    return ya;
  end if;

  select coalesce(familia_oficio, 'generico') into v_familia from public.empleados where id = yo;

  insert into public.matriculas (id, curso_id, empleado_id, familia_oficio)
  values (nueva, v_curso, yo, v_familia);

  return nueva;
end;
$$;

comment on function public.matricularme(text) is
  'Matricula en el curso a quien lo pide, si su rol tiene alguna de sus lecciones. '
  'Idempotente: la segunda vez devuelve la misma matrícula.';

revoke all on function public.matricularme(text) from public, anon;
grant execute on function public.matricularme(text) to authenticated;
