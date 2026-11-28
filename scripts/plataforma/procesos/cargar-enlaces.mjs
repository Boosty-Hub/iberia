/**
 * Carga los enlaces sugeridos documento ↔ proceso que dejó la revisión de los 1.307 documentos (27-nov-2026: cada
 * documento leído por dentro y ubicado en el mapa del informe). Quedan como «sugerido» en `sgc.documento_proceso`:
 * el principal y los «también aplica». Nadie los confirma aquí; se confirman en la plataforma.
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/cargar-enlaces.mjs [--revisar] [--destino produccion --confirmo]
 *
 * Lee `plataforma/propuestas/revision-documentos/res-G*.jsonl` (fuera de git). Idempotente: un enlace que ya existe
 * no se toca (si alguien lo confirmó o descartó, se respeta).
 */
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const revisar = argv.includes('--revisar')
const produccion = argv.includes('--destino') && argv[argv.indexOf('--destino') + 1] === 'produccion'
if (produccion && !argv.includes('--confirmo')) throw new Error('Para producción hace falta --confirmo')
const url = produccion ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_PRUEBAS_URL
const clave = produccion ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!url || !clave) throw new Error('Faltan las variables del proyecto')
const sgc = createClient(url, clave, { auth: { persistSession: false } }).schema('sgc')

const carpeta = path.resolve('plataforma/propuestas/revision-documentos')
const filas = []
for (const f of (await readdir(carpeta)).filter((x) => /^res-G\d\.jsonl$/.test(x)).sort()) {
  for (const l of (await readFile(path.join(carpeta, f), 'utf8')).split('\n')) if (l.trim()) filas.push(JSON.parse(l))
}
console.log(`${filas.length} documentos revisados`)

// Código del mapa (1.1.1, o II-62 para los sueltos) → ref del proceso vigente.
const { data: procesos, error: e1 } = await sgc.from('proceso').select('ref, codigo_informe, codigo_sgc').is('escenario_id', null).eq('estado', 'vigente')
if (e1) throw e1
const ref = new Map()
for (const p of procesos) {
  if (p.codigo_informe) ref.set(p.codigo_informe, p.ref)
  else if (p.codigo_sgc && !ref.has(p.codigo_sgc)) ref.set(p.codigo_sgc, p.ref)
}

const existentes = new Set()
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await sgc.from('documento_proceso').select('documento_id, proceso_ref').range(desde, desde + 999)
  if (error) throw error
  for (const x of data) existentes.add(`${x.documento_id}|${x.proceso_ref}`)
  if (data.length < 1000) break
}

const nuevos = []
const sinProceso = []
for (const r of filas) {
  const principal = ref.get(r.proceso)
  if (!principal) { sinProceso.push(`${r.codigo} → ${r.proceso}`); continue }
  const base = { documento_id: r.id, estado: 'sugerido', confianza: r.confianza ?? null, origen: 'revision-2026-11-27' }
  const vistos = new Set([principal])
  if (!existentes.has(`${r.id}|${principal}`)) nuevos.push({ ...base, proceso_ref: principal, rol: 'principal', razon: r.razon ?? null })
  for (const o of r.otros ?? []) {
    const x = ref.get(o)
    if (!x || vistos.has(x)) continue
    vistos.add(x)
    if (!existentes.has(`${r.id}|${x}`)) nuevos.push({ ...base, proceso_ref: x, rol: 'tambien', razon: `También aplica: ${r.razon ?? ''}`.trim() })
  }
}
console.log(`${nuevos.length} enlaces nuevos (${nuevos.filter((n) => n.rol === 'principal').length} principales)`)
if (sinProceso.length) console.log(`Sin proceso en el mapa (${sinProceso.length}):`, sinProceso.slice(0, 10))
if (revisar) process.exit(0)

for (let i = 0; i < nuevos.length; i += 500) {
  const { error } = await sgc.from('documento_proceso').insert(nuevos.slice(i, i + 500))
  if (error) throw error
}
console.log('Listo.')
