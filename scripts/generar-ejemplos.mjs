/**
 * Los ejemplos ya hechos de la lección 4, dibujados del guion.
 *
 *   npm run generar:ejemplos               # dibuja lo que falte o cambió, y lo sube
 *   npm run generar:ejemplos -- --revisar  # dice qué dibujaría, sin llamar a OpenAI
 *
 * Al tocar «Muéstrame», la lección enseña tres dibujos de Ajito —«Ajito en la
 * playa · …»—. Salen del bloque `🖼 Tres ejemplos ya hechos` del guion de la
 * lección 4, y se dibujan a partir de `public/marca/ajito.png` para que Ajito
 * salga igualito, con el mismo modelo que la lección (`lib/dibujo.ts`).
 *
 * Es incremental, como `generar:audios`: guarda al lado de cada dibujo la huella
 * del texto, del modelo y de la referencia, y solo vuelve a dibujar lo que
 * cambió. Sube también la referencia de Ajito, que la lección usa cuando alguien
 * pide un dibujo con Ajito dentro (`RUTA_REFERENCIA_AJITO`).
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { AJITO_IGUALITO, MODELO_DIBUJO, SIN_AGREGADOS } from '../lib/dibujo.ts'
import { leerLeccion } from '../lib/guion.ts'
import {
  BUCKET_ADIESTRAMIENTO,
  RUTA_REFERENCIA_AJITO,
  RUTA_REFERENCIA_IBERIA,
  rutaEjemplo,
} from '../lib/storage.ts'

const REVISAR = process.argv.includes('--revisar')
const LECCION = 4
const ARCHIVO = 'leccion-04-ajito-dibuja.md'
const SALIDA = `contenido/adiestramiento/ejemplos/leccion-0${LECCION}`
const REFERENCIA = 'public/marca/ajito.png'

const leccion = leerLeccion(await readFile(`contenido/adiestramiento/${ARCHIVO}`, 'utf8'), ARCHIVO)
const pieza = leccion.pasos
  .flatMap((p) => p.bloques)
  .find((b) => b.tipo === 'pieza' && b.clase === 'ejemplos')
if (!pieza?.lineas.length) {
  console.error('\n✖ No encontré el bloque «Tres ejemplos ya hechos» en el guion de la lección 4.\n')
  process.exit(1)
}

const referencia = await readFile(REFERENCIA)
const huellaReferencia = createHash('sha256').update(referencia).digest('hex')

/** Lo que se le pide al generador por cada ejemplo del guion. */
const pedido = (ejemplo) =>
  `${AJITO_IGUALITO} ${ejemplo}. Escena alegre, para pasarla bien. ${SIN_AGREGADOS} ` +
  `Fuera del logo de su pechera, no agregues letreros, letras ni texto.`

await mkdir(SALIDA, { recursive: true })

const pendientes = []
for (const [i, ejemplo] of pieza.lineas.entries()) {
  const n = i + 1
  const huella = createHash('sha256')
    .update(`${MODELO_DIBUJO}\n${pedido(ejemplo)}\n${huellaReferencia}`)
    .digest('hex')
  const archivo = `${SALIDA}/ejemplo-${n}.webp`
  const anterior = existsSync(`${archivo}.sha`) ? (await readFile(`${archivo}.sha`, 'utf8')).trim() : ''
  if (anterior === huella && existsSync(archivo)) {
    console.log(`  · ${n} ${ejemplo} — sin cambios`)
    continue
  }
  pendientes.push({ n, ejemplo, huella, archivo })
  console.log(`  ${REVISAR ? '→' : '✎'} ${n} ${ejemplo}`)
}

if (REVISAR) {
  console.log(`\nSe dibujarían: ${pendientes.length}. Modelo: ${MODELO_DIBUJO}.\n`)
  process.exit(0)
}

const CLAVE = process.env.OPENAI_API_KEY
if (pendientes.length && !CLAVE) {
  console.error('\n✖ Falta OPENAI_API_KEY en .env.local.\n')
  process.exit(1)
}

for (const { n, ejemplo, huella, archivo } of pendientes) {
  const forma = new FormData()
  forma.append('model', MODELO_DIBUJO)
  forma.append('prompt', pedido(ejemplo))
  forma.append('size', '1024x1024')
  forma.append('quality', 'medium')
  forma.append('output_format', 'webp')
  forma.append('output_compression', '80')
  forma.append('image[]', new Blob([referencia], { type: 'image/png' }), 'ajito.png')

  const t0 = Date.now()
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLAVE}` },
    body: forma,
  })
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok || !cuerpo.data?.[0]?.b64_json) {
    console.error(`\n✖ ${n} ${ejemplo}: ${r.status} ${JSON.stringify(cuerpo.error ?? cuerpo).slice(0, 300)}\n`)
    process.exit(1)
  }
  const bytes = Buffer.from(cuerpo.data[0].b64_json, 'base64')
  await writeFile(archivo, bytes)
  await writeFile(`${archivo}.sha`, huella)
  console.log(`  ✓ ${n} ${ejemplo} · ${((Date.now() - t0) / 1000).toFixed(1)} s · ${Math.round(bytes.length / 1024)} KB`)
}

// --- al bucket del curso --------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secreto = process.env.SUPABASE_SECRET_KEY
if (!url || !secreto) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local.\n')
  process.exit(1)
}
const db = createClient(url, secreto, { auth: { persistSession: false } })

const subir = async (ruta, bytes, tipo) => {
  const { error } = await db.storage.from(BUCKET_ADIESTRAMIENTO).upload(ruta, bytes, { contentType: tipo, upsert: true })
  if (error) {
    console.error(`\n✖ No se pudo subir ${ruta}: ${error.message}\n`)
    process.exit(1)
  }
}

await subir(RUTA_REFERENCIA_AJITO, referencia, 'image/png')
// Y el logo de Industrias Iberia: sin él, «el logo de Iberia» salía el de la aerolínea.
await subir(RUTA_REFERENCIA_IBERIA, await readFile('public/marca/iberia.png'), 'image/png')
for (const [i] of pieza.lineas.entries()) {
  await subir(rutaEjemplo(LECCION, i + 1), await readFile(`${SALIDA}/ejemplo-${i + 1}.webp`), 'image/webp')
}
console.log(`\nSubidos: ${pieza.lineas.length} ejemplos y las referencias de Ajito y de Iberia · bucket ${BUCKET_ADIESTRAMIENTO}\n`)
