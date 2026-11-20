/**
 * Plataforma Iberia · R6 · accesibilidad (WCAG 2.2 AA) con axe-core
 * (`@axe-core/playwright` fijo en 4.14.0) sobre las rutas de R6, en escritorio
 * (1440×900) y en teléfono (390×844), con una cuenta de prueba y la base de
 * PRUEBAS. Además del análisis de la página, abre la ficha (panel) y la paleta
 * Ctrl K y las analiza abiertas.
 *
 *   node --env-file=.env.local scripts/plataforma/medir-accesibilidad.mjs [--base http://localhost:3007] [--salida capturas/a11y.json] [--solo <trozo de ruta>] [--detalle]
 */
import { chromium } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
import { writeFile, mkdir } from 'node:fs/promises'
import { cookiesDePrueba, RUTAS_R6 } from './sesion-pruebas.mjs'

const argv = process.argv.slice(2)
const opc = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const BASE = opc('--base', 'http://localhost:3007')
const SALIDA = opc('--salida', 'capturas/a11y.json')
const SOLO = opc('--solo', null)
const DETALLE = argv.includes('--detalle')
const ETIQUETAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const nav = await chromium.launch()
const cookies = await cookiesDePrueba(opc('--como', 'admin'), BASE)
const VISTAS = [
  ['escritorio', { width: 1440, height: 900 }],
  ['teléfono', { width: 390, height: 844 }],
]

const resultados = []
const porRegla = new Map()

async function analizar(pagina, donde) {
  const r = await new AxeBuilder({ page: pagina }).withTags(ETIQUETAS).analyze()
  const v = r.violations.map((x) => ({ regla: x.id, impacto: x.impact, nodos: x.nodes.length, ayuda: x.help, ejemplos: x.nodes.slice(0, 8).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary ?? '').split('\n').slice(1, 2).join('')) }))
  for (const x of v) porRegla.set(x.regla, (porRegla.get(x.regla) ?? 0) + x.nodos)
  const nodos = v.reduce((a, x) => a + x.nodos, 0)
  resultados.push({ donde, violaciones: v.length, nodos, detalle: v })
  console.log(`  ${donde.padEnd(44)} ${v.length ? `✖ ${v.length} reglas · ${nodos} nodos: ${v.map((x) => `${x.regla}(${x.nodos})`).join(', ')}` : '✓ sin violaciones'}`)
  if (DETALLE) for (const x of v) for (const e of x.ejemplos) console.log(`      ${x.regla}: ${e}`)
}

for (const [vista, viewport] of VISTAS) {
  console.log(`\n${vista} (${viewport.width}×${viewport.height})`)
  const ctx = await nav.newContext({ viewport, hasTouch: vista === 'teléfono', isMobile: vista === 'teléfono' })
  await ctx.addCookies(cookies)
  const pagina = await ctx.newPage()
  // `--rutas /a,/b`: otras rutas en vez de las de R6 (p. ej. las del Programa).
  const rutas = opc('--rutas', null)?.split(',').map((r) => [r, r]) ?? RUTAS_R6
  for (const [nombre, ruta] of rutas) {
    if (SOLO && !ruta.includes(SOLO)) continue
    await pagina.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 120000 })
    await analizar(pagina, `${vista} · ${nombre}`)
  }
  if (!SOLO) {
    // La ficha abierta (desde una fila de Plazas) y la paleta.
    await pagina.goto(BASE + '/sistema/nucleo/organizacion/plazas', { waitUntil: 'networkidle' })
    await pagina.locator('tbody tr[tabindex="0"]').first().click()
    await pagina.locator('aside[data-ficha-objeto] [role="tablist"]').waitFor({ timeout: 20000 }).catch(() => {})
    await analizar(pagina, `${vista} · ficha abierta`)
    await pagina.goto(BASE + '/sistema', { waitUntil: 'networkidle' })
    await pagina.keyboard.press('Control+k')
    await pagina.getByRole('combobox', { name: 'Buscar en la plataforma' }).fill('almacen')
    await pagina.locator('[role="option"][id^="paleta-plaza-"]').first().waitFor({ timeout: 15000 }).catch(() => {})
    await analizar(pagina, `${vista} · Ctrl K con resultados`)
  }
  await ctx.close()
}
await nav.close()

const total = resultados.reduce((a, r) => a + r.nodos, 0)
console.log(`\nTotal: ${resultados.reduce((a, r) => a + r.violaciones, 0)} violaciones · ${total} nodos en ${resultados.length} análisis`)
console.log('Por regla: ' + [...porRegla].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · '))
await mkdir('capturas', { recursive: true })
await writeFile(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), base: BASE, total, porRegla: Object.fromEntries(porRegla), resultados }, null, 2))
console.log(`Guardado en ${SALIDA}`)
