import Link from 'next/link'
import type { ReactNode } from 'react'
import { numero } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * Piezas de servidor de las pantallas R2 de Procesos y Documentos: el
 * selector de vista (segmentos), las barras apiladas de salud por grupo y las
 * listas de alertas. Sin JavaScript en el navegador.
 */

/** Dos o tres vistas de la misma pantalla (p. ej. «Vigentes | Todos»). Son enlaces: la URL manda. */
export function Segmentos({ opciones, activa, etiqueta }: { opciones: { valor: string; etiqueta: string; href: string; n?: number }[]; activa: string; etiqueta: string }) {
  return (
    <nav aria-label={etiqueta} className="mb-2.5 inline-flex rounded-lg border border-[var(--borde)] bg-white p-0.5 text-xs">
      {opciones.map((o) => (
        <Link
          key={o.valor}
          href={o.href}
          aria-current={o.valor === activa ? 'page' : undefined}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-md px-2.5 focus-visible:outline-2 focus-visible:outline-acento-500',
            o.valor === activa ? 'bg-[#2b2a28] font-semibold text-white' : 'text-marca-600 hover:bg-marca-50'
          )}
        >
          {o.etiqueta}
          {o.n !== undefined && <span className={cn('tabular-nums', o.valor === activa ? 'text-white/70' : 'text-marca-400')}>{numero(o.n)}</span>}
        </Link>
      ))}
    </nav>
  )
}

export type Tramo = { clave: string; etiqueta: string; simbolo: string; color: string }

/**
 * Barras apiladas horizontales, una por grupo, con la cifra de cada tramo
 * escrita al lado (nunca solo el color) y el detalle en `title`.
 */
export function BarrasApiladas({
  filas,
  tramos,
  titulo,
}: {
  filas: { clave: string; etiqueta: ReactNode; href?: string; valores: Record<string, number> }[]
  tramos: Tramo[]
  titulo: string
}) {
  const max = Math.max(1, ...filas.map((f) => tramos.reduce((s, t) => s + (f.valores[t.clave] ?? 0), 0)))
  return (
    <figure>
      <figcaption className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-marca-600">
        <span className="sr-only">{titulo}. </span>
        {tramos.map((t) => (
          <span key={t.clave} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} aria-hidden />
            <span aria-hidden>{t.simbolo}</span> {t.etiqueta}
          </span>
        ))}
      </figcaption>
      <ul className="flex flex-col gap-1.5">
        {filas.map((f) => {
          const total = tramos.reduce((s, t) => s + (f.valores[t.clave] ?? 0), 0)
          const detalle = tramos.map((t) => `${t.etiqueta}: ${numero(f.valores[t.clave] ?? 0)}`).join(' · ')
          const cuerpo = (
            <>
              <span className="w-full truncate text-[12.5px] text-marca-800 sm:w-56 sm:shrink-0">{f.etiqueta}</span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex h-3.5 min-w-0 flex-1 overflow-hidden rounded bg-[#f1f2f4]" role="img" aria-label={`${typeof f.etiqueta === 'string' ? f.etiqueta : ''}: ${detalle}`} title={detalle}>
                  {tramos.map((t) => {
                    const v = f.valores[t.clave] ?? 0
                    return v ? <span key={t.clave} style={{ width: `${(v / max) * 100}%`, background: t.color }} className="h-full border-r border-white last:border-r-0" /> : null
                  })}
                </span>
                <span className="w-28 shrink-0 text-right text-[11px] text-marca-500 tabular-nums">
                  {tramos.map((t) => `${t.simbolo}${numero(f.valores[t.clave] ?? 0)}`).join(' ')}
                </span>
                <span className="w-8 shrink-0 text-right text-[12px] font-semibold text-marca-800 tabular-nums">{numero(total)}</span>
              </span>
            </>
          )
          return (
            <li key={f.clave}>
              {f.href ? (
                <Link href={f.href} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-1 py-0.5 hover:bg-marca-50 sm:flex-nowrap">
                  {cuerpo}
                </Link>
              ) : (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 py-0.5 sm:flex-nowrap">{cuerpo}</div>
              )}
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

/** Una lista corta de alertas con su cuenta y el enlace a la tabla filtrada. */
export function ListaAlertas({
  titulo,
  icono,
  total,
  items,
  hrefTodos,
  vacio,
}: {
  titulo: string
  icono: string
  total: number
  items: { clave: string; titulo: string; detalle?: string | null; href: string }[]
  hrefTodos: string
  vacio: string
}) {
  return (
    <section className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
      <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-marca-800">
        <span aria-hidden>{icono}</span>
        {titulo}
        <span className="ml-auto rounded-lg bg-[#eef0f3] px-1.5 text-[11px] text-marca-600 tabular-nums">{numero(total)}</span>
      </h3>
      {items.length ? (
        <ul className="mt-2 divide-y divide-[#eef0f3]">
          {items.map((i) => (
            <li key={i.clave}>
              <Link href={i.href} scroll={false} className="block rounded px-1 py-1.5 hover:bg-marca-50">
                <span className="block truncate text-[12.5px] text-marca-900">{i.titulo}</span>
                {i.detalle && <span className="block truncate text-[11.5px] text-marca-500">{i.detalle}</span>}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[12px] text-marca-400">{vacio}</p>
      )}
      {total > items.length && (
        <Link href={hrefTodos} className="mt-1.5 inline-block text-[12px] font-semibold text-acento-700 hover:underline">
          Ver los {numero(total)} en la tabla →
        </Link>
      )}
    </section>
  )
}
