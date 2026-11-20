/**
 * Levanta `next dev` contra el PROYECTO DE PRUEBAS de Supabase, en el 3005,
 * desligado de la terminal (ver «Trampas conocidas» en AGENTS.md: un dev cuya
 * terminal muere rompe las rutas con parámetro). La salida va a
 * `capturas/servidor-3005.log`.
 *
 *   node --env-file=.env.local scripts/plataforma/dev-pruebas.mjs
 *
 * Las variables del proceso mandan sobre `.env.local` en Next, así que basta con
 * pasarle las de pruebas: producción no se toca.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, openSync } from 'node:fs'

const e = process.env
for (const v of ['SUPABASE_PRUEBAS_URL', 'SUPABASE_PRUEBAS_PUBLISHABLE_KEY', 'SUPABASE_PRUEBAS_SECRET_KEY'])
  if (!e[v]) throw new Error(`Falta ${v} en .env.local`)

mkdirSync('capturas', { recursive: true })
const salida = openSync('capturas/servidor-3005.log', 'w')
const hijo = spawn('cmd.exe', ['/c', 'npx next dev -p 3005'], {
  detached: true,
  stdio: ['ignore', salida, salida],
  windowsHide: true,
  env: {
    ...e,
    NEXT_PUBLIC_SUPABASE_URL: e.SUPABASE_PRUEBAS_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: e.SUPABASE_PRUEBAS_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: e.SUPABASE_PRUEBAS_SECRET_KEY,
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3005',
  },
})
hijo.unref()
console.log(`next dev contra pruebas en http://localhost:3005 (pid ${hijo.pid}); salida en capturas/servidor-3005.log`)
