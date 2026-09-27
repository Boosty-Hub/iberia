/**
 * Lo que comparten la app y los scripts sobre los dibujos de Ajito (lección 4).
 *
 * Va aparte de `lib/dibujar.ts`, que es solo de servidor, para que
 * `generar:ejemplos` dibuje con el mismo modelo que la lección: se cambia aquí
 * y cambia en los dos sitios.
 */

/** Los ejercicios que devuelven un dibujo. */
export const DIBUJOS = new Set(['libre', 'escudo'])

/**
 * Si Ajito dibuja en este ejercicio: los dos de la lección 4 y, desde el 27 de
 * septiembre de 2026, también su pregunta de campo —«¿hay algo en tu trabajo
 * que sería más fácil de explicar con un dibujo?»—. Ahí el dibujo es un extra:
 * si no hay nada que dibujar, se contesta la pregunta sin él.
 */
export function dibujaEn(clave: string, forma: string | null | undefined): boolean {
  return DIBUJOS.has(clave) || (clave === 'campo' && forma === 'dibuja')
}

/**
 * Elegido por Gabriel el 27 de septiembre de 2026, entre cuatro medidos (ver
 * `contenido/adiestramiento/herramientas.md`): 12,5 s a calidad media. Sale
 * casi foto aunque se pida otra cosa y tiende a agregar banderas y letreros que
 * nadie pidió, así que las reglas se lo dicen en cada pedido.
 */
export const MODELO_DIBUJO = 'gpt-image-2.5-flare'

/**
 * Cuando sale Ajito. Sin esto, la regla de «sin letras» le quitaba el logo de la
 * pechera, que es parte del personaje.
 */
export const AJITO_IGUALITO =
  'El personaje de la imagen es Ajito: tiene que salir igualito, con el logo de Iberia en su pechera.'

/**
 * Cuando se nombra a Iberia. ⚠️ Sin esto el generador entiende la aerolínea: a
 * «una mayonesa voladora con el logo de Iberia» le pintó un avión con la cola y
 * el logo de la aerolínea española (27 de septiembre de 2026). Va con el logo
 * verdadero como imagen de referencia (`referencias/iberia.png`).
 */
export const IBERIA_DE_VERDAD =
  'Iberia es Industrias Iberia, la empresa venezolana de salsas, mayonesas y condimentos, no la ' +
  'aerolínea: nada de aviones, colas de avión ni colores o logos de aerolínea que no se pidan. ' +
  'Su logo es el de la imagen de referencia —la palabra IBERIA en rojo con una onda debajo—, y ' +
  'donde vaya un logo de Iberia, va ese, igualito.'

/** Lo que va en todo pedido de imagen, además de lo que se pidió. */
export const SIN_AGREGADOS =
  'No agregues banderas, escudos patrios ni símbolos políticos o religiosos que no se pidan.'
