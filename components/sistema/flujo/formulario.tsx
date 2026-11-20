'use client'

import { useActionState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { IconoAlerta, IconoCheck } from '@/components/iconos'
import { cn } from '@/lib/utils'
import type { EstadoAccion } from './formato'

export type Accion = (anterior: EstadoAccion, fd: FormData) => Promise<EstadoAccion>

export function Mensaje({ estado, className }: { estado: EstadoAccion; className?: string }) {
  if (estado.error)
    return (
      <p role="alert" className={cn('mt-3 flex items-start gap-2 rounded-lg border border-acento-200 bg-acento-50 px-3 py-2 text-sm text-acento-800', className)}>
        <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
        {estado.error}
      </p>
    )
  if (estado.ok)
    return (
      <p role="status" className={cn('mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800', className)}>
        <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
        {estado.ok}
      </p>
    )
  return null
}

/** Botón de envío que se apaga y cambia de texto mientras la acción va y vuelve. */
export function Enviar({
  children,
  pendiente = 'Guardando…',
  clase = 'btn-acento',
  className,
  name,
  value,
  confirmar,
}: {
  children: ReactNode
  pendiente?: string
  clase?: 'btn-acento' | 'btn-primario' | 'btn-neutro' | 'btn-peligro'
  className?: string
  name?: string
  value?: string
  /** Pregunta antes de mandar: para lo que no se deshace. */
  confirmar?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cn(clase, 'h-10', className)}
      onClick={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault()
      }}
    >
      {pending ? pendiente : children}
    </button>
  )
}

/** Un formulario con su acción de servidor y el mensaje que devuelve, debajo. */
export function FormAccion({
  accion,
  children,
  className,
  mensajeClase,
}: {
  accion: Accion
  children: ReactNode
  className?: string
  mensajeClase?: string
}) {
  const [estado, enviar] = useActionState<EstadoAccion, FormData>(accion, {})
  return (
    <form action={enviar} className={className}>
      {children}
      <Mensaje estado={estado} className={mensajeClase} />
    </form>
  )
}
