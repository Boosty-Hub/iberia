import 'server-only'
import { cache } from 'react'
import { esEditor, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { EstadoFase, EstadoHito } from '@/lib/plataforma/hoja-de-ruta-vocabulario'

/**
 * La hoja de ruta de la plataforma (PRG-PLN · Hoja de ruta): las fases, los
 * hitos, lo que falta y las decisiones abiertas, leídos de `control.*` con la
 * RLS de quien mira (migración `20261121090000_hoja_de_ruta.sql`). **El plan es
 * dato**: la carpeta del plan está fuera de git y no se lee desde aquí.
 *
 * ⚠️ Lo lee Iberia (Alberto es administrador): nada de dinero, nada de régimen
 * contractual y nada de alarmas. Lo «solo equipo» —las decisiones «para
 * Gabriel», los pendientes internos y la nota interna de cada hito— solo llega
 * al equipo de Boosty: la base lo filtra y la pantalla tampoco lo pide.
 */

export type Fase = {
  id: string
  clave: string
  orden: number
  nombre: string
  periodo_texto: string | null
  inicio: string | null
  fin: string | null
  estado: EstadoFase
  contiene: string | null
  criterio_salida: string | null
  contratada: boolean
  actual: boolean
  situacion: string | null
}

export type Hito = {
  id: string
  clave: string
  fase: string | null
  titulo: string
  fecha: string | null
  estado: EstadoHito
  dueno: string | null
  orden: number
  /** Solo para el equipo de Boosty (`control.notas_hitos()`). */
  nota_interna: string | null
}

export type Decision = {
  id: string
  codigo: string
  pregunta: string
  opciones: string | null
  opcion_por_defecto: string | null
  antes_de: string | null
  fecha_limite: string | null
  estado: 'abierta' | 'decidida'
  decision: string | null
  decidida_en: string | null
}

/**
 * ¿Es del equipo de Boosty? No basta `esEditor`: el administrador de Iberia
 * también lo es. Con «ver como» se ve lo que ve el rol previsualizado: nada
 * interno. La base lo vuelve a preguntar (`privado.es_equipo_boosty()`).
 */
export function esEquipoBoosty(sesion: Sesion): boolean {
  return esEditor(sesion.perfil) && sesion.perfil.organizacion === 'boosty' && !sesion.vistaComo
}

export const leerFases = cache(async (): Promise<Fase[]> => {
  const supabase = await createClient()
  const { data } = await supabase
    .schema('control')
    .from('fase_plataforma')
    .select('id, clave, orden, nombre, periodo_texto, inicio, fin, estado, contiene, criterio_salida, contratada, actual, situacion')
    .order('orden')
  return (data ?? []) as Fase[]
})

export const leerHitos = cache(async (equipo: boolean): Promise<Hito[]> => {
  const supabase = await createClient()
  const [{ data }, notas] = await Promise.all([
    supabase.schema('control').from('hito_plataforma').select('id, clave, fase, titulo, fecha, estado, dueno, orden').order('fecha', { nullsFirst: false }).order('orden'),
    equipo ? supabase.schema('control').rpc('notas_hitos') : Promise.resolve({ data: [] as { id: string; nota_interna: string }[] }),
  ])
  const mapa = new Map(((notas.data ?? []) as { id: string; nota_interna: string }[]).map((n) => [n.id, n.nota_interna]))
  return ((data ?? []) as Omit<Hito, 'nota_interna'>[]).map((h) => ({ ...h, nota_interna: mapa.get(h.id) ?? null }))
})

/** Las decisiones «para Gabriel»: a quien no es del equipo ni se le piden. */
export async function leerDecisiones(sesion: Sesion): Promise<Decision[]> {
  if (!esEquipoBoosty(sesion)) return []
  const supabase = await createClient()
  const { data } = await supabase
    .schema('control')
    .from('decision_plataforma')
    .select('id, codigo, pregunta, opciones, opcion_por_defecto, antes_de, fecha_limite, estado, decision, decidida_en')
    .order('orden')
  return (data ?? []) as Decision[]
}
