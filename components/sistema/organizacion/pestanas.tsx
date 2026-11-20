import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Las pestañas de Organización. Cada una sale solo si la sesión tiene su permiso. */
export function PestanasOrganizacion({
  activa,
  permisos,
  conciliacion = 0,
}: {
  activa: 'organigrama' | 'plazas' | 'cargos' | 'dotacion' | 'requisiciones' | 'escenarios' | 'conciliacion'
  permisos: { dotacion: boolean; requisiciones: boolean; escenarios: boolean }
  conciliacion?: number
}) {
  const items = [
    { clave: 'organigrama', href: '/sistema/nucleo/organizacion', etiqueta: 'Organigrama', ver: true },
    { clave: 'plazas', href: '/sistema/nucleo/organizacion/plazas', etiqueta: 'Plazas', ver: true },
    { clave: 'cargos', href: '/sistema/nucleo/organizacion/cargos', etiqueta: 'Cargos', ver: true },
    { clave: 'dotacion', href: '/sistema/nucleo/organizacion/dotacion', etiqueta: 'Dotación', ver: permisos.dotacion },
    { clave: 'requisiciones', href: '/sistema/nucleo/organizacion/requisiciones', etiqueta: 'Requisiciones', ver: permisos.requisiciones },
    { clave: 'escenarios', href: '/sistema/nucleo/escenarios', etiqueta: 'Escenarios', ver: permisos.escenarios },
    { clave: 'conciliacion', href: '/sistema/nucleo/conciliacion', etiqueta: 'Conciliación', ver: true, n: conciliacion },
  ].filter((i) => i.ver)
  return (
    <nav className="-mx-1 mb-4 flex max-w-full gap-1 overflow-x-auto px-1 pb-1" aria-label="Secciones de organización">
      {items.map((i) => (
        <Link
          key={i.clave}
          href={i.href}
          aria-current={activa === i.clave ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm transition-colors',
            activa === i.clave ? 'bg-marca-800 font-semibold text-white' : 'border border-marca-200 bg-white text-marca-700 hover:bg-marca-50',
          )}
        >
          {i.etiqueta}
          {!!i.n && <span className="rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-800">{i.n}</span>}
        </Link>
      ))}
    </nav>
  )
}
