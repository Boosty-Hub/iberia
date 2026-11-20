'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Corregir los metadatos de un documento del inventario: estado, proceso,
 * familia, destino, nota y alias. Es una corrección trazada: el trigger de
 * auditoría guarda el antes y el después. El código y el título no se tocan
 * aquí (el código se corrige solo con motivo, cap. 05 §3.3), y el contenido
 * llega con la biblioteca de ciclo completo (F2).
 */

export type EstadoDocumento = { error?: string; ok?: string }

const ESTADOS = ['vigente', 'obsoleto', 'borrador', 'sin_determinar', 'retirado']
const DESTINOS = ['formulario', 'funcion', 'vista_espejo', 'no_migra']

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

export async function actualizarDocumento(_: EstadoDocumento, fd: FormData): Promise<EstadoDocumento> {
  await requerirPermiso('sistema:documentos', 'editar')
  const supabase = await createClient()
  const id = texto(fd, 'id')

  const estado = texto(fd, 'estado')
  if (!ESTADOS.includes(estado)) return { error: 'Elige un estado válido.' }
  const destino = texto(fd, 'destino') || null
  if (destino && !DESTINOS.includes(destino)) return { error: 'Destino no válido.' }
  const proceso = texto(fd, 'proceso_ref') || null
  if (proceso) {
    const { count } = await supabase
      .schema('sgc')
      .from('proceso')
      .select('id', { count: 'exact', head: true })
      .eq('ref', proceso)
      .is('escenario_id', null)
      .eq('estado', 'vigente')
    if (!count) return { error: 'El proceso elegido no está vigente.' }
  }
  const alias = [
    ...new Set(
      texto(fd, 'alias')
        .split(/[\n,;]+/)
        .map((a) => a.trim())
        .filter(Boolean),
    ),
  ]

  const { data, error } = await supabase
    .schema('sgc')
    .from('documento')
    .update({
      estado,
      destino,
      proceso_ref: proceso,
      familia: texto(fd, 'familia') || null,
      nota: texto(fd, 'nota') || null,
      alias,
    })
    .eq('id', id)
    .select('id')
  if (error) return { error: error.code === '42501' ? 'No tienes permiso para corregir documentos.' : error.message }
  // Sin política que lo deje, Postgres no se queja: filtra la fila y no cambia nada.
  if (!data?.length) return { error: 'No se guardó: el documento no existe o está fuera de tu alcance.' }

  revalidatePath('/sistema/nucleo/documentos')
  revalidatePath(`/sistema/nucleo/documentos/${id}`)
  return { ok: 'Guardado. El cambio queda en la auditoría.' }
}
