/**
 * Recorrido del asistente EN PRODUCCIÓN con las dos cuentas de Gabriel, entrando por el login del sitio en
 * línea (26-nov-2026, con su OK). No toca las cuentas (ni clave ni rol). Lo que cambia —el alcance del rol del
 * usuario de prueba y sus fuentes— lo devuelve como estaba. Gasta unos pocos dólares de verdad.
 *
 *   RECORRIDO_CLAVE=… node --env-file=.env.local scripts/asistente/recorrido-produccion.mjs [--solo-usuario]
 *
 * El alcance del asistente nunca pasa del permiso de la pantalla: si el rol del usuario de prueba no ve Plazas,
 * Procesos y Documentos, el asistente tampoco, por más fuentes que se enciendan (así estaba «Usuario Iberia» el
 * 26-nov). Para probar TODO / LIMITADO / NADA, el recorrido le da «ver» de esas tres pantallas mientras dura y al
 * final deja los permisos del rol como estaban.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.RECORRIDO_BASE || 'https://portal.industriasiberia.com'
const CLAVE = process.env.RECORRIDO_CLAVE
if (!CLAVE) throw new Error('Falta RECORRIDO_CLAVE')
const ADMIN = 'gmontiel@spatiumgroup.com'
const USUARIO = 'andreto1206@gmail.com'
const DIR = 'capturas/recorrido-produccion'
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
const nota = (t) => {
  console.log(`  · ${t}`)
  informe.push({ nota: t })
}

const { data: lista } = await db.auth.admin.listUsers({ perPage: 500 })
const uAdmin = lista.users.find((x) => x.email === ADMIN)
const uUsuario = lista.users.find((x) => x.email === USUARIO)
const { data: perfil } = await db.from('profiles').select('rol_id, roles(nombre, clave)').eq('id', uUsuario.id).single()
const ROL = { id: perfil.rol_id, nombre: perfil.roles.nombre }
nota(`usuario de prueba con el rol ${ROL.nombre}`)
const [{ data: fuentesAntes }, { data: alcanceAntes }, { data: permisosAntes }] = await Promise.all([
  A.from('fuente').select('*'),
  A.from('alcance_rol').select('*').eq('rol_id', ROL.id),
  db.from('rol_permisos').select('*').eq('rol_id', ROL.id),
])
const SOLO_USUARIO = process.argv.includes('--solo-usuario')
const PANTALLAS = ['sistema:estructura', 'sistema:procesos', 'sistema:documentos']

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
const foto = async (p, nombre, completa = false) => p.screenshot({ path: `${DIR}/${String(++n).padStart(2, '0')}-${nombre}.png`, fullPage: completa })
async function preguntar(p, uid, texto, modelo) {
  if (modelo) await p.getByLabel('Modelo').selectOption(modelo)
  await p.getByLabel('Mensaje para el asistente').fill(texto)
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim().endsWith('Enviar') && !b.disabled), null, { timeout: 60_000 })
  const desde = new Date().toISOString()
  await p.getByRole('button', { name: 'Enviar' }).click()
  for (let i = 0; i < 400; i++) {
    const { data: t } = await A.from('turno').select('id, estado, error, costo_usd, duracion_ms, tramos').eq('solicitante', uid).gte('creado_en', desde).order('creado_en', { ascending: false }).limit(1).maybeSingle()
    if (t && !['en_cola', 'corriendo'].includes(t.estado)) {
      await p.waitForTimeout(2000)
      const { data: m } = await A.from('mensaje').select('texto').eq('turno_id', t.id).eq('rol', 'asistente').maybeSingle()
      const { data: q } = await A.from('consulta_fuente').select('fuente').eq('turno_id', t.id)
      return { ...t, texto: m?.texto ?? '', fuentes: [...new Set((q ?? []).map((x) => x.fuente))] }
    }
    await p.waitForTimeout(1500)
  }
  return { estado: 'sin_respuesta', texto: '', fuentes: [] }
}
const marcarAlcance = async (pa, quiere) => {
  await pa.goto(`${BASE}/sistema/administracion/asistente/alcance`, { waitUntil: 'networkidle' })
  const filas = await pa.locator('input[aria-label^="Encender "]').evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-label').replace('Encender ', '')))
  for (const titulo of filas) {
    const enc = pa.getByLabel(`Encender ${titulo}`, { exact: true })
    const rol = pa.getByLabel(`${ROL.nombre}: ${titulo}`, { exact: true })
    const debe = quiere(titulo)
    if (debe && !(await enc.isChecked())) {
      await enc.check()
      await pa.waitForTimeout(900)
    }
    if ((await rol.count()) && (await rol.isChecked()) !== debe) {
      await rol.setChecked(debe)
      await pa.waitForTimeout(900)
    }
  }
  return filas.length
}
const PREGUNTA = 'Dame en una tabla corta: total de plazas y cuántas están vacantes, cuántos procesos tiene el catálogo y cuántos documentos hay en la biblioteca. Cita la fuente de cada cifra.'

try {
  // ── El administrador ───────────────────────────────────────────────────────
  const pa = await entrar(ADMIN)
  if (!SOLO_USUARIO) {
  ok(new URL(pa.url()).pathname.startsWith('/sistema'), 'Gabriel entra por el login de producción')
  ok((await pa.locator('a[href="/sistema/asistente"]').count()) > 0, 've el Asistente de IA en Mi día')
  await foto(pa, 'admin-mi-dia')
  for (const [ruta, debe] of [
    ['/sistema/administracion/asistente', /Consumo del mes por persona/],
    ['/sistema/administracion/asistente/motor', /Opus 5\.5/],
    ['/sistema/administracion/asistente/usuarios', /Usuario Iberia|Administrador/],
    ['/sistema/administracion/asistente/alcance', /Fuentes por rol/],
    ['/sistema/administracion/asistente/microsoft', /91CDB7A316111C1181188BA1721EF52F0293F684/],
    ['/sistema/administracion/asistente/adopcion', /Adopción/],
  ]) {
    await pa.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
    const t = await pa.locator('main').innerText()
    ok(new URL(pa.url()).pathname === ruta && debe.test(t), `abre ${ruta} con su contenido`)
    await foto(pa, ruta.split('/').pop() || 'resumen', true)
  }
  // «Preguntar a la IA» abre el asistente al costado.
  await pa.goto(`${BASE}/sistema/nucleo/procesos/catalogo`, { waitUntil: 'networkidle' })
  await pa.locator('[data-boton-preguntar-ia]').click()
  await pa.locator('[data-panel-asistente]').getByLabel('Mensaje para el asistente').waitFor({ timeout: 30_000 })
  ok(/Desde: .*Procesos/.test(await pa.locator('[data-panel-asistente] header').innerText()), '«Preguntar a la IA» abre el asistente al costado con el contexto')
  await foto(pa, 'admin-panel-preguntar')
  // Un Excel largo: la prueba de que la función de fondo de Netlify corre.
  await pa.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await pa.locator('input[type=file]:not(.bw-file-input)').setInputFiles('capturas/asistente/ventas-onedrive.xlsx')
  await pa.waitForSelector('text=ventas-onedrive.xlsx', { timeout: 60_000 })
  await pa.waitForTimeout(3000)
  const ex = await preguntar(pa, uAdmin.id, 'Analiza el Excel adjunto: ventas por zona y por producto, con un resumen en Excel para descargar.', 'claude-sonnet-5-5')
  const { data: gen } = ex.id ? await A.from('archivo').select('nombre').eq('origen', 'generado').eq('dueno', uAdmin.id).gte('creado_en', new Date(Date.now() - 15 * 60_000).toISOString()) : { data: [] }
  ok(ex.estado === 'listo' && (gen ?? []).length > 0, `Excel en la función de fondo de Netlify: ${ex.estado}, ${Math.round((ex.duracion_ms ?? 0) / 1000)} s, ${ex.tramos ?? 0} tramo(s) extra, US$ ${Number(ex.costo_usd ?? 0).toFixed(3)} · ${(gen ?? []).map((g) => g.nombre).join(', ')}`)
  await foto(pa, 'admin-excel')

  }
  // ── El usuario, con todo / limitado / nada ─────────────────────────────────
  const faltan = PANTALLAS.filter((r) => !(permisosAntes ?? []).some((p) => p.recurso === r && p.ver))
  for (const recurso of faltan) {
    const ya = (permisosAntes ?? []).find((p) => p.recurso === recurso)
    const { error } = ya
      ? await db.from('rol_permisos').update({ ver: true }).eq('rol_id', ROL.id).eq('recurso', recurso)
      : await db.from('rol_permisos').insert({ rol_id: ROL.id, recurso, ver: true })
    if (error) throw new Error(`No se pudo dar ${recurso}: ${error.message}`)
  }
  if (faltan.length) nota(`durante la prueba, ${ROL.nombre} ve también: ${faltan.join(', ')} (se devuelve al final)`)
  const pu = await entrar(USUARIO)
  const riel = await pu.locator('nav[aria-label="Dominios"]').innerText()
  ok(!/Administración/.test(riel) && (await pu.locator('a[href="/sistema/asistente"]').count()) > 0, 'el usuario entra, ve el asistente y no ve Administración')
  await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const modelos = await pu.getByLabel('Modelo').locator('option').allInnerTexts()
  ok(modelos.length >= 2 && !(await pu.locator('input[type=file]:not(.bw-file-input)').isDisabled()), `puede cambiar de modelo (${modelos.join(', ')}) y adjuntar`)
  await foto(pu, 'usuario-chat')

  const total = await marcarAlcance(pa, (t) => !/Microsoft 365/.test(t))
  nota(`TODO: ${total} fuentes en el catálogo, encendidas para ${ROL.nombre} (menos Microsoft 365)`)
  await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const r1 = await preguntar(pu, uUsuario.id, PREGUNTA)
  nota(`TODO · consultó ${r1.fuentes.join(', ') || 'nada'} · «${r1.texto.slice(0, 140).replace(/\n/g, ' ')}»`)
  ok(r1.estado === 'listo' && r1.fuentes.length >= 1 && !/sin acceso/i.test(r1.texto), 'con todo encendido, responde con datos de la plataforma')
  await foto(pu, 'usuario-todo')

  await marcarAlcance(pa, (t) => t === 'Plazas')
  await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const r2 = await preguntar(pu, uUsuario.id, PREGUNTA)
  nota(`LIMITADO · consultó ${r2.fuentes.join(', ') || 'nada'}`)
  ok(r2.fuentes.length >= 1 && r2.fuentes.every((f) => f === 'tabla:plazas') && /sin acceso|no tengo acceso|no puedo/i.test(r2.texto), 'limitado a Plazas: solo consulta Plazas y lo demás lo dice')
  await foto(pu, 'usuario-limitado')

  await marcarAlcance(pa, () => false)
  await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const r3 = await preguntar(pu, uUsuario.id, '¿Cuántas plazas vacantes hay en Iberia?')
  nota(`NADA · «${r3.texto.slice(0, 140).replace(/\n/g, ' ')}»`)
  ok(r3.fuentes.length === 0 && /no tengo acceso|sin acceso|no puedo/i.test(r3.texto), 'sin fuentes: no consulta nada ni inventa la cifra')
  await foto(pu, 'usuario-nada')
  const uso = await pu.locator('[data-uso]').innerText()
  ok(/Esta ventana de 5 h/.test(uso) && /% usado/.test(uso), `ve su uso en % («${uso.replace(/\n+/g, ' · ').slice(0, 120)}»)`)
  for (const ruta of ['/sistema/administracion/asistente', '/sistema/administracion/roles']) {
    await pu.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
    ok(new URL(pu.url()).pathname !== ruta, `el usuario no abre ${ruta}`)
  }
  ok(pa.errores.length === 0 && pu.errores.length === 0, `sin errores de página${[...pa.errores, ...pu.errores][0] ? `: ${[...pa.errores, ...pu.errores][0].slice(0, 140)}` : ''}`)
} finally {
  // Producción como estaba: los permisos del rol, su alcance y las fuentes.
  await db.from('rol_permisos').delete().eq('rol_id', ROL.id).in('recurso', PANTALLAS)
  const devolver = (permisosAntes ?? []).filter((p) => PANTALLAS.includes(p.recurso))
  if (devolver.length) await db.from('rol_permisos').insert(devolver)
  await A.from('alcance_rol').delete().eq('rol_id', ROL.id)
  if (alcanceAntes?.length) await A.from('alcance_rol').insert(alcanceAntes)
  for (const f of fuentesAntes ?? []) await A.from('fuente').update({ encendida: f.encendida, sensible: f.sensible }).eq('clave', f.clave)
  const claves = (fuentesAntes ?? []).map((f) => f.clave)
  const { data: ahora } = await A.from('fuente').select('clave')
  const nuevas = (ahora ?? []).map((f) => f.clave).filter((c) => !claves.includes(c))
  if (nuevas.length) await A.from('fuente').delete().in('clave', nuevas)
  await nav.close()
}
writeFileSync(`${DIR}/informe.json`, JSON.stringify(informe, null, 1))
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
