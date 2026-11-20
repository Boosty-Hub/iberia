'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { esFecha } from '@/lib/plataforma/formato'
import { ESTADO_MODULO } from '@/lib/plataforma/dominios'
import { ESTADO_FASE, ESTADO_HITO } from '@/lib/plataforma/hoja-de-ruta-vocabulario'

/**
 * Lo que se edita de la hoja de ruta (PRG-PLN): el estado de una fase, el estado
 * y la fecha de un hito, resolver o reabrir un pendiente, el estado de un módulo
 * y la decisión de una G-xx. Cada acción vuelve a pedir `modulo:programa` ·
 * editar, y la base lo pregunta otra vez (RLS por columna); lo «solo equipo» ni
 * se encuentra si quien escribe no es del equipo de Boosty. Todo queda en la
 * auditoría. Solo funciones async (`'use server'`).
 */

type Resultado = { error?: string } | void
const RUTA = '/sistema/programa/hoja-de-ruta'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function sesionQueEdita() {
  const sesion = await requerirSesion()
  return puede(sesion, 'modulo:programa', 'editar') ? sesion : null
}

function texto(fd: FormData, k: string): string {
  const v = fd.get(k)
  return typeof v === 'string' ? v.trim() : ''
}

/** Vuelve a la hoja de ruta con un aviso (los formularios no tienen estado de cliente). */
function volver(aviso: string, ancla = ''): never {
  redirect(`${RUTA}?aviso=${aviso}${ancla}`)
}

/** «Lo que falta», en la celda: resolver o reabrir. */
export async function editarCeldaPendiente(id: string, columna: string, valor: string): Promise<Resultado> {
  if (!(await sesionQueEdita())) return { error: 'Tu rol no actualiza la hoja de ruta.' }
  if (!UUID.test(id) || columna !== 'estado') return { error: 'Esa columna no se edita.' }
  if (!['abierto', 'resuelto'].includes(valor)) return { error: 'Ese estado no existe.' }
  const supabase = await createClient()
  // La fecha de resolución la pone la base al resolver (y la borra al reabrir).
  const { data, error } = await supabase.schema('control').from('pendiente_plataforma').update({ estado: valor }).eq('id', id).select('id')
  if (error) return { error: 'No se pudo guardar.' }
  if (!data?.length) return { error: 'No se guardó: tu sesión no puede cambiar ese pendiente.' }
  revalidatePath('/sistema', 'layout')
}

/** Módulos del plan, en la celda: el estado. */
export async function editarCeldaModulo(codigo: string, columna: string, valor: string): Promise<Resultado> {
  if (!(await sesionQueEdita())) return { error: 'Tu rol no actualiza la hoja de ruta.' }
  if (!/^[A-Z]{3}-[A-Z]{2,4}$/.test(codigo) || columna !== 'estado') return { error: 'Esa columna no se edita.' }
  if (!(valor in ESTADO_MODULO)) return { error: 'Ese estado no existe.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('control').from('modulo').update({ estado: valor }).eq('codigo', codigo).select('codigo')
  if (error) return { error: 'No se pudo guardar.' }
  if (!data?.length) return { error: 'No se guardó: tu sesión no puede cambiar ese módulo.' }
  revalidatePath('/sistema', 'layout')
}

/** Una fase: su estado. */
export async function actualizarFase(fd: FormData): Promise<void> {
  if (!(await sesionQueEdita())) volver('sin-permiso')
  const id = texto(fd, 'id')
  const estado = texto(fd, 'estado')
  if (!UUID.test(id) || !(estado in ESTADO_FASE)) volver('dato-invalido', '#fases')
  const supabase = await createClient()
  const { data, error } = await supabase.schema('control').from('fase_plataforma').update({ estado }).eq('id', id).select('id')
  if (error || !data?.length) volver('no-guardado', '#fases')
  revalidatePath(RUTA)
  volver('guardado', '#fases')
}

/** Un hito: su estado y su fecha. */
export async function actualizarHito(fd: FormData): Promise<void> {
  if (!(await sesionQueEdita())) volver('sin-permiso')
  const id = texto(fd, 'id')
  const estado = texto(fd, 'estado')
  const fecha = texto(fd, 'fecha')
  if (!UUID.test(id) || !(estado in ESTADO_HITO) || (fecha && !esFecha(fecha))) volver('dato-invalido', '#hitos')
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('control')
    .from('hito_plataforma')
    .update({ estado, fecha: fecha || null })
    .eq('id', id)
    .select('id')
  if (error || !data?.length) volver('no-guardado', '#hitos')
  revalidatePath('/sistema', 'layout')
  volver('guardado', '#hitos')
}

/** Una decisión «para Gabriel»: abierta o decidida, con lo que se decidió. */
export async function registrarDecision(fd: FormData): Promise<void> {
  if (!(await sesionQueEdita())) volver('sin-permiso')
  const id = texto(fd, 'id')
  const estado = texto(fd, 'estado')
  const decision = texto(fd, 'decision').slice(0, 1000)
  if (!UUID.test(id) || !['abierta', 'decidida'].includes(estado)) volver('dato-invalido', '#decisiones')
  if (estado === 'decidida' && !decision) volver('falta-decision', '#decisiones')
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('control')
    .from('decision_plataforma')
    .update({ estado, decision: decision || null })
    .eq('id', id)
    .select('id')
  if (error || !data?.length) volver('no-guardado', '#decisiones')
  revalidatePath(RUTA)
  volver('guardado', '#decisiones')
}
