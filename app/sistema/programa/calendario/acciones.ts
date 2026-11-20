'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { ESTADOS_ACTIVIDAD, type EstadoActividad } from '@/lib/calendario'
import { createClient } from '@/lib/supabase/server'

export type EstadoActualizacion = { error?: string; ok?: string }

const ESTADOS_VALIDOS = Object.keys(ESTADOS_ACTIVIDAD) as EstadoActividad[]

/**
 * Lo que Amanda va fijando con cada área: el estado, el día que se confirmó y una
 * nota. El título, las fechas previstas y el responsable no se tocan desde aquí:
 * son lo acordado con Iberia y con el señor Carlos, y cambian en la base.
 */
export async function actualizarActividad(
  _anterior: EstadoActualizacion,
  fd: FormData
): Promise<EstadoActualizacion> {
  const { userId } = await requerirPermiso('modulo:calendario', 'editar')

  const id = String(fd.get('id') ?? '')
  if (!/^[a-z0-9-]+$/.test(id)) return { error: 'No se encontró la actividad.' }

  const estado = String(fd.get('estado') ?? '') as EstadoActividad
  if (!ESTADOS_VALIDOS.includes(estado)) return { error: 'Ese estado no existe.' }

  const cruda = String(fd.get('fecha_confirmada') ?? '').trim()
  if (cruda && !/^\d{4}-\d{2}-\d{2}$/.test(cruda)) return { error: 'La fecha confirmada no se entiende.' }

  const nota = String(fd.get('nota') ?? '').trim()
  if (nota.length > 500) return { error: 'La nota pasa de 500 caracteres.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('calendario_actividades')
    .update({ estado, fecha_confirmada: cruda || null, nota, updated_by: userId })
    .eq('id', id)
    .select('id')

  if (error) return { error: 'No se pudo guardar. Inténtalo otra vez.' }
  // Bajo RLS, una fila que no se puede tocar no da error: vuelve vacía.
  if (!data?.length) return { error: 'No tienes permiso para actualizar el calendario.' }

  revalidatePath('/sistema/programa', 'layout')
  return { ok: 'Guardado.' }
}
