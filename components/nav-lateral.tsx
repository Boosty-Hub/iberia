'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  IconoArchivos,
  IconoEntrevistas,
  IconoGrupo,
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
  { href: '/dashboard/adiestramiento', etiqueta: 'Adiestramiento', Icono: IconoGrupo },
  { href: '/dashboard/empleados', etiqueta: 'Empleados', Icono: IconoUsuarios },
  { href: '/dashboard/informe', etiqueta: 'Editor del informe', Icono: IconoInforme },
]

/**
 * Sobre fondo claro el destino activo se marca con rojo tenue y texto rojo, no
 * con un bloque sólido: en una barra blanca, una pastilla roja llena pesa como
 * un botón de acción y compite con los de la página.
 */
const ACTIVO = 'bg-acento-50 font-semibold text-acento-700'
const INACTIVO = 'text-marca-600 hover:bg-marca-50 hover:text-marca-900'

export function NavLateral({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname()

  const activo = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <nav className="flex flex-col gap-1 p-3">
      <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-marca-400 uppercase">
        Levantamiento
      </p>

      {PRINCIPALES.map(({ href, etiqueta, Icono }) => (
        <Link
          key={href}
          href={href}
          aria-current={activo(href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
            activo(href) ? ACTIVO : INACTIVO
          )}
        >
          <Icono className="h-[18px] w-[18px] shrink-0" />
          {etiqueta}
        </Link>
      ))}

      {esAdmin && (
        <>
          <p className="px-3 pt-5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-marca-400 uppercase">
            Administración
          </p>
          <Link
            href="/dashboard/usuarios"
            aria-current={activo('/dashboard/usuarios') ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
              activo('/dashboard/usuarios')
                ? 'bg-marca-100 font-semibold text-marca-900'
                : INACTIVO
            )}
          >
            <IconoUsuarios className="h-[18px] w-[18px] shrink-0" />
            Usuarios
          </Link>
        </>
      )}

      <div className="mt-5 border-t border-[var(--borde)] pt-3">
        <Link
          href="/informe"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-acento-700 transition-colors hover:bg-acento-50"
        >
          <IconoVerInforme className="h-[18px] w-[18px] shrink-0" />
          Ver el informe
        </Link>
      </div>
    </nav>
  )
}
