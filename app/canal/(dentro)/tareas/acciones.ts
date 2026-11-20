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
