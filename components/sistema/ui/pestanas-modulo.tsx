'use client'

import Link from 'next/link'
import { IndicadorEnlace } from '@/components/indicador-enlace'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { pestanaDeRuta, type Pestana } from '@/lib/plataforma/dominios'
import { numero } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/** Las pestañas de un módulo: enlaces de verdad (la URL manda), con la activa subrayada en rojo. */
export function PestanasModulo({ pestanas, cuentas }: { pestanas: Pestana[]; cuentas?: Record<string, number> }) {
  const { ruta, conContexto } = useContextoUrl()
  const activa = pestanaDeRuta(ruta, pestanas)
  return (
    <nav aria-label="Pestañas del módulo" className="-mb-px flex gap-0.5 overflow-x-auto">
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
  )
}
