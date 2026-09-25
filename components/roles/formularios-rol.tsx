'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { actualizarRol, crearRol, eliminarRol, type EstadoRol } from '@/app/dashboard/roles/acciones'
import { IconoAlerta, IconoBasura, IconoCheck, IconoMas } from '@/components/iconos'
import { NIVELES, NIVEL_DESCRIPCION, type Nivel } from '@/lib/permisos'

export type RolResumen = { id: string; nombre: string; nivel: string; descripcion: string | null; sistema: boolean }

function Mensaje({ estado }: { estado: EstadoRol }) {
  if (estado.error)
    return (
      <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-acento-200 bg-acento-50 px-3 py-2 text-sm text-acento-800">
        <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
        {estado.error}
      </p>
    )
  if (estado.ok)
    return (
      <p role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
        {estado.ok}
      </p>
    )
  return null
}

function Enviar({ texto, pendiente, icono }: { texto: string; pendiente: string; icono?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento h-10" disabled={pending}>
      {icono && <IconoMas className="h-4 w-4" />}
      {pending ? pendiente : texto}
    </button>
  )
}

/** El nivel, con lo que significa escrito debajo de cada opción: es la decisión que más pesa. */
function ElegirNivel({ valor, bloqueado, apilado }: { valor?: string; bloqueado?: boolean; apilado?: boolean }) {
  return (
    <fieldset disabled={bloqueado} className="min-w-0">
      <legend className="etiqueta">Nivel de acceso</legend>
      {/* En la columna lateral de 320 px, apiladas: en tres columnas no se leían. */}
      <div className={apilado ? 'grid gap-2' : 'grid gap-2 md:grid-cols-3'}>
        {(Object.keys(NIVELES) as Nivel[]).map((n) => (
          <label key={n} className="nivel-opcion">
            <input type="radio" name="nivel" value={n} defaultChecked={(valor ?? 'lector') === n} className="mt-1 accent-[var(--color-acento-600)]" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-marca-800">{NIVELES[n]}</span>
              <span className="mt-0.5 block text-xs text-marca-500">{NIVEL_DESCRIPCION[n]}</span>
            </span>
          </label>
        ))}
      </div>
      {bloqueado && (
        <p className="mt-2 text-xs text-marca-500">Es un rol de fábrica: su nivel no cambia.</p>
      )}
    </fieldset>
  )
}

export function CrearRol({ roles }: { roles: RolResumen[] }) {
  const [estado, enviar] = useActionState<EstadoRol, FormData>(crearRol, {})
  return (
    <form action={enviar} className="tarjeta p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-marca-800">Crear un rol</h2>
      <p className="mt-1 mb-5 text-xs text-marca-500">
        Ponle nombre, elige su nivel y, si quieres, parte de los permisos de otro rol. Después afinas la matriz.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rol-nombre" className="etiqueta">
            Nombre <span className="text-acento-600">*</span>
          </label>
          <input id="rol-nombre" name="nombre" required minLength={2} maxLength={60} placeholder="Gerentes de Iberia" className="campo" />
        </div>
        <div>
          <label htmlFor="rol-copiar" className="etiqueta">
            Partir de los permisos de
          </label>
          <select id="rol-copiar" name="copiar_de" defaultValue="" className="campo">
            <option value="">Ninguno · empezar en blanco</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="rol-descripcion" className="etiqueta">
            Para quién es
          </label>
          <input id="rol-descripcion" name="descripcion" maxLength={200} placeholder="Qué hace esta gente y por qué necesita este acceso" className="campo" />
        </div>
        <div className="sm:col-span-2">
          <ElegirNivel />
        </div>
      </div>
      <Mensaje estado={estado} />
      <div className="mt-5">
        <Enviar texto="Crear rol" pendiente="Creando…" icono />
      </div>
    </form>
  )
}

export function EditarRol({ rol }: { rol: RolResumen }) {
  // Vive en la columna lateral de la página del rol: todo en una columna.
  const [estado, enviar] = useActionState<EstadoRol, FormData>(actualizarRol, {})
  return (
    <form action={enviar} className="tarjeta p-5 sm:p-6">
      <input type="hidden" name="id" value={rol.id} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <div>
          <label htmlFor="editar-nombre" className="etiqueta">
            Nombre
          </label>
          <input id="editar-nombre" name="nombre" required minLength={2} maxLength={60} defaultValue={rol.nombre} className="campo" />
        </div>
        <div>
          <label htmlFor="editar-descripcion" className="etiqueta">
            Para quién es
          </label>
          <input id="editar-descripcion" name="descripcion" maxLength={200} defaultValue={rol.descripcion ?? ''} className="campo" />
        </div>
        <div className="sm:col-span-2 xl:col-span-1">
          <ElegirNivel valor={rol.nivel} bloqueado={rol.sistema} apilado />
          {/* El fieldset deshabilitado no manda el valor: se repite aquí. */}
          {rol.sistema && <input type="hidden" name="nivel" value={rol.nivel} />}
        </div>
      </div>
      <Mensaje estado={estado} />
      <div className="mt-5">
        <Enviar texto="Guardar datos del rol" pendiente="Guardando…" />
      </div>
    </form>
  )
}

export function EliminarRol({ rol, personas }: { rol: RolResumen; personas: number }) {
  const [estado, enviar] = useActionState<EstadoRol, FormData>(eliminarRol, {})
  if (rol.sistema) return null
  return (
    <form
      action={enviar}
      onSubmit={(ev) => {
        if (!confirm(`¿Borrar el rol «${rol.nombre}»? Esto no se puede deshacer.`)) ev.preventDefault()
      }}
    >
      <input type="hidden" name="id" value={rol.id} />
      <button
        type="submit"
        className="btn-peligro h-10"
        disabled={personas > 0}
        title={personas > 0 ? 'Tiene gente asignada: muévela a otro rol antes de borrarlo' : undefined}
      >
        <IconoBasura className="h-4 w-4" />
        Borrar rol
      </button>
      <Mensaje estado={estado} />
    </form>
  )
}
