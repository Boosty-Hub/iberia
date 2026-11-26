// La voz de los tutoriales (26-nov-2026, decisión de Gabriel): Sebastián, la voz venezolana de Azure que ya usa el
// proyecto (`SEBASTIAN` de lib/voz.ts: es-VE-SebastianNeural a −7 %, la que quedó calibrada en ~192 palabras por
// minuto). Paola queda para Ajito, para no confundir los dos personajes. Cada frase se sintetiza una vez y se guarda
// por su huella en capturas/tutoriales/_voz/: volver a grabar no vuelve a pagar Azure.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const VOZ = { nombre: 'es-VE-SebastianNeural', velocidad: -7, pausaFrase: 180 }
const DIR = path.join('capturas', 'tutoriales', '_voz')

const escapar = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// Lo que se lee distinto de como se escribe en pantalla.
const paraDecir = (t) =>
  t
    .replace(/[«»]/g, '')
    .replace(/›/g, ',')
    .replace(/\bIA\b/g, 'I A')
    .replace(/\bPDF\b/g, 'pe de efe')
    .replace(/\bCSV\b/g, 'ce ese uve')
    .replace(/\bUS\$\s?/g, '')
    .replace(/\bMB\b/g, 'megas')
    .replace(/\bSGC\b/g, 'ese ge ce')
    .replace(/\s+/g, ' ')
    .trim()

function ssml(texto) {
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="es-VE">
  <voice name="${VOZ.nombre}"><mstts:silence type="Sentenceboundary-exact" value="${VOZ.pausaFrase}ms"/><prosody rate="${VOZ.velocidad}%">${escapar(paraDecir(texto))}</prosody></voice>
</speak>`
}

/** El audio de una frase (MP3) y cuánto dura, en segundos. */
export async function narrar(texto) {
  const clave = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!clave || !region) throw new Error('Faltan AZURE_SPEECH_KEY y AZURE_SPEECH_REGION para la voz de los tutoriales')
  fs.mkdirSync(DIR, { recursive: true })
  const huella = crypto.createHash('sha256').update(VOZ.nombre + VOZ.velocidad + paraDecir(texto)).digest('hex').slice(0, 24)
  const archivo = path.join(DIR, `${huella}.mp3`)
  if (!fs.existsSync(archivo)) {
    for (let intento = 1; ; intento++) {
      const r = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': clave, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3', 'User-Agent': 'tutoriales-plataforma' },
        body: ssml(texto),
      })
      if (r.ok) {
        fs.writeFileSync(archivo, Buffer.from(await r.arrayBuffer()))
        break
      }
      if (intento >= 4 || ![429, 500, 502, 503].includes(r.status)) throw new Error(`Azure ${r.status}: ${await r.text()}`)
      await new Promise((ok) => setTimeout(ok, 1500 * intento))
    }
  }
  const duracion = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]).toString())
  return { archivo, duracion }
}

/** Mezcla la narración (cada frase en su segundo) con el video ya convertido: un MP4 con voz. */
export function mezclarVoz({ mp4, pistas, inicio }) {
  if (!pistas.length) return
  const salida = mp4.replace(/\.mp4$/, '.voz.mp4')
  const entradas = pistas.flatMap((p) => ['-i', p.archivo])
  const filtros = pistas.map((p, i) => {
    const ms = Math.max(0, Math.round((p.t - inicio) * 1000))
    return `[${i + 1}:a]adelay=${ms}|${ms}[a${i}]`
  })
  const mezcla = `${pistas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${pistas.length}:normalize=0:duration=longest,apad[voz]`
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', mp4, ...entradas, '-filter_complex', [...filtros, mezcla].join(';'), '-map', '0:v', '-map', '[voz]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', salida])
  fs.renameSync(salida, mp4)
}
