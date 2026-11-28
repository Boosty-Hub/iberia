/**
 * Qué archivos de origen de un macroproceso no tienen todavía dónde está su contenido en la plataforma: ni una versión,
 * ni un registro, ni la nota de copia. Cubre los documentos principales del macroproceso y los que también aplican en él.
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/pendientes-transcripcion.mjs --macro 1.2 [--salida lista.json]
 */
import { existsSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const opc = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)
const macro = opc('--macro')
if (!macro) throw new Error('Falta --macro')
const produccion = opc('--destino') === 'produccion'
const sgc = createClient(produccion ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_PRUEBAS_URL, produccion ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } }).schema('sgc')
const { data: procs } = await sgc.from('proceso').select('ref, codigo_informe').is('escenario_id', null).eq('estado', 'vigente')
const refs = procs.filter((p) => p.codigo_informe === macro || (p.codigo_informe ?? '').startsWith(`${macro}.`)).map((p) => p.ref)
const { data: en } = await sgc.from('documento_proceso').select('documento_id').in('proceso_ref', refs).neq('estado', 'descartado')
const ids = [...new Set(en.map((e) => e.documento_id))]
// Por tandas: con cientos de ids la dirección de la consulta pasa del largo que acepta PostgREST.
const docs = [], vs = [], rs = [], as = []
for (let i = 0; i < ids.length; i += 150) {
  const t = ids.slice(i, i + 150)
  const r = await Promise.all([
    sgc.from('documento').select('id, codigo, titulo, tipo_yy, archivos').in('id', t),
    sgc.from('documento_version').select('documento_id, archivo_ruta').in('documento_id', t),
    sgc.from('documento_registro').select('documento_id, archivo_ruta').in('documento_id', t),
    sgc.from('documento_archivo').select('documento_id, nombre, transcripcion').in('documento_id', t),
  ])
  for (const x of r) if (x.error) throw x.error
  docs.push(...r[0].data); vs.push(...r[1].data); rs.push(...r[2].data); as.push(...r[3].data)
}
const barra = String.fromCharCode(92)
const nombre = (r) => r.split(barra).pop().split('/').pop()
const lista = []
for (const d of docs) {
  const hechos = new Set([...vs, ...rs].filter((x) => x.documento_id === d.id && x.archivo_ruta).map((x) => nombre(x.archivo_ruta)))
  for (const a of as.filter((x) => x.documento_id === d.id && x.transcripcion?.startsWith('Mismo contenido'))) hechos.add(a.nombre)
  for (const ruta of d.archivos ?? []) {
    if (hechos.has(nombre(ruta))) continue
    if (/\.lnk$/i.test(ruta) || /^~\$/.test(nombre(ruta))) continue // accesos directos y archivos de bloqueo de Office (~$…): sin contenido propio
    const txt = 'levantamiento-iso/texto/' + ruta.split(barra).join('/') + '.txt'
    lista.push({ documento_id: d.id, codigo: d.codigo, titulo: d.titulo, tipo_yy: d.tipo_yy, archivo: ruta, texto: existsSync(txt) ? txt : null })
  }
}
console.log(`${docs.length} documentos · ${lista.length} archivos sin cuenta de su contenido`)
if (opc('--salida')) writeFileSync(opc('--salida'), JSON.stringify(lista, null, 1))
