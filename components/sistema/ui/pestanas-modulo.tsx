'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { IndicadorEnlace } from '@/components/indicador-enlace'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { pestanaDeRuta, type Pestana } from '@/lib/plataforma/dominios'
import { numero } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * Las pestañas de un módulo: enlaces de verdad (la URL manda), con la activa subrayada en rojo. Si no caben, se
 * deslizan: la activa se trae a la vista y un degradado con flecha avisa que hay más (24-nov-2026: en Organización y
 * autoridad, «Conciliación» e «Historial» quedaban cortadas sin que se notara).
 */
export function PestanasModulo({ pestanas, cuentas }: { pestanas: Pestana[]; cuentas?: Record<string, number> }) {
  const { ruta, conContexto } = useContextoUrl()
  const activa = pestanaDeRuta(ruta, pestanas)
  const barra = useRef<HTMLElement>(null)
  const [sobra, setSobra] = useState({ izq: false, der: false })
  useEffect(() => {
    const b = barra.current
    if (!b) return
    const medir = () => setSobra({ izq: b.scrollLeft > 4, der: b.scrollLeft + b.clientWidth < b.scrollWidth - 4 })
    b.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    medir()
    b.addEventListener('scroll', medir, { passive: true })
    const ro = new ResizeObserver(medir)
    ro.observe(b)
    return () => {
      b.removeEventListener('scroll', medir)
      ro.disconnect()
    }
  }, [activa?.href])
  const deslizar = (d: number) => barra.current?.scrollBy({ left: d * Math.max(160, (barra.current?.clientWidth ?? 400) * 0.6), behavior: 'smooth' })
  return (
    <div className="relative">
      {sobra.izq && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => deslizar(-1)} className="absolute inset-y-0 left-0 z-10 flex w-9 items-center justify-start bg-gradient-to-r from-white via-white/90 to-transparent pl-0.5 text-[15px] text-marca-500 hover:text-marca-900">
          ‹
        </button>
      )}
      {sobra.der && (
        <button type="button" tabIndex={-1} aria-hidden onClick={() => deslizar(1)} className="absolute inset-y-0 right-0 z-10 flex w-9 items-center justify-end bg-gradient-to-l from-white via-white/90 to-transparent pr-0.5 text-[15px] text-marca-500 hover:text-marca-900">
          ›
        </button>
      )}
    <nav ref={barra} aria-label="Pestañas del módulo" className="-mb-px flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
      {pestanas.map((p) => {
        const on = activa?.href === p.href
        const n = cuentas?.[p.href]
        return (
          <Link
            key={p.href}
            href={conContexto(p.href)}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-9 items-center gap-1 border-b-2 px-3 text-[13px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acento-500',
              on ? 'border-[#D4332C] font-semibold text-marca-900' : 'border-transparent text-marca-500 hover:text-marca-800'
            )}
          >
            {p.etiqueta}
            {n !== undefined && <span className="rounded-lg bg-[#eef0f3] px-1.5 text-[10px] text-marca-600">{numero(n)}</span>}
            <IndicadorEnlace />
          </Link>
        )
      })}
    </nav>
    </div>
  )
}
