/**
 * Carga en `asistente.documento_pagina` el texto por página que dejó
 * `extraer-paginas.py`, enlazado a su archivo por la ruta del PDF
 * (`sgc.documento_archivo.pdf_ruta`, o la huella si la fila no tiene ruta todavía). Idempotente: vuelve a
 * escribir las páginas de cada archivo.
 *
 *   node --env-file=.env.local scripts/asistente/indexar-documentos.mjs [--destino pruebas|produccion] [--confirmo]
 */
import { createClient } from '@supabase/supabase-js'
import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

const argv = process.argv.slice(2)
const destino = argv.includes('--destino') ? argv[argv.indexOf('--destino') + 1] : 'pruebas'
if (destino === 'produccion' && !argv.includes('--confirmo')) throw new Error('A producción, solo con --confirmo')
const url = destino === 'produccion' ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_PRUEBAS_URL
const secreto = destino === 'produccion' ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PRUEBAS_SECRET_KEY
const db = createClient(url, secreto, { auth: { persistSession: false } })

// Los archivos con PDF, de mil en mil (Supabase corta en 1.000 sin avisar).
const porRuta = new Map()
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await db.schema('sgc').from('documento_archivo').select('id, documento_id, pdf_ruta, huella').not('huella', 'is', null).order('id').range(desde, desde + 999)
  if (error) throw error
  // El PDF se llama por los primeros 20 caracteres de la huella (cargar-documentos.mjs).
  for (const a of data) porRuta.set(a.pdf_ruta ?? `pdf/${a.huella.slice(0, 20)}.pdf`, a)
  if (data.length < 1000) break
}
console.log(`${porRuta.size} archivos en ${destino}`)

let lote = []
let cargadas = 0
let sinArchivo = 0
const borrados = new Set()
async function vaciar() {
  if (!lote.length) return
  for (const id of new Set(lote.map((f) => f.archivo_id))) {
    if (borrados.has(id)) continue
    await db.schema('asistente').from('documento_pagina').delete().eq('archivo_id', id)
    borrados.add(id)
  }
  const { error } = await db.schema('asistente').from('documento_pagina').upsert(lote)
  if (error) throw error
  cargadas += lote.length
  lote = []
}
const lineas = createInterface({ input: createReadStream('plataforma/_trabajo/documentos-pdf/paginas.jsonl', 'utf8') })
for await (const linea of lineas) {
  if (!linea.trim()) continue
  const p = JSON.parse(linea)
  const a = porRuta.get(`pdf/${p.pdf}`)
  if (!a) {
    sinArchivo++
    continue
  }
  lote.push({ archivo_id: a.id, documento_id: a.documento_id, pagina: p.pagina, texto: p.texto })
  if (lote.length >= 500) await vaciar()
}
await vaciar()
console.log(`${cargadas} páginas cargadas · ${sinArchivo} páginas de PDF que no están en ${destino}`)
