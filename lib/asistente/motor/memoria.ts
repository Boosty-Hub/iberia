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

export const NOMBRES_MEMORIA = new Set(['recordar', 'olvidar'])

const PROHIBIDO = [/\b[VEJGvejg]-?\d{6,9}\b/, /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/u, /(\+?58[\s-]?)?\(?0?4\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/, /contrase(ñ|n)a|clave de acceso|password/i]

export async function herramientaMemoria(
  m: ApiMemoria,
  nombre: string,
  entrada: unknown
): Promise<{ texto: string; titulo: string; bloque?: Extract<Bloque, { tipo: 'memoria' }>; error?: boolean }> {
  const e = (entrada ?? {}) as { hecho?: unknown; id?: unknown }
  if (nombre === 'olvidar') {
    const prefijo = String(e.id ?? '').slice(0, 8)
    const x = m.lista.find((y) => y.id.startsWith(prefijo))
    if (!x || !(await m.olvidar(x.id))) return { texto: 'No encontré ese hecho en la memoria.', titulo: 'No encontró el recuerdo', error: true }
    m.lista = m.lista.filter((y) => y.id !== x.id)
    return { texto: `Olvidado: «${x.texto}».`, titulo: 'Olvidó un recuerdo' }
  }
  const hecho = String(e.hecho ?? '').replace(/\s+/g, ' ').trim().slice(0, 300)
  if (hecho.length < 3) return { texto: 'El hecho vino vacío.', titulo: 'No guardó nada', error: true }
  if (PROHIBIDO.some((r) => r.test(hecho))) return { texto: 'Eso no se guarda en la memoria: parece un dato personal o una credencial.', titulo: 'No guardó un dato personal', error: true }
  const nuevo = await m.recordar(hecho)
  m.lista = [nuevo, ...m.lista]
  return { texto: 'Guardado en la memoria.', titulo: 'Guardó en tu memoria', bloque: { tipo: 'memoria', memoriaId: nuevo.id, texto: hecho } }
}
