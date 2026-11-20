import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Regla } from './formato'

type Cliente = Awaited<ReturnType<typeof createClient>>

export type PasoVista = {
  id: string
  orden: number
  nombre: string
  accion: string
  hito: boolean
  ve_costos: boolean
  decision: string
  comentario: string | null
  decidido_por: string | null
  decidido_en: string | null
  aprobador_plaza_ref: string | null
  aprobador_perfil: string | null
  regla: Regla
}

export type SolicitudVista = {
  id: string
  estado: string
  paso_actual: number | null
  titulo: string
  creado_por: string | null
  creado_en: string
  cerrado_en: string | null
  pasos: PasoVista[]
}

export type ContextoFlujo = {
  solicitudes: SolicitudVista[]
  /** perfil → nombre */
  nombres: Record<string, string>
  /** plaza → «Cargo · Unidad» */
  plazas: Record<string, string>
  /** El paso que quien mira puede decidir ahora, si hay uno. */
  decidible: PasoVista | null
}

/** Nombres de perfiles: `profiles` solo lo lee su dueño, así que va por `flujo.nombres`. */
export async function nombresDe(supabase: Cliente, ids: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unicos = [...new Set(ids.filter((x): x is string => Boolean(x)))]
  if (!unicos.length) return {}
  const { data } = await supabase.schema('flujo').rpc('nombres', { p_ids: unicos })
  return Object.fromEntries((data ?? []).map((n) => [n.id, n.nombre]))
}

export async function plazasDe(supabase: Cliente, refs: (string | null | undefined)[]): Promise<Record<string, string>> {
  const unicos = [...new Set(refs.filter((x): x is string => Boolean(x)))]
  if (!unicos.length) return {}
  const { data } = await supabase.schema('org').rpc('describir_plazas', { p_refs: unicos })
  return Object.fromEntries((data ?? []).map((p) => [p.ref, p.unidad ? `${p.cargo} · ${p.unidad}` : p.cargo]))
}

/**
 * Todas las solicitudes de un objeto (la más reciente primero), con sus pasos,
 * los nombres y las plazas resueltas, y el paso que quien mira puede decidir.
 * Una requisición devuelta y reenviada tiene varias: se ven todas.
 */
export async function contextoFlujo(supabase: Cliente, tipo: string, objetoId: string): Promise<ContextoFlujo> {
  const { data: sols } = await supabase
    .schema('flujo')
    .from('solicitud')
    .select('id, estado, paso_actual, titulo, creado_por, creado_en, cerrado_en, paso(id, orden, nombre, accion, hito, ve_costos, decision, comentario, decidido_por, decidido_en, aprobador_plaza_ref, aprobador_perfil, regla)')
    .eq('tipo_objeto', tipo)
    .eq('objeto_id', objetoId)
    .order('creado_en', { ascending: false })

  const solicitudes: SolicitudVista[] = (sols ?? []).map((s) => ({
    id: s.id,
    estado: s.estado,
    paso_actual: s.paso_actual,
    titulo: s.titulo,
    creado_por: s.creado_por,
    creado_en: s.creado_en,
    cerrado_en: s.cerrado_en,
    pasos: ((s.paso ?? []) as unknown as PasoVista[]).slice().sort((a, b) => a.orden - b.orden),
  }))

  const pasos = solicitudes.flatMap((s) => s.pasos)
  const [nombres, plazas] = await Promise.all([
    nombresDe(supabase, [...solicitudes.map((s) => s.creado_por), ...pasos.map((p) => p.decidido_por), ...pasos.map((p) => p.aprobador_perfil)]),
    plazasDe(supabase, pasos.map((p) => p.aprobador_plaza_ref)),
  ])

  let decidible: PasoVista | null = null
  const viva = solicitudes.find((s) => s.estado === 'en_curso')
  const actual = viva?.pasos.find((p) => p.orden === viva.paso_actual && p.decision === 'pendiente')
  if (actual) {
    const { data } = await supabase.schema('flujo').rpc('puede_decidir', { p_paso: actual.id })
    if (data) decidible = actual
  }
  return { solicitudes, nombres, plazas, decidible }
}

/** Lo que necesita el formulario de requisición: la estructura de hoy y los catálogos. */
export async function datosFormularioRequisicion(supabase: Cliente, hoy: string) {
  const [{ data: filas }, { data: cargos }, { data: catalogo }] = await Promise.all([
    supabase.schema('org').rpc('estructura_al', { p_fecha: hoy }),
    supabase.schema('org').from('cargo').select('id, nombre').eq('activo', true).order('nombre'),
    supabase
      .schema('control')
      .from('catalogo')
      .select('tipo, clave, etiqueta')
      .in('tipo', ['origen_requisicion', 'tipo_nomina', 'familia_cargo'])
      .eq('activo', true)
      .order('orden'),
  ])
  const unidadesMap = new Map<string, { ref: string; nombre: string; padre_ref: string | null; orden: number }>()
  const plazas: { ref: string; unidad_ref: string; cargo_id: string; cargo: string; dotacion: number; ocupadas: number }[] = []
  for (const f of filas ?? []) {
    if (!unidadesMap.has(f.unidad_ref)) unidadesMap.set(f.unidad_ref, { ref: f.unidad_ref, nombre: f.unidad, padre_ref: f.padre_ref, orden: f.orden })
    if (f.plaza_ref && f.estado !== 'cerrada') {
      plazas.push({ ref: f.plaza_ref, unidad_ref: f.unidad_ref, cargo_id: f.cargo_id, cargo: f.cargo, dotacion: f.dotacion, ocupadas: f.ocupadas })
    }
  }
  const de = (tipo: string) => (catalogo ?? []).filter((c) => c.tipo === tipo).map((c) => ({ clave: c.clave, etiqueta: c.etiqueta }))
  return {
    unidades: [...unidadesMap.values()],
    plazas,
    cargos: cargos ?? [],
    origenes: de('origen_requisicion'),
    nominas: de('tipo_nomina'),
    familias: de('familia_cargo'),
  }
}
