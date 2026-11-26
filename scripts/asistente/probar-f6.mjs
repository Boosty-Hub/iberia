/**
 * Asistente de IA · fase 6: el motor local, contra el PROYECTO DE PRUEBAS (dev :3005).
 *
 * Sin servidor de modelos de Iberia todavía, el «servidor local» de la prueba es el
 * endpoint compatible de OpenAI (Chat Completions): valida el protocolo entero
 * (streaming, herramientas, archivos por Anthropic). El dev de pruebas tiene que
 * correr con ASISTENTE_LOCAL_CLAVE (ver la cabecera de probar-f5.mjs para el resto).
 *
 *   node --env-file=.env.local scripts/asistente/probar-f6.mjs [--url https://api.openai.com/v1] [--modelo gpt-4.1-mini]
 *
 * Deja todo como estaba: motor Anthropic, sin servidor local y sin el modelo de prueba.
 */
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const opc = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const URL_LOCAL = opc('--url', 'https://api.openai.com/v1')
const MODELO_API = opc('--modelo', 'gpt-4.1-mini')
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const A = admin.schema('asistente')
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'admin.pruebas@plataforma.local' })
const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
const n = `sb-${ref}-auth-token`
const partes = valor.length <= 3180 ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / 3180) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * 3180, (i + 1) * 3180) }))

const { data: antes } = await A.from('config').select('motor, local_url, local_modo').eq('id', true).single()
const nav = await chromium.launch()
const c = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await c.addCookies(partes.map((x) => ({ ...x, domain: 'localhost', path: '/' })))
const p = await c.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(e.message))
const esperarFin = async (k) => {
  await p.waitForTimeout(1500)
  await p.waitForFunction((k) => !document.querySelector('[aria-live=polite]') && (document.querySelectorAll('[aria-label="Copiar la respuesta"]').length >= k || !!document.querySelector('button:not([disabled])') && /Reintentar/.test(document.body.innerText)), k, { timeout: 240_000 })
}
const ultimoTurno = async (chat) => (await A.from('turno').select('id, motor, modelo, estado, error, costo_usd').eq('chat_id', chat).order('creado_en', { ascending: false }).limit(1).single()).data
const enviar = async (texto) => {
  await p.getByLabel('Mensaje para el asistente').fill(texto)
  // Con un adjunto subiendo, «Enviar» espera: se hace clic cuando se habilita.
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim().endsWith('Enviar') && !b.disabled), null, { timeout: 60_000 })
  await p.getByRole('button', { name: 'Enviar' }).click()
}

try {
  // 1. La administración configura el servidor, lo prueba, agrega un modelo y enciende el motor.
  await p.goto(`${BASE}/sistema/administracion/asistente/motor`, { waitUntil: 'networkidle' })
  ok(await p.locator('input[name=motor]').nth(2).isDisabled(), 'sin servidor, el motor local no se puede elegir')
  await p.locator('#local-url').fill(URL_LOCAL)
  await p.getByRole('button', { name: 'Probar conexión' }).click()
  await p.waitForSelector('text=/Responde|No se alcanza|respondió/', { timeout: 20_000 })
  const prueba = await p.locator('text=/Responde|No se alcanza|respondió/').first().innerText()
  ok(/^Responde/.test(prueba), `«Probar conexión» lista los modelos del servidor (${prueba.slice(0, 70)}…)`)
  await p.locator('section[aria-labelledby=motor-local]').getByRole('button', { name: 'Guardar' }).click()
  await p.waitForTimeout(1500)
  await p.locator('#ml-id').fill('local-prueba')
  await p.locator('#ml-nombre').fill('Modelo local (prueba)')
  await p.locator('#ml-api').fill(MODELO_API)
  await p.locator('#ml-pe').fill('0.2')
  await p.locator('#ml-ps').fill('0.8')
  await p.getByRole('button', { name: 'Agregar modelo' }).click()
  await p.waitForTimeout(2000)
  await p.reload({ waitUntil: 'networkidle' })
  await p.locator('input[name=motor]').nth(2).check()
  await p.getByRole('button', { name: 'Guardar cambios' }).click()
  await p.waitForTimeout(2000)
  const { data: cfg } = await A.from('config').select('motor, local_url').eq('id', true).single()
  ok(cfg.motor === 'local' && cfg.local_url === URL_LOCAL, `el motor local queda activo (${cfg.motor})`)
  await p.screenshot({ path: 'capturas/asistente/f6-admin.png', fullPage: true })

  // 2. El chat con el motor local: dice lo que no puede y conversa.
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const pie = await p.locator('[data-motor-local]').innerText()
  ok(/internet/.test(pie) && /investigación profunda/.test(pie) && /datos de la plataforma/.test(pie), `el chat dice lo que el motor local no trae: «${pie}»`)
  ok(await p.getByRole('button', { name: /Investigación/ }).isDisabled(), 'la investigación profunda sale apagada')
  ok((await p.getByLabel('Modelo').inputValue()) === 'local-prueba', 'el modelo es el local')
  await enviar('Hola. Responde en una sola línea: ¿qué día es hoy?')
  await esperarFin(1)
  const chat = p.url().split('/c/')[1]
  const t1 = await ultimoTurno(chat)
  ok(t1.motor === 'local' && t1.estado === 'listo' && Number(t1.costo_usd) > 0, `conversa por el motor local (${t1.estado}, US$ ${Number(t1.costo_usd).toFixed(5)})`)

  // 3. Herramientas apagadas: no consulta la plataforma. Encendidas: sí.
  await enviar('¿Cuántas plazas vacantes hay en la plataforma? Si no tienes acceso, dilo en una línea.')
  await esperarFin(2)
  const t2 = await ultimoTurno(chat)
  const { count: q2 } = await A.from('consulta_fuente').select('id', { count: 'exact', head: true }).eq('turno_id', t2.id)
  ok(q2 === 0, 'con las herramientas apagadas no consulta la plataforma')
  await A.from('capacidad_motor').update({ disponible: true }).eq('motor', 'local').eq('capacidad', 'herramientas')
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await enviar('Consulta la métrica de vacantes de la plataforma y dime el número en una línea, con la fuente.')
  await esperarFin(1)
  const chat2 = p.url().split('/c/')[1]
  const t3 = await ultimoTurno(chat2)
  const { data: q3 } = await A.from('consulta_fuente').select('fuente').eq('turno_id', t3.id)
  ok(t3.estado === 'listo' && (q3 ?? []).length > 0, `encendidas, el modelo local usa las herramientas (${(q3 ?? []).map((x) => x.fuente).join(', ')})`)

  // 4. Artefacto.
  await enviar('Haz un artefacto documento corto con tres consejos para escribir correos claros.')
  await esperarFin(2)
  const { count: arts } = await A.from('html').select('id', { count: 'exact', head: true }).eq('chat_id', chat2)
  ok(arts >= 1, 'crea artefactos con el motor local')

  // 5. Híbrido: un archivo lo procesa Anthropic.
  writeFileSync('capturas/asistente/numeros.csv', 'n\n1\n2\n3\n')
  await p.locator('input[type=file]').setInputFiles('capturas/asistente/numeros.csv')
  await p.waitForSelector('text=numeros.csv', { timeout: 30_000 })
  await p.waitForTimeout(1500)
  await enviar('Suma la columna n del archivo adjunto y dime el total en una línea.')
  await esperarFin(3)
  const t5 = await ultimoTurno(chat2)
  const { data: m5 } = await A.from('mensaje').select('texto, bloques').eq('turno_id', t5.id).eq('rol', 'asistente').single()
  ok(t5.estado === 'listo' && /\b6\b/.test(m5.texto) && m5.bloques.some((b) => b.tipo === 'paso' && b.herramienta === 'archivo'), `en modo híbrido el archivo lo procesa Anthropic: «${m5.texto.slice(0, 80)}»`)
  await p.screenshot({ path: 'capturas/asistente/f6-chat.png' })

  // 6. Todo adentro: sin archivos.
  await A.from('config').update({ local_modo: 'adentro' }).eq('id', true)
  const { data: caps } = await admin.schema('asistente').rpc('capacidades', {})
  ok(caps.find((x) => x.capacidad === 'archivos')?.disponible === false, 'en modo todo adentro, archivos sale apagado con su motivo')
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  ok(await p.locator('input[type=file]').isDisabled(), 'y el chat no deja adjuntar')

  // 7. El servidor no responde: un mensaje claro.
  await A.from('config').update({ local_url: 'http://127.0.0.1:9/v1', local_modo: 'hibrido' }).eq('id', true)
  await enviar('Hola')
  await p.waitForSelector('text=/No se alcanza el servidor de modelos/', { timeout: 60_000 }).catch(() => null)
  ok((await p.locator('text=/No se alcanza el servidor de modelos/').count()) > 0, 'si el servidor no responde, el chat lo dice claro')
  ok(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores[0].slice(0, 120)}` : ''}`)
} finally {
  await A.from('config').update({ motor: antes.motor === 'local' ? 'anthropic' : antes.motor, local_url: antes.local_url, local_modo: antes.local_modo }).eq('id', true)
  await A.from('capacidad_motor').update({ disponible: false }).eq('motor', 'local').eq('capacidad', 'herramientas')
  await A.from('modelo').delete().eq('id', 'local-prueba')
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
