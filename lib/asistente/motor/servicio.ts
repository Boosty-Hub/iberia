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

/** ¿Corre en Netlify? Ahí el turno va a la función de fondo (15 min) y se parte en tramos. */
export function enNetlify(): boolean {
  if (process.env.ASISTENTE_EJECUTOR === 'local') return false
  if (process.env.ASISTENTE_EJECUTOR === 'netlify') return true
  return !!(process.env.NETLIFY || process.env.SITE_ID || process.env.DEPLOY_URL)
}
