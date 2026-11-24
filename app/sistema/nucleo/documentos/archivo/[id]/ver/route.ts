import { NextResponse, type NextRequest } from 'next/server'
import { archivoVisible, BUCKET_DOCUMENTOS, nombrePdf } from '@/lib/documentos-archivos'

/**
 * El PDF de un archivo de origen, **en línea**, para la vista previa de la ficha. Sirve los bytes desde el mismo
 * origen (un `iframe` con una URL firmada de otro dominio no siempre muestra el PDF) y nunca se cachea: es material
 * bajo NDA. Los PDF están optimizados —la mayoría pesa menos de 300 KB—; la descarga va por `descargar`.
 */
export async function GET(_peticion: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await archivoVisible(id)
  if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
  if (!r.archivo.pdf_ruta) return NextResponse.json({ error: 'Este archivo todavía no tiene vista previa' }, { status: 404 })

  const { data, error } = await r.supabase.storage.from(BUCKET_DOCUMENTOS).download(r.archivo.pdf_ruta)
  if (error || !data) return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 500 })

  return new NextResponse(data, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nombrePdf(r.archivo.nombre))}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
