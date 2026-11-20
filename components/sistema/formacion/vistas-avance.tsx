import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Las dos maneras de ver el avance: por área y oficio (cuentas, para quien tiene
 * la casilla de Adiestramiento) y por persona (nombres y lección por lección,
 * para quien trabaja el padrón). Son dos rutas: cada una pide su permiso.
 */
export function VistasAvance({ activa, porPersona }: { activa: 'grupos' | 'personas'; porPersona: boolean }) {
  const opciones = [
    { clave: 'grupos', etiqueta: 'Por área y oficio', href: '/sistema/nucleo/formacion/avance' },
    ...(porPersona ? [{ clave: 'personas', etiqueta: 'Por persona', href: '/sistema/nucleo/formacion/avance/personas' }] : []),
  ]
  if (opciones.length < 2) return null
  return (
    <nav aria-label="Cómo ver el avance" className="mb-2.5 inline-flex rounded-lg border border-[var(--borde)] bg-white p-0.5">
      {opciones.map((o) => (
        <Link
          key={o.clave}
          href={o.href}
          aria-current={activa === o.clave ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-8 items-center rounded-md px-3 text-xs focus-visible:outline-2 focus-visible:outline-acento-500',
            activa === o.clave ? 'bg-[#2b2a28] font-semibold text-white' : 'text-marca-600 hover:bg-marca-50'
          )}
        >
          {o.etiqueta}
        </Link>
      ))}
    </nav>
  )
}
