import 'server-only'

/**
 * Oír lo que manda la gente.
 *
 * Casi todos los ejercicios se contestan hablando, y media planta escribe poco:
 * si esto no funciona, el curso no llega al último eslabón. La transcripción no
 * es un accesorio, es la puerta.
 *
 * ── Por qué el endpoint viejo y no el rápido ─────────────────────────────────
 *
 * La API de **transcripción rápida** sería mejor: acepta el WebM comprimido que
 * graba el navegador tal cual, unos 50 KB por minuto. Pero contra el recurso de
 * Iberia devuelve `429 TooManyRequests · Resource Exhausted` de forma
 * consistente, no transitoria. No es la región —`westus3` la soporta según la
 * tabla de Microsoft—; lo más probable es que sea el tipo de recurso, que es
 * `AIServices` y no `SpeechServices`.
 *
 * El endpoint clásico de audio corto sí funciona, y está probado contra este
 * mismo recurso con una frase de planta: devolvió «envasado» y «codificador»
 * correctos. La contrapartida es el formato: solo come **WAV PCM 16 kHz mono**,
 * que son unos 32 KB por segundo. El navegador convierte antes de subir
 * (`components/canal/grabador-voz.tsx`).
 *
 * Eso cuesta datos del trabajador: ~1 MB por respuesta de 30 s, contra ~30 KB
 * si la rápida funcionara. Está anotado en `herramientas.md` como lo primero
 * que hay que reintentar si Iberia crea un recurso de Speech dedicado.
 *
 * El límite duro del endpoint son **60 segundos**, y por eso el grabador corta
 * ahí.
 */

const LOCALE = 'es-VE'

export type Transcripcion =
  | { ok: true; texto: string }
  | { ok: false; motivo: 'sin-configurar' | 'no-se-entendio' | 'fallo'; detalle?: string }

export async function transcribir(wav: ArrayBuffer): Promise<Transcripcion> {
  const clave = process.env.AZURE_SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION
  if (!clave || !region) return { ok: false, motivo: 'sin-configurar' }

  const url =
    `https://${region}.stt.speech.microsoft.com` +
    `/speech/recognition/conversation/cognitiveservices/v1?language=${LOCALE}&format=simple`

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': clave,
        'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
        Accept: 'application/json',
      },
      body: wav,
    })
  } catch (error) {
    return { ok: false, motivo: 'fallo', detalle: String(error) }
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '')
    return { ok: false, motivo: 'fallo', detalle: `${respuesta.status} ${detalle.slice(0, 200)}` }
  }

  const datos = (await respuesta.json()) as {
    RecognitionStatus?: string
    DisplayText?: string
  }

  // `NoMatch` es ruido de máquina sin palabras; `InitialSilenceTimeout`, que la
  // persona le dio a grabar y no habló. Ninguno de los dos es un error del
  // sistema, y no se le puede decir «algo salió mal»: se le dice que no se le
  // entendió y que lo repita.
  if (datos.RecognitionStatus !== 'Success' || !datos.DisplayText?.trim()) {
    return { ok: false, motivo: 'no-se-entendio' }
  }

  return { ok: true, texto: datos.DisplayText.trim() }
}
