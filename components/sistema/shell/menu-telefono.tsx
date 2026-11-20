'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconoCerrar, IconoMenu } from '@/components/iconos'

/**
 * El menú del teléfono (≤ 900 px): el riel, los módulos y los controles
 * globales en un `<dialog>` que entra por la izquierda. El navegador encierra el
 * foco, cierra con Esc y lo devuelve al botón; se cierra solo al navegar.
 */
export function MenuTelefono({ children }: { children: ReactNode }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const ruta = usePathname()
  useEffect(() => {
    dialogo.current?.close()
  }, [ruta])

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white min-[901px]:hidden"
        aria-label="Abrir el menú"
        aria-haspopup="dialog"
      >
        <IconoMenu className="h-5 w-5" />
      </button>
      <dialog
        ref={dialogo}
        className="menu-movil"
        aria-label="Menú de la plataforma"
        onClick={(e) => {
          if (e.target === dialogo.current) dialogo.current?.close()
        }}
      >
        <div className="menu-movil-panel">
          <div className="flex items-center justify-between border-b border-[var(--borde)] px-4 py-3">
            <p className="text-sm font-semibold text-marca-800">Plataforma Iberia</p>
            <button type="button" onClick={() => dialogo.current?.close()} className="btn-neutro h-10 w-10 p-0" aria-label="Cerrar el menú">
              <IconoCerrar className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </dialog>
    </>
  )
}
