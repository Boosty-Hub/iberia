'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Insignia } from '@/components/ui'
import { IconoBuscar } from '@/components/iconos'
import { cn } from '@/lib/utils'
import { ESTADOS_VERSION, NIVELES, TONO_ESTADO_OPERATIVO, TONO_VERSION, coincide } from './comun'
import { CrearHijo, MoverNodo, type OpcionSimple } from './formularios'

/**
 * El árbol completo del catálogo (niveles 0 a 3), con búsqueda sin tildes y
 * filtros. Una coincidencia muestra también su camino hasta la raíz, para que
 * se lea dónde está. Crear un hijo y mover un nodo van por borrador.
 */

export type NodoArbol = {
  ref: string
  padre_ref: string | null
  nivel: number
  nombre: string
  tipo: string | null
  estado_operativo: string
  codigo_sgc: string | null
  codigo_informe: string | null
  con_ficha: boolean
  dueno: string | null
  dueno_casado: boolean
  abierto: string | null
  nuevo: boolean
  docs: number
}

type Filtros = { q: string; tipo: string; estado: string; ficha: string; dueno: string; version: string }

export function ArbolProcesos({
  nodos,
  tipos,
  estados,
  plazas,
  inicial,
  puedeCrear,
  puedeEditar,
}: {
  nodos: NodoArbol[]
  tipos: Record<string, string>
  estados: Record<string, string>
  plazas: OpcionSimple[]
  inicial: Partial<Filtros>
  puedeCrear: boolean
  puedeEditar: boolean
}) {
  const [f, setF] = useState<Filtros>(() => ({
    q: '',
    tipo: '',
    estado: '',
    ficha: '',
    dueno: '',
    version: '',
    ...Object.fromEntries(Object.entries(inicial).filter(([, v]) => v)),
  }))
  // Arranca plegado: los veinte macroprocesos se leen de un vistazo, también en el teléfono.
  const [abiertos, setAbiertos] = useState<Set<string>>(() => new Set())
  const [panel, setPanel] = useState<{ ref: string; tipo: 'hijo' | 'mover' } | null>(null)

  const hijos = useMemo(() => {
    const m = new Map<string | null, NodoArbol[]>()
    for (const n of nodos) (m.get(n.padre_ref) ?? m.set(n.padre_ref, []).get(n.padre_ref)!).push(n)
    return m
  }, [nodos])
  const porRef = useMemo(() => new Map(nodos.map((n) => [n.ref, n])), [nodos])

  const filtrando = Boolean(f.q || f.tipo || f.estado || f.ficha || f.dueno || f.version)
  const cumple = (n: NodoArbol) =>
    (!f.q || coincide(`${n.nombre} ${n.codigo_sgc ?? ''} ${n.codigo_informe ?? ''} ${n.dueno ?? ''}`, f.q)) &&
    (!f.tipo || n.tipo === f.tipo) &&
    (!f.estado || n.estado_operativo === f.estado) &&
    (!f.ficha || (f.ficha === 'con') === n.con_ficha) &&
    (!f.dueno || (f.dueno === 'con' ? n.dueno_casado : !n.dueno_casado)) &&
    (!f.version || (f.version === 'abiertos' ? Boolean(n.abierto) : !n.abierto))

  const { visibles, aciertos } = useMemo(() => {
    if (!filtrando) return { visibles: null as Set<string> | null, aciertos: nodos.length }
    const v = new Set<string>()
    let a = 0
    for (const n of nodos) {
      if (!cumple(n)) continue
      a++
      for (let r: string | null = n.ref, i = 0; r && i < 6; i++) {
        v.add(r)
        r = porRef.get(r)?.padre_ref ?? null
      }
    }
    return { visibles: v, aciertos: a }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, nodos, porRef])

  const alternar = (ref: string) =>
    setAbiertos((s) => {
      const x = new Set(s)
      if (x.has(ref)) x.delete(ref)
      else x.add(ref)
      return x
    })

  const opcionesEstado = Object.entries(estados).map(([valor, etiqueta]) => ({ valor, etiqueta }))

  const fila = (n: NodoArbol): React.ReactNode => {
    if (visibles && !visibles.has(n.ref)) return null
    const sub = hijos.get(n.ref) ?? []
    const expandido = filtrando || abiertos.has(n.ref)
    const resalta = filtrando && cumple(n)
    const candidatos = nodos
      .filter((x) => x.nivel === n.nivel - 1 && !x.nuevo)
      .map((x) => ({ valor: x.ref, etiqueta: `${x.codigo_sgc ?? x.codigo_informe ?? ''} ${x.nombre}`.trim() }))
    return (
      <li key={n.ref}>
        <div
          className={cn('group flex items-start gap-1.5 rounded-lg py-1.5 pr-2 hover:bg-marca-50', resalta && f.q && 'bg-amber-50/70')}
          style={{ paddingLeft: `${n.nivel * 18 + 4}px` }}
        >
          {sub.length ? (
            <button
              type="button"
              onClick={() => alternar(n.ref)}
              disabled={filtrando}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-marca-500 hover:bg-marca-100 disabled:opacity-40"
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
              <Link href={`/sistema/nucleo/procesos/${n.ref}`} className={cn('text-sm hover:text-acento-700 hover:underline', n.nivel === 0 ? 'font-semibold text-marca-900' : 'text-marca-800')}>
                {n.nombre}
              </Link>
              {n.estado_operativo !== 'vigente' && <Insignia tono={TONO_ESTADO_OPERATIVO[n.estado_operativo] ?? 'neutro'}>{estados[n.estado_operativo] ?? n.estado_operativo}</Insignia>}
              {n.abierto && <Insignia tono={TONO_VERSION[n.abierto] ?? 'ambar'}>{n.nuevo ? 'Nuevo · ' : ''}{ESTADOS_VERSION[n.abierto] ?? n.abierto}</Insignia>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11px] text-marca-500">
              <span>{NIVELES[n.nivel]}</span>
              {n.codigo_sgc && <span className="font-mono">{n.codigo_sgc}</span>}
              {n.codigo_informe && <span className="font-mono">Inf. {n.codigo_informe}</span>}
              {n.tipo && n.nivel === 0 && <span>{tipos[n.tipo] ?? n.tipo}</span>}
              <span className={n.dueno_casado ? '' : 'text-amber-800'}>{n.dueno ? `Dueño: ${n.dueno}` : 'Sin dueño'}</span>
              {n.con_ficha && <span className="text-emerald-700">Con ficha</span>}
              {n.docs > 0 && <span>{n.docs} doc.</span>}
            </div>
          </div>
          {!n.nuevo && (puedeCrear || puedeEditar) && (
            <div className="flex shrink-0 gap-1 pt-0.5">
              {puedeCrear && n.nivel < 3 && (
                <button
                  type="button"
                  onClick={() => setPanel(panel?.ref === n.ref && panel.tipo === 'hijo' ? null : { ref: n.ref, tipo: 'hijo' })}
                  className="btn-neutro h-8 px-2.5 text-xs"
                  aria-label={`Agregar un hijo a ${n.nombre}`}
                >
                  + Hijo
                </button>
              )}
              {puedeEditar && n.nivel > 0 && !n.abierto && (
                <button
                  type="button"
                  onClick={() => setPanel(panel?.ref === n.ref && panel.tipo === 'mover' ? null : { ref: n.ref, tipo: 'mover' })}
                  className="btn-neutro h-8 px-2.5 text-xs"
                  aria-label={`Mover ${n.nombre}`}
                >
                  Mover
                </button>
              )}
            </div>
          )}
        </div>
        {panel?.ref === n.ref && (
          <div className="my-2 rounded-xl border border-[var(--borde)] bg-white p-4 shadow-[var(--sombra-tarjeta)]" style={{ marginLeft: `${n.nivel * 18 + 40}px` }}>
            {panel.tipo === 'hijo' ? (
              <CrearHijo padre={{ ref: n.ref, nombre: n.nombre, nivel: n.nivel }} plazas={plazas} estados={opcionesEstado} />
            ) : (
              <MoverNodo nodo={{ ref: n.ref, padre_ref: n.padre_ref }} candidatos={candidatos} />
            )}
          </div>
        )}
        {expandido && sub.length > 0 && <ul>{sub.map(fila)}</ul>}
      </li>
    )
  }

  const selector = (k: keyof Filtros, etiqueta: string, opciones: [string, string][]) => (
    <label className="min-w-0 text-xs text-marca-600">
      {etiqueta}
      <select value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} className="campo mt-1">
        <option value="">Todos</option>
        {opciones.map(([v, e]) => (
          <option key={v} value={v}>
            {e}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="space-y-4">
      <div className="tarjeta p-4">
        <div className="relative">
          <IconoBuscar className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-marca-400" />
          <input
            type="search"
            value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value })}
            placeholder="Buscar por nombre, código o dueño (sin importar tildes)"
            className="campo pl-10"
            aria-label="Buscar procesos"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          {selector('tipo', 'Tipo', Object.entries(tipos))}
          {selector('estado', 'Estado operativo', Object.entries(estados))}
          {selector('ficha', 'Ficha PHVA', [['con', 'Con ficha'], ['sin', 'Sin ficha']])}
          {selector('dueno', 'Dueño', [['con', 'Con plaza dueña'], ['sin', 'Sin plaza dueña']])}
          {selector('version', 'Versión', [['abiertos', 'Con borrador o revisión'], ['vigentes', 'Solo vigente']])}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-marca-500">
          <span>
            {filtrando ? `${aciertos} de ${nodos.length} nodos coinciden` : `${nodos.length} nodos`}
          </span>
          {filtrando ? (
            <button type="button" className="text-acento-700 hover:underline" onClick={() => setF({ q: '', tipo: '', estado: '', ficha: '', dueno: '', version: '' })}>
              Limpiar filtros
            </button>
          ) : (
            <>
              <button type="button" className="text-acento-700 hover:underline" onClick={() => setAbiertos(new Set(nodos.map((n) => n.ref)))}>
                Desplegar todo
              </button>
              <button type="button" className="text-acento-700 hover:underline" onClick={() => setAbiertos(new Set())}>
                Plegar todo
              </button>
            </>
          )}
        </div>
      </div>

      <div className="tarjeta p-2 sm:p-3">
        {filtrando && aciertos === 0 ? (
          <p className="p-4 text-sm text-marca-500">Nada coincide con esa búsqueda.</p>
        ) : (
          <ul>{(hijos.get(null) ?? []).map(fila)}</ul>
        )}
      </div>
    </div>
  )
}
