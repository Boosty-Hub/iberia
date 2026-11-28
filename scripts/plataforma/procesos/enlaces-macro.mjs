/**
 * Los enlaces sugeridos documento → proceso de un macroproceso, en TSV (documento_id, código, título, proceso, rol), para
 * dárselos a la revisión a fondo de ese macroproceso (rediseño de Procesos, 28-nov-2026). Contra PRUEBAS.
 *
 *   node --env-file=.env.local scripts/plataforma/procesos/enlaces-macro.mjs 2.6 salida.tsv
 */
import { writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const macro = process.argv[2], salida = process.argv[3]
const db = createClient(process.env.SUPABASE_PRUEBAS_URL, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } }).schema('sgc')
const { data: p } = await db.from('proceso').select('ref, codigo_informe').is('escenario_id', null).eq('estado', 'vigente')
const cod = new Map(p.filter(x => x.codigo_informe === macro || (x.codigo_informe ?? '').startsWith(macro + '.')).map(x => [x.ref, x.codigo_informe]))
const all = []
for (let i = 0; ; i += 1000) { const { data } = await db.from('documento_proceso').select('proceso_ref, documento_id, rol, estado').range(i, i + 999); all.push(...data); if (data.length < 1000) break }
const en = all.filter(e => cod.has(e.proceso_ref) && e.estado !== 'descartado')
const ids = [...new Set(en.map(e => e.documento_id))]
const docs = []
for (let i = 0; i < ids.length; i += 200) { const { data } = await db.from('documento').select('id, codigo, titulo').in('id', ids.slice(i, i + 200)); docs.push(...data) }
const dm = new Map(docs.map(d => [d.id, d]))
writeFileSync(salida, en.map(e => [e.documento_id, dm.get(e.documento_id)?.codigo, dm.get(e.documento_id)?.titulo, cod.get(e.proceso_ref), e.rol + (e.estado === 'confirmado' ? ' (confirmado)' : '')].join('\t')).sort((a, b) => a.split('\t')[3].localeCompare(b.split('\t')[3])).join('\n'))
console.log(macro, en.length, 'enlaces')
