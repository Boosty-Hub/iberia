'use client'

import { useFormStatus } from 'react-dom'
import { IconoAlerta, IconoCheck } from '@/components/iconos'
import type { EstadoAccion } from '@/app/sistema/nucleo/procesos/acciones'

export function Mensaje({ estado }: { estado: EstadoAccion }) {
  if (estado.error)
    return (
      <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-acento-200 bg-acento-50 px-3 py-2 text-sm text-acento-800">
        <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
        {estado.error}
      </p>
    )
  if (estado.ok)
    return (
      <p role="status" className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
        {estado.ok}
      </p>
    )
  return null
}

export function Enviar({ texto, pendiente, clase = 'btn-acento h-10', icono }: { texto: string; pendiente: string; clase?: string; icono?: React.ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className={clase} disabled={pending} aria-busy={pending}>
      {icono}
      {pending ? pendiente : texto}
    </button>
  )
}

export type OpcionSimple = { valor: string; etiqueta: string }

/** Crear un proceso hijo: nace como borrador versión 1 y, por defecto, va a aprobación. */
