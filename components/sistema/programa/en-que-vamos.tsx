import Link from 'next/link'
import { puede, type Sesion } from '@/lib/auth'
import { leerFases } from '@/lib/plataforma/hoja-de-ruta'
import { precargarMetricas, puedeVerMetrica, type ContextoMetrica } from '@/lib/plataforma/metricas'
import { fechaLarga, numero } from '@/lib/plataforma/formato'
import { PastillaFase } from '@/components/sistema/programa/hoja-de-ruta'

/**
 * «En qué vamos» en Mi día: la fase actual de la plataforma, cuántos módulos
 * operan y el siguiente hito, con el enlace a la hoja de ruta. Solo para los
 * niveles administrador y consultor con `modulo:programa` · ver (con «ver como»,
 * el del rol que se previsualiza). Las cifras son las del registro de métricas.
 */
export async function EnQueVamos({ sesion, ctx }: { sesion: Sesion; ctx: ContextoMetrica }) {
  if (!['admin', 'consultor'].includes(sesion.rol.nivel) || !puede(sesion, 'modulo:programa')) return null
  const [fases, metricas] = await Promise.all([leerFases(), precargarMetricas(['plataforma_modulos', 'plataforma_hitos'], ctx)])
  const actual = fases.find((f) => f.actual)
  const modulos = metricas.find((m) => m.clave === 'plataforma_modulos')
  const hitos = metricas.find((m) => m.clave === 'plataforma_hitos')
  if (!actual && !modulos) return null
  const siguiente = hitos && puedeVerMetrica(sesion, hitos) ? (hitos.detalle?.siguiente as { titulo?: string; fecha?: string } | null | undefined) : null

  return (
    <section className="mb-3 rounded-xl border border-[var(--borde)] bg-white px-4 py-3" aria-labelledby="en-que-vamos">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="en-que-vamos" className="text-[13px] font-semibold text-marca-900">
          En qué vamos · la plataforma
        </h2>
        <Link href="/sistema/programa/hoja-de-ruta" className="text-xs font-semibold text-acento-700 hover:underline">
          Ver la hoja de ruta
        </Link>
      </div>
      <div className="mt-2 grid gap-3 text-[12.5px] sm:grid-cols-3">
        {actual && (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-marca-500">Fase</p>
            <p className="flex flex-wrap items-center gap-1.5 font-semibold text-marca-900">
              {actual.nombre} <PastillaFase estado={actual.estado} />
            </p>
            {actual.situacion && <p className="text-marca-600">{actual.situacion}</p>}
          </div>
        )}
        {modulos && puedeVerMetrica(sesion, modulos) && modulos.valor !== null && (
          <div className="min-w-0" data-metrica="plataforma_modulos">
            <p className="text-[11px] font-semibold text-marca-500">Módulos</p>
            <p className="font-semibold text-marca-900 tabular-nums">
              {numero(modulos.valor)} de {numero(modulos.total)} operando
            </p>
            <p className="text-marca-600 tabular-nums">
              {numero(Number(modulos.detalle?.en_construccion ?? 0))} en construcción · {numero(Number(modulos.detalle?.planificado ?? 0))} planificados
            </p>
          </div>
        )}
        {siguiente?.fecha && (
          <div className="min-w-0" data-metrica="plataforma_hitos">
            <p className="text-[11px] font-semibold text-marca-500">Siguiente hito</p>
            <p className="font-semibold text-marca-900 tabular-nums">{fechaLarga(siguiente.fecha)}</p>
            <p className="text-marca-600">{siguiente.titulo}</p>
          </div>
        )}
      </div>
    </section>
  )
}
