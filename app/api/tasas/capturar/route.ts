import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { capturarTasas } from '@/lib/tasas/capturar.mjs'

/**
 * Captura de tasas, para el programador (BCV a las 4:50 p. m. con reintentos;
 * paralelo a las 9, 13 y 17 h). Pide el secreto `TASAS_SECRETO` en la cabecera
 * `x-tasas-secreto`: sin él responde 401 y no dice nada más.
 *
 *   POST /api/tasas/capturar           → oficial + paralelo
 *   POST /api/tasas/capturar?paralelo  → solo paralelo
 */
/** Compara en tiempo constante (sobre el SHA-256, que iguala los largos). */
function mismoSecreto(dado: string | null, secreto: string): boolean {
  if (!dado) return false
  const a = createHash('sha256').update(dado).digest()
  const b = createHash('sha256').update(secreto).digest()
  return timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  const secreto = process.env.TASAS_SECRETO
  if (!secreto || !mismoSecreto(req.headers.get('x-tasas-secreto'), secreto)) return new Response(null, { status: 401 })
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
  const soloParalelo = new URL(req.url).searchParams.has('paralelo')
  const r = await capturarTasas(db, { soloParalelo })
  return Response.json(r, { status: r.avisos.length && !r.oficial.length && !r.paralelo ? 502 : 200 })
}
