/**
 * Sube las fichas de bolsillo al bucket privado.
 *
 *   node --env-file=.env.local scripts/subir-fichas.mjs
 *
 * Los PNG los dibuja `generar-fichas.mjs` en `contenido/adiestramiento/fichas/`.
 * Van al bucket `adiestramiento`, el mismo de los audios y por la misma razón:
 * es material del curso bajo NDA, lo ve cualquiera con matrícula y nadie sin
 * sesión. La aplicación las entrega firmadas y con vigencia corta.
 *
 * No hace falta huella como con los audios: una ficha pesa cien kilobytes y son
 * diez. Subirlas todas cada vez cuesta menos que llevar la cuenta de cuál
 * cambió.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { BUCKET_ADIESTRAMIENTO, rutaFicha } from '../lib/storage.ts'

const ORIGEN = 'contenido/adiestramiento/fichas'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secreto = process.env.SUPABASE_SECRET_KEY
if (!url || !secreto) {
  console.error('\n✖ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.\n')
  process.exit(1)
}

const db = createClient(url, secreto, { auth: { persistSession: false } })

const pngs = (await readdir(ORIGEN).catch(() => [])).filter((f) => f.endsWith('.png')).sort()

if (!pngs.length) {
  console.error(`\n✖ No hay fichas en ${ORIGEN}/. Corre primero: npm run generar:fichas\n`)
  process.exit(1)
}

let subidas = 0
let bytes = 0
const fallos = []

console.log('')

for (const png of pngs) {
  const pieza = png.replace(/^leccion-|\.png$/g, '')
  const contenido = await readFile(join(ORIGEN, png))

  const { error } = await db.storage
    .from(BUCKET_ADIESTRAMIENTO)
    .upload(rutaFicha(pieza), contenido, { contentType: 'image/png', upsert: true })

  if (error) {
    fallos.push(`${png}: ${error.message}`)
    console.log(`✖ ${png}`)
    continue
  }

  subidas++
  bytes += contenido.length
  console.log(`· ${png.padEnd(20)} ${String(Math.round(contenido.length / 1024)).padStart(3)} KB`)
}

console.log(`\n${subidas} fichas · ${Math.round(bytes / 1024)} KB en ${BUCKET_ADIESTRAMIENTO}/fichas/`)

if (fallos.length) {
  console.log(`\n✖ ${fallos.length} fallo${fallos.length > 1 ? 's' : ''}:`)
  for (const f of fallos) console.log(`  · ${f}`)
  console.log('')
  process.exit(1)
}

console.log('')
