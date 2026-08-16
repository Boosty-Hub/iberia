import 'server-only'
import { aSSML } from '@/lib/voz'

/**
 * Poner a hablar a Ajito en el momento.
 *
 * Las nueve lecciones se graban una vez con `npm run generar:audios`. Esto es
 * lo otro: la devolución de cada ejercicio, que es distinta para cada persona y
 * no se puede grabar por adelantado. Las dos salen de `lib/voz.ts` a propósito
 * — si la clase la dijera una voz y la devolución otra, habría dos Ajitos y se
 * notaría en la primera lección.
 *
 * Mismo formato que el generador: 48 kbps mono. Una devolución de veinte
 * segundos pesa unos 120 KB, y esos datos los paga el trabajador de su bolsillo.
 */
const FORMATO = 'audio-24khz-48kbitrate-mono-mp3'

export type Hablado =
  | { ok: true; mp3: ArrayBuffer }
  | { ok: false; motivo: 'sin-configurar' | 'fallo'; detalle?: string }

export async function hablar(texto: string): Promise<Hablado> {
  const clave = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!clave || !region) return { ok: false, motivo: 'sin-configurar' }

  let respuesta: Response
  try {
    respuesta = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': clave,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': FORMATO,
        'User-Agent': 'iberia-adiestramiento',
      },
      body: aSSML(texto),
    })
  } catch (error) {
    return { ok: false, motivo: 'fallo', detalle: String(error) }
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    return { ok: false, motivo: 'fallo', detalle: `${respuesta.status} ${detalle.slice(0, 200)}` }
  }

  return { ok: true, mp3: await respuesta.arrayBuffer() }
}
