'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { requerirEmpleado } from '@/lib/canal'
import { avisarMensaje } from '@/lib/notificaciones'
import { createClient } from '@/lib/supabase/server'

/**
 * Envía un mensaje al hilo. La política RLS verifica que participo en él.
 *
 * El aviso al teléfono de los demás sale con `after()`, cuando la respuesta ya
 * se fue: el mensaje queda mandado aunque APNs esté caído o tarde.
 */
export async function enviarMensaje(datos: FormData) {
  const conversacionId = String(datos.get('conversacion_id') ?? '')
  const texto = String(datos.get('texto') ?? '').trim().slice(0, 4000)
  if (!conversacionId || !texto) return

  const yo = await requerirEmpleado()
  const supabase = await createClient()

  const { error } = await supabase.from('mensajes').insert({
    conversacion_id: conversacionId,
    autor_id: yo.id,
    texto,
  })

  revalidatePath(`/canal/mensajes/${conversacionId}`)
  revalidatePath('/canal/mensajes')

  if (!error) {
    after(() =>
      avisarMensaje(supabase, { conversacionId, autor: yo.nombre_completo, texto })
    )
  }
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
