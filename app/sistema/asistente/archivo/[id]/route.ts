import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * Un archivo del asistente (subido o generado), por enlace firmado de 60 s. La
 * fila se lee con la sesión de quien pide (la RLS deja solo lo suyo y lo de sus
 * chats) y el enlace lo firma también su sesión: la política del bucket vuelve
 * a preguntar. `?ver=1` lo abre en línea (imágenes, PDF); sin él, se descarga.
 */
export async function GET(peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  if (!puede(sesion, 'sistema:asistente')) return NextResponse.json({ error: 'Sin el asistente de IA habilitado' }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'No válido' }, { status: 400 })
  const supabase = await createClient()
  const { data: archivo } = await supabase.schema('asistente').from('archivo').select('nombre, ruta, estado').eq('id', id).maybeSingle()
  if (!archivo || archivo.estado !== 'listo') return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  const enLinea = peticion.nextUrl.searchParams.get('ver') === '1'
  const { data, error } = await supabase.storage
    .from('asistente')
    .createSignedUrl(archivo.ruta, 60, enLinea ? undefined : { download: archivo.nombre })
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
