import 'server-only'
import { hablar } from '@/lib/hablar'
import { BUCKET_RESPUESTAS, rutaDevolucion } from '@/lib/storage'
import type { createClient } from '@/lib/supabase/server'
import type { VozAjito } from '@/lib/voz'

/**
 * Sintetiza la devolución, la guarda en el bucket privado y la deja apuntada en
 * la fila. Devuelve la ruta, o `null` si no se pudo — y en ese caso la fila
 * conserva su texto: nunca se pierde lo que Ajito dijo por no poder decirlo.
 *
 * Vive aparte de las rutas que la usan —la devolución y el dibujo— para poder
 * pedir solo la voz de una devolución que ya existe, y para que el «no va» de un
 * dibujo suene con la misma voz que el resto.
 */
export async function ponerVoz(
  supabase: Awaited<ReturnType<typeof createClient>>,
  respuestaId: string,
  empleadoId: string,
  numero: number,
  clavePaso: string,
  texto: string,
  voz: VozAjito
): Promise<string | null> {
  // Con la voz que eligió: la devolución suena como su clase.
  const hablado = await hablar(texto, voz)
  if (!hablado.ok) {
    console.error('[ajito] síntesis fallida:', hablado.detalle ?? hablado.motivo)
    return null
  }

  const ruta = rutaDevolucion(empleadoId, numero, clavePaso)
  const { error } = await supabase.storage
    .from(BUCKET_RESPUESTAS)
    .upload(ruta, hablado.mp3, { contentType: 'audio/mpeg', upsert: false })
  if (error) {
    console.error('[ajito] no se pudo guardar el audio:', error.message)
    return null
  }

  await supabase.from('respuestas').update({ devolucion_audio: ruta }).eq('id', respuestaId)
  return ruta
}
