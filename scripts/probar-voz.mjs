/**
 * Genera muestras de la voz de Ajito para poder elegirla de oído.
 *
 *   node --env-file=.env.local scripts/probar-voz.mjs
 *   node --env-file=.env.local scripts/probar-voz.mjs --texto "otra cosa"
 *
 * Sintetiza el mismo texto con Paola a varias velocidades y con Sebastián, y
 * deja los MP3 en `capturas/voz/` numerados para escucharlos seguidos. La
 * decisión no la toma nadie leyendo: se oyen y se elige.
 *
 * Necesita en `.env.local`:
 *   AZURE_SPEECH_KEY=...
 *   AZURE_SPEECH_REGION=...      (por ejemplo eastus)
 *
 * Sin clave no hace nada y lo dice — no inventa audio.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PAOLA, SEBASTIAN, aSSML } from '../lib/voz.ts'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const CLAVE = process.env.AZURE_SPEECH_KEY
const REGION = process.env.AZURE_SPEECH_REGION
const SALIDA = args.salida ?? 'capturas/voz'

if (!CLAVE || !REGION) {
  console.error(`
✖ Faltan AZURE_SPEECH_KEY y AZURE_SPEECH_REGION en .env.local

  Se sacan de un recurso de Azure AI Speech. El nivel gratuito da 500.000
  caracteres al mes, que sobra de largo para estas muestras.
`)
  process.exit(1)
}

/** El arranque de la lección 0. Es el texto con el que hay que juzgarla. */
const TEXTO_POR_DEFECTO = `¡Epa! Yo soy Ajito.

Fíjate bien cómo me hicieron: la cabeza es un ajo y el cuerpo es un ají. Me parece bien, porque de eso vive esta casa.

Vengo de parte de Industrias Iberia a enseñarte una cosa que se llama inteligencia artificial. Y antes de que te asustes con el nombre: es más fácil de lo que suena, y tú ya la venías usando sin saber.

Son nueve clases de tres minutos. No hay examen. Al final te dan un certificado con tu nombre.`

const TEXTO = args.texto ?? TEXTO_POR_DEFECTO

/**
 * La escalera. Medido sobre este texto el 16 de agosto: Paola de fábrica va a
 * 166 palabras por minuto y Sebastián a 200 — un 20% más rápido, que es lo que
 * se oye al ponerlos seguidos. Cada escalón son unas 7 palabras por minuto.
 */
const MUESTRAS = [
  { nombre: '1-paola-tal-cual', voz: { ...PAOLA, velocidad: 0 } },
  { nombre: '2-paola-mas-8', voz: { ...PAOLA, velocidad: 8 } },
  { nombre: '3-paola-mas-12', voz: { ...PAOLA, velocidad: 12 } },
  { nombre: '4-paola-mas-16', voz: { ...PAOLA, velocidad: 16 } },
  { nombre: '5-paola-mas-20', voz: { ...PAOLA, velocidad: 20 } },
  { nombre: '6-sebastian-tal-cual', voz: { ...SEBASTIAN, velocidad: 0 } },
  { nombre: '7-sebastian-mas-5', voz: { ...SEBASTIAN, velocidad: 5 } },
]

const PUNTO = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`

// 48 kbps mono: un audio de 60 segundos pesa unos 360 KB, por debajo del megabyte
// que se fijó como techo. Los datos los paga el trabajador de su bolsillo.
const FORMATO = 'audio-24khz-48kbitrate-mono-mp3'

await mkdir(SALIDA, { recursive: true })

let caracteres = 0

for (const { nombre, voz } of MUESTRAS) {
  const ssml = aSSML(TEXTO, voz)
  caracteres += TEXTO.length

  const respuesta = await fetch(PUNTO, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': CLAVE,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': FORMATO,
      'User-Agent': 'iberia-adiestramiento',
    },
    body: ssml,
  })

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    console.error(`  ✖ ${nombre}: ${respuesta.status} ${respuesta.statusText} ${detalle.slice(0, 200)}`)
    continue
  }

  const audio = Buffer.from(await respuesta.arrayBuffer())
  const ruta = join(SALIDA, `${nombre}.mp3`)
  await writeFile(ruta, audio)

  const kb = Math.round(audio.length / 1024)
  console.log(`  ✓ ${nombre.padEnd(22)} ${String(kb).padStart(4)} KB   ${voz.nombre} ${voz.velocidad >= 0 ? '+' : ''}${voz.velocidad}%`)
}

console.log(`
Muestras en ${SALIDA}/

Escúchalas en orden. Lo que hay que decidir son dos cosas:

  1. ¿A qué velocidad Paola deja de sonar lenta sin sonar atropellada?
     Ese número va en \`lib/voz.ts\`, en PAOLA.velocidad.

  2. ¿O es Sebastián? Acelerar arregla el tempo, no la cadencia. Si lo que
     molesta es el ritmo, ningún porcentaje lo va a resolver.

Gastado: ${caracteres.toLocaleString('es-VE')} caracteres. El nivel gratuito da 500.000 al mes.
`)
