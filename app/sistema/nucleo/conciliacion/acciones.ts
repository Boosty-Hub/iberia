'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { mensajeDeError } from '@/components/sistema/organizacion/datos'
import type { Estado } from '@/components/sistema/organizacion/formulario'

const RECURSOS: Record<string, string> = {
  'NUC-ORG': 'sistema:estructura',
  'NUC-PRO': 'sistema:procesos',
  'NUC-DOC': 'sistema:documentos',
}

/**
 * Resolver, descartar o reabrir un punto de conciliación. El permiso depende del
 * módulo del punto (editar estructura, procesos o documentos): lo comprueba
 * `control.resolver_conciliacion` en la base, y también la política de la tabla.
 */
export async function resolverConciliacion(_a: Estado, fd: FormData): Promise<Estado> {
  const sesion = await requerirSesion()
  const supabase = await createClient()
  const id = String(fd.get('id') ?? '')
  const estado = String(fd.get('estado') ?? '')
  const resolucion = String(fd.get('resolucion') ?? '').trim()
  if (!['resuelto', 'descartado', 'abierto'].includes(estado)) return { error: 'Elige resolver, descartar o reabrir.' }
  // El permiso, antes de llamar: sin él la base esconde la fila y su mensaje sería «no existe».
  const { data: punto } = await supabase.schema('control').from('conciliacion').select('modulo').eq('id', id).maybeSingle()
  if (!punto) return { error: 'Ese punto de conciliación no existe o no lo puedes ver.' }
  const recurso = RECURSOS[punto.modulo]
  if (!recurso || !puede(sesion, recurso, 'editar')) {
    return { error: 'Para resolver este punto necesitas poder editar su módulo.' }
  }
  const { error } = await supabase.schema('control').rpc('resolver_conciliacion', {
    p_id: id,
    p_estado: estado,
    p_resolucion: resolucion,
  })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath('/sistema/nucleo/conciliacion')
  revalidatePath('/sistema/nucleo/organizacion')
  return { ok: estado === 'abierto' ? 'Reabierto.' : estado === 'resuelto' ? 'Marcado como resuelto.' : 'Descartado.' }
}
