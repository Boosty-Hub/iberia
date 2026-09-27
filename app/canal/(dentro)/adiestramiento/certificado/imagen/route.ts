import { NextResponse, type NextRequest } from 'next/server'
import { CURSO } from '@/lib/adiestramiento'
import { empleadoActual } from '@/lib/canal'
import { nombreArchivo } from '@/lib/certificado'
import { imagenCertificado } from '@/lib/certificado-imagen'
import { createClient } from '@/lib/supabase/server'

/**
 * Mi certificado en imagen, con la cédula: el que se guarda en el teléfono y el
 * que se manda por WhatsApp. El que va al canal, sin cédula, lo dibuja la acción
 * que lo publica. Ver `lib/certificado-imagen.tsx`.
 *
 * Con sesión y solo el propio: el certificado se busca por la matrícula de quien
 * lo pide, y la RLS de `certificados` no deja leer el de otro.
 *
 * `?descargar` lo manda como archivo —«Guardarlo»—; sin eso se muestra.
 */
export async function GET(peticion: NextRequest) {
  const empleado = await empleadoActual()
  if (!empleado) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  const supabase = await createClient()
  const { data: curso } = await supabase.from('cursos').select('id').eq('clave', CURSO).maybeSingle()
  if (!curso) return NextResponse.json({ error: 'No hay curso' }, { status: 404 })

  const { data: matricula } = await supabase
    .from('matriculas')
    .select('id')
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleado.id)
    .maybeSingle()
  if (!matricula) return NextResponse.json({ error: 'Sin matrícula' }, { status: 404 })

  const { data: certificado } = await supabase
    .from('certificados')
    .select('codigo, nombre_completo, cedula, cargo, area_nombre, emitido_en')
    .eq('matricula_id', matricula.id)
    .maybeSingle()
  if (!certificado) return NextResponse.json({ error: 'Todavía no hay certificado' }, { status: 404 })

  const imagen = await imagenCertificado(certificado, { conCedula: true })
  const bytes = await imagen.arrayBuffer()

  const cabeceras: Record<string, string> = {
    'Content-Type': 'image/png',
    'Cache-Control': 'private, max-age=300',
  }
  if (peticion.nextUrl.searchParams.has('descargar')) {
    cabeceras['Content-Disposition'] = `attachment; filename="${nombreArchivo(certificado.codigo)}"`
  }
  return new NextResponse(bytes, { headers: cabeceras })
}
