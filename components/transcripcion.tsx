'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { IconoBuscar, IconoHallazgos } from '@/components/iconos'
import type { Segmento } from '@/lib/types'
import { formatTimestamp } from '@/lib/utils'

/** Paleta estable por hablante: el mismo nombre siempre recibe el mismo color. */
const COLORES = [
  'text-acento-700',
  'text-marca-600',
  'text-violet-700',
  'text-amber-700',
  'text-rose-700',
  'text-emerald-700',
  'text-cyan-700',
]

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Ámbar, no rojo: sobre el rojo de marca un resaltado rojo se leería como error.
function Resaltado({ texto, termino }: { texto: string; termino: string }) {
  if (!termino.trim()) return <>{texto}</>

  const partes = texto.split(new RegExp(`(${escaparRegex(termino.trim())})`, 'gi'))
  return (
    <>
      {partes.map((parte, i) =>
        parte.toLowerCase() === termino.trim().toLowerCase() ? (
          <mark key={i} className="rounded bg-amber-200/80 px-0.5 text-marca-900">
            {parte}
          </mark>
        ) : (
          parte
        )
      )}
    </>
  )
}

export function Transcripcion({
  segmentos,
  entrevistaId,
  puedeEditar,
}: {
  segmentos: Segmento[]
  entrevistaId: string
  puedeEditar: boolean
}) {
  const [termino, setTermino] = useState('')

  const colorPorHablante = useMemo(() => {
    const mapa = new Map<string, string>()
    let i = 0
    for (const s of segmentos) {
      const nombre = s.hablante ?? '—'
      if (!mapa.has(nombre)) {
        mapa.set(nombre, COLORES[i % COLORES.length])
        i++
      }
    }
    return mapa
  }, [segmentos])

  const visibles = useMemo(() => {
    const t = termino.trim().toLowerCase()
    if (!t) return segmentos
    return segmentos.filter(
      (s) =>
        s.texto.toLowerCase().includes(t) || (s.hablante ?? '').toLowerCase().includes(t)
    )
  }, [segmentos, termino])

  return (
    <section className="tarjeta">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--borde)] px-5 py-3.5">
        <h2 className="text-sm font-semibold text-marca-800">
          Transcripción
          <span className="ml-2 text-xs font-normal text-marca-500">
            {segmentos.length} {segmentos.length === 1 ? 'turno' : 'turnos'}
            {termino.trim() && ` · ${visibles.length} coinciden`}
          </span>
        </h2>

        <div className="relative w-full sm:w-64">
          <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-marca-400" />
          <input
            type="search"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            placeholder="Buscar en la transcripción…"
            aria-label="Buscar en la transcripción"
            className="campo py-1.5 pl-9 text-sm"
          />
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-marca-500">
          {termino.trim()
            ? `Nada coincide con «${termino.trim()}».`
            : 'Esta entrevista todavía no tiene transcripción.'}
        </p>
      ) : (
        <ol className="divide-y divide-[var(--borde)]">
          {visibles.map((s, i) => {
            const nombre = s.hablante ?? 'Sin atribuir'
            // Turnos seguidos del mismo hablante no repiten el encabezado.
            const anterior = visibles[i - 1]
            const mismoHablante = anterior?.hablante === s.hablante

            return (
              <li key={s.id} className="group px-5 py-3">
                {!mismoHablante && (
                  <p className="mb-1 flex items-baseline gap-2">
                    <span
                      className={`text-sm font-semibold ${colorPorHablante.get(nombre) ?? 'text-marca-700'}`}
                    >
                      {nombre}
                    </span>
                    {s.inicio_segundos !== null && (
                      <span className="font-mono text-[11px] text-marca-400">
                        {formatTimestamp(Number(s.inicio_segundos))}
                      </span>
                    )}
                  </p>
                )}

                <div className="flex items-start justify-between gap-3">
                  <p className="flex-1 text-sm leading-relaxed whitespace-pre-line text-marca-700">
                    <Resaltado texto={s.texto} termino={termino} />
                  </p>

                  {puedeEditar && (
                    <Link
                      href={{
                        pathname: '/dashboard/hallazgos/nuevo',
                        query: {
                          entrevista: entrevistaId,
                          segmento: String(s.id),
                          cita: s.texto.slice(0, 500),
                        },
                      }}
                      title="Crear un hallazgo con esta cita"
                      className="mt-0.5 shrink-0 rounded p-1.5 text-marca-300 transition-colors group-hover:text-acento-600 hover:bg-acento-50 focus-visible:text-acento-600"
                    >
                      <IconoHallazgos className="h-4 w-4" />
                      <span className="sr-only">Crear hallazgo con esta cita</span>
                    </Link>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
