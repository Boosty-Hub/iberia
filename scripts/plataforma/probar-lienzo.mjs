/**
 * Plataforma Iberia · el lienzo del organigrama y del mapa de procesos, con
 * clics de verdad, contra el PROYECTO DE PRUEBAS.
 *
 * Despliega cajas, arrastra el fondo, hace zoom, busca, cambia de capa, abre
 * una ficha, recorre con el teclado, baja el PNG y, en dos escenarios nuevos
 * (uno de estructura y uno de procesos), arrastra una caja sobre otra y agrega
 * una desde el menú «⋯». Comprueba que la realidad no cambió y descarta los
 * escenarios al salir. Deja las capturas en `capturas/lienzo/`.
 *
 *   MSYS_NO_PATHCONV=1 node --env-file=.env.local scripts/plataforma/probar-lienzo.mjs [--base http://localhost:3005]
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !SECRETO || !/wsqhsjbwkjlqrdxnyadq/.test(URL_SUPA)) throw new Error('Solo corre contra el proyecto de pruebas (SUPABASE_PRUEBAS_*).')

const EMAIL = 'admin.pruebas@plataforma.local' // la crea `mirar.mjs`
const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
if (e1) throw new Error(`Corre primero mirar.mjs para crear la cuenta de prueba: ${e1.message}`)
const { data: ver, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
if (e2) throw e2
const yo = createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${ver.session.access_token}` } } })

function cookies(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

let fallos = 0
const ok = (cond, txt) => {
  console.log(`${cond ? '✓' : '✗'} ${txt}`)
  if (!cond) fallos++
}
await mkdir('capturas/lienzo', { recursive: true })
const foto = (page, nombre) => page.screenshot({ path: `capturas/lienzo/${nombre}.png` })

const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
await ctx.addCookies(cookies(ver.session))
const page = await ctx.newPage()
const errores = []
page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
page.on('pageerror', (e) => errores.push(String(e)))

const caja = (p, titulo) => p.locator('.react-flow__node', { has: p.locator('.lz-t', { hasText: new RegExp(`^${titulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first()
const nodos = (p) => p.locator('.react-flow__node:not(.lz-sale)').count()
const transformada = (p) => p.locator('.react-flow__viewport').evaluate((el) => el.style.transform)
const asentar = (p) => p.waitForTimeout(650) // la animación dura 340 ms; se espera a que asiente

// -----------------------------------------------------------------------------
// 1) ORGANIGRAMA, LA REALIDAD
// -----------------------------------------------------------------------------
let t0 = Date.now()
await page.goto(`${BASE}/sistema/nucleo/organizacion`)
await page.locator('.react-flow__node').first().waitFor({ timeout: 60000 })
console.log(`  organigrama: primeras cajas en ${Date.now() - t0} ms (con el servidor de desarrollo)`)
await asentar(page)
const inicial = await nodos(page)
ok(inicial > 5, `organigrama dibujado (${inicial} cajas visibles)`)
await foto(page, '01-org-inicial')

// clic: desplegar
const ops = caja(page, 'Dirección de Operaciones')
await ops.click()
await asentar(page)
const despues = await nodos(page)
ok(despues > inicial, `clic en «Dirección de Operaciones» despliega (${inicial} → ${despues})`)
await foto(page, '02-org-desplegado')
await ops.click()
await asentar(page)
ok((await nodos(page)) === inicial, 'otro clic la pliega')

// arrastrar el fondo
const antesPan = await transformada(page)
const marco = await page.locator('.lz-marco').boundingBox()
await page.mouse.move(marco.x + marco.width - 260, marco.y + marco.height - 200)
await page.mouse.down()
await page.mouse.move(marco.x + marco.width - 560, marco.y + marco.height - 380, { steps: 12 })
await page.mouse.up()
const despuesPan = await transformada(page)
ok(antesPan !== despuesPan, `arrastrar el fondo mueve el dibujo (${antesPan} → ${despuesPan})`)

// zoom con la rueda
await page.mouse.move(marco.x + marco.width / 2, marco.y + marco.height / 2)
await page.mouse.wheel(0, -600)
await page.waitForTimeout(300)
const escala = (s) => Number(/scale\(([\d.]+)\)/.exec(s)?.[1] ?? 1)
ok(escala(await transformada(page)) > escala(despuesPan), 'la rueda acerca')
await foto(page, '03-org-movido-zoom')

// buscar y enfocar (sin tildes)
await page.getByRole('button', { name: 'Plegar', exact: true }).click()
await asentar(page)
await page.getByPlaceholder('Buscar y enfocar…').fill('produccion')
await page.waitForTimeout(150)
const opcion = page.locator('#lz-resultados [role=option]').first()
const textoOpcion = await opcion.textContent()
await page.getByPlaceholder('Buscar y enfocar…').press('Enter')
await page.waitForTimeout(1100)
const elegida = page.locator('.lz-caja.sel')
ok((await elegida.count()) === 1, `buscar «produccion» enfoca «${textoOpcion?.slice(0, 40)}» (sin tildes)`)
const bb = await elegida.boundingBox()
ok(bb && bb.x > marco.x && bb.x + bb.width < marco.x + marco.width && bb.y > marco.y && bb.y < marco.y + marco.height, 'lo encontrado queda en pantalla')
ok((await page.locator('.lz-migas button').count()) >= 2, 'las migas muestran el camino hasta la raíz')
await foto(page, '04-org-buscar')

// capas
await page.locator('.lz-panel select').selectOption('vacantes')
await page.waitForTimeout(200)
ok((await page.locator('.lz-leyenda').textContent()).includes('tiene vacantes'), 'la capa «Vacantes» cambia la leyenda (con icono y etiqueta)')
await foto(page, '05-org-capa-vacantes')
await page.locator('.lz-panel select').selectOption('uso')

// teclado: Enter despliega, flecha abajo baja
const sel = page.locator('.react-flow__node:has(.lz-caja.sel)')
await sel.focus()
const n0 = await nodos(page)
await page.keyboard.press('Enter')
await asentar(page)
ok((await nodos(page)) !== n0, 'Enter despliega o pliega la caja con el foco')
await page.keyboard.press('ArrowUp')
await page.waitForTimeout(500)
const enfocado = await page.evaluate(() => document.activeElement?.getAttribute('data-id'))
ok(!!enfocado, `flecha arriba pasa el foco al padre (${enfocado})`)

// PNG
const [descarga] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: '⇩ PNG' }).click()])
ok(/\.png$/.test(descarga.suggestedFilename()), `exportar PNG baja ${descarga.suggestedFilename()}`)
await descarga.saveAs(`capturas/lienzo/${descarga.suggestedFilename()}`)

// Ficha ›
await page.locator('.lz-caja.sel .lz-vf').click()
await page.waitForURL((u) => u.searchParams.has('ficha') || /unidades\//.test(u.pathname), { timeout: 15000 })
const urlFicha = page.url()
ok(/ficha=unidad|unidades\//.test(urlFicha), `«Ficha ›» abre la ficha (${new URL(urlFicha).pathname}${new URL(urlFicha).search})`)
await page.waitForTimeout(800)
await foto(page, '06-org-ficha')

// -----------------------------------------------------------------------------
// 2) ORGANIGRAMA, ESCENARIO: arrastrar una caja sobre otra y agregar con «⋯»
// -----------------------------------------------------------------------------
const org = admin.schema('org')
const contarReal = async () => (await org.from('unidad').select('id', { count: 'exact', head: true }).is('escenario_id', null)).count
const realAntes = await contarReal()
const { data: compras } = await org.from('unidad').select('ref, padre_ref').is('escenario_id', null).eq('nombre', 'Gerencia de Compras').limit(1).single()
const { data: escOrg, error: eEsc } = await yo.schema('org').rpc('crear_escenario_estructura', { p_nombre: `Lienzo · prueba ${new Date().toISOString().slice(11, 19)}` })
if (eEsc) throw eEsc
await page.goto(`${BASE}/sistema/nucleo/organizacion?esc=${escOrg}`)
await page.locator('.react-flow__node').first().waitFor({ timeout: 60000 })
await asentar(page)
await page.getByPlaceholder('Buscar y enfocar…').fill('Gerencia de Compras')
await page.waitForTimeout(150)
await page.getByPlaceholder('Buscar y enfocar…').press('Enter')
await page.waitForTimeout(1100)
// que el destino también se vea: se despliega Gerencia General si hiciera falta (ya lo está)
const origen = caja(page, 'Gerencia de Compras')
const destino = caja(page, 'Dirección de Operaciones')
const a = await origen.boundingBox()
const b = await destino.boundingBox()
ok(!!a && !!b, 'en el escenario se ven el origen y el destino del arrastre')
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
await page.mouse.down()
await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2 + 10, { steps: 4 })
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 })
await page.waitForTimeout(150)
ok((await page.locator('.lz-caja.destino').count()) === 1, 'al pasar por encima, el destino se marca en morado')
await foto(page, '07-esc-arrastrando')
await page.mouse.up()
await page.locator('.lz-aviso', { hasText: 'pasa a depender' }).waitFor({ timeout: 20000 })
await page.waitForTimeout(2500)
const { data: movida } = await org.from('unidad').select('padre_ref').eq('escenario_id', escOrg).eq('ref', compras.ref).single()
const { data: ops2 } = await org.from('unidad').select('ref').is('escenario_id', null).eq('nombre', 'Dirección de Operaciones').limit(1).single()
ok(movida.padre_ref === ops2.ref, 'el arrastre cambió la dependencia EN EL ESCENARIO')
const { data: real } = await org.from('unidad').select('padre_ref').is('escenario_id', null).eq('ref', compras.ref).filter('vigencia', 'cs', `[${new Date().toISOString().slice(0, 10)},${new Date().toISOString().slice(0, 10)}]`).single()
ok(real.padre_ref === compras.padre_ref, 'la realidad no cambió')
ok((await page.locator('.lz-caja.d-movido').count()) >= 1, 'la caja movida sale en morado con su rótulo')
ok((await page.locator('.lz-cambios').textContent()).includes('Gerencia de Compras'), 'la lista de cambios la nombra')

// «⋯» → agregar una unidad debajo de Operaciones
await page.getByPlaceholder('Buscar y enfocar…').fill('Dirección de Operaciones')
await page.waitForTimeout(150)
await page.getByPlaceholder('Buscar y enfocar…').press('Enter')
await page.waitForTimeout(1100)
await page.locator('.lz-caja.sel button[aria-label^="Cambiar"]').click()
await page.locator('.lz-menu button.item', { hasText: 'Agregar una unidad debajo' }).click()
await page.locator('.lz-menu input').first().fill('Gerencia de Mejora Continua')
await page.locator('.lz-menu button[type=submit]').click()
await page.locator('.lz-aviso', { hasText: 'agregada' }).waitFor({ timeout: 20000 })
const nueva = await caja(page, 'Gerencia de Mejora Continua').waitFor({ timeout: 20000 }).then(() => true, () => false)
ok(nueva && (await page.locator('.lz-caja.d-nuevo').count()) >= 1, '«⋯» agrega una unidad nueva, que sale en morado')
await page.waitForTimeout(800)
await foto(page, '08-esc-cambios')
ok((await contarReal()) === realAntes, `la realidad sigue con ${realAntes} filas de unidades`)
await yo.schema('org').from('escenario').update({ estado: 'descartado' }).eq('id', escOrg)

// -----------------------------------------------------------------------------
// 3) MAPA DE PROCESOS
// -----------------------------------------------------------------------------
t0 = Date.now()
await page.goto(`${BASE}/sistema/nucleo/procesos`)
await page.locator('.react-flow__node').first().waitFor({ timeout: 60000 })
console.log(`  mapa: primeras cajas en ${Date.now() - t0} ms`)
await asentar(page)
await foto(page, '09-mapa-inicial')
const m0 = await nodos(page)
await caja(page, 'Seguridad, Salud y Prevención de Pérdidas').click()
await asentar(page)
ok((await nodos(page)) > m0, 'clic en un macroproceso lo despliega')
await foto(page, '10-mapa-desplegado')
await page.getByRole('button', { name: 'Desplegar todo', exact: true }).click()
await page.waitForTimeout(1200)
const todos = await nodos(page)
ok(todos > 150, `«Desplegar todo» abre los cuatro niveles (${todos} cajas)`)
await foto(page, '11-mapa-todo')
await page.getByRole('button', { name: 'Apilar hojas', exact: true }).click()
await page.waitForTimeout(1200)
await foto(page, '12-mapa-clasico')
await page.getByRole('button', { name: 'Apilar hojas', exact: true }).click()
await page.getByRole('button', { name: 'Plegar', exact: true }).click()
await asentar(page)

// escenario de procesos sobre un subárbol: arrastrar un subproceso a otro proceso
const raiz = '390c1c8d-ca68-5a84-ab9e-fdf84a2e67a9'
const sgc = admin.schema('sgc')
const { data: hijosRaiz } = await sgc.from('proceso').select('ref, nombre').is('escenario_id', null).eq('estado', 'vigente').eq('padre_ref', raiz)
const conNietos = []
for (const h of hijosRaiz) {
  const { data: n } = await sgc.from('proceso').select('ref, nombre').is('escenario_id', null).eq('estado', 'vigente').eq('padre_ref', h.ref)
  if (n?.length) conNietos.push({ ...h, nietos: n })
}
const padreA = conNietos[0]
const padreB = hijosRaiz.find((h) => h.ref !== padreA.ref)
const nieto = padreA.nietos[0]
const { data: escPro, error: eP } = await yo.schema('sgc').rpc('crear_escenario_procesos', { p_nombre: `Lienzo · procesos ${new Date().toISOString().slice(11, 19)}`, p_raiz: raiz })
if (eP) throw eP
await page.goto(`${BASE}/sistema/nucleo/procesos?esc=${escPro}`)
await page.locator('.react-flow__node').first().waitFor({ timeout: 60000 })
await asentar(page)
await caja(page, padreA.nombre).click()
await asentar(page)
await page.getByRole('button', { name: '⤢ Ajustar', exact: true }).click()
await page.waitForTimeout(600)
const pa = await caja(page, nieto.nombre).boundingBox()
const pb = await caja(page, padreB.nombre).boundingBox()
ok(!!pa && !!pb, `se ven «${nieto.nombre.slice(0, 30)}» y «${padreB.nombre.slice(0, 30)}»`)
await page.mouse.move(pa.x + pa.width / 2, pa.y + pa.height / 2)
await page.mouse.down()
await page.mouse.move(pa.x + pa.width / 2 + 15, pa.y + pa.height / 2 + 5, { steps: 4 })
await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2, { steps: 20 })
await page.waitForTimeout(150)
await page.mouse.up()
await page.locator('.lz-aviso', { hasText: 'pasa a depender' }).waitFor({ timeout: 20000 })
await page.waitForTimeout(2500)
const { data: np } = await sgc.from('proceso').select('padre_ref').eq('escenario_id', escPro).eq('ref', nieto.ref).single()
ok(np.padre_ref === padreB.ref, 'en el escenario de procesos, el arrastre cambia el padre')
const { data: nr } = await sgc.from('proceso').select('padre_ref').is('escenario_id', null).eq('estado', 'vigente').eq('ref', nieto.ref).single()
ok(nr.padre_ref === padreA.ref, 'la realidad del proceso no cambió')
ok((await page.locator('.lz-caja.d-movido').count()) >= 1, 'el proceso movido sale en morado')
await foto(page, '13-mapa-escenario')
// un macroproceso sobre otro proceso: se rechaza con el porqué
await yo.schema('org').from('escenario').update({ estado: 'descartado' }).eq('id', escPro)

// -----------------------------------------------------------------------------
// 4) TELÉFONO: la lista con migas, y el paso al lienzo
// -----------------------------------------------------------------------------
const tel = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await tel.addCookies(cookies(ver.session))
const p2 = await tel.newPage()
p2.on('pageerror', (e) => errores.push(String(e)))
await p2.goto(`${BASE}/sistema/nucleo/organizacion`)
await p2.locator('.lz-lista .fila').first().waitFor({ timeout: 60000 })
await p2.screenshot({ path: 'capturas/lienzo/14-telefono-lista.png', fullPage: true })
await p2.locator('.lz-lista .fila .txt', { hasText: 'Dirección de Operaciones' }).first().tap()
await p2.waitForTimeout(400)
ok((await p2.locator('.lz-lista nav[aria-label="Camino"]').textContent()).includes('Dirección de Operaciones'), 'en el teléfono, tocar una unidad entra y las migas la nombran')
await p2.screenshot({ path: 'capturas/lienzo/15-telefono-dentro.png', fullPage: true })
await p2.getByRole('button', { name: 'Ver lienzo' }).tap()
await p2.locator('.react-flow__node').first().waitFor({ timeout: 20000 })
await p2.waitForTimeout(700)
await p2.screenshot({ path: 'capturas/lienzo/16-telefono-lienzo.png' })
const ancho = await p2.evaluate(() => document.documentElement.scrollWidth)
ok(ancho <= 392, `sin desborde horizontal en el teléfono (${ancho}px)`)

const propios = errores.filter((e) => !/Download the React DevTools|Fast Refresh/.test(e))
ok(!propios.length, `sin errores de consola${propios.length ? `: ${propios.slice(0, 3).join(' | ')}` : ''}`)
await nav.close()
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : '\nTodo en orden')
process.exit(fallos ? 1 : 0)
