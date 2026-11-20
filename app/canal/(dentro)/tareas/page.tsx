import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoAtras, IconoCheck } from '@/components/iconos'
import { leerTareas } from '@/components/sistema/colaboracion/datos'
import { tieneFicha } from '@/components/sistema/colaboracion/abrir'
import { requerirEmpleado } from '@/lib/canal'
import { hrefFicha, vencida, venceHoy, type Tarea } from '@/lib/plataforma/colaboracion'
import { fechaCorta, hoyCaracas } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'
import { cambiarMiTarea } from './acciones'

export const metadata: Metadata = { title: 'Mis tareas' }

/**
 * Mis tareas en el teléfono: las que me asignaron en la plataforma
 * (`nucleo.tarea`), las que vencen primero arriba. Se terminan con un toque; las
 * hechas quedan abajo un tiempo por si hay que reabrirlas.
 */
export default async function TareasPage() {
  await requerirEmpleado()
  const todas = (await leerTareas({ abiertas: false, limite: 100 })).filter((t) => t.mia)
  const hoy = hoyCaracas()
  const abiertas = todas.filter((t) => t.estado === 'abierta')
  const hechas = todas.filter((t) => t.estado === 'hecha').slice(0, 10)

  return (
    <>
      <Link href="/canal/yo" className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-marca-500 active:text-marca-800">
        <IconoAtras className="h-4 w-4" />
        Mi perfil
      </Link>
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">Mis tareas</h1>
        <p className="mt-1 text-[13px] text-marca-500">Lo que te asignaron en la plataforma de Iberia.</p>
      </header>

      {abiertas.length === 0 ? (
        <div className="tarjeta-canal mb-4 px-6 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-100 text-marca-500">
            <IconoCheck className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-marca-900">No tienes tareas pendientes</h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-marca-500">Cuando alguien te asigne una, te avisamos en la campana.</p>
        </div>
      ) : (
        <ul className="tarjeta-canal mb-4 divide-y divide-marca-100 overflow-hidden">
          {abiertas.map((t) => (
            <FilaTarea key={t.id} t={t} hoy={hoy} />
          ))}
        </ul>
      )}

      {hechas.length > 0 && (
        <section aria-labelledby="hechas">
          <h2 id="hechas" className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-500 uppercase">
            Hechas
          </h2>
          <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
            {hechas.map((t) => (
              <FilaTarea key={t.id} t={t} hoy={hoy} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function FilaTarea({ t, hoy }: { t: Tarea; hoy: string }) {
  const hecha = t.estado === 'hecha'
  const atrasada = vencida(t, hoy)
  return (
    <li className="flex items-start gap-3 px-4 py-3.5">
      <form action={cambiarMiTarea} className="shrink-0">
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="estado" value={hecha ? 'abierta' : 'hecha'} />
        <button
          type="submit"
          aria-label={hecha ? `Reabrir: ${t.titulo}` : `Marcar como hecha: ${t.titulo}`}
          className={cn(
            'toque -m-1.5 w-11 rounded-full',
            hecha ? 'text-[#1f6f4b]' : 'text-marca-500 active:bg-marca-100'
          )}
        >
          <span className={cn('grid h-7 w-7 place-items-center rounded-full border-2', hecha ? 'border-[#1f8a5b] bg-[#e7f5ee]' : 'border-marca-300')}>
            {hecha && <IconoCheck className="h-4 w-4" />}
          </span>
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <p className={cn('text-[15px] leading-snug', hecha ? 'text-marca-500 line-through' : 'font-semibold text-marca-900')}>{t.titulo}</p>
        {t.detalle && !hecha && <p className="mt-0.5 text-[13px] leading-relaxed text-marca-600">{t.detalle}</p>}
        <p className="mt-1 text-[12px] text-marca-500">
          {t.vence && !hecha && (
            <span className={cn(atrasada && 'font-semibold text-acento-700')}>
              {atrasada ? 'Venció el ' : venceHoy(t, hoy) ? 'Vence hoy · ' : 'Vence el '}
              {venceHoy(t, hoy) ? '' : fechaCorta(t.vence)}
              {' · '}
            </span>
          )}
          De {t.creadaPor.nombre}
        </p>
        {t.objetoTipo && t.objetoId && t.objetoTitulo && tieneFicha(t.objetoTipo) && (
          <Link href={hrefFicha(t.objetoTipo, t.objetoId)} className="mt-1 inline-flex min-h-11 items-center text-[13px] font-semibold text-acento-700 active:text-acento-800">
            {t.objetoTitulo} →
          </Link>
        )}
      </div>
    </li>
  )
}
