/**
 * De lo que graba el navegador a lo que come Azure.
 *
 * El navegador graba en WebM/Opus (Android, Chrome) o en MP4/AAC (iPhone), y el
 * endpoint de audio corto de Azure solo acepta **WAV PCM 16 kHz mono**. La
 * conversión se hace aquí, en el teléfono, con la Web Audio API — sin librerías
 * y sin pasar por el servidor.
 *
 * Se remezcla a mono sumando los canales y se baja a 16 kHz con un
 * `OfflineAudioContext`, que es el remuestreo que ya trae el navegador y suena
 * mejor que tomar una muestra de cada tres a mano.
 *
 * Cuesta datos: 16 kHz por 16 bits en mono son 32 KB por segundo, así que medio
 * minuto son casi 900 KB que sube el trabajador de su propio plan. Es el precio
 * de que el reconocimiento funcione hoy; la nota de `lib/transcribir.ts`
 * explica qué haría falta para bajarlo treinta veces.
 */

const HERCIOS = 16_000

export async function aWavDe16k(grabado: Blob): Promise<ArrayBuffer> {
  const bytes = await grabado.arrayBuffer()

  // El contexto de decodificación va a la frecuencia del archivo; el de
  // remuestreo, a la que necesitamos.
  const contexto = new AudioContext()
  let decodificado: AudioBuffer
  try {
    decodificado = await contexto.decodeAudioData(bytes)
  } finally {
    void contexto.close()
  }

  const muestras = Math.ceil((decodificado.duration * HERCIOS) | 0) || 1
  const destino = new OfflineAudioContext(1, muestras, HERCIOS)

  const fuente = destino.createBufferSource()
  fuente.buffer = decodificado
  fuente.connect(destino.destination)
  fuente.start()

  const remuestreado = await destino.startRendering()
  return codificarWav(remuestreado.getChannelData(0), HERCIOS)
}

/** Cabecera RIFF de 44 bytes y las muestras en enteros de 16 bits. */
function codificarWav(muestras: Float32Array, hercios: number): ArrayBuffer {
  const datos = muestras.length * 2
  const buffer = new ArrayBuffer(44 + datos)
  const vista = new DataView(buffer)

  const texto = (posicion: number, valor: string) => {
    for (let i = 0; i < valor.length; i++) vista.setUint8(posicion + i, valor.charCodeAt(i))
  }

  texto(0, 'RIFF')
  vista.setUint32(4, 36 + datos, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  vista.setUint32(16, 16, true) // tamaño del bloque fmt
  vista.setUint16(20, 1, true) // PCM sin comprimir
  vista.setUint16(22, 1, true) // mono
  vista.setUint32(24, hercios, true)
  vista.setUint32(28, hercios * 2, true) // bytes por segundo
  vista.setUint16(32, 2, true) // alineación de bloque
  vista.setUint16(34, 16, true) // bits por muestra
  texto(36, 'data')
  vista.setUint32(40, datos, true)

  let posicion = 44
  for (let i = 0; i < muestras.length; i++) {
    // Se recorta antes de escalar: un pico por encima de 1 daría la vuelta y
    // sonaría a chasquido.
    const valor = Math.max(-1, Math.min(1, muestras[i]))
    vista.setInt16(posicion, valor < 0 ? valor * 0x8000 : valor * 0x7fff, true)
    posicion += 2
  }

  return buffer
}

/** Lo que el navegador de turno sepa grabar. */
export function formatoDeGrabacion(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  for (const tipo of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(tipo)) return tipo
  }
  return undefined
}
