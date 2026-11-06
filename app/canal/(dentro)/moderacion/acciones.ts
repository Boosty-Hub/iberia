'use server'

import { revalidatePath } from 'next/cache'
import { requerirEmpleado } from '@/lib/canal'
import {
  LARGO_DETALLE_REPORTE,
  MOTIVOS_REPORTE,
  TIPOS_REPORTABLES,
  UUID,
  type MotivoReporte,
  type Resultado,
  type TipoReportable,
} from '@/lib/reportes'
import { createClient } from '@/lib/supabase/server'

/**
 * Reporta una publicación, un comentario o un mensaje. Va por
 * `reportar_contenido()`, que comprueba en la base que quien reporta puede leer
 * lo reportado y que no es suyo, y congela un extracto para el equipo.
 *
 * Reportar dos veces lo mismo no abre dos reportes (único por persona y por
 * cosa), y la respuesta es la misma: quien reporta no necesita saber si ya lo
 * había hecho.
 */
export async function reportarContenido(
  tipo: TipoReportable,
  contenidoId: string,
  motivo: MotivoReporte,
  detalle: string
): Promise<Resultado> {
  if (!(tipo in TIPOS_REPORTABLES) || !UUID.test(contenidoId) || !(motivo in MOTIVOS_REPORTE)) {
    return { ok: false, error: 'No se pudo enviar el reporte.' }
  }

  await requerirEmpleado()
  const supabase = await createClient()

  const { error } = await supabase.rpc('reportar_contenido', {
    p_tipo: tipo,
    p_contenido: contenidoId,
    p_motivo: motivo,
    p_detalle: detalle.trim().slice(0, LARGO_DETALLE_REPORTE),
  })

  if (error) {
    return { ok: false, error: 'No se pudo enviar el reporte. Inténtalo de nuevo.' }
  }
  return { ok: true }
}

/**
 * Bloquea a una persona. A partir de aquí no ves lo suyo y no te puede escribir;
 * a ella no se le avisa de nada. Bloquear dos veces es lo mismo que una.
 */
export async function bloquearPersona(empleadoId: string): Promise<Resultado> {
  if (!UUID.test(empleadoId)) return { ok: false, error: 'No se pudo bloquear.' }

  const yo = await requerirEmpleado()
  if (empleadoId === yo.id) return { ok: false, error: 'No puedes bloquearte a ti mismo.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('bloqueos')
    .insert({ bloqueador_id: yo.id, bloqueado_id: empleadoId })

  // 23505: ya estaba bloqueada. Es lo que se quería.
  if (error && error.code !== '23505') {
    return { ok: false, error: 'No se pudo bloquear. Inténtalo de nuevo.' }
  }

  // Cambia el feed, las conversaciones, el directorio y el contador del pie.
  revalidatePath('/canal', 'layout')
  return { ok: true }
}

/** Deshace el bloqueo. Todo lo anterior vuelve a verse. */
export async function desbloquearPersona(empleadoId: string): Promise<Resultado> {
  if (!UUID.test(empleadoId)) return { ok: false, error: 'No se pudo desbloquear.' }

  const yo = await requerirEmpleado()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bloqueos')
    .delete()
    .eq('bloqueador_id', yo.id)
    .eq('bloqueado_id', empleadoId)

  if (error) return { ok: false, error: 'No se pudo desbloquear. Inténtalo de nuevo.' }

  revalidatePath('/canal', 'layout')
  return { ok: true }
}
