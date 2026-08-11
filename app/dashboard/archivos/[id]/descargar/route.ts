import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion } from '@/lib/auth'
import { BUCKET_ARCHIVOS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/server'

/** Vigencia del enlace firmado: suficiente para iniciar la descarga, no más. */
const SEGUNDOS_VALIDEZ = 60

/**
 * Entrega el archivo mediante un enlace firmado de corta vida. El bucket es
 * privado, así que este handler es el único camino de descarga — y exige sesión.
 */
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
    .select('nombre, storage_path')
    .eq('id', id)
    .maybeSingle()

  if (!archivo) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_ARCHIVOS)
    .createSignedUrl(archivo.storage_path, SEGUNDOS_VALIDEZ, { download: archivo.nombre })

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo generar el enlace de descarga' },
      { status: 500 }
    )
  }

  return NextResponse.redirect(data.signedUrl)
}
