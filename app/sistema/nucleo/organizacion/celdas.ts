'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hoyCaracas } from '@/lib/plataforma/formato'
import { aNumero, dotacionEnEscenario, editarCargo, editarComponente, editarPlaza, fijarCostoCargo } from '@/lib/plataforma/fichas/organizacion-acciones'
import { proponer } from '@/lib/plataforma/cambios'
import { mensajeDeError } from '@/components/sistema/organizacion/datos'

/**
 * La edición en la celda de las tablas de Organización. Rige desde hoy (en la
 * ficha se elige la fecha) y va por las mismas funciones de la base que la
 * ficha: lo publicado no se corrige en el sitio. Solo funciones async.
 */

type Resultado = { error?: string; ok?: string } | void
const RUTA = '/sistema/nucleo/organizacion'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function listo(r: { error?: string; ok?: string }, ruta = RUTA): Resultado {
  if (r.error) return { error: r.error }
  revalidatePath(ruta, 'layout')
  return { ok: r.ok }
}

/** Plazas: la dotación (en la realidad o, con `?esc=`, dentro del escenario) y el tipo de nómina. */
export async function editarCeldaPlaza(esc: string | null, ref: string, columna: string, valor: string): Promise<Resultado> {
  const sesion = await requerirSesion()
  if (!UUID.test(ref)) return { error: 'Plaza no válida.' }
  const supabase = await createClient()
  if (columna === 'dotacion') {
    const n = Number.parseInt(valor, 10)
    if (!Number.isInteger(n) || n < 0 || n > 999) return { error: 'La dotación es un número entero.' }
    if (esc) {
      if (!puede(sesion, 'sistema:escenarios', 'editar')) return { error: 'Tu rol no puede editar escenarios.' }
      return listo(await dotacionEnEscenario(supabase, esc, ref, n))
    }
    if (!puede(sesion, 'sistema:estructura', 'editar')) return { error: 'Tu rol no puede editar la estructura.' }
    if (n < 1) return { error: 'La dotación es de al menos 1. Para quitar la plaza, ciérrala desde su ficha.' }
    return listo(await editarPlaza(supabase, ref, hoyCaracas(), { dotacion: n }))
  }
  if (columna === 'tipo_nomina') {
    if (esc) return { error: 'En un escenario, la nómina se cambia desde el lienzo.' }
    if (!puede(sesion, 'sistema:estructura', 'editar')) return { error: 'Tu rol no puede editar la estructura.' }
    return listo(await editarPlaza(supabase, ref, hoyCaracas(), { tipo_nomina: valor || null }))
  }
  return { error: 'Esa columna no se edita.' }
}

/** Cargos: el catálogo se edita directo, con auditoría. */
export async function editarCeldaCargo(id: string, columna: string, valor: string): Promise<Resultado> {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'sistema:estructura', 'editar')) return { error: 'Tu rol no puede editar el catálogo de cargos.' }
  if (!UUID.test(id) || !['nombre', 'familia', 'nivel', 'sinonimos', 'activo'].includes(columna)) return { error: 'Esa columna no se edita.' }
  const supabase = await createClient()
  return listo(await editarCargo(supabase, id, columna, valor))
}

/** Dotación: una línea del plan en borrador (unidad:cargo). */
export async function editarCeldaPlan(plan: string, clave: string, columna: string, valor: string): Promise<Resultado> {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'sistema:dotacion', 'editar')) return { error: 'Tu rol no puede editar el plan de dotación.' }
  if (columna !== 'plan_borrador') return { error: 'Esa columna no se edita.' }
  const [unidad, cargo] = clave.split(':')
  if (!UUID.test(plan) || !UUID.test(unidad ?? '') || !UUID.test(cargo ?? '')) return { error: 'Línea no válida.' }
  const n = Number.parseInt(valor, 10)
  if (!Number.isInteger(n) || n < 0 || n > 9999) return { error: 'La cantidad es un número entero, de cero en adelante.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('org').rpc('guardar_lineas_plan', { p_plan: plan, p_lineas: [{ unidad_ref: unidad, cargo_id: cargo, cantidad: n }] })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath(`${RUTA}/dotacion`)
}

/** Costos 🔒: el costo de referencia de un cargo (rige desde hoy). */
export async function editarCeldaCosto(cargo: string, columna: string, valor: string): Promise<Resultado> {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'sistema:costos', 'editar')) return { error: 'Tu rol no puede editar costos.' }
  if (!UUID.test(cargo)) return { error: 'Cargo no válido.' }
  const supabase = await createClient()
  const hoy = hoyCaracas()
  if (columna === 'moneda') return listo(await fijarCostoCargo(supabase, cargo, hoy, { moneda: valor === 'USD' ? 'USD' : 'VES' }), `${RUTA}/costos`)
  const n = aNumero(valor)
  if (n === null || n < 0) return { error: 'Escribe un monto positivo (por ejemplo, 1.250,00).' }
  if (columna === 'salario') return listo(await fijarCostoCargo(supabase, cargo, hoy, { salario: n }), `${RUTA}/costos`)
  if (columna === 'bonos_usd') return listo(await fijarCostoCargo(supabase, cargo, hoy, { bonos: n }), `${RUTA}/costos`)
  return { error: 'Esa columna no se edita.' }
}

/** Costos 🔒: un componente (valor, base legal, por confirmar). La versión nueva rige desde hoy. */
export async function editarCeldaComponente(id: string, columna: string, valor: string): Promise<Resultado> {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'sistema:costos', 'editar')) return { error: 'Tu rol no puede editar costos.' }
  if (!UUID.test(id)) return { error: 'Componente no válido.' }
  const supabase = await createClient()
  const hoy = hoyCaracas()
  if (columna === 'valor') {
    const n = aNumero(valor)
    if (n === null || n < 0) return { error: 'Escribe un valor positivo.' }
    return listo(await editarComponente(supabase, id, hoy, { valor: n }), `${RUTA}/costos`)
  }
  if (columna === 'base_legal') return listo(await editarComponente(supabase, id, hoy, { base_legal: valor.trim() }), `${RUTA}/costos`)
  if (columna === 'por_confirmar') return listo(await editarComponente(supabase, id, hoy, { por_confirmar: valor !== 'no' }), `${RUTA}/costos`)
  return { error: 'Esa columna no se edita.' }
}

/** Costos 🔒: un parámetro (salario mínimo, ingreso mínimo integral…), rige desde la fecha. */
export async function fijarParametro(clave: string, valor: string, fecha: string, porConfirmar: boolean): Promise<{ error?: string; ok?: string }> {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'sistema:costos', 'editar')) return { error: 'Tu rol no puede editar los parámetros de costo.' }
  const n = aNumero(valor)
  if (n === null || n < 0) return { error: 'Escribe un valor positivo.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Indica desde qué fecha rige.' }
  const supabase = await createClient()
  const r = await proponer(supabase, 'fijar_parametro', { p_clave: clave, p_valor: n, p_fuente: 'Edición en la plataforma', p_por_confirmar: porConfirmar }, `🔒 Parámetro de costo «${clave}» → ${n}${porConfirmar ? ' (por confirmar)' : ''}`, { objeto: 'parametro' })
  if (r.error) return { error: r.error }
  revalidatePath(`${RUTA}/costos`)
  return { ok: r.ok }
}
