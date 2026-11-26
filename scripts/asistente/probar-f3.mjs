/**
 * Asistente de IA · fase 3: proyectos, memoria, atajos «/» y dictado, en el
 * navegador contra el PROYECTO DE PRUEBAS (dev :3005). El dictado usa un
 * micrófono falso de Chromium que «dice» un WAV sintetizado con Azure (la misma
 * voz del curso), así que pasa por la grabación, el WAV de 16 kHz y la
 * transcripción reales.
 *
 *   node --env-file=.env.local scripts/asistente/probar-f3.mjs [--solo proyecto|memoria|atajos|voz]
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
const opc = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d)
const BASE = opc('--base', 'http://localhost:3005')
const SOLO = opc('--solo', null)
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

const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'admin.pruebas@plataforma.local' })
const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const yo = ver.user.id
function cookies(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
}

await mkdir('capturas/asistente', { recursive: true })

// El WAV que «dice» el micrófono falso (Azure TTS, 16 kHz mono).
const wav = resolve('capturas/asistente/_dictado.wav')
if (!SOLO || SOLO === 'voz') {
  const r = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm' },
    body: `<speak version="1.0" xml:lang="es-VE"><voice name="es-VE-PaolaNeural"><break time="700ms"/>Hola asistente, ¿cuántas plazas vacantes hay en la empresa?<break time="1500ms"/></voice></speak>`,
  })
  await writeFile(wav, Buffer.from(await r.arrayBuffer()))
}

const nav = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] })
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'] })
await ctx.addCookies(cookies(ver.session))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(String(e)))

async function enviarYEsperar(texto) {
  await p.getByLabel('Mensaje para el asistente').fill(texto)
  await p.getByRole('button', { name: 'Enviar' }).click()
  const antes = await p.locator('[aria-label="Copiar la respuesta"]').count()
  await p.waitForFunction((n) => !document.querySelector('[aria-live=polite]') && document.querySelectorAll('[aria-label="Copiar la respuesta"]').length > n, antes, { timeout: 300_000 })
  return p.locator('.group .prosa-chat').last().innerText()
}

if (!SOLO || SOLO === 'proyecto') {
  await admin.schema('asistente').from('proyecto').delete().eq('dueno', yo).eq('nombre', 'Proyecto de prueba F3')
  await p.goto(`${BASE}/sistema/asistente/proyectos`, { waitUntil: 'networkidle' })
  await p.getByLabel('Nombre del proyecto').fill('Proyecto de prueba F3')
  await p.getByRole('button', { name: 'Crear proyecto' }).click()
  await p.waitForURL(/\/sistema\/asistente\/proyectos\/[0-9a-f-]{36}$/, { timeout: 30_000 })
  await p.locator('#p-instr').fill('Termina SIEMPRE tu respuesta con la palabra CAMBUR en mayúsculas, sola en la última línea.')
  await p.getByRole('button', { name: 'Guardar', exact: true }).click()
  await p.waitForSelector('text=Guardado.', { timeout: 15_000 })
  await p.getByRole('link', { name: 'Nuevo chat en este proyecto' }).click()
  await p.waitForURL(/proyecto=/)
  await p.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
  await p.getByLabel('Esfuerzo').selectOption('low')
  const r = await enviarYEsperar('¿Qué es un proceso de compras? Una línea.')
  ok(/CAMBUR\s*$/.test(r.trim()), `el chat del proyecto aplica sus instrucciones: «…${r.trim().slice(-40)}»`)
  const chat = p.url().split('/c/')[1]
  const { data: c } = await admin.schema('asistente').from('chat').select('proyecto_id').eq('id', chat).single()
  ok(!!c?.proyecto_id, 'el chat quedó dentro del proyecto')
  await p.screenshot({ path: 'capturas/asistente/f3-proyecto.png' })
}

if (!SOLO || SOLO === 'memoria') {
  await admin.schema('asistente').from('memoria').delete().eq('dueno', yo)
  await admin.schema('asistente').from('preferencia').upsert({ perfil_id: yo, memoria: true })
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await p.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
  await enviarYEsperar('Recuerda que trabajo en el área de Compras de la planta de Cagua.')
  const { data: m1 } = await admin.schema('asistente').from('memoria').select('id, texto').eq('dueno', yo)
  ok((m1 ?? []).some((m) => /compras/i.test(m.texto)), `guardó el recuerdo: ${(m1 ?? []).map((m) => `«${m.texto}»`).join(', ') || 'nada'}`)
  ok((await p.locator('text=Guardé en tu memoria').count()) > 0, 'el chat muestra «Guardé en tu memoria» con Deshacer')
  await p.screenshot({ path: 'capturas/asistente/f3-memoria.png' })
  // Un chat nuevo lo sabe.
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await p.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
  const r = await enviarYEsperar('¿En qué área trabajo? Responde en una frase.')
  ok(/compras/i.test(r), `un chat nuevo usa la memoria: «${r.trim().slice(0, 80)}»`)
  // Un dato personal no se guarda.
  await enviarYEsperar('Recuerda que mi cédula es V-12345678 y mi teléfono 0414-555-1234.')
  const { data: m2 } = await admin.schema('asistente').from('memoria').select('texto').eq('dueno', yo)
  ok(!(m2 ?? []).some((m) => /12345678|555/.test(m.texto)), 'no guarda cédula ni teléfono')
  // Deshacer desde el chat.
  await p.goto(`${BASE}/sistema/asistente/memoria`, { waitUntil: 'networkidle' })
  const antes = await p.locator('button:has-text("Olvidar")').count()
  if (antes) {
    await p.locator('button:has-text("Olvidar")').first().click()
    await p.waitForFunction((n) => document.querySelectorAll('button').length && [...document.querySelectorAll('button')].filter((b) => b.textContent === 'Olvidar').length < n, antes, { timeout: 15_000 })
  }
  ok(antes > 0, `Mi memoria lista y olvida (${antes} → ${await p.locator('button:has-text("Olvidar")').count()})`)
}

if (!SOLO || SOLO === 'atajos') {
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await p.getByLabel('Mensaje para el asistente').fill('/act')
  const opciones = await p.locator('[aria-label="Atajos"] [role=option]').count()
  ok(opciones > 0, `«/act» abre el menú de atajos (${opciones})`)
  await p.getByLabel('Mensaje para el asistente').press('Enter')
  const texto = await p.getByLabel('Mensaje para el asistente').inputValue()
  ok(texto.startsWith('Con estas notas'), `Enter usa el atajo: «${texto.slice(0, 40)}…»`)
  await p.screenshot({ path: 'capturas/asistente/f3-atajos.png' })
}

if (!SOLO || SOLO === 'voz') {
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: 'Dictar' }).click()
  await p.waitForTimeout(4500)
  await p.getByRole('button', { name: 'Detener el dictado' }).click()
  await p.waitForFunction(() => (document.querySelector('[aria-label="Mensaje para el asistente"]')?.value ?? '').length > 5, null, { timeout: 60_000 }).catch(() => null)
  const texto = await p.getByLabel('Mensaje para el asistente').inputValue()
  ok(/plazas|vacantes/i.test(texto), `el dictado llega a la caja para revisarlo: «${texto}»`)
}

ok(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores.slice(0, 2).join(' | ')}` : ''}`)
await nav.close()
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
