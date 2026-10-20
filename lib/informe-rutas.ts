/**
 * A dónde lleva cada sección del informe.
 *
 * «El mapa de procesos» abre directo el mapa interactivo: su página de texto
 * decía lo mismo que las fichas de proceso, y era un clic de más antes del mapa
 * (decisión de Gabriel, 25 de septiembre de 2026). La sección sigue existiendo
 * en la base —conserva su número y su lugar en el índice— y su ruta de texto
 * redirige al mapa. Todo enlace a una sección pasa por aquí: el índice, la
 * portada y las flechas de anterior y siguiente.
 */
export const RUTA_MAPA = '/informe/mapa-interactivo'

/**
 * Las secciones que traen un dibujo interactivo: los dos circuitos (02 y 05), el
 * mapa de procesos (03), el proceso hoy y con la IA (09), el espejo (10) y el triángulo de la
 * plataforma (11). El
 * índice las marca con un icono para que se sepa dónde están los gráficos
 * (pedido de Gabriel, 11 de octubre de 2026). ⚠️ Una sección que estrene dibujo
 * se añade aquí el mismo día, o el índice no lo dice.
 */
export const CON_DIBUJO = new Set(['hallazgos', 'mapa-procesos', 'sistemas-datos', 'oportunidades', 'arquitectura-ia', 'plataforma'])

export function rutaDeSeccion(slug: string): string {
  return slug === 'mapa-procesos' ? RUTA_MAPA : `/informe/${slug}`
}
