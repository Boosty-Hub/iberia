'use server'

import { revalidatePath } from 'next/cache'
import { requerirEditor } from '@/lib/auth'
import { BUCKET_ARCHIVOS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIAS_ARCHIVO, type CategoriaArchivo } from '@/lib/types'

export type ResultadoArchivo = { ok?: boolean; error?: string; id?: string }

const CATEGORIAS = Object.keys(CATEGORIAS_ARCHIVO) as CategoriaArchivo[]

/**
 * Registra en la base el archivo que el navegador ya subió a Storage.
 * El binario nunca pasa por el servidor de Next: solo su metadata.
 */
export async function registrarArchivo(entrada: {
  nombre: string
  storagePath: string
  mimeType?: string | null
  tamanoBytes?: number | null
  descripcion?: string | null
  categoria?: string | null
  areaId?: string | null
  entrevistaId?: string | null
  fase?: number | null
  confidencial?: boolean
}): Promise<ResultadoArchivo> {
  const { userId } = await requerirEditor()
  const supabase = await createClient()

  const nombre = entrada.nombre?.trim()
  const storagePath = entrada.storagePath?.trim()

  if (!nombre) return { error: 'El archivo necesita un nombre.' }
  if (!storagePath) return { error: 'Falta la ruta en Storage.' }

  const categoria =
    entrada.categoria && CATEGORIAS.includes(entrada.categoria as CategoriaArchivo)
      ? (entrada.categoria as CategoriaArchivo)
      : 'otro'

  const fase =
    typeof entrada.fase === 'number' && entrada.fase >= 1 && entrada.fase <= 4
      ? entrada.fase
      : null

  const { data, error } = await supabase
    .from('archivos')
    .insert({
      nombre: nombre.slice(0, 300),
      descripcion: entrada.descripcion?.trim() || null,
      storage_path: storagePath,
      mime_type: entrada.mimeType || null,
      tamano_bytes:
        typeof entrada.tamanoBytes === 'number' && entrada.tamanoBytes >= 0
          ? entrada.tamanoBytes
          : null,
      categoria,
      area_id: entrada.areaId || null,
      entrevista_id: entrada.entrevistaId || null,
      fase,
      confidencial: entrada.confidencial ?? true,
      uploaded_by: userId,
    })
    .select('id')
    .single()

  if (error) {
    return { error: `No se pudo registrar el archivo: ${error.message}` }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/archivos')
  if (entrada.entrevistaId) {
    revalidatePath(`/dashboard/entrevistas/${entrada.entrevistaId}`)
  }

  return { ok: true, id: data.id }
}

/**
 * Borra un objeto huérfano de Storage. Se usa cuando la subida funcionó pero
 * el registro en base falló: sin esto quedaría un binario invisible pagando
 * almacenamiento.
 */
export async function descartarSubida(storagePath: string): Promise<void> {
  await requerirEditor()
  if (!storagePath) return
  const supabase = await createClient()
  await supabase.storage.from(BUCKET_ARCHIVOS).remove([storagePath])
}

export async function eliminarArchivo(fd: FormData) {
  await requerirEditor()
  const supabase = await createClient()

  const id = String(fd.get('id') ?? '')
  if (!id) return

  const { data: archivo } = await supabase
    .from('archivos')
    .select('storage_path, entrevista_id')
    .eq('id', id)
    .maybeSingle()

  if (!archivo) return

  // Primero la fila: si el borrado en Storage falla, no queda un registro
  // apuntando a un binario inexistente.
  const { error } = await supabase.from('archivos').delete().eq('id', id)
  if (error) return

  await supabase.storage.from(BUCKET_ARCHIVOS).remove([archivo.storage_path])

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/archivos')
  if (archivo.entrevista_id) {
    revalidatePath(`/dashboard/entrevistas/${archivo.entrevista_id}`)
  }
}

