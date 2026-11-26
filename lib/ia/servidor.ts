import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { EstadoIa, NivelIa, PropuestaVista } from '@/lib/ia/niveles'

/**
 * Lecturas de la IA con la sesión de quien mira (RLS de `ia`): el estado de
 * los interruptores, las propuestas de un objeto y las capacidades que aplican
 * a un tipo de ficha. Solo servidor.
 */

export const estadoIa = cache(async (): Promise<EstadoIa | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('ia').rpc('estado')
  if (error || !data) return null
  return data as unknown as EstadoIa
})

export const COLUMNAS_PROPUESTA =
  'id, capacidad, regla, objeto_tipo, objeto_id, nivel, titulo, cuerpo, explicacion, evidencia, payload, estado, creado_en, decidido_por, decidido_en, motivo, deshacer_hasta'

export async function propuestasDeObjeto(tipo: string, id: string): Promise<PropuestaVista[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('ia')
    .from('propuesta')
    .select(COLUMNAS_PROPUESTA)
    .eq('objeto_tipo', tipo)
    .eq('objeto_id', id)
    .order('creado_en', { ascending: false })
    .range(0, 29)
  return (data ?? []) as unknown as PropuestaVista[]
}

export type CapacidadVista = {
  codigo: string
  modulo: string
  nombre: string
  que_hace: string
  uso: string
  nivel_actual: NivelIa
  techo: NivelIa
  dueno_cargo: string
  encendida: boolean
  evidencia_para_subir: string | null
  objeto_tipos: string[]
  nota: string | null
  /** La capacidad que la resolvió (las que solo respondían preguntas: el asistente, NUC-ASI-IA-01). */
  absorbida_por: string | null
}

export const catalogoIa = cache(async (): Promise<CapacidadVista[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('ia')
    .from('capacidad')
    .select('codigo, modulo, nombre, que_hace, uso, nivel_actual, techo, dueno_cargo, encendida, evidencia_para_subir, objeto_tipos, nota, absorbida_por')
    .order('modulo')
    .order('codigo')
  return (data ?? []) as CapacidadVista[]
})

/** Los nombres de unas personas (autores de decisiones), sin leer `profiles`. */
export async function nombresDe(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  if (!unicos.length) return new Map()
  const supabase = await createClient()
  const { data } = await supabase.schema('nucleo').rpc('nombres', { p_ids: unicos })
  return new Map((data ?? []).map((n) => [n.id, n.nombre]))
}
