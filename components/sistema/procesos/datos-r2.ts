import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/database.types'

/**
 * Lecturas completas de las fuentes de `ui` para los resúmenes (R2), de mil en
 * mil: la API corta en mil filas sin avisar (AGENTS.md, «Trampas»).
 */

type Cliente = Awaited<ReturnType<typeof createClient>>
export type FilaDocumento = Database['ui']['Functions']['documentos']['Returns'][number]
export type FilaProcesoUi = Database['ui']['Functions']['procesos']['Returns'][number]

export async function todosLosDocumentos(supabase: Cliente): Promise<FilaDocumento[]> {
  const filas: FilaDocumento[] = []
  for (let desde = 0; desde < 50_000; desde += 1000) {
    const { data, error } = await supabase.schema('ui').rpc('documentos').order('id').range(desde, desde + 999)
    if (error || !data) break
    filas.push(...data)
    if (data.length < 1000) break
  }
  return filas
}

export async function todosLosProcesos(supabase: Cliente, al: string): Promise<FilaProcesoUi[]> {
  const filas: FilaProcesoUi[] = []
  for (let desde = 0; desde < 20_000; desde += 1000) {
    const { data, error } = await supabase.schema('ui').rpc('procesos', { p_al: al }).order('ruta').range(desde, desde + 999)
    if (error || !data) break
    filas.push(...data)
    if (data.length < 1000) break
  }
  return filas
}
