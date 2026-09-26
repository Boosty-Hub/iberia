/**
 * Mide el ritmo de una voz de Ajito sobre el audio, no sobre el texto.
 *
 *   npm run medir:ritmo                          # Sebastián, en escalera
 *   npm run medir:ritmo -- --voz mujer           # Paola
 *   npm run medir:ritmo -- --escalera -8,-4,0    # otros escalones
 *
 * El objetivo son **192 palabras por minuto** (ver `lib/voz.ts`). En agosto se
 * cronometró el texto y el `+16%` parecía dar 192; medido sobre el audio daba 174.
 * Así que esto pide el WAV a Azure y cuenta palabras por minuto **sobre el WAV
 * entero**, con el medio segundo de silencio que Azure deja en cada punta —así se
 * midió en agosto—. Al lado va la cifra sin las puntas, y con la energía en marcos
 * de 10 ms cuenta cuántas pausas hay y cuántas pasan de 400 ms, que es cuando el
 * audio empieza a sonar a frases sueltas.
 *
 * ⚠️ **Arranca siempre con Paola a +12% como testigo.** Tiene que dar ~192: es la
 * medida con la que se eligió. Si no, el que está mal es el método, no la voz. La
 * primera versión recortaba las puntas y el testigo dio 199 —un 3,6% más rápido que
 * agosto—; mover el umbral de silencio no cambiaba nada, porque la diferencia era el
 * silencio de las puntas. Lo que importa es que las dos voces se midan igual.
 *
 * El texto es el Audio 1 de la lección 0, del guion —86 palabras—, el mismo de la
 * calibración de agosto. Cuesta menos de un centavo por escalón.
 */

import { readFile } from 'node:fs/promises'
import { PAOLA, VOCES, aSSML } from '../lib/voz.ts'
import { audiosDe, leerLeccion } from '../lib/guion.ts'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const CLAVE = process.env.AZURE_SPEECH_KEY
const REGION = process.env.AZURE_SPEECH_REGION
if (!CLAVE || !REGION) {
  console.error('\n✖ Faltan AZURE_SPEECH_KEY y AZURE_SPEECH_REGION en .env.local.\n')
  process.exit(1)
}

const claveVoz = args.voz ?? 'hombre'
const base = VOCES[claveVoz]
if (!base) {
  console.error(`\n✖ --voz tiene que ser ${Object.keys(VOCES).join(' o ')}.\n`)
  process.exit(1)
}
const escalera = (args.escalera ?? '-12,-8,-4,0').split(',').map(Number)
// Silencio: por debajo de esta fracción del marco más fuerte. Se ajusta hasta que el
// testigo dé 192, que es como se midió en agosto.
const UMBRAL = Number(args.umbral ?? 0.04)

const archivo = 'leccion-00-bienvenida.md'
const leccion = leerLeccion(await readFile(`contenido/adiestramiento/${archivo}`, 'utf8'), archivo)
const texto = audiosDe(leccion).find((a) => a.id === '1')?.texto
if (!texto) {
  console.error('\n✖ No encontré el Audio 1 de la lección 0 en el guion.\n')
  process.exit(1)
}
const palabras = texto.split(/\s+/).filter(Boolean).length

async function wav(voz) {
  const r = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': CLAVE,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm',
      'User-Agent': 'iberia-adiestramiento',
    },
    body: aSSML(texto, voz),
  })
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 160)}`)
  return Buffer.from(await r.arrayBuffer())
}

/** Duración de lo que suena y sus pausas, con marcos de 10 ms. */
function medir(buffer) {
  // El PCM empieza donde dice el bloque `data` del RIFF.
  let pos = 12
  let datos = null
  let tasa = 24000
  while (pos < buffer.length - 8) {
    const id = buffer.toString('ascii', pos, pos + 4)
    const largo = buffer.readUInt32LE(pos + 4)
    if (id === 'fmt ') tasa = buffer.readUInt32LE(pos + 12)
    if (id === 'data') {
      datos = buffer.subarray(pos + 8, pos + 8 + largo)
      break
    }
    pos += 8 + largo
  }
  if (!datos) throw new Error('WAV sin bloque data')

  const porMarco = Math.round(tasa / 100)
  const rms = []
  for (let i = 0; i + porMarco * 2 <= datos.length; i += porMarco * 2) {
    let suma = 0
    for (let j = 0; j < porMarco; j++) {
      const m = datos.readInt16LE(i + j * 2) / 32768
      suma += m * m
    }
    rms.push(Math.sqrt(suma / porMarco))
  }
  const umbral = Math.max(...rms) * UMBRAL
  const suena = rms.map((v) => v > umbral)
  const primero = suena.indexOf(true)
  const ultimo = suena.lastIndexOf(true)
  const pausas = []
  let racha = 0
  for (let k = primero; k <= ultimo; k++) {
    if (!suena[k]) racha++
    else {
      if (racha >= 15) pausas.push(racha * 10)
      racha = 0
    }
  }
  const segundos = (ultimo - primero + 1) / 100
  // El WAV entero, con el silencio que Azure deja en las puntas: es como se midió en agosto.
  const entero = rms.length / 100
  return { segundos, entero, pausas }
}

async function escalon(nombre, voz) {
  const m = medir(await wav(voz))
  const ppm = (palabras / m.entero) * 60
  const ppmRecortado = (palabras / m.segundos) * 60
  const largas = m.pausas.filter((p) => p >= 400).length
  const marca = Math.abs(ppm - 192) <= 2 ? '  ← 192' : ''
  console.log(
    `  ${nombre.padEnd(28)} ${m.entero.toFixed(1).padStart(5)} s → ${ppm.toFixed(0).padStart(3)} ppm` +
      ` (sin las puntas: ${m.segundos.toFixed(1)} s, ${ppmRecortado.toFixed(0)})` +
      ` · ${String(m.pausas.length).padStart(2)} pausas, ${largas} de 400 ms o más${marca}`
  )
  return ppm
}

console.log(`\nAudio 1 de la lección 0 · ${palabras} palabras\n`)
console.log('Testigo')
await escalon('Paola +12% (la elegida)', { ...PAOLA, velocidad: 12 })
console.log(`\n${base.rotulo} · ${base.nombre}`)
for (const v of escalera) await escalon(`${v >= 0 ? '+' : ''}${v}%`, { ...base, velocidad: v })
console.log('\nSe elige el escalón más cerca de 192 que no sume pausas de 400 ms; se pone en lib/voz.ts.\n')
