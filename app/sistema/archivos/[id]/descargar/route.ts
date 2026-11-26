import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'
import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * Un archivo de Mis archivos. La fila se lee con la sesión de quien pide: la RLS de `asistente.archivo` es la
 * autorización (lo propio, lo de sus chats, lo compartido, también por carpeta). El enlace lo firma el servidor,
 * porque una referencia vive en otro bucket (documentos, expediente, curso…) con su propia política. Enlace de 60 s.
 *
 * `?ver=1` sirve los bytes desde el mismo origen (vista previa: el visor de PDF los lee con `fetch`); sin él, descarga.
 */
const MAX_EN_LINEA = 40 * 1024 * 1024

export async function GET(peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  if (!puede(sesion, 'sistema:archivos') && !puede(sesion, 'sistema:asistente')) return NextResponse.json({ error: 'Sin Mis archivos' }, { status: 403 })
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: 'No válido' }, { status: 400 })
  const supabase = await createClient()
  const { data: a } = await supabase.schema('asistente').from('archivo').select('nombre, ruta, bucket, mime, bytes, estado').eq('id', id).maybeSingle()
  if (!a || a.estado !== 'listo') return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  const admin = createAdminClient()
  if (peticion.nextUrl.searchParams.get('ver') === '1' && Number(a.bytes) <= MAX_EN_LINEA) {
    const { data, error } = await admin.storage.from(a.bucket).download(a.ruta)
    if (error || !data) return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 500 })
    return new NextResponse(data.stream(), {
      headers: {
        'Content-Type': a.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(a.nombre)}`,
        'Cache-Control': 'private, no-store',
        // Un HTML o un SVG subido no corre con la sesión de la plataforma.
        'Content-Security-Policy': "sandbox; default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }
  const { data, error } = await admin.storage.from(a.bucket).createSignedUrl(a.ruta, 60, { download: a.nombre })
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
