'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { crearHijo } from '@/lib/plataforma/fichas/procesos'

/**
 * Acciones de las tablas de Procesos (R2). Lo que se edita en la ficha va por
 * `ejecutarAccionFicha` → `manejarProceso` (lib/plataforma/fichas/procesos.ts):
 * abrir el borrador, cambiarlo, enviarlo, moverlo, crear un hijo. Aquí queda lo
 * que se hace desde una fila. Cada acción vuelve a pedir su permiso: el botón
 * escondido no protege nada. Solo funciones async.
 */

export type EstadoAccion = { error?: string; ok?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Las acciones de fila del catálogo que piden un texto: hoy, «＋ Hijo». Devuelve la ficha del nuevo. */
export async function accionFilaCatalogo(clave: string, accion: string, texto: string): Promise<{ error?: string; ficha?: string | null }> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (accion !== 'hijo') return { error: 'Acción no reconocida.' }
  if (!puede(sesion, 'sistema:procesos', 'crear')) return { error: 'No tienes permiso para crear procesos.' }
  if (!UUID.test(clave)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const r = await crearHijo(supabase, clave, texto)
  if (r.error) return { error: r.error }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  return { ficha: r.ficha ?? null }
}

const TIPOS_CRUCE = new Set(['equivalente', 'contiene', 'parcial', 'sin_par'])

/** El cruce SGC ↔ informe, editado en la celda: tipo, confirmado y nota. Directo, con auditoría. */
export async function editarCeldaCruce(clave: string, columna: string, valor: string): Promise<{ error?: string }> {
  await requerirPermiso('sistema:procesos', 'editar')
  if (!UUID.test(clave)) return { error: 'Cruce no válido.' }
  let cambio: { tipo?: string; confirmado?: boolean; nota?: string | null }
  if (columna === 'tipo') {
    if (!TIPOS_CRUCE.has(valor)) return { error: 'Tipo de cruce no válido.' }
    cambio = { tipo: valor }
  } else if (columna === 'confirmado') {
    if (valor !== 'true' && valor !== 'false') return { error: 'Elige confirmado o por confirmar.' }
    cambio = { confirmado: valor === 'true' }
  } else if (columna === 'nota') cambio = { nota: valor.trim().slice(0, 1000) || null }
  else return { error: 'Esa columna no se edita.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('sgc').from('proceso_cruce').update(cambio).eq('id', clave).select('id')
  if (error) return { error: error.code === '42501' ? 'No tienes permiso para hacer eso.' : error.message }
  if (!data?.length) return { error: 'No se guardó: el cruce no existe o está fuera de tu alcance.' }
  revalidatePath('/sistema/nucleo/procesos/cruce')
  return {}
}
