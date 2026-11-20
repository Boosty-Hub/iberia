'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

/**
 * El contexto global vive en la URL (`al`, `esc`): se comparte con un enlace y
 * sobrevive a recargar. Al navegar por el menú se arrastra, para no volver a la
 * realidad de hoy sin querer.
 */
export const PARAMS_GLOBALES = ['al', 'esc'] as const

/**
 * Parámetros que solo lee el navegador (el panel de la ficha): cambiarlos no
 * pide nada al servidor. Con `router.push` abrir una ficha volvía a pintar la
 * página entera en el servidor —y la acción que trae la ficha esperaba en cola
 * detrás—: 1,9 s de la fila al panel. Con `history.pushState`, que Next
 * sincroniza con `useSearchParams`, solo viaja la ficha (R6).
 */
const SOLO_NAVEGADOR = new Set(['ficha'])

export function useContextoUrl() {
  const sp = useSearchParams()
  const ruta = usePathname()
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()

  /** Un enlace del menú con el contexto actual. */
  const conContexto = useCallback(
    (href: string) => {
      if (!href.startsWith('/sistema')) return href
      const extra = new URLSearchParams()
      for (const p of PARAMS_GLOBALES) {
        const v = sp.get(p)
        if (v) extra.set(p, v)
      }
      const q = extra.toString()
      if (!q) return href
      return href + (href.includes('?') ? '&' : '?') + q
    },
    [sp]
  )

  /** Cambia (o quita, con null) parámetros de la página actual. */
  const fijar = useCallback(
    (cambios: Record<string, string | null>, modo: 'push' | 'replace' = 'push') => {
      const nuevo = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(cambios)) {
        if (v === null || v === '') nuevo.delete(k)
        else nuevo.set(k, v)
      }
      const q = nuevo.toString()
      const destino = q ? `${ruta}?${q}` : ruta
      if (Object.keys(cambios).every((k) => SOLO_NAVEGADOR.has(k))) {
        window.history[modo === 'push' ? 'pushState' : 'replaceState'](null, '', destino)
        return
      }
      iniciar(() => router[modo](destino, { scroll: false }))
    },
    [sp, ruta, router]
  )

  return { sp, ruta, router, conContexto, fijar, pendiente }
}
