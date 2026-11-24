import { NextResponse, type NextRequest } from 'next/server'
import { archivoVisible, BUCKET_DOCUMENTOS, nombrePdf } from '@/lib/documentos-archivos'

/** Vigencia del enlace firmado: lo justo para que arranque la descarga. */
const SEGUNDOS_VALIDEZ = 60

/**
 * Descarga el PDF de un archivo de origen —o, con `?original=1`, el archivo tal cual, cuando ya esté cargado— por un
 * enlace firmado de 60 s. El bucket es privado y su política vuelve a preguntar si quien firma puede ver el documento.
 */
export async function GET(peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await archivoVisible(id)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const original = peticion.nextUrl.searchParams.get('original') === '1'
  const ruta = original ? r.archivo.original_ruta : r.archivo.pdf_ruta
  if (!ruta) return NextResponse.json({ error: original ? 'El original todavía no está cargado' : 'Este archivo todavía no está cargado' }, { status: 404 })

  const nombre = original ? r.archivo.nombre : nombrePdf(r.archivo.nombre)
  const { data, error } = await r.supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(ruta, SEGUNDOS_VALIDEZ, { download: nombre })
  if (error || !data?.signedUrl) return NextResponse.json({ error: 'No se pudo generar el enlace de descarga' }, { status: 500 })
  return NextResponse.redirect(data.signedUrl)
}
