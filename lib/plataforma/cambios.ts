import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import type { ResultadoAccionFicha } from '@/lib/plataforma/ficha-tipos'
import { mensajeDeError } from '@/components/sistema/organizacion/datos'

/**
 * Toda edición de la estructura pasa por aprobación (24-nov-2026, migración `cambios_con_aprobacion`). Las pantallas
 * no llaman más a `org.editar_plaza` y compañía: proponen el cambio, que va al «borrador de cambios» de quien lo hace
 * (`org.proponer_cambio`). La base lo simula junto con lo que ya había en el borrador contra la realidad de hoy y lo
 * deshace: si no cuadra, devuelve el mismo error de siempre. Entra a la realidad cuando se aprueba el lote.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

export type FuncionCambio =
  | 'crear_unidad'
  | 'editar_unidad'
  | 'cerrar_unidad'
  | 'crear_plaza'
  | 'editar_plaza'
  | 'cerrar_plaza'
  | 'asignar_ocupacion'
  | 'mover_ocupacion'
  | 'terminar_ocupacion'
  | 'crear_cargo'
  | 'editar_cargo'
  | 'fijar_costo_referencia'
  | 'crear_componente_costo'
  | 'editar_componente_costo'
  | 'retirar_componente_costo'
  | 'fijar_parametro'
  | 'aprobar_plan_dotacion'
  | 'editar_cruce'

export const AVISO_PROPUESTO = 'Quedó en tus cambios por aprobar'

export async function proponer(
  supabase: Cliente,
  funcion: FuncionCambio,
  args: Record<string, unknown>,
  descripcion: string,
  extra: { parche?: Record<string, unknown>; objeto?: string; ref?: string | null } = {}
): Promise<ResultadoAccionFicha> {
  const { data, error } = await supabase.schema('org').rpc('proponer_cambio', {
    p_funcion: funcion,
    p_args: args as never,
    p_descripcion: descripcion,
    p_parche: (extra.parche ?? null) as never,
    p_objeto: extra.objeto ?? undefined,
    p_objeto_ref: extra.ref ?? undefined,
  })
  if (error) return { error: mensajeDeError(error) }
  const n = (data as { cambios?: number } | null)?.cambios ?? 1
  return { ok: `${AVISO_PROPUESTO} (${n} en tu borrador). Entra a la realidad cuando lo aprueben: envíalo desde «Mis cambios».` }
}

// ── Descripciones legibles ──

export async function nombreUnidad(supabase: Cliente, ref: string | null | undefined): Promise<string> {
  if (!ref) return 'ninguna'
  const { data } = await supabase.schema('org').from('unidad').select('nombre').eq('ref', ref).is('escenario_id', null).order('vigencia', { ascending: false }).limit(1).maybeSingle()
  return data?.nombre ?? 'una unidad'
}

export async function nombrePlaza(supabase: Cliente, ref: string | null | undefined): Promise<string> {
  if (!ref) return 'nadie'
  const org = supabase.schema('org')
  const { data: p } = await org.from('plaza').select('cargo_id, unidad_ref').eq('ref', ref).is('escenario_id', null).order('vigencia', { ascending: false }).limit(1).maybeSingle()
  if (!p) return 'una plaza'
  const [{ data: c }, u] = await Promise.all([org.from('cargo').select('nombre').eq('id', p.cargo_id).maybeSingle(), nombreUnidad(supabase, p.unidad_ref)])
  return `${c?.nombre ?? 'Plaza'} · ${u}`
}

export async function nombreCargo(supabase: Cliente, id: string | null | undefined): Promise<string> {
  if (!id) return 'un cargo'
  const { data } = await supabase.schema('org').from('cargo').select('nombre').eq('id', id).maybeSingle()
  return data?.nombre ?? 'un cargo'
}

export async function nombrePersona(supabase: Cliente, empleado: string | null | undefined): Promise<string> {
  if (!empleado) return 'una persona'
  const { data } = await supabase.from('empleados').select('nombre_completo').eq('id', empleado).maybeSingle()
  return data?.nombre_completo ?? 'una persona'
}

const ETIQUETA: Record<string, string> = {
  nombre: 'nombre',
  tipo: 'tipo',
  padre_ref: 'depende de',
  sede: 'sede',
  codigo: 'código',
  certeza: 'certeza',
  dotacion: 'dotación',
  reporta_a_ref: 'reporta a',
  estado: 'estado',
  tipo_nomina: 'nómina',
  unidad_ref: 'unidad',
}

/** «dotación 1 → 2 · reporta a Director de Finanzas · Dirección de Finanzas». */
export async function describirParche(
  supabase: Cliente,
  antes: Record<string, unknown>,
  parche: Record<string, unknown>
): Promise<string> {
  const partes: string[] = []
  for (const [k, v] of Object.entries(parche)) {
    const etiqueta = ETIQUETA[k] ?? k
    const texto = async (x: unknown) =>
      k === 'padre_ref' || k === 'unidad_ref'
        ? nombreUnidad(supabase, x as string | null)
        : k === 'reporta_a_ref'
          ? nombrePlaza(supabase, x as string | null)
          : x === null || x === undefined || x === ''
            ? '—'
            : String(x)
    if (k === 'certeza') {
      partes.push('dato confirmado')
      continue
    }
    partes.push(`${etiqueta}: ${await texto(antes[k])} → ${await texto(v)}`)
  }
  return partes.join(' · ')
}
