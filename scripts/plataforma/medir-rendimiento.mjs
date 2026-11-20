/**
 * Plataforma Iberia · R6 · rendimiento contra el BUILD DE PRODUCCIÓN del 3007
 * (`produccion-pruebas.mjs`), con una cuenta de prueba y la base de PRUEBAS.
 *
 * Por ruta (RUTAS_R6): TTFB, FCP, LCP y el JavaScript transferido en frío
 * (contexto nuevo, sin caché), con la mediana de `--vueltas` cargas. Y cuatro
 * interacciones, con el Event Timing del navegador (la «INP» de cada una: la
 * duración del evento hasta el siguiente cuadro) y el tiempo hasta ver el
 * resultado:
 *   · abrir la ficha desde una fila de Plazas;
 *   · desplegar una caja del organigrama;
 *   · Ctrl K: escribir hasta ver resultados;
 *   · cambiar un chip de filtro del catálogo de procesos.
 *
 * Separa la red: mide el RTT de esta máquina a Supabase (us-east-1) y
 * estima cuántas vueltas en serie hay dentro del TTFB.
 *
 *   node --env-file=.env.local scripts/plataforma/medir-rendimiento.mjs [--base http://localhost:3007] [--vueltas 3] [--salida capturas/rendimiento.json]
 */
import { chromium } from 'playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { cookiesDePrueba, RUTAS_R6, URL_PRUEBAS, PUBLICA_PRUEBAS } from './sesion-pruebas.mjs'

const argv = process.argv.slice(2)
const opc = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const BASE = opc('--base', 'http://localhost:3007')
const VUELTAS = Number(opc('--vueltas', '3'))
const SALIDA = opc('--salida', 'capturas/rendimiento.json')
const COMO = opc('--como', 'admin')
const SOLO = opc('--solo', null)

const mediana = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null
}
const p75 = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.min(s.length - 1, Math.ceil(0.75 * s.length) - 1)] : null
}

// ── La red: RTT a Supabase desde esta máquina ──
const rtts = []
for (let i = 0; i < 8; i++) {
  const t0 = performance.now()
  await fetch(`${URL_PRUEBAS}/auth/v1/health`, { headers: { apikey: PUBLICA_PRUEBAS } }).then((r) => r.arrayBuffer())
  rtts.push(performance.now() - t0)
}
const RTT = mediana(rtts.slice(1))
console.log(`RTT a Supabase (us-east-1) desde esta máquina: ${Math.round(RTT)} ms (mediana de 7, en caliente)`)

const OBSERVADOR = () => {
  window.__lcp = null
  window.__eventos = []
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__lcp = e.startTime
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.interactionId) window.__eventos.push({ nombre: e.name, dur: e.duration, t: e.startTime })
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 })
  } catch {}
}

const nav = await chromium.launch()
const cookies = await cookiesDePrueba(COMO, BASE)

async function contexto(viewport = { width: 1440, height: 900 }) {
  const ctx = await nav.newContext({ viewport })
  await ctx.addCookies(cookies)
  await ctx.addInitScript(OBSERVADOR)
  return ctx
}

async function medirCarga(pagina, ruta) {
  const r = await pagina.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 120000 })
  // El LCP se fija con la primera interacción; aquí se lee el último candidato.
  await pagina.waitForTimeout(150)
  return pagina.evaluate((st) => {
    const n = performance.getEntriesByType('navigation')[0]
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null
    let js = 0
    let nJs = 0
    for (const e of performance.getEntriesByType('resource')) {
      if (e.initiatorType === 'script' || /\.js(\?|$)/.test(e.name)) {
        js += e.transferSize || 0
        nJs++
      }
    }
    return { status: st, ttfb: n.responseStart, fcp, lcp: window.__lcp, listo: n.domContentLoadedEventEnd, js, nJs, html: n.transferSize }
  }, r.status())
}

const resultados = { fecha: new Date().toISOString(), base: BASE, rtt: Math.round(RTT), rutas: [], interacciones: [] }

// ── Las rutas ──
console.log(`\nRutas (${VUELTAS} cargas; la 1.ª en frío, sin caché)`)
for (const [nombre, ruta] of RUTAS_R6) {
  if (SOLO && !ruta.includes(SOLO)) continue
  const ctx = await contexto()
  const pagina = await ctx.newPage()
  const errores = []
  pagina.on('pageerror', (e) => errores.push(String(e)))
  const vueltas = []
  for (let i = 0; i < VUELTAS; i++) vueltas.push(await medirCarga(pagina, ruta))
  await ctx.close()
  const fila = {
    nombre,
    ruta,
    status: vueltas[0].status,
    ttfb: Math.round(mediana(vueltas.map((v) => v.ttfb))),
    fcp: Math.round(mediana(vueltas.map((v) => v.fcp))),
    lcp: Math.round(mediana(vueltas.map((v) => v.lcp))),
    lcpP75: Math.round(p75(vueltas.map((v) => v.lcp))),
    jsKb: Math.round(vueltas[0].js / 1024),
    nJs: vueltas[0].nJs,
    vueltasRed: +(mediana(vueltas.map((v) => v.ttfb)) / RTT).toFixed(1),
    errores,
  }
  resultados.rutas.push(fila)
  console.log(
    `  ${nombre.padEnd(18)} ${String(fila.status).padEnd(4)} TTFB ${String(fila.ttfb).padStart(5)} · FCP ${String(fila.fcp).padStart(5)} · LCP ${String(fila.lcp).padStart(5)} (p75 ${fila.lcpP75}) · JS ${String(fila.jsKb).padStart(4)} KB en ${fila.nJs} · ≈${fila.vueltasRed} RTT${errores.length ? ` · ✖ ${errores[0].slice(0, 80)}` : ''}`
  )
}

// ── Las interacciones ──
async function interaccion(...a) {
  try {
    await interaccion1(...a)
  } catch (e) {
    const linea = String(e.message).split('\n')[0]
    console.log(`  ${a[0].padEnd(34)} ✖ ${linea}`)
    resultados.interacciones.push({ nombre: a[0], ruta: a[1], ok: false, error: linea })
  }
}
async function interaccion1(nombre, ruta, preparar, accion, listo, vueltas = VUELTAS) {
  const ctx = await contexto()
  const pagina = await ctx.newPage()
  const medidas = []
  for (let i = 0; i < vueltas; i++) {
    await pagina.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 120000 })
    if (preparar) await preparar(pagina)
    await pagina.evaluate(() => (window.__eventos = []))
    const t0 = Date.now()
    await accion(pagina)
    const ok = await listo(pagina).then(() => true).catch(() => false)
    const ms = Date.now() - t0
    await pagina.waitForTimeout(200)
    const inp = await pagina.evaluate(() => Math.max(0, ...window.__eventos.map((e) => e.dur)))
    medidas.push({ ok, ms, inp })
  }
  await ctx.close()
  const fila = { nombre, ruta, ok: medidas.every((m) => m.ok), inp: Math.round(p75(medidas.map((m) => m.inp))), resultado: Math.round(mediana(medidas.map((m) => m.ms))), medidas }
  resultados.interacciones.push(fila)
  console.log(`  ${nombre.padEnd(34)} ${fila.ok ? '✓' : '✖'} INP ${String(fila.inp).padStart(4)} ms · resultado visible en ${fila.resultado} ms (${medidas.map((m) => m.ms).join(' / ')})`)
}

if (!SOLO) {
  console.log('\nInteracciones (INP = duración del evento por Event Timing; «resultado» = hasta verlo en pantalla)')

  await interaccion(
    'Plazas: fila → ficha',
    '/sistema/nucleo/organizacion/plazas',
    null,
    (p) => p.locator('tbody tr[tabindex="0"]').nth(2).click(),
    (p) => p.locator('aside[data-ficha-objeto] [role="tablist"]').waitFor({ timeout: 20000 })
  )

  await interaccion(
    'Organigrama: desplegar una caja',
    '/sistema/nucleo/organizacion',
    (p) => p.locator('.react-flow__node').first().waitFor({ timeout: 20000 }),
    async (p) => {
      p.__antes = await p.locator('.react-flow__node').count()
      // La primera caja con el «+» sin abrir.
      await p.locator('.react-flow__node:has(.lz-mas:not(.abierto))').first().click()
    },
    (p) => p.waitForFunction((n) => document.querySelectorAll('.react-flow__node').length > n, p.__antes, { timeout: 10000 })
  )

  await interaccion(
    'Ctrl K: escribir → resultados',
    '/sistema',
    null,
    async (p) => {
      await p.keyboard.press('Control+k')
      await p.getByRole('combobox', { name: 'Buscar en la plataforma' }).pressSequentially('almacen', { delay: 40 })
    },
    (p) => p.locator('[role="option"][id^="paleta-plaza-"]').first().waitFor({ timeout: 15000 })
  )

  await interaccion(
    'Catálogo: cambiar un chip de filtro',
    '/sistema/nucleo/procesos/catalogo',
    async (p) => {
      await p.getByTitle('Añadir un filtro').click()
      await p.locator('details summary:visible').first().click()
    },
    async (p) => {
      p.__url = p.url()
      await p.locator('details[open] input[type="checkbox"], details[open] button[aria-pressed]').first().click()
    },
    (p) => p.waitForFunction((u) => location.href !== u && !document.querySelector('[aria-busy="true"]'), p.__url, { timeout: 20000 })
  )
}

await nav.close()
await mkdir('capturas', { recursive: true })
await writeFile(SALIDA, JSON.stringify(resultados, null, 2))
console.log(`\nGuardado en ${SALIDA}`)
