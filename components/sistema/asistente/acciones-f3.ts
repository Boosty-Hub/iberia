'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ESFUERZOS, type Esfuerzo } from '@/lib/asistente/tipos'

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// ── Proyectos ────────────────────────────────────────────────────────────────

export async function guardarProyecto(entrada: { id?: string | null; nombre: string; instrucciones: string }): Promise<R<{ id: string }>> {
  const sesion = await requerirPermiso('sistema:asistente')
  const nombre = entrada.nombre.replace(/\s+/g, ' ').trim().slice(0, 120)
  if (!nombre) return { ok: false, error: 'Ponle un nombre al proyecto.' }
  if (entrada.instrucciones.length > 10000) return { ok: false, error: 'Las instrucciones pasan de 10.000 caracteres.' }
  const supabase = await createClient()
  const db = supabase.schema('asistente').from('proyecto')
  if (entrada.id) {
    if (!UUID.test(entrada.id)) return { ok: false, error: 'Proyecto no válido.' }
    const { data, error } = await db.update({ nombre, instrucciones: entrada.instrucciones, actualizado_en: new Date().toISOString() }).eq('id', entrada.id).select('id')
    revalidatePath('/sistema/asistente', 'layout')
    return error || !data?.length ? { ok: false, error: 'No se pudo guardar el proyecto.' } : { ok: true, id: entrada.id }
  }
  const id = crypto.randomUUID()
  const { error } = await db.insert({ id, dueno: sesion.userId, nombre, instrucciones: entrada.instrucciones })
  revalidatePath('/sistema/asistente', 'layout')
  return error ? { ok: false, error: 'No se pudo crear el proyecto.' } : { ok: true, id }
}

export async function borrarProyecto(id: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'Proyecto no válido.' }
  const supabase = await createClient()
  // Los chats y archivos del proyecto no se borran: quedan sueltos.
  const { data, error } = await supabase.schema('asistente').from('proyecto').delete().eq('id', id).select('id')
  revalidatePath('/sistema/asistente', 'layout')
  return error || !data?.length ? { ok: false, error: 'No se pudo borrar el proyecto.' } : { ok: true }
}

export async function moverChat(chatId: string, proyectoId: string | null): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(chatId) || (proyectoId && !UUID.test(proyectoId))) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('asistente').from('chat').update({ proyecto_id: proyectoId }).eq('id', chatId).select('id')
  revalidatePath('/sistema/asistente', 'layout')
  return error || !data?.length ? { ok: false, error: 'No se pudo mover el chat (solo lo mueve su dueño, a un proyecto suyo).' } : { ok: true }
}

// ── Memoria ──────────────────────────────────────────────────────────────────

export async function guardarMemoria(entrada: { id?: string | null; texto: string }): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente')
  const texto = entrada.texto.replace(/\s+/g, ' ').trim().slice(0, 500)
  if (texto.length < 3) return { ok: false, error: 'Escribe el hecho.' }
  const supabase = await createClient()
  const db = supabase.schema('asistente').from('memoria')
  const { error } = entrada.id ? await db.update({ texto }).eq('id', entrada.id) : await db.insert({ dueno: sesion.userId, texto })
  revalidatePath('/sistema/asistente/memoria')
  return error ? { ok: false, error: 'No se pudo guardar.' } : { ok: true }
}

export async function borrarMemoria(id: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('memoria').delete().eq('id', id).select('id')
  revalidatePath('/sistema/asistente/memoria')
  return data?.length ? { ok: true } : { ok: false, error: 'Ya no estaba.' }
}

export async function cambiarMemoria(encendida: boolean): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente')
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').from('preferencia').upsert({ perfil_id: sesion.userId, memoria: encendida, actualizado_en: new Date().toISOString() })
  revalidatePath('/sistema/asistente/memoria')
  return error ? { ok: false, error: 'No se pudo cambiar.' } : { ok: true }
}

// ── Atajos ───────────────────────────────────────────────────────────────────

export async function guardarAtajo(entrada: {
  id?: string | null
  empresa: boolean
  comando: string
  titulo: string
  instruccion: string
  modelo?: string | null
  esfuerzo?: Esfuerzo | null
}): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (entrada.empresa && !puede(sesion, 'sistema:asistente-admin', 'editar')) return { ok: false, error: 'Los atajos de la empresa los crea la administración.' }
  const comando = entrada.comando.toLowerCase().replace(/^\//, '').replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  if (comando.length < 2) return { ok: false, error: 'El comando necesita al menos 2 letras.' }
  if (entrada.titulo.trim().length < 2 || entrada.instruccion.trim().length < 5) return { ok: false, error: 'Falta el título o la instrucción.' }
  if (entrada.esfuerzo && !ESFUERZOS.includes(entrada.esfuerzo)) return { ok: false, error: 'Esfuerzo no válido.' }
  const fila = {
    dueno: entrada.empresa ? null : sesion.userId,
    comando,
    titulo: entrada.titulo.trim().slice(0, 80),
    instruccion: entrada.instruccion.trim().slice(0, 4000),
    modelo: entrada.modelo || null,
    esfuerzo: entrada.esfuerzo || null,
    actualizado_en: new Date().toISOString(),
  }
  const supabase = await createClient()
  const db = supabase.schema('asistente').from('atajo')
  const { error } = entrada.id ? await db.update(fila).eq('id', entrada.id) : await db.insert(fila)
  revalidatePath('/sistema/asistente', 'layout')
  if (error) return { ok: false, error: error.code === '23505' ? 'Ya existe un atajo con ese comando.' : 'No se pudo guardar el atajo.' }
  return { ok: true }
}

export async function borrarAtajo(id: string): Promise<R> {
  await requerirPermiso('sistema:asistente')
  if (!UUID.test(id)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('atajo').delete().eq('id', id).select('id')
  revalidatePath('/sistema/asistente', 'layout')
  return data?.length ? { ok: true } : { ok: false, error: 'No se pudo borrar (¿es de la empresa?).' }
}
