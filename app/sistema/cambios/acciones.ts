'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { mensajeDeError } from '@/components/sistema/organizacion/datos'

/** El borrador de cambios: quitar uno, enviar el lote a aprobación o descartarlo. La base comprueba que sea tuyo. */
export type EstadoCambios = { error?: string; ok?: string }

export async function quitarCambio(id: string): Promise<EstadoCambios> {
  await requerirSesion()
  const supabase = await createClient()
  const { error } = await supabase.schema('org').rpc('quitar_cambio', { p_id: id })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath('/sistema', 'layout')
  return { ok: 'Quitado de tu borrador.' }
}

export async function enviarCambios(_a: EstadoCambios, fd: FormData): Promise<EstadoCambios> {
  await requerirSesion()
  const esc = String(fd.get('escenario') ?? '')
  const fecha = String(fd.get('fecha') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Indica desde qué fecha rigen los cambios.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('org').rpc('enviar_cambios', { p_esc: esc, p_vigente_desde: fecha, p_nota: String(fd.get('nota') ?? '') })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath('/sistema', 'layout')
  redirect('/sistema/cambios?enviado=1')
}

export async function descartarCambios(_a: EstadoCambios, fd: FormData): Promise<EstadoCambios> {
  await requerirSesion()
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla para confirmar: se borran todos los cambios del borrador.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('org').rpc('descartar_cambios', { p_esc: String(fd.get('escenario') ?? '') })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath('/sistema', 'layout')
  redirect('/sistema/cambios?descartado=1')
}
