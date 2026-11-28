/**
 * Sube los archivos de origen de los documentos que dio de alta la revisión de un macroproceso (`cargar-macro.mjs`):
 * esos no estaban en el manifiesto del 24-nov, así que no tenían PDF. Para cada archivo del documento:
 *   - .pdf: se sube tal cual;
 *   - Word, Excel y PowerPoint: se convierte con Office (`documentos-pdf/word-pdf.ps1`, el mismo de la carga grande);
 *   - Publisher, imágenes y lo demás: se anota `sin_conversion` (sube el original con el plan de pago).
 * Al bucket `documentos` como `pdf/<huella>.pdf` y a `sgc.documento_archivo`, igual que `cargar-documentos.mjs`.
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/subir-origen-macro.mjs --macro 1.1 [--revisar] [--destino produccion --confirmo]
 *
 * Idempotente por (documento, huella). El trabajo queda en `plataforma/_trabajo/origen-macros/<macro>/` (fuera de git).
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const opc = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const macro = opc('--macro')
if (!macro) throw new Error('Falta --macro')
const revisar = argv.includes('--revisar')
const produccion = opc('--destino') === 'produccion'
if (produccion && !argv.includes('--confirmo')) throw new Error('Para producción hace falta --confirmo')
const db = createClient(produccion ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_PRUEBAS_URL, produccion ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const BASE = path.resolve('Procesos Iberia')
const TRABAJO = path.resolve('plataforma/_trabajo/origen-macros', macro)
await mkdir(TRABAJO, { recursive: true })

// Los documentos del macroproceso: los dados de alta por su revisión y los del inventario enlazados a sus procesos.
const { data: altas, error } = await db.schema('sgc').from('documento').select('id, codigo, titulo, archivos, datos_sensibles').like('nota', `Revisión a fondo del macroproceso ${macro}%`)
if (error) throw error
const { data: procs } = await db.schema('sgc').from('proceso').select('ref, codigo_informe').is('escenario_id', null).eq('estado', 'vigente')
const refs = procs.filter((p) => p.codigo_informe === macro || (p.codigo_informe ?? '').startsWith(`${macro}.`)).map((p) => p.ref)
const { data: enlaces } = await db.schema('sgc').from('documento_proceso').select('documento_id').in('proceso_ref', refs).neq('estado', 'descartado')
const ids = [...new Set(enlaces.map((e) => e.documento_id))].filter((id) => !altas.some((a) => a.id === id))
// Por tandas: con cientos de ids la dirección de la consulta pasa del largo que acepta PostgREST.
const enTandas = async (xs, f) => { const out = []; for (let i = 0; i < xs.length; i += 150) { const { data, error: e } = await f(xs.slice(i, i + 150)); if (e) throw e; out.push(...data) } return out }
const inventario = await enTandas(ids, (t) => db.schema('sgc').from('documento').select('id, codigo, titulo, archivos, datos_sensibles').in('id', t))
const docs = [...altas, ...inventario]
// Lo ya disponible no se vuelve a subir; lo que la carga grande ya convirtió (manifiesto + pdf-final) se reusa.
const hechos = await enTandas(docs.map((d) => d.id), (t) => db.schema('sgc').from('documento_archivo').select('documento_id, huella, estado').in('documento_id', t))
const yaDisponible = new Set((hechos ?? []).filter((h) => h.estado === 'disponible').map((h) => `${h.documento_id}|${h.huella}`))
const CARGA = path.resolve('plataforma/_trabajo/documentos-pdf')
const manifiesto = existsSync(path.join(CARGA, 'manifiesto.json')) ? JSON.parse(await readFile(path.join(CARGA, 'manifiesto.json'), 'utf8')) : []
const pdfDeHuella = new Map(manifiesto.filter((a) => a.pdf).map((a) => [a.hash, path.join(CARGA, 'pdf-final', a.pdf)]))
console.log(`${altas.length} dados de alta y ${inventario.length} del inventario`)
const OFFICE = new Set(['.doc', '.docx', '.rtf', '.xls', '.xlsx', '.ppt', '.pptx'])
const tareas = []
for (const d of docs) {
  for (const [orden, ruta] of (d.archivos ?? []).entries()) {
    const src = path.join(BASE, ruta.replace(/\\/g, path.sep))
    if (!existsSync(src)) { tareas.push({ d, ruta, orden, estado: 'falta' }); continue }
    const bytes = await readFile(src)
    const huella = createHash('sha256').update(bytes).digest('hex')
    const ext = path.extname(ruta).toLowerCase()
    if (yaDisponible.has(`${d.id}|${huella}`)) continue
    const t = { d, ruta, orden, huella, ext, tam: bytes.length, src, pdf: path.join(TRABAJO, `${huella.slice(0, 20)}.pdf`) }
    const previo = pdfDeHuella.get(huella)
    if (previo && existsSync(previo) && !existsSync(t.pdf) && !revisar) await copyFile(previo, t.pdf)
    if (d.datos_sensibles) t.estado = 'retenido'
    else if (existsSync(t.pdf)) t.estado = 'disponible'
    else if (ext === '.pdf') { t.estado = 'disponible'; if (!revisar && !existsSync(t.pdf)) await copyFile(src, t.pdf) }
    else if (OFFICE.has(ext)) t.estado = 'convertir'
    else t.estado = 'sin_conversion'
    tareas.push(t)
  }
}

// Office: una sola tanda con el convertidor de la carga grande.
const porConvertir = tareas.filter((t) => t.estado === 'convertir' && !existsSync(t.pdf))
if (porConvertir.length && !revisar) {
  const lista = path.join(TRABAJO, 'tanda.tsv')
  await writeFile(lista, porConvertir.map((t) => `${t.ruta}\t${path.basename(t.pdf)}`).join('\n'), 'utf8')
  console.log(`Convirtiendo ${porConvertir.length} archivo(s) con Office…`)
  const r = spawnSync('pwsh', ['-NoProfile', '-File', path.resolve('scripts/plataforma/documentos-pdf/word-pdf.ps1'), '-Lista', lista, '-Base', BASE, '-Salida', TRABAJO], { stdio: 'inherit', timeout: 20 * 60_000 })
  if (r.status !== 0) console.warn('El convertidor terminó con errores; lo que no convirtió queda pendiente.')
}
for (const t of tareas) if (t.estado === 'convertir') t.estado = existsSync(t.pdf) ? 'disponible' : 'pendiente_plan'

for (const t of tareas) {
  console.log(`${t.d.codigo} · ${path.basename(t.ruta)} → ${t.estado}`)
  if (revisar || t.estado === 'falta') continue
  let pdf_ruta = null, pdf_tamano = null
  if (t.estado === 'disponible') {
    const cuerpo = await readFile(t.pdf)
    pdf_ruta = `pdf/${t.huella}.pdf`
    pdf_tamano = cuerpo.length
    const { error: eu } = await db.storage.from('documentos').upload(pdf_ruta, cuerpo, { contentType: 'application/pdf', upsert: true })
    if (eu) { console.warn('  no subió:', eu.message); continue }
  }
  const { error: ei } = await db.schema('sgc').from('documento_archivo').upsert({
    documento_id: t.d.id, nombre: path.basename(t.ruta), formato: t.ext.replace('.', ''), huella: t.huella, tamano_original: t.tam,
    estado: t.estado, pdf_ruta, pdf_tamano, paginas: null, original_ruta: null, orden: t.orden, actualizado_en: new Date().toISOString(),
  }, { onConflict: 'documento_id,huella' })
  if (ei) console.warn('  fila:', ei.message)
}
const n = (e) => tareas.filter((t) => t.estado === e).length
console.log(`Disponibles ${n('disponible')} · sin conversión ${n('sin_conversion')} · pendientes ${n('pendiente_plan')} · faltan ${n('falta')}${revisar ? ' (revisión: no se subió nada)' : ''}`)
void stat
