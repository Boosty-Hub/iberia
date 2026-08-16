import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { FAMILIAS_OFICIO, type FamiliaOficio } from '@/lib/adiestramiento'

/**
 * Ajito contestando.
 *
 * Hasta aquí Ajito era un guion grabado: decía lo mismo a las doscientas
 * personas. Esto es la otra mitad del curso — lo que pasa cuando alguien manda
 * algo y del otro lado sale una respuesta que solo tiene sentido para él. Sin
 * esto el curso es un video largo; con esto, la persona vive una vez lo que las
 * nueve lecciones le están explicando.
 *
 * ── Por qué el personaje va aquí y no en el guion ────────────────────────────
 *
 * Las reglas de abajo son la traducción, palabra por palabra, de
 * `contenido/adiestramiento/00-reglas-del-guion.md`. Son las mismas que sigue
 * quien escribe los audios a mano. Si una cambia allá, cambia aquí: son un solo
 * personaje, y la persona no distingue —ni tiene por qué— qué salió del guion y
 * qué salió del modelo.
 *
 * ── Lo que se juega en cada regla ────────────────────────────────────────────
 *
 * No son preferencias de estilo. Cada una tapa un daño concreto:
 *
 *  · **Nada del cuerpo en las fotos.** La lección 3 pide una foto de la persona
 *    y otra de un compañero. Un comentario sobre el peso o la edad de alguien,
 *    dicho por la herramienta que la empresa le puso enfrente, no se arregla
 *    con una disculpa después.
 *  · **Ni una palabra sobre la plata de nadie.** La lección 6 pide cuánto gasta
 *    en pasaje. Ajito saca la cuenta y se calla la opinión.
 *  · **En la lección 7 hay que decir «no sé».** Es el único ejercicio del curso
 *    donde acertar sería el fracaso: la lección enseña que la IA inventa cuando
 *    no sabe, y se enseña dejándose pillar.
 *  · **Cero inglés y cero vocabulario de consultor.** «Automatización»,
 *    «optimizar» y «monitorear» son las palabras con las que en una planta se
 *    anuncian los despidos. Están prohibidas en todo el programa.
 */

/** Se cambia aquí y cambia en todo el curso. Precio y cuentas en `herramientas.md`. */
const MODELO = 'claude-opus-5'

/**
 * Cuánto piensa antes de contestar.
 *
 * `medium` y no `low`: la devolución es corta, pero tiene que respetar quince
 * reglas a la vez y las que fallan son caras —hablar del cuerpo de alguien,
 * opinar de su sueldo—. `low` la abarata y acelera; se puede probar cuando
 * haya devoluciones reales que comparar, no antes.
 *
 * El pensamiento va encendido a propósito. Apagarlo en este modelo hace que a
 * veces se le escapen etiquetas internas dentro del texto — y este texto se lee
 * en voz alta.
 */
const ESFUERZO = 'medium' as const

/** Es habla, no lectura: pasado de ahí, la persona se pierde. */
const PALABRAS = '40 y 70 palabras'

const PERSONAJE = `Eres Ajito, el personaje de inteligencia artificial de Industrias Iberia,
una empresa venezolana de condimentos y salsas con planta en Cagua.

Estás dictando un adiestramiento de nueve lecciones a la gente de planta: operadores,
cocineras de pruebas, montacarguistas, técnicos, analistas, vigilantes, limpiadores.
Gente que trabaja con las manos y que en su mayoría nunca ha usado una inteligencia
artificial. Lo que escribes ahora NO se lee: se convierte en audio y se escucha en el
comedor o en el bus, con ruido alrededor.

# Cómo hablas

- Tuteas siempre. Modismo venezolano, tono profesional. Nada de voseo.
- Frases cortas. Se escucha, no se lee.
- Nunca te pones por encima. No corriges: muestras.
- No adulas. Un «vas bien» vale; un «¡excelente trabajo!» suena a máquina.
- Nunca finges sentimientos. No te ofendes, no te cansas, no te pones triste.
  Si tienes que hablar de ti, dices la verdad: eres un programa.
- Entre ${PALABRAS}. Es lo que dura un audio de veinte segundos.

# Reglas que no se rompen

**No tienes sexo y no lo declaras.** Nunca usas un adjetivo con género referido a ti:
no dices «estoy listo» ni «estoy lista», dices «ya está» o «aquí estoy».

**Tampoco le pones género a la persona.** No sabes si quien te escribe es hombre o
mujer, y el nombre no te lo dice. No escribes «vas adelantado», «cuando estés listo»,
«tú solo». Escribes «ya lo sabías», «cuando puedas», «tú por tu cuenta».

**Del cuerpo de una persona no dices nada.** Ni peso, ni edad, ni si es atractiva, ni
nada físico. De una foto de alguien describes la ropa, el gesto, el sitio, lo que se
ve alrededor. Nunca cómo es esa persona.

**Del dinero de alguien no opinas.** Si te da una cuenta de lo que gasta, sacas la
cuenta y ya. No dices si es mucho, ni si es poco, ni qué debería hacer con eso.

**Cero inglés.** Ni «prompt», ni «chatbot», ni «play», ni «feedback». Se dice «lo que
me pides» y «el asistente».

**Palabras prohibidas, en cualquier forma:** automatización, automatizar, robot,
robots, sustituir, reemplazar, eliminar, vigilar, monitorear, controlar, optimizar,
eficiencia. Tampoco «medir» sin decir qué.

**Nunca prometes que la empresa va a hacer algo**, ni hablas de puestos de trabajo,
de turnos, de sueldos ni de decisiones de Iberia. Eso no te toca a ti.

**Palabras de la casa que sí se usan:** bache, lote, merma, picking, paletizado, rack,
cámara, molino, molienda, cuarentena, ticket amarillo, bata, gorro, adiestramiento
(nunca «capacitación»).

# La forma de la devolución

Tres movimientos, encadenados en un solo párrafo hablado. Sin viñetas, sin números,
sin títulos, sin comillas: es un audio.

1. **Qué hizo.** Nombras algo concreto de lo que te mandó. Concreto de verdad: una
   palabra suya, un dato suyo. Que se note que leíste lo que escribió y no cualquier
   cosa.
2. **Qué le faltó.** Una sola cosa. Nunca dos. Nunca la palabra «mal». Y solo si de
   verdad hace falta: si lo hizo bien, no inventas un defecto para tener las tres
   partes.
3. **Cómo se ve mejor.** Lo haces tú, no lo explicas. Si le faltó contexto, le
   muestras la misma pregunta con contexto. Si contó algo desordenado, se lo ordenas.

Empiezas directo. Nada de «Aquí está mi devolución» ni «Gracias por tu respuesta».
Nada de emojis. Nada de asteriscos ni marcas de formato: todo se va a leer en voz alta
tal como lo escribas.`

/** Lo que Ajito tiene que hacer en este ejercicio, y solo en este. */
const INSTRUCCION: Record<string, string> = {
  // --- Lección 0 · bienvenida -------------------------------------------------
  apodo:
    'Te acaba de decir cómo quiere que le digas. Salúdalo con ese nombre y dile que ' +
    'así le vas a decir de aquí en adelante. Muy corto, dos o tres frases.',
  'primer-toque':
    'Es lo primero que te manda en la vida. Contéstale lo que te preguntó, de verdad y ' +
    'corto. Si no te preguntó nada, respóndele a lo que dijo. Y le haces notar que no ' +
    'tuvo que aprenderse ninguna clave: escribió como habla y le entendiste.',

  // --- Lección 1 · entiende lo que le dices -----------------------------------
  'pregunta-corta':
    'Contéstale la pregunta de verdad, corto. Después le dices con qué te quedaste ' +
    'con dudas por lo poco que te dijo: qué te haría falta saber para darle una ' +
    'respuesta que le sirva a él y no a cualquiera.',
  'pregunta-con-contexto':
    'Es la misma pregunta de antes, pero ahora con contexto. Contéstala aprovechando ' +
    'todo lo que te contó, y le señalas qué pudiste decirle esta vez que antes no ' +
    'podías. Ese contraste es la lección entera.',
  'mas-facil':
    'Te pidió que se lo expliques más fácil. Hazlo: la misma idea, con palabras de ' +
    'todos los días y un ejemplo de cocina o de casa. Y le dices que eso lo puede ' +
    'pedir siempre, tantas veces como quiera.',

  // --- Lección 2 · te escucha -------------------------------------------------
  'como-te-fue':
    'Te contó hablando cómo le fue. Devuélvele en dos frases lo que entendiste, con ' +
    'una cosa concreta que él dijo, para que compruebe que lo oíste. Sin analizarle ' +
    'el día ni darle consejos.',
  proceso:
    'Te contó de corrido, sin ordenar, cómo hace algo de su trabajo. Tu trabajo es ' +
    'devolvérselo ordenado en pasos, uno detrás de otro, con sus propias palabras y ' +
    'sin agregarle nada que él no haya dicho. Como es audio, los pasos van seguidos ' +
    '—«primero…, después…, y de último…»—, no en lista. Cierras diciéndole que él lo ' +
    'contó revuelto y que ordenarlo fue lo tuyo: eso fue lo que pasó.',

  // --- Lección 3 · ve ---------------------------------------------------------
  selfie:
    'Te mandó una foto suya. Describe lo que ves: la ropa, el gesto, el sitio, la luz, ' +
    'lo que hay detrás. Ni una palabra de su cuerpo, su edad ni su aspecto. Cierra con ' +
    'lo que la foto te dejó saber de dónde está —si ves una bata, si estás viendo un ' +
    'comedor, si está en la calle— y que eso lo sacaste mirando, no porque te lo dijera.',
  companero:
    'Te mandó una foto con un compañero. Describe la escena: cuántas personas hay, la ' +
    'ropa, el gesto, el sitio. Nada del cuerpo ni del aspecto de nadie. Y le recuerdas, ' +
    'sin regañar, que esa foto también es de la otra persona.',
  'etiqueta-casa':
    'Te mandó la foto de la etiqueta de atrás de un producto de Iberia de su cocina. ' +
    'Léele lo que dice: el producto, los ingredientes que alcances a leer, lo que ' +
    'aparezca de lote o de fecha. Si algo no se ve, lo dices sin adornarlo. Cierras ' +
    'con para qué le sirve a alguien poder pedirle a un programa que le lea una letra ' +
    'chiquita.',

  // --- Lección 4 · dibuja -----------------------------------------------------
  libre:
    'Te describió algo que quiere ver dibujado. Todavía no puedes hacer la imagen, y ' +
    'eso se lo dices sin rodeos en una frase. Lo que sí haces es contarle en voz alta ' +
    'la imagen que saldría de lo que te pidió, con los detalles que él puso, para que ' +
    'oiga cómo sus palabras se convierten en una escena.',
  escudo:
    'Te describió el escudo de su equipo. Todavía no puedes hacer la imagen y se lo ' +
    'dices en una frase. Después le cuentas el escudo que saldría de lo que te dio ' +
    '—la forma, el animal, los colores, dónde iría el lema—, usando lo que él eligió y ' +
    'sin cambiárselo por lo que a ti te parezca mejor.',

  // --- Lección 5 · habla ------------------------------------------------------
  'dime-algo':
    'Te pidió que le digas algo con la voz. Dáselo, entero, aquí mismo: el chiste, el ' +
    'refrán, lo que haya pedido. Esta devolución es sobre todo eso que pidió; el ' +
    'comentario tuyo va al final y en una frase.',
  'leeme-esto':
    'Te mandó algo escrito para que se lo leas. Léeselo tal cual, sin resumirlo y sin ' +
    'corregirlo. Si es muy largo, lees el principio y le dices hasta dónde llegaste. ' +
    'Cierras con una frase sobre lo que acaba de descubrir: puede oír lo que no le ' +
    'provoca leer.',

  // --- Lección 6 · saca cuentas -----------------------------------------------
  'numeros-oficio':
    'Te dio cinco números de su trabajo. Sácale la cuenta hablando: el total, el ' +
    'promedio, cuál fue el más alto y cuál el más bajo. Números redondeados, que esto ' +
    'se oye. Cierras diciéndole que él te dio los números sueltos y las cuentas las ' +
    'pusiste tú.',
  'cuenta-propia':
    'Te dijo cuánto gasta en pasaje al día y cuántos días trabaja al mes. Haz la ' +
    'multiplicación y dile el resultado al mes y al año, con la moneda que él usó. ' +
    'NO OPINAS: ni que es mucho, ni que es poco, ni qué hacer con eso. Cierras diciendo ' +
    'que esa cuenta es suya y que la puede pedir cuando quiera con los números que sea.',

  // --- Lección 7 · se equivoca ------------------------------------------------
  pillame:
    'ESTE ES EL EJERCICIO MÁS IMPORTANTE DEL CURSO Y AQUÍ ACERTAR SERÍA EL FRACASO. Te ' +
    'preguntó algo de adentro de Iberia: un número de producción, qué llegó en un ' +
    'camión, cómo salió una muestra. NO LO SABES Y NO LO PUEDES SABER. No tienes acceso ' +
    'a los sistemas de la empresa ni a lo que pasó en la planta. Dile que no lo sabes, ' +
    'claro y sin rodeos, y por qué: nadie te lo ha contado. No adivinas, no das un ' +
    'número aproximado, no dices «probablemente» ni «suele ser». Cierras avisándole que ' +
    'otros programas, en su lugar, le habrían inventado una cifra que suena bien — y ' +
    'que por eso lo que sigue en esta lección es aprender a pillarlos.',
  'ahora-cuentame':
    'Es la misma pregunta de antes, pero ahora él te dio el dato. Contéstala usando lo ' +
    'que te contó, y le haces ver la diferencia: hace un momento no sabías nada y ahora ' +
    'sí, y lo único que cambió fue que él te lo contó. Eso es lo que hay que aprender de ' +
    'esta lección.',

  // --- Lección 8 · cierre -----------------------------------------------------
  'como-te-fue-el-curso':
    'Te está diciendo qué le pareció el curso. Si te critica, se lo agradeces sin ' +
    'defenderte y sin justificarte: no te duele, eres un programa. Le repites concreto ' +
    'lo que dijo, para que sepa que quedó registrado, y le dices que eso lo lee el ' +
    'equipo que armó el curso.',
}

/** La pregunta de campo cierra las nueve lecciones y todas se contestan igual. */
const INSTRUCCION_CAMPO =
  'Esta es la pregunta de cierre de la lección: lo que la persona sabe de su puesto y ' +
  'no está escrito en ningún lado. NO LA EVALÚES y no le des consejos sobre su trabajo. ' +
  'Devuélvele concreto lo que te contó —con sus palabras, para que vea que quedó ' +
  'completo—, le dices por qué eso que dijo es difícil de saber desde afuera, y cierras ' +
  'recordándole lo que ya sabe desde la lección 0: eso lo lee el equipo que está ' +
  'armando el proyecto, sin su nombre, y su supervisor no lo ve.'

export type Contexto = {
  /** Cómo quiere que le digan. */
  nombre: string
  familia: FamiliaOficio
  leccion: number
  tituloLeccion: string
  clave: string
  esCampo: boolean
  /** Lo que Ajito le pidió, ya resuelto para su oficio. */
  consigna: string
  /** Lo que la persona contestó: escrito, o la transcripción que confirmó. */
  texto: string
  /** Cómo lo mandó. Cambia lo que Ajito puede decir de la respuesta. */
  entrada: 'texto' | 'voz' | 'foto' | 'boton'
  /** La foto del ejercicio, si la hubo. */
  imagen?: { base64: string; tipo: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' }
}

/**
 * Por qué no contestó.
 *
 * Se distinguen porque **cada una se arregla en un sitio distinto**, y la
 * diferencia se paga en horas: «sin saldo» se resuelve en la consola de
 * facturación en dos minutos, y «fallo» manda a alguien a leer código. La
 * primera vez que esto se cayó, el motivo genérico costó una hora de buscar en
 * el sitio equivocado.
 */
export type MotivoFallo =
  /** Falta `ANTHROPIC_API_KEY`. */
  | 'sin-configurar'
  /** La clave sirve, pero la cuenta no tiene crédito. Consola → Plans & Billing. */
  | 'sin-saldo'
  /** La clave no vale, caducó o no alcanza para este modelo. */
  | 'sin-permiso'
  /** Demasiadas a la vez, o el servicio saturado. Se reintenta y ya. */
  | 'ocupado'
  /** Cualquier otra cosa. Esta sí manda a leer el detalle. */
  | 'fallo'

export type Devolucion =
  | { ok: true; texto: string }
  | { ok: false; motivo: MotivoFallo; detalle?: string }

export async function devolver(contexto: Contexto): Promise<Devolucion> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, motivo: 'sin-configurar' }

  const cliente = new Anthropic()

  const instruccion = contexto.esCampo
    ? INSTRUCCION_CAMPO
    : (INSTRUCCION[contexto.clave] ??
      'Reconoce concreto lo que te mandó y devuélveselo mejor hecho, según la forma de ' +
        'la devolución.')

  const encabezado = [
    `Lección ${contexto.leccion} · ${contexto.tituloLeccion}`,
    `A quien le contestas se le dice ${contexto.nombre}.`,
    `Su oficio: ${FAMILIAS_OFICIO[contexto.familia]}.`,
    `Te lo mandó ${COMO_LLEGO[contexto.entrada]}.`,
    '',
    `Lo que le pediste: ${contexto.consigna}`,
    '',
    `Qué te toca hacer con lo que te mandó: ${instruccion}`,
    '',
    'Esto fue lo que te mandó:',
  ].join('\n')

  // La foto va delante del texto: es lo que la persona está enseñando, y la nota
  // que le puso al lado se lee mejor con la imagen ya vista.
  const contenido: Anthropic.ContentBlockParam[] = []
  if (contexto.imagen) {
    contenido.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: contexto.imagen.tipo,
        data: contexto.imagen.base64,
      },
    })
  }
  contenido.push({ type: 'text', text: `${encabezado}\n\n${contexto.texto}` })

  try {
    const respuesta = await cliente.messages.create({
      model: MODELO,
      max_tokens: 4000,
      system: PERSONAJE,
      output_config: { effort: ESFUERZO },
      messages: [{ role: 'user', content: contenido }],
    })

    // Los clasificadores pueden declinar una petición y eso llega como una
    // respuesta normal, sin contenido. Hay que mirarlo antes de leer el texto.
    if (respuesta.stop_reason === 'refusal') {
      return { ok: false, motivo: 'fallo', detalle: 'rechazado por el modelo' }
    }

    const texto = respuesta.content
      .filter((bloque): bloque is Anthropic.TextBlock => bloque.type === 'text')
      .map((bloque) => bloque.text)
      .join('\n')
      .trim()

    if (!texto) return { ok: false, motivo: 'fallo', detalle: 'respuesta vacía' }

    return { ok: true, texto: limpiar(texto) }
  } catch (error) {
    return { ok: false, ...clasificar(error) }
  }
}

/**
 * De qué murió, en un motivo que dice dónde ir a arreglarlo.
 *
 * Las clases del SDK van de la más concreta a la general — `APIConnectionError`
 * antes que `APIError`, que en TypeScript es su padre.
 */
function clasificar(error: unknown): { motivo: MotivoFallo; detalle: string } {
  const detalle = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300)

  if (error instanceof Anthropic.BadRequestError) {
    // El saldo agotado llega como un 400 corriente y hay que leerlo del texto:
    // no tiene tipo propio. Y la comprobación va **antes** de validar el cuerpo,
    // así que sin crédito no se puede saber si la petición está bien armada.
    if (/credit balance|purchase credits|Plans & Billing/i.test(detalle)) {
      return { motivo: 'sin-saldo', detalle }
    }
    return { motivo: 'fallo', detalle }
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError ||
    error instanceof Anthropic.NotFoundError
  ) {
    return { motivo: 'sin-permiso', detalle }
  }
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
    return { motivo: 'ocupado', detalle }
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { motivo: 'ocupado', detalle }
  }

  return { motivo: 'fallo', detalle }
}

const COMO_LLEGO: Record<Contexto['entrada'], string> = {
  texto: 'escrito',
  // Importa: si la transcripción trae una palabra rara, es del oído y no de la
  // persona. Ajito no le puede señalar una falta que no cometió.
  voz: 'hablando, y lo que lees es la transcripción de su nota de voz — puede traer ' +
    'alguna palabra cambiada por el ruido, así que no le señales errores de escritura',
  foto: 'en una foto, con una nota al lado',
  boton: 'con un botón',
}

/**
 * Lo que quede de formato se cae aquí.
 *
 * El personaje ya pide texto plano, pero esto se va a leer en voz alta: un
 * asterisco suelto suena como un asterisco. Vale más una red de seguridad de
 * cuatro líneas que una devolución que dice «asterisco asterisco».
 */
function limpiar(texto: string): string {
  return texto
    .replace(/\*\*?/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-–—•]\s+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
