import { NextResponse } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'

/** El certificado PÚBLICO de la plataforma (.cer), para subirlo a la aplicación de Iberia en Entra. La llave privada nunca sale. */
export async function GET() {
  const sesion = await obtenerSesion()
  if (!sesion || !puede(sesion, 'sistema:asistente-admin')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const cer = process.env.MICROSOFT_CERTIFICADO
  if (!cer) return NextResponse.json({ error: 'Sin certificado' }, { status: 404 })
  return new NextResponse(Buffer.from(cer, 'base64'), {
    headers: {
      'Content-Type': 'application/pkix-cert',
      'Content-Disposition': 'attachment; filename="plataforma-iberia-asistente.cer"',
      'Cache-Control': 'private, no-store',
    },
  })
}
