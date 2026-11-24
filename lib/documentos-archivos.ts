import 'server-only'
import { obtenerSesion, puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/** El bucket privado de los archivos de origen de los documentos del SGC (`sgc.documento_archivo`). */
export const BUCKET_DOCUMENTOS = 'documentos'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ArchivoDeDocumento = {
  nombre: string
  formato: string
  pdf_ruta: string | null
  original_ruta: string | null
}

/**
 * El archivo, si quien pide puede ver su documento: la casilla en la app y la RLS de `sgc.documento_archivo` (que
 * pregunta por `sgc.documento`, perímetros incluidos) en la base. El bucket lo vuelve a preguntar al leer.
 */
export async function archivoVisible(id: string): Promise<{ archivo: ArchivoDeDocumento; supabase: Awaited<ReturnType<typeof createClient>> } | { error: string; status: number }> {
  const sesion = await obtenerSesion()
  if (!sesion) return { error: 'Sesión requerida', status: 401 }
  if (!puede(sesion, 'sistema:documentos')) return { error: 'Tu rol no abre documentos', status: 403 }
  if (!UUID.test(id)) return { error: 'Archivo no encontrado', status: 404 }
  const supabase = await createClient()
  const { data } = await supabase.schema('sgc').from('documento_archivo').select('nombre, formato, pdf_ruta, original_ruta').eq('id', id).maybeSingle()
  if (!data) return { error: 'Archivo no encontrado', status: 404 }
  return { archivo: data, supabase }
}

/** «II-31-40-001 Control.docx» → «II-31-40-001 Control.pdf». */
export function nombrePdf(nombre: string): string {
  return nombre.replace(/\.[^.]+$/, '') + '.pdf'
}
