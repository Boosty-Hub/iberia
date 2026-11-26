'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { catalogoFuentes } from '@/lib/asistente/fuentes'
import { permite, type MapaPermisos, type Nivel } from '@/lib/permisos'

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
 * tiene las demás. Lo calcula el servidor con la misma regla de la ruta de
 * fuentes (permiso de la pantalla ∩ alcance); no acuña ninguna sesión.
 */
export async function verComo(perfilId: string): Promise<{ ok: true; filas: { clave: string; titulo: string; estado: 'si' | 'sin_permiso' | 'fuera_de_alcance' | 'apagada' }[] } | { ok: false; error: string }> {
  await requerirPermiso('sistema:asistente-admin', 'ver')
  if (!UUID.test(perfilId)) return { ok: false, error: 'Persona no válida.' }
  const admin = createAdminClient()
  const { data: perfil } = await admin.from('profiles').select('rol, rol_id, activo').eq('id', perfilId).maybeSingle()
  if (!perfil) return { ok: false, error: 'No existe.' }
  const [{ data: permisos }, { data: fuentes }, { data: porRol }, { data: porUsuario }] = await Promise.all([
    admin.from('rol_permisos').select('recurso, ver, crear, editar, eliminar').eq('rol_id', perfil.rol_id),
    admin.schema('asistente').from('fuente').select('clave, encendida'),
    admin.schema('asistente').from('alcance_rol').select('fuente, permitido').eq('rol_id', perfil.rol_id),
    admin.schema('asistente').from('alcance_usuario').select('fuente, permitido').eq('perfil_id', perfilId),
  ])
  const mapa: MapaPermisos = {}
  for (const p of permisos ?? []) mapa[p.recurso] = { ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar }
  const encendida = new Map((fuentes ?? []).map((f) => [f.clave, f.encendida]))
  const rol = new Map((porRol ?? []).map((r) => [r.fuente, r.permitido]))
  const usuario = new Map((porUsuario ?? []).map((u) => [u.fuente, u.permitido]))
  const filas = catalogoFuentes().map((f) => {
    const enAlcance = usuario.get(f.clave) ?? rol.get(f.clave) ?? false
    const conPermiso = !f.recurso || permite(perfil.rol as Nivel, mapa, f.recurso, f.accion)
    const estado: 'si' | 'sin_permiso' | 'fuera_de_alcance' | 'apagada' = !perfil.activo || !encendida.get(f.clave) ? 'apagada' : !enAlcance ? 'fuera_de_alcance' : !conPermiso ? 'sin_permiso' : 'si'
    return { clave: f.clave, titulo: f.titulo, estado }
  })
  return { ok: true, filas }
}
