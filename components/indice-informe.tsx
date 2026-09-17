'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { PARTES_INFORME, PARTES_INFORME_ORDEN, type ParteInforme } from '@/lib/types'
import { cn } from '@/lib/utils'

export type FichaIndice = { titulo: string; ancla: string }
export type NivelIndice = { titulo: string; fichas: FichaIndice[] }

export type EntradaIndice = {
  slug: string
  numero: string | null
  titulo: string
  parte: string
  escrita: boolean
  /** Solo las secciones plegables lo traen. Ver `subindice()` en el layout. */
  sub?: NivelIndice[]
}

/**
 * El índice del informe, que es también su navegación: cada sección es una
 * página propia y esta lista es cómo se llega a ella.
 *
 * El destino activo se marca como en la barra del panel —rojo tenue y texto
 * rojo, no un bloque sólido—: en una columna blanca una pastilla llena pesa
 * como un botón de acción y compite con los de la página.
 */
/** El chevron que despliega el subíndice. Gira, no cambia de icono. */
function Chevron({
  abierto,
  etiqueta,
  alPulsar,
}: {
  abierto: boolean
  etiqueta: string
  alPulsar: () => void
}) {
  return (
    <button
      type="button"
      onClick={alPulsar}
      aria-expanded={abierto}
      aria-label={`${abierto ? 'Plegar' : 'Desplegar'} el contenido de ${etiqueta}`}
      className="flex w-7 shrink-0 items-center justify-center rounded-lg text-marca-400 transition-colors hover:bg-[var(--fondo)] hover:text-acento-700"
    >
      <span
        className={cn(
          'h-1.5 w-1.5 border-r-2 border-b-2 border-current transition-transform duration-150',
          abierto ? '-rotate-45' : 'rotate-45'
        )}
      />
    </button>
  )
}

/**
 * Los niveles de una sección plegable y sus fichas.
 *
 * ⚠️ Cada ficha enlaza a `/informe/<slug>#<ancla>`. El ancla la calcula el
 * layout con el mismo `github-slugger` que usa `rehype-slug` al renderizar, y
 * la página **abre sola el bloque plegado que contiene ese id** — si no, el
 * enlace llevaría a la página y a ningún sitio dentro de ella.
 */
/**
 * Quita el prefijo «Nivel N · » del título de una ficha, para dejar solo el
 * nombre del macroproceso.
 *
 * ⚠️ **`\p{L}` y no `\w`.** `\w` es ASCII: con «Estratégico 1 · …» dejaba de
 * casar en la «é» y el prefijo se quedaba puesto, mientras «Operativo» y
 * «Soporte» —sin acentos— sí se limpiaban. El resultado era un índice donde
 * un nivel se numeraba y los otros dos no.
 */
function soloNombre(titulo: string) {
  return titulo.replace(/^\p{L}+\s+\d+\s*·\s*/u, '')
}

function SubIndice({ slug, niveles }: { slug: string; niveles: NivelIndice[] }) {
  return (
    <ul className="mt-1 mb-1 ml-6 space-y-2 border-l border-[var(--borde)] pl-3">
      {niveles.map((n, iNivel) => (
        <li key={n.titulo}>
          {/* La numeración es del índice, no del contenido: el documento no
              numera los niveles, pero en una columna estrecha «1.» y «2.1.»
              son lo que deja ver la jerarquía de un vistazo. */}
          <p className="flex gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-marca-500 uppercase">
            <span className="font-mono text-marca-400">{iNivel + 1}.</span>
            {soloNombre(n.titulo)}
          </p>
          <ul className="mt-0.5 space-y-px">
            {n.fichas.map((f, iFicha) => (
              <li key={f.ancla}>
                <Link
                  href={`/informe/${slug}#${f.ancla}`}
                  className="flex gap-1.5 rounded px-1 py-0.5 text-xs text-marca-500 transition-colors hover:bg-[var(--fondo)] hover:text-acento-700"
                  title={f.titulo}
                >
                  <span className="shrink-0 font-mono text-marca-400">
                    {iNivel + 1}.{iFicha + 1}.
                  </span>
                  <span className="truncate">{soloNombre(f.titulo)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

export function IndiceInforme({ secciones }: { secciones: EntradaIndice[] }) {
  const ruta = usePathname()
  // Solo se recuerda qué está desplegado, no se persiste: el índice no se
  // remonta al cambiar de sección porque vive en el layout.
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set())

  const alternar = (slug: string) =>
    setAbiertas((previas) => {
      const siguiente = new Set(previas)
      if (!siguiente.delete(slug)) siguiente.add(slug)
      return siguiente
    })

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
                    <div className="flex items-stretch">
                      <Link
                        href={`/informe/${s.slug}`}
                        aria-current={activa ? 'page' : undefined}
                        className={cn(
                          'flex min-w-0 flex-1 gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors',
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

                      {/* ⚠️ El chevron es un botón aparte, **fuera del enlace**.
                          Anidado dentro, desplegar obligaría a navegar, que es
                          justo lo contrario de lo que sirve: ver qué hay dentro
                          sin salir de donde uno está. */}
                      {s.sub && s.sub.length > 0 && (
                        <Chevron
                          abierto={abiertas.has(s.slug)}
                          etiqueta={s.titulo}
                          alPulsar={() => alternar(s.slug)}
                        />
                      )}
                    </div>

                    {s.sub && abiertas.has(s.slug) && (
                      <SubIndice slug={s.slug} niveles={s.sub} />
                    )}
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
