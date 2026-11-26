import { NextResponse, type NextRequest } from 'next/server'
import { obtenerSesion } from '@/lib/auth'
import { completarConexion } from '@/lib/asistente/microsoft'

/**
 * La vuelta del inicio de sesión de Microsoft (fase 7). Comprueba que el
 * `state` sea de ESTA sesión (no se conecta la cuenta de otro), canjea el código
 * con el certificado de la plataforma y guarda la conexión. Lo que Microsoft
 * niega (usuario no asignado en Entra, consentimiento cancelado) se explica.
 */
const MOTIVOS: [RegExp, string][] = [
  [/AADSTS50105|not assigned|no asignad/i, 'Tu usuario no está asignado a la aplicación de la plataforma en Microsoft. Pídeselo al administrador de Microsoft de Iberia.'],
  [/AADSTS65004|consent|declined|cancel/i, 'Cancelaste el permiso en Microsoft. Si fue sin querer, vuelve a conectar.'],
  [/AADSTS53003|conditional/i, 'Una política de acceso de Iberia (por ejemplo, el dispositivo o el doble factor) no dejó conectar.'],
]

export async function GET(peticion: NextRequest) {
  const sp = peticion.nextUrl.searchParams
  const volver = (q: string) => NextResponse.redirect(new URL(`/sistema/asistente/conexiones?${q}`, peticion.url))
  const sesion = await obtenerSesion()
  if (!sesion) return NextResponse.redirect(new URL('/login', peticion.url))
  const error = sp.get('error')
  if (error) {
    const detalle = `${error} ${sp.get('error_description') ?? ''}`
    const motivo = MOTIVOS.find(([re]) => re.test(detalle))?.[1] ?? 'Microsoft no dejó conectar la cuenta.'
    return volver(`error=${encodeURIComponent(motivo)}`)
  }
  const codigo = sp.get('code')
  const estado = sp.get('state')
  if (!codigo || !estado) return volver(`error=${encodeURIComponent('Faltan datos de Microsoft. Vuelve a intentarlo.')}`)
  const base = (process.env.NEXT_PUBLIC_SITE_URL || peticion.nextUrl.origin).replace(/\/$/, '')
  const r = await completarConexion(sesion.userId, codigo, estado, `${base}/api/asistente/microsoft/retorno`)
  return r.ok ? volver(`ok=${encodeURIComponent(r.cuenta)}`) : volver(`error=${encodeURIComponent(r.error)}`)
}
