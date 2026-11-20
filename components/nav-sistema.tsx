'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { IndicadorEnlace } from '@/components/indicador-enlace'
import { cn } from '@/lib/utils'
import {
  IconoAprobacion,
  IconoCasa,
  IconoCatalogo,
  IconoDocumento,
  IconoDotacion,
  IconoEscenario,
  IconoEscudo,
  IconoLista,
  IconoOrganigrama,
  IconoPanel,
  IconoProcesos,
  IconoUsuarios,
} from '@/components/iconos'

/**
 * La barra de la Plataforma Iberia (`/sistema`). Igual que la del panel: **cada
 * destino sale solo si el rol puede abrirlo**, y el layout calcula en el
 * servidor qué claves están permitidas con el mismo permiso que pide cada página.
 *
 * El programa de transformación (el panel de la Fase 1) es un dominio más de la
 * plataforma (D-04): se llega desde aquí, y la administración —usuarios, roles y
 * permisos— es una sola para todo.
 */

export type ClaveSistema =
  | 'inicio'
  | 'bandeja'
  | 'estructura'
  | 'dotacion'
  | 'requisiciones'
  | 'escenarios'
  | 'conciliacion'
  | 'procesos'
  | 'documentos'
  | 'programa'
  | 'usuarios'
  | 'roles'
  | 'catalogos'
  | 'aprobaciones'
  | 'auditoria'

type Item = {
  clave: ClaveSistema
  href: string
  etiqueta: string
  Icono: (p: { className?: string }) => React.ReactElement
}

const GRUPOS: { titulo: string; items: Item[] }[] = [
  {
    titulo: 'Plataforma',
    items: [
      { clave: 'inicio', href: '/sistema', etiqueta: 'Inicio', Icono: IconoCasa },
      { clave: 'bandeja', href: '/sistema/bandeja', etiqueta: 'Mis aprobaciones', Icono: IconoAprobacion },
    ],
  },
  {
    titulo: 'Organización',
    items: [
      { clave: 'estructura', href: '/sistema/nucleo/organizacion', etiqueta: 'Estructura', Icono: IconoOrganigrama },
      { clave: 'dotacion', href: '/sistema/nucleo/organizacion/dotacion', etiqueta: 'Dotación y costos', Icono: IconoDotacion },
      { clave: 'requisiciones', href: '/sistema/nucleo/organizacion/requisiciones', etiqueta: 'Requisiciones', Icono: IconoLista },
      { clave: 'escenarios', href: '/sistema/nucleo/escenarios', etiqueta: 'Escenarios', Icono: IconoEscenario },
      { clave: 'conciliacion', href: '/sistema/nucleo/conciliacion', etiqueta: 'Conciliación', Icono: IconoCatalogo },
    ],
  },
  {
    titulo: 'Procesos y documentos',
    items: [
      { clave: 'procesos', href: '/sistema/nucleo/procesos', etiqueta: 'Procesos', Icono: IconoProcesos },
      { clave: 'documentos', href: '/sistema/nucleo/documentos', etiqueta: 'Documentos', Icono: IconoDocumento },
    ],
  },
  {
    titulo: 'Programa',
    items: [{ clave: 'programa', href: '/dashboard', etiqueta: 'Programa de transformación', Icono: IconoPanel }],
  },
  {
    titulo: 'Administración',
    items: [
      { clave: 'usuarios', href: '/sistema/administracion/usuarios', etiqueta: 'Usuarios', Icono: IconoUsuarios },
      { clave: 'roles', href: '/sistema/administracion/roles', etiqueta: 'Roles y permisos', Icono: IconoEscudo },
      { clave: 'aprobaciones', href: '/sistema/administracion/aprobaciones', etiqueta: 'Rutas de aprobación', Icono: IconoAprobacion },
      { clave: 'catalogos', href: '/sistema/administracion/catalogos', etiqueta: 'Catálogos', Icono: IconoCatalogo },
      { clave: 'auditoria', href: '/sistema/administracion/auditoria', etiqueta: 'Auditoría', Icono: IconoLista },
    ],
  },
]

const ACTIVO = 'bg-acento-50 font-semibold text-acento-700'
const INACTIVO = 'text-marca-600 hover:bg-marca-50 hover:text-marca-900'
const ENLACE = 'flex min-h-10 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors'

/** Rutas que tienen hijas propias en la barra: la más larga que calce gana. */
const TODAS = GRUPOS.flatMap((g) => g.items.map((i) => i.href))

export function NavSistema({ permitidos }: { permitidos: ClaveSistema[] }) {
  const pathname = usePathname()
  const ve = new Set(permitidos)

  const masLarga = TODAS.filter((h) => pathname === h || pathname.startsWith(h + '/')).sort((a, b) => b.length - a.length)[0]
  const activo = (href: string) => href === masLarga

  return (
    <nav className="flex flex-col gap-1 p-3">
      {GRUPOS.map((g, i) => {
        const items = g.items.filter((it) => ve.has(it.clave))
        if (!items.length) return null
        return (
          <div key={g.titulo} className="flex flex-col gap-1">
            <p className={cn('px-3 pb-2 text-[10px] font-semibold tracking-[0.14em] text-marca-400 uppercase', i === 0 ? 'pt-2' : 'pt-5')}>
              {g.titulo}
            </p>
            {items.map(({ clave, href, etiqueta, Icono }) => (
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
            ))}
          </div>
        )
      })}
    </nav>
  )
}
