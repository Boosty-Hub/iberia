/**
 * La memoria del asistente (fase 3): hechos de cómo trabaja cada quien, que el
 * modelo guarda con `recordar` y borra con `olvidar`. Nunca datos de las
 * fuentes de la plataforma, cifras, costos ni datos personales de terceros: el
 * filtro de abajo rechaza lo que parece cédula, teléfono o correo, y las
 * instrucciones le dicen al modelo qué no guardar. No entra a chats compartidos.
 */
import type { Bloque } from '../tipos'

export type Memoria = { id: string; texto: string }

export type ApiMemoria = {
  lista: Memoria[]
  recordar: (texto: string) => Promise<Memoria>
  olvidar: (id: string) => Promise<boolean>
  /** Busca en los chats anteriores de la persona (26-nov-2026). Nunca desde un chat compartido. */
  buscarChats?: (texto: string) => Promise<{ titulo: string; fecha: string; fragmento: string }[]>
}

export function contextoMemoria(m: ApiMemoria | null): string {
  if (!m) return ''
  if (!m.lista.length) return '\n[Tu memoria de esta persona está vacía.]'
  return `\n[Lo que recuerdas de esta persona (id: hecho): ${m.lista.map((x) => `${x.id.slice(0, 8)}: ${x.texto}`).join(' | ')}]`
}

export const HERRAMIENTAS_MEMORIA = [
  {
    name: 'recordar',
    description:
      'Guarda en la memoria de esta persona un hecho estable de cómo trabaja (su área, su cargo, cómo quiere los informes, los nombres que usa, qué revisa cada mes). Úsala cuando la persona lo pida («recuerda que…») o cuando detectes una preferencia estable. NO guardes cifras, datos de la plataforma, costos, contraseñas ni datos personales de otras personas. Una frase corta por hecho.',
    input_schema: {
      type: 'object',
      properties: { hecho: { type: 'string', description: 'El hecho, en una frase corta en tercera persona («Prefiere los informes en una página»).' } },
      required: ['hecho'],
      additionalProperties: false,
    },
  },
  {
    name: 'olvidar',
    description: 'Borra de la memoria un hecho por su id (los primeros 8 caracteres de la lista de memoria). Úsala cuando la persona diga «olvida…» o corrija algo que recordabas.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
]

export const HERRAMIENTA_BUSCAR_CHATS = {
  name: 'buscar_en_mis_chats',
  description:
    'Busca en los chats anteriores de esta persona (lo que conversó contigo en otros chats y sus resúmenes). Úsala cuando la pregunta se refiera a algo hablado antes («como me recomendaste», «retoma el análisis de ventas», «lo que acordamos la semana pasada») o cuando el contexto de conversaciones previas mejore la respuesta. Devuelve fragmentos con el título y la fecha del chat: cita de qué chat sale lo que uses.',
  input_schema: {
    type: 'object',
    properties: { consulta: { type: 'string', description: 'Las palabras clave a buscar, en español.' } },
    required: ['consulta'],
    additionalProperties: false,
  },
}

export const NOMBRES_MEMORIA = new Set(['recordar', 'olvidar', 'buscar_en_mis_chats'])

export const PROHIBIDO_EN_MEMORIA = [/\b[VEJGvejg]-?\d{6,9}\b/, /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u, /(\+?58[\s-]?)?\(?0?4\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/, /contrase(ñ|n)a|clave de acceso|password/i]

export async function herramientaMemoria(
  m: ApiMemoria,
  nombre: string,
  entrada: unknown
): Promise<{ texto: string; titulo: string; bloque?: Extract<Bloque, { tipo: 'memoria' }>; error?: boolean }> {
  const e = (entrada ?? {}) as { hecho?: unknown; id?: unknown; consulta?: unknown }
  if (nombre === 'buscar_en_mis_chats') {
    const consulta = String(e.consulta ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
    if (!m.buscarChats || consulta.length < 2) return { texto: 'No hay búsqueda en chats anteriores en este chat.', titulo: 'No buscó en otros chats', error: true }
    const hallado = await m.buscarChats(consulta)
    if (!hallado.length) return { texto: `No encontré nada sobre «${consulta}» en tus chats anteriores.`, titulo: 'Buscó en tus chats anteriores' }
    return {
      texto: hallado.map((h) => `«${h.titulo}» (${h.fecha.slice(0, 10)}): ${h.fragmento.replace(/<\/?b>/g, '')}`).join('\n'),
      titulo: `Buscó en tus chats anteriores (${hallado.length})`,
    }
  }
  if (nombre === 'olvidar') {
    const prefijo = String(e.id ?? '').slice(0, 8)
    const x = m.lista.find((y) => y.id.startsWith(prefijo))
    if (!x || !(await m.olvidar(x.id))) return { texto: 'No encontré ese hecho en la memoria.', titulo: 'No encontró el recuerdo', error: true }
    m.lista = m.lista.filter((y) => y.id !== x.id)
    return { texto: `Olvidado: «${x.texto}».`, titulo: 'Olvidó un recuerdo' }
  }
  const hecho = String(e.hecho ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (hecho.length < 3) return { texto: 'El hecho vino vacío.', titulo: 'No guardó nada', error: true }
  if (PROHIBIDO_EN_MEMORIA.some((r) => r.test(hecho))) return { texto: 'Eso no se guarda en la memoria: parece un dato personal o una credencial.', titulo: 'No guardó un dato personal', error: true }
  const nuevo = await m.recordar(hecho)
  m.lista = [nuevo, ...m.lista]
  return { texto: 'Guardado en la memoria.', titulo: 'Guardó en tu memoria', bloque: { tipo: 'memoria', memoriaId: nuevo.id, texto: hecho } }
}

/** Las herramientas de memoria de este turno: recordar y olvidar, y buscar en los chats anteriores si se puede. */
export function herramientasDeMemoria(m: ApiMemoria | null) {
  if (!m) return []
  return m.buscarChats ? [...HERRAMIENTAS_MEMORIA, HERRAMIENTA_BUSCAR_CHATS] : HERRAMIENTAS_MEMORIA
}
