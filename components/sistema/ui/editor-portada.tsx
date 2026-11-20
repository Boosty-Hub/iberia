'use client'

import { useState, useTransition } from 'react'
import { guardarPortada, restablecerPortada } from '@/app/sistema/administracion/portadas/acciones'
import { cn } from '@/lib/utils'

export type OpcionMetrica = { clave: string; nombre: string; grupo: string }

/**
 * Las cifras de la portada de un rol, en su orden: subir, bajar, quitar y
 * agregar del registro. Guardar las deja en `ui.portada_rol`.
 */
export function EditorPortada({ rolId, inicial, opciones, guardada }: { rolId: string; inicial: string[]; opciones: OpcionMetrica[]; guardada: boolean }) {
  const [lista, setLista] = useState(inicial)
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null)
  const [pendiente, iniciar] = useTransition()
  const nombre = (c: string) => opciones.find((o) => o.clave === c)?.nombre ?? c
  const libres = opciones.filter((o) => !lista.includes(o.clave))
  const cambiada = lista.join() !== inicial.join()
  const mover = (i: number, d: -1 | 1) =>
    setLista((l) => {
      const n = [...l]
      const j = i + d
      if (j < 0 || j >= n.length) return l
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })
  const boton = 'grid h-7 w-7 place-items-center rounded-md border border-[var(--borde)] text-[12px] text-marca-600 hover:bg-marca-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-acento-500'

  return (
    <div>
      <ol className="flex flex-col gap-1.5" aria-label="Cifras de la portada, en orden">
        {lista.map((c, i) => (
          <li key={c} className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--borde)] bg-[#fafbfc] px-2 py-1.5">
            <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-marca-400 tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-marca-900">{nombre(c)}</span>
            <button type="button" className={boton} onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`Subir «${nombre(c)}»`}>
              ↑
            </button>
            <button type="button" className={boton} onClick={() => mover(i, 1)} disabled={i === lista.length - 1} aria-label={`Bajar «${nombre(c)}»`}>
              ↓
            </button>
            <button type="button" className={boton} onClick={() => setLista((l) => l.filter((x) => x !== c))} aria-label={`Quitar «${nombre(c)}»`}>
              ✕
            </button>
          </li>
        ))}
        {!lista.length && <li className="py-2 text-[12px] text-marca-400">Sin cifras: Mi día saldrá sin la sección «Mis cifras».</li>}
      </ol>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={`agregar-${rolId}`}>
          Agregar una cifra
        </label>
        <select
          id={`agregar-${rolId}`}
          className="h-8 max-w-full min-w-0 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px]"
          value=""
          disabled={lista.length >= 8 || !libres.length}
          onChange={(e) => e.target.value && setLista((l) => [...l, e.target.value])}
        >
          <option value="">{lista.length >= 8 ? 'Máximo 8 cifras' : '+ Agregar una cifra…'}</option>
          {[...new Set(libres.map((o) => o.grupo))].map((g) => (
            <optgroup key={g} label={g}>
              {libres
                .filter((o) => o.grupo === g)
                .map((o) => (
                  <option key={o.clave} value={o.clave}>
                    {o.nombre}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          disabled={pendiente || (!cambiada && guardada)}
          onClick={() => iniciar(async () => setMensaje(await guardarPortada(rolId, lista)))}
          className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-3 text-[12.5px] font-semibold text-white hover:bg-black disabled:opacity-50"
        >
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        {guardada && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              iniciar(async () => {
                const r = await restablecerPortada(rolId)
                setMensaje(r)
              })
            }
            className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] px-3 text-[12.5px] text-marca-700 hover:bg-marca-50"
          >
            Volver a la de su nivel
          </button>
        )}
      </div>
      {mensaje && (
        <p role="status" className={cn('mt-2 text-[12px]', mensaje.error ? 'text-[#a3241f]' : 'text-[#1f6f4b]')}>
          {mensaje.error ? `✕ ${mensaje.error}` : `✓ ${mensaje.ok}`}
        </p>
      )}
    </div>
  )
}
