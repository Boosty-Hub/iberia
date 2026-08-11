'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

/** Crea un grupo y deja a quien lo crea como coordinador. */
export async function crearGrupo(datos: FormData) {
  const nombre = String(datos.get('nombre') ?? '').trim()
  const proposito = String(datos.get('proposito') ?? '').trim()
  const tipo = datos.get('tipo') === 'abierto' ? 'abierto' : 'cerrado'
  if (!nombre) return

  const yo = await requerirEmpleado()
  const supabase = await createClient()

  // El id se genera aquí: un grupo cerrado todavía no es legible para quien
  // acaba de crearlo —no figura como miembro—, así que pedirlo de vuelta con
  // `.select()` volvería vacío.
  const grupoId = crypto.randomUUID()

  const { error } = await supabase.from('grupos').insert({
    id: grupoId,
    nombre: nombre.slice(0, 120),
    proposito: proposito.slice(0, 400) || null,
    tipo,
    creador_id: yo.id,
    area_id: yo.area_id,
  })

  if (error) return

  await supabase
    .from('grupo_miembros')
    .insert({ grupo_id: grupoId, empleado_id: yo.id, rol: 'coordinador' })

  revalidatePath('/canal/grupos')
}

/** Me sumo a un grupo abierto. */
export async function unirmeAGrupo(datos: FormData) {
  const grupoId = String(datos.get('grupo_id') ?? '')
  if (!grupoId) return

  const yo = await requerirEmpleado()
  const supabase = await createClient()

  await supabase
    .from('grupo_miembros')
    .upsert(
      { grupo_id: grupoId, empleado_id: yo.id },
      { onConflict: 'grupo_id,empleado_id', ignoreDuplicates: true }
    )

  revalidatePath('/canal/grupos')
}

/**
 * Abre la conversación del grupo. Es el mismo hilo que el de un mensaje
 * directo: un grupo, aquí, es una conversación con nombre y propósito.
 */
export async function abrirGrupo(datos: FormData) {
  const grupoId = String(datos.get('grupo_id') ?? '')
  if (!grupoId) return

  const yo = await requerirEmpleado()
  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('conversaciones')
    .select('id')
    .eq('grupo_id', grupoId)
    .maybeSingle()

  let conversacionId = existente?.id ?? null

  if (!conversacionId) {
    conversacionId = crypto.randomUUID()
    const { error } = await supabase
      .from('conversaciones')
      .insert({ id: conversacionId, tipo: 'grupo', grupo_id: grupoId })

    // El índice único por grupo puede haber ganado la carrera: si otro abrió
    // el hilo primero, se usa el suyo.
    if (error) {
      const { data: ya } = await supabase
        .from('conversaciones')
        .select('id')
        .eq('grupo_id', grupoId)
        .maybeSingle()
      if (!ya) return
      conversacionId = ya.id
    }
  }

  await supabase
    .from('conversacion_participantes')
    .upsert(
      { conversacion_id: conversacionId, empleado_id: yo.id },
      { onConflict: 'conversacion_id,empleado_id', ignoreDuplicates: true }
    )

  redirect(`/canal/mensajes/${conversacionId}`)
}
