'use client'

import { useEffect, useSyncExternalStore } from 'react'

/**
 * La ficha a página completa (`/sistema/ficha/…`) no vive bajo la ruta de ningún módulo, y el riel se quedaba en
 * «Mi día». La página declara aquí la ruta del módulo de su objeto y la navegación la usa para marcar dominio y
 * módulo (24-nov-2026).
 */
let actual: string | null = null
const oyentes = new Set<() => void>()

function fijar(ruta: string | null) {
  actual = ruta
  for (const o of oyentes) o()
}

function suscribir(o: () => void) {
  oyentes.add(o)
  return () => {
    oyentes.delete(o)
  }
}

export function useRutaDeFicha(): string | null {
  return useSyncExternalStore(
    suscribir,
    () => actual,
    () => null,
  )
}

export function RutaDeFicha({ ruta }: { ruta: string | null }) {
  useEffect(() => {
    fijar(ruta)
    return () => fijar(null)
  }, [ruta])
  return null
}
