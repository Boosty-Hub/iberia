import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion, puede } from '@/lib/auth'
import { urlDeAutorizacion } from '@/lib/asistente/microsoft'

/**
 * «Conectar mi cuenta de Microsoft» (fase 7): manda a la persona, con su sesión,
 * al inicio de sesión de Microsoft de Iberia. La vuelta llega a `../retorno`.
 * La dirección de retorno es la que Iberia registró en Entra: sale de
 * NEXT_PUBLIC_SITE_URL, no del navegador.
 */
export async function GET(peticion: NextRequest) {
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.redirect(new URL('/login', peticion.url))
  if (!puede(sesion, 'sistema:asistente')) return NextResponse.redirect(new URL('/sistema?aviso=sin-permiso', peticion.url))
  const base = (process.env.NEXT_PUBLIC_SITE_URL || peticion.nextUrl.origin).replace(/\/$/, '')
  const url = await urlDeAutorizacion(sesion.userId, `${base}/api/asistente/microsoft/retorno`)
  if (!url) return NextResponse.redirect(new URL('/sistema/asistente/conexiones?error=sin-configurar', peticion.url))
  return NextResponse.redirect(url)
}
