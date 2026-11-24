'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * «← Volver»: a la pantalla de donde se vino; si la ficha se abrió desde un enlace (sin historial en la app), al
 * módulo del objeto o a Mi día.
 */
export function BotonVolver({ respaldo }: { respaldo: string }) {
  const router = useRouter()
  return (
    <Link
      href={respaldo}
      onClick={(e) => {
        if (window.history.length > 1 && document.referrer && new URL(document.referrer).origin === window.location.origin) {
          e.preventDefault()
          router.back()
        }
      }}
      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[12px] font-medium text-marca-700 hover:bg-marca-50"
    >
      <span aria-hidden>←</span> Volver
    </Link>
  )
}
