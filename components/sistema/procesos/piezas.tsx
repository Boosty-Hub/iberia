import Link from 'next/link'
import type { ReactNode } from 'react'
import { Insignia } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ESTADOS_VERSION, TONO_ESTADO_OPERATIVO, TONO_VERSION } from './comun'

/** Piezas de servidor que repiten las pantallas de procesos. */

export function InsigniaEstadoOperativo({
  estado,
  etiquetas,
  siempre,
}: {
  estado: string
  etiquetas: Record<string, string>
  /** «Se ejecuta» es lo normal: por defecto no se pinta. */
  siempre?: boolean
}) {
  if (estado === 'vigente' && !siempre) return null
  return <Insignia tono={TONO_ESTADO_OPERATIVO[estado] ?? 'neutro'}>{etiquetas[estado] ?? estado}</Insignia>
}

export function InsigniaVersion({ estado, version }: { estado: string; version?: number }) {
  return (
    <Insignia tono={TONO_VERSION[estado] ?? 'neutro'}>
      {version != null && `v${version} · `}
      {ESTADOS_VERSION[estado] ?? estado}
    </Insignia>
  )
}

export function Codigos({ sgc, informe, className }: { sgc: string | null; informe: string | null; className?: string }) {
  if (!sgc && !informe) return null
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-marca-500', className)}>
      {sgc && <span title="Código del SGC">{sgc}</span>}
      {informe && <span title="Código del informe de Fase 1">Inf. {informe}</span>}
    </span>
  )
}

/** Los enlaces de la sección, arriba de cada pantalla de procesos. */
export function PestanasProcesos({
  activa,
  extra,
  escenarios = true,
}: {
  activa: 'mapa' | 'arbol' | 'cruce' | 'escenarios'
  extra?: ReactNode
  /** La pestaña de escenarios sale solo con `sistema:escenarios`: sin él, la página devuelve. */
  escenarios?: boolean
}) {
  const items = [
    { clave: 'mapa', href: '/sistema/nucleo/procesos', etiqueta: 'Mapa' },
    { clave: 'arbol', href: '/sistema/nucleo/procesos/arbol', etiqueta: 'Árbol' },
    { clave: 'cruce', href: '/sistema/nucleo/procesos/cruce', etiqueta: 'Cruce SGC ↔ informe' },
    { clave: 'escenarios', href: '/sistema/nucleo/procesos/escenarios', etiqueta: 'Escenarios' },
  ].filter((i) => escenarios || i.clave !== 'escenarios')
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <nav className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1 pb-1" aria-label="Secciones de procesos">
        {items.map((i) => (
          <Link
            key={i.clave}
            href={i.href}
            aria-current={activa === i.clave ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center rounded-xl px-3.5 text-sm transition-colors',
              activa === i.clave ? 'bg-marca-800 font-semibold text-white' : 'border border-marca-200 bg-white text-marca-700 hover:bg-marca-50',
            )}
          >
            {i.etiqueta}
          </Link>
        ))}
      </nav>
      {extra && <div className="ml-auto flex flex-wrap gap-2">{extra}</div>}
    </div>
  )
}

export function Seccion({ titulo, children, acciones, className }: { titulo: string; children: ReactNode; acciones?: ReactNode; className?: string }) {
  return (
    <section className={cn('tarjeta p-5', className)}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-marca-900">{titulo}</h2>
        {acciones}
      </div>
      {children}
    </section>
  )
}

export function ListaSimple({ items, vacio = 'Sin datos en la ficha.' }: { items: string[]; vacio?: string }) {
  if (!items.length) return <p className="text-sm text-marca-400">{vacio}</p>
  return (
    <ul className="space-y-1.5 text-sm text-marca-700">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-marca-400" />
          <span className="min-w-0">{x}</span>
        </li>
      ))}
    </ul>
  )
}
