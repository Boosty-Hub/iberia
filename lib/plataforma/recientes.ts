import 'server-only'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Ficha } from '@/lib/plataforma/ficha-tipos'

/**
 * «Recientes» de Ctrl K: cada ficha que se abre (panel o página) queda en
 * `ui.reciente` de quien la abrió. Se anota **después** de responder (`after`),
 * así que abrir una ficha no espera a la base. La base vuelve a comprobar que
 * quien la abre la puede ver.
 */
const TIPOS = new Set(['unidad', 'plaza', 'cargo', 'persona', 'proceso', 'documento', 'requisicion', 'escenario'])

export async function anotarReciente(ficha: Ficha | null) {
  if (!ficha || !TIPOS.has(ficha.tipo) || !/^[0-9a-f-]{36}$/i.test(ficha.id)) return
  // El cliente se arma antes: dentro de `after` un componente de servidor ya no lee cookies.
  const supabase = await createClient()
  const detalle = [ficha.tipoEtiqueta, ficha.codigo ?? ficha.subtitulo].filter(Boolean).join(' · ')
  after(async () => {
    await supabase.schema('ui').rpc('registrar_reciente', { p_tipo: ficha.tipo, p_id: ficha.id, p_titulo: ficha.titulo, p_detalle: detalle || undefined })
  })
}
