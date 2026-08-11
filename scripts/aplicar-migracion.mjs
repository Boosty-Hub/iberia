/**
 * Aplica un archivo de supabase/migrations/ contra el proyecto, usando la
 * Management API (no hace falta la contraseña de Postgres).
 *
 *   node --env-file=.env.local scripts/aplicar-migracion.mjs <archivo.sql>
 *   node --env-file=.env.local scripts/aplicar-migracion.mjs --ultima
 */

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const CARPETA = 'supabase/migrations'

const token = process.env.SUPABASE_ACCESS_TOKEN
const ref = process.env.SUPABASE_PROJECT_REF

if (!token || !ref) {
  console.error('\n✖ Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF.\n')
  process.exit(1)
}

let archivo = process.argv[2]

if (!archivo || archivo === '--ultima') {
  const archivos = (await readdir(CARPETA)).filter((f) => f.endsWith('.sql')).sort()
  if (archivos.length === 0) {
    console.error('\n✖ No hay migraciones.\n')
    process.exit(1)
  }
  archivo = join(CARPETA, archivos[archivos.length - 1])
}

const sql = await readFile(archivo, 'utf8')
console.log(`\nAplicando ${archivo} (${sql.length} caracteres)…`)

const respuesta = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
})

if (!respuesta.ok) {
  const detalle = await respuesta.text()
  console.error(`\n✖ HTTP ${respuesta.status}\n${detalle}\n`)
  process.exit(1)
}

console.log('✔ Aplicada\n')
