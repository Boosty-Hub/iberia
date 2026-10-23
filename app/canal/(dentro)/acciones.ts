'use server'

import { cookies } from 'next/headers'
import { COOKIE_DISPOSITIVO, tokenValido } from '@/lib/notificaciones'
import { createClient } from '@/lib/supabase/server'

/**
 * Registra el teléfono de quien está en el canal, para mandarle avisos.
 *
 * La llama `NotificacionesNativas` dentro de la app cada vez que iOS le entrega
 * el token —al entrar al canal con permiso de avisos—, así que la fila queda al
 * día si Apple lo cambia. Si el token estaba en otra cuenta, pasa a esta: el
 * token es del aparato (ver la migración de `dispositivos`).
 *
 * Deja además la cookie con el token, que es lo que el cierre de sesión usa para
 * desligar el teléfono. Va `httpOnly`: el código de la página no la necesita.
 * ⚠️ Solo se escribe si cambió: poner una cookie desde una acción hace que Next
 * vuelva a pintar en el servidor la página y sus layouts, y esto corre cada vez
 * que se entra al canal.
 */
export async function registrarDispositivo(
  token: string,
  plataforma: string
): Promise<{ ok: boolean }> {
  if (plataforma !== 'ios' && plataforma !== 'android') return { ok: false }
  if (!tokenValido(token)) return { ok: false }

  const supabase = await createClient()
  const { error } = await supabase.rpc('registrar_dispositivo', {
    p_token: token,
    p_plataforma: plataforma,
  })
  if (error) return { ok: false }

  const almacen = await cookies()
  if (almacen.get(COOKIE_DISPOSITIVO)?.value !== token) {
    almacen.set(COOKIE_DISPOSITIVO, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Lo más que deja un navegador.
      maxAge: 60 * 60 * 24 * 400,
    })
  }
  return { ok: true }
}
