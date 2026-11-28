/**
 * Las revisiones y transcripciones de cada macroproceso se hicieron contra PRUEBAS y citan ids de `sgc.documento`. Los del
 * inventario son los mismos en producción (se importaron con su id), pero los documentos dados de alta por una revisión
 * nacen con id nuevo en cada base. Para cargar en producción, un id que no existe allá se busca por su código y su título
 * en pruebas y se traduce al documento de producción con el mismo código y título (28-nov-2026, al publicar el rediseño).
 */
import { createClient } from '@supabase/supabase-js'

export function resolutorDeIds(destino, produccion) {
  if (!produccion) return async (id) => id
  const pruebas = createClient(process.env.SUPABASE_PRUEBAS_URL, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } }).schema('sgc')
  const cache = new Map()
  return async (id) => {
    if (!id) return id
    if (cache.has(id)) return cache.get(id)
    const { data: ya } = await destino.from('documento').select('id').eq('id', id).maybeSingle()
    let r = ya?.id ?? null
    if (!r) {
      const { data: p } = await pruebas.from('documento').select('codigo, titulo').eq('id', id).maybeSingle()
      if (p) {
        const { data: m } = await destino.from('documento').select('id').eq('codigo', p.codigo).eq('titulo', p.titulo).limit(1)
        r = m?.[0]?.id ?? null
      }
    }
    cache.set(id, r)
    return r
  }
}
