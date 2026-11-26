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
  | { tipo: 'paso'; id: string; herramienta: 'codigo' | 'busqueda' | 'html' | 'archivo' | 'otra'; titulo: string; detalle?: string; estado: 'corriendo' | 'listo' | 'error' }
  | { tipo: 'archivo'; archivoId: string; nombre: string; mime: string; bytes: number }
  | { tipo: 'artefacto'; artefactoId: string; grupo: string; titulo: string; version: number; clase: ClaseArtefacto }
  /** Formato viejo (antes de los artefactos): se pinta como un artefacto HTML. */
  | { tipo: 'html'; htmlId: string; titulo: string; version: number }
  | { tipo: 'fuente'; url: string; titulo: string }
  | { tipo: 'pensamiento'; texto: string }

/** Lo que viaja por Realtime mientras corre un turno (`asistente:chat:<id>`). */
export type EventoTurno =
  | { t: 'estado'; turno: string; estado: EstadoTurno; error?: string | null }
  | { t: 'texto'; turno: string; d: string }
  | { t: 'pensamiento'; turno: string; d: string }
  | { t: 'paso'; turno: string; paso: Extract<Bloque, { tipo: 'paso' }> }
  | { t: 'bloque'; turno: string; bloque: Bloque }
  | { t: 'fin'; turno: string; estado: EstadoTurno; mensaje: string | null; error?: string | null }

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
