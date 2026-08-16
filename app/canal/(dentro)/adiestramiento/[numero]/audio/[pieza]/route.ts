import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { empleadoActual } from '@/lib/canal'
import { BUCKET_ADIESTRAMIENTO, rutaAudio } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** Lo justo para que el reproductor empiece. El enlace no se puede compartir. */
const SEGUNDOS_VALIDEZ = 60

/**
 * Entrega un audio de Ajito con un enlace firmado de corta vida.
 *
 * El bucket es privado y este handler es el único camino. Pide tres cosas, en
 * este orden: sesión, ficha en el padrón y **matrícula en el curso**. Lo último
 * no sobra — sin eso, cualquiera con sesión de Iberia podría bajarse el curso
 * completo aunque no le toque, y la mitad del material habla de lo que la
 * empresa va a hacer con la IA.
 */
export async function GET(
  _peticion: NextRequest,
  { params }: { params: Promise<{ numero: string; pieza: string }> }
) {
  const empleado = await empleadoActual()
  if (!empleado) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  const { numero: crudo, pieza } = await params
  const numero = Number(crudo)

  // La pieza va en la ruta del bucket: se acota a lo que el guion puede generar
  // —`1`, `6-A`— antes de armar ninguna ruta con ella.
  if (!Number.isInteger(numero) || numero < 0 || !/^[\w-]{1,8}$/.test(pieza)) {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
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

  const { data, error } = await supabase.storage
    .from(BUCKET_ADIESTRAMIENTO)
    .createSignedUrl(rutaAudio(numero, pieza), SEGUNDOS_VALIDEZ)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se encontró el audio' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
