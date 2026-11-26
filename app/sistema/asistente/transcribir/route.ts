import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'
import { transcribir } from '@/lib/transcribir'

/**
 * Dictado del asistente (fase 3): el navegador graba, convierte a WAV de 16 kHz
 * (`lib/wav.ts`, lo mismo que el curso de Ajito) y lo manda aquí; Azure Speech
 * lo transcribe en español de Venezuela. El texto vuelve a la caja de escribir,
 * donde la persona lo revisa antes de enviar: una transcripción mala sin
 * revisar es una pregunta mala. El audio no se guarda.
 */
export const maxDuration = 60

export async function POST(peticion: NextRequest) {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  if (!puede(sesion, 'sistema:asistente')) return NextResponse.json({ error: 'Sin el asistente de IA habilitado' }, { status: 403 })
  const wav = await peticion.arrayBuffer()
  if (!wav.byteLength || wav.byteLength > 12 * 1024 * 1024) return NextResponse.json({ error: 'El audio no es válido o es muy largo (máximo un minuto).' }, { status: 400 })
  const r = await transcribir(wav)
  if (!r.ok) {
    const error = r.motivo === 'sin-configurar' ? 'El dictado no está configurado.' : r.motivo === 'no-se-entendio' ? 'No se entendió el audio. Intenta otra vez, más cerca del micrófono.' : 'No se pudo transcribir.'
    return NextResponse.json({ error }, { status: 422 })
  }
  return NextResponse.json({ texto: r.texto })
}
