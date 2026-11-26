'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { CampoClave } from '@/components/campo-clave'
import { iniciarSesion, type EstadoLogin } from './actions'

// El correo escrito se recuerda en este navegador (26-nov-2026, Gabriel): un refresco o un intento fallido no lo
// borra. Solo el correo; la contraseña nunca se guarda.
const CLAVE_CORREO = 'iberia_login_correo'

function BotonEnviar({ entrando }: { entrando: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento min-h-11 w-full" disabled={pending || entrando}>
      {entrando ? 'Entrando…' : pending ? 'Verificando…' : 'Entrar'}
    </button>
  )
}

export function FormularioLogin({ destino }: { destino: string }) {
  const [estado, accion] = useActionState<EstadoLogin, FormData>(iniciarSesion, {})
  // Controlado: React limpia los campos no controlados al terminar la acción, y con un error se perdía el correo.
  const [correo, setCorreo] = useState('')
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_CORREO)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee después de montar: en el servidor no hay localStorage
      if (guardado) setCorreo(guardado)
    } catch {
      // Sin almacenamiento (ventana privada, bloqueado): se escribe cada vez.
    }
  }, [])
  const cambiarCorreo = (v: string) => {
    setCorreo(v)
    try {
      if (v) localStorage.setItem(CLAVE_CORREO, v)
      else localStorage.removeItem(CLAVE_CORREO)
    } catch {}
  }

  // La acción ya no redirige: devuelve a dónde ir y aquí se navega con una carga
  // completa (ver `iniciarSesion`). `replace` para que «atrás» no vuelva al login.
  useEffect(() => {
    if (estado.destino) window.location.replace(estado.destino)
  }, [estado.destino])

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
          value={correo}
          onChange={(e) => cambiarCorreo(e.target.value)}
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
        <CampoClave
          id="password"
          name="password"
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

      <BotonEnviar entrando={Boolean(estado.destino)} />
    </form>
  )
}
