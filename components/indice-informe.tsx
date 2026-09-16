'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PARTES_INFORME, PARTES_INFORME_ORDEN, type ParteInforme } from '@/lib/types'
import { cn } from '@/lib/utils'

export type EntradaIndice = {
  slug: string
  numero: string | null
  titulo: string
  parte: string
  escrita: boolean
}

/**
 * El índice del informe, que es también su navegación: cada sección es una
 * página propia y esta lista es cómo se llega a ella.
 *
 * El destino activo se marca como en la barra del panel —rojo tenue y texto
 * rojo, no un bloque sólido—: en una columna blanca una pastilla llena pesa
 * como un botón de acción y compite con los de la página.
 */
export function IndiceInforme({ secciones }: { secciones: EntradaIndice[] }) {
  const ruta = usePathname()

  return (
    <nav aria-label="Índice del informe" className="px-3 py-4">
      <Link
        href="/informe"
        className={cn(
          'mb-2 block rounded-lg px-3 py-2 text-sm transition-colors',
          ruta === '/informe'
            ? 'bg-acento-50 font-semibold text-acento-700'
            : 'text-marca-600 hover:bg-[var(--fondo)] hover:text-acento-700'
        )}
      >
        Portada
      </Link>

      {PARTES_INFORME_ORDEN.map((parte) => {
        const delParte = secciones.filter((s) => s.parte === parte)
        if (delParte.length === 0) return null

        return (
          <div key={parte} className="mt-4">
            <p className="mb-1 px-3 text-[11px] font-semibold tracking-[0.12em] text-marca-400 uppercase">
              {PARTES_INFORME[parte as ParteInforme]}
            </p>
            <ol className="space-y-0.5">
              {delParte.map((s) => {
                const activa = ruta === `/informe/${s.slug}`
                return (
                  <li key={s.slug}>
                    <Link
                      href={`/informe/${s.slug}`}
                      aria-current={activa ? 'page' : undefined}
                      className={cn(
                        'flex gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
                        activa
                          ? 'bg-acento-50 font-semibold text-acento-700'
                          : 'hover:bg-[var(--fondo)] hover:text-acento-700'
                      )}
                    >
                      <span
                        className={cn(
                          'shrink-0 font-mono text-xs',
                          activa ? 'text-acento-600' : 'text-marca-400'
                        )}
                      >
                        {s.numero ?? '—'}
                      </span>
                      {/* Una sección sin escribir se distingue por tono, no por
                          un rótulo: son trece y trece «vacía» seguidos no dicen
                          nada. Solo las ve un editor. */}
                      <span
                        className={
                          activa ? '' : s.escrita ? 'text-marca-700' : 'text-marca-400'
                        }
                      >
                        {s.titulo}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        )
      })}
    </nav>
  )
}
