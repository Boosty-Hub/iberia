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

/** Lo que va en todo pedido de imagen, además de lo que se pidió. */
export const SIN_AGREGADOS =
  'No agregues banderas, escudos patrios ni símbolos políticos o religiosos que no se pidan.'
