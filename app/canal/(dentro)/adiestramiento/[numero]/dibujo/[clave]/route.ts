import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { empleadoActual } from '@/lib/canal'
import { BUCKET_RESPUESTAS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** Lo justo para que la imagen cargue. El enlace no se puede compartir. */
const SEGUNDOS_VALIDEZ = 60

/**
 * Entrega el dibujo que Ajito hizo con lo que la persona pidió en la lección 4.
 *
 * El dibujo habla de lo que ella pidió, así que se guarda en su carpeta del
 * bucket privado y se sirve con las mismas reglas que su foto: la ruta del
 * archivo se lee de la fila de `respuestas`, que la RLS ya acotó a las propias.
 * Cambiar la clave en la barra no lleva al dibujo de nadie más: lleva a un 404.
 */
export async function GET(
  _peticion: NextRequest,
  { params }: { params: Promise<{ numero: string; clave: string }> }
) {
  const empleado = await empleadoActual()
  if (!empleado) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  const { numero: crudo, clave } = await params
  const numero = Number(crudo)
  if (!Number.isInteger(numero) || numero < 0 || !/^[\w-]{1,40}$/.test(clave)) {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: curso } = await supabase
    .from('cursos')
    .select('id')
    .eq('clave', CURSO)
    .maybeSingle()
  if (!curso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const [{ data: matricula }, { data: leccion }] = await Promise.all([
    supabase
      .from('matriculas')
      .select('id')
      .eq('curso_id', curso.id)
      .eq('empleado_id', empleado.id)
      .maybeSingle(),
    supabase
      .from('lecciones')
      .select('id')
      .eq('curso_id', curso.id)
      .eq('numero', numero)
      .maybeSingle(),
  ])

  if (!matricula || !leccion) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  const { data: respuesta } = await supabase
    .from('respuestas')
    .select('dibujo')
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)
    .eq('clave_paso', clave)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!respuesta?.dibujo) {
    return NextResponse.json({ error: 'No hay dibujo' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_RESPUESTAS)
    .createSignedUrl(respuesta.dibujo, SEGUNDOS_VALIDEZ)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se encontró el dibujo' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
