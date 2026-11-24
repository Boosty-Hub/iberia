/**
 * Los archivos de origen de los documentos, en pantalla y por sus rutas, contra el proyecto de PRUEBAS (necesita
 * `cargar-documentos.mjs` corrido allá con algún PDF disponible y el dev de pruebas en el 3005).
 *
 *   node --env-file=.env.local scripts/plataforma/probar-documentos-archivos.mjs [--base http://localhost:3005]
 *
 * Comprueba: la pestaña «Archivos de origen» lista los archivos; «Ver» abre la vista previa con el PDF; `ver` responde
 * un PDF en línea y `descargar` redirige a un enlace firmado de descarga; quien no tiene `sistema:perimetros` no
 * alcanza los archivos de un documento de perímetro (ni la fila ni el objeto del bucket); sin sesión, 401.
 */
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !SECRETO || URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Faltan las SUPABASE_PRUEBAS_* (o apuntan a producción)')
const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

let fallos = 0
const ok = (cond, texto) => {
  console.log(`${cond ? '✓' : '✖'} ${texto}`)
  if (!cond) fallos++
}

async function sesionDe(email) {
  const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
  const { data: enlace, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw new Error(`${email}: ${error.message} (corre mirar.mjs --como … una vez para crear la cuenta)`)
  const { data } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  return data.session
}
function cookies(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

// Un documento general con un PDF disponible, y una fila de un documento de perímetro.
const { data: general } = await admin.schema('sgc').from('documento_archivo').select('id, documento_id, nombre, pdf_ruta, documento!inner(perimetro)').eq('estado', 'disponible').eq('documento.perimetro', 'general').limit(1).single()
const { data: perimetro } = await admin.schema('sgc').from('documento_archivo').select('id, documento_id, pdf_ruta, documento!inner(perimetro)').neq('documento.perimetro', 'general').limit(1).single()
ok(!!general, 'hay un archivo disponible de un documento general')
if (!general) process.exit(1)

await mkdir('capturas/sistema', { recursive: true })
const nav = await chromium.launch()

// ── Como administración: la pestaña, la vista previa y las rutas ──
{
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  await ctx.addCookies(cookies(await sesionDe('admin.pruebas@plataforma.local')))
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sistema/ficha/documento/${general.documento_id}`, { waitUntil: 'networkidle', timeout: 90000 })
  await p.getByRole('tab', { name: /Archivos de origen/ }).or(p.getByRole('button', { name: /Archivos de origen/ })).first().click()
  const fila = p.getByText(general.nombre, { exact: false }).first()
  ok(await fila.isVisible(), `la pestaña lista «${general.nombre}»`)
  await p.screenshot({ path: 'capturas/sistema/documento-archivos.png' })
  await p.getByRole('button', { name: 'Ver', exact: true }).first().click()
  const lienzo = p.locator('dialog[open] canvas').first()
  await lienzo.waitFor({ timeout: 20000 })
  // La primera página dibujada de verdad: el lienzo tiene tamaño y algún píxel que no es blanco.
  await p.waitForFunction(() => {
    const c = document.querySelector('dialog[open] canvas')
    if (!c || !c.width) return false
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 200) return true
    return false
  }, null, { timeout: 20000 }).catch(() => null)
  const pintada = await p.evaluate(() => {
    const c = document.querySelector('dialog[open] canvas')
    if (!c || !c.width) return false
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i] < 200) return true
    return false
  })
  ok(pintada, 'la vista previa dibuja la primera página (pdf.js)')
  await p.screenshot({ path: 'capturas/sistema/documento-vista-previa.png' })

  const ver = await ctx.request.get(`${BASE}/sistema/nucleo/documentos/archivo/${general.id}/ver`)
  ok(ver.status() === 200 && ver.headers()['content-type'] === 'application/pdf' && ver.headers()['content-disposition']?.startsWith('inline'), `ver: 200 PDF en línea (${ver.status()})`)
  const desc = await ctx.request.get(`${BASE}/sistema/nucleo/documentos/archivo/${general.id}/descargar`, { maxRedirects: 0 })
  const destino = desc.headers()['location'] ?? ''
  ok(desc.status() >= 300 && desc.status() < 400 && destino.includes('/storage/v1/object/sign/documentos/') && destino.includes('download='), `descargar: redirige al enlace firmado de descarga (${desc.status()})`)
  await ctx.close()
}

// ── En el teléfono: la pestaña y la vista previa sin desbordar ──
{
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await ctx.addCookies(cookies(await sesionDe('admin.pruebas@plataforma.local')))
  const p = await ctx.newPage()
  await p.goto(`${BASE}/sistema/ficha/documento/${general.documento_id}`, { waitUntil: 'networkidle', timeout: 90000 })
  await p.getByRole('tab', { name: /Archivos de origen/ }).or(p.getByRole('button', { name: /Archivos de origen/ })).first().click()
  const desborde = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  ok(desborde <= 2, `teléfono: la pestaña no desborda (${desborde}px)`)
  await p.screenshot({ path: 'capturas/sistema/documento-archivos-telefono.png' })
  await p.getByRole('button', { name: 'Ver', exact: true }).first().click()
  await p.locator('dialog[open] canvas').first().waitFor({ timeout: 20000 })
  await p.waitForTimeout(800)
  await p.screenshot({ path: 'capturas/sistema/documento-vista-previa-telefono.png' })
  await ctx.close()
}

// ── Sin sesión ──
{
  const ctx = await nav.newContext()
  const r = await ctx.request.get(`${BASE}/sistema/nucleo/documentos/archivo/${general.id}/ver`, { maxRedirects: 0 })
  ok(r.status() === 401 || (r.status() >= 300 && r.status() < 400), `sin sesión no se sirve (${r.status()})`)
  await ctx.close()
}

// ── Un rol sin perímetros (usuario Iberia) ──
if (perimetro) {
  const sesion = await sesionDe('usuario.pruebas@plataforma.local')
  const cli = createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${sesion.access_token}` } } })
  const { data: filas } = await cli.schema('sgc').from('documento_archivo').select('id').eq('id', perimetro.id)
  ok((filas ?? []).length === 0, 'sin sistema:perimetros no lee la fila de un documento de perímetro')
  if (perimetro.pdf_ruta) {
    const { error } = await cli.storage.from('documentos').download(perimetro.pdf_ruta)
    ok(!!error, 'ni el objeto del bucket')
  }
  const ctx = await nav.newContext()
  await ctx.addCookies(cookies(sesion))
  const r = await ctx.request.get(`${BASE}/sistema/nucleo/documentos/archivo/${perimetro.id}/ver`)
  ok(r.status() === 404 || r.status() === 403, `ni por la ruta (${r.status()})`)
  await ctx.close()
} else console.log('· sin filas de documentos de perímetro en pruebas: se salta esa comprobación')

await nav.close()
console.log(fallos ? `\n${fallos} fallos` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
