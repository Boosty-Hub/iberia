'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

/**
 * Pide conexión a un par. El modelo es el de LinkedIn: primero se conecta, y
 * si la otra persona acepta, entonces se conversa.
 */
export async function solicitarConexion(datos: FormData) {
  const otroId = String(datos.get('empleado_id') ?? '')
  if (!otroId) return

  const yo = await requerirEmpleado()
  if (otroId === yo.id) return

  const supabase = await createClient()

  // Si ya existe en el sentido contrario, pedirla otra vez sería absurdo:
  // se acepta la que ya está esperando.
  const { data: alReves } = await supabase
    .from('conexiones')
    .select('id, estado')
    .eq('solicita_id', otroId)
    .eq('recibe_id', yo.id)
    .maybeSingle()

  if (alReves) {
    if (alReves.estado === 'pendiente') {
      await supabase
        .from('conexiones')
        .update({ estado: 'aceptada', resuelta_en: new Date().toISOString() })
        .eq('id', alReves.id)
    }
  } else {
    await supabase
      .from('conexiones')
      .upsert(
        { solicita_id: yo.id, recibe_id: otroId, estado: 'pendiente' },
        { onConflict: 'solicita_id,recibe_id', ignoreDuplicates: true }
      )
  }

  revalidatePath('/canal/gente')
  revalidatePath('/canal/avisos')
}

/** Acepta o descarta una solicitud recibida. */
export async function responderConexion(datos: FormData) {
  const id = String(datos.get('conexion_id') ?? '')
  const respuesta = String(datos.get('respuesta') ?? '')
  if (!id || (respuesta !== 'aceptada' && respuesta !== 'rechazada')) return

  await requerirEmpleado()
  const supabase = await createClient()

  // La política "resuelvo la que recibo" impide responder solicitudes ajenas.
  await supabase
    .from('conexiones')
    .update({ estado: respuesta, resuelta_en: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/canal/gente')
  revalidatePath('/canal/avisos')
}

/**
 * Abre —o recupera— la conversación directa con alguien y lleva a ella.
 * Dos personas tienen un solo hilo entre sí, para siempre.
 */
export async function abrirConversacion(datos: FormData) {
  const otroId = String(datos.get('empleado_id') ?? '')
  if (!otroId) return

  const yo = await requerirEmpleado()
  if (otroId === yo.id) return

  const supabase = await createClient()

  const { data: mias } = await supabase
    .from('conversacion_participantes')
    .select('conversacion_id, conversaciones!inner(tipo)')
    .eq('empleado_id', yo.id)
    .eq('conversaciones.tipo', 'directa')

  const idsMios = (mias ?? []).map((p) => p.conversacion_id)

  let conversacionId: string | null = null

  if (idsMios.length > 0) {
    const { data: comun } = await supabase
      .from('conversacion_participantes')
      .select('conversacion_id')
      .eq('empleado_id', otroId)
      .in('conversacion_id', idsMios)
      .limit(1)
      .maybeSingle()

    conversacionId = comun?.conversacion_id ?? null
  }

  if (!conversacionId) {
    // El id se genera aquí y no se pide de vuelta: RLS solo deja leer una
    // conversación a quien participa en ella, y en este instante todavía no
    // participo. Un `.select()` después del insert volvería vacío.
    conversacionId = crypto.randomUUID()

    const { error } = await supabase
      .from('conversaciones')
      .insert({ id: conversacionId, tipo: 'directa' })

    if (error) return

    // Mi fila primero: la política deja sumar a la otra persona solo a quien
    // ya participa en el hilo.
    await supabase
      .from('conversacion_participantes')
      .insert({ conversacion_id: conversacionId, empleado_id: yo.id })
    await supabase
      .from('conversacion_participantes')
      .insert({ conversacion_id: conversacionId, empleado_id: otroId })
  }

  redirect(`/canal/mensajes/${conversacionId}`)
}
