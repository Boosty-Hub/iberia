/**
 * Plataforma Iberia · R6 · teclado y teléfono, contra el PROYECTO DE PRUEBAS
 * (por defecto el build de producción del 3007; `--base` para otro).
 *
 * Teclado (1440×900): fila de la tabla → Enter abre la ficha → Esc la cierra y
 * el foco vuelve a la fila; el foco se ve; Ctrl K abre y Esc cierra la paleta;
 * Tab llega a las cajas del lienzo y Enter las despliega.
 *
 * Teléfono (390×844, táctil): todas las rutas de R6 sin desborde horizontal;
 * el menú (cajón) abre, trae la navegación y cierra con Esc; la ficha va a
 * pantalla completa y recibe el foco; los dos lienzos arrancan en lista; y en el
 * lienzo, arrastrar con un dedo mueve y pellizcar con dos acerca (emulación
 * táctil de Chromium por CDP: el equipo real sigue pendiente).
 *
 *   node --env-file=.env.local scripts/plataforma/probar-r6.mjs [--base http://localhost:3007]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { cookiesDePrueba, RUTAS_R6 } from './sesion-pruebas.mjs'

const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
let fallos = 0
const ok = (c, t, extra) => {
  if (c) console.log(`  ✓ ${t}`)
  else {
    fallos++
    console.log(`  ✖ ${t}${extra ? ` — ${extra}` : ''}`)
  }
}
await mkdir('capturas/sistema', { recursive: true })
const nav = await chromium.launch()
const cookies = await cookiesDePrueba('admin', BASE)
const errores = []

// ── Teclado ──────────────────────────────────────────────────────────────────
console.log('\nTeclado (escritorio)')
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage()
  p.on('pageerror', (e) => errores.push(String(e)))
  await p.goto(BASE + '/sistema/nucleo/organizacion/plazas', { waitUntil: 'networkidle' })
  const fila = p.locator('tbody tr[tabindex="0"]').nth(1)
  await fila.focus()
  await p.keyboard.press('Shift+Tab')
  await p.keyboard.press('Tab') // que el foco llegue por teclado (:focus-visible)
  const contorno = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle)
  ok(contorno !== 'none', `la fila enfocada con el teclado se ve (outline ${contorno})`)
  await p.keyboard.press('Enter')
  const abrio = await p.locator('aside[data-ficha-objeto] [role="tablist"]').waitFor({ timeout: 20000 }).then(() => true).catch(() => false)
  ok(abrio && /ficha=plaza/.test(decodeURIComponent(p.url())), 'Enter en una fila abre su ficha en el panel')
  await p.keyboard.press('Escape')
  const cerro = await p.locator('aside[data-ficha-objeto]').waitFor({ state: 'detached', timeout: 5000 }).then(() => true).catch(() => false)
  const enFila = await p.evaluate(() => document.activeElement?.tagName === 'TR')
  ok(cerro && !/ficha=/.test(p.url()), 'Esc cierra la ficha')
  ok(enFila, 'al cerrar, el foco vuelve a la fila')
  await p.keyboard.press('Control+k')
  const paleta = p.getByRole('combobox', { name: 'Buscar en la plataforma' })
  const enfocada = await paleta.waitFor({ timeout: 5000 }).then(() => p.waitForFunction(() => document.activeElement?.getAttribute('role') === 'combobox', null, { timeout: 3000 })).then(() => true).catch(() => false)
  ok(enfocada, 'Ctrl K abre la paleta con el foco en la búsqueda')
  await p.keyboard.press('Escape')
  ok(await p.locator('[data-paleta-abierta]').waitFor({ state: 'detached', timeout: 3000 }).then(() => true).catch(() => false), 'Esc cierra la paleta')

  await p.goto(BASE + '/sistema/nucleo/organizacion', { waitUntil: 'networkidle' })
  await p.locator('.react-flow__node').first().waitFor({ timeout: 30000 })
  const antes = await p.locator('.react-flow__node').count()
  let llego = false
  for (let i = 0; i < 250 && !llego; i++) {
    await p.keyboard.press('Tab')
    llego = await p.evaluate(() => !!document.activeElement?.closest('.react-flow__node'))
  }
  ok(llego, 'Tab llega a las cajas del lienzo')
  const idCaja = await p.evaluate(() => document.activeElement?.closest('.react-flow__node')?.getAttribute('data-id'))
  // La primera caja con dependencias plegadas.
  const plegada = await p.locator('.react-flow__node:has(.lz-mas:not(.abierto))').first().getAttribute('data-id')
  if (plegada && plegada !== idCaja) await p.locator(`.react-flow__node[data-id="${plegada}"]`).focus()
  await p.keyboard.press('Enter')
  const despliega = await p.waitForFunction((n) => document.querySelectorAll('.react-flow__node').length > n, antes, { timeout: 5000 }).then(() => true).catch(() => false)
  ok(despliega, 'Enter en una caja la despliega')

  // PDF del subárbol: el botón del lienzo abre otra pestaña con el PDF de la caja elegida.
  const elegida = await p.locator('.react-flow__node:has(.lz-mas.abierto)').first().getAttribute('data-id')
  await p.locator(`.react-flow__node[data-id="${elegida}"]`).focus()
  const esperada = ctx.waitForEvent('response', { predicate: (r) => r.url().includes('/sistema/pdf/subarbol'), timeout: 60000 }).catch(() => null)
  const [pestana] = await Promise.all([ctx.waitForEvent('page', { timeout: 30000 }), p.getByRole('button', { name: '⇩ PDF del subárbol' }).click()])
  const respuesta = await esperada
  ok(respuesta && respuesta.status() === 200, `el botón «PDF del subárbol» del organigrama abre el PDF (${respuesta?.headers()['content-type'] ?? 'sin respuesta'})`)
  await pestana.close()
  for (const [tipo, raiz] of [
    ['organizacion', elegida],
    ['procesos', null],
  ]) {
    const r = await ctx.request.get(`${BASE}/sistema/pdf/subarbol?tipo=${tipo}${raiz ? `&raiz=${encodeURIComponent(raiz)}` : ''}`)
    const cuerpo = await r.body()
    const esPdf = (r.headers()['content-type'] ?? '').includes('pdf') && cuerpo.subarray(0, 4).toString() === '%PDF'
    if (esPdf) await import('node:fs/promises').then((fs) => fs.writeFile(`capturas/sistema/r6-subarbol-${tipo}.pdf`, cuerpo))
    const texto = esPdf ? '' : cuerpo.toString()
    ok(r.status() === 200 && (esPdf || (texto.includes('Uso interno') && r.headers()['x-pdf'] === 'navegador')), `PDF del subárbol de ${tipo}: ${esPdf ? `${Math.round(cuerpo.length / 1024)} KB, impreso por Chromium` : 'hoja HTML para imprimir'}`)
  }
  const sinTipo = await ctx.request.get(`${BASE}/sistema/pdf/subarbol?tipo=otro`)
  ok(sinTipo.status() === 400, 'un tipo desconocido se rechaza (400)')
  await ctx.close()
}

// Sin sesión: el PDF no sale.
{
  const r = await nav.newContext().then((c) => c.request.get(`${BASE}/sistema/pdf/subarbol?tipo=organizacion`, { maxRedirects: 0 }))
  ok(r.status() === 307 || r.status() === 401 || r.status() === 302, `sin sesión, /sistema/pdf/subarbol no responde el PDF (${r.status()})`)
}

// ── Teléfono ─────────────────────────────────────────────────────────────────
console.log('\nTeléfono (390×844)')
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await ctx.addCookies(cookies)
const p = await ctx.newPage()
p.on('pageerror', (e) => errores.push(String(e)))

const desbordes = []
for (const [nombre, ruta] of RUTAS_R6) {
  await p.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 120000 })
  // Contra el ancho del aparato (390), no `innerWidth`: en un teléfono el viewport se ensancha con lo que se sale.
  const d = await p.evaluate(() => Math.max(document.documentElement.scrollWidth, window.innerWidth) - 390)
  if (d > 1) desbordes.push(`${nombre} (+${d}px)`)
}
ok(!desbordes.length, `las ${RUTAS_R6.length} rutas sin desborde horizontal`, desbordes.join(', '))

await p.goto(BASE + '/sistema/nucleo/procesos/catalogo', { waitUntil: 'networkidle' })
await p.getByRole('button', { name: 'Abrir el menú' }).tap()
const menu = p.locator('dialog.menu-movil[open]')
const abierto = await menu.waitFor({ timeout: 5000 }).then(() => true).catch(() => false)
const enlaces = abierto ? await menu.locator('a[href^="/sistema"]').count() : 0
ok(abierto && enlaces > 5, `el menú del teléfono abre con la navegación (${enlaces} enlaces)`)
await p.screenshot({ path: 'capturas/sistema/r6-telefono-menu.png' })
await p.keyboard.press('Escape')
ok(await menu.waitFor({ state: 'detached', timeout: 3000 }).then(() => true).catch(async () => !(await p.locator('dialog.menu-movil').evaluate((d) => d.open))), 'Esc cierra el menú')

await p.goto(BASE + '/sistema/nucleo/organizacion/plazas', { waitUntil: 'networkidle' })
await p.locator('tbody tr[tabindex="0"]').first().tap()
await p.locator('aside[data-ficha-objeto] [role="tablist"]').waitFor({ timeout: 20000 })
const caja = await p.locator('aside[data-ficha-objeto]').boundingBox()
ok(caja && caja.width >= 389 && caja.x <= 1 && caja.height >= 844 - 48 - 2, `la ficha va a pantalla completa (${Math.round(caja?.width)}×${Math.round(caja?.height)})`)
ok(await p.evaluate(() => !!document.activeElement?.closest('aside[data-ficha-objeto]')), 'la ficha recibe el foco al abrir')
await p.screenshot({ path: 'capturas/sistema/r6-telefono-ficha.png' })

for (const [nombre, ruta] of [
  ['organigrama', '/sistema/nucleo/organizacion'],
  ['mapa de procesos', '/sistema/nucleo/procesos'],
]) {
  await p.goto(BASE + ruta, { waitUntil: 'networkidle' })
  const lista = await p.locator('.lz-lista .fila').first().waitFor({ timeout: 30000 }).then(() => true).catch(() => false)
  ok(lista && (await p.locator('.react-flow').count()) === 0, `el ${nombre} arranca en lista en el teléfono`)
}

// El lienzo con el dedo (organigrama).
await p.goto(BASE + '/sistema/nucleo/organizacion', { waitUntil: 'networkidle' })
await p.locator('.lz-lista .fila').first().waitFor({ timeout: 30000 })
await p.getByRole('button', { name: 'Ver lienzo' }).tap()
await p.locator('.react-flow__node').first().waitFor({ timeout: 20000 })
await p.waitForTimeout(800)
const transformacion = () =>
  p.evaluate(() => {
    const m = getComputedStyle(document.querySelector('.react-flow__viewport')).transform
    const [a, , , , e, f] = m === 'none' ? [1, 0, 0, 1, 0, 0] : m.slice(7, -1).split(',').map(Number)
    return { x: e, y: f, z: a }
  })
// El lienzo va debajo de la cabecera: primero a la vista, que el dedo toca la pantalla, no la página.
await p.locator('.react-flow__pane').evaluate((e) => e.scrollIntoView({ block: 'center' }))
await p.waitForTimeout(300)
const marco = await p.locator('.react-flow__pane').boundingBox()
const cx = marco.x + marco.width / 2
const cy = marco.y + marco.height * 0.75 - 120
const cdp = await ctx.newCDPSession(p)
const toque = (type, puntos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: puntos.map(([x, y], id) => ({ x, y, id })) })

const t0 = await transformacion()
await toque('touchStart', [[cx, cy + 120]])
for (let i = 1; i <= 10; i++) {
  await toque('touchMove', [[cx - 8 * i, cy + 120 - 6 * i]])
  await p.waitForTimeout(16)
}
await toque('touchEnd', [])
await p.waitForTimeout(300)
const t1 = await transformacion()
ok(Math.abs(t1.x - t0.x) > 40 && Math.abs(t1.z - t0.z) < 0.01, `un dedo arrastra el lienzo (Δx ${Math.round(t1.x - t0.x)} px, Δy ${Math.round(t1.y - t0.y)} px)`)

await toque('touchStart', [[cx - 40, cy + 100], [cx + 40, cy + 100]])
for (let i = 1; i <= 10; i++) {
  await toque('touchMove', [[cx - 40 - 9 * i, cy + 100], [cx + 40 + 9 * i, cy + 100]])
  await p.waitForTimeout(16)
}
await toque('touchEnd', [])
await p.waitForTimeout(300)
const t2 = await transformacion()
ok(t2.z > t1.z * 1.2, `dos dedos acercan (zoom ${t1.z.toFixed(2)} → ${t2.z.toFixed(2)})`)
await p.screenshot({ path: 'capturas/sistema/r6-telefono-pellizco.png' })
await ctx.close()

const propios = errores.filter((e) => !/Download the React DevTools|Fast Refresh/.test(e))
ok(!propios.length, 'sin errores de página', propios.slice(0, 3).join(' | '))
await nav.close()
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo en orden')
process.exit(fallos ? 1 : 0)
