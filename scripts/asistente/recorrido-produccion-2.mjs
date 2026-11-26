/**
 * Recorrido EN PRODUCCIÓN de lo publicado el 26-nov-2026 (segunda tanda), con las cuentas de Gabriel y por el login del
 * sitio: Mis archivos (el Storage en sus carpetas, vista previa, «/» en el chat), la «Guía», la ventana flotante, el
 * widget de soporte de Boosty (manda UN ticket de prueba, pedido de Gabriel) y lo que ve el usuario de prueba.
 * No crea carpetas ni sube archivos; gasta un turno con Haiku.
 *
 *   RECORRIDO_CLAVE=… node --env-file=.env.local scripts/asistente/recorrido-produccion-2.mjs [--sin-ticket]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'https://iberiavenezuela.netlify.app'
const CLAVE = process.env.RECORRIDO_CLAVE
if (!CLAVE) throw new Error('Falta RECORRIDO_CLAVE')
const ADMIN = 'gmontiel@spatiumgroup.com'
const USUARIO = 'andreto1206@gmail.com'
const DIR = 'capturas/recorrido-produccion-2'
mkdirSync(DIR, { recursive: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const A = db.schema('asistente')
let fallos = 0
const informe = []
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  informe.push({ ok: !!c, t })
  if (!c) fallos++
}
const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 })
const uAdmin = lista.users.find((x) => x.email === ADMIN)

const nav = await chromium.launch()
async function entrar(email) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  const p = await ctx.newPage()
  p.errores = []
  p.on('pageerror', (e) => p.errores.push(e.message))
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await p.locator('input[name=email]').fill(email)
  await p.locator('input[name=password]').fill(CLAVE)
  await p.locator('button[type=submit]').click()
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 45_000 })
  await p.waitForLoadState('networkidle')
  return p
}
let n = 0
const foto = (p, nombre) => p.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${nombre}.png` })

try {
  const pa = await entrar(ADMIN)
  // 1) Mis archivos con el Storage.
  ok((await pa.locator('a[href="/sistema/archivos"]').count()) > 0, 'Mis archivos sale en el menú')
  await pa.goto(`${BASE}/sistema/archivos`, { waitUntil: 'networkidle' })
  const raiz = await pa.locator('[data-explorador]').innerText()
  ok(['Documentos del SGC', 'Expediente del programa', 'Curso de Ajito', 'Respuestas de los trabajadores', 'Tutoriales'].every((x) => raiz.includes(x)), 'el Storage está en tus carpetas (SGC, Expediente, Curso, Respuestas, Tutoriales)')
  await foto(pa, 'mis-archivos')
  const { data: doc } = await A.from('archivo').select('nombre, carpeta_id').eq('dueno', uAdmin.id).eq('bucket', 'documentos').ilike('nombre', '%.pdf').not('nombre', 'ilike', '%0%0%0%0%').limit(1).maybeSingle()
  await pa.goto(`${BASE}/sistema/archivos?c=${doc.carpeta_id}`, { waitUntil: 'networkidle' })
  ok(/Documentos del SGC/.test(await pa.locator('nav[aria-label="Migas"]').innerText()), 'un documento vive en su carpeta de origen, con migas hasta Documentos del SGC')
  await pa.locator('[data-explorador] tbody button', { hasText: doc.nombre }).first().click()
  const visor = pa.getByRole('dialog', { name: /Vista previa/ })
  await visor.locator('canvas').first().waitFor({ timeout: 40_000 }).catch(() => undefined)
  ok((await visor.locator('canvas').count()) > 0, `vista previa de un documento del SGC («${doc.nombre}»)`)
  await foto(pa, 'vista-previa')
  await pa.keyboard.press('Escape')

  // 2) La Guía y el «/» en el chat.
  await pa.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await pa.locator('[data-boton-guia]').click()
  const guia = await pa.locator('[data-guia]').innerText()
  ok(/Tus modelos/.test(guia) && /ventanas de 5 horas/.test(guia), 'la Guía abre con tu alcance')
  await foto(pa, 'guia')
  await pa.keyboard.press('Escape')
  await pa.getByLabel('Mensaje para el asistente').fill('/Manual')
  await pa.locator('[data-menu-biblioteca]').waitFor({ timeout: 20_000 }).catch(() => undefined)
  ok((await pa.locator('[data-menu-biblioteca] button').count()) > 0, '«/» en el chat busca en tus archivos')
  await foto(pa, 'barra-biblioteca')
  await pa.getByLabel('Mensaje para el asistente').fill('')

  // 3) La ventana flotante, navegando.
  await pa.locator('[data-abrir-ventana]').click()
  const ventana = pa.locator('[data-panel-asistente][data-modo=ventana]')
  await ventana.getByLabel('Mensaje para el asistente').waitFor({ timeout: 30_000 })
  await pa.locator('a[href^="/sistema/nucleo"]:visible').first().click()
  await pa.waitForURL(/\/sistema\/nucleo/)
  await pa.waitForTimeout(1500)
  ok(await ventana.isVisible(), 'la ventana sigue abierta al navegar')
  await ventana.getByLabel('Modelo').selectOption('claude-haiku-5-5')
  await ventana.getByLabel('Mensaje para el asistente').fill('¿En qué pantalla de la plataforma estoy? Responde solo con la ruta.')
  const desde = new Date().toISOString()
  await ventana.getByRole('button', { name: 'Enviar' }).click()
  let turno = null
  for (let i = 0; i < 80 && !turno; i++) {
    const { data: t } = await A.from('turno').select('id, estado').eq('solicitante', uAdmin.id).gte('creado_en', desde).order('creado_en', { ascending: false }).limit(1).maybeSingle()
    if (t && !['en_cola', 'corriendo'].includes(t.estado)) turno = t
    else await pa.waitForTimeout(1500)
  }
  const { data: m } = turno ? await A.from('mensaje').select('texto').eq('turno_id', turno.id).eq('rol', 'asistente').maybeSingle() : { data: null }
  ok(/\/sistema\/nucleo/i.test(m?.texto ?? ''), `en la ventana, el asistente sabe en qué pantalla estás («${(m?.texto ?? '').slice(0, 60)}»)`)
  await pa.waitForTimeout(1500)
  await foto(pa, 'ventana')
  await ventana.getByLabel('Cerrar el asistente').click()

  // 4) El widget de soporte: en la barra, antes del menú de la persona, con su nombre y correo.
  const ticket = pa.locator('#soporte-boosty')
  await ticket.locator('button, [role=button]').first().waitFor({ timeout: 20_000 }).catch(() => undefined)
  const orden = await pa.evaluate(() => {
    const s = document.getElementById('soporte-boosty')
    const persona = [...document.querySelectorAll('header button')].find((b) => /Menú de|cuenta|perfil/i.test(b.getAttribute('aria-label') || '') || /^[A-ZÁÉÍÓÚ]{2}$/.test((b.textContent || '').trim()))
    return { hay: !!s?.childElementCount, antes: !!(s && persona && s.compareDocumentPosition(persona) & Node.DOCUMENT_POSITION_FOLLOWING) }
  })
  ok(orden.hay && orden.antes, 'el botón «Ticket» sale en la barra, antes del menú de la persona')
  await foto(pa, 'widget')
  if (!process.argv.includes('--sin-ticket')) {
    await ticket.getByText('Ticket', { exact: false }).first().click()
    await pa.locator('#bw-asunto').waitFor({ timeout: 15_000 })
    const nombre = await pa.locator('#bw-nombre').inputValue().catch(() => '')
    const correo = await pa.locator('#bw-email').inputValue().catch(() => '')
    ok(correo === ADMIN || !(await pa.locator('#bw-email').isVisible().catch(() => false)), `el popup trae tu nombre y correo («${nombre}», «${correo}»)`)
    await pa.locator('#bw-asunto').fill('Prueba de integración del widget · Plataforma Iberia')
    await pa.locator('#bw-desc').fill('Ticket de prueba enviado por la verificación automática de la integración del widget de soporte en la Plataforma Iberia (26-nov-2026). Se puede cerrar.')
    await foto(pa, 'widget-formulario')
    await pa.getByRole('button', { name: 'Enviar ticket' }).click()
    await pa.getByText('Ticket enviado!', { exact: false }).waitFor({ timeout: 30_000 }).catch(() => undefined)
    ok(await pa.getByText('Ticket enviado!', { exact: false }).isVisible().catch(() => false), 'el ticket de prueba sale: «¡Ticket enviado!»')
    await foto(pa, 'widget-enviado')
  }

  // 5) El usuario de prueba: Mis archivos vacío y propio, sin lo de Gabriel.
  const pu = await entrar(USUARIO)
  await pu.goto(`${BASE}/sistema/archivos`, { waitUntil: 'networkidle' })
  const suyo = new URL(pu.url()).pathname === '/sistema/archivos' ? await pu.locator('[data-explorador]').innerText() : ''
  ok(new URL(pu.url()).pathname !== '/sistema/archivos' || !/Documentos del SGC/.test(suyo), 'el usuario de prueba no ve las carpetas de Gabriel')
  await foto(pu, 'usuario-archivos')
  ok(pa.errores.length === 0 && pu.errores.length === 0, `sin errores de página${[...pa.errores, ...pu.errores][0] ? `: ${[...pa.errores, ...pu.errores][0].slice(0, 140)}` : ''}`)
} finally {
  await nav.close()
}
writeFileSync(`${DIR}/informe.json`, JSON.stringify(informe, null, 1))
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
