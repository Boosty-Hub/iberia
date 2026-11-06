'use client'

import { useState, useTransition } from 'react'
import { desbloquearPersona } from '@/app/canal/(dentro)/moderacion/acciones'
import { cn } from '@/lib/utils'

/**
 * Deshace un bloqueo desde donde se ve —el aviso de una conversación, la lista de
 * «Personas bloqueadas»—. La acción refresca el canal y la pantalla se acomoda sola.
 */
export function BotonDesbloquear({
  empleadoId,
  className,
}: {
  empleadoId: string
  className?: string
}) {
  const [enCurso, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        disabled={enCurso}
        onClick={() => {
          setError(null)
          empezar(async () => {
            const r = await desbloquearPersona(empleadoId)
            if (!r.ok) setError(r.error ?? 'No se pudo desbloquear.')
          })
        }}
        className={cn('btn-canal btn-canal-suave px-4 text-[14px]', className)}
      >
        {enCurso ? 'Desbloqueando…' : 'Desbloquear'}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[12px] text-acento-700">
          {error}
        </p>
      )}
    </>
  )
}
