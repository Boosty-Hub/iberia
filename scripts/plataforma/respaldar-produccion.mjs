/**
 * Respaldo de los DATOS de producción antes de migrar (el plan gratis no tiene
 * PITR). Solo lectura en producción. Deja, fuera de git (NDA), en
 * plataforma/respaldos/<fecha>/: una carpeta por esquema con un JSON por tabla,
 * las políticas, las funciones y la lista de migraciones aplicadas.
 *
 *   node --env-file=.env.local scripts/plataforma/respaldar-produccion.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
const e = process.env
const REF = e.SUPABASE_PROJECT_REF
const db = createClient(e.NEXT_PUBLIC_SUPABASE_URL, e.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const sql = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) })
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`)
  return r.json()
}
const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const raiz = path.join('plataforma', 'respaldos', `produccion-${sello}`)
fs.mkdirSync(raiz, { recursive: true })
const tablas = await sql("select table_schema s, table_name t from information_schema.tables where table_type='BASE TABLE' and table_schema in ('public','privado','org','sgc','flujo','control','ui','nucleo','ia') order by 1,2")
let total = 0
for (const { s, t } of tablas) {
  const filas = []
  if (s === 'privado') { const r = await sql(`select * from privado."${t}"`); filas.push(...r) }
  else for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.schema(s).from(t).select('*').range(desde, desde + 999)
    if (error) { console.log(`  ⚠️ ${s}.${t}: ${error.message}`); break }
    filas.push(...data); if (data.length < 1000) break
  }
  fs.mkdirSync(path.join(raiz, s), { recursive: true })
  fs.writeFileSync(path.join(raiz, s, `${t}.json`), JSON.stringify(filas))
  total += filas.length
  console.log(`  ${s}.${t}: ${filas.length}`)
}
fs.writeFileSync(path.join(raiz, '_politicas.json'), JSON.stringify(await sql('select * from pg_policies'), null, 1))
fs.writeFileSync(path.join(raiz, '_funciones.json'), JSON.stringify(await sql("select n.nspname, p.proname, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','privado','storage') and p.prokind='f'"), null, 1))
fs.writeFileSync(path.join(raiz, '_migraciones.json'), JSON.stringify(await sql('select version, name from supabase_migrations.schema_migrations order by 1'), null, 1))
fs.writeFileSync(path.join(raiz, '_storage_politicas.json'), JSON.stringify(await sql("select * from pg_policies where schemaname='storage'"), null, 1))
console.log(`Respaldo: ${tablas.length} tablas, ${total} filas → ${raiz}`)
