'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  IconoArchivos,
  IconoChat,
  IconoEntrevistas,
  IconoEscudo,
  IconoGrupo,
  IconoHallazgos,
  IconoInforme,
  IconoNuevaPestana,
  IconoPanel,
  IconoReloj,
  IconoUsuarios,
  IconoVerInforme,
} from '@/components/iconos'

/**
 * La barra del panel. **Cada destino sale solo si el rol puede abrirlo**: el
 * layout calcula en el servidor qué claves están permitidas y las pasa aquí.
 * Antes la barra le ofrecía al lector páginas que después lo devolvían al panel
 * con un aviso.
 */

export type ClaveNav =
  | 'panel'
  | 'entrevistas'
  | 'archivos'
  | 'hallazgos'
  | 'adiestramiento'
  | 'empleados'
  | 'informe'
  | 'programa'
  | 'usuarios'
  | 'roles'
  | 'curso'
  | 'ver-informe'

type Item = {
  clave: ClaveNav
  href: string
  etiqueta: string
  Icono: (p: { className?: string }) => React.ReactElement
}

const PRINCIPALES: Item[] = [
  { clave: 'panel', href: '/dashboard', etiqueta: 'Panel', Icono: IconoPanel },
  { clave: 'entrevistas', href: '/dashboard/entrevistas', etiqueta: 'Entrevistas', Icono: IconoEntrevistas },
  { clave: 'archivos', href: '/dashboard/archivos', etiqueta: 'Archivos', Icono: IconoArchivos },
  { clave: 'hallazgos', href: '/dashboard/hallazgos', etiqueta: 'Hallazgos', Icono: IconoHallazgos },
  { clave: 'adiestramiento', href: '/dashboard/adiestramiento', etiqueta: 'Adiestramiento', Icono: IconoGrupo },
  { clave: 'empleados', href: '/dashboard/empleados', etiqueta: 'Empleados', Icono: IconoUsuarios },
  { clave: 'informe', href: '/dashboard/informe', etiqueta: 'Editor del informe', Icono: IconoInforme },
  { clave: 'programa', href: '/dashboard/programa', etiqueta: 'El programa', Icono: IconoReloj },
]

const ADMINISTRACION: Item[] = [
  { clave: 'usuarios', href: '/dashboard/usuarios', etiqueta: 'Usuarios', Icono: IconoUsuarios },
  { clave: 'roles', href: '/dashboard/roles', etiqueta: 'Roles y permisos', Icono: IconoEscudo },
]

/**
 * Sobre fondo claro el destino activo se marca con rojo tenue y texto rojo, no
 * con un bloque sólido: en una barra blanca, una pastilla roja llena pesa como
 * un botón de acción y compite con los de la página.
 */
const ACTIVO = 'bg-acento-50 font-semibold text-acento-700'
const INACTIVO = 'text-marca-600 hover:bg-marca-50 hover:text-marca-900'
const ENLACE = 'flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors'

export function NavLateral({ permitidos }: { permitidos: ClaveNav[] }) {
  const pathname = usePathname()
  const ve = new Set(permitidos)

  const activo = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  const enlace = ({ clave, href, etiqueta, Icono }: Item) => (
    <Link
      key={clave}
      href={href}
      aria-current={activo(href) ? 'page' : undefined}
      className={cn(ENLACE, activo(href) ? ACTIVO : INACTIVO)}
    >
      <Icono className="h-[18px] w-[18px] shrink-0" />
      {etiqueta}
    </Link>
  )

  const principales = PRINCIPALES.filter((i) => ve.has(i.clave))
  const administracion = ADMINISTRACION.filter((i) => ve.has(i.clave))

  return (
    <nav className="flex flex-col gap-1 p-3">
      {principales.length > 0 && (
        <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-[0.14em] text-marca-400 uppercase">
          Levantamiento
        </p>
      )}
      {principales.map(enlace)}

      {(administracion.length > 0 || ve.has('curso')) && (
        <p className="px-3 pt-5 pb-2 text-[10px] font-semibold tracking-[0.14em] text-marca-400 uppercase">
          Administración
        </p>
      )}
      {administracion.map(enlace)}

      {/* El curso visto por dentro, tal como lo abre un operador en su
          teléfono: es la única forma de oír un audio después de regrabarlo.
          Abre en otra pestaña, igual que el informe: es otra aplicación, sin
          esta barra, y volver al panel no puede costar el sitio. */}
      {ve.has('curso') && (
        <Link href="/canal/adiestramiento" target="_blank" className={cn(ENLACE, INACTIVO)}>
          <IconoChat className="h-[18px] w-[18px] shrink-0" />
          El curso de Ajito
          <IconoNuevaPestana className="ml-auto h-3.5 w-3.5 shrink-0 text-marca-400" />
          <span className="sr-only">(abre en otra pestaña)</span>
        </Link>
      )}

      {ve.has('ver-informe') && (
        <div className="mt-5 border-t border-[var(--borde)] pt-3">
          <Link
            href="/informe"
            target="_blank"
            className={cn(ENLACE, 'text-acento-700 hover:bg-acento-50')}
          >
            <IconoVerInforme className="h-[18px] w-[18px] shrink-0" />
            Ver el informe
            <IconoNuevaPestana className="ml-auto h-3.5 w-3.5 shrink-0" />
            <span className="sr-only">(abre en otra pestaña)</span>
          </Link>
        </div>
      )}
    </nav>
  )
}
