/**
 * Abrir el panel «Preguntar a la IA» desde cualquier parte (la cabecera del
 * módulo, la ficha, Ctrl K): un evento de ventana que oye `PanelPreguntaIa`.
 * Con `pregunta`, la deja escrita y la manda.
 *
 *   window.dispatchEvent(new CustomEvent('preguntar-ia', { detail: { pregunta: '…' } }))
 */
export const EVENTO_PREGUNTAR_IA = 'preguntar-ia'

export function abrirPreguntaIa(pregunta = '') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_PREGUNTAR_IA, { detail: { pregunta } }))
}
