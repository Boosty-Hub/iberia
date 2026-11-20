'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { conciliar } from '@/lib/plataforma/fichas/procesos'

/**
 * Acciones de las tablas de Documentos (R2). Corregir metadatos va por la
 * ficha (`manejarDocumento`); aquí queda «Resolver» desde la cola de
 * conciliación. Solo funciones async.
 */

const MOTIVOS = new Set(['sin_determinar', 'obsoleto', 'codigo_reutilizado', 'datos_sensibles'])

/** «Resolver» en una fila de la cola: la clave es `documento:motivo`. */
export async function resolverDesdeCola(clave: string, accion: string, texto: string): Promise<{ error?: string; ficha?: string | null }> {
  const sesion = await requerirPermiso('sistema:documentos')
  if (accion !== 'resolver') return { error: 'Acción no reconocida.' }
  if (!puede(sesion, 'sistema:documentos', 'editar')) return { error: 'Conciliar pide el permiso de editar documentos.' }
  const [id, motivo] = clave.split(':')
  if (!/^[0-9a-f-]{36}$/i.test(id ?? '') || !MOTIVOS.has(motivo ?? '')) return { error: 'Punto de la cola no válido.' }
  const supabase = await createClient()
  const r = await conciliar(supabase, sesion.userId, id, motivo, texto)
  if (r.error) return { error: r.error }
  revalidatePath('/sistema/nucleo/documentos', 'layout')
  return {}
}
