/**
 * La sesión de una cuenta de PRUEBA (`<rol>.pruebas@plataforma.local`) del
 * proyecto de pruebas de Supabase, acuñada con un enlace mágico y lista para
 * meterla como cookie en Playwright. Nunca la cuenta de una persona de Iberia;
 * nunca producción (falla si `SUPABASE_PRUEBAS_URL` es la de producción).
 *
 *   import { cookiesDePrueba, URL_PRUEBAS } from './sesion-pruebas.mjs'
 *   await ctx.addCookies(await cookiesDePrueba('admin', 'http://localhost:3007'))
 */
import { createClient } from '@supabase/supabase-js'

export const URL_PRUEBAS = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_PRUEBAS || !PUB || !SECRETO) throw new Error('Faltan las variables SUPABASE_PRUEBAS_* en .env.local')
if (URL_PRUEBAS === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se corre')

export const PUBLICA_PRUEBAS = PUB

export async function cookiesDePrueba(rol, base) {
  const admin = createClient(URL_PRUEBAS, SECRETO, { auth: { persistSession: false } })
  const anon = createClient(URL_PRUEBAS, PUB, { auth: { persistSession: false } })
  const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: `${rol}.pruebas@plataforma.local` })
  if (e1) throw e1
  const { data: ver, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (e2) throw e2
  const ref = new URL(URL_PRUEBAS).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
  const L = 3180
  const partes =
    valor.length <= L
      ? [{ name: `sb-${ref}-auth-token`, value: valor }]
      : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(base).hostname, path: '/' }))
}

/** Las rutas que mide R6 (rendimiento, accesibilidad y teléfono). */
export const RUTAS_R6 = [
  ['Mi día', '/sistema'],
  ['Org · Resumen', '/sistema/nucleo/organizacion/resumen'],
  ['Org · Plazas', '/sistema/nucleo/organizacion/plazas'],
  ['Org · Organigrama', '/sistema/nucleo/organizacion'],
  ['Pro · Resumen', '/sistema/nucleo/procesos/resumen'],
  ['Pro · Catálogo', '/sistema/nucleo/procesos/catalogo'],
  ['Pro · Mapa', '/sistema/nucleo/procesos'],
  ['Documentos', '/sistema/nucleo/documentos'],
  ['Bandeja', '/sistema/bandeja'],
  ['Tasas', '/sistema/finanzas/tasas'],
  ['Admin · IA', '/sistema/administracion/ia'],
]
