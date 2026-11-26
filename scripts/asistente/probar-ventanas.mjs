/**
 * Asistente de IA · el tope del día en ventanas de 5 horas (26-nov-2026), contra PRUEBAS (dev :3005).
 * El gasto previo se siembra con turnos falsos (sin llamar al modelo); el turno que se prueba, sí es real.
 *
 *   node --env-file=.env.local scripts/asistente/probar-ventanas.mjs
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
const hora = (iso) => {
  const d = new Date(Date.parse(iso) - 4 * 3_600_000)
  const h = d.getUTCHours()
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// Una cuenta propia, con un tope chico: US$ 1 al día en 2 ventanas → US$ 0,50 por ventana.
const email = 'ventanas.pruebas@plataforma.local'
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 500 })
let u = lista.users.find((x) => x.email === email)
if (!u) u = (await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nombre_completo: 'Ventanas de pruebas', rol_clave: 'consultor', organizacion: 'boosty' } })).data.user
const { data: rol } = await admin.from('roles').select('id').eq('clave', 'consultor').single()
await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: 'Ventanas de pruebas' }).eq('id', u.id)
await A.from('chat').delete().eq('dueno', u.id)
await A.from('politica_usuario').upsert({ perfil_id: u.id, habilitado: true, tope_diario_usd: 1, tope_mensual_usd: 20, ventanas_por_dia: 2, nota: 'probar-ventanas' })
const chatFalso = crypto.randomUUID()
await A.from('chat').insert({ id: chatFalso, dueno: u.id, titulo: 'Gasto sembrado' })
const sembrar = (minutos, costo, extra = {}) =>
  A.from('turno').insert({ chat_id: chatFalso, solicitante: u.id, motor: 'anthropic', modelo: 'claude-sonnet-5-5', esfuerzo: 'medium', estado: 'listo', costo_usd: costo, creado_en: new Date(Date.now() - minutos * 60_000).toISOString(), ...extra }).select('id').single()
const pol = async () => (await A.rpc('politica_de', { p_perfil: u.id })).data

const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
const n = `sb-${ref}-auth-token`
const partes = valor.length <= 3180 ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / 3180) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * 3180, (i + 1) * 3180) }))
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addCookies(partes.map((x) => ({ ...x, domain: 'localhost', path: '/' })))
const p = await ctx.newPage()
const enviar = async (texto, modelo) => {
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await p.getByLabel('Modelo').selectOption(modelo)
  await p.getByLabel('Mensaje para el asistente').fill(texto)
  const desde = new Date().toISOString()
  await p.getByRole('button', { name: 'Enviar' }).click()
  // El turno de esta persona pedido ahora, cuando termina (listo o fallido).
  for (let i = 0; i < 90; i++) {
    const { data } = await A.from('turno').select('estado, error, costo_usd').eq('solicitante', u.id).gte('creado_en', desde).order('creado_en', { ascending: false }).limit(1).maybeSingle()
    if (data && !['en_cola', 'corriendo'].includes(data.estado)) {
      await p.waitForTimeout(1500)
      return data
    }
    await p.waitForTimeout(1000)
  }
  return { estado: 'sin_turno', error: null, costo_usd: 0 }
}

try {
  let x = await pol()
  ok(Number(x.tope_ventana_usd) === 0.5 && x.ventana_renueva === null, `sin uso: ventana de US$ ${x.tope_ventana_usd} que todavía no arranca`)

  // Una hora atrás gastó US$ 0,48: la ventana arrancó entonces y se renueva en 4 horas.
  await sembrar(60, 0.48)
  x = await pol()
  const esperada = new Date(Date.now() + 4 * 3_600_000).toISOString()
  ok(Math.abs(Date.parse(x.ventana_renueva) - Date.parse(esperada)) < 120_000, `la ventana arrancó con el primer mensaje y se renueva 5 h después (${hora(x.ventana_renueva)})`)
  ok(Number(x.gastado_ventana_usd) === 0.48, `lleva US$ ${x.gastado_ventana_usd} de la ventana`)
  // Lo programado no gasta ventana.
  const { data: tarea } = await A.from('tarea').insert({ dueno: u.id, nombre: 'Sembrada', instruccion: 'Di hola.', frecuencia: 'diaria', hora: '08:00', canales: ['plataforma'] }).select('id').single()
  const { data: corrida } = await A.from('corrida').insert({ tarea_id: tarea.id, dueno: u.id, programada_para: new Date().toISOString(), estado: 'lista' }).select('id').single()
  await sembrar(30, 0.2, { corrida_id: corrida.id })
  x = await pol()
  ok(Number(x.gastado_ventana_usd) === 0.48 && Number(x.gastado_dia_usd) >= 0.68, `una tarea programada cuenta para el día (US$ ${x.gastado_dia_usd}) pero no para la ventana`)

  // Un turno que no cabe en lo que queda de la ventana: se rechaza con la hora de renovación.
  const r1 = await enviar('Hola, una línea.', 'claude-sonnet-5-5')
  ok(r1.estado === 'fallido' && /ventana de 5 horas/.test(r1.error) && r1.error.includes(hora(x.ventana_renueva)), `con la ventana casi llena, no deja pasar y dice cuándo se renueva: «${r1.error}»`)
  await p.waitForSelector('text=/ventana de 5 horas/', { timeout: 15_000 }).catch(() => null)
  ok((await p.locator('text=/ventana de 5 horas/').count()) > 0, 'el chat muestra el aviso')
  const medidor = await p.locator('[data-uso]').innerText()
  ok(/Esta ventana de 5 h/.test(medidor) && /% usado/.test(medidor) && /Se renueva a las/.test(medidor) && !/US\$/.test(medidor), `la persona ve el % y la hora de renovación, sin dólares («${medidor.replace(/\n/g, ' · ')}»)`)
  await p.screenshot({ path: 'capturas/asistente/ventanas-llena.png' })
  // Uno liviano sí cabe.
  const r2 = await enviar('Hola, responde solo «hola».', 'claude-haiku-5-5')
  ok(r2.estado === 'listo', `un modelo liviano sí cabe en lo que queda (US$ ${Number(r2.costo_usd).toFixed(4)})`)

  // Pasadas las 5 horas, la ventana se renueva completa.
  await A.from('turno').update({ creado_en: new Date(Date.now() - 6 * 3_600_000).toISOString() }).eq('chat_id', chatFalso).is('corrida_id', null)
  const { data: chats } = await A.from('chat').select('id').eq('dueno', u.id).neq('id', chatFalso)
  await A.from('turno').update({ creado_en: new Date(Date.now() - 6 * 3_600_000).toISOString() }).in('chat_id', (chats ?? []).map((c) => c.id))
  x = await pol()
  ok(x.ventana_renueva === null && Number(x.gastado_ventana_usd) === 0, 'pasadas 5 horas desde que arrancó, la ventana se renueva completa')
  const r3 = await enviar('Hola, responde solo «hola».', 'claude-sonnet-5-5')
  ok(r3.estado === 'listo', 'y el turno que antes no cabía, ahora pasa')
  x = await pol()
  ok(x.ventana_renueva && Date.parse(x.ventana_renueva) - Date.now() > 4.9 * 3_600_000, `el primer mensaje abre la ventana nueva (se renueva a las ${hora(x.ventana_renueva)})`)
  await p.reload({ waitUntil: 'networkidle' })
  await p.screenshot({ path: 'capturas/asistente/ventanas-nueva.png' })
} finally {
  await A.from('chat').delete().eq('dueno', u.id)
  await A.from('tarea').delete().eq('dueno', u.id)
  await A.from('politica_usuario').delete().eq('perfil_id', u.id)
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
