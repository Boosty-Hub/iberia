/**
 * Graba los audios de Ajito a partir del guion.
 *
 *   node --env-file=.env.local scripts/generar-audios.mjs
 *   node --env-file=.env.local scripts/generar-audios.mjs --leccion 3
 *   node --env-file=.env.local scripts/generar-audios.mjs --revisar
 *
 * La fuente es `contenido/adiestramiento/leccion-*.md`, no una lista aparte: lo
 * que Ajito dice está escrito ahí y en ningún otro sitio. El guion lo lee
 * `lib/guion.ts` —el mismo lector que usa la aplicación—, se arma el SSML con la
 * voz de `lib/voz.ts` y los MP3 quedan en `contenido/adiestramiento/audio/`.
 *
 * Solo graba los audios NUMERADOS, que son la clase. Todo lo demás que lleva 🔊
 * —las devoluciones de los ejercicios— se genera en el momento y distinto para
 * cada persona; grabarlo sería grabar algo que nunca se va a usar dos veces.
 *
 * Es incremental: si el texto no cambió, no vuelve a pedir el audio. Se guarda
 * un `.sha` junto a cada MP3 con la huella del texto y de los ajustes de voz,
 * así que cambiar una coma regraba un audio y cambiar la velocidad los regraba
 * todos. A 16 dólares el millón de caracteres, esto es más por disciplina que
 * por plata — pero evita que una corrida distraída cambie 70 archivos.
 *
 * Opciones: --leccion N (solo una) · --revisar (no llama a Azure, solo dice qué
 * haría) · --forzar (regraba todo) · --salida
 */

import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { VOZ, aSSML } from '../lib/voz.ts'
import { audiosDe, leerLeccion } from '../lib/guion.ts'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) {
    const clave = process.argv[i].slice(2)
    const siguiente = process.argv[i + 1]
    args[clave] = siguiente && !siguiente.startsWith('--') ? siguiente : true
  }
}

const GUION = 'contenido/adiestramiento'
const SALIDA = typeof args.salida === 'string' ? args.salida : join(GUION, 'audio')
const SOLO = args.leccion ? String(args.leccion) : null
const REVISAR = !!args.revisar
const FORZAR = !!args.forzar

const CLAVE = process.env.AZURE_SPEECH_KEY
const REGION = process.env.AZURE_SPEECH_REGION

if (!REVISAR && (!CLAVE || !REGION)) {
  console.error('\n✖ Faltan AZURE_SPEECH_KEY y AZURE_SPEECH_REGION. Con --revisar no hacen falta.\n')
  process.exit(1)
}

// 48 kbps mono: un audio de 60 s pesa unos 360 KB, bajo el techo de 1 MB que
// fijan las reglas del guion. Los datos los paga el trabajador de su bolsillo.
const FORMATO = 'audio-24khz-48kbitrate-mono-mp3'
const PUNTO = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`

/** Huella del texto y de los ajustes: si cambia, hay que regrabar. */
function huella(texto) {
  return createHash('sha256')
    .update(`${VOZ.nombre}|${VOZ.velocidad}|${VOZ.tono}|${VOZ.pausaFrase}|${texto}`)
    .digest('hex')
    .slice(0, 16)
}

// -----------------------------------------------------------------------------

const archivos = (await readdir(GUION))
  .filter((f) => /^leccion-\d+.*\.md$/.test(f))
  .sort()

await mkdir(SALIDA, { recursive: true })

let grabados = 0
let saltados = 0
let caracteres = 0
const fallos = []

console.log(`\nVoz: ${VOZ.nombre} ${VOZ.velocidad >= 0 ? '+' : ''}${VOZ.velocidad}%, pausa ${VOZ.pausaFrase} ms`)
if (REVISAR) console.log('Modo revisión: no se llama a Azure.\n')
else console.log('')

for (const archivo of archivos) {
  const numero = basename(archivo).match(/^leccion-(\d+)/)[1]
  if (SOLO && String(Number(SOLO)).padStart(2, '0') !== numero) continue

  const audios = audiosDe(leerLeccion(await readFile(join(GUION, archivo), 'utf8'), archivo))
  if (!audios.length) continue

  const carpeta = join(SALIDA, `leccion-${numero}`)
  await mkdir(carpeta, { recursive: true })

  console.log(`Lección ${Number(numero)} · ${audios.length} audios`)

  for (const { id, texto } of audios) {
    const nombre = `audio-${id}`
    const mp3 = join(carpeta, `${nombre}.mp3`)
    const sha = join(carpeta, `${nombre}.sha`)
    const actual = huella(texto)

    if (!FORZAR && existsSync(mp3) && existsSync(sha)) {
      const previa = (await readFile(sha, 'utf8')).trim()
      if (previa === actual) {
        saltados++
        continue
      }
    }

    // La duración se estima con 190 palabras por minuto, que es donde quedó la
    // voz. Sirve para cazar de un vistazo un audio que se pasó de largo.
    const palabras = texto.split(/\s+/).length
    const segundos = Math.round((palabras / 190) * 60)

    if (REVISAR) {
      const aviso = segundos > 60 ? '  ⚠ pasa de 60 s' : ''
      console.log(`  · ${nombre.padEnd(12)} ${String(palabras).padStart(3)} palabras  ~${String(segundos).padStart(2)} s${aviso}`)
      caracteres += texto.length
      continue
    }

    const respuesta = await fetch(PUNTO, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': CLAVE,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': FORMATO,
        'User-Agent': 'iberia-adiestramiento',
      },
      body: aSSML(texto),
    })

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      fallos.push(`lección ${Number(numero)} · ${nombre}: ${respuesta.status} ${detalle.slice(0, 120)}`)
      console.log(`  ✖ ${nombre}`)
      continue
    }

    const audio = Buffer.from(await respuesta.arrayBuffer())
    await writeFile(mp3, audio)
    await writeFile(sha, actual)

    caracteres += texto.length
    grabados++

    const kb = Math.round(audio.length / 1024)
    const dur = (audio.length * 8) / 48000
    const aviso = kb > 1024 ? '  ⚠ pasa de 1 MB' : ''
    console.log(`  ✓ ${nombre.padEnd(12)} ${String(kb).padStart(4)} KB  ${dur.toFixed(1).padStart(5)} s${aviso}`)
  }
}

console.log(`
${REVISAR ? 'Se grabarían' : 'Grabados'}: ${grabados || (REVISAR ? '—' : 0)}   Sin cambios: ${saltados}
Caracteres: ${caracteres.toLocaleString('es-VE')}   ≈ ${(caracteres * 16 / 1_000_000).toFixed(2)} USD
Salida: ${SALIDA}/`)

if (fallos.length) {
  console.log(`\n${fallos.length} fallaron:`)
  for (const f of fallos) console.log(`  ✖ ${f}`)
  process.exit(1)
}
console.log('')
