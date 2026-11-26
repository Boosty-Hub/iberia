import 'server-only'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ModeloCatalogo, Politica } from '@/lib/asistente/tipos'
import { secretoAsistente } from '@/lib/asistente/motor/servicio'

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

/** ¿Corre en Netlify? Ahí el turno va a la función de fondo (hasta 15 min); en local, en `after()`. */
function enNetlify(): boolean {
  if (process.env.ASISTENTE_EJECUTOR === 'local') return false
  if (process.env.ASISTENTE_EJECUTOR === 'netlify') return true
  return !!(process.env.NETLIFY || process.env.SITE_ID || process.env.DEPLOY_URL)
}

/**
 * Dispara el turno sin esperarlo. En Netlify, la función de fondo responde 202
 * en el acto y sigue sola; la pantalla se entera por Realtime. En local corre
 * dentro de `after()`: la respuesta ya salió y no hay límite de tiempo.
 */
export async function lanzarTurno(turnoId: string, origen: string): Promise<void> {
  if (enNetlify()) {
    const base = process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || origen
    const r = await fetch(`${base}/.netlify/functions/asistente-turno-background`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': secretoAsistente() },
      body: JSON.stringify({ turno: turnoId }),
    })
    if (r.status !== 202 && !r.ok) throw new Error(`No se pudo lanzar el turno (${r.status}).`)
    return
  }
  after(async () => {
    const { ejecutarTurno } = await import('@/lib/asistente/motor/ejecutor')
    await ejecutarTurno(turnoId)
  })
}
