import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_NOTIFICACION, aNotificacion } from '@/components/sistema/colaboracion/datos'
import type { Notificacion } from '@/lib/plataforma/colaboracion'

/**
 * Los avisos de la plataforma (`nucleo.notificacion`) vistos desde el canal: la
 * misma campana que en `/sistema`, en formato de teléfono. La RLS solo devuelve
 * los propios. Lo usan el layout (el punto de la campana), Inicio y Avisos.
 */

export async function avisosDelCanal(limite = 20): Promise<{ lista: Notificacion[]; noLeidas: number }> {
  const supabase = await createClient()
  const nucleo = supabase.schema('nucleo')
  const [{ data }, { data: n }] = await Promise.all([
    nucleo
      .from('notificacion')
      .select(COLUMNAS_NOTIFICACION)
      .order('creado_en', { ascending: false })
      .range(0, limite - 1),
    nucleo.rpc('no_leidas'),
  ])
  return { lista: (data ?? []).map(aNotificacion), noLeidas: n ?? 0 }
}

/** Mis tareas abiertas (las que me asignaron), las más urgentes primero. */
export async function misTareasAbiertas(limite = 50) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { lista: [], total: 0 }
  const { data, count } = await supabase
    .schema('nucleo')
    .from('tarea')
    .select('id, titulo, detalle, vence, estado, creado_en, objeto_tipo, objeto_id', { count: 'exact' })
    .eq('asignada_a', user.id)
    .eq('estado', 'abierta')
    .order('vence', { ascending: true, nullsFirst: false })
    .order('creado_en', { ascending: false })
    .range(0, limite - 1)
  return { lista: data ?? [], total: count ?? 0 }
}
