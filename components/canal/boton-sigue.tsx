'use client'

import { useFormStatus } from 'react-dom'
import { cn } from '@/lib/utils'

/**
 * El botón que hace avanzar la lección.
 *
 * Hace dos cosas que un `<button>` suelto no hace, y las dos responden a lo
 * mismo: que no parezca muerto.
 *
 *  · **Late mientras espera** (`.btn-canal-sigue`, en `globals.css`). Al
 *    terminar un audio la pantalla se quedaba quieta y no decía qué tocar.
 *  · **Gira mientras se manda.** La acción va al servidor y vuelve, y en una
 *    conexión de planta eso es un segundo o dos sin nada en pantalla: la gente
 *    tocaba otra vez, o creía que el botón no servía.
 *
 * Va dentro de un `<form action={…}>`: `useFormStatus` lee el de su formulario.
 */
export function BotonSigue({
  children,
  disabled,
  className,
}: {
  children: React.ReactNode
  disabled?: boolean
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className={cn('btn-canal btn-canal-rojo btn-canal-sigue w-full', className)}
    >
      {pending && <Girando />}
      {children}
    </button>
  )
}

/** El mismo anillo del reproductor, en blanco sobre el rojo. */
export function Girando({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5 animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
