import type { FichaDe } from './tipos'

type Enrutador = { push: (href: string) => void }

/**
 * Abre la ficha de un objeto. El armazón de la plataforma pinta el panel del
 * objeto (`FichaObjeto`) cuando la dirección trae `ficha=<tipo>:<id>`, así que
 * se pone el parámetro sin recargar —Next sincroniza `useSearchParams` con
 * `history.pushState`— y se mira si apareció el panel (`[data-ficha-objeto]`).
 * Si el armazón todavía no lo tiene, se va a la página de detalle de siempre:
 * el botón nunca queda muerto.
 */
export function abrirFicha(enrutador: Enrutador, ficha: FichaDe) {
  const url = new URL(window.location.href)
  url.searchParams.set('ficha', `${ficha.tipo}:${ficha.id}`)
  window.history.pushState(null, '', url)
  let cuadros = 0
  const mirar = () => {
    if (document.querySelector('[data-ficha-objeto]')) return
    if (++cuadros < 24) {
      requestAnimationFrame(mirar)
      return
    }
    const limpia = new URL(window.location.href)
    limpia.searchParams.delete('ficha')
    window.history.replaceState(null, '', limpia)
    enrutador.push(ficha.href)
  }
  requestAnimationFrame(mirar)
}
