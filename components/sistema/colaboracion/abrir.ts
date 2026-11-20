import type { useRouter } from 'next/navigation'
import { TIPOS_FICHA } from '@/lib/plataforma/ficha-tipos'

/**
 * Abre un objeto en el panel lateral de la página donde se está
 * (`?ficha=tipo:id`), sin salir de ella. Se arma con `window.location` y no con
 * `useSearchParams`, para poder usarlo desde la barra (fuera de un Suspense).
 * Va con `history.pushState` —Next lo sincroniza con `useSearchParams`—: la
 * ficha la trae el panel, y la página no se vuelve a pintar en el servidor (R6).
 */
export function abrirFicha(_router: ReturnType<typeof useRouter>, tipo: string, id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('ficha', `${tipo}:${id}`)
  window.history.pushState(null, '', `${url.pathname}?${url.searchParams.toString()}`)
}

/** ¿Ese tipo de objeto tiene ficha? Un aviso de `nivel_ia` no la tiene: lleva a su pantalla (`enlace`). */
export function tieneFicha(tipo: string | null | undefined): tipo is string {
  return !!tipo && tipo in TIPOS_FICHA
}
