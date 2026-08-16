import Link from 'next/link'
import { IconoEnviar, IconoMas } from '@/components/iconos'
import { TarjetaAdiestramiento } from '@/components/canal/tarjeta-adiestramiento'
import {
  TarjetaPublicacion,
  type PublicacionFeed,
} from '@/components/canal/tarjeta-publicacion'
import { requerirEmpleado, type NivelEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

export default async function CanalPage() {
  const empleado = await requerirEmpleado()
  const supabase = await createClient()
  const ahora = new Date()

  // Qué audiencias alcanzan a esta persona. RLS ya limita a lo publicado;
  // esto decide qué le corresponde ver a ella.
  const audiencias = ['todos']
  const nivel = empleado.nivel as NivelEmpleado
  if (nivel === 'direccion') audiencias.push('direccion')
  if (nivel === 'gerencia') audiencias.push('gerencia')
  if (nivel === 'administrativo' || nivel === 'jefatura') audiencias.push('administrativo')
  if (nivel === 'planta') audiencias.push('planta')

  let consulta = supabase
    .from('publicaciones')
    .select(
      'id, tipo, titulo, bajada, imagen_url, oficial, fijado, publicado_en, audiencia, audiencia_area_id, empleados(nombre_completo, cargo), comentarios(count), reacciones(count)'
    )
    .eq('estado', 'publicado')
    .order('fijado', { ascending: false })
    .order('publicado_en', { ascending: false })
    .limit(30)

  // Lo dirigido a un área concreta solo llega a quien pertenece a ella.
  consulta = empleado.area_id
    ? consulta.or(
        `audiencia.in.(${audiencias.join(',')}),and(audiencia.eq.area,audiencia_area_id.eq.${empleado.area_id})`
      )
    : consulta.in('audiencia', audiencias)

  const { data: publicaciones } = await consulta

  const primerNombre = empleado.nombre_completo.split(/\s+/)[0]
  const puedePublicar = empleado.puede_publicar || empleado.es_moderador

  return (
    <>
      <header className="mb-4">
        <p className="text-[13px] text-marca-500">Hola, {primerNombre}</p>
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">
          Lo que está pasando en Iberia
        </h1>
      </header>

      <TarjetaAdiestramiento empleadoId={empleado.id} />

      {puedePublicar && (
        <Link
          href="/canal/publicar"
          className="tarjeta-canal mb-4 flex items-center gap-3 px-4 py-3 active:bg-marca-50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-acento-600 text-white">
            <IconoMas className="h-5 w-5" />
          </span>
          <span className="flex-1 text-[15px] text-marca-500">
            Publicar algo para la organización…
          </span>
          <IconoEnviar className="h-5 w-5 text-marca-300" />
        </Link>
      )}

      {!publicaciones?.length ? (
        <div className="tarjeta-canal px-6 py-12 text-center">
          <h2 className="text-base font-semibold text-marca-900">
            Todavía no hay publicaciones
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-marca-500">
            Aquí van a aparecer los comunicados de la empresa, las noticias y las
            historias de nuestra gente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {publicaciones.map((p) => (
            <TarjetaPublicacion
              key={p.id}
              publicacion={p as PublicacionFeed}
              ahora={ahora}
            />
          ))}
        </div>
      )}
    </>
  )
}
