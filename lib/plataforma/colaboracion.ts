/**
 * Trabajo en equipo (R3, Anexo E §8): el vocabulario y las formas de la línea
 * de tiempo, las notificaciones y las tareas. Sin `'use client'` ni
 * `'use server'`: lo usan las dos orillas. Las claves espejan los `CHECK` de
 * `supabase/migrations/20261120202000_r3_colaboracion.sql`.
 */

import { fechaLarga, hoyCaracas, numero, sumarDias } from '@/lib/plataforma/formato'

/** Los objetos que tienen línea de tiempo (el `CHECK` de `nucleo.evento.objeto_tipo`). */
export const TIPOS_CON_LINEA = ['unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento'] as const
export type TipoConLinea = (typeof TIPOS_CON_LINEA)[number]

export function tieneLinea(tipo: string): tipo is TipoConLinea {
  return (TIPOS_CON_LINEA as readonly string[]).includes(tipo)
}

export const ETIQUETA_OBJETO: Record<TipoConLinea, string> = {
  unidad: 'Unidad',
  plaza: 'Plaza',
  cargo: 'Cargo',
  persona: 'Persona',
  requisicion: 'Requisición',
  escenario: 'Escenario',
  proceso: 'Proceso',
  documento: 'Documento',
}

/** El valor de `?ficha=` que abre el objeto en el panel lateral. */
export function valorFicha(tipo: string, id: string): string {
  return `${tipo}:${id}`
}

/** La ficha a página completa (para enlaces que salen de la plataforma o se copian). */
export function hrefFicha(tipo: string, id: string): string {
  return `/sistema/ficha/${tipo}/${id}`
}

// -----------------------------------------------------------------------------
// La IA en la línea de tiempo (Anexo E §7): forma + texto, nunca color solo.
// Los colores de nivel no reutilizan los de estado.
// -----------------------------------------------------------------------------

export type NivelIa = 'N1' | 'N2' | 'N3' | 'N4'

export const NIVEL_IA: Record<NivelIa, { etiqueta: string; leyenda: string; insignia: string; tarjeta: string }> = {
  N1: {
    etiqueta: 'N1 · Asistencia',
    leyenda: 'Generado con IA · verifícalo',
    insignia: 'border border-dashed border-[#b9b2cf] bg-white text-[#5a4f80]',
    tarjeta: 'border border-dashed border-[#b9b2cf] bg-white',
  },
  N2: {
    etiqueta: 'N2 · Recomendación',
    leyenda: 'Recomendación con su evidencia',
    insignia: 'bg-[#e8f0fb] text-[#2f5f9a]',
    tarjeta: 'border border-[#cfe0f5] bg-[#f7faff]',
  },
  N3: {
    etiqueta: 'N3 · Requiere aprobación',
    leyenda: 'Una persona aprueba, edita o rechaza',
    insignia: 'bg-[#fdf0dc] text-[#9a5d0b]',
    tarjeta: 'border border-[#f3dcb4] bg-[#fffaf2]',
  },
  N4: {
    etiqueta: 'N4 · Automático',
    leyenda: 'Lo hizo la IA sola; se puede deshacer',
    insignia: 'bg-[#eceef1] text-[#4b535c]',
    tarjeta: 'border border-[#dfe2e6] bg-[#f8f9fa]',
  },
}

// -----------------------------------------------------------------------------
// La línea de tiempo: lo que viaja del servidor a la pantalla (serializable).
// -----------------------------------------------------------------------------

export type Persona = { id: string; nombre: string }

export type CambioCampo = { campo: string; etiqueta: string; antes: string; despues: string }

export type EntradaLinea =
  | {
      clase: 'comentario'
      id: string
      en: string
      autor: Persona | null
      texto: string
      editadoEn: string | null
      oculto: boolean
      mio: boolean
      /** Hasta cuándo se puede editar u ocultar (15 min), si es mío. */
      editableHasta: string | null
      menciones: Persona[]
      respuestas: EntradaLinea[]
    }
  | {
      clase: 'aprobacion'
      id: string
      en: string
      autor: Persona | null
      accion: string
      paso: string | null
      titulo: string | null
      texto: string | null
    }
  | {
      clase: 'ia'
      id: string
      en: string
      capacidad: string
      nivel: NivelIa
      texto: string | null
      evidencia: string | null
      decididoPor: string | null
      deshacerHasta: string | null
    }
  | { clase: 'sistema'; id: string; en: string; autor: Persona | null; texto: string | null }
  | {
      clase: 'cambio'
      id: string
      en: string
      autor: Persona | null
      titulo: string
      cambios: CambioCampo[]
    }

export type DatosLinea = {
  tipo: TipoConLinea
  id: string
  yo: Persona
  siguiendo: boolean
  entradas: EntradaLinea[]
  /** Si la auditoría trajo el tope, hay más atrás. */
  masCambios: boolean
}

export const ACCION_APROBACION: Record<string, { texto: string; marca: string; clase: string }> = {
  enviada: { texto: 'envió a aprobación', marca: '→', clase: 'bg-[#eef0f3] text-marca-700' },
  aprobado: { texto: 'aprobó', marca: '✓', clase: 'bg-[#e7f5ee] text-[#1f6f4b]' },
  rechazado: { texto: 'rechazó', marca: '✕', clase: 'bg-[#fbeceb] text-[#a3241f]' },
  devuelto: { texto: 'devolvió', marca: '↩', clase: 'bg-[#fdf4e3] text-[#8a5a12]' },
  cancelada: { texto: 'canceló la solicitud', marca: '—', clase: 'bg-[#eef0f3] text-marca-600' },
}

// -----------------------------------------------------------------------------
// Diffs legibles de la auditoría.
// -----------------------------------------------------------------------------

/** Cómo se llama cada columna en pantalla. Lo que no esté aquí sale con su nombre limpio. */
export const ETIQUETA_CAMPO: Record<string, string> = {
  nombre: 'Nombre',
  titulo: 'Título',
  tipo: 'Tipo',
  clave: 'Clave',
  sede: 'Sede',
  vigencia: 'Vigencia',
  estado: 'Estado',
  estado_operativo: 'Operación',
  version: 'Versión',
  dotacion: 'Dotación',
  nomina: 'Nómina',
  tipo_nomina: 'Nómina',
  certeza: 'Certeza',
  fuente: 'Fuente',
  nota: 'Nota',
  orden: 'Orden',
  codigo: 'Código',
  codigo_sgc: 'Código SGC',
  codigo_informe: 'Código del informe',
  codigo_organigrama: 'Código del organigrama',
  padre_ref: 'Depende de',
  unidad_ref: 'Unidad',
  cargo_id: 'Cargo',
  plaza_ref: 'Plaza',
  reporta_a_ref: 'Reporta a',
  dueno_plaza_ref: 'Dueño (plaza)',
  dueno_texto: 'Dueño',
  area_texto: 'Área',
  familia: 'Familia',
  nivel: 'Nivel',
  sinonimos: 'Sinónimos',
  proposito: 'Propósito',
  activo: 'Activo',
  ficha: 'Ficha PHVA',
  perimetro: 'Perímetro',
  datos_sensibles: 'Datos sensibles',
  destino: 'Destino',
  alias: 'Alias',
  fecha: 'Fecha',
  proceso_ref: 'Proceso',
  origen: 'Origen',
  cantidad: 'Cantidad',
  justificacion: 'Justificación',
  fecha_deseada: 'Fecha deseada',
  candidato: 'Candidato',
  fecha_ingreso: 'Fecha de ingreso',
  motivo: 'Motivo',
  motivo_contrato: 'Motivo del contrato',
  tiempo_contrato: 'Tiempo del contrato',
  perfil: 'Perfil buscado',
  condiciones: 'Condiciones',
  empleado_id: 'Persona',
  descripcion: 'Descripción',
  alcance: 'Alcance',
  fecha_base: 'Fecha base',
  vigente_desde: 'Vigente desde',
  publicado_en: 'Publicado',
  reemplaza_empleado_id: 'Reemplaza a',
}

const TABLA: Record<string, string> = {
  'org.unidad': 'la unidad',
  'org.plaza': 'la plaza',
  'org.cargo': 'el cargo',
  'org.ocupacion': 'la ocupación',
  'org.requisicion': 'la requisición',
  'org.escenario': 'el escenario',
  'sgc.proceso': 'el proceso',
  'sgc.documento': 'el documento',
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RANGO = /^[[(](\d{4}-\d{2}-\d{2})?,(\d{4}-\d{2}-\d{2})?[\])]$/

/** Un valor de la auditoría, en palabras. */
export function valorLegible(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number') return numero(v, Number.isInteger(v) ? 0 : 2)
  if (Array.isArray(v)) return v.length ? v.map((x) => valorLegible(x)).join(', ') : '—'
  if (typeof v === 'object') return 'contenido actualizado'
  const s = String(v)
  if (UUID.test(s)) return 'otro registro'
  const r = RANGO.exec(s)
  if (r) {
    const [, desde, hasta] = r
    // `[a,b)` termina el día antes de b.
    const fin = hasta ? (s.endsWith(')') ? sumarDias(hasta, -1) : hasta) : null
    if (desde && fin) return `del ${fechaLarga(desde)} al ${fechaLarga(fin)}`
    if (desde) return `desde el ${fechaLarga(desde)}`
    return fin ? `hasta el ${fechaLarga(fin)}` : 'sin fecha'
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return fechaLarga(s)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fechaLarga(s.slice(0, 10))
  const limpio = /^[a-z_]+$/.test(s) ? s.replace(/_/g, ' ') : s
  return limpio.length > 140 ? `${limpio.slice(0, 139)}…` : limpio
}

export function etiquetaCampo(campo: string): string {
  return ETIQUETA_CAMPO[campo] ?? campo.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

/** El rótulo de una fila de auditoría: «Modificó la plaza», «Nueva versión del proceso». */
export function tituloCambio(accion: string, tabla: string, extra: Record<string, unknown> | null): string {
  const que = TABLA[tabla] ?? 'el registro'
  if (tabla === 'org.ocupacion') {
    if (accion === 'INSERT') return 'Asignó un ocupante'
    if (accion === 'DELETE') return 'Quitó un ocupante'
    return 'Cambió la ocupación'
  }
  if (accion === 'INSERT') {
    const version = Number(extra?.version ?? 0)
    if (version > 1) return `Abrió la versión ${version} de ${que.replace(/^(el|la) /, '')}`
    if (['org.unidad', 'org.plaza'].includes(tabla) && typeof extra?.vigencia === 'string') {
      return `Abrió una versión de ${que.replace(/^(el|la) /, '')} ${valorLegible(extra.vigencia)}`
    }
    return `Creó ${que}`
  }
  if (accion === 'DELETE') return `Eliminó ${que}`
  return `Modificó ${que}`
}

// -----------------------------------------------------------------------------
// Notificaciones
// -----------------------------------------------------------------------------

export type TipoNotificacion = 'mencion' | 'aprobacion' | 'ia' | 'sistema' | 'seguimiento' | 'tarea'

export const TIPO_NOTIFICACION: Record<TipoNotificacion, { etiqueta: string; marca: string; clase: string }> = {
  aprobacion: { etiqueta: 'Aprobaciones', marca: '✓', clase: 'bg-[#fdf4e3] text-[#8a5a12]' },
  mencion: { etiqueta: 'Menciones', marca: '@', clase: 'bg-[#eaf2fb] text-[#2f5f9a]' },
  seguimiento: { etiqueta: 'Lo que sigo', marca: '◉', clase: 'bg-[#eef0f3] text-marca-700' },
  tarea: { etiqueta: 'Tareas', marca: '☐', clase: 'bg-[#e7f5ee] text-[#1f6f4b]' },
  ia: { etiqueta: 'IA', marca: '✦', clase: 'bg-[#f1edfa] text-[#5a3f9e]' },
  sistema: { etiqueta: 'Sistema', marca: '⚙', clase: 'bg-[#eef0f3] text-marca-600' },
}

export type Notificacion = {
  id: string
  tipo: TipoNotificacion
  texto: string
  detalle: string | null
  objetoTipo: string | null
  objetoId: string | null
  enlace: string | null
  creadoEn: string
  leida: boolean
}

export type ResumenNotificaciones = {
  noLeidas: number
  ultimas: Notificacion[]
  porDecidir: number
}

// -----------------------------------------------------------------------------
// Tareas
// -----------------------------------------------------------------------------

export type EstadoTarea = 'abierta' | 'hecha' | 'cancelada'

export const ESTADO_TAREA: Record<EstadoTarea, string> = { abierta: 'Abierta', hecha: 'Hecha', cancelada: 'Cancelada' }

export type Tarea = {
  id: string
  titulo: string
  detalle: string | null
  objetoTipo: string | null
  objetoId: string | null
  objetoTitulo: string | null
  asignadaA: Persona
  creadaPor: Persona
  vence: string | null
  estado: EstadoTarea
  creadoEn: string
  cerradaEn: string | null
  mia: boolean
}

/** ¿Vencida? Abierta y con fecha anterior a hoy en Caracas. */
export function vencida(t: Pick<Tarea, 'estado' | 'vence'>, hoy = hoyCaracas()): boolean {
  return t.estado === 'abierta' && Boolean(t.vence) && (t.vence as string) < hoy
}

export function venceHoy(t: Pick<Tarea, 'estado' | 'vence'>, hoy = hoyCaracas()): boolean {
  return t.estado === 'abierta' && t.vence === hoy
}
