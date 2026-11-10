'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { iniciarSesion, type EstadoLogin } from './actions'

function BotonEnviar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento min-h-11 w-full" disabled={pending}>
      {pending ? 'Verificando…' : 'Entrar'}
    </button>
  )
}

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, {})

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="destino" value={destino} />

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
          className="campo min-h-11"
        />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="etiqueta mb-0">
            Contraseña
          </label>
          {/* 44 px de alto táctil; el margen negativo no engorda la fila. */}
          <Link
            href="/login/recuperar"
            className="-mr-2 inline-flex min-h-11 items-center px-2 text-xs font-medium text-acento-600 underline-offset-2 hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
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

      <BotonEnviar />
    </form>
  )
}
