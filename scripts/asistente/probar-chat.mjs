/**
 * Asistente de IA · recorrido de punta a punta en el navegador, contra el
 * PROYECTO DE PRUEBAS (dev en el 3005): pregunta simple, Excel grande, HTML, y
 * las puertas (otra cuenta no lee ni escucha el chat ajeno). Mide el tiempo
 * hasta la primera palabra. Gasta unos centavos de API.
 *
 *   node --env-file=.env.local scripts/asistente/probar-chat.mjs [--solo simple|excel|html|word|puertas] [--motor openai] [--excel <ruta.xlsx>] [--base http://localhost:3005]
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const opc = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const BASE = opc('--base', 'http://localhost:3005')
const SOLO = opc('--solo', null)
const EXCEL = opc('--excel', null)
// Con --motor openai (la configuración de pruebas tiene que tener ese motor activo), cada modelo de Anthropic se cambia por uno de OpenAI.
const MOTOR = opc('--motor', 'anthropic')
const EQUIVALE = { 'claude-haiku-5-5': 'gpt-6.1-terra', 'claude-sonnet-5-5': 'gpt-6.2-sol', 'claude-opus-5-5': 'gpt-6.2-sol' }
const modeloDe = (m) => (MOTOR === 'openai' ? EQUIVALE[m] ?? m : m)
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !SECRETO || !PUB) throw new Error('Faltan SUPABASE_PRUEBAS_*')
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const CUENTAS = {
  admin: { email: 'admin.pruebas@plataforma.local', nombre: 'Administración de pruebas', rol: 'administrador' },
  usuario: { email: 'usuario.pruebas@plataforma.local', nombre: 'Usuaria de pruebas', rol: 'usuario-iberia' },
}

async function sesionDe(clave) {
  const c = CUENTAS[clave]
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 })
  let u = lista?.users?.find((x) => x.email === c.email)
  if (!u) {
    const { data, error } = await admin.auth.admin.createUser({ email: c.email, email_confirm: true, user_metadata: { nombre_completo: c.nombre, rol_clave: c.rol, organizacion: 'boosty' } })
    if (error) throw error
    u = data.user
  }
  const { data: rol } = await admin.from('roles').select('id').eq('clave', c.rol).single()
  await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: c.nombre }).eq('id', u.id)
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: c.email })
  const { data: ver, error } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (error) throw error
  return { sesion: ver.session, id: u.id }
}

function cookies(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

let fallos = 0
const ok = (cond, texto) => {
  console.log(`${cond ? '✓' : '✖'} ${texto}`)
  if (!cond) fallos++
}

await mkdir('capturas/asistente', { recursive: true })
const nav = await chromium.launch()
const yo = await sesionDe('admin')
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addCookies(cookies(yo.sesion))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(String(e)))
p.on('console', (m) => m.type() === 'error' && errores.push(m.text()))

async function preguntar(texto, { modelo, esfuerzo, archivo, esperar = 'texto', tope = 120_000 } = {}) {
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  if (modelo) await p.getByLabel('Modelo').selectOption(modeloDe(modelo))
  if (esfuerzo) await p.getByLabel('Esfuerzo').selectOption(esfuerzo)
  if (archivo) {
    await p.locator('input[type=file]').setInputFiles(archivo)
    await p.waitForFunction(() => !document.querySelector('[aria-label="Adjuntos"] .animate-spin'), null, { timeout: 120_000 })
  }
  await p.getByLabel('Mensaje para el asistente').fill(texto)
  const t0 = Date.now()
  await p.getByRole('button', { name: 'Enviar' }).click()
  // La primera palabra: el turno vivo pinta Markdown, o ya está el mensaje.
  await p.waitForSelector('[aria-live=polite] .prosa-chat, .group .prosa-chat', { timeout: tope })
  const primera = Date.now() - t0
  // Fin del turno: desaparece el turno vivo y queda el mensaje con sus botones.
  await p.waitForFunction(() => !document.querySelector('[aria-live=polite]') && document.querySelector('[aria-label="Copiar la respuesta"]'), null, { timeout: tope })
  const total = Date.now() - t0
  if (esperar === 'archivo') await p.waitForSelector('a:has-text("Descargar")', { timeout: 10_000 }).catch(() => null)
  return { primera, total, url: p.url() }
}

if (!SOLO || SOLO === 'simple') {
  const r = await preguntar('Responde solo con el número, sin nada más: ¿cuánto es 17 por 23?', { modelo: 'claude-haiku-5-5', esfuerzo: 'low' })
  const textoRespuesta = await p.locator('.group .prosa-chat').last().innerText()
  ok(textoRespuesta.includes('391'), `pregunta simple con Haiku: «${textoRespuesta.trim().slice(0, 40)}» · primera palabra ${r.primera} ms · total ${r.total} ms`)
  ok(/\/sistema\/asistente\/c\/[0-9a-f-]{36}$/.test(r.url), `la URL pasó al chat: ${r.url.replace(BASE, '')}`)
  await p.screenshot({ path: 'capturas/asistente/simple.png' })
  const r2 = await preguntar('En una sola línea: ¿qué es una mayonesa?', { modelo: 'claude-opus-5-5', esfuerzo: 'medium' })
  ok(r2.primera < 15000, `Opus 5.5 medio · primera palabra ${r2.primera} ms · total ${r2.total} ms`)
}

if (!SOLO || SOLO === 'excel') {
  if (!EXCEL) console.log('· (sin --excel, se salta el Excel)')
  else {
    const r = await preguntar('Analiza este Excel: total de cantidad por precio por zona y por producto, compáralo con la hoja Metas y devuélveme un Excel con una hoja Resumen. Explícame lo más importante en tres líneas.', {
      modelo: 'claude-sonnet-5-5',
      esfuerzo: 'medium',
      archivo: EXCEL,
      esperar: 'archivo',
      tope: 600_000,
    })
    const descargas = await p.locator('a:has-text("Descargar")').count()
    ok(descargas >= 1, `Excel procesado con Sonnet: ${descargas} archivo(s) para descargar · primera señal ${r.primera} ms · total ${Math.round(r.total / 1000)} s`)
    await p.screenshot({ path: 'capturas/asistente/excel.png' })
    if (descargas) {
      const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 30_000 }), p.locator('a:has-text("Descargar")').first().click()])
      ok((await descarga.suggestedFilename()).endsWith('.xlsx'), `se descarga: ${await descarga.suggestedFilename()}`)
    }
  }
}

if (!SOLO || SOLO === 'html') {
  await preguntar('Publica un HTML con un gráfico de barras de ventas por zona: Centro 120, Oriente 95, Occidente 80, Andes 60. Usa Chart.js. Después dime en una línea qué muestra.', {
    modelo: 'claude-sonnet-5-5',
    esfuerzo: 'low',
    tope: 300_000,
  })
  const tarjeta = p.locator('button:has-text("Abrir")').first()
  ok((await tarjeta.count()) > 0, 'hay tarjeta del artefacto')
  // Como en Claude, el panel se abre solo: no hace falta tocar la tarjeta.
  ok((await p.locator('iframe[sandbox]').count()) > 0, 'el artefacto se abrió solo en el panel')
  if (await tarjeta.count()) {
    if (!(await p.locator('iframe[sandbox]').count())) await tarjeta.click()
    const marco = p.frameLocator('iframe[sandbox]')
    await marco.locator('canvas, svg').first().waitFor({ timeout: 30_000 }).catch(() => null)
    ok((await marco.locator('canvas, svg').count()) > 0, 'el HTML pinta su gráfico dentro del marco aislado')
    const fuga = await marco.locator('body').evaluate(async () => {
      let cookie = 'no se pudo leer'
      try {
        cookie = document.cookie
      } catch {
        cookie = 'bloqueada'
      }
      let red = 'bloqueada'
      try {
        await fetch('https://example.com', { mode: 'no-cors' })
        red = 'abierta'
      } catch {
        red = 'bloqueada'
      }
      return { cookie, red }
    })
    ok(!fuga.cookie.includes('sb-') && fuga.red === 'bloqueada', `el HTML no lee la sesión (${fuga.cookie || 'vacía'}) ni sale a internet (${fuga.red})`)
    await p.screenshot({ path: 'capturas/asistente/html.png' })
    // Datos nuevos: el mismo artefacto pasa a la versión 2.
    await p.getByLabel('Mensaje para el asistente').fill('Agrega la zona Llanos con 40 al mismo tablero.')
    await p.getByRole('button', { name: 'Enviar' }).click()
    await p.waitForFunction(() => !document.querySelector('[aria-live=polite]') && document.querySelectorAll('[aria-label="Copiar la respuesta"]').length >= 2, null, { timeout: 300_000 })
    const versiones = await p.locator('select[aria-label="Versión"] option').allInnerTexts().catch(() => [])
    ok(versiones.length >= 2, `el artefacto se actualizó como versión nueva (${versiones.join(', ') || 'sin selector'})`)
    await p.screenshot({ path: 'capturas/asistente/artefacto-v2.png' })
  }
}

if (!SOLO || SOLO === 'word') {
  const r = await preguntar('Redáctame en Word un memo de una página para la Gerencia General sobre la importancia de registrar las mermas de planta a diario. Usa el formato de Iberia.', {
    modelo: 'claude-sonnet-5-5',
    esfuerzo: 'low',
    esperar: 'archivo',
    tope: 600_000,
  })
  const enlace = p.locator('a:has-text("Descargar")').last()
  ok((await enlace.count()) > 0, `Word generado · total ${Math.round(r.total / 1000)} s`)
  if (await enlace.count()) {
    const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 30_000 }), enlace.click()])
    const nombre = await descarga.suggestedFilename()
    await descarga.saveAs(`capturas/asistente/${nombre}`)
    ok(nombre.endsWith('.docx'), `se descarga: ${nombre} → capturas/asistente/`)
  }
}

if (!SOLO || SOLO === 'puertas') {
  // Un chat del admin y lo que otra cuenta puede (no) hacer con él.
  const { data: chat } = await admin.schema('asistente').from('chat').select('id').eq('dueno', yo.id).order('creado_en', { ascending: false }).limit(1).single()
  const otra = await sesionDe('usuario')
  const cliente = createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${otra.sesion.access_token}` } } })
  const { data: leidos } = await cliente.schema('asistente').from('mensaje').select('id').eq('chat_id', chat.id)
  ok((leidos ?? []).length === 0, `otra cuenta no lee los mensajes del chat ajeno (${(leidos ?? []).length})`)
  const { data: arch } = await admin.schema('asistente').from('archivo').select('ruta').eq('dueno', yo.id).limit(1).maybeSingle()
  if (arch) {
    const { error } = await cliente.storage.from('asistente').download(arch.ruta)
    ok(!!error, 'otra cuenta no baja un archivo ajeno del bucket')
  }
  const { error: eIns } = await cliente.schema('asistente').from('turno').insert({ chat_id: chat.id, solicitante: otra.id, motor: 'anthropic', modelo: 'claude-haiku-5-5', esfuerzo: 'low' })
  ok(!!eIns, 'otra cuenta no puede pedir turnos en el chat ajeno')
  const { error: eTope } = await cliente.schema('asistente').from('politica_usuario').upsert({ perfil_id: otra.id, tope_diario_usd: 9999 })
  ok(!!eTope, 'nadie se sube su propio tope')
  // Realtime: la otra cuenta no se puede unir al canal privado del chat ajeno.
  const rt = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
  await rt.realtime.setAuth(otra.sesion.access_token)
  const estado = await new Promise((listo) => {
    const t = setTimeout(() => listo('sin respuesta'), 8000)
    rt.channel(`asistente:chat:${chat.id}`, { config: { private: true } }).subscribe((s) => {
      if (s !== 'SUBSCRIBED' && s !== 'CHANNEL_ERROR' && s !== 'TIMED_OUT') return
      clearTimeout(t)
      listo(s)
    })
  })
  ok(estado !== 'SUBSCRIBED', `otra cuenta no escucha el canal del chat ajeno (${estado})`)
  await rt.removeAllChannels()
  // Y la página: sin la casilla, no entra.
  const ctx2 = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx2.addCookies(cookies(otra.sesion))
  const p2 = await ctx2.newPage()
  await p2.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  ok(!p2.url().includes('/sistema/asistente'), `sin la casilla, /sistema/asistente lo saca (${p2.url().replace(BASE, '')})`)
  await ctx2.close()
}

// El intento de fuga de la prueba del HTML deja su propio aviso de la política de contenido: es lo esperado.
const errores2 = errores.filter((e) => !e.includes('example.com'))
errores.length = 0
errores.push(...errores2)
ok(errores.length === 0, `sin errores de consola${errores.length ? `: ${errores.slice(0, 3).join(' | ').slice(0, 400)}` : ''}`)
await nav.close()
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
