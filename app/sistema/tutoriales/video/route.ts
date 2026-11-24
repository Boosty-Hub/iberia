import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/** El enlace firmado dura lo que un tutorial largo con pausas: el navegador pide trozos (Range) mientras se ve. */
const SEGUNDOS = 60 * 60

/**
 * El video (o el póster, con `&poster=1`) del tutorial de una pestaña, por un enlace firmado del bucket privado
 * `tutoriales`. La RLS de `ui.tutorial` decide si quien pide puede abrirlo (el permiso de la pestaña), y la política
 * del bucket lo vuelve a preguntar al firmar.
 */
export async function GET(peticion: NextRequest) {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  const ruta = peticion.nextUrl.searchParams.get('ruta') ?? ''
  const poster = peticion.nextUrl.searchParams.get('poster') === '1'
  if (!ruta.startsWith('/sistema/')) return NextResponse.json({ error: 'Tutorial no encontrado' }, { status: 404 })

  const supabase = await createClient()
  const { data: t } = await supabase.schema('ui').from('tutorial').select('archivo, poster').eq('ruta', ruta).maybeSingle()
  const objeto = poster ? t?.poster : t?.archivo
  if (!objeto) return NextResponse.json({ error: 'Tutorial no encontrado' }, { status: 404 })

  const { data, error } = await supabase.storage.from('tutoriales').createSignedUrl(objeto, SEGUNDOS)
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'No se pudo abrir el tutorial' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl, { headers: { 'Cache-Control': 'private, no-store' } })
}
