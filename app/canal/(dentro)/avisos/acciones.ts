'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirSesion } from '@/lib/auth'
import { tienePlataforma } from '@/lib/canal'
import { tieneFicha } from '@/components/sistema/colaboracion/abrir'
import { hrefFicha } from '@/lib/plataforma/colaboracion'
import { esUuid } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'

/**
 * Tocar un aviso de la plataforma desde el canal: lo marca leído y lleva a su
 * objeto. Si quien lo toca puede abrir ese objeto en la plataforma, va a su
 * ficha en `/sistema`; una tarea va a «Mis tareas» del canal; si no, a la vista
 * de lectura del aviso dentro del canal. Es una acción (POST) y no un enlace
 * para que la precarga de un enlace no marque nada como leído.
 */
export async function abrirAviso(datos: FormData) {
  const sesion = await requerirSesion()
  const id = String(datos.get('id') ?? '')
  if (!esUuid(id)) redirect('/canal/avisos')

  const supabase = await createClient()
  const nucleo = supabase.schema('nucleo')
  const { data: n } = await nucleo.from('notificacion').select('id, tipo, objeto_tipo, objeto_id, enlace').eq('id', id).maybeSingle()
  if (!n) redirect('/canal/avisos')
  await nucleo.rpc('marcar_leidas', { p_ids: [id] })
  revalidatePath('/canal', 'layout')

  if (n.objeto_tipo && n.objeto_id && tieneFicha(n.objeto_tipo)) {
    const { data: puede } = await nucleo.rpc('puede_ver_objeto', { p_tipo: n.objeto_tipo, p_id: n.objeto_id })
    if (puede) redirect(hrefFicha(n.objeto_tipo, n.objeto_id))
  }
  if (n.tipo === 'tarea' && !n.objeto_id) redirect('/canal/tareas')
  if (n.enlace?.startsWith('/sistema') && tienePlataforma(sesion)) redirect(n.enlace)
  redirect(`/canal/avisos/${id}`)
}

/** Todos los avisos de la plataforma, leídos. */
export async function marcarAvisosLeidos() {
  await requerirSesion()
  const supabase = await createClient()
  await supabase.schema('nucleo').rpc('marcar_leidas', {})
  revalidatePath('/canal', 'layout')
}
