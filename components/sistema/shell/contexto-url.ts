'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useTransition } from 'react'

/**
 * El contexto global vive en la URL (`al`, `esc`): se comparte con un enlace y
 * sobrevive a recargar. Al navegar por el menú se arrastra, para no volver a la
 * realidad de hoy sin querer.
 */
export const PARAMS_GLOBALES = ['al', 'esc'] as const

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
      iniciar(() => router[modo](q ? `${ruta}?${q}` : ruta, { scroll: false }))
    },
    [sp, ruta, router]
  )

  return { sp, ruta, router, conContexto, fijar, pendiente }
}
