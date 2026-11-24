'use server'

import { revalidatePath } from 'next/cache'
import { obtenerSesion, puede } from '@/lib/auth'
import { requerirEmpleado } from '@/lib/canal'
import { esUuid } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'

/** Comentar una publicación. La base solo lo deja donde la publicación lo permite (`privado.permite_comentar`). */
export async function comentar(datos: FormData) {
  const publicacionId = String(datos.get('publicacion_id') ?? '')
  const texto = String(datos.get('texto') ?? '').trim().slice(0, 1000)
  if (!esUuid(publicacionId) || !texto) return
  const yo = await requerirEmpleado()
  const supabase = await createClient()
  await supabase.from('comentarios').insert({ publicacion_id: publicacionId, empleado_id: yo.id, texto })
  revalidatePath(`/canal/publicacion/${publicacionId}`)
}

/**
 * Ocultar o mostrar un comentario. Quien publica en el portal lo hace por la RLS («modero comentarios»); el
 * equipo del admin (`modulo:reportes` · editar), por `ui.canal_comentario_estado`.
 */
export async function moderarComentario(datos: FormData) {
  const id = String(datos.get('id') ?? '')
  const publicacionId = String(datos.get('publicacion_id') ?? '')
  const estado = datos.get('estado') === 'oculto' ? 'oculto' : 'visible'
  if (!esUuid(id)) return
  const [yo, sesion] = await Promise.all([requerirEmpleado(), obtenerSesion()])
  const supabase = await createClient()
  if (puede(sesion, 'modulo:reportes', 'editar')) {
    await supabase.schema('ui').rpc('canal_comentario_estado' as never, { p_comentario: id, p_estado: estado } as never)
  } else {
    await supabase
      .from('comentarios')
      .update({ estado, moderado_por: estado === 'oculto' ? yo.id : null })
      .eq('id', id)
  }
  if (esUuid(publicacionId)) revalidatePath(`/canal/publicacion/${publicacionId}`)
}
