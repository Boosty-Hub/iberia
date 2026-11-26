'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

const BOTON_CABECERA = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50'

/** El botón «Guía» y su popup; el contenido lo arma el servidor con el alcance real de la persona (`GuiaAsistente`). */
export function BotonGuia({ children }: { children: ReactNode }) {
  const [abierta, setAbierta] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierta && !d.open) d.showModal()
    const cerrar = () => setAbierta(false)
    d.addEventListener('close', cerrar)
    return () => d.removeEventListener('close', cerrar)
  }, [abierta])
  return (
    <>
      <button type="button" className={BOTON_CABECERA} onClick={() => setAbierta(true)} data-boton-guia>
        <span aria-hidden>📘</span> Guía
      </button>
      {abierta && (
        <dialog
          ref={ref}
          aria-label="Guía del asistente"
          className="m-auto max-h-[90dvh] w-[min(680px,94vw)] max-w-none overflow-hidden rounded-2xl border border-[var(--borde)] bg-white p-0 shadow-xl backdrop:bg-black/40"
          onClick={(e) => e.target === ref.current && ref.current?.close()}
        >
          <div className="flex max-h-[90dvh] flex-col">
            <div className="flex items-center border-b border-[var(--borde)] px-4 py-3">
              <h2 className="flex-1 text-[15px] font-bold text-marca-900">Guía del asistente · lo que puedes hacer</h2>
              <button type="button" aria-label="Cerrar la guía" className="h-8 w-8 rounded-lg text-marca-500 hover:bg-marca-50" onClick={() => ref.current?.close()}>
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-4 pt-3 pb-5" data-guia>
              {children}
            </div>
          </div>
        </dialog>
      )}
    </>
  )
}
