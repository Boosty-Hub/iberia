'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/** El evento que avisa que algo quedó en el borrador de cambios (lo lanzan las celdas y las fichas). */
export const EVENTO_PROPUESTO = 'plataforma:cambio-propuesto'

export function avisarPropuesto(texto?: string) {
  window.dispatchEvent(new CustomEvent(EVENTO_PROPUESTO, { detail: texto ?? null }))
}

/**
 * «Mis cambios» en la barra: cuántos cambios tengo en el borrador, sin enviar a aprobación. Al proponer uno, sube el
 * número y sale un aviso con el enlace: el valor de la celda sigue mostrando la realidad hasta que se apruebe, y sin
 * el aviso parecería que no guardó.
 */
export function MisCambios({ inicial }: { inicial: number }) {
  const [n, setN] = useState(inicial)
  const [aviso, setAviso] = useState<string | null>(null)
  useEffect(() => setN(inicial), [inicial])
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const al = (e: Event) => {
      setN((x) => x + 1)
      setAviso(((e as CustomEvent).detail as string | null) ?? 'Quedó en tus cambios por aprobar.')
      clearTimeout(t)
      t = setTimeout(() => setAviso(null), 6000)
    }
    window.addEventListener(EVENTO_PROPUESTO, al)
    return () => {
      window.removeEventListener(EVENTO_PROPUESTO, al)
      clearTimeout(t)
    }
  }, [])
  return (
    <>
      {n > 0 && (
        <Link
          href="/sistema/cambios"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#FFD036]/60 bg-[#FFD036]/15 px-2 text-sm font-medium whitespace-nowrap text-[#FFD036] hover:bg-[#FFD036]/25"
          title="Cambios en tu borrador, sin enviar a aprobación"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 2xl:hidden" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M3 2.5h7l3 3V13.5H3z M10 2.5v3h3 M5.5 8.5h5 M5.5 11h3.5" />
          </svg>
          <span className="hidden 2xl:inline">Mis cambios</span>
          <span className="sr-only 2xl:hidden">Mis cambios</span>
          <span className="rounded-md bg-[#FFD036] px-1.5 text-[12px] font-bold text-[#2b2a28] tabular-nums">{n}</span>
        </Link>
      )}
      {aviso && (
        <div role="status" className="fixed right-4 bottom-4 z-[60] flex max-w-sm items-start gap-3 rounded-xl border border-[var(--borde)] bg-white p-3 text-[13px] text-marca-800 shadow-xl">
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#b7791f]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p>{aviso}</p>
            <Link href="/sistema/cambios" className="mt-1 inline-block font-semibold text-acento-700 hover:underline">
              Ver mis cambios y enviarlos →
            </Link>
          </div>
          <button type="button" onClick={() => setAviso(null)} className="text-marca-400 hover:text-marca-800" aria-label="Cerrar el aviso">
            ✕
          </button>
        </div>
      )}
    </>
  )
}
