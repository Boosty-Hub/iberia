import type { Bloque, PropuestaTarea } from '../tipos'
import { describirFrecuencia } from '../tipos'

/**
 * Fase 5. El modelo PROPONE una tarea programada; la persona la confirma en la
 * tarjeta del chat (la IA propone, la persona decide). Esta herramienta no
 * escribe nada en la base.
 */
export const HERRAMIENTA_PROPONER_TAREA = {
  name: 'proponer_tarea',
  description:
    'Propone al usuario una tarea programada: una instrucción que el asistente correrá solo, a una hora de Caracas, con los permisos del usuario, y cuyo resultado llega a la plataforma (y por correo o WhatsApp si lo pide). Úsala cuando el usuario pida algo recurrente («cada lunes…», «todos los días a las 8…», «el primero de cada mes…»). La tarea solo existe cuando el usuario la confirma en la tarjeta. Escribe la instrucción completa y autosuficiente, como si la leyera alguien sin el chat a la vista.',
  input_schema: {
    type: 'object' as const,
    properties: {
      nombre: { type: 'string', description: 'Nombre corto de la tarea, de 2 a 8 palabras.' },
      instruccion: { type: 'string', description: 'Lo que hay que hacer en cada corrida, completo: qué consultar, qué calcular, qué entregar (texto, artefacto o archivo).' },
      frecuencia: { type: 'string', enum: ['diaria', 'semanal', 'mensual', 'horas'] },
      hora: { type: 'string', description: 'Hora de Caracas en formato HH:MM (24 h).' },
      dias: { type: 'array', items: { type: 'integer' }, description: 'Para semanal: días de la semana, 1 = lunes … 7 = domingo. Vacío en las demás.' },
      dia_mes: { type: ['integer', 'null'], description: 'Para mensual: día del mes, de 1 a 28. Null en las demás.' },
      cada_horas: { type: ['integer', 'null'], description: 'Para «horas»: cada cuántas horas (1, 2, 3, 4, 6, 8 o 12). Null en las demás.' },
      canales: { type: 'array', items: { type: 'string', enum: ['plataforma', 'correo', 'whatsapp'] }, description: 'Por dónde le llega el resultado; plataforma va siempre.' },
    },
    required: ['nombre', 'instruccion', 'frecuencia', 'hora', 'dias', 'dia_mes', 'cada_horas', 'canales'],
    additionalProperties: false,
  },
}

export async function herramientaProponerTarea(entrada: unknown): Promise<{ texto: string; error?: boolean; bloque?: Extract<Bloque, { tipo: 'propuesta_tarea' }> }> {
  const e = (entrada ?? {}) as Record<string, unknown>
  const nombre = typeof e.nombre === 'string' ? e.nombre.trim().slice(0, 120) : ''
  const instruccion = typeof e.instruccion === 'string' ? e.instruccion.trim().slice(0, 8000) : ''
  const frecuencia = ['diaria', 'semanal', 'mensual', 'horas'].includes(String(e.frecuencia)) ? (e.frecuencia as PropuestaTarea['frecuencia']) : null
  const hora = typeof e.hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(e.hora) ? e.hora : null
  const dias = Array.isArray(e.dias) ? [...new Set(e.dias.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort() : []
  const diaMes = Number.isInteger(e.dia_mes) && (e.dia_mes as number) >= 1 && (e.dia_mes as number) <= 28 ? (e.dia_mes as number) : null
  const cadaHoras = [1, 2, 3, 4, 6, 8, 12].includes(Number(e.cada_horas)) ? Number(e.cada_horas) : null
  const canales = ['plataforma', ...(Array.isArray(e.canales) ? e.canales.filter((c) => c === 'correo' || c === 'whatsapp') : [])] as PropuestaTarea['canales']
  if (nombre.length < 2 || instruccion.length < 5 || !frecuencia || !hora) return { texto: 'Faltan el nombre, la instrucción, la frecuencia o la hora (HH:MM).', error: true }
  if (frecuencia === 'semanal' && !dias.length) return { texto: 'Una tarea semanal necesita al menos un día (1 = lunes … 7 = domingo).', error: true }
  if (frecuencia === 'mensual' && !diaMes) return { texto: 'Una tarea mensual necesita el día del mes (1 a 28).', error: true }
  if (frecuencia === 'horas' && !cadaHoras) return { texto: 'Falta cada cuántas horas (1, 2, 3, 4, 6, 8 o 12).', error: true }
  const propuesta: PropuestaTarea = { nombre, instruccion, frecuencia, hora, dias: frecuencia === 'semanal' ? dias : [], dia_mes: frecuencia === 'mensual' ? diaMes : null, cada_horas: frecuencia === 'horas' ? cadaHoras : null, canales: [...new Set(canales)] }
  return {
    texto: `Le mostré la propuesta «${nombre}» (${describirFrecuencia(propuesta)}). Queda programada solo si la confirma en la tarjeta: no digas que ya está programada.`,
    bloque: { tipo: 'propuesta_tarea', propuesta },
  }
}

/** Lo que se suma al system en una investigación profunda. */
export const INSTRUCCIONES_INVESTIGACION = `

Modo investigación profunda (lo pidió el usuario para este mensaje):
- Empieza con un plan corto y visible: 3 a 6 preguntas que vas a responder y dónde vas a buscar cada una (internet, las fuentes de la plataforma, los archivos).
- Investiga a fondo: varias búsquedas por pregunta, contrasta fuentes, prefiere fuentes primarias y recientes, y anota la fecha de lo que cites. Usa los datos de la plataforma cuando apliquen.
- Entrega un informe como artefacto tipo documento (o un PDF en $OUTPUT_DIR si lo pidió): resumen ejecutivo arriba, hallazgos con su evidencia, lo que no se pudo confirmar y las fuentes citadas con enlace.
- En el chat, solo dos o tres líneas con la conclusión y que el informe está en el panel.
- Si te avisan que se acabó el presupuesto o el tiempo, cierra ya con lo que tienes y dilo.`

/** La nota con la que corre una tarea programada (va en el mensaje del turno, no en el system). */
export function contextoCorrida(nombre: string, perdidas: string[]): string {
  let s = `[Corrida programada de la tarea «${nombre}». No hay nadie esperando en vivo: no hagas preguntas, entrega el resultado completo. Si una fuente no está disponible, dilo al principio de la respuesta.`
  if (perdidas.length) s += ` Atención: desde la última corrida el usuario ya no tiene acceso a ${perdidas.map((p) => `«${p}»`).join(', ')}; empieza diciéndolo en una línea y sigue con lo demás.`
  return `${s}]\n\n`
}
