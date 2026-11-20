/**
 * Corre SQL contra el PROYECTO DE PRUEBAS por la Management API (query
 * endpoint). Nunca contra producción: el ref sale de `SUPABASE_PRUEBAS_REF` y
 * se niega si coincide con `SUPABASE_PROJECT_REF`.
 *
 *   node --env-file=.env.local scripts/plataforma/sql-pruebas.mjs --archivo <x.sql> [--registrar]
 *   echo "select 1" | node --env-file=.env.local scripts/plataforma/sql-pruebas.mjs
 *
 * El SQL viaja leído del archivo o de stdin, nunca por argv (en Windows argv
 * daña las tildes). `--registrar` anota la migración en
 * `supabase_migrations.schema_migrations` (versión y nombre del archivo).
 */
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PRUEBAS_REF
if (!token || !ref) throw new Error('Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PRUEBAS_REF')
if (ref === process.env.SUPABASE_PROJECT_REF) throw new Error('SUPABASE_PRUEBAS_REF es producción: no se corre')

const argv = process.argv.slice(2)
const archivo = argv.includes('--archivo') ? argv[argv.indexOf('--archivo') + 1] : null
let sql
if (archivo) sql = await readFile(archivo, 'utf8')
else {
  const trozos = []
  for await (const t of process.stdin) trozos.push(t)
  sql = Buffer.concat(trozos).toString('utf8')
}

export async function consulta(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const texto = await r.text()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${texto}`)
  return JSON.parse(texto)
}

const res = await consulta(sql)
console.log(JSON.stringify(res, null, 1).slice(0, 20000))
if (archivo && argv.includes('--registrar')) {
  const [version, ...resto] = basename(archivo, '.sql').split('_')
  const nombre = resto.join('_').replaceAll("'", "''")
  await consulta(
    `insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${nombre}', array[]::text[]) on conflict (version) do nothing`
  )
  console.log(`registrada ${version} ${nombre} en schema_migrations (pruebas)`)
}
