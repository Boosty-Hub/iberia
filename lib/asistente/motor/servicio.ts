/**
 * Lo que el ejecutor necesita del entorno, sin depender de Next: corre igual
 * en una ruta de Next (desarrollo) y en la función de fondo de Netlify.
 *
 * ⚠️ Nada de `server-only` ni de `next/*` en `lib/asistente/motor/`: el paquete
 * `server-only` lanza fuera del entorno de React Server, y la función de fondo
 * no lo es.
 */
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { Database } from '../../database.types'
import { claveAnthropic } from '../../clave-anthropic'

export type BaseServicio = ReturnType<typeof crearServicio>

/** El cliente con la clave de servicio. Solo escribe lo del asistente; nunca lee datos de la plataforma por cuenta de nadie. */
export function crearServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secreto = process.env.SUPABASE_SECRET_KEY
  if (!url || !secreto) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY')
  return createClient<Database>(url, secreto, { auth: { persistSession: false, autoRefreshToken: false } })
}

/** El cliente de Anthropic, con la dirección explícita (Netlify trae una `ANTHROPIC_BASE_URL` ajena). */
export function crearAnthropic(): Anthropic {
  const { clave } = claveAnthropic()
  if (!clave) throw new Error('No hay clave de Anthropic configurada (ANTHROPIC_API_KEY_SALDO).')
  return new Anthropic({ apiKey: clave, baseURL: 'https://api.anthropic.com', maxRetries: 2, timeout: 14 * 60_000 })
}

export function claveOpenAI(): string {
  const clave = process.env.OPENAI_API_KEY?.trim()
  if (!clave) throw new Error('No hay clave de OpenAI configurada (OPENAI_API_KEY).')
  return clave
}

/** El secreto compartido entre la acción que dispara el turno y quien lo ejecuta. */
export function secretoAsistente(): string {
  const s = process.env.ASISTENTE_SECRETO?.trim()
  if (!s || s.length < 24) throw new Error('Falta ASISTENTE_SECRETO (24 caracteres o más).')
  return s
}

/** Compara en tiempo constante. */
export function mismoSecreto(a: string | null | undefined, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** Las betas que usa el motor de Anthropic. */
export const BETAS_ANTHROPIC = ['code-execution-2025-08-25', 'files-api-2025-04-14', 'skills-2025-10-02', 'server-side-fallback-2026-07-01'] as const
export const BETA_ARCHIVOS = ['files-api-2025-04-14'] as const

/** La dirección de la plataforma, para las rutas internas (fuentes, programador). */
export function urlBase(): string {
  return (process.env.ASISTENTE_URL_BASE || process.env.URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Dónde corre el turno:
 * - `netlify`: la función de fondo de Netlify (15 min por invocación; tramos de 12).
 * - `supabase`: la Edge Function `asistente-turno` (piloto del 26-nov-2026; 400 s por invocación en Pro, tramos de 4 min).
 * - `local`: dentro de `after()` del servidor de Next, sin límite (desarrollo).
 * `ASISTENTE_EJECUTOR` lo fija; sin ella, Netlify si se está en Netlify, y si no, local.
 */
export type ModoEjecutor = 'netlify' | 'supabase' | 'local'
export function modoEjecutor(): ModoEjecutor {
  const e = process.env.ASISTENTE_EJECUTOR
  if (e === 'local' || e === 'netlify' || e === 'supabase') return e
  return process.env.NETLIFY || process.env.SITE_ID || process.env.DEPLOY_URL ? 'netlify' : 'local'
}

/** El turno corre fuera del servidor de Next (en otra invocación, con tope de tiempo y por tramos). */
export function enOtraInvocacion(): boolean {
  return modoEjecutor() !== 'local'
}

/** Lo que dura un tramo antes de guardar el estado y seguir en otra invocación (0 = sin tramos). */
export function tramoMs(): number {
  const fijo = Number(process.env.ASISTENTE_TRAMO_MS)
  if (fijo > 0) return fijo
  const modo = modoEjecutor()
  return modo === 'netlify' ? 12 * 60_000 : modo === 'supabase' ? 4 * 60_000 : 0
}

/**
 * Lanza un turno (o su tramo siguiente) en el ejecutor remoto. Los dos responden 202 en el acto y siguen solos.
 * Una redirección (p. ej. a /login) no es arrancar: no se sigue (pasó el 26-nov-2026 con el proxy de Next).
 */
export async function lanzarRemoto(cuerpo: Record<string, unknown>, base: string = urlBase()): Promise<void> {
  const modo = modoEjecutor()
  if (modo === 'local') throw new Error('lanzarRemoto no aplica con el ejecutor local')
  const url =
    modo === 'supabase'
      ? `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1/asistente-turno`
      : `${base.replace(/\/$/, '')}/.netlify/functions/asistente-turno-background`
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': secretoAsistente() },
    redirect: 'manual',
    body: JSON.stringify(cuerpo),
  })
  if (r.status !== 202) throw new Error(`No se pudo lanzar el turno en ${modo} (${r.status}).`)
}
