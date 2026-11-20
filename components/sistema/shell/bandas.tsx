'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { fijarVerComo } from '@/components/sistema/shell/acciones'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import type { EscenarioBarra } from '@/components/sistema/shell/barra-cliente'
import { IconoOjo, IconoRombo } from '@/components/sistema/shell/iconos'
import { fechaLarga, hoyCaracas } from '@/lib/plataforma/formato'

/**
 * Las bandas que dicen en qué contexto estás: el escenario (morado, reservado a
 * eso) y la fecha de los datos cuando no es hoy (ámbar). Con texto y botón:
 * nunca solo el color.
 */
export function BandasContexto({ escenarios }: { escenarios: EscenarioBarra[] }) {
  const { sp, fijar } = useContextoUrl()
  const esc = sp.get('esc')
  const al = sp.get('al')
  const hoy = hoyCaracas()
  const nombre = esc ? (escenarios.find((e) => e.id === esc)?.nombre ?? 'un escenario') : null

  return (
    <>
      {esc && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-xs font-semibold text-white sm:px-5"
          style={{ background: 'repeating-linear-gradient(135deg,#6b4fb3,#6b4fb3 10px,#7a5fc2 10px,#7a5fc2 20px)' }}
        >
          <IconoRombo className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            Estás en el escenario «{nombre}» · nada de lo que cambies aquí toca la realidad hasta que se apruebe
          </span>
          <button type="button" onClick={() => fijar({ esc: null })} className="h-7 rounded-md bg-white px-2.5 text-[#4b3690] hover:bg-[#f1edfa] focus-visible:outline-2 focus-visible:outline-white">
            Volver a la realidad
          </button>
        </div>
      )}
      {al && al !== hoy && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 sm:px-5">
          <span className="min-w-0 flex-1">
            Estás viendo los datos al <b>{fechaLarga(al)}</b>, no los de hoy.
          </span>
          <button type="button" onClick={() => fijar({ al: null })} className="h-7 rounded-md border border-amber-300 bg-white px-2.5 font-semibold hover:bg-amber-100">
            Volver a hoy
          </button>
        </div>
      )}
    </>
  )
}

/** La banda de «ver como», con su salida. La pinta el layout solo si está activa. */
export function BandaVerComo({ rol }: { rol: string }) {
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-sky-200 bg-sky-50 px-4 py-1.5 text-xs text-sky-950 sm:px-5">
      <IconoOjo className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Estás viendo la plataforma como <b>«{rol}»</b>. Solo cambia lo que ves: los datos y los permisos reales siguen siendo los tuyos.
      </span>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            await fijarVerComo(null)
            router.refresh()
          })
        }
        className="h-7 rounded-md border border-sky-300 bg-white px-2.5 font-semibold hover:bg-sky-100 disabled:opacity-60"
      >
        Volver a mi vista
      </button>
    </div>
  )
}
