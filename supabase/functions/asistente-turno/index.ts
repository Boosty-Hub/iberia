/**
 * Piloto (26-nov-2026, pedido de Gabriel: «que todo pase por Supabase»): el
 * ejecutor del asistente como Edge Function. Hace lo mismo que la función de
 * fondo de Netlify (`netlify/functions/asistente-turno-background.mts`) con el
 * mismo código —`lib/asistente/motor/`, sin copiarlo—: responde 202 en el acto y
 * corre el turno con `EdgeRuntime.waitUntil`. En Pro una invocación aguanta
 * 400 s, así que el turno se parte en tramos de 4 min (`tramoMs()`).
 *
 * Se despliega sin verificar JWT (`--no-verify-jwt`): no la llama un navegador
 * sino el servidor, con el secreto compartido `ASISTENTE_SECRETO`. El secreto se
 * revisa antes de cargar el motor: lo que llega sin él no gasta ni el arranque.
 */
import './entorno.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

function mismoSecreto(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

// `motor.js` lo genera `scripts/asistente/desplegar-edge.mjs` con `deno bundle` desde `lib/asistente/motor/` (vía
// `_entrada.ts`): la API de despliegue solo sube lo que está en esta carpeta. No se edita ni va a git.
let motor: Promise<typeof import('./motor.js')> | null = null

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })
  const secreto = Deno.env.get('ASISTENTE_SECRETO')?.trim() ?? ''
  if (secreto.length < 24 || !mismoSecreto(req.headers.get('x-asistente-secreto'), secreto)) return new Response('No autorizado', { status: 401 })
  const { turno, token, nota, efimero } = (await req.json().catch(() => ({}))) as { turno?: string; token?: string | null; nota?: string | null; efimero?: boolean }
  if (!turno || !/^[0-9a-f-]{36}$/.test(turno)) return new Response('Falta el turno', { status: 400 })
  let m: Awaited<NonNullable<typeof motor>>
  try {
    m = await (motor ??= import('./motor.js'))
  } catch (e) {
    motor = null
    console.error('[asistente-turno] el motor no cargó', e)
    // Solo lo lee quien trae el secreto: es el servidor de la plataforma.
    return new Response(`El motor no cargó: ${e instanceof Error ? e.message : String(e)}`, { status: 500 })
  }
  const inicio = Date.now()
  EdgeRuntime.waitUntil(
    m
      .ejecutarTurno(turno, { token: typeof token === 'string' ? token : null, nota: typeof nota === 'string' ? nota.slice(0, 2000) : null, efimero: efimero === true })
      .catch((e) => console.error('[asistente-turno]', turno, e))
      .finally(() => console.log('[asistente-turno]', turno, `${Date.now() - inicio} ms`)),
  )
  return new Response(null, { status: 202 })
})

// Si la plataforma va a cortar la invocación (400 s, o la CPU), que quede en el registro.
addEventListener('beforeunload', (ev) => console.warn('[asistente-turno] se apaga:', (ev as unknown as { detail?: { reason?: string } }).detail?.reason))
