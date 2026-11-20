import Link from 'next/link'
import { IconoEnviar, IconoMas } from '@/components/iconos'
import { TarjetaAdiestramiento } from '@/components/canal/tarjeta-adiestramiento'
import {
  TarjetaPublicacion,
  type PublicacionFeed,
} from '@/components/canal/tarjeta-publicacion'
import { AvisoPlataforma } from '@/components/canal/aviso-plataforma'
import { requerirEmpleado, type NivelEmpleado } from '@/lib/canal'
import { avisosDelCanal, misTareasAbiertas } from '@/lib/canal-avisos'
import { fechaCorta, hoyCaracas } from '@/lib/plataforma/formato'
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
      'id, tipo, titulo, bajada, imagen_url, respuesta_id, certificado_id, oficial, fijado, publicado_en, autor_id, audiencia, audiencia_area_id, empleados(nombre_completo, cargo), comentarios(count), reacciones(count)'
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

  // El feed y lo que le toca a esta persona en la plataforma (tareas y avisos
  // sin leer), en la misma tanda.
  const [{ data: publicaciones }, tareas, avisos] = await Promise.all([consulta, misTareasAbiertas(3), avisosDelCanal(6)])
  // Con la tarjeta de tareas a la vista, el aviso «te asignó una tarea» la repite:
  // ese queda en Avisos y aquí salen los demás.
  const sinLeer = avisos.lista.filter((a) => !a.leida && !(tareas.total > 0 && a.tipo === 'tarea')).slice(0, 3)
  const hoy = hoyCaracas()

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

      {(tareas.total > 0 || sinLeer.length > 0) && (
        <section aria-labelledby="para-ti" className="mb-4">
          <h2 id="para-ti" className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-500 uppercase">
            Para ti
          </h2>
          <div className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
            {tareas.total > 0 && (
              <Link href="/canal/tareas" className="flex min-h-14 items-start gap-3 px-4 py-3 active:bg-marca-50">
                <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e7f5ee] text-[15px] font-bold text-[#1f6f4b]">
                  ☐
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-marca-900">
                    {tareas.total === 1 ? 'Tienes 1 tarea pendiente' : `Tienes ${tareas.total} tareas pendientes`}
                  </span>
                  {tareas.lista.slice(0, 2).map((t) => (
                    <span key={t.id} className="mt-0.5 block truncate text-[13px] text-marca-600">
                      {t.vence && t.vence < hoy ? '⚠ ' : '· '}
                      {t.titulo}
                      {t.vence ? ` — ${t.vence < hoy ? 'venció' : t.vence === hoy ? 'vence hoy' : `vence el ${fechaCorta(t.vence)}`}` : ''}
                    </span>
                  ))}
                </span>
                <span aria-hidden className="mt-1 text-lg text-marca-300">
                  ›
                </span>
              </Link>
            )}
            {sinLeer.map((a) => (
              <AvisoPlataforma key={a.id} aviso={a} ahora={ahora} />
            ))}
          </div>
        </section>
      )}

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
              yoId={empleado.id}
            />
          ))}
        </div>
      )}
    </>
  )
}
