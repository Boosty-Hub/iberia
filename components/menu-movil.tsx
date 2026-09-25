'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, type ReactNode } from 'react'
import { IconoCerrar, IconoMenu } from '@/components/iconos'

/**
 * La navegación de teléfono y tableta: un botón que abre un panel lateral.
 *
 * Va en un `<dialog>` modal: el navegador pone el foco dentro, lo encierra,
 * cierra con Escape y devuelve el foco al botón — lo que a mano se hace mal. Se
 * cierra solo al navegar y con un toque sobre el fondo. Por encima de 1024 px no
 * existe: ahí la barra lateral está a la vista.
 */
export function MenuMovil({
  titulo,
  etiqueta,
  children,
}: {
  titulo: string
  /** Lo que dice el botón a un lector de pantalla. */
  etiqueta: string
  children: ReactNode
}) {
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
        className="btn-neutro h-10 w-10 shrink-0 p-0 lg:hidden"
        aria-label={etiqueta}
        aria-haspopup="dialog"
      >
        <IconoMenu className="h-5 w-5" />
      </button>

      <dialog
        ref={dialogo}
        className="menu-movil"
        aria-label={titulo}
        onClick={(ev) => {
          if (ev.target === dialogo.current) dialogo.current?.close()
        }}
      >
        <div className="menu-movil-panel">
          <div className="flex items-center justify-between border-b border-[var(--borde)] px-4 py-3">
            <p className="text-sm font-semibold text-marca-800">{titulo}</p>
            <button
              type="button"
              onClick={() => dialogo.current?.close()}
              className="btn-neutro h-10 w-10 p-0"
              aria-label="Cerrar el menú"
            >
              <IconoCerrar className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </dialog>
    </>
  )
}
