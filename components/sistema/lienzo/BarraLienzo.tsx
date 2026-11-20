'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * La barra de datos de encima del lienzo: vista (lienzo o esquema), «Datos al»
 * y el escenario. Todo vive en la dirección (`al`, `esc`, `vista`), que es lo
 * mismo que leen los controles globales del armazón: un enlace copiado abre lo
 * mismo que se estaba viendo.
 */
export function BarraLienzo({
  ruta,
  fecha,
  hoy,
  escenarios,
  esc,
  vista,
  fechaBase,
  editarEscenario,
  nuevoEscenario,
}: {
  ruta: string
  fecha: string
  hoy: string
  escenarios: { id: string; nombre: string; estado: string }[]
  esc: string | null
  vista: 'lienzo' | 'esquema'
  fechaBase?: string | null
  editarEscenario?: string | null
  nuevoEscenario?: string | null
}) {
  const router = useRouter()
  const ir = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams()
    const actual = { vista: vista === 'esquema' ? 'esquema' : null, al: fecha !== hoy ? fecha : null, esc, ...cambios }
    for (const [k, v] of Object.entries(actual)) if (v) q.set(k, v)
    const s = q.toString()
    router.push(`${ruta}${s ? `?${s}` : ''}`)
  }
  const pastilla = (activa: boolean) =>
    cn('inline-flex min-h-9 items-center rounded-lg px-3 text-sm', activa ? 'bg-marca-800 font-semibold text-white' : 'text-marca-700 hover:bg-marca-100')

  return (
    <div className={cn('mb-3 flex flex-wrap items-center gap-2', esc && 'rounded-2xl border border-[#d9cff0] bg-[#f7f4fd] p-2')}>
      <div className="flex rounded-xl border border-marca-200 bg-white p-0.5" role="group" aria-label="Vista">
        <button type="button" className={pastilla(vista === 'lienzo')} aria-pressed={vista === 'lienzo'} onClick={() => ir({ vista: null })}>
          Lienzo
        </button>
        <button type="button" className={pastilla(vista === 'esquema')} aria-pressed={vista === 'esquema'} onClick={() => ir({ vista: 'esquema', esc: null })}>
          Esquema
        </button>
      </div>
      {esc ? (
        <span className="inline-flex min-h-9 items-center rounded-xl border border-marca-200 bg-white px-3 text-sm text-marca-600">
          Fecha base del escenario: <b className="ml-1 text-marca-900">{fechaBase ?? '—'}</b>
        </span>
      ) : (
        <label className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-marca-200 bg-white px-3 text-sm text-marca-600">
          Datos al
          <input
            type="date"
            className="bg-transparent font-semibold text-marca-900 outline-none"
            value={fecha}
            onChange={(e) => e.target.value && ir({ al: e.target.value === hoy ? null : e.target.value })}
          />
          {fecha !== hoy && (
            <button type="button" className="text-xs font-semibold text-acento-700 hover:underline" onClick={() => ir({ al: null })}>
              Hoy
            </button>
          )}
        </label>
      )}
      <span className="flex-1" />
      {vista === 'lienzo' && escenarios.length > 0 && (
        <label className={cn('inline-flex min-h-9 items-center gap-2 rounded-xl border bg-white px-3 text-sm', esc ? 'border-[#6b4fb3] text-[#6b4fb3]' : 'border-marca-200 text-marca-600')}>
          <span aria-hidden>◆</span>
          <select className="max-w-64 bg-transparent font-semibold outline-none" value={esc ?? ''} onChange={(e) => ir({ esc: e.target.value || null })} aria-label="Escenario">
            <option value="">La realidad</option>
            {escenarios.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
                {x.estado !== 'borrador' ? ` (${x.estado.replace('_', ' ')})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {esc && editarEscenario && (
        <Link href={editarEscenario} className="btn-neutro h-9 text-sm">
          Comparar y enviar
        </Link>
      )}
      {!esc && nuevoEscenario && vista === 'lienzo' && (
        <Link href={nuevoEscenario} className="btn-neutro h-9 text-sm">
          ◆ Nuevo escenario
        </Link>
      )}
    </div>
  )
}
