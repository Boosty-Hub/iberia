'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { crearUsuario, type EstadoUsuario } from '@/app/dashboard/usuarios/acciones'
import { IconoAlerta, IconoCheck, IconoMas } from '@/components/iconos'
import { ORGANIZACIONES, ROLES, ROL_DESCRIPCION, type Rol } from '@/lib/types'

function BotonCrear() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento" disabled={pending}>
      <IconoMas className="h-4 w-4" />
      {pending ? 'Creando…' : 'Crear usuario'}
    </button>
  )
}

export function CrearUsuario() {
  const [estado, enviar] = useActionState<EstadoUsuario, FormData>(crearUsuario, {})

  return (
    <form
      action={enviar}
      // key remonta el formulario tras un alta exitosa, limpiando los campos.
      key={estado.ok ?? 'formulario'}
      className="tarjeta p-5"
    >
      <h2 className="mb-1 text-sm font-semibold text-marca-800">Provisionar acceso</h2>
      <p className="mb-4 text-xs text-marca-500">
        No hay registro abierto: las cuentas se crean aquí y la contraseña se le entrega a la
        persona por un canal seguro.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="etiqueta">
            Correo <span className="text-red-600">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="nombre@empresa.com"
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="password" className="etiqueta">
            Contraseña inicial <span className="text-red-600">*</span>
          </label>
          <input
            id="password"
            name="password"
            type="text"
            required
            minLength={10}
            autoComplete="off"
            placeholder="Mínimo 10 caracteres"
            className="campo font-mono"
          />
        </div>

        <div>
          <label htmlFor="nombre_completo" className="etiqueta">
            Nombre completo
          </label>
          <input
            id="nombre_completo"
            name="nombre_completo"
            placeholder="Nombre y apellido"
            className="campo"
          />
        </div>

        <div>
          <label htmlFor="cargo" className="etiqueta">
            Cargo
          </label>
          <input id="cargo" name="cargo" placeholder="Gerente General" className="campo" />
        </div>

        <div>
          <label htmlFor="organizacion" className="etiqueta">
            Organización
          </label>
          <select id="organizacion" name="organizacion" defaultValue="boosty" className="campo">
            {Object.entries(ORGANIZACIONES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rol" className="etiqueta">
            Rol
          </label>
          <select id="rol" name="rol" defaultValue="consultor" className="campo">
            {Object.entries(ROLES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      <ul className="mt-4 space-y-1 border-t border-[var(--borde)] pt-4 text-xs text-marca-500">
        {(Object.keys(ROLES) as Rol[]).map((r) => (
          <li key={r}>
            <span className="font-medium text-marca-700">{ROLES[r]}:</span>{' '}
            {ROL_DESCRIPCION[r]}
          </li>
        ))}
      </ul>

      {estado.error && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          {estado.error}
        </p>
      )}

      {estado.ok && (
        <p
          role="status"
          className="mt-4 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {estado.ok}
        </p>
      )}

      <div className="mt-4">
        <BotonCrear />
      </div>
    </form>
  )
}
