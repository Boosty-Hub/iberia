'use client'

import { useEffect, useState } from 'react'
import { unstable_isUnrecognizedActionError } from 'next/navigation'

/**
 * Si una pestaña quedó abierta con la versión anterior y se publicó otra, la acción que se toque ya no existe en el
 * servidor («Server Action … was not found», 409). Next recarga solo al navegar (`deploymentId`); esto cubre el caso de
 * tocar un botón sin navegar: en vez de un fallo silencioso, un aviso con «Recargar» (26-nov-2026).
 */
export function AvisoVersionNueva() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const revisar = (error: unknown) => {
      if (unstable_isUnrecognizedActionError(error) || (error instanceof Error && error.name === 'UnrecognizedActionError')) setVisible(true)
    }
    const alError = (e: ErrorEvent) => revisar(e.error)
    const alRechazo = (e: PromiseRejectionEvent) => revisar(e.reason)
    window.addEventListener('error', alError)
    window.addEventListener('unhandledrejection', alRechazo)
    return () => {
      window.removeEventListener('error', alError)
      window.removeEventListener('unhandledrejection', alRechazo)
    }
  }, [])
  if (!visible) return null
  return (
    <div role="alert" className="fixed inset-x-3 bottom-3 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-[var(--borde)] bg-white px-4 py-3 shadow-xl" data-version-nueva>
      <p className="min-w-0 flex-1 text-[13px] text-marca-800">
        <strong>Hay una versión nueva de la plataforma.</strong> Recarga la página para seguir.
      </p>
      <button type="button" className="btn-acento min-h-11 shrink-0 px-4 text-[13px]" onClick={() => window.location.reload()}>
        Recargar
      </button>
    </div>
  )
}
