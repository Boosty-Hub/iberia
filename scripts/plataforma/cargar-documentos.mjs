/**
 * Carga los archivos de origen de los documentos del SGC al bucket `documentos` y los anota en
 * `sgc.documento_archivo` (migración 20261124020000).
 *
 *   node --env-file=.env.local scripts/plataforma/cargar-documentos.mjs --revisar            # qué haría, en pruebas
 *   node --env-file=.env.local scripts/plataforma/cargar-documentos.mjs --limite 40          # pruebas, solo 40 PDF
 *   … --destino produccion --confirmo [--presupuesto-mb 850]                                 # producción
 *   … --originales --destino produccion --confirmo                                          # con el plan de pago
 *
 * La materia prima sale de `plataforma/_trabajo/documentos-pdf/` (fuera de git, material bajo NDA):
 * `manifiesto.json` (cada archivo del repositorio de Iberia con su huella y los documentos que lo citan),
 * `final.json` y `pdf-final/` (el PDF optimizado de cada uno: Word/Excel/PowerPoint a PDF y recomprimido).
 *
 * Reglas:
 *   - Solo PDF mientras el proyecto esté en el plan gratis (1 GB de Storage para todo). Entra lo que cabe en
 *     `--presupuesto-mb` (por defecto 850, contando lo que ya ocupan los demás buckets), primero los archivos de
 *     documentos vigentes, luego borradores, sin determinar y obsoletos; dentro de cada grupo, los livianos primero.
 *     Lo demás queda `pendiente_plan` y entra al volver a correrlo con más espacio.
 *   - Un archivo de un documento con datos personales o credenciales (`datos_sensibles`) queda `retenido`: no sube.
 *   - Visio, Publisher e InfoPath no tienen vista previa: `sin_conversion`, sube el original con el plan.
 *   - El nombre en el bucket es la huella (`pdf/<huella>.pdf`): nunca la ruta del repositorio de Iberia.
 *   - Es idempotente: lo que ya está en el bucket no se vuelve a subir, y las filas se actualizan por
 *     (documento, huella).
 */
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const opc = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d)
const destino = opc('--destino', 'pruebas')
const REVISAR = args.includes('--revisar')
const ORIGINALES = args.includes('--originales')
const PRESUPUESTO = Number(opc('--presupuesto-mb', '850')) * 1e6
const LIMITE = args.includes('--limite') ? Number(opc('--limite')) : Infinity
const CARPETA = opc('--carpeta', 'plataforma/_trabajo/documentos-pdf')
const BUCKET = 'documentos'

if (!['pruebas', 'produccion'].includes(destino)) throw new Error('--destino debe ser pruebas o produccion.')
if (destino === 'produccion' && !REVISAR && !args.includes('--confirmo')) throw new Error('Producción pide --confirmo.')
const env = process.env
const cfg =
  destino === 'produccion'
    ? { url: env.NEXT_PUBLIC_SUPABASE_URL, clave: env.SUPABASE_SECRET_KEY, ref: env.SUPABASE_PROJECT_REF }
    : { url: env.SUPABASE_PRUEBAS_URL, clave: env.SUPABASE_PRUEBAS_SECRET_KEY, ref: env.SUPABASE_PRUEBAS_REF }
if (!cfg.url || !cfg.clave || !cfg.ref || !env.SUPABASE_ACCESS_TOKEN) throw new Error(`Faltan las variables del proyecto de ${destino}`)
if (destino === 'pruebas' && cfg.url === env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se corre')
const db = createClient(cfg.url, cfg.clave, { auth: { persistSession: false } })

async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${cfg.ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, read_only: true }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`SQL ${r.status}: ${t}`)
  return JSON.parse(t)
}

const MB = (b) => `${(b / 1e6).toFixed(1)} MB`
const RANGO = { vigente: 0, borrador: 1, sin_determinar: 2, obsoleto: 3, retirado: 4 }
const TIPO = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', jpg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', dot: 'application/msword' }

console.log(`Destino: ${destino} (${new URL(cfg.url).host})${REVISAR ? ' · solo revisar' : ''}${ORIGINALES ? ' · con originales' : ''}`)

// ── La materia prima ──
const manifiesto = JSON.parse(await readFile(path.join(CARPETA, 'manifiesto.json'), 'utf8'))
const final = existsSync(path.join(CARPETA, 'final.json')) ? JSON.parse(await readFile(path.join(CARPETA, 'final.json'), 'utf8')) : {}

// ── Los documentos del destino (con la clave de servicio: todos, perímetros incluidos) ──
const docs = new Map()
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await db.schema('sgc').from('documento').select('id, estado, datos_sensibles, archivos').range(desde, desde + 999)
  if (error) throw error
  for (const d of data) docs.set(d.id, d)
  if (data.length < 1000) break
}

// ── Lo que ya ocupa el proyecto ──
const [{ otros }] = await sql(`select coalesce(sum((metadata->>'size')::bigint), 0)::bigint as otros from storage.objects where bucket_id <> '${BUCKET}'`)
const yaSubidos = new Map((await sql(`select name, (metadata->>'size')::bigint as tam from storage.objects where bucket_id = '${BUCKET}'`)).map((o) => [o.name, Number(o.tam)]))
const ocupadoNuestro = [...yaSubidos.values()].reduce((s, x) => s + x, 0)
console.log(`Storage: otros buckets ${MB(Number(otros))}, documentos ${MB(ocupadoNuestro)} (${yaSubidos.size} objetos); presupuesto ${MB(PRESUPUESTO)}`)

// ── Estado de cada archivo ──
const archivos = manifiesto
  .map((a) => ({ ...a, docs: a.docs.filter((id) => docs.has(id)) }))
  .filter((a) => a.docs.length)
const candidatos = []
for (const a of archivos) {
  const ds = a.docs.map((id) => docs.get(id))
  a.rango = Math.min(...ds.map((d) => RANGO[d.estado] ?? 5))
  if (a.estado === 'falta') a.estadoCarga = 'falta'
  else if (ds.some((d) => d.datos_sensibles)) a.estadoCarga = 'retenido'
  else if (a.clase === 'sin_conversion') a.estadoCarga = 'sin_conversion'
  else if (!final[a.pdf]?.tam) a.estadoCarga = 'pendiente_plan'
  else candidatos.push(a)
}
// Un mismo PDF puede salir de varias filas del manifiesto (rutas distintas, mismo contenido): se cuenta una vez.
const porPdf = new Map()
for (const a of candidatos) if (!porPdf.has(a.pdf) || porPdf.get(a.pdf).rango > a.rango) porPdf.set(a.pdf, a)
const orden = [...porPdf.values()].sort((x, y) => x.rango - y.rango || final[x.pdf].tam - final[y.pdf].tam)
let usado = Number(otros)
const entran = new Set()
let subir = []
for (const a of orden) {
  const ruta = `pdf/${a.pdf}`
  const tam = final[a.pdf].tam
  if (yaSubidos.has(ruta)) {
    usado += yaSubidos.get(ruta)
    entran.add(a.pdf)
    continue
  }
  if (usado + tam > PRESUPUESTO || subir.length >= LIMITE) continue
  usado += tam
  entran.add(a.pdf)
  subir.push(a)
}
for (const a of candidatos) a.estadoCarga = entran.has(a.pdf) ? 'disponible' : 'pendiente_plan'

const cuenta = {}
for (const a of archivos) cuenta[a.estadoCarga] = (cuenta[a.estadoCarga] ?? 0) + 1
const pendientes = [...porPdf.values()].filter((a) => !entran.has(a.pdf))
const docsConPdf = new Set(archivos.filter((a) => a.estadoCarga === 'disponible').flatMap((a) => a.docs))
console.log('Archivos por estado:', cuenta)
console.log(`Entran ${entran.size} PDF (subir ahora ${subir.length}, ${MB(subir.reduce((s, a) => s + final[a.pdf].tam, 0))}); Storage quedaría en ${MB(usado)}`)
console.log(`Documentos con al menos un archivo para ver: ${docsConPdf.size} de ${docs.size}`)
console.log(`Quedan para el plan de pago: ${pendientes.length} PDF (${MB(pendientes.reduce((s, a) => s + final[a.pdf].tam, 0))}) y los originales (${MB(archivos.reduce((s, a) => s + (a.tam ?? 0), 0))})`)
if (REVISAR) process.exit(0)

// ── Subir ──
const BASE = opc('--base', 'Procesos Iberia')
async function enTandas(xs, n, f) {
  let i = 0
  let hechos = 0
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < xs.length) {
        const x = xs[i++]
        await f(x)
        if (++hechos % 100 === 0) console.log(`  … ${hechos}/${xs.length}`)
      }
    })
  )
}
const fallidos = []
await enTandas(subir, 6, async (a) => {
  const cuerpo = await readFile(path.join(CARPETA, 'pdf-final', a.pdf))
  const { error } = await db.storage.from(BUCKET).upload(`pdf/${a.pdf}`, cuerpo, { contentType: 'application/pdf', upsert: false })
  if (error && !/exists/i.test(error.message)) {
    fallidos.push(a.pdf)
    a.estadoCarga = 'pendiente_plan'
    console.error(`  ✖ ${a.pdf}: ${error.message}`)
  }
})
for (const a of candidatos) if (fallidos.includes(a.pdf)) a.estadoCarga = 'pendiente_plan'

// Con el plan de pago: también el original, tal cual (`original/<huella>.<ext>`).
const originales = new Map()
if (ORIGINALES) {
  const xs = [...new Map(archivos.filter((a) => a.estadoCarga !== 'falta' && a.estadoCarga !== 'retenido').map((a) => [a.hash, a])).values()]
  await enTandas(xs, 4, async (a) => {
    const ext = a.ext.replace('.', '')
    const ruta = `original/${a.hash.slice(0, 20)}.${ext}`
    if (!yaSubidos.has(ruta)) {
      const cuerpo = await readFile(path.join(BASE, ...a.ruta.split('\\')))
      const { error } = await db.storage.from(BUCKET).upload(ruta, cuerpo, { contentType: TIPO[ext] ?? 'application/octet-stream', upsert: false })
      if (error && !/exists/i.test(error.message)) return console.error(`  ✖ original ${a.ruta.split('\\').pop()}: ${error.message}`)
    }
    originales.set(a.hash, ruta)
  })
}

// ── Las filas ──
const filas = new Map()
for (const a of archivos) {
  for (const id of a.docs) {
    const clave = `${id}|${a.hash ?? a.ruta}`
    if (filas.has(clave)) continue
    const d = docs.get(id)
    const disponible = a.estadoCarga === 'disponible'
    const nombre = a.ruta.split('\\').pop()
    filas.set(clave, {
      documento_id: id,
      nombre,
      formato: (a.ext ?? path.extname(nombre)).replace('.', '').toLowerCase() || '?',
      huella: a.hash ?? `falta:${nombre}`,
      tamano_original: a.tam ?? null,
      estado: a.estadoCarga === 'sin_conversion' && originales.has(a.hash) ? 'sin_conversion' : a.estadoCarga,
      pdf_ruta: disponible ? `pdf/${a.pdf}` : null,
      pdf_tamano: disponible ? final[a.pdf].tam : null,
      paginas: disponible ? final[a.pdf].paginas : null,
      original_ruta: originales.get(a.hash) ?? null,
      orden: Math.max(0, (d.archivos ?? []).indexOf(a.ruta)),
      actualizado_en: new Date().toISOString(),
    })
  }
}
const lista = [...filas.values()]
for (let i = 0; i < lista.length; i += 500) {
  const { error } = await db.schema('sgc').from('documento_archivo').upsert(lista.slice(i, i + 500), { onConflict: 'documento_id,huella' })
  if (error) throw error
}
console.log(`✓ ${lista.length} filas en sgc.documento_archivo · ${subir.length - fallidos.length} PDF subidos${fallidos.length ? ` · ${fallidos.length} fallidos` : ''}`)
