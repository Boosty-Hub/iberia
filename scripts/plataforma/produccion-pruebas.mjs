/**
 * Construye y levanta el BUILD DE PRODUCCIÓN (`next build` + `next start`)
 * contra el PROYECTO DE PRUEBAS de Supabase, en el 3007, desligado de la
 * terminal. Sirve para medir rendimiento y accesibilidad como los vería un
 * usuario (el `next dev` del 3005 compila al vuelo y mide de más).
 *
 *   node --env-file=.env.local scripts/plataforma/produccion-pruebas.mjs            # build + start
 *   node --env-file=.env.local scripts/plataforma/produccion-pruebas.mjs --sin-build # solo start
 *
 * ⚠️ Las `NEXT_PUBLIC_*` se incrustan al construir: este build lleva la URL de
 * PRUEBAS. No se despliega (Netlify construye el suyo). El dev del 3005 vive en
 * `.next/dev` y no choca con este build.
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, openSync } from 'node:fs'

const e = process.env
for (const v of ['SUPABASE_PRUEBAS_URL', 'SUPABASE_PRUEBAS_PUBLISHABLE_KEY', 'SUPABASE_PRUEBAS_SECRET_KEY'])
  if (!e[v]) throw new Error(`Falta ${v} en .env.local`)
if (e.SUPABASE_PRUEBAS_URL === e.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se corre')

const PUERTO = process.argv.includes('--puerto') ? process.argv[process.argv.indexOf('--puerto') + 1] : '3007'
const env = {
  ...e,
  NEXT_PUBLIC_SUPABASE_URL: e.SUPABASE_PRUEBAS_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: e.SUPABASE_PRUEBAS_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: e.SUPABASE_PRUEBAS_SECRET_KEY,
  NEXT_PUBLIC_SITE_URL: `http://localhost:${PUERTO}`,
}

mkdirSync('capturas', { recursive: true })
if (!process.argv.includes('--sin-build')) {
  console.log('next build contra pruebas…')
  const r = spawnSync('cmd.exe', ['/c', 'npx next build'], { stdio: 'inherit', env })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
const salida = openSync(`capturas/servidor-${PUERTO}.log`, 'w')
const hijo = spawn('cmd.exe', ['/c', `npx next start -p ${PUERTO}`], { detached: true, stdio: ['ignore', salida, salida], windowsHide: true, env })
hijo.unref()
console.log(`next start (build de producción, base de pruebas) en http://localhost:${PUERTO} (pid ${hijo.pid}); salida en capturas/servidor-${PUERTO}.log`)
