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
  /** Ventanas de 5 h (26-nov-2026): el tope del día repartido; la ventana arranca con el primer mensaje. */
  ventanas_por_dia: number
  tope_ventana_usd: number
  gastado_ventana_usd: number
  ventana_renueva: string | null
  gastado_dia_usd: number
  gastado_mes_usd: number
  tope_empresa_usd?: number
  gastado_empresa_usd?: number
  usado_bytes: number
}

/**
 * Lo que se reserva antes de correr un turno: el peor caso razonable, por modelo (al cerrar se cobra lo real).
 * Calibrada el 26-nov-2026 con los turnos medidos en pruebas (p90 con margen): con ventanas de 5 h, una reserva muy
 * alta dejaba sin usar el último tramo de cada ventana. Se recalibra con el primer mes real. La usan el ejecutor y la
 * pantalla, que cierra el chat cuando ya no cabe un turno.
 */
export const RESERVA_POR_MODELO: Record<string, number> = {
  'claude-opus-5-5': 0.35,
  'claude-sonnet-5-5': 0.15,
  'claude-haiku-5-5': 0.02,
  'gpt-6.2-astra': 0.8,
  'gpt-6.2-sol': 0.45,
  'gpt-6.1-terra': 0.05,
}
const reservaDe = (m: string) => RESERVA_POR_MODELO[m] ?? 0.35

export type MotivoTope = 'ventana' | 'dia' | 'mes' | 'empresa'
export type EstadoCupo =
  | { tipo: 'ok' }
  /** Con el modelo elegido no cabe, pero con otro más liviano sí. */
  | { tipo: 'cambiar'; texto: string; otroModelo: string; quitarInvestigacion?: boolean }
  /** No cabe ningún turno: el chat se cierra hasta que se renueve. */
  | { tipo: 'bloqueado'; motivo: MotivoTope; renueva: string | null; texto: string }

/**
 * ¿Cabe un turno más? La misma cuenta que hace `asistente.reservar_turno` en la base (ventana, día, mes y empresa),
 * con la reserva del modelo elegido (26-nov-2026, Gabriel: que al llegar al tope no se pueda escribir, en vez de
 * mandar mensajes que se quedan sin respuesta).
 */
export function estadoCupo(p: Politica, modelo: string, investigacion: boolean, modelos: string[], ahora = Date.now()): EstadoCupo {
  const activa = !!p.ventana_renueva && Date.parse(p.ventana_renueva) > ahora
  const resto = {
    ventana: Number(p.tope_ventana_usd) - (activa ? Number(p.gastado_ventana_usd) : 0),
    dia: Number(p.tope_diario_usd) - Number(p.gastado_dia_usd),
    mes: Number(p.tope_mensual_usd) - Number(p.gastado_mes_usd),
    empresa: p.tope_empresa_usd == null ? Infinity : Number(p.tope_empresa_usd) - Number(p.gastado_empresa_usd ?? 0),
  }
  const necesita = (m: string) => (investigacion ? Math.max(Number(p.tope_investigacion_usd), reservaDe(m)) : reservaDe(m))
  const falla = (m: string): MotivoTope | null => (['ventana', 'dia', 'mes', 'empresa'] as const).find((k) => necesita(m) > resto[k]) ?? null
  const motivo = falla(modelo)
  if (!motivo) return { tipo: 'ok' }
  const otro = [...modelos].sort((a, b) => reservaDe(a) - reservaDe(b)).find((m) => !falla(m))
  // Con «Investigación» puede no caber nada, y sin ella sí: se ofrece quitarla en vez de cerrar el chat.
  if (!otro && investigacion) {
    const sin = estadoCupo(p, modelo, false, modelos, ahora)
    if (sin.tipo !== 'bloqueado') return { tipo: 'cambiar', otroModelo: sin.tipo === 'cambiar' ? sin.otroModelo : modelo, quitarInvestigacion: true, texto: 'La investigación profunda no cabe en lo que te queda de cupo; una pregunta normal sí.' }
  }
  if (otro) return { tipo: 'cambiar', otroModelo: otro, texto: investigacion ? 'La investigación no cabe en lo que te queda de cupo; prueba sin «Investigación» o con un modelo más liviano.' : 'Con este modelo ya no te alcanza el cupo; con uno más liviano sí.' }
  // El momento de la renovación, en hora de Caracas (UTC−4, sin horario de verano).
  const c = new Date(ahora - 4 * 3_600_000)
  const manana = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth(), c.getUTCDate() + 1, 4)).toISOString()
  const proximoMes = new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1, 4)).toISOString()
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  // El tope que cierra para todos los modelos; si son varios, manda el más largo (con el día agotado, la ventana no renueva nada).
  const final = (['empresa', 'mes', 'dia', 'ventana'] as const).find((k) => modelos.every((x) => necesita(x) > resto[k])) ?? motivo
  if (final === 'ventana' && activa)
    return { tipo: 'bloqueado', motivo: 'ventana', renueva: p.ventana_renueva, texto: `Llegaste al tope de esta ventana de 5 horas. Se renueva a las ${horaCaracas(p.ventana_renueva!)}` }
  if (final === 'dia' || final === 'ventana') return { tipo: 'bloqueado', motivo: 'dia', renueva: manana, texto: 'Llegaste a tu tope de hoy. Se renueva a la medianoche.' }
  if (final === 'mes') return { tipo: 'bloqueado', motivo: 'mes', renueva: proximoMes, texto: `Llegaste a tu tope del mes. Se renueva el 1 de ${MESES[(c.getUTCMonth() + 1) % 12]}.` }
  return { tipo: 'bloqueado', motivo: 'empresa', renueva: proximoMes, texto: 'Se alcanzó el tope mensual del asistente para toda la empresa. Avísale a la administración.' }
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

/**
 * La hora de Caracas («1:05 p. m.») sin `Intl`: Caracas no tiene horario de verano (UTC−4), y así el
 * servidor y el navegador escriben lo mismo (con `Intl` la hidratación no cuadra).
 */
export function horaCaracas(iso: string): string {
  const d = new Date(Date.parse(iso) - 4 * 3_600_000)
  const h = d.getUTCHours()
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** Una fecha en hora de Caracas, corta: «jue 26 nov, 8:00 a. m.». */
export function fechaCaracas(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}
