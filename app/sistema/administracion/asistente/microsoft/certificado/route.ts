import { NextResponse } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'
import { certificadoPublico } from '@/lib/asistente/microsoft'

/** El certificado PÚBLICO de la plataforma (.cer), para subirlo a la aplicación de Iberia en Entra. La llave privada nunca sale. */
export async function GET() {
  const sesion = await obtenerSesion()
  if (!sesion || !puede(sesion, 'sistema:asistente-admin')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const cer = await certificadoPublico()
  if (!cer) return NextResponse.json({ error: 'Sin certificado' }, { status: 404 })
  return new NextResponse(new Uint8Array(cer), {
    headers: {
      'Content-Type': 'application/pkix-cert',
      'Content-Disposition': 'attachment; filename="plataforma-iberia-asistente.cer"',
      'Cache-Control': 'private, no-store',
    },
  })
}
