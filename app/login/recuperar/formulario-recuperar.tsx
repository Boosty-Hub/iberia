'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { pedirRecuperacion, type EstadoRecuperacion } from '../actions'

function BotonEnviar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento w-full" disabled={pending}>
      {pending ? 'Enviando…' : 'Mandarme el enlace'}
    </button>
  )
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState<EstadoRecuperacion, FormData>(pedirRecuperacion, {})

  // El mismo mensaje exista o no la cuenta: ver `pedirRecuperacion`.
  if (estado.enviado) {
    return (
      <div role="status" className="rounded-md border border-marca-200 bg-marca-50 px-4 py-3 text-sm text-marca-700">
        <p className="mb-1 font-semibold text-marca-900">Revisa tu correo</p>
        <p>
          Si ese correo tiene cuenta en el programa, te llegará un enlace para crear tu contraseña nueva.
          Puede tardar unos minutos; revisa también la carpeta de correo no deseado.
        </p>
      </div>
    )
  }

  return (
    <form action={accion} className="space-y-4">
      <div>
        <label htmlFor="email" className="etiqueta">
          Correo corporativo
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
          placeholder="nombre@empresa.com"
          className="campo"
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

      <BotonEnviar />
    </form>
  )
}
