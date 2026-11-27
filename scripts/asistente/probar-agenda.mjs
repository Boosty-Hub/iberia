/**
 * La agenda con Microsoft 365 (27-nov-2026): la pestaña Agenda, «Hoy» en Mi día, Microsoft To Do en Tareas y el botón
 * flotante del asistente, contra el PROYECTO DE PRUEBAS (dev :3005) y un SIMULADOR de Entra y Graph en el :3999.
 *
 * El dev de pruebas tiene que correr con:
 *   ASISTENTE_MS_LOGIN_URL=http://localhost:3999  ASISTENTE_GRAPH_URL=http://localhost:3999/v1.0
 *
 *   node --env-file=.env.local scripts/asistente/probar-agenda.mjs
 *
 * El token del simulador lleva `scp` como uno de Microsoft: sin «Tasks.Read», To Do dice que falta el permiso.
 */
import http from 'node:http'
import { createHash, createVerify, randomBytes, X509Certificate } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const TENANT = '11111111-1111-4111-8111-111111111111'
const CLIENTE = '22222222-2222-4222-8222-222222222222'
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const A = admin.schema('asistente')
mkdirSync('capturas/asistente', { recursive: true })
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

// Hoy y mañana en Caracas.
const hoy = new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10)
const sumar = (f, n) => {
  const d = new Date(`${f}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const manana = sumar(hoy, 1)

// ── El simulador ───────────────────────────────────────────────────────────────
const der = Buffer.from(process.env.MICROSOFT_CERTIFICADO, 'base64')
const publica = new X509Certificate(der).publicKey
const x5t = createHash('sha1').update(der).digest('base64url')
const sim = { codigos: new Map(), renovacion: new Set(), acceso: new Set(), conTareas: false, zona: null }
const BASE_SCP = 'User.Read Mail.Read Calendars.Read Files.Read.All Sites.Read.All Chat.Read Team.ReadBasic.All ChannelMessage.Read.All'
const EVENTOS = [
  { id: 'e1', subject: 'Comité de compras', start: { dateTime: `${hoy}T10:00:00.0000000` }, end: { dateTime: `${hoy}T11:00:00.0000000` }, isAllDay: false, location: { displayName: 'Sala 2' }, isOnlineMeeting: false, webLink: 'https://outlook.test/e1', organizer: { emailAddress: { name: 'Ana' } }, isCancelled: false, showAs: 'busy' },
  { id: 'e2', subject: 'Visita a planta Cagua', start: { dateTime: `${manana}T00:00:00.0000000` }, end: { dateTime: `${sumar(manana, 1)}T00:00:00.0000000` }, isAllDay: true, location: {}, isOnlineMeeting: false, webLink: 'https://outlook.test/e2', isCancelled: false, showAs: 'busy' },
  { id: 'e3', subject: 'Feriado', start: { dateTime: `${manana}T00:00:00.0000000` }, end: { dateTime: `${sumar(manana, 1)}T00:00:00.0000000` }, isAllDay: true, location: {}, webLink: 'https://outlook.test/e3', isCancelled: false, showAs: 'free' },
  { id: 'e4', subject: 'Revisión con Finanzas', start: { dateTime: `${hoy}T15:30:00.0000000` }, end: { dateTime: `${hoy}T16:00:00.0000000` }, isAllDay: false, location: {}, isOnlineMeeting: true, webLink: 'https://outlook.test/e4', isCancelled: false, showAs: 'busy' },
]
function asercionValida(jwt) {
  try {
    const [h, p, f] = jwt.split('.')
    const cab = JSON.parse(Buffer.from(h, 'base64url'))
    const cue = JSON.parse(Buffer.from(p, 'base64url'))
    return createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publica, Buffer.from(f, 'base64url')) && cab.x5t === x5t && cue.iss === CLIENTE
  } catch {
    return false
  }
}
const json = (res, status, cuerpo) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(cuerpo))
}
const par = () => {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const at = `${b({ typ: 'JWT', alg: 'none' })}.${b({ scp: sim.conTareas ? `${BASE_SCP} Tasks.Read` : BASE_SCP, n: randomBytes(6).toString('hex') })}.firma`
  const rt = `rt-${randomBytes(8).toString('hex')}`
  sim.acceso.add(at)
  sim.renovacion.add(rt)
  return { access_token: at, refresh_token: rt, expires_in: 3600, token_type: 'Bearer' }
}
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:3999')
  let cuerpo = ''
  for await (const t of req) cuerpo += t
  if (u.pathname === `/${TENANT}/oauth2/v2.0/authorize`) {
    const ret = new URL(u.searchParams.get('redirect_uri'))
    ret.searchParams.set('state', u.searchParams.get('state'))
    const code = `code-${randomBytes(6).toString('hex')}`
    sim.codigos.set(code, { reto: u.searchParams.get('code_challenge') })
    ret.searchParams.set('code', code)
    res.writeHead(302, { Location: ret.toString() })
    return res.end()
  }
  if (u.pathname === `/${TENANT}/oauth2/v2.0/token`) {
    const f = new URLSearchParams(cuerpo)
    if (!asercionValida(f.get('client_assertion') ?? '')) return json(res, 401, { error: 'invalid_client' })
    if (f.get('grant_type') === 'authorization_code') {
      const c = sim.codigos.get(f.get('code'))
      if (!c || c.reto !== createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url')) return json(res, 400, { error: 'invalid_grant' })
      return json(res, 200, par())
    }
    if (f.get('grant_type') === 'refresh_token' && sim.renovacion.delete(f.get('refresh_token'))) return json(res, 200, par())
    return json(res, 400, { error: 'invalid_grant' })
  }
  if (u.pathname.startsWith('/v1.0/')) {
    const tok = (req.headers.authorization ?? '').replace('Bearer ', '')
    if (!sim.acceso.has(tok)) return json(res, 401, {})
    const r = u.pathname.slice(5)
    if (r === '/me') return json(res, 200, { displayName: 'Ana Prueba', mail: 'ana.prueba@iberia.test' })
    if (r === '/me/calendarView') {
      sim.zona = req.headers.prefer ?? null
      const desde = u.searchParams.get('startDateTime').slice(0, 10)
      const hasta = u.searchParams.get('endDateTime').slice(0, 10)
      return json(res, 200, { value: EVENTOS.filter((e) => e.start.dateTime.slice(0, 10) >= desde && e.start.dateTime.slice(0, 10) < hasta) })
    }
    if (r === '/me/todo/lists') {
      if (!tok.includes(Buffer.from('Tasks.Read').toString('base64url').slice(0, 6)) && !JSON.parse(Buffer.from(tok.split('.')[1], 'base64url')).scp.includes('Tasks.Read')) return json(res, 403, {})
      return json(res, 200, { value: [{ id: 'l1', displayName: 'Tareas' }, { id: 'l2', displayName: 'Compras' }] })
    }
    const t = /^\/me\/todo\/lists\/(l[12])\/tasks$/.exec(r)
    if (t)
      return json(res, 200, {
        value: t[1] === 'l1' ? [{ id: 't1', title: 'Llamar al proveedor de envases', dueDateTime: { dateTime: `${hoy}T00:00:00.0000000`, timeZone: 'UTC' }, importance: 'high', status: 'notStarted' }] : [{ id: 't2', title: 'Pedir cotización de etiquetas', importance: 'normal', status: 'notStarted' }],
      })
    return json(res, 404, {})
  }
  json(res, 404, {})
})
await new Promise((r) => servidor.listen(3999, r))

// ── La sesión ──────────────────────────────────────────────────────────────────
const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'admin.pruebas@plataforma.local' })
const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const yo = ver.user.id
const { data: perfil } = await admin.from('profiles').select('rol_id').eq('id', yo).single()
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
const n = `sb-${ref}-auth-token`
const galletas = valor.length <= 3180 ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / 3180) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * 3180, (i + 1) * 3180) }))
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addCookies(galletas.map((x) => ({ ...x, domain: 'localhost', path: '/' })))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(e.message))

const M365 = ['m365:correo', 'm365:calendario', 'm365:archivos', 'm365:teams']
const { data: cfgAntes } = await A.from('config').select('microsoft_tenant, microsoft_cliente').eq('id', true).single()
const { data: fuentesAntes } = await A.from('fuente').select('clave, encendida').in('clave', M365)
const tareaId = crypto.randomUUID()

try {
  await A.rpc('borrar_microsoft', { p_perfil: yo })
  await A.from('config').update({ microsoft_tenant: TENANT, microsoft_cliente: CLIENTE }).eq('id', true)
  await A.from('fuente').upsert(M365.map((clave) => ({ clave, encendida: true, sensible: false })))
  await A.from('alcance_rol').upsert(M365.map((fuente) => ({ rol_id: perfil.rol_id, fuente, permitido: true })))
  await admin.schema('nucleo').from('tarea').insert({ id: tareaId, titulo: 'Revisar el plan de dotación (prueba agenda)', asignada_a: yo, creada_por: yo, vence: hoy })

  // 1. El botón flotante abre el asistente al costado; en el asistente no sale.
  await p.goto(`${BASE}/sistema/tareas`, { waitUntil: 'networkidle' })
  await p.locator('[data-boton-asistente-flotante]').click()
  await p.waitForSelector('[data-panel-asistente]', { timeout: 20_000 })
  ok(true, 'el botón flotante abre el asistente al costado')
  await p.keyboard.press('Escape')
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  ok((await p.locator('[data-boton-asistente-flotante]').count()) === 0, 'en el asistente mismo no sale')

  // 2. Sin conectar: la agenda trae la tarea de la plataforma y ofrece conectar.
  await p.goto(`${BASE}/sistema/agenda`, { waitUntil: 'networkidle' })
  ok(await p.locator(`[data-dia="${hoy}"] [data-item-agenda=tarea]`).first().isVisible(), 'la agenda muestra la tarea de la plataforma en su día')
  ok(await p.locator('[data-agenda-conectar]').isVisible(), 'sin Microsoft conectado, ofrece conectarlo')

  // 3. Conectar.
  await p.goto(`${BASE}/sistema/asistente/conexiones`, { waitUntil: 'networkidle' })
  await p.getByRole('link', { name: 'Conectar mi cuenta' }).click()
  await p.waitForURL(/conexiones\?ok=/, { timeout: 20_000 })

  // 4. Con Microsoft (sin Tasks.Read): reuniones en su día y hora, sin el «libre» de día completo, To Do avisa.
  await p.goto(`${BASE}/sistema/agenda?semana=${hoy}`, { waitUntil: 'networkidle' })
  const diaHoy = await p.locator(`[data-dia="${hoy}"]`).innerText()
  ok(/Comité de compras/.test(diaHoy) && /10:00 – 11:00 a\. m\./.test(diaHoy) && /3:30 – 4:00 p\. m\./.test(diaHoy) && /Revisión con Finanzas/.test(diaHoy) && /en línea/.test(diaHoy), 'las reuniones de Outlook salen en su día, con su hora de Caracas')
  ok(/^Prefer|outlook\.timezone="Venezuela Standard Time"/.test(sim.zona ?? ''), 'se piden en hora de Venezuela')
  const lunesSemana = await p.locator('[data-dia]').first().getAttribute('data-dia')
  const enSemana = manana >= lunesSemana && manana < sumar(lunesSemana, 7)
  if (enSemana) {
    const diaManana = await p.locator(`[data-dia="${manana}"]`).innerText()
    ok(/Visita a planta Cagua/.test(diaManana) && /Todo el día/.test(diaManana) && !/Feriado/.test(diaManana), 'lo de todo el día sale una vez y el «libre» de día completo no')
  }
  ok(await p.locator('[data-agenda-sin-todo]').isVisible(), 'sin el permiso Tasks.Read, dice que falta para To Do')
  await p.screenshot({ path: 'capturas/asistente/agenda-semana.png', fullPage: true })

  // 5. Con Tasks.Read (Tecnología lo habilita): To Do aparece sin reconectar.
  sim.conTareas = true
  await A.from('conexion_microsoft').update({ renovado_en: new Date().toISOString() }).eq('perfil_id', yo)
  // Vence el token en memoria: se reconecta para que el siguiente lleve el permiso (en la vida real, al renovarse en la hora).
  await p.goto(`${BASE}/sistema/asistente/conexiones`, { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: 'Desconectar' }).click()
  await p.getByRole('button', { name: 'Sí, desconectar' }).click()
  await p.waitForSelector('text=Sin conectar.', { timeout: 20_000 })
  await p.getByRole('link', { name: 'Conectar mi cuenta' }).click()
  await p.waitForURL(/conexiones\?ok=/, { timeout: 20_000 })
  await p.goto(`${BASE}/sistema/agenda?semana=${hoy}`, { waitUntil: 'networkidle' })
  ok(/Llamar al proveedor de envases/.test(await p.locator(`[data-dia="${hoy}"]`).innerText()), 'con Tasks.Read, la tarea de To Do sale en su día')
  ok((await p.locator('[data-agenda-sin-todo]').count()) === 0, 'y el aviso del permiso se va')
  await p.screenshot({ path: 'capturas/asistente/agenda-semana-todo.png', fullPage: true })

  // 6. Mi día: «Hoy».
  await p.goto(`${BASE}/sistema`, { waitUntil: 'networkidle' })
  const hoyTxt = await p.locator('[data-hoy-agenda]').innerText()
  ok(/Comité de compras/.test(hoyTxt) && /Revisar el plan de dotación/.test(hoyTxt) && /Llamar al proveedor/.test(hoyTxt), 'Mi día muestra lo de hoy: reuniones, tareas de la plataforma y de To Do')
  await p.locator('[data-hoy-agenda]').screenshot({ path: 'capturas/asistente/agenda-hoy.png' })

  // 7. Tareas: Microsoft To Do con sus dos listas.
  await p.goto(`${BASE}/sistema/tareas`, { waitUntil: 'networkidle' })
  const td = await p.locator('[data-tareas-todo]').innerText()
  ok(/Llamar al proveedor/.test(td) && /Pedir cotización de etiquetas/.test(td) && /Compras/.test(td), 'Tareas muestra Microsoft To Do, de todas sus listas')
  await p.screenshot({ path: 'capturas/asistente/agenda-tareas.png', fullPage: true })

  // 8. Teléfono: la agenda como lista, sin días vacíos.
  const tel = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await tel.addCookies(galletas.map((x) => ({ ...x, domain: 'localhost', path: '/' })))
  const pt = await tel.newPage()
  await pt.goto(`${BASE}/sistema/agenda?semana=${hoy}`, { waitUntil: 'networkidle' })
  const visibles = await pt.locator('[data-dia]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0).length)
  const ancho = await pt.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  ok(visibles >= 1 && visibles < 7 && ancho, `en el teléfono, lista por día sin los vacíos (${visibles} días) y sin desbordar`)
  await pt.screenshot({ path: 'capturas/asistente/agenda-telefono.png', fullPage: true })
  await tel.close()
  ok(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores[0].slice(0, 160)}` : ''}`)
} finally {
  await admin.schema('nucleo').from('tarea').delete().eq('id', tareaId)
  await A.rpc('borrar_microsoft', { p_perfil: yo })
  await A.from('alcance_rol').delete().eq('rol_id', perfil.rol_id).in('fuente', M365)
  for (const clave of M365) {
    const antes = (fuentesAntes ?? []).find((f) => f.clave === clave)
    if (antes) await A.from('fuente').update({ encendida: antes.encendida }).eq('clave', clave)
    else await A.from('fuente').delete().eq('clave', clave)
  }
  await A.from('config').update(cfgAntes).eq('id', true)
  await nav.close()
  servidor.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
