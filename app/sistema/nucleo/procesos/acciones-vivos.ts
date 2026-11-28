'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/database.types'

/**
 * Acciones del rediseño de Procesos (28-nov-2026): confirmar los enlaces sugeridos y editar un documento por
 * secciones. Cada una vuelve a pedir su permiso y la base lo vuelve a preguntar (las funciones `sgc.*` son la única
 * puerta de escritura). Solo funciones async.
 */

export type Resultado = { error?: string; ok?: string; version?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function mensaje(e: { message?: string } | null): string {
  const m = e?.message ?? 'No se pudo.'
  return m.replace(/^.*?:\s*(?=[A-ZÁÉÍÓÚ])/, '')
}

export async function confirmarEnlace(id: string, proceso?: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(id) || (proceso && !UUID.test(proceso))) return { error: 'Enlace no válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('confirmar_enlace', { p_id: id, p_proceso: proceso ?? undefined })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  revalidatePath('/sistema/nucleo/documentos', 'layout')
  return { ok: 'Enlace confirmado.' }
}

export async function descartarEnlace(id: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(id)) return { error: 'Enlace no válido.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('descartar_enlace', { p_id: id })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  return { ok: 'Enlace descartado.' }
}

export async function confirmarEnlacesProceso(proceso: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:procesos')
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }
  if (!UUID.test(proceso)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('sgc').rpc('confirmar_enlaces_proceso', { p_proceso: proceso })
  if (error) return { error: mensaje(error) }
  revalidatePath('/sistema/nucleo/procesos', 'layout')
  return { ok: `${data ?? 0} enlaces confirmados.` }
}

const TIPOS_BLOQUE = new Set(['parrafo', 'lista', 'tabla', 'paso', 'decision', 'referencia'])

/** Guarda una sección en el borrador propio (lo abre si no existe). `seccion = -1` agrega una nueva al final. */
export async function guardarSeccion(documento: string, seccion: number, titulo: string, bloques: unknown, motivo?: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:documentos')
  if (!puede(sesion, 'sistema:documentos', 'editar')) return { error: 'No tienes permiso para editar documentos.' }
  if (!UUID.test(documento) || !Number.isInteger(seccion)) return { error: 'Documento no válido.' }
  if (!Array.isArray(bloques) || bloques.some((b) => !b || typeof b !== 'object' || !TIPOS_BLOQUE.has((b as { tipo?: string }).tipo ?? ''))) {
    return { error: 'La sección viene mal formada.' }
  }
  if (JSON.stringify(bloques).length > 200_000) return { error: 'La sección es demasiado larga.' }
  const supabase = await createClient()
  const { data, error } = await supabase.schema('sgc').rpc('guardar_seccion_documento', {
    p_documento: documento, p_seccion: seccion, p_titulo: titulo.trim().slice(0, 300), p_bloques: bloques as Json, p_motivo: motivo?.trim() || undefined,
  })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/documentos/${documento}`)
  return { ok: 'Borrador guardado.', version: data as string }
}

export async function descartarBorrador(documento: string, version: string): Promise<Resultado> {
  await requerirPermiso('sistema:documentos')
  if (!UUID.test(version)) return { error: 'Versión no válida.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('descartar_borrador_documento', { p_version: version })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/documentos/${documento}`)
  return { ok: 'Borrador descartado.' }
}

/** Envía a revisión un borrador propio o una transcripción por validar. Entra a la ruta dueño del proceso → Calidad. */
export async function enviarDocumento(documento: string, version: string, motivo: string): Promise<Resultado> {
  const sesion = await requerirPermiso('sistema:documentos')
  if (!puede(sesion, 'sistema:documentos', 'editar')) return { error: 'No tienes permiso para editar documentos.' }
  if (!UUID.test(version)) return { error: 'Versión no válida.' }
  if (motivo.trim().length < 3) return { error: 'Escribe el motivo del cambio.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('sgc').rpc('enviar_documento', { p_version: version, p_motivo: motivo.trim().slice(0, 1000) })
  if (error) return { error: mensaje(error) }
  revalidatePath(`/sistema/nucleo/documentos/${documento}`)
  revalidatePath('/sistema/bandeja')
  return { ok: 'Enviado a revisión: le llega al dueño del proceso en su bandeja.' }
}
