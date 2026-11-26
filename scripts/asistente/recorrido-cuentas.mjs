/**
 * Recorrido del asistente con las dos cuentas de Gabriel, como él las usa: entrando por el
 * formulario de login (26-nov-2026). Contra el PROYECTO DE PRUEBAS (dev :3005).
 *
 *  - Desde el administrador: le da al rol del usuario la casilla del asistente (Roles) y le
 *    enciende TODAS las fuentes de datos (Alcance); después lo limita a una tabla; después
 *    no le deja ninguna.
 *  - Desde el usuario: en cada etapa le pregunta al asistente y se mira qué consultó.
 *  - Y la experiencia de los dos lados: menú, chat, tareas, conexiones, archivos, teléfono
 *    y las pantallas de administración, con los errores de la página.
 *
 * La clave va en RECORRIDO_CLAVE (nunca en un archivo). Deja pruebas como estaba.
 *   RECORRIDO_CLAVE=… node --env-file=.env.local scripts/asistente/recorrido-cuentas.mjs [--admin <correo>] [--usuario <correo>]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const CLAVE = process.env.RECORRIDO_CLAVE
if (!CLAVE) throw new Error('Falta RECORRIDO_CLAVE')
const opc = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
const ADMIN = opc('--admin', 'gmontiel@spatiumgroup.com')
const USUARIO = opc('--usuario', 'andreto1206@gmail.com')
const DIR = 'capturas/recorrido'
mkdirSync(DIR, { recursive: true })
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const A = admin.schema('asistente')
const informe = []
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  informe.push({ ok: !!c, texto: t })
  if (!c) fallos++
}
const nota = (t) => {
  console.log(`  · ${t}`)
  informe.push({ nota: t })
}

// ── Las cuentas, como en producción ─────────────────────────────────────────
async function cuenta(email, nombre, rolClave, org) {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 500 })
  let u = lista.users.find((x) => x.email === email)
  if (!u) u = (await admin.auth.admin.createUser({ email, password: CLAVE, email_confirm: true, user_metadata: { nombre_completo: nombre, rol_clave: rolClave, organizacion: org } })).data.user
  else await admin.auth.admin.updateUserById(u.id, { password: CLAVE })
  const { data: antes } = await admin.from('profiles').select('rol_id, nombre_completo, organizacion').eq('id', u.id).single()
  const { data: rol } = await admin.from('roles').select('id, nombre').eq('clave', rolClave).single()
  await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: nombre, organizacion: org }).eq('id', u.id)
  return { id: u.id, email, nombre, rol, antes }
}
const yo = await cuenta(ADMIN, 'Gabriel Montiel Toro', 'administrador', 'boosty')
const usuario = await cuenta(USUARIO, 'Gabriel Pruebas', 'usuario-iberia', 'iberia')
const ROL = usuario.rol

// Lo que se toca, para dejarlo como estaba.
const [{ data: fuentesAntes }, { data: alcanceAntes }, { data: casillaAntes }] = await Promise.all([
  A.from('fuente').select('*'),
  A.from('alcance_rol').select('*').eq('rol_id', ROL.id),
  admin.from('rol_permisos').select('*').eq('rol_id', ROL.id).eq('recurso', 'sistema:asistente').maybeSingle(),
])
await admin.from('rol_permisos').upsert({ rol_id: ROL.id, recurso: 'sistema:asistente', ver: false, crear: false, editar: false, eliminar: false }, { onConflict: 'rol_id,recurso' })
await A.from('alcance_rol').delete().eq('rol_id', ROL.id)

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
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  await p.waitForLoadState('networkidle')
  return p
}
let n = 0
const foto = async (p, nombre, completa = false) => {
  n++
  const ruta = `${DIR}/${String(n).padStart(2, '0')}-${nombre}.png`
  await p.screenshot({ path: ruta, fullPage: completa })
  return ruta
}
const fotos = []
const esperarRespuesta = async (p, k) => {
  await p.waitForTimeout(1500)
  await p.waitForFunction((k) => !document.querySelector('[aria-live=polite]') && (document.querySelectorAll('[aria-label="Copiar la respuesta"]').length >= k || /Reintentar/.test(document.body.innerText)), k, { timeout: 300_000 })
}
async function preguntar(p, texto, k) {
  await p.getByLabel('Mensaje para el asistente').fill(texto)
  await p.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim().endsWith('Enviar') && !b.disabled), null, { timeout: 30_000 })
  await p.getByRole('button', { name: 'Enviar' }).click()
  await esperarRespuesta(p, k)
  const chat = p.url().split('/c/')[1]
  const { data: t } = await A.from('turno').select('id, estado, costo_usd, modelo').eq('chat_id', chat).order('creado_en', { ascending: false }).limit(1).single()
  const { data: m } = await A.from('mensaje').select('texto').eq('turno_id', t.id).eq('rol', 'asistente').maybeSingle()
  const { data: q } = await A.from('consulta_fuente').select('fuente').eq('turno_id', t.id)
  return { chat, turno: t, texto: m?.texto ?? '', fuentes: [...new Set((q ?? []).map((x) => x.fuente))] }
}
const marcarAlcance = async (pa, quiere) => {
  // quiere(clave) → ¿el rol del usuario la tiene? Se marca en la pantalla, casilla por casilla, como lo haría el administrador.
  await pa.goto(`${BASE}/sistema/administracion/asistente/alcance`, { waitUntil: 'networkidle' })
  const filas = await pa.locator('input[aria-label^="Encender "]').evaluateAll((xs) => xs.map((x) => x.getAttribute('aria-label').replace('Encender ', '')))
  for (const titulo of filas) {
    const enc = pa.getByLabel(`Encender ${titulo}`, { exact: true })
    const rol = pa.getByLabel(`${ROL.nombre}: ${titulo}`, { exact: true })
    const debe = quiere(titulo)
    if (debe && !(await enc.isChecked())) {
      await enc.check()
      await pa.waitForTimeout(700)
    }
    if ((await rol.count()) && (await rol.isChecked()) !== debe) {
      await rol.setChecked(debe)
      await pa.waitForTimeout(700)
    }
  }
  await pa.waitForLoadState('networkidle')
  return filas
}
const verComo = async (pa) => {
  await pa.goto(`${BASE}/sistema/administracion/asistente/alcance`, { waitUntil: 'networkidle' })
  await pa.getByLabel('Persona para ver como').selectOption({ label: usuario.nombre }).catch(async () => pa.getByLabel('Persona para ver como').selectOption(usuario.id))
  await pa.getByRole('button', { name: 'Ver como' }).click()
  await pa.waitForTimeout(2500)
}

const M365 = /Microsoft 365/
try {
  // ── 1. El administrador entra y le da el asistente al rol ──────────────────
  const pa = await entrar(ADMIN)
  ok(new URL(pa.url()).pathname.startsWith('/sistema'), `el administrador entra por el login y llega a ${new URL(pa.url()).pathname}`)
  fotos.push(await foto(pa, 'admin-mi-dia'))
  await pa.goto(`${BASE}/sistema/administracion/roles/${ROL.id}`, { waitUntil: 'networkidle' })
  const casilla = pa.getByLabel('Ver · Asistente de IA', { exact: true })
  await casilla.scrollIntoViewIfNeeded()
  ok(await casilla.isVisible(), 'en Roles y permisos, Usuario Iberia tiene la casilla «Asistente de IA»')
  await casilla.check()
  await pa.getByRole('button', { name: 'Guardar cambios' }).click()
  await pa.waitForTimeout(2500)
  const { data: guardada } = await admin.from('rol_permisos').select('ver').eq('rol_id', ROL.id).eq('recurso', 'sistema:asistente').single()
  ok(guardada.ver, 'el administrador marca la casilla desde la pantalla y queda guardada')
  await pa.evaluate(() => window.scrollBy(0, -200))
  fotos.push(await foto(pa, 'admin-roles-casilla-asistente'))

  // ── 2. TODO: todas las fuentes de la plataforma para su rol ────────────────
  const titulos = await marcarAlcance(pa, (t) => !M365.test(t))
  nota(`fuentes en el catálogo: ${titulos.length} (sin las cuatro de Microsoft 365, que piden conectar la cuenta)`)
  fotos.push(await foto(pa, 'admin-alcance-todo', true))
  await verComo(pa)
  const vista = await pa.locator('main').innerText()
  fotos.push(await foto(pa, 'admin-ver-como-todo', true))
  nota(`«Ver como» ${usuario.nombre}: ${(vista.match(/La consulta/g) ?? []).length} fuentes que «la consulta»; las demás, sin el permiso de su pantalla en el rol`)

  const pu = await entrar(USUARIO)
  nota(`el usuario entra por el login y llega a ${new URL(pu.url()).pathname}`)
  await foto(pu, 'usuario-al-entrar')
  const menu = await pu.locator('nav[aria-label="Dominios"]').innerText()
  const conAsistente = (await pu.locator('a[href="/sistema/asistente"]').count()) > 0
  nota(`riel del usuario: ${menu.split(/\s*\n\s*/).filter(Boolean).join(' · ')}`)
  ok(conAsistente && !/Administración/.test(menu), 'el usuario ve el asistente en su menú y no ve Administración')
  fotos.push(await foto(pu, 'usuario-menu'))
  await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const r1 = await preguntar(pu, 'Dame en una tabla corta: total de plazas y cuántas están vacantes, cuántos procesos tiene el catálogo y cuántos documentos hay en la biblioteca. Cita la fuente de cada cifra.', 1)
  nota(`TODO · consultó: ${r1.fuentes.join(', ') || 'nada'} · US$ ${Number(r1.turno.costo_usd).toFixed(3)}`)
  // Puede contestarlo todo con la fuente de métricas (la cifra oficial de cada pantalla) o con las tablas: se mira que dé las cuatro.
  ok(r1.turno.estado === 'listo' && r1.fuentes.length >= 1 && !/sin acceso|no tengo acceso/i.test(r1.texto) && (r1.texto.match(/\d[\d.]*/g) ?? []).length >= 4, `con todo encendido, da las cuatro cifras con su fuente (${r1.fuentes.join(', ')})`)
  fotos.push(await foto(pu, 'usuario-todo-respuesta'))
  const r2 = await preguntar(pu, '¿Cuál es el costo de referencia del cargo de Gerente General?', 2)
  ok(!r2.fuentes.includes('tabla:costos') && /no (tengo|puedo)|sin acceso|no est[aá]/i.test(r2.texto), `pero Costos no: su rol no tiene esa pantalla («${r2.texto.slice(0, 110).replace(/\n/g, ' ')}»)`)
  fotos.push(await foto(pu, 'usuario-todo-costos-no'))

  // ── 3. LIMITADO: solo la tabla de plazas ───────────────────────────────────
  await marcarAlcance(pa, (t) => t === 'Plazas')
  await verComo(pa)
  fotos.push(await foto(pa, 'admin-ver-como-limitado', true))
  await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const r3 = await preguntar(pu, 'Dame en una tabla corta: total de plazas y cuántas están vacantes, cuántos procesos tiene el catálogo y cuántos documentos hay en la biblioteca. Cita la fuente de cada cifra.', 1)
  nota(`LIMITADO · consultó: ${r3.fuentes.join(', ') || 'nada'}`)
  ok(r3.fuentes.every((f) => f === 'tabla:plazas') && r3.fuentes.length >= 1, 'limitado a Plazas: solo consulta Plazas')
  ok(/proceso|documento/i.test(r3.texto) && /(no tengo|sin acceso|no puedo|no est[aá] disponible|no tengo acceso)/i.test(r3.texto), 'y dice que lo demás no lo tiene a mano, sin inventarlo')
  fotos.push(await foto(pu, 'usuario-limitado-respuesta'))

  // ── 4. NADA: sin ninguna fuente ────────────────────────────────────────────
  await marcarAlcance(pa, () => false)
  await verComo(pa)
  fotos.push(await foto(pa, 'admin-ver-como-nada', true))
  await pu.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const r4 = await preguntar(pu, '¿Cuántas plazas vacantes hay en Iberia?', 1)
  nota(`NADA · consultó: ${r4.fuentes.join(', ') || 'nada'} · «${r4.texto.slice(0, 160).replace(/\n/g, ' ')}»`)
  ok(r4.fuentes.length === 0 && !/\b\d{2,}\b.*vacant/i.test(r4.texto), 'sin acceso a datos: no consulta nada ni inventa la cifra')
  fotos.push(await foto(pu, 'usuario-nada-respuesta'))
  const r5 = await preguntar(pu, 'Entonces ayúdame a redactar un correo corto a mi supervisor pidiendo el reporte de vacantes del mes.', 2)
  ok(r5.turno.estado === 'listo' && r5.texto.length > 80, 'sin datos, el chat sigue sirviendo para lo demás (redactar)')

  // ── 5. La experiencia del usuario, pantalla por pantalla ───────────────────
  for (const [ruta, nombre] of [
    ['/sistema/asistente/tareas', 'usuario-tareas'],
    ['/sistema/asistente/conexiones', 'usuario-conexiones'],
    ['/sistema/asistente/archivos', 'usuario-archivos'],
    ['/sistema/asistente/proyectos', 'usuario-proyectos'],
    ['/sistema/asistente/memoria', 'usuario-memoria'],
    ['/sistema/asistente/atajos', 'usuario-atajos'],
  ]) {
    await pu.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
    ok(new URL(pu.url()).pathname === ruta, `el usuario abre ${ruta}`)
    fotos.push(await foto(pu, nombre))
  }
  for (const ruta of ['/sistema/administracion/asistente', '/sistema/administracion/roles', '/sistema/administracion/usuarios']) {
    await pu.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
    ok(new URL(pu.url()).pathname !== ruta, `el usuario no abre ${ruta} (termina en ${new URL(pu.url()).pathname})`)
  }
  // En el teléfono.
  const tel = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: await pu.context().storageState() })
  const pt = await tel.newPage()
  await pt.goto(`${BASE}/sistema/asistente/c/${r5.chat}`, { waitUntil: 'networkidle' })
  const ancho = await pt.evaluate(() => document.documentElement.scrollWidth)
  ok(ancho <= 392, `el chat cabe en el teléfono, sin desborde (${ancho}px)`)
  fotos.push(await foto(pt, 'usuario-telefono'))
  await tel.close()

  // ── 6. La administración del asistente, pantalla por pantalla ──────────────
  for (const [ruta, nombre] of [
    ['/sistema/administracion/asistente', 'admin-asistente-resumen'],
    ['/sistema/administracion/asistente/motor', 'admin-asistente-motor'],
    ['/sistema/administracion/asistente/usuarios', 'admin-asistente-usuarios'],
    ['/sistema/administracion/asistente/microsoft', 'admin-asistente-microsoft'],
    ['/sistema/administracion/asistente/instrucciones', 'admin-asistente-instrucciones'],
    ['/sistema/administracion/asistente/adopcion', 'admin-asistente-adopcion'],
  ]) {
    await pa.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
    ok(new URL(pa.url()).pathname === ruta, `el administrador abre ${ruta}`)
    fotos.push(await foto(pa, nombre, true))
  }
  const res = await pa.locator('main').innerText()
  nota(`Resumen de la administración: ${res.slice(0, 200).replace(/\n/g, ' · ')}`)
  ok(pa.errores.length === 0 && pu.errores.length === 0, `sin errores de página (admin ${pa.errores.length}, usuario ${pu.errores.length})${[...pa.errores, ...pu.errores][0] ? `: ${[...pa.errores, ...pu.errores][0].slice(0, 140)}` : ''}`)
} finally {
  // Pruebas como estaba.
  await A.from('alcance_rol').delete().eq('rol_id', ROL.id)
  if (alcanceAntes?.length) await A.from('alcance_rol').insert(alcanceAntes)
  for (const f of fuentesAntes ?? []) await A.from('fuente').update({ encendida: f.encendida, sensible: f.sensible }).eq('clave', f.clave)
  await A.from('fuente').delete().not('clave', 'in', `(${(fuentesAntes ?? []).map((f) => `"${f.clave}"`).join(',') || '""'})`)
  if (casillaAntes) await admin.from('rol_permisos').upsert(casillaAntes, { onConflict: 'rol_id,recurso' })
  else await admin.from('rol_permisos').delete().eq('rol_id', ROL.id).eq('recurso', 'sistema:asistente')
  if (yo.antes?.rol_id) await admin.from('profiles').update({ rol_id: yo.antes.rol_id }).eq('id', yo.id)
  await nav.close()
}
writeFileSync(`${DIR}/informe.json`, JSON.stringify({ fotos, informe }, null, 1))
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
