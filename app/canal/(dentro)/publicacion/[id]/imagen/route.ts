import { NextResponse, type NextRequest } from 'next/server'
import { BUCKET_CANAL } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** Como las fichas: una imagen del feed se mira, se cierra y se vuelve a abrir. */
const SEGUNDOS_VALIDEZ = 300

/**
 * La imagen de una publicación del feed que vive en el bucket del canal —hoy,
 * el escudo que alguien publicó desde la lección 4—.
 *
 * La ruta del archivo se lee de la publicación, que la RLS ya acotó a lo
 * publicado: una publicación en borrador no enseña su imagen a nadie que no
 * pueda publicar. Con sesión, como todo el canal.
 */
export async function GET(_peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })

  const { data: publicacion } = await supabase
    .from('publicaciones')
    .select('imagen_ruta')
    .eq('id', id)
    .maybeSingle()
  if (!publicacion?.imagen_ruta) {
    return NextResponse.json({ error: 'No hay imagen' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_CANAL)
    .createSignedUrl(publicacion.imagen_ruta, SEGUNDOS_VALIDEZ)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'No se encontró la imagen' }, { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
