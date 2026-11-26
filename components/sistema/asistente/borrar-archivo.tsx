'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { borrarArchivo } from './acciones'

/** Borra un archivo o HTML propio, con confirmación en dos toques (sin diálogos del navegador). */
export function BorrarArchivo({ tipo, id, nombre }: { tipo: 'archivo' | 'html'; id: string; nombre: string }) {
  const [seguro, setSeguro] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()
  return (
    <span className="inline-flex items-center gap-1.5">
      {error && <span className="text-[11.5px] text-acento-700">{error}</span>}
      <button
        type="button"
        disabled={pendiente}
        aria-label={seguro ? `Confirmar: borrar ${nombre}` : `Borrar ${nombre}`}
        onClick={() => {
          if (!seguro) {
            setSeguro(true)
            setTimeout(() => setSeguro(false), 4000)
            return
          }
          iniciar(async () => {
            const r = await borrarArchivo(tipo, id)
            if (!r.ok) setError(r.error)
            else router.refresh()
          })
        }}
        className={seguro ? 'btn-peligro h-7 px-2.5 text-[12px]' : 'btn-neutro h-7 px-2.5 text-[12px]'}
      >
        {pendiente ? 'Borrando…' : seguro ? '¿Seguro?' : 'Borrar'}
      </button>
    </span>
  )
}
