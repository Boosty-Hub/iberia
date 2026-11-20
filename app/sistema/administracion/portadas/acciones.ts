'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Las portadas de Mi día por rol (`ui.portada_rol`). Las edita quien administra
 * roles; la base lo vuelve a exigir (RLS) y comprueba que cada clave exista en
 * el registro de métricas (trigger). Solo exporta funciones async.
 */

export async function guardarPortada(rolId: string, metricas: string[]): Promise<{ ok?: string; error?: string }> {
  await requerirPermiso('modulo:roles', 'editar')
  if (!/^[0-9a-f-]{36}$/i.test(rolId)) return { error: 'Rol no válido.' }
  const claves = [...new Set(metricas.filter((c) => /^[a-z][a-z0-9_]{2,60}$/.test(c)))]
  if (claves.length > 8) return { error: 'Una portada lleva hasta 8 cifras: más de eso ya no se lee de un vistazo.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('ui').from('portada_rol').upsert({ rol_id: rolId, metricas: claves }, { onConflict: 'rol_id' })
  if (error) return { error: error.message }
  revalidatePath('/sistema')
  revalidatePath('/sistema/administracion/portadas')
  return { ok: 'Portada guardada. Quien tenga ese rol la ve en su próximo Mi día.' }
}

/** Vuelve a la portada de su nivel (borra la del rol). */
export async function restablecerPortada(rolId: string): Promise<{ ok?: string; error?: string }> {
  await requerirPermiso('modulo:roles', 'editar')
  if (!/^[0-9a-f-]{36}$/i.test(rolId)) return { error: 'Rol no válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('ui').from('portada_rol').delete().eq('rol_id', rolId)
  if (error) return { error: error.message }
  revalidatePath('/sistema')
  revalidatePath('/sistema/administracion/portadas')
  return { ok: 'Portada restablecida: ve la de su nivel.' }
}
