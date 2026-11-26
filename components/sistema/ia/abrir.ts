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

/**
 * El asistente en una ventana flotante (26-nov-2026, pedido de Gabriel): queda abierta mientras se navega por la
 * plataforma, y cada mensaje le dice al asistente en qué pantalla está la persona. La abre el botón «Abrir en
 * ventana» del asistente y el del panel lateral.
 */
export const EVENTO_VENTANA_IA = 'asistente-ventana'

export function abrirVentanaAsistente(chatId: string | null = null) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENTO_VENTANA_IA, { detail: { chatId } }))
}
