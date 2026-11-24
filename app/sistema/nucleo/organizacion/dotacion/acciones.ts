'use server'

import { nombreCargo, proponer } from '@/lib/plataforma/cambios'
import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { mensajeDeError } from '@/components/sistema/organizacion/datos'
import type { Estado } from '@/components/sistema/organizacion/formulario'

/**
 * Plan de dotación (`sistema:dotacion`) y costos (`sistema:costos`, perímetro de
 * nómina). Lo versionado pasa por las funciones de la base, que cierran la
 * versión que rige y abren la nueva con su fecha.
 */

const RUTA = '/sistema/nucleo/organizacion/dotacion'
const COSTOS = '/sistema/nucleo/organizacion/costos'

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}
/** Acepta «1234.5» del campo numérico y «1.234,5» escrito a mano. */
function numero(fd: FormData, campo: string): number | null {
  let s = texto(fd, campo).replace(/\s/g, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// -----------------------------------------------------------------------------
// Plan de dotación
// -----------------------------------------------------------------------------

export async function nuevoPlan(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:dotacion', 'editar')
  const supabase = await createClient()
  const anio = Number.parseInt(texto(fd, 'anio'), 10)
  const { error } = await supabase.schema('org').rpc('nuevo_plan_dotacion', { p_anio: anio, p_nota: texto(fd, 'nota') })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `Versión en borrador del plan ${anio} abierta. Ajusta las cantidades y apruébala.` }
}

export async function guardarLineas(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:dotacion', 'editar')
  const supabase = await createClient()
  const plan = texto(fd, 'plan')
  const lineas: { unidad_ref: string; cargo_id: string; cantidad: number }[] = []
  for (const [k, v] of fd.entries()) {
    const m = k.match(/^l__([0-9a-f-]{36})__([0-9a-f-]{36})$/)
    if (!m || typeof v !== 'string' || v.trim() === '') continue
    const n = Number.parseInt(v, 10)
    if (!Number.isFinite(n) || n < 0) return { error: 'Las cantidades son números enteros, de cero en adelante.' }
    lineas.push({ unidad_ref: m[1], cargo_id: m[2], cantidad: n })
  }
  // Una línea nueva, si se llenó.
  const nu = texto(fd, 'nueva_unidad')
  const nc = texto(fd, 'nuevo_cargo')
  const ncant = texto(fd, 'nueva_cantidad')
  if (nu || nc || ncant) {
    if (!nu || !nc || ncant === '') return { error: 'Para agregar una línea, elige unidad, cargo y cantidad.' }
    lineas.push({ unidad_ref: nu, cargo_id: nc, cantidad: Number.parseInt(ncant, 10) || 0 })
  }
  const { data, error } = await supabase.schema('org').rpc('guardar_lineas_plan', { p_plan: plan, p_lineas: lineas })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `Guardado (${data ?? 0} líneas).` }
}

export async function aprobarPlan(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:dotacion', 'editar')
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla: una versión aprobada queda congelada.' }
  const supabase = await createClient()
  const plan = texto(fd, 'plan')
  const { data: pl } = await supabase.schema('org').from('plan_dotacion').select('anio, version').eq('id', plan).maybeSingle()
  const r = await proponer(supabase, 'aprobar_plan_dotacion', { p_plan: plan }, `Aprobar el plan de dotación ${pl?.anio ?? ''}${pl?.version ? ` (versión ${pl.version})` : ''}`, { objeto: 'plan_dotacion', ref: plan })
  revalidatePath(RUTA)
  return r.error ? { error: r.error } : { ok: r.ok }
}

// -----------------------------------------------------------------------------
// Costos · perímetro de nómina
// -----------------------------------------------------------------------------

export async function fijarCostoReferencia(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  const salario = numero(fd, 'salario')
  if (salario === null) return { error: 'Escribe el salario de referencia del cargo.' }
  void fecha
  const cargo = texto(fd, 'cargo')
  const moneda = texto(fd, 'moneda') || 'VES'
  const bonos = numero(fd, 'bonos') ?? 0
  const r = await proponer(
    supabase,
    'fijar_costo_referencia',
    { p_cargo: cargo, p_salario: salario, p_moneda: moneda, p_bonos_usd: bonos, p_fuente: texto(fd, 'fuente') },
    `🔒 Costo de referencia de «${await nombreCargo(supabase, cargo)}»: ${salario} ${moneda} y ${bonos} USD en bonos`,
    { objeto: 'cargo', ref: cargo }
  )
  revalidatePath(COSTOS)
  return r.error ? { error: r.error } : { ok: r.ok }
}

function camposComponente(fd: FormData) {
  return {
    p_forma: texto(fd, 'forma'),
    p_valor: numero(fd, 'valor') ?? 0,
    p_base: texto(fd, 'base'),
    p_tope: numero(fd, 'tope') as number,
    p_piso: texto(fd, 'piso'),
    p_moneda: texto(fd, 'moneda'),
    p_aplica_a: texto(fd, 'aplica_a') || 'todos',
    p_base_legal: texto(fd, 'base_legal'),
    p_fuente: texto(fd, 'fuente'),
    p_por_confirmar: fd.get('por_confirmar') === 'on',
    p_nota: texto(fd, 'nota'),
  }
}

export async function editarComponente(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const c = camposComponente(fd)
  const id = texto(fd, 'id')
  const { data: x } = await supabase.schema('org').from('componente_costo').select('nombre').eq('id', id).maybeSingle()
  const r = await proponer(supabase, 'editar_componente_costo', { p_id: id, ...c }, `🔒 Componente de costo «${x?.nombre ?? ''}»: ${c.p_forma} ${c.p_valor}`, { objeto: 'componente_costo', ref: id })
  revalidatePath(COSTOS)
  return r.error ? { error: r.error } : { ok: r.ok }
}

export async function crearComponente(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const c = camposComponente(fd)
  const r = await proponer(supabase, 'crear_componente_costo', { p_nombre: texto(fd, 'nombre'), ...c }, `🔒 Componente de costo nuevo «${texto(fd, 'nombre')}»: ${c.p_forma} ${c.p_valor}`, { objeto: 'componente_costo' })
  revalidatePath(COSTOS)
  return r.error ? { error: r.error } : { ok: r.ok }
}

export async function retirarComponente(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla para confirmar.' }
  const supabase = await createClient()
  const id = texto(fd, 'id')
  const { data: x } = await supabase.schema('org').from('componente_costo').select('nombre').eq('id', id).maybeSingle()
  const r = await proponer(supabase, 'retirar_componente_costo', { p_id: id }, `🔒 Retirar el componente de costo «${x?.nombre ?? ''}»`, { objeto: 'componente_costo', ref: id })
  revalidatePath(COSTOS)
  return r.error ? { error: r.error } : { ok: r.ok }
}

export async function fijarParametro(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const clave = texto(fd, 'clave')
  const valor = numero(fd, 'valor') as number
  const r = await proponer(
    supabase,
    'fijar_parametro',
    { p_clave: clave, p_valor: valor, p_fuente: texto(fd, 'fuente'), p_por_confirmar: fd.get('por_confirmar') === 'on' },
    `🔒 Parámetro de costo «${clave}» → ${valor}`,
    { objeto: 'parametro' }
  )
  revalidatePath(COSTOS)
  return r.error ? { error: r.error } : { ok: r.ok }
}
