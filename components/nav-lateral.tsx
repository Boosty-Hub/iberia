'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  IconoArchivos,
  IconoEntrevistas,
  IconoHallazgos,
  IconoInforme,
  IconoPanel,
  IconoUsuarios,
  IconoVerInforme,
} from '@/components/iconos'

type Item = {
  href: string
  etiqueta: string
  Icono: (p: { className?: string }) => React.ReactElement
}

const PRINCIPALES: Item[] = [
  { href: '/dashboard', etiqueta: 'Panel', Icono: IconoPanel },
  { href: '/dashboard/entrevistas', etiqueta: 'Entrevistas', Icono: IconoEntrevistas },
  { href: '/dashboard/archivos', etiqueta: 'Archivos', Icono: IconoArchivos },
  { href: '/dashboard/hallazgos', etiqueta: 'Hallazgos', Icono: IconoHallazgos },
  { href: '/dashboard/informe', etiqueta: 'Editor del informe', Icono: IconoInforme },
]

export function NavLateral({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname()

  const activo = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <nav className="flex flex-col gap-1 p-3">
      <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">
        Levantamiento
      </p>

      {PRINCIPALES.map(({ href, etiqueta, Icono }) => (
        <Link
          key={href}
          href={href}
          aria-current={activo(href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
            activo(href)
              ? 'bg-acento-600 font-medium text-white'
              : 'text-white/65 hover:bg-white/8 hover:text-white'
          )}
        >
          <Icono className="h-[18px] w-[18px] shrink-0" />
          {etiqueta}
        </Link>
      ))}

      {esAdmin && (
        <>
          <p className="px-3 pt-5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-white/35 uppercase">
            Administración
          </p>
          <Link
            href="/dashboard/usuarios"
            aria-current={activo('/dashboard/usuarios') ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              activo('/dashboard/usuarios')
                ? 'bg-white/12 font-medium text-white'
                : 'text-white/65 hover:bg-white/6 hover:text-white'
            )}
          >
            <IconoUsuarios className="h-[18px] w-[18px] shrink-0" />
            Usuarios
          </Link>
        </>
      )}

      <div className="mt-5 border-t border-white/10 pt-3">
        <Link
          href="/informe"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-acento-200 transition-colors hover:bg-white/6 hover:text-white"
        >
          <IconoVerInforme className="h-[18px] w-[18px] shrink-0" />
          Ver el informe
        </Link>
      </div>
    </nav>
  )
}
