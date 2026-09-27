-- =============================================================================
-- Qué audios de la lección ya oyó cada quien
-- =============================================================================
--
-- 27 de septiembre de 2026, a pedido de Gabriel. El ✓ de «Ya lo oíste» vivía
-- solo en la página: al recargar, la lección entera volvía a salir sin oír, y
-- quien retoma la lección al día siguiente —que es lo que Ajito promete— no sabía
-- por dónde iba. Va en el avance de la lección, que ya es de la persona y ya
-- tiene su política («actualizo mi avance»): una columna, no una tabla.
--
-- Las piezas son las del guion (`1`, `2`, `6-B`) y las devoluciones van como
-- `devolucion-<clave>`. Reiniciar el curso borra los avances, y con ellos esto.
-- -----------------------------------------------------------------------------

alter table public.avances
  add column if not exists oidos text[] not null default '{}';

comment on column public.avances.oidos is
  'Los audios de la lección que ya oyó hasta el final: piezas del guion y devolucion-<clave>.';

-- Se anota con una sola sentencia, no leyendo y escribiendo desde la app: dos
-- audios que terminan casi juntos —la clase y la devolución— se pisarían. Corre
-- como quien llama, así que la RLS de `avances` decide igual que siempre.
create or replace function public.marcar_oido(p_matricula uuid, p_leccion uuid, p_pieza text)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.avances
     set oidos = array_append(oidos, p_pieza)
   where matricula_id = p_matricula
     and leccion_id = p_leccion
     and not (p_pieza = any (oidos))
     and char_length(p_pieza) between 1 and 60;
$$;

revoke execute on function public.marcar_oido(uuid, uuid, text) from public, anon;
grant execute on function public.marcar_oido(uuid, uuid, text) to authenticated;
