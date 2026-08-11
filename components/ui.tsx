import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { NIVEL_AREA, type TipoArea } from '@/lib/types'

/** Encabezado estándar de página: rótulo, título, descripción y acciones. */
export function EncabezadoPagina({
  rotulo,
  titulo,
  descripcion,
  acciones,
}: {
  rotulo?: string
  titulo: string
  descripcion?: ReactNode
  acciones?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {rotulo && <p className="rotulo mb-2">{rotulo}</p>}
        <h1 className="text-2xl font-bold tracking-tight text-marca-800">{titulo}</h1>
        {descripcion && (
          <p className="mt-1.5 max-w-2xl text-sm text-marca-600">{descripcion}</p>
        )}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

const TONOS = {
  neutro: 'bg-marca-100 text-marca-700',
  marca: 'bg-marca-50 text-marca-800',
  acento: 'bg-acento-50 text-acento-800',
  ambar: 'bg-amber-50 text-amber-800',
  rojo: 'bg-acento-50 text-acento-800',
  verde: 'bg-emerald-50 text-emerald-700',
} as const

export type Tono = keyof typeof TONOS

export function Insignia({
  children,
  tono = 'neutro',
  className,
}: {
  children: ReactNode
  tono?: Tono
  className?: string
}) {
  return <span className={cn('insignia', TONOS[tono], className)}>{children}</span>
}

/**
 * Opciones de un selector de áreas, sangradas según el nivel del organigrama
 * para que el desplegable se lea como la estructura real de Iberia.
 */
export function OpcionesArea({
  areas,
}: {
  areas: { id: string; nombre: string; tipo?: string | null }[]
}) {
  return (
    <>
      {areas.map((a) => {
        const nivel = NIVEL_AREA[(a.tipo ?? 'gerencia') as TipoArea] ?? 2
        // El espacio fino no colapsa dentro de <option>, a diferencia del normal.
        const sangria = ' '.repeat(nivel * 3)
        return (
          <option key={a.id} value={a.id}>
            {sangria}
            {a.nombre}
          </option>
        )
      })}
    </>
  )
}

/** Estado vacío con llamada a la acción opcional. */
export function EstadoVacio({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string
  descripcion?: string
  accion?: { href: string; etiqueta: string }
}) {
  return (
    <div className="tarjeta flex flex-col items-center px-6 py-14 text-center">
      <h2 className="text-base font-semibold text-marca-800">{titulo}</h2>
      {descripcion && (
        <p className="mt-1.5 max-w-md text-sm text-marca-600">{descripcion}</p>
      )}
      {accion && (
        <Link href={accion.href} className="btn-acento mt-5">
          {accion.etiqueta}
        </Link>
      )}
    </div>
  )
}

/** Métrica del panel. `sufijo` sirve para "de 25", "%", etc. */
export function Metrica({
  valor,
  etiqueta,
  sufijo,
  href,
}: {
  valor: number | string
  etiqueta: string
  sufijo?: string
  href?: string
}) {
  const contenido = (
    <>
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight text-marca-800">{valor}</span>
        {sufijo && <span className="text-sm text-marca-500">{sufijo}</span>}
      </p>
      <p className="mt-1 text-xs font-medium tracking-wide text-marca-500 uppercase">
        {etiqueta}
      </p>
    </>
  )

  if (href) {
    return (
      <Link href={href} className="tarjeta block p-5 transition-colors hover:bg-marca-50/40">
        {contenido}
      </Link>
    )
  }
  return <div className="tarjeta p-5">{contenido}</div>
}

/** Aviso en línea para permisos, resultados de acciones y advertencias. */
export function Aviso({
  tono = 'marca',
  children,
}: {
  tono?: 'marca' | 'ambar' | 'rojo' | 'verde'
  children: ReactNode
}) {
  const estilos = {
    marca: 'border-marca-200 bg-marca-50 text-marca-800',
    ambar: 'border-amber-200 bg-amber-50 text-amber-900',
    rojo: 'border-red-200 bg-red-50 text-red-800',
    verde: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tono]

  return (
    <div className={cn('mb-6 rounded-md border px-4 py-3 text-sm', estilos)} role="status">
      {children}
    </div>
  )
}
