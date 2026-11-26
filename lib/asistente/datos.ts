import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Bloque, EstadoTurno } from '@/lib/asistente/tipos'

export type ChatLista = { id: string; titulo: string; actualizado_en: string; compartido: boolean }
export type MensajeVista = {
  id: string
  rol: 'usuario' | 'asistente'
  texto: string
  bloques: Bloque[]
  adjuntos: string[]
  turno_id: string | null
  autor?: string | null
  calificacion: number | null
  creado_en: string
}
export type ArchivoVista = { id: string; nombre: string; mime: string; bytes: number; origen: 'subido' | 'generado' }
export type TurnoVista = { id: string; estado: EstadoTurno; error: string | null; modelo: string; esfuerzo: string; creado_en: string }

/** Los chats de quien mira, los más recientes primero (la RLS deja solo los suyos). */
export async function leerChats(limite = 100): Promise<ChatLista[]> {
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('chat').select('id, titulo, actualizado_en, compartido').eq('archivado', false).order('actualizado_en', { ascending: false }).limit(limite)
  return (data ?? []) as ChatLista[]
}

/** Un chat con sus últimos mensajes, sus archivos y el turno que esté corriendo. Todo en una tanda. */
export async function leerChat(chatId: string) {
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: chat }, { data: mensajes }, { data: archivos }, { data: turnos }] = await Promise.all([
    db.from('chat').select('id, titulo, dueno, compartido, modelo, esfuerzo, proyecto_id').eq('id', chatId).maybeSingle(),
    db.from('mensaje').select('id, rol, texto, bloques, adjuntos, turno_id, autor, calificacion, creado_en').eq('chat_id', chatId).order('creado_en', { ascending: false }).limit(200),
    db.from('archivo').select('id, nombre, mime, bytes, origen').eq('chat_id', chatId),
    db.from('turno').select('id, estado, error, modelo, esfuerzo, creado_en').eq('chat_id', chatId).order('creado_en', { ascending: false }).limit(1),
  ])
  if (!chat) return null
  const ultimo = (turnos?.[0] ?? null) as TurnoVista | null
  return {
    chat,
    mensajes: ((mensajes ?? []) as MensajeVista[]).reverse(),
    archivos: (archivos ?? []) as ArchivoVista[],
    // El último turno, si sigue abierto o si falló (para ofrecer reintentar).
    turno: ultimo && ultimo.estado !== 'listo' ? ultimo : null,
  }
}
