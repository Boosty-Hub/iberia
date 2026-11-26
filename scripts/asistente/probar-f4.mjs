/**
 * Asistente de IA · fase 4: chats compartidos y compartir archivos, con dos
 * sesiones reales a la vez (admin dueño + consultor invitado) contra el
 * PROYECTO DE PRUEBAS (dev :3005). Supone el alcance de prueba de probar-datos:
 * el rol administrador tiene plazas en su alcance; el rol consultor, ninguna fuente.
 *
 *   node --env-file=.env.local scripts/asistente/probar-f4.mjs
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

async function sesion(email, nombre, rolClave) {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 })
  let u = lista.users.find((x) => x.email === email)
  if (!u) u = (await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nombre_completo: nombre, rol_clave: rolClave, organizacion: 'boosty' } })).data.user
  const { data: rol } = await admin.from('roles').select('id').eq('clave', rolClave).single()
  await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: nombre }).eq('id', u.id)
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  return { s: ver.session, id: u.id, nombre }
}
const cookies = (s) => {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64url')
  const L = 3180
  const n = `sb-${ref}-auth-token`
  const partes = valor.length <= L ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: 'localhost', path: '/' }))
}

const yo = await sesion('admin.pruebas@plataforma.local', 'Administración de pruebas', 'administrador')
const otro = await sesion('consultor.pruebas@plataforma.local', 'Consultoría de pruebas', 'consultor')
const fuera = await sesion('usuario.pruebas@plataforma.local', 'Usuaria de pruebas', 'usuario-iberia')
await admin.schema('asistente').from('memoria').delete().eq('dueno', yo.id)
await admin.schema('asistente').from('memoria').insert({ dueno: yo.id, texto: 'Su fruta favorita es el TAMARINDO.' })

const nav = await chromium.launch()
const abrir = async (q) => {
  const c = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await c.addCookies(cookies(q.s))
  return c.newPage()
}
const pa = await abrir(yo)
const pb = await abrir(otro)
const esperarFin = (p, n) => p.waitForFunction((k) => !document.querySelector('[aria-live=polite]') && document.querySelectorAll('[aria-label="Copiar la respuesta"]').length >= k, n, { timeout: 300_000 })

// 1. El dueño consulta datos y comparte el chat.
await pa.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
await pa.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
await pa.getByLabel('Mensaje para el asistente').fill('¿Cuántas plazas vacantes hay? Una línea, con la fuente.')
await pa.getByRole('button', { name: 'Enviar' }).click()
await esperarFin(pa, 1)
const chat = pa.url().split('/c/')[1]
await pa.reload({ waitUntil: 'networkidle' })
await pa.getByRole('button', { name: 'Compartir chat' }).click()
const aviso = await pa.locator('[role=dialog]').innerText()
ok(/ya trae datos de/i.test(aviso), 'al invitar, avisa qué fuentes trae el chat')
await pa.getByLabel('Persona a invitar').selectOption(otro.id)
await pa.getByRole('button', { name: 'Invitar' }).click()
await pa.waitForTimeout(2500)
const { data: part } = await admin.schema('asistente').from('participante').select('perfil_id').eq('chat_id', chat)
ok((part ?? []).some((p) => p.perfil_id === otro.id), 'el consultor quedó en el chat')
const opcionesFuera = await pa.locator('[aria-label="Persona a invitar"] option').allInnerTexts()
ok(!opcionesFuera.some((t) => t.includes('Usuaria de pruebas')), 'quien no tiene el asistente no sale para invitar')
const ca = createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${yo.s.access_token}` } } })
const { error: eInv } = await ca.schema('asistente').rpc('invitar', { p_chat: chat, p_perfil: fuera.id })
ok(!!eInv, 'la base tampoco deja invitar a quien no tiene el asistente')

// 2. El invitado ve lo que ya había (decisión P1).
await pb.goto(`${BASE}/sistema/asistente/c/${chat}`, { waitUntil: 'networkidle' })
ok((await pb.locator('.group .prosa-chat').count()) >= 1, 'el invitado ve lo que ya estaba en el chat')

// 3. El invitado pregunta: consulta con SUS permisos (sin plazas en su alcance), y el gasto es suyo. El dueño lo ve en vivo.
await pa.reload({ waitUntil: 'networkidle' })
await pb.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
await pb.getByLabel('Mensaje para el asistente').fill('Y por unidad, ¿cuáles tienen más vacantes? Consulta la tabla de plazas.')
await pb.getByRole('button', { name: 'Enviar' }).click()
await pa.waitForSelector('text=Consultoría de pruebas', { timeout: 30_000 }).catch(() => null)
ok((await pa.locator('text=Consultoría de pruebas').count()) > 0, 'el dueño ve en vivo el mensaje del invitado, con su nombre')
await esperarFin(pb, 2)
const { data: t2 } = await admin.schema('asistente').from('turno').select('id, solicitante').eq('chat_id', chat).order('creado_en', { ascending: false }).limit(1).single()
const { data: q2 } = await admin.schema('asistente').from('consulta_fuente').select('fuente').eq('turno_id', t2.id)
ok(t2.solicitante === otro.id, 'el turno (y su gasto) es de quien escribió')
ok(!(q2 ?? []).some((q) => q.fuente === 'tabla:plazas'), `el invitado no consulta plazas con permisos ajenos (${(q2 ?? []).map((q) => q.fuente).join(', ') || 'ninguna'})`)
await esperarFin(pa, 2)
ok(true, 'el dueño recibió la respuesta en vivo')

// 4. Un mensaje para el grupo no crea turno y llega en vivo.
const turnosAntes = (await admin.schema('asistente').from('turno').select('id').eq('chat_id', chat)).data.length
await pa.getByLabel('Preguntarle al asistente').uncheck()
await pa.getByLabel('Mensaje para el asistente').fill('Nota para el equipo: revisemos esto el lunes.')
await pa.getByRole('button', { name: 'Enviar' }).click()
await pb.waitForSelector('text=revisemos esto el lunes', { timeout: 20_000 }).catch(() => null)
ok((await pb.locator('text=revisemos esto el lunes').count()) > 0, 'el mensaje para el grupo llega en vivo')
const turnosDespues = (await admin.schema('asistente').from('turno').select('id').eq('chat_id', chat)).data.length
ok(turnosAntes === turnosDespues, 'el mensaje para el grupo no le pregunta al asistente (sin turno, sin gasto)')

// 5. La memoria personal no entra a un chat compartido.
await pa.getByLabel('Preguntarle al asistente').check()
await pa.getByLabel('Mensaje para el asistente').fill('¿Qué recuerdas de mí? Una línea.')
await pa.getByRole('button', { name: 'Enviar' }).click()
await esperarFin(pa, 3)
const r5 = await pa.locator('.group .prosa-chat').last().innerText()
ok(!/tamarindo/i.test(r5), `la memoria no entra al chat compartido: «${r5.slice(0, 80)}»`)

// 6. Otra cuenta, fuera del chat, no lo lee.
const cf = createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${fuera.s.access_token}` } } })
const { data: leidos } = await cf.schema('asistente').from('mensaje').select('id').eq('chat_id', chat)
ok((leidos ?? []).length === 0, 'quien no está en el chat no lee sus mensajes')

// 7. Compartir un archivo: con linaje de plazas no se comparte con quien no tiene plazas; sin linaje, sí.
const pc = await abrir(yo)
await pc.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
await pc.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
await pc.getByLabel('Mensaje para el asistente').fill('Consulta la tabla de plazas y hazme un artefacto documento con las 5 plazas con más vacantes.')
await pc.getByRole('button', { name: 'Enviar' }).click()
await esperarFin(pc, 1)
const { data: art } = await admin.schema('asistente').from('html').select('id').eq('dueno', yo.id).order('creado_en', { ascending: false }).limit(1).single()
const cy = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
await pc.locator('button:has-text("Compartir")').last().click()
await pc.getByLabel('Compartir con').selectOption(otro.id)
await pc.locator('button:has-text("Compartir")').last().click()
await pc.waitForSelector('text=/No se comparte|Compartido/', { timeout: 20_000 })
const resultado = await pc.locator('text=/No se comparte|Compartido\\./').first().innerText()
ok(/No se comparte/.test(resultado), `un artefacto con datos de plazas no se comparte con quien no tiene plazas: «${resultado.slice(0, 90)}»`)
void cy
// Sin linaje: un artefacto hecho solo con texto.
await pc.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
await pc.getByLabel('Modelo').selectOption('claude-haiku-5-5')
await pc.getByLabel('Mensaje para el asistente').fill('Haz un artefacto documento corto con tres consejos para escribir correos claros. No consultes nada de la plataforma.')
await pc.getByRole('button', { name: 'Enviar' }).click()
await esperarFin(pc, 1)
const { data: art2 } = await admin.schema('asistente').from('html').select('id').eq('dueno', yo.id).order('creado_en', { ascending: false }).limit(1).single()
await pc.locator('button:has-text("Compartir")').last().click()
await pc.getByLabel('Compartir con').selectOption(otro.id)
await pc.locator('button:has-text("Compartir")').last().click()
await pc.waitForSelector('text=/No se comparte|Compartido\\./', { timeout: 20_000 })
ok((await pc.locator('text=Compartido.').count()) > 0, 'sin datos de la plataforma, se comparte')
await pb.goto(`${BASE}/sistema/asistente/archivos`, { waitUntil: 'networkidle' })
ok((await pb.locator('text=Compartido conmigo').count()) > 0, 'el invitado lo ve en «Compartido conmigo»')
const r = await pb.request.get(`${BASE}/sistema/asistente/html/${art2.id}?crudo=1`)
ok(r.status() === 200, `el invitado abre el artefacto compartido (${r.status()})`)
const r2 = await pb.request.get(`${BASE}/sistema/asistente/html/${art.id}?crudo=1`)
ok(r2.status() === 404, `pero no el que no se compartió (${r2.status()})`)
await pb.screenshot({ path: 'capturas/asistente/f4-compartido.png' })

await nav.close()
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
