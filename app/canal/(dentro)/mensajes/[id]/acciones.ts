'use server'

import { revalidatePath } from 'next/cache'
import { requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

/** Envía un mensaje al hilo. La política RLS verifica que participo en él. */
export async function enviarMensaje(datos: FormData) {
  const conversacionId = String(datos.get('conversacion_id') ?? '')
  const texto = String(datos.get('texto') ?? '').trim()
  if (!conversacionId || !texto) return

  const yo = await requerirEmpleado()
  const supabase = await createClient()

  await supabase.from('mensajes').insert({
    conversacion_id: conversacionId,
    autor_id: yo.id,
    texto: texto.slice(0, 4000),
  })

  revalidatePath(`/canal/mensajes/${conversacionId}`)
  revalidatePath('/canal/mensajes')
}

/** Deja constancia de hasta dónde leí, para el punto rojo de la lista. */
export async function marcarVisto(conversacionId: string) {
  const yo = await requerirEmpleado()
  const supabase = await createClient()

  await supabase
    .from('conversacion_participantes')
    .update({ visto_en: new Date().toISOString() })
    .eq('conversacion_id', conversacionId)
    .eq('empleado_id', yo.id)
}
