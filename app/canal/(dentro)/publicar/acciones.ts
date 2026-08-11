'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { AUDIENCIAS, TIPOS_PUBLICACION, requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

/**
 * Publica en el canal. Quién puede hacerlo lo decide la política
 * `publican los autorizados`; aquí solo se cuida que lo enviado tenga sentido.
 */
export async function publicar(datos: FormData) {
  const yo = await requerirEmpleado()
  if (!yo.puede_publicar && !yo.es_moderador) return

  const titulo = String(datos.get('titulo') ?? '').trim()
  if (!titulo) return

  const tipo = String(datos.get('tipo') ?? 'noticia')
  const audiencia = String(datos.get('audiencia') ?? 'todos')
  const areaId = String(datos.get('audiencia_area_id') ?? '')

  if (!(tipo in TIPOS_PUBLICACION)) return
  if (!(audiencia in AUDIENCIAS)) return
  // Una publicación dirigida a un área sin área elegida no llegaría a nadie.
  if (audiencia === 'area' && !areaId) return

  // El sello de "oficial" es la voz de la empresa: solo la dirección y quien
  // modera el canal pueden ponerlo.
  const oficial =
    datos.get('oficial') === 'si' && (yo.nivel === 'direccion' || yo.es_moderador)

  const supabase = await createClient()

  const { data: creada } = await supabase
    .from('publicaciones')
    .insert({
      tipo,
      titulo: titulo.slice(0, 200),
      bajada: String(datos.get('bajada') ?? '').trim().slice(0, 400) || null,
      cuerpo_md: String(datos.get('cuerpo') ?? '').trim() || null,
      audiencia,
      audiencia_area_id: audiencia === 'area' ? areaId : null,
      autor_id: yo.id,
      estado: 'publicado',
      oficial,
      fijado: datos.get('fijado') === 'si' && oficial,
      publicado_en: new Date().toISOString(),
    })
    .select('id')
    .single()

  revalidatePath('/canal')
  revalidatePath('/canal/avisos')

  if (creada) redirect(`/canal/publicacion/${creada.id}`)
  redirect('/canal')
}
