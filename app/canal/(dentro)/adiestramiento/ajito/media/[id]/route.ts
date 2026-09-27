import { NextResponse, type NextRequest } from 'next/server'
import { empleadoActual } from '@/lib/canal'
import { BUCKET_RESPUESTAS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/**
 * Lo que va dentro de un mensaje de la conversación con Ajito: la foto de la
 * persona, el dibujo de Ajito o, con `?que=audio`, lo que Ajito dijo hablado.
 *
 * El mensaje se lee con la sesión, así que la RLS de `charla_mensajes` ya decide
 * quién lo ve —su autor y los editores—, y se firma un enlace de 60 segundos al
 * bucket privado. Nada por URL pública.
 */
export async function GET(peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })

  if (!(await empleadoActual())) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  const supabase = await createClient()

  const { data: mensaje } = await supabase
    .from('charla_mensajes')
    .select('media_url, audio')
    .eq('id', id)
    .maybeSingle()

  const ruta = peticion.nextUrl.searchParams.get('que') === 'audio' ? mensaje?.audio : mensaje?.media_url
  if (!ruta) return NextResponse.json({ error: 'No hay nada' }, { status: 404 })

  const { data, error } = await supabase.storage.from(BUCKET_RESPUESTAS).createSignedUrl(ruta, 60)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'No se encontró' }, { status: 404 })
  return NextResponse.redirect(data.signedUrl)
}
