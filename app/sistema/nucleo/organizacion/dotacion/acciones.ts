'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fmtFecha, hoyCaracas, mensajeDeError } from '@/components/sistema/organizacion/datos'
import type { Estado } from '@/components/sistema/organizacion/formulario'

/**
 * Plan de dotación (`sistema:dotacion`) y costos (`sistema:costos`, perímetro de
 * nómina). Lo versionado pasa por las funciones de la base, que cierran la
 * versión que rige y abren la nueva con su fecha.
 */

const RUTA = '/sistema/nucleo/organizacion/dotacion'

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
const desde = (f: string) => (f === hoyCaracas() ? 'desde hoy' : `desde el ${fmtFecha(f)}`)

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
  const { error } = await supabase.schema('org').rpc('aprobar_plan_dotacion', { p_plan: texto(fd, 'plan') })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: 'Plan aprobado y congelado. Si hay una versión anterior aprobada del mismo año, quedó reemplazada.' }
}

// -----------------------------------------------------------------------------
// Costos · perímetro de nómina
// -----------------------------------------------------------------------------

export async function fijarTasa(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const fecha = texto(fd, 'fecha')
  const valor = numero(fd, 'valor')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Indica la fecha de la tasa.' }
  if (fecha > hoyCaracas()) return { error: 'La tasa es la de un día que ya ocurrió: no se carga a futuro.' }
  if (!valor || valor <= 0) return { error: 'Escribe la tasa en bolívares por dólar, mayor que cero.' }
  const supabase = await createClient()
  const { error } = await supabase
    .schema('org')
    .from('tasa_cambio')
    .upsert({ fecha, ves_por_usd: valor, fuente: texto(fd, 'fuente') || 'BCV' }, { onConflict: 'fecha' })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `Tasa del ${fmtFecha(fecha)} guardada.` }
}

export async function fijarCostoReferencia(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  const salario = numero(fd, 'salario')
  if (salario === null) return { error: 'Escribe el salario de referencia del cargo.' }
  const { error } = await supabase.schema('org').rpc('fijar_costo_referencia', {
    p_cargo: texto(fd, 'cargo'),
    p_salario: salario,
    p_moneda: texto(fd, 'moneda') || 'VES',
    p_bonos_usd: numero(fd, 'bonos') ?? 0,
    p_fecha: fecha,
    p_fuente: texto(fd, 'fuente'),
  })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `Costo de referencia guardado; rige ${desde(fecha)}.` }
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
    p_fecha: texto(fd, 'fecha'),
    p_nota: texto(fd, 'nota'),
  }
}

export async function editarComponente(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const c = camposComponente(fd)
  const { error } = await supabase.schema('org').rpc('editar_componente_costo', { p_id: texto(fd, 'id'), ...c })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `Guardado: la versión nueva rige ${desde(c.p_fecha)}.` }
}

export async function crearComponente(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const c = camposComponente(fd)
  const { error } = await supabase.schema('org').rpc('crear_componente_costo', { p_nombre: texto(fd, 'nombre'), ...c })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `Componente creado; rige ${desde(c.p_fecha)}.` }
}

export async function retirarComponente(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla para confirmar.' }
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  const { error } = await supabase.schema('org').rpc('retirar_componente_costo', { p_id: texto(fd, 'id'), p_fecha: fecha })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `El componente deja de aplicar ${desde(fecha)}.` }
}

export async function fijarParametro(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:costos', 'editar')
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  const { error } = await supabase.schema('org').rpc('fijar_parametro', {
    p_clave: texto(fd, 'clave'),
    p_valor: numero(fd, 'valor') as number,
    p_fecha: fecha,
    p_fuente: texto(fd, 'fuente'),
    p_por_confirmar: fd.get('por_confirmar') === 'on',
  })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(RUTA)
  return { ok: `Parámetro guardado; rige ${desde(fecha)}.` }
}
