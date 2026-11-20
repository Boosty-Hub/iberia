-- =============================================================================
-- PLATAFORMA IBERIA · la búsqueda de documentos, por palabras
--
-- La primera versión de `sgc.buscar_documentos` buscaba la frase entera: «minuta
-- gerencial» no encontraba «Minuta de Reunión Gerencial». Ahora cada palabra
-- tiene que aparecer, en cualquier orden, sin tildes ni mayúsculas, en el
-- código, el título o los alias.
-- =============================================================================

create or replace function sgc.buscar_documentos(
  p_texto     text default null,
  p_estado    text default null,
  p_xx        text default null,
  p_yy        text default null,
  p_familia   text default null,
  p_perimetro text default null,
  p_proceso   uuid default null,
  p_desde     integer default 0,
  p_limite    integer default 50
)
returns table (
  id uuid, codigo text, titulo text, proceso_xx text, tipo_yy text, proceso_ref uuid, version text,
  fecha date, estado text, perimetro text, datos_sensibles boolean, familia text, alias text[], total bigint
)
language sql stable security invoker set search_path = sgc, public, extensions as $$
  select d.id, d.codigo, d.titulo, d.proceso_xx, d.tipo_yy, d.proceso_ref, d.version, d.fecha, d.estado,
         d.perimetro, d.datos_sensibles, d.familia, d.alias, count(*) over () as total
    from sgc.documento d
   where (p_estado is null or d.estado = p_estado)
     and (p_xx is null or d.proceso_xx = p_xx)
     and (p_yy is null or d.tipo_yy = p_yy)
     and (p_familia is null or d.familia = p_familia)
     and (p_perimetro is null or d.perimetro = p_perimetro)
     and (p_proceso is null or d.proceso_ref = p_proceso)
     and (coalesce(trim(p_texto), '') = ''
          or not exists (
            select 1
              from unnest(regexp_split_to_array(sgc.plano(trim(p_texto)), '\s+')) as t(palabra)
             where t.palabra <> ''
               and position(t.palabra in sgc.plano(d.codigo || ' ' || d.titulo || ' ' || array_to_string(d.alias, ' '))) = 0))
   order by d.codigo, d.titulo
  offset greatest(p_desde, 0)
   limit least(greatest(p_limite, 1), 200);
$$;

grant execute on function sgc.buscar_documentos(text, text, text, text, text, text, uuid, integer, integer) to authenticated;
