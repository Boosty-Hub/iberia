'use client'

import { createContext, startTransition, useActionState, useContext, useState, useTransition, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { IconoAlerta, IconoBuscar, IconoCheck } from '@/components/iconos'
import { cn } from '@/lib/utils'

/** Lo que devuelve cada acción de Organización: un error, un aviso o el visto bueno. */
export type Estado = { error?: string; aviso?: string; ok?: string }
type Accion = (anterior: Estado, fd: FormData) => Promise<Estado>

/** El «enviando…» del formulario: se envía a mano (sin el reinicio de React), así que `useFormStatus` no lo ve. */
const Pendiente = createContext<boolean | null>(null)

export function Mensaje({ estado }: { estado: Estado }) {
  if (estado.error) {
    // El cupo lleno se explica distinto: no es un error de carga, es una decisión.
    const cupo = /por encima de la dotación/.test(estado.error)
    return (
      <p
        role="alert"
        className={cn(
          'mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
          cupo ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-acento-200 bg-acento-50 text-acento-800',
        )}
      >
        <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{estado.error}</span>
      </p>
    )
  }
  if (estado.ok || estado.aviso)
    return (
      <div className="mt-3 space-y-2">
        {estado.ok && (
          <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
            {estado.ok}
          </p>
        )}
        {estado.aviso && (
          <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
            {estado.aviso}
          </p>
        )}
      </div>
    )
  return null
}

export function Enviar({
  texto,
  pendiente = 'Guardando…',
  tono = 'acento',
  nombre,
  valor,
  className,
}: {
  texto: string
  pendiente?: string
  tono?: 'acento' | 'primario' | 'neutro' | 'peligro'
  nombre?: string
  valor?: string
  className?: string
}) {
  const estado = useFormStatus()
  const propio = useContext(Pendiente)
  const pending = propio ?? estado.pending
  return (
    <button type="submit" name={nombre} value={valor} className={cn(`btn-${tono} h-10`, className)} disabled={pending}>
      {pending ? pendiente : texto}
    </button>
  )
}

/**
 * Un formulario que llama a una acción de servidor y muestra lo que respondió
 * la base. Los campos llegan como hijos (se pintan en el servidor); los botones,
 * en `botones`, o uno solo con `boton`.
 */
export function Formulario({
  accion,
  children,
  boton,
  pendiente,
  tono,
  botones,
  className,
}: {
  accion: Accion
  children: ReactNode
  boton?: string
  pendiente?: string
  tono?: 'acento' | 'primario' | 'neutro' | 'peligro'
  botones?: ReactNode
  className?: string
}) {
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(accion, {})
  // Se envía a mano: con `action={…}` React 19 vacía el formulario después de cada
  // envío, y tras un rechazo (la plaza llena, la fecha pasada) se perdía lo escrito.
  return (
    <Pendiente.Provider value={enviando}>
      <form
        className={cn('min-w-0', className)}
        onSubmit={(e) => {
          e.preventDefault()
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
          const fd = new FormData(e.currentTarget, submitter)
          startTransition(() => enviar(fd))
        }}
      >
        {children}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {botones ?? (boton && <Enviar texto={boton} pendiente={pendiente} tono={tono} />)}
        </div>
        <Mensaje estado={estado} />
      </form>
    </Pendiente.Provider>
  )
}

/** Un bloque plegable para las acciones de edición: la ficha se lee primero, se edita a demanda. */
export function Plegable({
  titulo,
  children,
  peligro,
  abierto,
  className,
}: {
  titulo: ReactNode
  children: ReactNode
  peligro?: boolean
  abierto?: boolean
  className?: string
}) {
  return (
    <details open={abierto} className={cn('group rounded-xl border bg-white', peligro ? 'border-acento-200' : 'border-marca-200', className)}>
      <summary
        className={cn(
          'flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold select-none [&::-webkit-details-marker]:hidden',
          peligro ? 'text-acento-700' : 'text-marca-800',
        )}
      >
        <span aria-hidden className="text-marca-400 transition-transform group-open:rotate-90">
          ›
        </span>
        {titulo}
      </summary>
      <div className="border-t border-marca-100 px-3 pt-3 pb-4">{children}</div>
    </details>
  )
}

export type PersonaEncontrada = { id: string; nombre: string; ficha: string | null; cargo: string | null; plaza: string | null }

/**
 * Buscar a una persona del padrón por nombre o ficha y elegirla. El resultado
 * entra al formulario que la contiene como `empleado_id`.
 */
export function BuscarPersona({ buscar, id = 'buscar-persona' }: { buscar: (q: string) => Promise<PersonaEncontrada[]>; id?: string }) {
  const [q, setQ] = useState('')
  const [lista, setLista] = useState<PersonaEncontrada[] | null>(null)
  const [elegida, setElegida] = useState<string>('')
  const [cargando, iniciar] = useTransition()

  const ejecutar = () => {
    if (q.trim().length < 2) return
    iniciar(async () => {
      setLista(await buscar(q.trim()))
      setElegida('')
    })
  }

  return (
    <div className="min-w-0">
      <label className="etiqueta" htmlFor={id}>
        Persona <span className="text-acento-600">*</span>
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          className="campo"
          placeholder="Nombre o número de ficha"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ejecutar()
            }
          }}
        />
        <button type="button" className="btn-neutro h-10 shrink-0 px-3" onClick={ejecutar} disabled={cargando} aria-label="Buscar">
          <IconoBuscar className="h-4 w-4" />
          <span className="hidden sm:inline">{cargando ? 'Buscando…' : 'Buscar'}</span>
        </button>
      </div>
      <input type="hidden" name="empleado_id" value={elegida} />
      {lista && (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-marca-200 p-1.5">
          {lista.length === 0 && <li className="px-2 py-2 text-sm text-marca-500">Nadie coincide en el padrón activo.</li>}
          {lista.map((p) => (
            <li key={p.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-marca-50',
                  elegida === p.id && 'bg-acento-50',
                )}
              >
                <input
                  type="radio"
                  name={`${id}-visible`}
                  className="mt-1 accent-[var(--color-acento-600)]"
                  checked={elegida === p.id}
                  onChange={() => setElegida(p.id)}
                />
                <span className="min-w-0">
                  <span className="block font-medium text-marca-900">
                    {p.nombre}
                    {p.ficha && <span className="ml-1.5 text-xs font-normal text-marca-500">ficha {p.ficha}</span>}
                  </span>
                  <span className="block text-xs text-marca-500">
                    {p.plaza ? `Hoy: ${p.plaza}` : p.cargo ? `Padrón: ${p.cargo} · sin plaza` : 'Sin plaza'}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
