/**
 * Piloto del ejecutor del asistente en Supabase Edge Functions (26-nov-2026). Empaqueta `lib/asistente/motor/` en
 * `supabase/functions/asistente-turno/motor.js` con `deno bundle` (la API de despliegue solo sube la carpeta de la
 * función), la despliega sin verificar JWT y le carga los secretos por la Management API (sin archivo intermedio).
 *
 *   node --env-file=.env.local scripts/asistente/desplegar-edge.mjs [--url-base https://…] [--solo-secretos]
 *   node --env-file=.env.local scripts/asistente/desplegar-edge.mjs --destino produccion --confirmo   # con el OK de Gabriel
 *
 * Pruebas por defecto. `ASISTENTE_URL_BASE` es la plataforma a la que la función le pregunta los datos
 * (`/api/asistente/fuente`) y le avisa al programador: con el dev de pruebas en localhost, la función no la alcanza,
 * así que sin `--url-base` pública las herramientas de datos fallan (lo demás corre).
 * Necesita `deno` (2.4 o más) y `SUPABASE_ACCESS_TOKEN`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const arg = (n) => {
  const i = process.argv.indexOf(n)
  return i > 0 ? process.argv[i + 1] : undefined
}
const e = process.env
const produccion = arg('--destino') === 'produccion'
if (produccion && !process.argv.includes('--confirmo')) throw new Error('Producción pide --confirmo (y el OK de Gabriel).')
const ref = produccion ? new URL(e.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0] : e.SUPABASE_PRUEBAS_REF
const claveServicio = produccion ? e.SUPABASE_SECRET_KEY : e.SUPABASE_PRUEBAS_SECRET_KEY
if (!ref || !claveServicio || !e.SUPABASE_ACCESS_TOKEN) throw new Error('Faltan el ref, la clave de servicio o SUPABASE_ACCESS_TOKEN')
const urlBase = arg('--url-base') || (produccion ? 'https://iberiavenezuela.netlify.app' : 'http://localhost:3005')

const DIR = 'supabase/functions/asistente-turno'
if (!process.argv.includes('--solo-secretos')) {
  execFileSync('deno', ['bundle', '--config', `${DIR}/deno.json`, '--unstable-sloppy-imports', '-q', '-o', `${DIR}/motor.js`, `${DIR}/_entrada.ts`], { stdio: 'inherit' })
  if (!existsSync(`${DIR}/motor.js`)) throw new Error('deno bundle no dejó motor.js')
  // `--use-api`: sin Docker. `--yes`: el destino ya lo eligió quien corre esto (pruebas, o producción con --confirmo).
  execFileSync('npx', ['supabase', 'functions', 'deploy', 'asistente-turno', `--remote=${ref}`, '--no-verify-jwt', '--use-api', '--yes'], { stdio: 'inherit', shell: true })
}

// Los secretos de la función. Los que empiezan por SUPABASE_ los pone la plataforma y no se pueden cargar:
// `entorno.ts` traduce los nombres. ASISTENTE_CORREO_DESVIO y los ASISTENTE_MS_* son solo de prueba en Next: no van.
const secretos = {
  ASISTENTE_SECRETO: e.ASISTENTE_SECRETO,
  ASISTENTE_CLAVE_SERVICIO: claveServicio,
  ASISTENTE_URL_BASE: urlBase,
  ANTHROPIC_API_KEY_SALDO: e.ANTHROPIC_API_KEY_SALDO,
  ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: e.OPENAI_API_KEY,
  ...(e.ASISTENTE_TRAMO_MS ? { ASISTENTE_TRAMO_MS: e.ASISTENTE_TRAMO_MS } : {}),
}
const cuerpo = Object.entries(secretos)
  .filter(([, v]) => typeof v === 'string' && v.trim())
  .map(([name, value]) => ({ name, value: value.trim() }))
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/secrets`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${e.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(cuerpo),
})
if (!r.ok) throw new Error(`No se cargaron los secretos (${r.status}): ${await r.text()}`)
console.log(`asistente-turno en ${produccion ? 'PRODUCCIÓN' : 'pruebas'} (${ref}); secretos: ${cuerpo.map((s) => s.name).join(', ')}; plataforma: ${urlBase}`)
