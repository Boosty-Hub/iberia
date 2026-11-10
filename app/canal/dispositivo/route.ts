import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_DISPOSITIVO, tokenValido } from '@/lib/notificaciones'
import { createClient } from '@/lib/supabase/server'

/**
 * Registra el teléfono de quien está en el canal, para mandarle avisos.
 *
 * La llama `NotificacionesNativas` con `fetch` dentro de la app cada vez que iOS
 * le entrega el token —al entrar al canal con permiso de avisos—, así que la fila
 * queda al día si Apple lo cambia. Si el token estaba en otra cuenta, pasa a
 * esta: el token es del aparato (ver la migración de `dispositivos`).
 *
 * ⚠️ **Es una ruta y no una acción de servidor** desde el 10 de noviembre de 2026.
 * Una acción que pone una cookie hace que Next vuelva a pintar el canal en el
 * servidor y lo mande dentro de la respuesta; en el teléfono, con la red de
 * planta, eso se cortaba. Aquí la respuesta es un JSON de dos líneas y la página
 * no se refresca.
 *
 * Exige sesión: el proxy manda al login sin ella, y aquí se vuelve a comprobar.
 * Deja además la cookie con el token, que es lo que el cierre de sesión
 * (`olvidarEsteTelefono`) usa para desligar el teléfono. Va `httpOnly`: el código
 * de la página no la necesita.
 */
export async function POST(request: NextRequest) {
  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const { token, plataforma } = (cuerpo ?? {}) as { token?: unknown; plataforma?: unknown }
  if (plataforma !== 'ios' && plataforma !== 'android') {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  if (typeof token !== 'string' || !tokenValido(token)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const { error } = await supabase.rpc('registrar_dispositivo', {
    p_token: token,
    p_plataforma: plataforma,
  })
  if (error) return NextResponse.json({ ok: false }, { status: 500 })

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
  return NextResponse.json({ ok: true })
}
