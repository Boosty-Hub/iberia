/**
 * Plataforma Iberia · R5 · registro de métricas, Mi día y Ctrl K, contra el
 * PROYECTO DE PRUEBAS (nunca producción; nunca la cuenta de una persona de Iberia).
 *
 * Con Playwright en el 3005 y la sesión acuñada de una cuenta de prueba:
 *   · la misma métrica dice lo mismo en Mi día y en el Resumen de su módulo
 *     (dotación ocupada, procesos con ficha, documentos vigentes, requisiciones
 *     abiertas, BCV);
 *   · Ctrl K encuentra sin tildes una plaza («almacen»), un proceso («gestion de
 *     compras») y un documento («evaluacion de proveedores»), y Enter abre su ficha;
 *   · «?» muestra los atajos y «g p» lleva a Procesos;
 *   · el catálogo de procesos y Mi día responden (mide el tiempo de cada uno).
 *
 *   node --env-file=.env.local scripts/plataforma/probar-r5.mjs [--como admin] [--base http://localhost:3005]
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const opc = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const BASE = opc('--base', 'http://localhost:3005')
const SOLO_TIEMPOS = argv.includes('--solo-tiempos')
const COMO = opc('--como', 'admin')
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !PUB || !SECRETO) throw new Error('Faltan las variables SUPABASE_PRUEBAS_* en .env.local')
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se corre')

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const email = `${COMO}.pruebas@plataforma.local`

let fallos = 0
let pasos = 0
function ok(cond, texto, extra) {
  pasos++
  if (cond) console.log(`  ✓ ${texto}`)
  else {
    fallos++
    console.log(`  ✖ ${texto}${extra ? ` — ${extra}` : ''}`)
  }
}

const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
if (e1) throw e1
const { data: ver, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
if (e2) throw e2
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
const L = 3180
const partes = valor.length <= L ? [{ name: `sb-${ref}-auth-token`, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `sb-${ref}-auth-token.${i}`, value: valor.slice(i * L, (i + 1) * L) }))

await mkdir('capturas/sistema', { recursive: true })
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addCookies(partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' })))
const pagina = await ctx.newPage()
const errores = []
pagina.on('pageerror', (e) => errores.push(String(e)))

async function ir(ruta) {
  const t0 = Date.now()
  const r = await pagina.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 90000 })
  return { status: r.status(), ms: Date.now() - t0 }
}
const valorDe = (clave) => pagina.locator(`[data-metrica="${clave}"] [data-valor]`).first().innerText({ timeout: 5000 }).catch(() => null)

// 1) La misma cifra en Mi día y en su módulo.
if (!SOLO_TIEMPOS) {
console.log(`\nMétricas (${COMO})`)
const r0 = await ir('/sistema')
ok(r0.status === 200, `Mi día responde (${r0.ms} ms)`)
const PARES = [
  ['dotacion_ocupada', '/sistema/nucleo/organizacion/resumen'],
  ['procesos_con_ficha', '/sistema/nucleo/procesos/resumen'],
  ['documentos_vigentes', '/sistema/nucleo/documentos/resumen'],
  ['requisiciones_abiertas', '/sistema/datos/metricas'],
  ['tasa_bcv_usd', '/sistema/finanzas/tasas'],
  ['mis_requisiciones', '/sistema/nucleo/organizacion/requisiciones'],
  ['dotacion_por_encima', '/sistema/nucleo/organizacion/resumen'],
]
const enMiDia = {}
for (const [clave] of PARES) enMiDia[clave] = await valorDe(clave)
for (const [clave, ruta] of PARES) {
  if (enMiDia[clave] === null) continue // no está en la portada de este rol
  await ir(ruta)
  // El registro no usa Kpi: su cifra va en la tarjeta de la métrica.
  const allá = ruta === '/sistema/datos/metricas' ? await pagina.locator(`li#${clave} p.text-\\[20px\\]`).first().innerText().catch(() => null) : await valorDe(clave)
  const norm = (s) => (s ?? '').replace(/\s+/g, ' ').replace(/ de .*/, '').trim()
  ok(allá !== null && norm(allá) === norm(enMiDia[clave]), `${clave}: Mi día «${enMiDia[clave]?.replace(/\s+/g, ' ')}» = ${ruta} «${allá?.replace(/\s+/g, ' ')}»`)
}
ok(Object.values(enMiDia).some((v) => v !== null), 'Mi día pinta cifras del registro')

// La ⓘ dice la definición.
await ir('/sistema/nucleo/procesos/resumen')
await pagina.locator('[data-metrica="procesos_con_ficha"] button').first().focus()
await pagina.locator('[data-metrica="procesos_con_ficha"] [role="tooltip"]').first().waitFor({ state: 'visible', timeout: 3000 }).catch(() => {})
await pagina.waitForFunction(() => getComputedStyle(document.querySelector('[data-metrica="procesos_con_ficha"] [role="tooltip"]')).opacity === '1', null, { timeout: 3000 }).catch(() => {})
const def = await pagina.locator('[data-metrica="procesos_con_ficha"] [role="tooltip"]').first().innerText().catch(() => '')
ok(/niveles 1 a 3/i.test(def) && /Dueño/.test(def), 'la ⓘ de «Procesos con ficha» muestra su definición y su dueño')
await pagina.screenshot({ path: 'capturas/sistema/r5-definicion.png' })

// 2) Ctrl K sin tildes → ficha.
console.log('\nCtrl K')
await ir('/sistema')
const CASOS = [
  ['almacen', 'plaza'],
  ['gestion de compras', 'proceso'],
  ['evaluacion de proveedores', 'documento'],
]
const ETIQUETA = { plaza: /^plaza/i, proceso: /^proceso/i, documento: /^documento/i }
for (const [q, tipo] of CASOS) {
  await ir('/sistema') // sin ficha abierta: la que se abra es la de este caso
  await pagina.keyboard.press('Control+k')
  const entrada = pagina.getByRole('combobox', { name: 'Buscar en la plataforma' })
  await entrada.waitFor({ timeout: 5000 })
  const t0 = Date.now()
  await entrada.fill(q)
  const opcion = pagina.locator(`[id^="paleta-${tipo}-"]`).first()
  const hay = await opcion.waitFor({ timeout: 8000 }).then(() => true).catch(() => false)
  const ms = Date.now() - t0
  ok(hay, `«${q}» encuentra un ${tipo} (${ms} ms con la pausa de 180 ms al teclear)`)
  if (!hay) {
    await pagina.keyboard.press('Escape')
    continue
  }
  const titulo = (await opcion.innerText()).split('\n')[0]
  // Bajar hasta la opción y abrirla con Enter.
  const ids = await pagina.locator('[role="option"]').evaluateAll((els) => els.map((e) => e.id))
  const idx = ids.findIndex((x) => x.startsWith(`paleta-${tipo}-`))
  for (let i = 0; i < idx; i++) await entrada.press('ArrowDown')
  await entrada.press('Enter')
  const abrio = await pagina.waitForURL(new RegExp(`ficha=${tipo}(%3A|:)`), { timeout: 8000 }).then(() => true).catch(() => false)
  const panel = await pagina
    .locator('aside[aria-label="Ficha del objeto"] p', { hasText: ETIQUETA[tipo] })
    .first()
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false)
  ok(abrio && panel, `Enter abre la ficha del ${tipo} «${titulo}» en el panel`)
  await pagina.screenshot({ path: `capturas/sistema/r5-ctrlk-${tipo}.png` })
  await pagina.keyboard.press('Escape')
}

// Recientes: lo abierto sale al abrir la paleta sin texto.
await ir('/sistema')
await pagina.keyboard.press('Control+k')
const recientes = await pagina.getByText('Recientes', { exact: true }).waitFor({ timeout: 6000 }).then(() => true).catch(() => false)
ok(recientes, 'la paleta sin texto muestra «Recientes»')
await pagina.screenshot({ path: 'capturas/sistema/r5-recientes.png' })
await pagina.keyboard.press('Escape')

// 3) Atajos.
console.log('\nAtajos')
await pagina.locator('main').click({ position: { x: 5, y: 5 } }).catch(() => {})
await pagina.keyboard.press('?')
const atajos = await pagina.locator('[data-atajos]').waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
ok(atajos, '«?» muestra la hoja de atajos')
await pagina.screenshot({ path: 'capturas/sistema/r5-atajos.png' })
await pagina.keyboard.press('Escape')
await pagina.keyboard.press('g')
await pagina.keyboard.press('p')
const gp = await pagina.waitForURL(/\/sistema\/nucleo\/procesos\/resumen/, { timeout: 15000 }).then(() => true).catch(() => false)
ok(gp, '«g p» lleva a Procesos')

}

// 4) Tiempos del catálogo (después de calentar).
console.log('\nTiempos')
await ir('/sistema/nucleo/procesos/catalogo')
const ts = []
for (let i = 0; i < 5; i++) ts.push((await ir('/sistema/nucleo/procesos/catalogo')).ms)
ok(true, `catálogo de procesos: ${ts.join(' / ')} ms`)
const tm = []
for (let i = 0; i < 5; i++) tm.push((await ir('/sistema')).ms)
const tp = []
await ir('/sistema/nucleo/organizacion/plazas')
for (let i = 0; i < 5; i++) tp.push((await ir('/sistema/nucleo/organizacion/plazas')).ms)
ok(true, `plazas: ${tp.join(' / ')} ms`)
ok(true, `Mi día: ${tm.join(' / ')} ms`)

// La búsqueda de Ctrl K, medida en el navegador: desde que se escribe hasta que salen resultados (incluye la pausa de 180 ms).
await ir('/sistema')
const tb = []
for (const q of ['almacen', 'gestion de compras', 'evaluacion', 'maria', 'compras']) {
  await pagina.keyboard.press('Control+k')
  const entrada = pagina.getByRole('combobox', { name: 'Buscar en la plataforma' })
  await entrada.waitFor({ timeout: 5000 })
  const t0 = Date.now()
  await entrada.fill(q)
  const id = await pagina.locator('[role="option"][id^="paleta-"]:not([id^="paleta-accion"]):not([id^="paleta-reciente"]):not([id="paleta-ia"])').first().getAttribute('id', { timeout: 8000 }).catch(() => null)
  if (process.env.DEPURAR) console.log(q, id)
  tb.push(Date.now() - t0)
  await pagina.keyboard.press('Escape')
}
ok(true, `Ctrl K (escribir → resultados, con 180 ms de pausa): ${tb.join(' / ')} ms`)

ok(!errores.length, 'sin errores de página', errores.slice(0, 3).join(' | '))
await nav.close()
console.log(`\n${pasos - fallos}/${pasos} comprobaciones${fallos ? ` · ${fallos} fallaron` : ''}`)
process.exit(fallos ? 1 : 0)
