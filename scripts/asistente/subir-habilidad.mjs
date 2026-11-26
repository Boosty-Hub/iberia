/**
 * Sube (o actualiza con una versión nueva) una habilidad propia del asistente a
 * la API de habilidades de Anthropic, y la deja anotada en `asistente.config`.
 *
 *   node --env-file=.env.local scripts/asistente/subir-habilidad.mjs [carpeta] [--destino pruebas|produccion] [--confirmo]
 *
 * Por defecto: `assets/asistente/formato-iberia` y destino pruebas. La habilidad
 * vive en la cuenta de Anthropic (la misma clave para pruebas y producción): lo
 * que cambia por destino es solo dónde se anota su id.
 */
import Anthropic, { toFile } from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

const argv = process.argv.slice(2)
const carpeta = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--destino') ?? 'assets/asistente/formato-iberia'
const destino = argv.includes('--destino') ? argv[argv.indexOf('--destino') + 1] : 'pruebas'
if (destino === 'produccion' && !argv.includes('--confirmo')) throw new Error('A producción, solo con --confirmo')
const nombre = basename(carpeta)

const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY_SALDO || process.env.ANTHROPIC_API_KEY, baseURL: 'https://api.anthropic.com' })
const BETAS = ['skills-2025-10-02']

const archivos = await Promise.all(
  (await readdir(carpeta)).map(async (f) => toFile(await readFile(join(carpeta, f)), `${nombre}/${f}`))
)

let id = null
for await (const s of cliente.beta.skills.list({ source: 'custom', betas: BETAS })) {
  if (s.display_title === `Iberia · ${nombre}`) id = s.id
}
if (id) {
  const v = await cliente.beta.skills.versions.create(id, { files: archivos, betas: BETAS })
  console.log(`versión nueva de ${id}: ${v.version}`)
} else {
  const s = await cliente.beta.skills.create({ display_title: `Iberia · ${nombre}`, files: archivos, betas: BETAS })
  id = s.id
  console.log(`habilidad creada: ${id}`)
}

const url = destino === 'produccion' ? process.env.NEXT_PUBLIC_SUPABASE_URL : process.env.SUPABASE_PRUEBAS_URL
const secreto = destino === 'produccion' ? process.env.SUPABASE_SECRET_KEY : process.env.SUPABASE_PRUEBAS_SECRET_KEY
const db = createClient(url, secreto, { auth: { persistSession: false } })
const { data: config, error } = await db.schema('asistente').from('config').select('habilidades').eq('id', true).single()
if (error) throw error
const lista = [...new Set([...(config.habilidades ?? []), id])]
const { error: e2 } = await db.schema('asistente').from('config').update({ habilidades: lista }).eq('id', true)
if (e2) throw e2
console.log(`anotada en asistente.config (${destino}): ${lista.join(', ')}`)
