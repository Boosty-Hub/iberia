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
