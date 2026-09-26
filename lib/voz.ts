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
  /**
   * Silencio al final de cada frase, en milisegundos. **Es el valor exacto que se
   * oye, no un extra**: va como `Sentenceboundary-exact`. En 0 no se le dice nada
   * a Azure, y entonces pone lo suyo — que en `es-VE` son unos 900 ms y suena a
   * frases sueltas. Medido: 180 ms deja 12 pausas en el Audio 1 de la lección 0 y
   * ninguna llega a 400 ms.
   */
  pausaFrase: number
}

/**
 * **192 palabras por minuto** es el objetivo, y está elegido: a 199 la voz queda
 * al nivel de un pódcast de oficina, y quien va a oír esto es alguien
 * entendiendo por primera vez qué es la IA, en el comedor y con ruido. 192 es
 * ágil sin ir de carrera.
 *
 * ⚠️ **El porcentaje que da esas 192 cambió el 31 de agosto, de +16% a +12%, y no
 * porque cambiara el objetivo.** La medición de agosto se hizo cronometrando el
 * texto, no el audio, y el audio real llevaba adentro dos cosas que lo frenaban:
 * los saltos de columna del guion, que Azure tomaba como pausa, y 180 ms
 * *sumados* a cada punto. Medido sobre el audio de verdad —RMS en marcos de
 * 10 ms sobre el WAV, no cronómetro— el mismo +16% daba **174 ppm**. Arregladas
 * las dos cosas en `aSSML()`, la escala quedó así, sobre las 86 palabras del
 * Audio 1 de la lección 0:
 *
 *   +16% ... 26,0 s → 198 ppm   · 12 pausas, ninguna de 400 ms o más
 *   +12% ... 26,9 s → 192 ppm   ← elegida, es el objetivo de siempre
 *   +8% .... 27,8 s → 185 ppm   · aparece una pausa de 400 ms
 *
 * Y de referencia: Paola tal cual son 166 ppm y Sebastián tal cual, 200 — o sea
 * que **Sebastián corre un 20% más rápido que Paola de fábrica**, que es lo que
 * se oye al ponerlos uno detrás del otro y por lo que Paola parecía lenta.
 *
 * Ojo con lo que el porcentaje NO arregla: `rate` cambia la velocidad, no la
 * cadencia. `es-VE` se quedó en la generación estándar, sin las variantes HD
 * que Microsoft solo le dio a España y México, y esa prosodia más plana no se
 * corrige acelerando. Si algún día molesta el ritmo y no el tempo, la salida es
 * cambiar de voz, no subir el número.
 */
export const PAOLA: VozAjito = {
  nombre: 'es-VE-PaolaNeural',
  etiqueta: 'Paola · venezolana',
  velocidad: 12,
  tono: 0,
  pausaFrase: 180,
}

/**
 * El venezolano. De fábrica corre más que Paola, así que va **a −7%** para decir la
 * clase a las **mismas 192** palabras por minuto que ella. Medido el 26 de
 * septiembre con `npm run medir:ritmo`, sobre el WAV del Audio 1 de la lección 0
 * —86 palabras—, con Paola a +12% de testigo dando sus 192 de agosto:
 *
 *   Paola +12% ... 26,9 s → 192 ppm   · el testigo
 *   −8% .......... 27,2 s → 190 ppm
 *   −7% .......... 26,9 s → 191 ppm   ← elegida: dura lo mismo que Paola, con las
 *                                        puntas y sin ellas (25,9 s)
 *   −6% .......... 26,7 s → 194 ppm
 *   +0% .......... 25,2 s → 205 ppm
 *
 * Ninguna escala mete pausas de 400 ms: la cadencia de las dos queda igual.
 */
export const SEBASTIAN: VozAjito = {
  nombre: 'es-VE-SebastianNeural',
  etiqueta: 'Sebastián · venezolano',
  velocidad: -7,
  tono: 0,
  pausaFrase: 180,
}

/**
 * **Las dos voces de Ajito, a elegir** (26 de septiembre de 2026, decisión de
 * Gabriel). Quien hace el curso escoge en el índice con cuál lo oye, y la
 * elección vale para todo: la clase grabada y las devoluciones que se generan en
 * el momento —si no, habría dos Ajitos—. El guion no cambia: ya está escrito sin
 * género, para Ajito y para quien lo oye.
 *
 * `carpeta` es dónde viven sus audios, en el disco y en el bucket. La voz de
 * mujer conserva las rutas de siempre —los 70 audios que ya estaban— y la de
 * hombre va en `hombre/`.
 */
export type ClaveVoz = 'mujer' | 'hombre'

/** `corto` va en el botón: con el ✓ al lado, «Voz de hombre» no cabía en un teléfono. */
export const VOCES: Record<ClaveVoz, VozAjito & { rotulo: string; corto: string; carpeta: string }> = {
  mujer: { ...PAOLA, rotulo: 'Voz de mujer', corto: 'Mujer', carpeta: '' },
  hombre: { ...SEBASTIAN, rotulo: 'Voz de hombre', corto: 'Hombre', carpeta: 'hombre' },
}

export const CLAVES_VOZ = Object.keys(VOCES) as ClaveVoz[]

/** La de quien todavía no ha elegido. */
export const VOZ_POR_DEFECTO: ClaveVoz = 'mujer'

export function esClaveVoz(valor: unknown): valor is ClaveVoz {
  return typeof valor === 'string' && valor in VOCES
}

/** La voz de una clave cualquiera; lo que no sea una clave conocida, la de siempre. */
export function vozDe(clave: unknown) {
  return VOCES[esClaveVoz(clave) ? clave : VOZ_POR_DEFECTO]
}

/** La que se usa cuando no se dice cuál. */
export const VOZ = VOCES[VOZ_POR_DEFECTO]

/**
 * Junta las líneas de un párrafo en una sola.
 *
 * ⚠️ **Esto era la causa de que los audios sonaran cortados.** El guion está
 * escrito en markdown con las citas ajustadas a 78 columnas, así que una frase
 * cualquiera viene partida a la mitad:
 *
 *     Fíjate bien cómo me hicieron: la cabeza es un ajo y el cuerpo es un ají. Me
 *     parece bien, porque de eso vive esta casa.
 *
 * `lib/guion.ts` conserva esos saltos —hace bien, son el texto tal cual— y Azure
 * los toma como frontera de prosodia: metía una pausa entre «Me» y «parece
 * bien». Un salto de línea de ajuste de columna no es una pausa; la pausa la
 * marca el renglón en blanco, que abre `<p>`.
 */
function unaSolaLinea(parrafo: string): string {
  return parrafo.replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

/**
 * Envuelve un texto del guion en SSML.
 *
 * El texto entra en crudo, tal como está escrito en
 * `contenido/adiestramiento/`: **el renglón en blanco** marca la pausa de
 * respiración y aquí se convierte en párrafo, que es como Azure la entiende. Los
 * saltos sueltos de dentro de un párrafo son ajuste de columna del markdown y se
 * deshacen. No hay que escribir SSML a mano en el guion.
 */
export function aSSML(texto: string, voz: VozAjito = VOZ): string {
  const parrafos = texto
    .split(/\n\s*\n/)
    .map(unaSolaLinea)
    .filter(Boolean)
    .map((p) => `<p>${escapar(p)}</p>`)
    .join('\n      ')

  const prosodia: string[] = []
  if (voz.velocidad !== 0) prosodia.push(`rate="${signo(voz.velocidad)}%"`)
  if (voz.tono !== 0) prosodia.push(`pitch="${signo(voz.tono)}%"`)

  const abre = prosodia.length ? `<prosody ${prosodia.join(' ')}>` : ''
  const cierra = prosodia.length ? '</prosody>' : ''

  // `Sentenceboundary-exact` fija el silencio; `Sentenceboundary` a secas se
  // **suma** al que Azure ya pone. Con las frases cortas que Ajito habla por
  // diseño, esos 180 ms sumados a cada punto convertían el audio en una lista de
  // frases sueltas. Con `-exact` la cifra es la que se oye.
  const silencio = voz.pausaFrase
    ? `<mstts:silence type="Sentenceboundary-exact" value="${voz.pausaFrase}ms"/>\n    `
    : ''

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="es-VE">
  <voice name="${voz.nombre}">
    ${silencio}${abre}
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
