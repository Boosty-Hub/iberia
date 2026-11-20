import type { Tono } from '@/components/ui'

/**
 * Vocabulario de los flujos (requisiciones, aprobaciones, escenarios): las claves
 * espejan los `CHECK` de la base; los valores son lo que se lee en pantalla.
 * Sin `'use client'` ni `'use server'`: lo usan las dos orillas.
 */

const ZONA = 'America/Caracas'

/** La fecha de hoy en Caracas, `AAAA-MM-DD`. La del servidor es UTC y a las 8 p. m. ya es mañana. */
export function hoyCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** 2026-11-20 → «20 nov 2026». Se fija el mediodía para que la zona no corra el día. */
export function fecha(f: string | null | undefined): string {
  if (!f) return '—'
  const d = new Date(`${f.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-VE', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric' })
}

/** Una marca de tiempo, en la hora de Caracas. */
export function fechaHora(f: string | null | undefined): string {
  if (!f) return '—'
  const d = new Date(f)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('es-VE', { timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Días enteros desde una marca de tiempo hasta ahora. */
export function diasDesde(f: string | null | undefined): number {
  if (!f) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(f).getTime()) / 86_400_000))
}

export function diasTexto(n: number): string {
  if (n === 0) return 'hoy'
  return n === 1 ? '1 día' : `${n} días`
}

/** Montos en bolívares o dólares, con la coma decimal de aquí. */
export function monto(n: number | null | undefined, moneda: 'VES' | 'USD' = 'VES'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const txt = n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return moneda === 'USD' ? `USD ${txt}` : `Bs. ${txt}`
}

export const ESTADO_REQUISICION: Record<string, { etiqueta: string; tono: Tono }> = {
  borrador: { etiqueta: 'Borrador', tono: 'neutro' },
  en_aprobacion: { etiqueta: 'En aprobación', tono: 'ambar' },
  devuelta: { etiqueta: 'Devuelta', tono: 'ambar' },
  aprobada: { etiqueta: 'Aprobada', tono: 'verde' },
  rechazada: { etiqueta: 'Rechazada', tono: 'rojo' },
  en_seleccion: { etiqueta: 'En selección', tono: 'marca' },
  cubierta: { etiqueta: 'Cubierta', tono: 'verde' },
  cancelada: { etiqueta: 'Cancelada', tono: 'neutro' },
}

export const ESTADO_SOLICITUD: Record<string, { etiqueta: string; tono: Tono }> = {
  en_curso: { etiqueta: 'En curso', tono: 'ambar' },
  aprobada: { etiqueta: 'Aprobada', tono: 'verde' },
  rechazada: { etiqueta: 'Rechazada', tono: 'rojo' },
  devuelta: { etiqueta: 'Devuelta', tono: 'ambar' },
  cancelada: { etiqueta: 'Cancelada', tono: 'neutro' },
}

export const DECISION: Record<string, { etiqueta: string; tono: Tono }> = {
  pendiente: { etiqueta: 'Pendiente', tono: 'neutro' },
  aprobado: { etiqueta: 'Aprobado', tono: 'verde' },
  rechazado: { etiqueta: 'Rechazado', tono: 'rojo' },
  devuelto: { etiqueta: 'Devuelto', tono: 'ambar' },
  omitido: { etiqueta: 'Omitido', tono: 'neutro' },
}

export const ESTADO_ESCENARIO: Record<string, { etiqueta: string; tono: Tono }> = {
  borrador: { etiqueta: 'Borrador', tono: 'neutro' },
  en_aprobacion: { etiqueta: 'En aprobación', tono: 'ambar' },
  aprobado: { etiqueta: 'Aprobado', tono: 'verde' },
  publicado: { etiqueta: 'Publicado', tono: 'verde' },
  descartado: { etiqueta: 'Descartado', tono: 'neutro' },
}

export const RESOLUTOR: Record<string, string> = {
  cargo: 'Un cargo',
  plaza: 'Una plaza fija',
  jefe_unidad: 'El jefe de la unidad',
  director_unidad: 'El director de la unidad',
  rol: 'Un rol de la plataforma',
}

export const ACCION_PASO: Record<string, { etiqueta: string; boton: string }> = {
  aprobar: { etiqueta: 'Aprueba', boton: 'Aprobar' },
  recibir: { etiqueta: 'Recibe', boton: 'Marcar recibida' },
  completar: { etiqueta: 'Completa', boton: 'Completar' },
}

export const TIPO_OBJETO: Record<string, string> = {
  requisicion_personal: 'Requisición de personal',
  proceso: 'Ficha de proceso',
  escenario_estructura: 'Escenario de estructura',
  escenario_procesos: 'Escenario de procesos',
}

/** A dónde lleva cada objeto de una solicitud. `ref` es la identidad estable del proceso. */
export function enlaceObjeto(tipo: string, objetoId: string, refProceso?: string | null): string | null {
  switch (tipo) {
    case 'requisicion_personal':
      return `/sistema/nucleo/organizacion/requisiciones/${objetoId}`
    case 'proceso':
      return refProceso ? `/sistema/nucleo/procesos/${refProceso}` : null
    case 'escenario_estructura':
      return `/sistema/nucleo/escenarios/${objetoId}`
    case 'escenario_procesos':
      return `/sistema/nucleo/procesos/escenarios/${objetoId}`
    case 'nivel_ia':
      return '/sistema/administracion/ia'
    default:
      return null
  }
}

/** La regla de un paso (`flujo.paso.regla`), en una frase. */
export type Regla = {
  ruta?: string
  resolutor?: string
  rol_id?: string | null
  sin_cuenta?: boolean
  condicion?: Record<string, unknown> | null
} | null

export function textoCondicion(c: Record<string, unknown> | null | undefined, etiquetas: Record<string, string> = {}): string | null {
  if (!c || !Object.keys(c).length) return null
  return Object.entries(c)
    .map(([k, v]) => {
      if (k === 'origen' && Array.isArray(v)) return `si el origen es ${v.map((x) => etiquetas[String(x)] ?? String(x)).join(' o ')}`
      if (k === 'fuera_de_plan') return v ? 'si está fuera del plan de dotación' : 'si está dentro del plan'
      return `si ${k} = ${Array.isArray(v) ? v.join(' o ') : String(v)}`
    })
    .join(' y ')
}

/** Lo que devuelve una acción de servidor de estas pantallas. */
export type EstadoAccion = { error?: string; ok?: string }

/** Traduce un rechazo de la base a algo que se pueda leer. */
export function mensajeError(error: { message: string; code?: string } | null | undefined): string {
  if (!error) return 'No se pudo guardar.'
  if (error.code === '42501') return error.message.includes('row-level security') ? 'No tienes permiso para hacer esto.' : error.message
  if (error.code === '23505') return 'Ya existe uno con esa clave.'
  if (error.code === '23P01') return 'Choca con otra versión vigente en esas fechas.'
  return error.message
}

/** Lee un campo de texto de un formulario, recortado. */
export function campo(fd: FormData, nombre: string): string {
  const v = fd.get(nombre)
  return typeof v === 'string' ? v.trim() : ''
}
