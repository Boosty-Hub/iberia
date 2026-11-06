'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { UUID } from '@/lib/reportes'
import { createClient } from '@/lib/supabase/server'

const RUTA = '/dashboard/reportes'

/**
 * Marca un reporte como revisado, o lo reabre.
 *
 * La página ya esconde el botón a quien no puede, pero la acción no confía en
 * eso: pide la casilla de editar, y la función de la base la pide otra vez.
 */
export async function revisarReporte(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')

  const id = String(datos.get('id') ?? '')
  if (!UUID.test(id)) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('revisar_reporte', {
    p_reporte: id,
    p_revisado: datos.get('revisado') === 'si',
  })

  if (error) redirect(`${RUTA}?aviso=error`)
  revalidatePath(RUTA)
}

/**
 * Oculta lo reportado —o lo devuelve— y da por revisados todos los reportes de esa
 * misma cosa. No borra nada: la función cambia el `estado` de la fila de origen
 * (mensaje o comentario `oculto`, publicación `archivado`), y se restaura igual.
 */
export async function ocultarReportado(datos: FormData) {
  await requerirPermiso('modulo:reportes', 'editar')

  const id = String(datos.get('id') ?? '')
  if (!UUID.test(id)) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('ocultar_contenido_reportado', {
    p_reporte: id,
    p_ocultar: datos.get('ocultar') === 'si',
  })

  if (error) redirect(`${RUTA}?aviso=error`)
  revalidatePath(RUTA)
}
