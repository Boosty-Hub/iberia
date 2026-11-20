import type { useRouter } from 'next/navigation'

/**
 * Abre un objeto en el panel lateral de la página donde se está
 * (`?ficha=tipo:id`), sin salir de ella. Se arma con `window.location` y no con
 * `useSearchParams`, para poder usarlo desde la barra (fuera de un Suspense).
 */
export function abrirFicha(router: ReturnType<typeof useRouter>, tipo: string, id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('ficha', `${tipo}:${id}`)
  router.push(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false })
}
