/**
 * Al llegar al tope (26-nov-2026, pedido de Gabriel), contra el PROYECTO DE PRUEBAS (dev :3005), con sesión real:
 * - el chat se cierra para escribir y dice cuándo se renueva (no se pueden mandar mensajes que quedan sin respuesta);
 * - queda anotado para avisar (`asistente.aviso_renovacion`);
 * - al renovarse la ventana, sale el aviso flotante y la caja se vuelve a abrir;
 * - el reloj del programador deja el aviso en la campana.
 * Siembra el gasto (no llama a ningún modelo) y lo borra al final.
 *
 *   node --env-file=.env.local scripts/asistente/probar-cupo.mjs
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const A = admin.schema('asistente')
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

const email = 'ventanas.pruebas@plataforma.local'
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 })
const u = lista.users.find((x) => x.email === email)
if (!u) throw new Error(`Falta ${email} (la crea probar-ventanas.mjs)`)
// Tope diario de US$ 0,04 en 2 ventanas: cada ventana, US$ 0,02 (lo que reserva Haiku, el más liviano).
await A.from('politica_usuario').upsert({ perfil_id: u.id, habilitado: true, tope_diario_usd: 0.04, tope_mensual_usd: 20, ventanas_por_dia: 2, nota: 'probar-cupo' })
await A.from('aviso_renovacion').delete().eq('perfil_id', u.id)
const chatFalso = crypto.randomUUID()
await A.from('chat').insert({ id: chatFalso, dueno: u.id, titulo: 'Gasto sembrado (cupo)' })
// La ventana arrancó hace 5 h menos 25 s: se renueva en 25 s. Y ya gastó todo lo de la ventana.
const arranque = new Date(Date.now() - 5 * 3_600_000 + 25_000).toISOString()
await A.from('turno').insert({ chat_id: chatFalso, solicitante: u.id, motor: 'anthropic', modelo: 'claude-haiku-5-5', esfuerzo: 'medium', estado: 'listo', costo_usd: 0.02, creado_en: arranque })

const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
const L = 3180
const n = `sb-${ref}-auth-token`
const cookies = (valor.length <= L ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))).map((p) => ({ ...p, domain: 'localhost', path: '/' }))

const nav = await chromium.launch()
try {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const aviso = p.locator('[data-cupo=bloqueado]')
  await aviso.waitFor({ timeout: 20_000 }).catch(() => undefined)
  ok(await aviso.isVisible(), `al llegar al tope, el chat lo dice («${(await aviso.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90)}»)`)
  ok(await p.getByLabel('Mensaje para el asistente').isDisabled(), 'y la caja para escribir queda cerrada')
  ok(await p.getByRole('button', { name: 'Enviar' }).isDisabled(), 'y «Enviar» también')
  await p.screenshot({ path: 'capturas/asistente/cupo-cerrado.png' })
  const { data: anotado } = await A.from('aviso_renovacion').select('motivo, renueva').eq('perfil_id', u.id).maybeSingle()
  ok(anotado?.motivo === 'ventana', `queda anotado para avisar (${anotado?.motivo} · ${anotado?.renueva})`)

  // A los ~25 s se renueva la ventana: aviso flotante y la caja se abre.
  await p.locator('[data-cupo-renovado]').waitFor({ timeout: 60_000 }).catch(() => undefined)
  ok(await p.locator('[data-cupo-renovado]').isVisible(), `al renovarse, sale el aviso flotante («${(await p.locator('[data-cupo-renovado]').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 80)}»)`)
  await p.screenshot({ path: 'capturas/asistente/cupo-renovado.png' })
  ok(!(await p.getByLabel('Mensaje para el asistente').isDisabled()) && !(await p.locator('[data-cupo=bloqueado]').isVisible()), 'y la caja se vuelve a abrir')

  // El reloj del programador: el aviso en la campana.
  const desde = new Date().toISOString()
  const r = await fetch(`${BASE}/api/asistente/programador`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': process.env.ASISTENTE_SECRETO }, body: JSON.stringify({ accion: 'tick' }) })
  const j = await r.json().catch(() => ({}))
  const { data: notis } = await admin.schema('nucleo').from('notificacion').select('id, texto').eq('destinatario', u.id).gte('creado_en', desde)
  ok((j.renovados ?? 0) >= 1 && (notis ?? []).some((x) => /se renovó/.test(x.texto)), `el reloj deja el aviso en la campana («${notis?.[0]?.texto ?? ''}»)`)
  const { data: queda } = await A.from('aviso_renovacion').select('perfil_id').eq('perfil_id', u.id)
  ok(!(queda ?? []).length, 'y avisa una sola vez')
  ok(!errores.length, `sin errores de página${errores[0] ? `: ${errores[0].slice(0, 120)}` : ''}`)
  if (notis?.length) await admin.schema('nucleo').from('notificacion').delete().in('id', notis.map((x) => x.id))
} finally {
  await A.from('chat').delete().eq('id', chatFalso)
  await A.from('turno').delete().eq('chat_id', chatFalso)
  await A.from('aviso_renovacion').delete().eq('perfil_id', u.id)
  await A.from('politica_usuario').delete().eq('perfil_id', u.id)
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
