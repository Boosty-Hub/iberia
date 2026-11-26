/**
 * La función de fondo del asistente de IA: corre un turno hasta 15 minutos
 * (las funciones normales de Netlify cortan a los 60 s). El sufijo
 * `-background` del nombre es lo que la hace de fondo: Netlify responde 202 en
 * el acto y la sigue corriendo. Solo la llama `lanzarTurno()`, con el secreto
 * compartido; nunca recibe el texto del navegador, solo el id del turno y el
 * token de la sesión de quien lo pidió (para las consultas a la plataforma, con
 * su RLS; no se guarda).
 *
 * Importa con rutas relativas y nada de Next ni de `server-only`: no corre
 * dentro del servidor de Next.
 */
import { ejecutarTurno } from '../../lib/asistente/motor/ejecutor'
import { mismoSecreto, secretoAsistente } from '../../lib/asistente/motor/servicio'

const ejecutar = async (req: Request) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })
  if (!mismoSecreto(req.headers.get('x-asistente-secreto'), secretoAsistente())) return new Response('No autorizado', { status: 401 })
  const { turno, token } = (await req.json().catch(() => ({}))) as { turno?: string; token?: string | null }
  if (!turno || !/^[0-9a-f-]{36}$/.test(turno)) return new Response('Falta el turno', { status: 400 })
  await ejecutarTurno(turno, { token: typeof token === 'string' ? token : null })
  return new Response(null, { status: 202 })
}

export default ejecutar
