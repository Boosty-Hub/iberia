'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { IconoAlerta, IconoCheck, IconoMas } from '@/components/iconos'
import { crearHijo, moverNodo, type EstadoAccion } from '@/app/sistema/nucleo/procesos/acciones'
import { NIVELES } from './comun'

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
export function CrearHijo({
  padre,
  plazas,
  estados,
}: {
  padre: { ref: string; nombre: string; nivel: number }
  plazas: OpcionSimple[]
  estados: OpcionSimple[]
}) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(crearHijo, {})
  const nivelHijo = NIVELES[padre.nivel + 1] ?? 'Proceso'
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="padre_ref" value={padre.ref} />
      <p className="text-xs text-marca-500">
        {nivelHijo} nuevo dentro de «{padre.nombre}». Nace como borrador (versión 1) y no aparece en el mapa hasta que se apruebe.
      </p>
      <div>
        <label className="etiqueta" htmlFor={`hijo-nombre-${padre.ref}`}>
          Nombre <span className="text-acento-600">*</span>
        </label>
        <input id={`hijo-nombre-${padre.ref}`} name="nombre" required minLength={3} maxLength={160} className="campo" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiqueta" htmlFor={`hijo-estado-${padre.ref}`}>Estado operativo</label>
          <select id={`hijo-estado-${padre.ref}`} name="estado_operativo" defaultValue="propuesto" className="campo">
            {estados.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiqueta" htmlFor={`hijo-sgc-${padre.ref}`}>Código SGC (si tiene)</label>
          <input id={`hijo-sgc-${padre.ref}`} name="codigo_sgc" placeholder="II-XX" className="campo" />
        </div>
      </div>
      {plazas.length > 0 && (
        <div>
          <label className="etiqueta" htmlFor={`hijo-dueno-${padre.ref}`}>Dueño (plaza)</label>
          <select id={`hijo-dueno-${padre.ref}`} name="dueno_plaza_ref" defaultValue="" className="campo">
            <option value="">El mismo del proceso padre</option>
            {plazas.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="flex min-h-10 items-center gap-2 text-sm text-marca-700">
        <input type="checkbox" name="enviar" value="si" defaultChecked className="h-4 w-4 accent-[var(--color-acento-600)]" />
        Enviarlo a aprobación de una vez (si no, queda en borrador para completar su ficha)
      </label>
      <Enviar texto={`Crear ${nivelHijo.toLowerCase()}`} pendiente="Creando…" icono={<IconoMas className="h-4 w-4" />} />
      <Mensaje estado={estado} />
    </form>
  )
}

/** Mover un nodo a otro padre del nivel de arriba, por borrador. */
export function MoverNodo({ nodo, candidatos }: { nodo: { ref: string; padre_ref: string | null }; candidatos: OpcionSimple[] }) {
  const [estado, accion] = useActionState<EstadoAccion, FormData>(moverNodo, {})
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="ref" value={nodo.ref} />
      <p className="text-xs text-marca-500">
        Mover abre un borrador con el padre nuevo: la versión vigente no cambia hasta que se apruebe. Sus hijos se mueven con él.
      </p>
      <div>
        <label className="etiqueta" htmlFor={`mover-${nodo.ref}`}>Pasa a colgar de</label>
        <select id={`mover-${nodo.ref}`} name="padre_ref" required defaultValue="" className="campo">
          <option value="" disabled>
            Elige el proceso
          </option>
          {candidatos.map((c) => (
            <option key={c.valor} value={c.valor} disabled={c.valor === nodo.padre_ref}>
              {c.etiqueta}
              {c.valor === nodo.padre_ref ? ' (el actual)' : ''}
            </option>
          ))}
        </select>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm text-marca-700">
        <input type="checkbox" name="enviar" value="si" className="h-4 w-4 accent-[var(--color-acento-600)]" />
        Enviarlo a aprobación de una vez
      </label>
      <Enviar texto="Mover en borrador" pendiente="Moviendo…" clase="btn-primario h-10" />
      <Mensaje estado={estado} />
    </form>
  )
}
