'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  IconoCasa,
  IconoChat,
  IconoGrupo,
  IconoPersona,
  IconoUsuarios,
} from '@/components/iconos'
import { cn } from '@/lib/utils'

type Item = {
  href: string
  etiqueta: string
  Icono: (p: { className?: string }) => React.ReactElement
}

const ITEMS: Item[] = [
  { href: '/canal', etiqueta: 'Inicio', Icono: IconoCasa },
  { href: '/canal/grupos', etiqueta: 'Grupos', Icono: IconoGrupo },
  { href: '/canal/mensajes', etiqueta: 'Mensajes', Icono: IconoChat },
  { href: '/canal/gente', etiqueta: 'Gente', Icono: IconoUsuarios },
  { href: '/canal/yo', etiqueta: 'Yo', Icono: IconoPersona },
]

/**
 * Navegación fija al pie. En el teléfono el pulgar llega abajo, no arriba: por
 * eso la navegación principal vive aquí y no en una barra superior.
 */
export function NavInferior({ mensajesSinLeer = 0 }: { mensajesSinLeer?: number }) {
  const pathname = usePathname()

  const activo = (href: string) =>
    href === '/canal' ? pathname === href : pathname.startsWith(href)

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-marca-200/70 bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ href, etiqueta, Icono }) => {
          const esActivo = activo(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={esActivo ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                  esActivo ? 'text-acento-600' : 'text-marca-500 active:text-marca-800'
                )}
              >
                <span className="relative">
                  <Icono className="h-6 w-6" />
                  {href === '/canal/mensajes' && mensajesSinLeer > 0 && (
                    <span className="absolute -top-1 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-acento-600 px-1 text-[10px] font-bold text-white">
                      {mensajesSinLeer > 9 ? '9+' : mensajesSinLeer}
                    </span>
                  )}
                </span>
                {etiqueta}
                {esActivo && (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-acento-600" />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
