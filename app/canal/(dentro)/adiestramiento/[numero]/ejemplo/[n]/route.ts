import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { obtenerSesion, puede } from '@/lib/auth'
import { empleadoActual } from '@/lib/canal'
import { BUCKET_ADIESTRAMIENTO, rutaEjemplo } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** Como las fichas: se miran, se cierran y se vuelven a abrir. */
const SEGUNDOS_VALIDEZ = 300

/**
 * Entrega uno de los ejemplos ya hechos de la lección 4 —«Ajito en la playa»…—,
 * los que salen al tocar «Muéstrame». Se dibujan una sola vez con
 * `generar:ejemplos`, del guion, y viven en el bucket del curso.
 *
 * Mismas tres puertas que la ficha: sesión, matrícula y la lección habilitada
 * para su rol. Son de Ajito y no de nadie, pero son material del curso.
 */
export async function GET(
  _peticion: NextRequest,
  { params }: { params: Promise<{ numero: string; n: string }> }
) {
  const empleado = await empleadoActual()
  if (!empleado) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  const { numero: crudo, n } = await params
  const numero = Number(crudo)

  const cual = Number(n)
  if (!Number.isInteger(numero) || numero < 0 || !Number.isInteger(cual) || cual < 1 || cual > 9) {
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

  // Y la lección tiene que estar entre las que su rol ve (`leccion:N`): sin esto,
  // una lección apagada en la matriz se seguiría bajando escribiendo la ruta.
  if (!puede(await obtenerSesion(), `leccion:${numero}`)) {
    return NextResponse.json({ error: 'Esa lección no está habilitada para tu rol' }, { status: 403 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_ADIESTRAMIENTO)
    .createSignedUrl(rutaEjemplo(numero, cual), SEGUNDOS_VALIDEZ)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se encontró el ejemplo' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
