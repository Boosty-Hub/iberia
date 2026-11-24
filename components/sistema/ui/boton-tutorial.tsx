'use client'

import { useEffect, useRef, useState } from 'react'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { pestanaDeRuta, type Pestana } from '@/lib/plataforma/dominios'

export type TutorialMenu = { ruta: string; titulo: string; descripcion: string | null; duracion_seg: number | null }

/**
 * «Ver tutorial» en la cabecera del módulo: sale si la pestaña activa tiene video (`ui.tutorial`, por su ruta) y lo
 * abre en un popup. El video llega por `/sistema/tutoriales/video`, que firma el enlace con el permiso de la pestaña.
 */
export function BotonTutorial({ tutoriales, pestanas }: { tutoriales: TutorialMenu[]; pestanas: Pestana[] }) {
  const { ruta } = useContextoUrl()
  const [abierto, setAbierto] = useState(false)
  const activa = pestanaDeRuta(ruta, pestanas)
  const clave = activa?.href ?? ruta
  const t = tutoriales.find((x) => x.ruta === clave)
  if (!t) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50"
        title={`Tutorial: ${t.titulo}${t.duracion_seg ? ` (${duracion(t.duracion_seg)})` : ''}`}
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-acento-600" fill="currentColor" aria-hidden>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-1.5 4.2 4 2.5a.35.35 0 0 1 0 .6l-4 2.5a.35.35 0 0 1-.53-.3v-5a.35.35 0 0 1 .53-.3Z" />
        </svg>
        Ver tutorial
      </button>
      {abierto && <Popup t={t} alCerrar={() => setAbierto(false)} />}
    </>
  )
}

function duracion(s: number) {
  const m = Math.floor(s / 60)
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`
}

function Popup({ t, alCerrar }: { t: TutorialMenu; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    const cerrar = () => alCerrar()
    d.addEventListener('close', cerrar)
    return () => d.removeEventListener('close', cerrar)
  }, [alCerrar])
  const src = `/sistema/tutoriales/video?ruta=${encodeURIComponent(t.ruta)}`
  return (
    <dialog
      ref={ref}
      aria-label={`Tutorial: ${t.titulo}`}
      className="m-auto w-[min(1100px,96vw)] max-w-none overflow-hidden rounded-2xl border border-[var(--borde)] bg-white p-0 shadow-xl backdrop:bg-black/50"
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="flex items-start gap-3 border-b border-[var(--borde)] px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-acento-700 uppercase">Tutorial</p>
          <h2 className="text-[15px] leading-snug font-bold text-marca-900">{t.titulo}</h2>
          {t.descripcion && <p className="text-[12.5px] text-marca-500">{t.descripcion}</p>}
        </div>
        <button type="button" onClick={() => ref.current?.close()} className="h-8 w-8 shrink-0 rounded-lg border border-[var(--borde)] text-[14px] hover:bg-marca-50" aria-label="Cerrar el tutorial">
          ✕
        </button>
      </div>
      <video
        src={src}
        poster={`${src}&poster=1`}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="block aspect-[16/10] max-h-[80dvh] w-full bg-[#1c1b1a]"
      >
        Tu navegador no reproduce el video.
      </video>
    </dialog>
  )
}
