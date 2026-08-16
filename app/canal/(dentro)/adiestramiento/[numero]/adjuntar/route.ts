import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { empleadoActual } from '@/lib/canal'
import { BUCKET_RESPUESTAS, rutaRespuesta } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'
import { transcribir } from '@/lib/transcribir'

/** El endpoint de audio corto corta en 60 s; el grabador también. */
const MAXIMO_AUDIO = 60 * 32_000 + 100_000
/** Una foto de teléfono ronda los 3 MB. Con 12 sobra y se corta lo absurdo. */
const MAXIMO_FOTO = 12 * 1024 * 1024

/**
 * Recibe lo que la persona manda —una nota de voz o una foto—, lo guarda en su
 * carpeta y, si es voz, lo devuelve escrito.
 *
 * **No graba la respuesta en la base.** Eso pasa después, cuando la persona
 * confirma que se le entendió bien: una transcripción mala sin confirmar se
 * convertiría en una respuesta mala guardada para siempre.
 */
export async function POST(
  peticion: NextRequest,
  { params }: { params: Promise<{ numero: string }> }
) {
  const empleado = await empleadoActual()
  if (!empleado) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  const { numero: crudo } = await params
  const numero = Number(crudo)
  if (!Number.isInteger(numero) || numero < 0) {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const formulario = await peticion.formData()
  const audio = formulario.get('audio')
  const clavePaso = String(formulario.get('clave_paso') ?? '').trim()

  if (!(audio instanceof Blob) || !/^[\w-]{1,40}$/.test(clavePaso)) {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const esFoto = audio.type.startsWith('image/')
  if (audio.size > (esFoto ? MAXIMO_FOTO : MAXIMO_AUDIO)) {
    return NextResponse.json({ error: 'El archivo es muy grande' }, { status: 413 })
  }

  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id, abierto')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso?.abierto) {
    return NextResponse.json({ error: 'El curso no está abierto' }, { status: 404 })
  }

  const { data: matricula } = await supabase
    .from('matriculas')
    .select('id')
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleado.id)
    .maybeSingle()
  if (!matricula) {
    return NextResponse.json({ error: 'Sin matrícula en el curso' }, { status: 403 })
  }

  const bytes = await audio.arrayBuffer()

  // La ruta lleva el dueño dentro: la política del bucket comprueba que el
  // segundo tramo sea el empleado de la sesión, así que nadie escribe —ni lee—
  // en la carpeta de otro.
  const ruta = rutaRespuesta(
    empleado.id,
    numero,
    clavePaso,
    esFoto ? extensionDe(audio.type) : 'wav'
  )

  const { error: errSubida } = await supabase.storage
    .from(BUCKET_RESPUESTAS)
    .upload(ruta, bytes, { contentType: audio.type || 'audio/wav', upsert: false })

  if (errSubida) {
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }

  // Una foto se guarda y ya: describirla es trabajo del modelo, que todavía no
  // está conectado.
  if (esFoto) return NextResponse.json({ ruta })

  const oido = await transcribir(bytes)

  if (!oido.ok) {
    // El audio queda guardado aunque no se le haya entendido: si la persona lo
    // repite, no se pierde lo que dijo la primera vez.
    return NextResponse.json({ ruta, motivo: oido.motivo })
  }

  return NextResponse.json({ ruta, texto: oido.texto })
}

function extensionDe(tipo: string): string {
  if (tipo.includes('png')) return 'png'
  if (tipo.includes('webp')) return 'webp'
  if (tipo.includes('heic') || tipo.includes('heif')) return 'heic'
  return 'jpg'
}
