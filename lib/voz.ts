/**
 * La voz de Ajito.
 *
 * Todo lo que suena en el adiestramiento sale de aquí: los audios de las
 * lecciones, que se generan una vez, y las devoluciones de los ejercicios, que
 * se generan en el momento y distintas para cada persona. Si esto se toca, se
 * tocan las dos cosas a la vez — que es justamente el punto de tenerlo en un
 * solo sitio.
 *
 * Proveedor: Azure Speech. Es el único grande que declara los 22 locales del
 * español país por país y llega hasta Venezuela. El porqué y el costo están en
 * `contenido/adiestramiento/herramientas.md`.
 */

export type VozAjito = {
  /** Nombre corto de la voz en Azure. */
  nombre: string
  /** Cómo se describe en el panel. */
  etiqueta: string
  /**
   * Ajuste de velocidad sobre la base de la voz, en porcentaje.
   * Azure admite de 0,5× a 2×; pasado de +25% empieza a sonar atropellado.
   */
  velocidad: number
  /** Ajuste de tono. Azure admite de 0,5× a 1,5×. En 0 se queda como viene. */
  tono: number
  /** Silencio extra entre frases, en milisegundos. */
  pausaFrase: number
}

/**
 * Medido sobre el arranque de la lección 0 (88 palabras), el 16 de agosto:
 *
 *   Paola tal cual ......... 31,8 s → 166 ppm
 *   Paola +16% ............. 27,5 s → 192 ppm   ← elegida
 *   Paola +20% ............. 26,5 s → 199 ppm
 *   Sebastián tal cual ..... 26,4 s → 200 ppm
 *
 * O sea que **Sebastián corre un 20% más rápido que Paola de fábrica** — eso es
 * lo que se oye al ponerlos uno detrás del otro, y por eso Paola parecía lenta.
 *
 * Se quedó en +16% y no en +20% a propósito. A 199 la voz queda al nivel de un
 * pódcast de oficina, y quien va a oír esto es alguien entendiendo por primera
 * vez qué es la IA, en el comedor y con ruido. 192 es ágil sin ir de carrera.
 *
 * Y ojo con lo que el porcentaje NO arregla: `rate` cambia la velocidad, no la
 * cadencia. `es-VE` se quedó en la generación estándar, sin las variantes HD
 * que Microsoft solo le dio a España y México, y esa prosodia más plana no se
 * corrige acelerando. Si algún día molesta el ritmo y no el tempo, la salida es
 * cambiar de voz, no subir el número.
 */
export const PAOLA: VozAjito = {
  nombre: 'es-VE-PaolaNeural',
  etiqueta: 'Paola · venezolana',
  velocidad: 16,
  tono: 0,
  pausaFrase: 180,
}

/** La otra venezolana. Trae mejor paso de fábrica. */
export const SEBASTIAN: VozAjito = {
  nombre: 'es-VE-SebastianNeural',
  etiqueta: 'Sebastián · venezolano',
  velocidad: 0,
  tono: 0,
  pausaFrase: 180,
}

/** La que se usa. Se cambia aquí y cambia en todo el curso. */
export const VOZ = PAOLA

/**
 * Envuelve un texto del guion en SSML.
 *
 * El texto entra en crudo, tal como está escrito en
 * `contenido/adiestramiento/`: los saltos de línea del guion marcan las pausas
 * de respiración y aquí se convierten en párrafos, que es como Azure las
 * entiende. No hay que escribir SSML a mano en el guion.
 */
export function aSSML(texto: string, voz: VozAjito = VOZ): string {
  const parrafos = texto
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapar(p)}</p>`)
    .join('\n      ')

  const prosodia: string[] = []
  if (voz.velocidad !== 0) prosodia.push(`rate="${signo(voz.velocidad)}%"`)
  if (voz.tono !== 0) prosodia.push(`pitch="${signo(voz.tono)}%"`)

  const abre = prosodia.length ? `<prosody ${prosodia.join(' ')}>` : ''
  const cierra = prosodia.length ? '</prosody>' : ''

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="es-VE">
  <voice name="${voz.nombre}">
    <mstts:silence type="Sentenceboundary" value="${voz.pausaFrase}ms"/>
    ${abre}
      ${parrafos}
    ${cierra}
  </voice>
</speak>`
}

/** `&`, `<` y `>` rompen el SSML si van en crudo. */
function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function signo(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}
