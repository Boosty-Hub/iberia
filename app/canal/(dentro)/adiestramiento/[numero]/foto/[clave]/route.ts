import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { empleadoActual } from '@/lib/canal'
import { BUCKET_RESPUESTAS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** Lo justo para que la imagen cargue. El enlace no se puede compartir. */
const SEGUNDOS_VALIDEZ = 60

/**
 * Entrega la foto que la persona mandó en un ejercicio, para verla en su lección.
 *
 * Desde el 27 de septiembre de 2026 la foto se manda sola, sin nota —antes había
 * que escribir qué se le tomó—, así que es la foto lo que queda citado arriba de
 * la devolución. Mismas reglas que el audio de la devolución: la ruta del archivo
 * se lee de la fila de `respuestas`, que la RLS ya acotó a las propias, y solo
 * de una respuesta que entró como foto. Cambiar la clave en la barra no lleva a
 * la foto de nadie más: lleva a un 404.
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
    .select('media_url')
    .eq('matricula_id', matricula.id)
    .eq('leccion_id', leccion.id)
    .eq('clave_paso', clave)
    .eq('entrada', 'foto')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!respuesta?.media_url) {
    return NextResponse.json({ error: 'No hay foto' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_RESPUESTAS)
    .createSignedUrl(respuesta.media_url, SEGUNDOS_VALIDEZ)

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se encontró la foto' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
