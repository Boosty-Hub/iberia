/**
 * Abrir el asistente en el panel lateral desde cualquier parte (la cabecera del
 * módulo, la ficha, Ctrl K): un evento de ventana que oye `PanelAsistente`.
 * `pregunta` se manda sola; `contexto` dice desde dónde se pregunta (va con el
 * primer mensaje). Desde el 26-nov-2026 «Preguntar a la IA» ES el asistente.
 *
 *   window.dispatchEvent(new CustomEvent('preguntar-ia', { detail: { pregunta: '…', contexto: 'Procesos › Mapa' } }))
 */
export const EVENTO_PREGUNTAR_IA = 'preguntar-ia'

export function abrirPreguntaIa(pregunta = '', contexto = '') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_PREGUNTAR_IA, { detail: { pregunta, contexto } }))
}
