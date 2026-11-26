/**
 * La «Guía» del asistente y la ventana flotante (26-nov-2026), contra el PROYECTO DE PRUEBAS (dev :3005):
 * - la guía dice lo de cada quien (administración contra un usuario con un rol limitado);
 * - «Abrir en ventana» deja el chat abierto mientras se navega, dice qué pantalla se está viendo y el asistente
 *   responde sobre esa pantalla; minimizar y volver.
 *
 *   node --env-file=.env.local scripts/asistente/probar-guia-ventana.mjs
 *
 * Gasta centavos (un turno con Haiku). Capturas en capturas/asistente/.
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
mkdirSync('capturas/asistente', { recursive: true })
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}
async function sesion(email) {
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  return { s: ver.session, id: ver.user.id }
}
const cookies = (s) => {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64url')
  const L = 3180
  const n = `sb-${ref}-auth-token`
  const partes = valor.length <= L ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: 'localhost', path: '/' }))
}
const nav = await chromium.launch()
const abrir = async (email) => {
  const q = await sesion(email)
  const c = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await c.addCookies(cookies(q.s))
  const p = await c.newPage()
  p.errores = []
  p.on('pageerror', (e) => p.errores.push(e.message))
  p.yo = q.id
  return p
}

try {
  // 1) La guía de la administración.
  const pa = await abrir('admin.pruebas@plataforma.local')
  await pa.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await pa.locator('[data-boton-guia]').click()
  const guia = pa.locator('[data-guia]')
  await guia.waitFor()
  const tGuia = await guia.innerText()
  ok(/Tus modelos/.test(tGuia) && /ventanas de 5 horas/.test(tGuia) && /Lo que nunca hace/.test(tGuia), 'la guía abre con sus secciones (modelos, cupo en ventanas, lo que nunca hace)')
  ok(/Consulta, con tus mismos permisos/.test(tGuia), 'a la administración le dice qué datos de la plataforma consulta')
  await pa.screenshot({ path: 'capturas/asistente/guia-admin.png' })
  await pa.keyboard.press('Escape')

  // 2) La guía de otra cuenta con otro rol (consultoría): dice otra cosa.
  const pu = await abrir('consultor.pruebas@plataforma.local').catch(() => null)
  if (pu) {
    await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
    if (await pu.locator('[data-boton-guia]').count()) {
      await pu.locator('[data-boton-guia]').click()
      await pu.locator('[data-guia]').waitFor()
      const tU = await pu.locator('[data-guia]').innerText()
      ok(tU !== tGuia, 'la guía de un usuario con otro rol dice otra cosa (sale de su política y su alcance)')
      await pu.screenshot({ path: 'capturas/asistente/guia-usuario.png' })
    } else ok(false, 'la cuenta de consultoría no tiene el asistente')
  }

  // 3) La ventana flotante, navegando.
  await pa.locator('[data-abrir-ventana]').click()
  const ventana = pa.locator('[data-panel-asistente][data-modo=ventana]')
  await ventana.getByLabel('Mensaje para el asistente').waitFor({ timeout: 30_000 })
  ok(true, '«Abrir en ventana» abre el chat flotante')
  // Navegar por el menú (sin recargar): la ventana sigue y sabe dónde está.
  await pa.locator('a[href^="/sistema/nucleo"]:visible').first().click()
  await pa.waitForURL(/\/sistema\/nucleo/)
  await pa.waitForTimeout(1500)
  ok(await ventana.isVisible(), 'la ventana sigue abierta al navegar a otro módulo')
  const viendo = await ventana.locator('[data-desde]').innerText()
  ok(/\/sistema\/nucleo/.test(viendo), `la ventana dice qué pantalla se está viendo («${viendo.slice(0, 90)}»)`)
  await ventana.getByLabel('Modelo').selectOption('claude-haiku-5-5')
  await ventana.getByLabel('Mensaje para el asistente').fill('¿En qué pantalla de la plataforma estoy ahora? Responde solo con la ruta.')
  const desde = new Date().toISOString()
  await ventana.getByRole('button', { name: 'Enviar' }).click()
  const A = admin.schema('asistente')
  let turno = null
  for (let i = 0; i < 100 && !turno; i++) {
    const { data: t } = await A.from('turno').select('id, estado').eq('solicitante', pa.yo).gte('creado_en', desde).order('creado_en', { ascending: false }).limit(1).maybeSingle()
    if (t && !['en_cola', 'corriendo'].includes(t.estado)) turno = t
    else await pa.waitForTimeout(1500)
  }
  const { data: m } = turno ? await A.from('mensaje').select('texto').eq('turno_id', turno.id).eq('rol', 'asistente').maybeSingle() : { data: null }
  ok(/\/sistema\/nucleo/i.test(m?.texto ?? ''), `el asistente sabe en qué pantalla está la persona («${(m?.texto ?? '').slice(0, 80)}»)`)
  await pa.waitForTimeout(2000)
  await pa.screenshot({ path: 'capturas/asistente/ventana-flotante.png' })
  await ventana.getByLabel('Minimizar el asistente').click()
  await pa.locator('[data-ventana-minimizada]').waitFor()
  ok(!(await ventana.isVisible()), 'se minimiza a un botón')
  await pa.locator('[data-ventana-minimizada]').click()
  ok(await ventana.isVisible(), 'y vuelve con la conversación')
  ok(pa.errores.length === 0 && (!pu || pu.errores.length === 0), `sin errores de página${pa.errores[0] ? `: ${pa.errores[0].slice(0, 140)}` : ''}`)
} finally {
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
