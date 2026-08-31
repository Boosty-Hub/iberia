import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion } from '@/lib/auth'
import { BUCKET_ARCHIVOS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/**
 * Entrega el archivo **en línea**, para el previsualizador.
 *
 * Existe aparte de `descargar` por una diferencia de una palabra que cambia
 * todo: ese handler firma la URL con `{ download: nombre }`, lo que pone
 * `Content-Disposition: attachment` y hace que el navegador guarde el archivo en
 * vez de mostrarlo. Dentro de un `<iframe>` eso no previsualiza nada — dispara
 * una descarga.
 *
 * Y aquí el binario **sí pasa por el servidor**, al contrario que en la subida
 * —donde el navegador escribe directo en Storage— y que en la descarga, que
 * redirige a la URL firmada. Es a propósito: sirviendo los bytes desde el mismo
 * origen, el visor puede leer un `.md` con `fetch` sin pelear con CORS, meter un
 * PDF en un `iframe` sin que la redirección se lo lleve a otro dominio, y poner
 * las cabeceras que hacen falta. Son nueve archivos que mira el equipo
 * consultor, no doscientos teléfonos de planta.
 */

/** Tope de lo que se sirve en línea. Por encima, se descarga y se abre aparte. */
const TOPE_BYTES = 25 * 1024 * 1024

export async function GET(
  _peticion: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sesion = await obtenerSesion()
  if (!sesion) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  const { id } = await params
  const supabase = await createClient()

  const { data: archivo } = await supabase
    .from('archivos')
    .select('nombre, storage_path, mime_type, tamano_bytes')
    .eq('id', id)
    .maybeSingle()

  if (!archivo) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  if ((archivo.tamano_bytes ?? 0) > TOPE_BYTES) {
    return NextResponse.json({ error: 'Demasiado grande para previsualizar' }, { status: 413 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_ARCHIVOS)
    .download(archivo.storage_path)

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo leer el archivo' },
      { status: 500 }
    )
  }

  return new NextResponse(data, {
    headers: {
      'Content-Type': archivo.mime_type ?? 'application/octet-stream',
      // `inline` es la palabra que hace que se vea en vez de descargarse. El
      // nombre va igual para que, si alguien lo guarda desde el visor, no se
      // llame como el id.
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(archivo.nombre)}`,
      // Material bajo NDA: no se cachea en ningún intermediario.
      'Cache-Control': 'private, no-store',
    },
  })
}
