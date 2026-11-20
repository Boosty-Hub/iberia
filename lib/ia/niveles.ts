/**
 * El lenguaje visual de la IA (Anexo E §7) y su vocabulario. Lo usan el
 * servidor y el navegador: sin `'use client'` ni `'use server'`.
 *
 * Reglas:
 *  · El icono nunca va solo: la insignia lleva siempre su texto («N2 ·
 *    Recomendación»).
 *  · Los colores de nivel no reutilizan los de estado (`TONO_CHIP`): además del
 *    tono, la insignia de nivel lleva borde y el ✦, que una pastilla de estado
 *    no lleva. N1 se distingue por el borde punteado.
 */

export type NivelIa = 'N0' | 'N1' | 'N2' | 'N3' | 'N4'

export const NIVELES_IA: Record<NivelIa, { nombre: string; corto: string; como: string; clase: string }> = {
  N0: { nombre: 'Apagada', corto: 'Sin IA', como: 'La capacidad no actúa: el módulo funciona sin IA.', clase: 'border border-[#d9dce1] bg-white text-marca-400' },
  N1: {
    nombre: 'Asistencia',
    corto: 'N1 · Asistencia',
    como: 'Responde, explica o señala cuando se le pide. «Generado con IA · verifícalo».',
    clase: 'border border-dashed border-[#9d93bd] bg-white text-[#4f4577]',
  },
  N2: {
    nombre: 'Recomendación',
    corto: 'N2 · Recomendación',
    como: 'Propone con su evidencia a la vista; una persona acepta, corrige o descarta una por una.',
    clase: 'border border-[#a9c4ec] bg-[#e3edfc] text-[#1d4f8f]',
  },
  N3: {
    nombre: 'Requiere aprobación',
    corto: 'N3 · Requiere aprobación',
    como: 'Prepara la acción completa y espera: Aprobar, Editar o Rechazar. Queda el nombre de quien decidió.',
    clase: 'border border-[#efc27f] bg-[#fdebd0] text-[#8f4a00]',
  },
  N4: {
    nombre: 'Automático',
    corto: 'N4 · Automático',
    como: 'Aplica sola solo metadatos internos y reversibles, con deshacer y registro obligatorio.',
    clase: 'border border-[#b9bfc8] bg-[#e9ebef] text-[#3f4650]',
  },
}

export const ETIQUETA_USO: Record<string, string> = { L: 'Leer', E: 'Explicar', P: 'Proponer', A: 'Avisar' }

export const ACCIONES_ACTIVIDAD: Record<string, string> = {
  respondio: 'Respondió',
  propuso: 'Propuso',
  explico: 'Explicó',
  aplico: 'Aplicó sola',
  decidio: 'Decisión de una persona',
  deshizo: 'Deshecho',
  pidio_nivel: 'Pidió subir de nivel',
  cambio_nivel: 'Cambio de nivel',
  encendio: 'Encendió',
  apago: 'Apagó',
  interruptor: 'Interruptor general',
  tope: 'Tope de gasto',
  bloqueo: 'Bloqueada',
  error: 'Error',
}

export const ESTADOS_PROPUESTA: Record<string, string> = {
  pendiente: 'Pendiente',
  aceptada: 'Aceptada',
  editada: 'Aceptada con cambios',
  rechazada: 'Rechazada',
  revertida: 'Deshecha',
  expirada: 'Ya no aplica',
}

/** La columna de la tabla de plazas donde va la marca de cada regla. */
export const COLUMNA_DE_REGLA: Record<string, string> = { exceso: 'exceso', sin_titular: 'vacantes', inferida: 'certeza' }

/** Lo que el navegador necesita de una propuesta para pintarla. */
export type PropuestaVista = {
  id: string
  capacidad: string
  regla: string
  objeto_tipo: string
  objeto_id: string
  nivel: NivelIa
  titulo: string
  cuerpo: string
  explicacion: string | null
  evidencia: { tipo?: string; id?: string | null; campo?: string; valor?: unknown; fuente?: string }[]
  payload: Record<string, unknown>
  estado: string
  creado_en: string
  decidido_por: string | null
  decidido_en: string | null
  motivo: string | null
  deshacer_hasta: string | null
}

export type EstadoIa = {
  general: boolean
  sin_presupuesto: boolean
  tope_diario_usd: number | null
  gastado_hoy_usd: number | null
  capacidades: Record<string, { nivel: NivelIa; techo: NivelIa; encendida: boolean }>
}

/** ¿Está viva la capacidad para quien mira? (interruptor general, la suya y nivel). */
export function capacidadViva(estado: EstadoIa | null, codigo: string): boolean {
  if (!estado?.general) return false
  const c = estado.capacidades[codigo]
  return Boolean(c?.encendida && c.nivel !== 'N0')
}

/** Una marca ⚑ en una celda de la tabla. */
export type MarcaCelda = { texto: string; nivel: NivelIa; n?: number }

/** ¿Sigue abierta una ventana (deshacer) que cierra en `iso`? */
export function sigueAbierta(iso: string | null | undefined): boolean {
  return Boolean(iso) && new Date(iso as string).getTime() > Date.now()
}

/** El instante de hace `ms` milisegundos, en ISO. */
export function instanteHace(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}
