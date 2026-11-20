/**
 * Plataforma Iberia · recorre el armazón con interacción, contra el PROYECTO DE
 * PRUEBAS: la paleta (Ctrl K) con una búsqueda, la campana, la ficha abierta
 * desde una fila de la tabla, un filtro y un agrupar, el riel plegado, «ver
 * como» y el menú del teléfono. Deja capturas en `capturas/sistema/armazon-*`
 * y reporta errores de consola y desborde horizontal.
 *
 *   MSYS_NO_PATHCONV=1 node --env-file=.env.local scripts/plataforma/mirar-armazon.mjs [--como admin|usuario|lector]
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const opc = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const BASE = opc('--base', 'http://localhost:3005')
const COMO = opc('--como', 'admin')
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !SECRETO) throw new Error('Faltan las variables SUPABASE_PRUEBAS_* en .env.local')
const EMAILS = { admin: 'admin.pruebas@plataforma.local', usuario: 'usuario.pruebas@plataforma.local', lector: 'lector.pruebas@plataforma.local', consultor: 'consultor.pruebas@plataforma.local' }

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const { data: enlace, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAILS[COMO] })
if (e1) throw new Error(`${e1.message} (corre antes mirar.mjs --como ${COMO} para crear la cuenta)`)
const { data: ver, error: e2 } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
if (e2) throw e2

function cookies(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

await mkdir('capturas/sistema', { recursive: true })
const nav = await chromium.launch()
let fallos = 0
const errores = []
async function contexto(w, h) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await ctx.addCookies(cookies(ver.session))
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 240)))
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 240)))
  return { ctx, p }
}
async function foto(p, nombre, completa = false) {
  const desborde = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const archivo = `capturas/sistema/armazon-${COMO}-${nombre}.png`
  await p.screenshot({ path: archivo, fullPage: completa })
  const mal = desborde > 2 || errores.length
  if (mal) fallos++
  console.log(`${mal ? '✖' : '✓'} ${nombre}${desborde > 2 ? ` · desborda ${desborde}px` : ''} · ${archivo}`)
  for (const e of errores.splice(0)) console.log(`    consola: ${e}`)
}

// ── Escritorio ───────────────────────────────────────────────────────────────
{
  const { ctx, p } = await contexto(1440, 900)
  await p.goto(BASE + '/sistema/nucleo/organizacion/plazas', { waitUntil: 'networkidle', timeout: 90000 })
  await p.keyboard.press('Control+k')
  await p.getByRole('combobox', { name: 'Buscar en la plataforma' }).fill('compras')
  await p.locator('#paleta-resultados [role=option]').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(400)
  await foto(p, '1-paleta')
  await p.keyboard.press('Escape')

  await p.locator('tbody tr').first().click()
  await p.getByRole('complementary', { name: 'Ficha del objeto' }).getByRole('tab').first().waitFor({ timeout: 20000 })
  await foto(p, '2-ficha-plaza')
  await p.getByRole('tab', { name: /Relaciones/ }).click()
  await foto(p, '3-ficha-relaciones')
  await p.keyboard.press('Escape')
  await p.waitForFunction(() => !location.search.includes('ficha='))

  await p.goto(BASE + '/sistema/nucleo/organizacion/plazas?agrupar=unidad_tipo&f.certeza=hecho', { waitUntil: 'networkidle' })
  await foto(p, '4-agrupar-filtro')

  // Guardar una vista personal, verla en la columna y borrarla.
  await p.getByRole('button', { name: 'Vistas guardadas' }).click()
  await p.getByLabel('Nombre de la vista').fill('Prueba · plazas certeza hecho')
  await p.getByRole('button', { name: 'Guardar', exact: true }).click()
  await p.getByText('Vista guardada.').waitFor({ timeout: 20000 })
  await p.keyboard.press('Escape')
  await p.getByRole('complementary', { name: /Módulos de/ }).getByText('Prueba · plazas certeza hecho').waitFor({ timeout: 20000 })
  await foto(p, '4b-vista-guardada')

  // Exportar la vista actual a CSV.
  const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.getByRole('button', { name: /CSV/ }).click()])
  const ruta = await descarga.path()
  const { readFile } = await import('node:fs/promises')
  const csv = await readFile(ruta, 'utf8')
  const lineas = csv.split(/\r?\n/)
  console.log(`  CSV: ${descarga.suggestedFilename()} · ${lineas.length - 1} filas · ${lineas[0].replace(/^﻿/, '')}`)

  await p.getByRole('button', { name: 'Vistas guardadas' }).click()
  await p.getByRole('button', { name: 'Borrar la vista Prueba · plazas certeza hecho' }).click()
  await p.getByText('Vista borrada.').waitFor({ timeout: 20000 })
  await p.keyboard.press('Escape')

  // Un escenario y otra fecha: las dos bandas.
  const { data: esc } = await admin.schema('org').from('escenario').select('id').eq('alcance', 'estructura').in('estado', ['borrador', 'en_aprobacion']).limit(1)
  if (esc?.[0]) {
    await p.goto(BASE + `/sistema/nucleo/organizacion/plazas?al=2026-10-01&esc=${esc[0].id}`, { waitUntil: 'networkidle' })
    await foto(p, '4c-escenario-y-fecha')
  }

  await p.getByRole('button', { name: /Notificaciones/ }).click()
  await foto(p, '5-campana')
  await p.keyboard.press('Escape')

  await p.getByRole('button', { name: 'Plegar el menú a solo iconos' }).click()
  await p.waitForTimeout(300)
  await foto(p, '6-riel-iconos')
  await p.getByRole('button', { name: 'Mostrar los nombres del menú' }).click()

  if (COMO === 'admin') {
    // «Ver como» un lector: la banda aparece, el menú se recorta y una pantalla
    // que el rol no abre devuelve a «Mi día» con el aviso.
    await p.goto(BASE + '/sistema', { waitUntil: 'networkidle' })
    await p.getByLabel('Ver como').selectOption({ label: 'Lector Iberia' })
    await p.getByText('Estás viendo la plataforma como').waitFor({ timeout: 20000 })
    await p.goto(BASE + '/sistema/finanzas/tasas', { waitUntil: 'networkidle' })
    console.log(`  ver como lector → /sistema/finanzas/tasas terminó en ${p.url().replace(BASE, '')}`)
    await foto(p, '12-ver-como-lector')
    await p.getByRole('button', { name: 'Volver a mi vista' }).click()
    await p.getByText('Estás viendo la plataforma como').waitFor({ state: 'detached', timeout: 20000 })
  }

  await p.goto(BASE + '/sistema/modulo/COM-VEN', { waitUntil: 'networkidle' })
  await foto(p, '7-anatomia')
  await p.goto(BASE + '/sistema/ficha/plaza/' + (await primeraPlaza()), { waitUntil: 'networkidle' })
  await foto(p, '8-ficha-pagina')
  await ctx.close()
}

// ── Tableta (1024) ───────────────────────────────────────────────────────────
{
  const { ctx, p } = await contexto(1024, 768)
  await p.goto(BASE + '/sistema/finanzas/tasas', { waitUntil: 'networkidle' })
  await foto(p, '9-tableta-tasas')
  await ctx.close()
}

// ── Teléfono ─────────────────────────────────────────────────────────────────
{
  const { ctx, p } = await contexto(390, 844)
  await p.goto(BASE + '/sistema/nucleo/organizacion/plazas', { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: 'Abrir el menú' }).click()
  await p.waitForTimeout(300)
  await foto(p, '10-telefono-menu')
  await p.keyboard.press('Escape')
  await p.locator('tbody tr').first().click()
  await p.getByRole('complementary', { name: 'Ficha del objeto' }).getByRole('tab').first().waitFor({ timeout: 20000 })
  await foto(p, '11-telefono-ficha')
  await ctx.close()
}

async function primeraPlaza() {
  const { data } = await admin.schema('ui').rpc('plazas').select('ref').limit(1)
  return data?.[0]?.ref
}

await nav.close()
process.exit(fallos ? 1 : 0)
