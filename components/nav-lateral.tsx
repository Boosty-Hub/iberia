'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IndicadorEnlace } from '@/components/indicador-enlace'
import { cn } from '@/lib/utils'
import {
  IconoArchivos,
  IconoChat,
  IconoEntrevistas,
  IconoEscudo,
  IconoGrupo,
  IconoNuevaPestana,
  IconoPanel,
  IconoReloj,
  IconoUsuarios,
} from '@/components/iconos'

/**
 * La barra del panel. **Cada destino sale solo si el rol puede abrirlo**: el
 * layout calcula en el servidor qué claves están permitidas y las pasa aquí.
 *
 * Tres grupos desde el 25 de septiembre de 2026: el levantamiento, los cursos
 * —el panel del adiestramiento, el padrón de quien se matricula y el curso de
 * Ajito tal como lo abre un operador— y la administración. Salieron de la barra
 * «Hallazgos» y el «Editor del informe»: los hallazgos se leen en el informe, y
 * el informe se escribe en las sesiones de trabajo, no desde un editor. «Ver el
 * informe» se fue a la cabecera, que es donde se busca.
 */

export type ClaveNav =
  | 'panel'
  | 'entrevistas'
  | 'archivos'
  | 'programa'
  | 'adiestramiento'
  | 'empleados'
  | 'curso'
  | 'usuarios'
  | 'roles'
  | 'ver-informe'

type Item = {
  clave: ClaveNav
  href: string
  etiqueta: string
  Icono: (p: { className?: string }) => React.ReactElement
  /** Otra aplicación, sin esta barra: abre en otra pestaña. */
  externo?: boolean
}

const GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: 'Levantamiento',
    items: [
      { clave: 'panel', href: '/dashboard', etiqueta: 'Panel', Icono: IconoPanel },
      { clave: 'entrevistas', href: '/dashboard/entrevistas', etiqueta: 'Entrevistas', Icono: IconoEntrevistas },
      { clave: 'archivos', href: '/dashboard/archivos', etiqueta: 'Archivos', Icono: IconoArchivos },
      { clave: 'programa', href: '/dashboard/programa', etiqueta: 'Consumos', Icono: IconoReloj },
    ],
  },
  {
    titulo: 'Cursos',
    items: [
      { clave: 'adiestramiento', href: '/dashboard/adiestramiento', etiqueta: 'Adiestramiento', Icono: IconoGrupo },
      { clave: 'empleados', href: '/dashboard/empleados', etiqueta: 'Empleados · padrón', Icono: IconoUsuarios },
      // El curso visto por dentro, tal como lo abre un operador en su teléfono:
      // es la única forma de oír un audio después de regrabarlo.
      { clave: 'curso', href: '/canal/adiestramiento', etiqueta: 'El curso de Ajito', Icono: IconoChat, externo: true },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { clave: 'usuarios', href: '/dashboard/usuarios', etiqueta: 'Usuarios', Icono: IconoUsuarios },
      { clave: 'roles', href: '/dashboard/roles', etiqueta: 'Roles y permisos', Icono: IconoEscudo },
    ],
  },
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

  return (
    <nav className="flex flex-col gap-1 p-3">
      {GRUPOS.map((g, i) => {
        const items = g.items.filter((i) => ve.has(i.clave))
        if (!items.length) return null
        return (
          <div key={g.titulo} className="flex flex-col gap-1">
            <p className={cn('px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-marca-400 uppercase', i === 0 ? 'pt-2' : 'pt-5')}>
              {g.titulo}
            </p>
            {items.map(({ clave, href, etiqueta, Icono, externo }) =>
              externo ? (
                <Link key={clave} href={href} target="_blank" className={cn(ENLACE, INACTIVO)}>
                  <Icono className="h-[18px] w-[18px] shrink-0" />
                  {etiqueta}
                  <IconoNuevaPestana className="ml-auto h-3.5 w-3.5 shrink-0 text-marca-400" />
                  <span className="sr-only">(abre en otra pestaña)</span>
                </Link>
              ) : (
                <Link
                  key={clave}
                  href={href}
                  aria-current={activo(href) ? 'page' : undefined}
                  className={cn(ENLACE, activo(href) ? ACTIVO : INACTIVO)}
                >
                  <Icono className="h-[18px] w-[18px] shrink-0" />
                  {etiqueta}
                  <IndicadorEnlace />
                </Link>
              )
            )}
          </div>
        )
      })}
    </nav>
  )
}
