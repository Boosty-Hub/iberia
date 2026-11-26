'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { olvidarToken } from '@/lib/asistente/microsoft'

type R = { ok: true } | { ok: false; error: string }
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Desconectar mi cuenta de Microsoft: borra la conexión y el token de Vault. */
export async function desconectarMicrosoft(): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente')
  const supabase = await createClient()
  const { error } = await supabase.schema('asistente').rpc('desconectar_microsoft')
  olvidarToken(sesion.userId)
  revalidatePath('/sistema/asistente/conexiones')
  return error ? { ok: false, error: 'No se pudo desconectar.' } : { ok: true }
}

/** Los dos identificadores que devuelve el administrador de Microsoft de Iberia (no son secretos). */
export async function guardarIdentificadoresMicrosoft(tenant: string, cliente: string): Promise<R> {
  const sesion = await requerirPermiso('sistema:asistente-admin', 'editar')
  const t = tenant.trim()
  const c = cliente.trim()
  if ((t && !GUID.test(t)) || (c && !GUID.test(c))) return { ok: false, error: 'Los identificadores tienen la forma 00000000-0000-0000-0000-000000000000.' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('asistente')
    .from('config')
    .update({ microsoft_tenant: t || null, microsoft_cliente: c || null, actualizado_por: sesion.userId, actualizado_en: new Date().toISOString() })
    .eq('id', true)
    .select('id')
  revalidatePath('/sistema/administracion/asistente/microsoft')
  return error || !data?.length ? { ok: false, error: 'No se pudo guardar.' } : { ok: true }
}
