'use client'

import { useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * Un campo de contraseña con el ojito para verla (26-nov-2026, pedido de Gabriel). El botón tiene 44 px de alto
 * táctil, dice lo que hace («Mostrar la contraseña» / «Ocultarla») y no se lleva el foco del formulario al enviar.
 */
export function CampoClave({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [ver, setVer] = useState(false)
  return (
    <div className="relative">
      <input {...props} type={ver ? 'text' : 'password'} className={cn(className, 'pr-12')} />
      <button
        type="button"
        onClick={() => setVer((v) => !v)}
        aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        aria-pressed={ver}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-marca-500 hover:text-marca-800 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acento-500"
      >
        {ver ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 3l18 18" />
            <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 8.7 4.2 9.8 6.5a1.2 1.2 0 0 1 0 1c-.5 1-1.4 2.4-2.8 3.6M6.2 6.3C4.2 7.7 2.8 9.7 2.2 11.5a1.2 1.2 0 0 0 0 1C3.3 14.8 7 19 12 19c1.7 0 3.2-.5 4.5-1.2" />
            <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2.2 12.5a1.2 1.2 0 0 1 0-1C3.3 9.2 7 5 12 5s8.7 4.2 9.8 6.5a1.2 1.2 0 0 1 0 1C20.7 14.8 17 19 12 19S3.3 14.8 2.2 12.5Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
