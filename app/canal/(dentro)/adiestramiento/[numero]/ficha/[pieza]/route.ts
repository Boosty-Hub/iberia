import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { empleadoActual } from '@/lib/canal'
import { BUCKET_ADIESTRAMIENTO, rutaFicha } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** Un poco más que los audios: la persona la va a mirar y a guardar. */
const SEGUNDOS_VALIDEZ = 300

/**
 * Entrega la ficha de bolsillo de una lección.
 *
 * Mismas tres puertas que el audio —sesión, ficha en el padrón y matrícula en
 * el curso— porque es lo mismo: material del curso bajo NDA. Que sea una imagen
 * y no un sonido no la hace pública.
 *
 * La vigencia es más larga que la del audio a propósito. Un audio se oye y se
 * acaba; una ficha se mira, se cierra, se vuelve a abrir y se guarda en la
 * galería, y un enlace de 60 segundos se le muere a la persona en la mano.
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

  // La pieza entra en la ruta del bucket: se acota a lo que el generador puede
  // producir —`03`, `08-A`— antes de armar ninguna ruta con ella.
  if (!Number.isInteger(numero) || numero < 0 || !/^\d{2}(-[AB])?$/.test(pieza)) {
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
    .createSignedUrl(rutaFicha(pieza), SEGUNDOS_VALIDEZ)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se encontró la ficha' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
