import Link from 'next/link'
import type { ReactNode } from 'react'
import { diaDe, fechaHora, hora as soloHora, hoyCaracas } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * `Kpi` y `SelloFuente` (Anexo E §2.5: «cada cifra dice de dónde sale»). La
 * cifra, su comparación, su tendencia y su sello —fuente · hora · estado—, y un
 * clic que lleva a la tabla que la origina. Componentes de servidor: el
 * minigráfico es SVG en línea, sin JavaScript en el navegador.
 */

export type EstadoFuente = 'al_dia' | 'atrasado' | 'sin_dato' | 'manual'

const ESTADO: Record<EstadoFuente, { simbolo: string; texto: string; clase: string }> = {
  al_dia: { simbolo: '✓', texto: 'al día', clase: 'text-[#1f6f4b]' },
  atrasado: { simbolo: '!', texto: 'atrasado', clase: 'text-[#8a5a12]' },
  sin_dato: { simbolo: '–', texto: 'sin dato', clase: 'text-marca-400' },
  manual: { simbolo: '✎', texto: 'carga manual', clase: 'text-[#2f5f9a]' },
}

export type Sello = {
  fuente: string
  /** Marca de tiempo (ISO) del dato. Si es de hoy se muestra solo la hora. */
  en?: string | null
  estado?: EstadoFuente
  detalle?: string
}

export function SelloFuente({ fuente, en, estado = 'al_dia', detalle, className }: Sello & { className?: string }) {
  const e = ESTADO[estado]
  const cuando = en ? (diaDe(en) === hoyCaracas() ? `hoy ${soloHora(en)}` : fechaHora(en)) : null
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 text-[10.5px] leading-snug text-marca-400', className)} title={detalle}>
      <span>Fuente: {fuente}</span>
      {cuando && <span>· {cuando}</span>}
      <span className={cn('inline-flex items-center gap-0.5 font-semibold', e.clase)}>
        · <span aria-hidden>{e.simbolo}</span> {e.texto}
      </span>
    </p>
  )
}

/** Minigráfico de una serie, SVG en línea. Una sola serie: la nombra el título de la tarjeta. */
export function Minigrafico({ valores, color = '#3567a8', etiqueta, escalones = false }: { valores: (number | null)[]; color?: string; etiqueta: string; escalones?: boolean }) {
  const v = valores.filter((x): x is number => x !== null && !Number.isNaN(x))
  if (v.length < 2) return <div className="mt-1.5 h-[34px]" aria-hidden />
  const w = 200
  const h = 34
  const max = Math.max(...v)
  const min = Math.min(...v)
  const y = (x: number) => h - 4 - ((x - min) / (max - min || 1)) * (h - 8)
  const pasos = v.length - 1
  let d = ''
  v.forEach((x, i) => {
    const px = (i / pasos) * w
    if (i === 0) d += `M${px.toFixed(1)},${y(x).toFixed(1)}`
    else if (escalones) d += `H${px.toFixed(1)}V${y(x).toFixed(1)}`
    else d += `L${px.toFixed(1)},${y(x).toFixed(1)}`
  })
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-1.5 h-[34px] w-full" role="img" aria-label={etiqueta}>
      <title>{etiqueta}</title>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function Kpi({
  titulo,
  valor,
  unidad,
  comparacion,
  serie,
  color,
  escalones,
  sello,
  href,
  icono,
  className,
}: {
  titulo: ReactNode
  valor: string
  unidad?: string
  comparacion?: { texto: string; sentido?: 'sube' | 'baja' | 'igual' } | null
  serie?: (number | null)[]
  color?: string
  escalones?: boolean
  sello: Sello
  /** A dónde lleva la cifra: la tabla o la página que la origina. */
  href?: string
  icono?: ReactNode
  className?: string
}) {
  const cuerpo = (
    <>
      <h3 className="flex items-center gap-1.5 text-[12px] font-semibold text-marca-500">
        {titulo}
        {icono}
      </h3>
      <p className="mt-1.5 text-[24px] leading-none font-bold text-marca-900 tabular-nums [overflow-wrap:anywhere]">
        {valor}
        {unidad && <span className="ml-1 text-[15px] font-semibold text-marca-700">{unidad}</span>}
      </p>
      {comparacion && <p className="mt-1.5 text-[12px] text-marca-500 tabular-nums">{comparacion.texto}</p>}
      {serie && <Minigrafico valores={serie} color={color} etiqueta={`Tendencia de ${typeof titulo === 'string' ? titulo : 'la cifra'}`} escalones={escalones} />}
      <SelloFuente {...sello} className="mt-2" />
    </>
  )
  const clase = cn('block rounded-xl border border-[var(--borde)] bg-white p-3.5', className)
  return href ? (
    <Link href={href} className={cn(clase, 'transition-shadow hover:shadow-[0_4px_14px_rgba(0,0,0,0.06)] focus-visible:outline-2 focus-visible:outline-acento-500')}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  )
}
