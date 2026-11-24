'use server'

import { revalidatePath } from 'next/cache'
import { requerirSesion } from '@/lib/auth'
import { esUuid } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'

/**
 * Terminar o reabrir una tarea desde el canal. La RLS de `nucleo.tarea` solo
 * deja cambiar las propias, y el trigger de la base avisa a quien la creó.
 */
export async function cambiarMiTarea(datos: FormData) {
  await requerirSesion()
  const id = String(datos.get('id') ?? '')
  const estado = String(datos.get('estado') ?? '')
  if (!esUuid(id) || !['abierta', 'hecha'].includes(estado)) return
  const supabase = await createClient()
  await supabase.schema('nucleo').from('tarea').update({ estado }).eq('id', id)
  revalidatePath('/canal', 'layout')
  revalidatePath('/sistema/tareas')
}

/**
 * Crear una tarea propia desde el portal (24-nov-2026): queda asignada a quien la crea, sin objeto. La misma
 * tabla de la plataforma (`nucleo.tarea`), así que también sale en /sistema.
 */
export async function crearMiTarea(datos: FormData) {
  const sesion = await requerirSesion()
  const titulo = String(datos.get('titulo') ?? '').trim().slice(0, 200)
  const detalle = String(datos.get('detalle') ?? '').trim().slice(0, 1000)
  const vence = String(datos.get('vence') ?? '')
  if (!titulo) return
  const supabase = await createClient()
  await supabase
    .schema('nucleo')
    .from('tarea')
    .insert({
      titulo,
      detalle: detalle || null,
      vence: /^\d{4}-\d{2}-\d{2}$/.test(vence) ? vence : null,
      asignada_a: sesion.userId,
      creada_por: sesion.userId,
    })
  revalidatePath('/canal', 'layout')
  revalidatePath('/sistema/tareas')
}
