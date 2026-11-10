'use client'

import { useState, useTransition } from 'react'
import { aceptarNormas } from '@/app/canal/(dentro)/acciones'

/**
 * El botón de la pantalla que pide aceptar las normas al entrar al canal. Al
 * guardar, recarga la página entera en vez de refrescar con el router: es una
 * petición GET normal, la más resistente en la red del teléfono, y el layout la
 * pinta ya con las normas aceptadas.
 */
export function AceptarNormas() {
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
            try {
              const r = await aceptarNormas()
              if (!r.ok) {
                setError('No se pudo guardar. Revisa tu conexión e intenta otra vez.')
                return
              }
              window.location.reload()
            } catch {
              setError('No se pudo guardar. Revisa tu conexión e intenta otra vez.')
            }
          })
        }}
        className="btn-acento min-h-11 w-full text-[15px]"
      >
        {enCurso ? 'Guardando…' : 'Acepto las normas'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-[13px] text-acento-700">
          {error}
        </p>
      )}
    </>
  )
}
