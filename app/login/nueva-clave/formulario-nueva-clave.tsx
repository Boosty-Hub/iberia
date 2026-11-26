'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { cambiarClave, type EstadoNuevaClave } from '../actions'
import { CampoClave } from '@/components/campo-clave'

function BotonGuardar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento min-h-11 w-full" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar y entrar'}
    </button>
  )
}

export function FormularioNuevaClave() {
  const [estado, accion] = useActionState<EstadoNuevaClave, FormData>(cambiarClave, {})

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label htmlFor="clave" className="etiqueta">
          Contraseña nueva
        </label>
        <CampoClave
          id="clave"
          name="clave"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          placeholder="Al menos 8 caracteres"
          className="campo min-h-11"
        />
      </div>

      <div>
        <label htmlFor="repetida" className="etiqueta">
          Repítela
        </label>
        <CampoClave
          id="repetida"
          name="repetida"
          autoComplete="new-password"
          required
          minLength={8}
          className="campo min-h-11"
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {estado.error}
        </p>
      )}

      <BotonGuardar />
    </form>
  )
}
