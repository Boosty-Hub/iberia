import type { TonoCelda } from '@/lib/plataforma/tabla'

/**
 * El vocabulario de la hoja de ruta (PRG-PLN). Las claves espejan los `CHECK`
 * de la migración `20261121090000_hoja_de_ruta.sql`; los valores son lo que se
 * lee en pantalla. Sin `'use client'` ni `'use server'`: lo usan las fuentes de
 * tabla, las páginas y los componentes.
 */

export type EstadoFase = 'hecho' | 'en_curso' | 'proximo' | 'planificado'
export type EstadoHito = 'pendiente' | 'hecho' | 'cancelado'
export type DuenoTipo = 'iberia' | 'gabriel' | 'boosty'

/** El color va siempre con su rótulo (y en la línea de fases, con su trazo): nunca solo. */
export const ESTADO_FASE: Record<EstadoFase, { etiqueta: string; tono: TonoCelda; color: string }> = {
  hecho: { etiqueta: 'Hecho', tono: 'verde', color: '#1f8a5b' },
  en_curso: { etiqueta: 'En curso', tono: 'ambar', color: '#b7791f' },
  proximo: { etiqueta: 'Próximo', tono: 'azul', color: '#2f5f9a' },
  planificado: { etiqueta: 'Planificado', tono: 'neutro', color: '#8d8785' },
}

export const ESTADO_HITO: Record<EstadoHito, { etiqueta: string; tono: TonoCelda }> = {
  pendiente: { etiqueta: 'Por cumplir', tono: 'neutro' },
  hecho: { etiqueta: 'Cumplido', tono: 'verde' },
  cancelado: { etiqueta: 'Cancelado', tono: 'neutro' },
}

export const DUENO_TIPO_ETIQUETA: Record<DuenoTipo, string> = { iberia: 'Iberia', gabriel: 'Gabriel', boosty: 'Boosty' }
export const ESTADO_PENDIENTE_ETIQUETA: Record<string, string> = { abierto: 'Abierto', resuelto: 'Resuelto' }
export const ESTADO_DECISION_ETIQUETA: Record<string, string> = { abierta: 'Abierta', decidida: 'Decidida' }
