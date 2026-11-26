/**
 * El vocabulario del asistente de IA, compartido por el navegador, el servidor
 * de Next y la función de fondo de Netlify. Sin `'use client'`, sin
 * `'use server'` y sin importar nada de Next: lo carga también el ejecutor.
 */

export type Motor = 'anthropic' | 'openai' | 'local'
export type Esfuerzo = 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type EstadoTurno = 'en_cola' | 'corriendo' | 'listo' | 'fallido' | 'detenido'

export const ESFUERZOS: Esfuerzo[] = ['low', 'medium', 'high', 'xhigh', 'max']

export const ETIQUETA_ESFUERZO: Record<Esfuerzo, string> = {
  low: 'Bajo',
  medium: 'Medio',
  high: 'Alto',
  xhigh: 'Muy alto',
  max: 'Máximo',
}

export const ETIQUETA_MOTOR: Record<Motor, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  local: 'Local',
}

/** El orden de los esfuerzos: un esfuerzo vale si no pasa el máximo de la política. */
export function dentroDelMaximo(esfuerzo: Esfuerzo, maximo: Esfuerzo): boolean {
  return ESFUERZOS.indexOf(esfuerzo) <= ESFUERZOS.indexOf(maximo)
}

/** La política efectiva de una persona (`asistente.mi_politica()`). */
export type Politica = {
  habilitado: boolean
  encendido: boolean
  motor: Motor
  modelos: string[]
  modelo_defecto: string
  esfuerzo_defecto: Esfuerzo
  esfuerzo_max: Esfuerzo
  tope_diario_usd: number
  tope_mensual_usd: number
  cuota_mb: number
  puede_compartir: boolean
  puede_programar: boolean
  max_tareas: number
  frecuencia_min_min: number
  tope_investigacion_usd: number
  gastado_dia_usd: number
  gastado_mes_usd: number
  usado_bytes: number
}

export type ModeloCatalogo = {
  id: string
  proveedor: Motor
  nombre: string
  descripcion: string
  esfuerzos: Esfuerzo[]
  vision: boolean
  encendido: boolean
  orden: number
}

/**
 * Lo que queda guardado de una respuesta además de su texto: los pasos de
 * herramienta, los archivos y HTML generados, las fuentes de internet y el
 * pensamiento resumido. Es formato nuestro, no el de un proveedor: un chat
 * empezado con un motor sigue con el otro.
 */
export type Bloque =
  | { tipo: 'paso'; id: string; herramienta: 'codigo' | 'busqueda' | 'html' | 'archivo' | 'datos' | 'otra'; titulo: string; detalle?: string; estado: 'corriendo' | 'listo' | 'error' }
  | { tipo: 'archivo'; archivoId: string; nombre: string; mime: string; bytes: number }
  | { tipo: 'artefacto'; artefactoId: string; grupo: string; titulo: string; version: number; clase: ClaseArtefacto }
  /** Formato viejo (antes de los artefactos): se pinta como un artefacto HTML. */
  | { tipo: 'html'; htmlId: string; titulo: string; version: number }
  | { tipo: 'fuente'; url: string; titulo: string }
  | { tipo: 'pensamiento'; texto: string }
  | { tipo: 'memoria'; memoriaId: string; texto: string }
  | { tipo: 'nota'; texto: string }
  /** Una tarea programada que propuso el modelo; existe solo si la persona la confirma (fase 5). */
  | { tipo: 'propuesta_tarea'; propuesta: PropuestaTarea }

/** Lo que viaja por Realtime mientras corre un turno (`asistente:chat:<id>`). */
export type EventoTurno =
  | { t: 'estado'; turno: string; estado: EstadoTurno; error?: string | null }
  | { t: 'texto'; turno: string; d: string }
  | { t: 'pensamiento'; turno: string; d: string }
  | { t: 'paso'; turno: string; paso: Extract<Bloque, { tipo: 'paso' }> }
  | { t: 'bloque'; turno: string; bloque: Bloque }
  | { t: 'fin'; turno: string; estado: EstadoTurno; mensaje: string | null; error?: string | null }
  /** Un mensaje nuevo de una persona en un chat compartido (los demás lo leen por su id). */
  | { t: 'mensaje'; turno: string; id: string }

export type ClaseArtefacto = 'html' | 'documento' | 'svg'

export const ETIQUETA_CLASE: Record<ClaseArtefacto, string> = {
  html: 'Interactivo',
  documento: 'Documento',
  svg: 'Diagrama',
}

/** Un artefacto, venga del formato nuevo o del viejo. */
export function comoArtefacto(b: Bloque): { id: string; grupo: string; titulo: string; version: number; clase: ClaseArtefacto } | null {
  if (b.tipo === 'artefacto') return { id: b.artefactoId, grupo: b.grupo, titulo: b.titulo, version: b.version, clase: b.clase }
  if (b.tipo === 'html') return { id: b.htmlId, grupo: b.htmlId, titulo: b.titulo, version: b.version, clase: 'html' }
  return null
}

export const TOPICO_CHAT = (chat: string) => `asistente:chat:${chat}`

/** Tamaño máximo por archivo (decisión 20). */
export const MAX_BYTES_ARCHIVO = 100 * 1024 * 1024

/** El aviso al pie del chat (decisión P5). */
export const AVISO_RESGUARDO = 'La información de este chat queda en resguardo de Industrias Iberia para fines de mejora.'

export const CATEGORIAS: Record<string, string> = {
  analisis: 'Análisis de datos',
  redaccion: 'Redacción',
  consulta: 'Consulta',
  documento: 'Documento',
  investigacion: 'Investigación',
  codigo: 'Código',
  otro: 'Otro',
  sin_categoria: 'Sin categoría',
}

/** Qué tipos de archivo se aceptan al adjuntar. */
export const TIPOS_ACEPTADOS =
  '.xlsx,.xls,.xlsm,.csv,.tsv,.docx,.doc,.pptx,.pdf,.txt,.md,.json,.xml,.png,.jpg,.jpeg,.webp,.gif,.heic,.heif'

export function esImagen(mime: string): boolean {
  return /^image\/(png|jpe?g|webp|gif)$/.test(mime)
}

export function bytesLegibles(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2).replace('.', ',')} GB`
}

/** Lo que define cuándo corre una tarea programada (siempre en hora de Caracas). */
export type Frecuencia = {
  frecuencia: 'horas' | 'diaria' | 'semanal' | 'mensual'
  hora: string
  dias: number[]
  dia_mes: number | null
  cada_horas: number | null
}

export type CanalTarea = 'plataforma' | 'correo' | 'whatsapp'

export type PropuestaTarea = Frecuencia & { nombre: string; instruccion: string; canales: CanalTarea[] }

export const ETIQUETA_CANAL: Record<CanalTarea, string> = { plataforma: 'Plataforma', correo: 'Correo', whatsapp: 'WhatsApp' }

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

function lista(xs: string[]): string {
  return xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`
}

/** «Cada lunes a las 8:00», «Todos los días a las 18:30», «El 1 de cada mes a las 9:00», «Cada 6 horas». */
export function describirFrecuencia(f: Pick<Frecuencia, 'frecuencia' | 'hora' | 'dias' | 'dia_mes' | 'cada_horas'>): string {
  const h = (f.hora ?? '08:00').slice(0, 5).replace(/^0(\d)/, '$1')
  if (f.frecuencia === 'horas') return `Cada ${f.cada_horas} ${f.cada_horas === 1 ? 'hora' : 'horas'}, desde las ${h}`
  if (f.frecuencia === 'diaria') return `Todos los días a las ${h}`
  if (f.frecuencia === 'mensual') return `El ${f.dia_mes} de cada mes a las ${h}`
  const dias = [...(f.dias ?? [])].sort()
  if (dias.length === 5 && dias.every((d, i) => d === i + 1)) return `De lunes a viernes a las ${h}`
  if (dias.length === 7) return `Todos los días a las ${h}`
  return `Cada ${lista(dias.map((d) => DIAS[d]))} a las ${h}`
}

/** Una fecha en hora de Caracas, corta: «jue 26 nov, 8:00 a. m.». */
export function fechaCaracas(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}
