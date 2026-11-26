'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fuentesDePersona } from '@/lib/asistente/alcance'
import { catalogoFuentes } from '@/lib/asistente/fuentes'

type R = { ok: true } | { ok: false; error: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const existe = (clave: string) => catalogoFuentes().some((f) => f.clave === clave)

/** Enciende o apaga una fuente para toda la empresa, y la marca sensible o no. */
export async function guardarFuente(clave: string, cambios: { encendida?: boolean; sensible?: boolean }): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente-admin', 'editar')
  if (!existe(clave)) return { ok: false, error: 'Esa fuente no existe.' }
  const supabase = await createClient()
  const { data: previa } = await supabase.schema('asistente').from('fuente').select('encendida, sensible').eq('clave', clave).maybeSingle()
  const { error } = await supabase
    .schema('asistente')
    .from('fuente')
    .upsert({ clave, encendida: cambios.encendida ?? previa?.encendida ?? false, sensible: cambios.sensible ?? previa?.sensible ?? false, actualizado_por: sesion.userId, actualizado_en: new Date().toISOString() })
  revalidatePath('/sistema/administracion/asistente/alcance')
  return error ? { ok: false, error: 'No se pudo guardar la fuente.' } : { ok: true }
}

/** Marca o desmarca una fuente para un rol. */
export async function guardarAlcanceRol(rolId: string, fuente: string, permitido: boolean): Promise<R> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  if (!UUID.test(rolId) || !existe(fuente)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const db = supabase.schema('asistente').from('alcance_rol')
  const { error } = permitido ? await db.upsert({ rol_id: rolId, fuente, permitido: true }) : await db.delete().eq('rol_id', rolId).eq('fuente', fuente)
  revalidatePath('/sistema/administracion/asistente/alcance')
  return error ? { ok: false, error: 'No se pudo guardar.' } : { ok: true }
}

/** Excepción de una persona para una fuente: permitir, negar o (null) quitar la excepción. */
export async function guardarAlcanceUsuario(perfilId: string, fuente: string, permitido: boolean | null): Promise<R> {
  await requerirPermiso('sistema:asistente-admin', 'editar')
  if (!UUID.test(perfilId) || !existe(fuente)) return { ok: false, error: 'No válido.' }
  const supabase = await createClient()
  const db = supabase.schema('asistente').from('alcance_usuario')
  const { error } = permitido === null ? await db.delete().eq('perfil_id', perfilId).eq('fuente', fuente) : await db.upsert({ perfil_id: perfilId, fuente, permitido })
  revalidatePath('/sistema/administracion/asistente/alcance')
  return error ? { ok: false, error: 'No se pudo guardar.' } : { ok: true }
}

/**
 * «Ver como»: qué fuentes tendría el asistente de una persona, y por qué no
 * tiene las demás (`fuentesDePersona`, la misma regla de la ruta de fuentes).
 */
export async function verComo(perfilId: string): Promise<{ ok: true; filas: { clave: string; titulo: string; estado: 'si' | 'sin_permiso' | 'fuera_de_alcance' | 'apagada' }[] } | { ok: false; error: string }> {
  await requerirPermiso('sistema:asistente-admin', 'ver')
  if (!UUID.test(perfilId)) return { ok: false, error: 'Persona no válida.' }
  const filas = await fuentesDePersona(perfilId)
  return filas.length ? { ok: true, filas } : { ok: false, error: 'No existe.' }
}
