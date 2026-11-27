'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { configMicrosoft } from '@/lib/asistente/microsoft'
import { guardarDeMicrosoft, listarArchivosMicrosoft, type ItemMicrosoft } from '@/lib/asistente/microsoft-archivos'
import { adjuntarDeBiblioteca, type Adjuntado } from '@/components/sistema/archivos/acciones'

/**
 * La pestaña «Microsoft 365» del «/» del chat (27-nov-2026). Sale a quien tiene el asistente, Mis archivos y
 * `m365:archivos` en su alcance; si no conectó su cuenta, la pestaña se lo ofrece.
 */

export type EstadoM365 = { disponible: boolean; conectado: boolean }

async function puedeUsar(): Promise<{ userId: string; conectado: boolean } | null> {
  const sesion = await requerirPermiso('sistema:asistente')
  if (!puede(sesion, 'sistema:archivos')) return null
  const supabase = await createClient()
  const [cfg, { data: alcance }, { data: conexion }] = await Promise.all([
    configMicrosoft(),
    supabase.schema('asistente').rpc('mi_alcance'),
    supabase.schema('asistente').from('conexion_microsoft').select('perfil_id').maybeSingle(),
  ])
  if (!cfg || !((alcance ?? []) as { fuente: string }[]).some((a) => a.fuente === 'm365:archivos')) return null
  return { userId: sesion.userId, conectado: !!conexion }
}

export async function estadoArchivosMicrosoft(): Promise<EstadoM365> {
  const p = await puedeUsar()
  return { disponible: !!p, conectado: !!p?.conectado }
}

export async function buscarEnMicrosoft(consulta: string): Promise<{ ok: true; items: ItemMicrosoft[] } | { ok: false; error: string; sinConexion?: boolean }> {
  const p = await puedeUsar()
  if (!p) return { ok: false, error: 'No tienes Microsoft 365 habilitado en el asistente.' }
  return listarArchivosMicrosoft(p.userId, String(consulta ?? ''))
}

/** Trae el archivo a Mis archivos › Microsoft 365 (o usa la copia, si no cambió) y lo adjunta al chat. */
export async function traerDeMicrosoft(itemId: string): Promise<{ ok: true; adjuntos: Adjuntado[]; como: 'nuevo' | 'igual' | 'actualizado' } | { ok: false; error: string }> {
  const p = await puedeUsar()
  if (!p) return { ok: false, error: 'No tienes Microsoft 365 habilitado en el asistente.' }
  const g = await guardarDeMicrosoft(p.userId, String(itemId ?? ''))
  if (!g.ok) return { ok: false, error: g.error }
  revalidatePath('/sistema/archivos', 'layout')
  const a = await adjuntarDeBiblioteca('archivo', g.archivo.id)
  if (!a.ok) return { ok: false, error: `Quedó en Mis archivos, pero no se pudo adjuntar: ${a.error}` }
  return { ok: true, adjuntos: a.adjuntos, como: g.como }
}
