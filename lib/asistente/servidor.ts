import 'server-only'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ModeloCatalogo, Politica } from '@/lib/asistente/tipos'
import { enOtraInvocacion, lanzarRemoto } from '@/lib/asistente/motor/servicio'
import type { OpcionesTurno } from '@/lib/asistente/motor/ejecutor'

/** La política efectiva de quien tiene la sesión (habilitación, modelos, topes, gasto). */
export async function miPolitica(): Promise<Politica | null> {
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').rpc('mi_politica')
  return (data as Politica | null) ?? null
}

export async function catalogoModelos(): Promise<ModeloCatalogo[]> {
  const supabase = await createClient()
  const { data } = await supabase.schema('asistente').from('modelo').select('id, proveedor, nombre, descripcion, esfuerzos, vision, encendido, orden').order('orden')
  return (data ?? []) as ModeloCatalogo[]
}

/**
 * El token de la sesión de quien pide el turno: con él corren las consultas a
 * la plataforma (fase 2), con la RLS de siempre. Viaja de servidor a servidor
 * (nunca se guarda). Si le quedan menos de 20 minutos, se renueva aquí, donde
 * la renovación puede escribir las cookies del navegador.
 */
export async function tokenDeSesion(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  let s = data.session
  if (s?.expires_at && s.expires_at * 1000 - Date.now() < 20 * 60_000) {
    const { data: nueva } = await supabase.auth.refreshSession()
    s = nueva.session ?? s
  }
  return s?.access_token ?? null
}


/**
 * Dispara el turno sin esperarlo. En Netlify, la función de fondo responde 202
 * en el acto y sigue sola; la pantalla se entera por Realtime. En local corre
 * dentro de `after()`: la respuesta ya salió y no hay límite de tiempo.
 */
export async function lanzarTurno(turnoId: string, origen: string, token: string | null, extra: Omit<OpcionesTurno, 'token'> = {}): Promise<void> {
  if (enOtraInvocacion()) {
    // Netlify: la función de fondo del sitio. Supabase (piloto): la Edge Function `asistente-turno`.
    await lanzarRemoto({ turno: turnoId, token, ...extra }, process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || origen)
    return
  }
  after(async () => {
    const { ejecutarTurno } = await import('@/lib/asistente/motor/ejecutor')
    await ejecutarTurno(turnoId, { token, ...extra })
  })
}
