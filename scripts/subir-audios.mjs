/**
 * Sube los audios de Ajito al bucket privado.
 *
 *   node --env-file=.env.local scripts/subir-audios.mjs
 *   node --env-file=.env.local scripts/subir-audios.mjs --forzar
 *
 * Los MP3 los graba `generar-audios.mjs` en `contenido/adiestramiento/audio/`.
 * Aquí se copian al bucket `adiestramiento`, que es privado: la aplicación los
 * entrega firmados y con sesión, nunca por URL pública.
 *
 * Es incremental como el grabador, y por la misma huella: junto a cada MP3 hay
 * un `.sha` con la firma del texto y de los ajustes de voz. Se sube también, y
 * en la siguiente corrida se compara con el de arriba. Así una regrabación de
 * un solo audio sube un solo archivo.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { BUCKET_ADIESTRAMIENTO } from '../lib/storage.ts'

const FORZAR = process.argv.includes('--forzar')
const ORIGEN = 'contenido/adiestramiento/audio'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secreto = process.env.SUPABASE_SECRET_KEY
if (!url || !secreto) {
  console.error('\n✖ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.\n')
  process.exit(1)
}

const db = createClient(url, secreto, { auth: { persistSession: false } })

/** Las huellas que ya están arriba, para no volver a subir lo mismo. */
async function huellasRemotas(carpeta) {
  const { data } = await db.storage.from(BUCKET_ADIESTRAMIENTO).list(carpeta, { limit: 200 })
  const shas = (data ?? []).filter((f) => f.name.endsWith('.sha'))
  const mapa = new Map()

  await Promise.all(
    shas.map(async (f) => {
      const { data: blob } = await db.storage
        .from(BUCKET_ADIESTRAMIENTO)
        .download(`${carpeta}/${f.name}`)
      if (blob) mapa.set(f.name.replace('.sha', ''), (await blob.text()).trim())
    })
  )
  return mapa
}

let subidos = 0
let saltados = 0
let bytes = 0
const fallos = []

const carpetas = (await readdir(ORIGEN, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort()

if (!carpetas.length) {
  console.error(`\n✖ No hay audios en ${ORIGEN}/. Corre primero: npm run generar:audios\n`)
  process.exit(1)
}

for (const carpeta of carpetas) {
  const remotas = FORZAR ? new Map() : await huellasRemotas(carpeta)
  const mp3s = (await readdir(join(ORIGEN, carpeta))).filter((f) => f.endsWith('.mp3')).sort()

  let nuevos = 0

  for (const mp3 of mp3s) {
    const nombre = mp3.replace('.mp3', '')
    const local = (await readFile(join(ORIGEN, carpeta, `${nombre}.sha`), 'utf8')).trim()

    if (remotas.get(nombre) === local) {
      saltados++
      continue
    }

    const audio = await readFile(join(ORIGEN, carpeta, mp3))
    const { error } = await db.storage
      .from(BUCKET_ADIESTRAMIENTO)
      .upload(`${carpeta}/${mp3}`, audio, { contentType: 'audio/mpeg', upsert: true })

    if (error) {
      fallos.push(`${carpeta}/${mp3}: ${error.message}`)
      continue
    }

    // La huella se sube después del audio: si algo se cae en medio, la próxima
    // corrida vuelve a subir el audio en vez de darlo por bueno.
    await db.storage
      .from(BUCKET_ADIESTRAMIENTO)
      .upload(`${carpeta}/${nombre}.sha`, Buffer.from(local), {
        contentType: 'text/plain',
        upsert: true,
      })

    bytes += audio.length
    subidos++
    nuevos++
  }

  console.log(`  ${carpeta}  ${String(mp3s.length).padStart(2)} audios${nuevos ? `, ${nuevos} subidos` : ', sin cambios'}`)
}

console.log(`
Subidos: ${subidos}   Sin cambios: ${saltados}   ${(bytes / 1024 / 1024).toFixed(1)} MB
Bucket: ${BUCKET_ADIESTRAMIENTO} (privado)`)

if (fallos.length) {
  console.log(`\n${fallos.length} fallaron:`)
  for (const f of fallos) console.log(`  ✖ ${f}`)
  process.exit(1)
}
console.log('')
