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

const { data: docs, error } = await db.schema('sgc').from('documento').select('id, codigo, titulo, archivos, datos_sensibles').like('nota', `Revisión a fondo del macroproceso ${macro}%`)
if (error) throw error
const OFFICE = new Set(['.doc', '.docx', '.rtf', '.xls', '.xlsx', '.ppt', '.pptx'])
const tareas = []
for (const d of docs) {
  for (const [orden, ruta] of (d.archivos ?? []).entries()) {
    const src = path.join(BASE, ruta.replace(/\\/g, path.sep))
    if (!existsSync(src)) { tareas.push({ d, ruta, orden, estado: 'falta' }); continue }
    const bytes = await readFile(src)
    const huella = createHash('sha256').update(bytes).digest('hex')
    const ext = path.extname(ruta).toLowerCase()
    const t = { d, ruta, orden, huella, ext, tam: bytes.length, src, pdf: path.join(TRABAJO, `${huella.slice(0, 20)}.pdf`) }
    if (d.datos_sensibles) t.estado = 'retenido'
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
