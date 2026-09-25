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

export function rutaDeSeccion(slug: string): string {
  return slug === 'mapa-procesos' ? RUTA_MAPA : `/informe/${slug}`
}
