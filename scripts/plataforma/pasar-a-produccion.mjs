/**
 * Plataforma Iberia · el paso a PRODUCCIÓN, como guion.
 *
 * Por defecto es un SIMULACRO (dry-run): lee de producción solo metadatos, por
 * la Management API y con GET —migraciones aplicadas, plan, registro público,
 * esquemas expuestos— y dice exactamente qué haría, en orden. No escribe nada.
 *
 *   node --env-file=.env.local scripts/plataforma/pasar-a-produccion.mjs
 *   node --env-file=.env.local scripts/plataforma/pasar-a-produccion.mjs --ejecutar --confirmo   # ⚠️ lo hace
 *
 * Con `--ejecutar --confirmo` (y solo con el OK de Gabriel, PENDIENTES.md):
 *   1. se niega si el plan es Free (G-06: «no antes de pasar Supabase a Pro») o
 *      si el registro público está abierto;
 *   2. aplica las migraciones pendientes en orden, cada una en su transacción
 *      por el query endpoint, y la anota en supabase_migrations.schema_migrations;
 *   3. expone los esquemas de la plataforma en la API (PostgREST);
 *   4. corre importar-base, importar-semillas y capturar-tasas --historico 45
 *      con `--destino produccion --confirmo`;
 *   5. regenera lib/database.types.ts desde producción.
 * Lo de Netlify (variables, programador de tasas) lo lista: se hace a mano.
 *
 * Antes de ejecutar: respaldo (PITR o pg_dump), commit de la rama en main y
 * despliegue sin las rutas nuevas expuestas, y después todas las suites
 * (la 20261120211000 reescribe 85 políticas).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

const args = process.argv.slice(2)
const EJECUTAR = args.includes('--ejecutar') && args.includes('--confirmo')
if (args.includes('--ejecutar') && !args.includes('--confirmo')) {
  console.error('✖ --ejecutar pide también --confirmo. Sin las dos, es un simulacro.')
  process.exit(1)
}
const e = process.env
const TOKEN = e.SUPABASE_ACCESS_TOKEN
const REF = e.SUPABASE_PROJECT_REF
if (!TOKEN || !REF) throw new Error('Faltan SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF')
if (REF === e.SUPABASE_PRUEBAS_REF) throw new Error('SUPABASE_PROJECT_REF es el de pruebas')

const API = 'https://api.supabase.com/v1'
const ESQUEMAS = ['org', 'sgc', 'flujo', 'control', 'ui', 'nucleo', 'ia']
const DESDE = '20261120' // las migraciones de la plataforma (Etapa 1 y rediseño R0–R6)
const VARIABLES_NETLIFY = [
  ['TASAS_SECRETO', 'secreta', 'la pide /api/tasas/capturar en la cabecera x-tasas-secreto (sin ella, 401)'],
  ['SUPABASE_SECRET_KEY', 'secreta (ya está)', 'la usa /api/tasas/capturar para escribir la tasa'],
  ['ANTHROPIC_API_KEY_SALDO', 'secreta (ya está)', 'la IA de la plataforma (R4) usa la misma clave que Ajito: lib/clave-anthropic.ts'],
  ['NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY / NEXT_PUBLIC_SITE_URL', 'ya están', 'sin cambio: se incrustan al compilar'],
]

async function leer(ruta) {
  const r = await fetch(API + ruta, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!r.ok) return { error: `HTTP ${r.status}` }
  return r.json()
}
async function sql(q) {
  if (!EJECUTAR) throw new Error('sql() solo con --ejecutar --confirmo')
  const r = await fetch(`${API}/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
  return r.json()
}

const titulo = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 70 - t.length))}`)
console.log(`${EJECUTAR ? '⚠️  EJECUCIÓN contra PRODUCCIÓN' : 'SIMULACRO (no escribe nada)'} · proyecto ${REF}`)

// ── 0. Lo que hay en producción (solo lectura) ──
const proyecto = await leer(`/projects/${REF}`)
const org = proyecto.organization_id ? await leer(`/organizations/${proyecto.organization_id}`) : {}
const migraciones = await leer(`/projects/${REF}/database/migrations`)
const auth = await leer(`/projects/${REF}/config/auth`)
const rest = await leer(`/projects/${REF}/postgrest`)

titulo('0. Producción hoy')
console.log(`Proyecto: ${proyecto.name ?? '—'} · región ${proyecto.region ?? '—'} · estado ${proyecto.status ?? proyecto.error}`)
const plan = org.plan ?? org.error ?? '—'
console.log(`Plan de la organización: ${plan}${plan === 'free' ? '  ✖ G-06: pasar a Pro antes (respaldos diarios/PITR, sin pausa por inactividad)' : ''}`)
const registroCerrado = auth.disable_signup === true
console.log(`Registro público: ${auth.error ?? (registroCerrado ? 'cerrado ✓' : '✖ ABIERTO — cerrarlo antes de seguir (handle_new_user toma el rol de los metadatos)')}`)
const expuestos = String(rest.db_schema ?? '').split(',').map((s) => s.trim()).filter(Boolean)
console.log(`Esquemas expuestos en la API: ${expuestos.join(', ') || rest.error || '—'}`)

const aplicadas = new Set((Array.isArray(migraciones) ? migraciones : []).map((m) => String(m.version)))
const archivos = (await readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort()
const pendientes = archivos.filter((f) => !aplicadas.has(f.split('_')[0]))
const sinArchivo = [...aplicadas].filter((v) => !archivos.some((f) => f.startsWith(v + '_')))
console.log(`Migraciones: ${aplicadas.size} aplicadas en producción, ${archivos.length} en el repositorio, ${pendientes.length} pendientes${Array.isArray(migraciones) ? '' : ` (${migraciones.error})`}`)
if (sinArchivo.length) console.log(`  ⚠️ En producción sin archivo en el repositorio: ${sinArchivo.join(', ')}`)
const ajenas = pendientes.filter((f) => f < DESDE)
if (ajenas.length) console.log(`  ⚠️ Pendientes de ANTES de la plataforma (revisar a mano, no se aplican solas): ${ajenas.join(', ')}`)
const plataforma = pendientes.filter((f) => f >= DESDE)

// ── El plan ──
const bloqueos = []
if (plan === 'free') bloqueos.push('el plan es Free (G-06)')
if (!registroCerrado) bloqueos.push('el registro público no está cerrado (o no se pudo leer)')
if (!Array.isArray(migraciones)) bloqueos.push('no se pudo leer la lista de migraciones aplicadas')
if (ajenas.length) bloqueos.push('hay migraciones pendientes anteriores a la plataforma')

titulo('1. Antes de tocar nada')
console.log('· Respaldo: PITR o `pg_dump` del proyecto (con Pro hay respaldo diario; anotar la hora).')
console.log('· La rama plataforma/etapa-1 revisada (incluido el informe de seguridad de R6) y fusionada; Netlify despliega al empujar a main.')

titulo(`2. Migraciones a aplicar (${plataforma.length}), en este orden`)
for (const f of plataforma) {
  const peso = (await readFile(`supabase/migrations/${f}`, 'utf8')).length
  console.log(`· ${f}  (${Math.round(peso / 1024)} KB)`)
}
console.log('  Cada una por el query endpoint (transacción propia) y anotada en supabase_migrations.schema_migrations.')

titulo('3. Esquemas a exponer en la API')
const faltan = ESQUEMAS.filter((s) => !expuestos.includes(s))
console.log(faltan.length ? `· Añadir a db_schema: ${faltan.join(', ')} → «${[...expuestos, ...faltan].join(', ')}»` : '· Ya están todos.')
console.log('  (`privado` NO se expone nunca: ver «Reportar y bloquear» en AGENTS.md.)')

titulo('4. Registro público')
console.log(registroCerrado ? '· Cerrado: nada que hacer. Se vuelve a comprobar antes de importar.' : '· ✖ Abierto: cerrarlo (Authentication → Sign In / Providers → «Allow new users to sign up» apagado) y volver a correr.')

titulo('5. Cargas iniciales (idempotentes)')
for (const c of [
  'scripts/plataforma/importar-base.mjs --destino produccion --confirmo',
  'scripts/plataforma/importar-semillas.mjs --destino produccion --confirmo   (necesita plataforma/semillas/*.json, fuera de git)',
  'scripts/plataforma/capturar-tasas.mjs --historico 45 --destino produccion --confirmo',
])
  console.log(`· node --env-file=.env.local ${c}`)

titulo('6. Tipos')
console.log(`· npx supabase gen types typescript --project-id ${REF} --schema public,${ESQUEMAS.join(',')} > lib/database.types.ts`)
console.log('  y `npx next typegen && npx tsc --noEmit -p .` (deben salir iguales a los de pruebas).')

titulo('7. Netlify (a mano)')
for (const [v, tipo, para] of VARIABLES_NETLIFY) console.log(`· ${v} — ${tipo}: ${para}`)

titulo('8. Programador de tasas (a mano)')
console.log('· POST https://<sitio>/api/tasas/capturar con la cabecera x-tasas-secreto: <TASAS_SECRETO>')
console.log('  BCV: 4:50 p. m. hora de Caracas (20:50 UTC), lunes a viernes, con reintentos a las 5:20 y 6:20 p. m. (21:20 y 22:20 UTC).')
console.log('  Paralelo: POST …/api/tasas/capturar?paralelo a las 9, 13 y 17 h de Caracas (13, 17 y 21 UTC).')
console.log('  Con Netlify Scheduled Functions o un cron externo (GitHub Actions); la ruta no acepta GET.')

titulo('9. Después')
console.log('· Suites contra producción solo las de lectura (probar:supabase). Las de la plataforma escriben: van contra pruebas.')
console.log('· Mirar /sistema con una cuenta de cada rol (Mi día, Organización, Procesos, Documentos, Bandeja, Tasas, Gobierno de IA).')

titulo('Resultado')
if (bloqueos.length) console.log(`✖ No se puede ejecutar todavía: ${bloqueos.join('; ')}.`)
else console.log('✓ Sin bloqueos: con el OK de Gabriel, --ejecutar --confirmo lo hace.')

if (!EJECUTAR) process.exit(0)

// ──────────────────────────────────────────────────────────────────────────────
// EJECUCIÓN (⚠️ producción). Solo llega aquí con --ejecutar --confirmo.
// ──────────────────────────────────────────────────────────────────────────────
if (bloqueos.length) {
  console.error('\n✖ Bloqueado. No se hizo nada.')
  process.exit(1)
}
const correr = (cmd) => {
  console.log(`\n$ ${cmd}`)
  const r = spawnSync('cmd.exe', ['/c', cmd], { stdio: 'inherit', env: e })
  if (r.status !== 0) throw new Error(`falló: ${cmd}`)
}
for (const f of plataforma) {
  const q = await readFile(`supabase/migrations/${f}`, 'utf8')
  console.log(`\nAplicando ${f}…`)
  await sql(`begin;\n${q}\ncommit;`)
  const [version, ...resto] = f.replace(/\.sql$/, '').split('_')
  await sql(`insert into supabase_migrations.schema_migrations (version, name, statements) values ('${version}', '${resto.join('_').replaceAll("'", "''")}', array[]::text[]) on conflict (version) do nothing`)
}
if (faltan.length) {
  const r = await fetch(`${API}/projects/${REF}/postgrest`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ db_schema: [...expuestos, ...faltan].join(',') }),
  })
  if (!r.ok) throw new Error(`exponer esquemas: HTTP ${r.status}`)
}
const auth2 = await leer(`/projects/${REF}/config/auth`)
if (auth2.disable_signup !== true) throw new Error('El registro público se abrió: no se importa nada.')
correr('node --env-file=.env.local scripts/plataforma/importar-base.mjs --destino produccion --confirmo')
correr('node --env-file=.env.local scripts/plataforma/importar-semillas.mjs --destino produccion --confirmo')
correr('node --env-file=.env.local scripts/plataforma/capturar-tasas.mjs --historico 45 --destino produccion --confirmo')
const tipos = spawnSync('cmd.exe', ['/c', `npx supabase gen types typescript --project-id ${REF} --schema public,${ESQUEMAS.join(',')}`], { env: e, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (tipos.status !== 0 || !tipos.stdout.includes('export type Database')) throw new Error('No se pudieron generar los tipos')
await writeFile('lib/database.types.ts', tipos.stdout)
console.log('\n✓ Hecho. Falta lo de Netlify (variables y programador) y las comprobaciones del paso 9.')
