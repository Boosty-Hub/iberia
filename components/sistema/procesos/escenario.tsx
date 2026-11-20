'use client'

import { useActionState, useMemo, useState } from 'react'
import { Insignia } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  agregarNodo,
  crearEscenario,
  editarNodo,
  enviarEscenario,
  retirarNodo,
  type EstadoEscenario,
} from '@/app/sistema/nucleo/procesos/escenarios/acciones'
import { NIVELES, TONO_ESTADO_OPERATIVO, coincide } from './comun'
import { Enviar, Mensaje, type OpcionSimple } from './formularios'

/** Formulario para abrir un escenario copiando un subárbol vigente. */
export function CrearEscenario({ raices }: { raices: OpcionSimple[] }) {
  const [estado, accion] = useActionState<EstadoEscenario, FormData>(crearEscenario, {})
  return (
    <form action={accion} className="space-y-3">
      <div>
        <label className="etiqueta" htmlFor="esc-nombre">
          Nombre <span className="text-acento-600">*</span>
        </label>
        <input id="esc-nombre" name="nombre" required minLength={3} maxLength={120} placeholder="Reorganización de Compras 2027" className="campo" />
      </div>
      <div>
        <label className="etiqueta" htmlFor="esc-raiz">Qué parte del catálogo copia</label>
        <select id="esc-raiz" name="raiz" defaultValue="" className="campo">
          <option value="">Todo el catálogo</option>
          {raices.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.etiqueta}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-marca-500">Se copia el proceso elegido con todo lo que cuelga de él, como está vigente hoy.</p>
      </div>
      <div>
        <label className="etiqueta" htmlFor="esc-desc">Para qué es</label>
        <textarea id="esc-desc" name="descripcion" rows={2} className="campo" />
      </div>
      <Enviar texto="Crear escenario" pendiente="Copiando…" />
      <Mensaje estado={estado} />
    </form>
  )
}

export type NodoEscenario = {
  id: string
  ref: string
  padre_ref: string | null
  nivel: number
  nombre: string
  estado: string
  estado_operativo: string
  dueno_plaza_ref: string | null
  dueno: string | null
  cambio: 'alta' | 'baja' | 'cambio' | null
}

function PanelNodo({
  escenario,
  nodo,
  padres,
  plazas,
  estados,
}: {
  escenario: string
  nodo: NodoEscenario
  padres: OpcionSimple[]
  plazas: OpcionSimple[]
  estados: Record<string, string>
}) {
  const [eEdit, editar] = useActionState<EstadoEscenario, FormData>(editarNodo, {})
  const [eHijo, agregar] = useActionState<EstadoEscenario, FormData>(agregarNodo, {})
  if (nodo.estado === 'retirada') {
    return (
      <form action={retirarNodo} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="escenario" value={escenario} />
        <input type="hidden" name="ref" value={nodo.ref} />
        <input type="hidden" name="restaurar" value="si" />
        <p className="text-sm text-marca-600">Retirado en este escenario, con todo lo que cuelga de él.</p>
        <Enviar texto="Restaurar" pendiente="Restaurando…" clase="btn-neutro h-9 px-3 text-xs" />
      </form>
    )
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form action={editar} className="space-y-3">
        <input type="hidden" name="escenario" value={escenario} />
        <input type="hidden" name="id" value={nodo.id} />
        <p className="text-xs font-semibold tracking-wide text-marca-500 uppercase">Editar en el escenario</p>
        <label className="block text-xs text-marca-600">
          Nombre
          <input name="nombre" defaultValue={nodo.nombre} required minLength={3} className="campo mt-1" />
        </label>
        {nodo.nivel > 0 && (
          <label className="block text-xs text-marca-600">
            Cuelga de
            <select name="padre_ref" defaultValue={nodo.padre_ref ?? ''} className="campo mt-1">
              {padres.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-marca-600">
            Dueño (plaza)
            <select name="dueno_plaza_ref" defaultValue={nodo.dueno_plaza_ref ?? ''} className="campo mt-1">
              <option value="">Sin plaza</option>
              {nodo.dueno_plaza_ref && !plazas.some((p) => p.valor === nodo.dueno_plaza_ref) && <option value={nodo.dueno_plaza_ref}>La actual</option>}
              {plazas.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-marca-600">
            Estado operativo
            <select name="estado_operativo" defaultValue={nodo.estado_operativo} className="campo mt-1">
              {Object.entries(estados).map(([v, e]) => (
                <option key={v} value={v}>
                  {e}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Enviar texto="Guardar" pendiente="Guardando…" clase="btn-primario h-9 px-3 text-xs" />
        <Mensaje estado={eEdit} />
      </form>
      <div className="space-y-4">
        {nodo.nivel < 3 && (
          <form action={agregar} className="space-y-3">
            <input type="hidden" name="escenario" value={escenario} />
            <input type="hidden" name="padre_ref" value={nodo.ref} />
            <p className="text-xs font-semibold tracking-wide text-marca-500 uppercase">Agregar {(NIVELES[nodo.nivel + 1] ?? 'hijo').toLowerCase()}</p>
            <input name="nombre" required minLength={3} placeholder="Nombre" className="campo" aria-label="Nombre del nodo nuevo" />
            <Enviar texto="Agregar" pendiente="Agregando…" clase="btn-neutro h-9 px-3 text-xs" />
            <Mensaje estado={eHijo} />
          </form>
        )}
        <form
          action={retirarNodo}
          onSubmit={(e) => {
            if (!confirm('¿Retirarlo en el escenario, con todo lo que cuelga de él? Se puede restaurar mientras el escenario esté en edición.')) e.preventDefault()
          }}
        >
          <input type="hidden" name="escenario" value={escenario} />
          <input type="hidden" name="ref" value={nodo.ref} />
          <p className="mb-2 text-xs font-semibold tracking-wide text-marca-500 uppercase">Retirar</p>
          <button type="submit" className="btn-peligro h-9 px-3 text-xs">
            Retirar en el escenario
          </button>
        </form>
      </div>
    </div>
  )
}

const TONO_CAMBIO = { alta: 'verde', baja: 'rojo', cambio: 'ambar' } as const
const ETIQUETA_CAMBIO = { alta: 'Nuevo', baja: 'Retirado', cambio: 'Cambia' } as const

/** El árbol del escenario, editable mientras está en edición. */
export function ArbolEscenario({
  escenario,
  nodos,
  plazas,
  estados,
  editable,
}: {
  escenario: string
  nodos: NodoEscenario[]
  plazas: OpcionSimple[]
  estados: Record<string, string>
  editable: boolean
}) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState<string | null>(null)
  const [plegados, setPlegados] = useState<Set<string>>(() => new Set(nodos.filter((n) => n.nivel >= 1).map((n) => n.ref)))
  const [soloCambios, setSoloCambios] = useState(false)

  const refs = useMemo(() => new Set(nodos.map((n) => n.ref)), [nodos])
  const hijos = useMemo(() => {
    const m = new Map<string | null, NodoEscenario[]>()
    for (const n of nodos) {
      const p = n.padre_ref && refs.has(n.padre_ref) ? n.padre_ref : null
      ;(m.get(p) ?? m.set(p, []).get(p)!).push(n)
    }
    return m
  }, [nodos, refs])
  const porRef = useMemo(() => new Map(nodos.map((n) => [n.ref, n])), [nodos])

  const filtrando = Boolean(q || soloCambios)
  const visibles = useMemo(() => {
    if (!filtrando) return null
    const v = new Set<string>()
    for (const n of nodos) {
      if ((q && !coincide(n.nombre, q)) || (soloCambios && !n.cambio)) continue
      for (let r: string | null = n.ref, i = 0; r && i < 6; i++) {
        v.add(r)
        r = porRef.get(r)?.padre_ref ?? null
      }
    }
    return v
  }, [filtrando, nodos, q, soloCambios, porRef])

  const padresDe = (n: NodoEscenario) =>
    nodos.filter((x) => x.nivel === n.nivel - 1 && x.estado !== 'retirada').map((x) => ({ valor: x.ref, etiqueta: x.nombre }))

  const fila = (n: NodoEscenario): React.ReactNode => {
    if (visibles && !visibles.has(n.ref)) return null
    const sub = hijos.get(n.ref) ?? []
    const expandido = filtrando || !plegados.has(n.ref)
    return (
      <li key={n.ref}>
        <div className={cn('flex items-start gap-1.5 rounded-lg py-1.5 pr-2 hover:bg-marca-50', abierto === n.ref && 'bg-marca-50')} style={{ paddingLeft: `${n.nivel * 18 + 4}px` }}>
          {sub.length ? (
            <button
              type="button"
              onClick={() =>
                setPlegados((s) => {
                  const x = new Set(s)
                  if (x.has(n.ref)) x.delete(n.ref)
                  else x.add(n.ref)
                  return x
                })
              }
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-marca-500 hover:bg-marca-100"
              aria-label={expandido ? `Plegar ${n.nombre}` : `Desplegar ${n.nombre}`}
              aria-expanded={expandido}
            >
              <span className={cn('inline-block transition-transform', expandido && 'rotate-90')}>▸</span>
            </button>
          ) : (
            <span className="h-8 w-8 shrink-0" />
          )}
          <div className="min-w-0 flex-1 py-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={cn('text-sm', n.estado === 'retirada' ? 'text-marca-400 line-through' : 'text-marca-800', n.nivel === 0 && 'font-semibold')}>{n.nombre}</span>
              {n.cambio && <Insignia tono={TONO_CAMBIO[n.cambio]}>{ETIQUETA_CAMBIO[n.cambio]}</Insignia>}
              {n.estado_operativo !== 'vigente' && n.estado !== 'retirada' && (
                <Insignia tono={TONO_ESTADO_OPERATIVO[n.estado_operativo] ?? 'neutro'}>{estados[n.estado_operativo] ?? n.estado_operativo}</Insignia>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-marca-500">
              {NIVELES[n.nivel]} · {n.dueno ? `Dueño: ${n.dueno}` : 'Sin dueño'}
            </p>
          </div>
          {editable && (
            <button type="button" onClick={() => setAbierto(abierto === n.ref ? null : n.ref)} className="btn-neutro h-8 shrink-0 px-2.5 text-xs">
              {abierto === n.ref ? 'Cerrar' : n.estado === 'retirada' ? 'Restaurar' : 'Editar'}
            </button>
          )}
        </div>
        {editable && abierto === n.ref && (
          <div className="my-2 rounded-xl border border-[var(--borde)] bg-white p-4 shadow-[var(--sombra-tarjeta)]" style={{ marginLeft: `${Math.min(n.nivel * 18, 54) + 8}px` }}>
            <PanelNodo escenario={escenario} nodo={n} padres={padresDe(n)} plazas={plazas} estados={estados} />
          </div>
        )}
        {expandido && sub.length > 0 && <ul>{sub.map(fila)}</ul>}
      </li>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el escenario" className="campo max-w-sm" aria-label="Buscar en el escenario" />
        <label className="flex min-h-10 items-center gap-2 text-sm text-marca-700">
          <input type="checkbox" checked={soloCambios} onChange={(e) => setSoloCambios(e.target.checked)} className="h-4 w-4 accent-[var(--color-acento-600)]" />
          Solo lo que cambia
        </label>
      </div>
      <ul className="tarjeta p-2 sm:p-3">{(hijos.get(null) ?? []).map(fila)}</ul>
    </div>
  )
}

/** Enviar el escenario a aprobación con su fecha de entrada en vigor. */
export function EnviarEscenario({ escenario, hoy, cambios }: { escenario: string; hoy: string; cambios: number }) {
  const [estado, accion] = useActionState<EstadoEscenario, FormData>(enviarEscenario, {})
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="escenario" value={escenario} />
      <label className="block text-xs text-marca-600">
        Rige desde
        <input type="date" name="vigente_desde" min={hoy} defaultValue={hoy} required className="campo mt-1" />
      </label>
      <p className="text-xs text-marca-500">No se permite una fecha pasada. Con fecha futura, la realidad cambia ese día.</p>
      <button type="submit" className="btn-acento h-10" disabled={cambios === 0}>
        Enviar a aprobación
      </button>
      {cambios === 0 && <p className="text-xs text-marca-500">Todavía no cambia nada respecto de la realidad.</p>}
      <Mensaje estado={estado} />
    </form>
  )
}
