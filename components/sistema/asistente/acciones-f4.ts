'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { fuentesDePersona } from '@/lib/asistente/alcance'

type R = { ok: true } | { ok: false; error: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const limpio = (m?: string) => (m ?? '').replace(/^.*?ERROR:\s*/, '')

export async function invitarAlChat(chatId: string, perfilId: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(chatId) || !UUID.test(perfilId)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').rpc('invitar', { p_chat: chatId, p_perfil: perfilId })
  revalidatePath(`/sistema/asistente/c/${chatId}`)
  return error ? { ok: false, error: limpio(error.message) || 'No se pudo invitar.' } : { ok: true }
}

export async function sacarDelChat(chatId: string, perfilId: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(chatId) || !UUID.test(perfilId)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('asistente').from('participante').delete().eq('chat_id', chatId).eq('perfil_id', perfilId).select('perfil_id')
  revalidatePath('/sistema/asistente', 'layout')
  return error || !data?.length ? { ok: false, error: 'No se pudo (solo el dueño saca; cada quien se sale solo).' } : { ok: true }
}

/**
 * Compartir un archivo o un artefacto (decisión 11). Es una foto de los datos
 * que vio quien lo pidió, así que antes se revisa su LINAJE: las fuentes de la
 * plataforma que consultó el turno que lo produjo. Si a quien recibe le falta
 * alguna (por permiso o por alcance), no se comparte y se dice cuál.
 */
export async function compartirObjeto(tipo: 'archivo' | 'html', id: string, conId: string): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!UUID.test(id) || !UUID.test(conId) || conId === sesion.userId) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data: pol } = await supabase.schema('asistente').rpc('mi_politica')
  if (!(pol as { puede_compartir?: boolean } | null)?.puede_compartir) return { ok: false, error: 'Tu política no te deja compartir.' }
  // Tiene que ser tuyo.
  const { data: objeto } = await supabase.schema('asistente').from(tipo).select('id, dueno, mensaje_id').eq('id', id).eq('dueno', sesion.userId).maybeSingle()
  if (!objeto) return { ok: false, error: 'Solo compartes lo tuyo.' }
  const admin = createAdminClient()
  const { data: destino } = await admin.schema('asistente').rpc('politica_de', { p_perfil: conId })
  if (!(destino as { habilitado?: boolean } | null)?.habilitado) return { ok: false, error: 'Esa persona no tiene el asistente de IA.' }
  // El linaje: las fuentes que consultó el turno que lo produjo.
  let linaje: string[] = []
  if (objeto.mensaje_id) {
    const { data: m } = await admin.schema('asistente').from('mensaje').select('turno_id').eq('id', objeto.mensaje_id).maybeSingle()
    if (m?.turno_id) {
      const { data: q } = await admin.schema('asistente').from('consulta_fuente').select('fuente').eq('turno_id', m.turno_id)
      linaje = [...new Set((q ?? []).map((x) => x.fuente))]
    }
  }
  if (linaje.length) {
    const suyas = await fuentesDePersona(conId)
    const faltan = suyas.filter((f) => linaje.includes(f.clave) && f.estado !== 'si')
    if (faltan.length) return { ok: false, error: `No se comparte: trae datos de ${faltan.map((f) => `«${f.titulo}»`).join(', ')}, que esa persona no puede ver.` }
  }
  const { error } = await admin.schema('asistente').from('compartido').upsert({ tipo, objeto_id: id, con: conId, por: sesion.userId, linaje }, { onConflict: 'tipo,objeto_id,con' })
  revalidatePath('/sistema/asistente/archivos')
  return error ? { ok: false, error: 'No se pudo compartir.' } : { ok: true }
}

export async function retirarCompartido(id: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('compartido').delete().eq('id', id).select('id')
  revalidatePath('/sistema/asistente/archivos')
  return data?.length ? { ok: true } : { ok: false, error: 'No se pudo retirar.' }
}
