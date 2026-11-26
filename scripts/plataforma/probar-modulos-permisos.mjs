/**
 * Que todo lo del menú se pueda dar y quitar en Roles (26-nov-2026, Gabriel).
 * Contra el PROYECTO DE PRUEBAS (dev :3005).
 *
 *  1. Estático: todo recurso que pide una página (`requerirPermiso`), una pestaña
 *     (`PESTANAS`) o un módulo del plan (`control.modulo`) existe como casilla en
 *     `MODULOS` de lib/permisos.ts; y todo módulo operando con pantalla tiene casilla.
 *  2. En vivo: con una cuenta de prueba de un rol (por defecto, Usuario Iberia) se
 *     lee el menú de /sistema y se compara con su matriz: no sale nada que su rol
 *     no tenga, ni el plan (si no lee la hoja de ruta); y cada pantalla del menú abre.
 *
 *   node --env-file=.env.local scripts/plataforma/probar-modulos-permisos.mjs [--rol usuario-iberia]
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const ROL = process.argv.includes('--rol') ? process.argv[process.argv.indexOf('--rol') + 1] : 'usuario-iberia'
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false } })
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

// ── 1. Estático ──────────────────────────────────────────────────────────────
const permisos = readFileSync('lib/permisos.ts', 'utf8')
const casillas = new Set([...permisos.matchAll(/clave: '((?:sistema|modulo):[a-z0-9-]+)'/g)].map((m) => m[1]))
const dominios = readFileSync('lib/plataforma/dominios.ts', 'utf8')
const deRecurso = (texto) => [...texto.matchAll(/recurso: '((?:sistema|modulo):[a-z0-9-]+)'/g)].map((m) => m[1])
const archivos = []
const recorrer = (d) => {
  for (const f of readdirSync(d)) {
    const r = join(d, f)
    if (statSync(r).isDirectory()) recorrer(r)
    else if (/\.(ts|tsx)$/.test(f)) archivos.push(r)
  }
}
for (const d of ['app', 'components', 'lib']) recorrer(d)
const pedidos = new Map()
for (const f of archivos) {
  for (const m of readFileSync(f, 'utf8').matchAll(/(?:requerirPermiso|puede)\((?:sesion, )?'((?:sistema|modulo):[a-z0-9-]+)'/g)) {
    if (!pedidos.has(m[1])) pedidos.set(m[1], f)
  }
}
const sinCasilla = [...pedidos].filter(([r]) => !casillas.has(r))
ok(!sinCasilla.length, `todo permiso que pide el código es una casilla de Roles (${pedidos.size} distintos)${sinCasilla.length ? `: faltan ${sinCasilla.map(([r, f]) => `${r} (${f})`).join(', ')}` : ''}`)
const deMenu = deRecurso(dominios).filter((r) => !casillas.has(r))
ok(!deMenu.length, `toda pestaña y módulo de interfaz tiene su casilla${deMenu.length ? `: faltan ${deMenu.join(', ')}` : ''}`)
const { data: plan } = await admin.schema('control').from('modulo').select('codigo, nombre, dominio, estado, ruta, recurso').order('orden')
const operando = plan.filter((m) => m.estado !== 'planificado' && m.ruta)
const huerfanos = operando.filter((m) => !m.recurso || !casillas.has(m.recurso))
ok(!huerfanos.length, `cada módulo con pantalla del plan (${operando.length}) tiene su casilla${huerfanos.length ? `: ${huerfanos.map((m) => `${m.codigo} ${m.recurso ?? '(sin recurso)'}`).join(', ')}` : ''}`)
ok(casillas.has('sistema:asistente') && casillas.has('sistema:asistente-admin'), 'el asistente de IA tiene sus dos casillas (usarlo y administrarlo)')

// ── 2. En vivo, con una cuenta del rol ───────────────────────────────────────
const email = `${ROL}.menu@plataforma.local`
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 })
let u = lista.users.find((x) => x.email === email)
const { data: rol } = await admin.from('roles').select('id, nombre, nivel').eq('clave', ROL).single()
if (!u) u = (await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nombre_completo: `Prueba de menú (${rol.nombre})`, rol_clave: ROL, organizacion: 'iberia' } })).data.user
await admin.from('profiles').update({ rol_id: rol.id, activo: true }).eq('id', u.id)
const { data: matriz } = await admin.from('rol_permisos').select('recurso, ver, crear, editar').eq('rol_id', rol.id)
const tiene = (r, a = 'ver') => rol.nivel === 'admin' || (matriz ?? []).some((x) => x.recurso === r && x[a])
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
try {
  await p.goto(`${BASE}/sistema`, { waitUntil: 'networkidle' })
  // El riel y la columna salen del mismo arreglo del servidor: se leen todos los enlaces de módulo de la página.
  const dominiosVistos = await p.locator('nav a[href^="/sistema"]').evaluateAll((as) => [...new Set(as.map((a) => a.textContent.trim()).filter(Boolean))])
  console.log(`  ${rol.nombre} ve en el riel: ${dominiosVistos.slice(0, 20).join(' · ')}`)
  const conPantalla = operando.filter((m) => m.recurso)
  const debeVer = conPantalla.filter((m) => tiene(m.recurso) || (m.recurso === 'sistema:requisiciones' && tiene(m.recurso, 'crear')))
  const noDebeVer = conPantalla.filter((m) => !debeVer.includes(m))
  const visibles = []
  for (const dom of ['Administración', 'Organización y procesos', 'Personas', 'Programa', 'Datos', 'Finanzas']) {
    const enlaceDom = p.locator('nav').getByRole('link', { name: new RegExp(`^${dom}`) }).first()
    if (!(await enlaceDom.count())) continue
    await enlaceDom.click()
    await p.waitForLoadState('networkidle')
    visibles.push(...(await p.locator('a[href^="/sistema"]').evaluateAll((as) => as.map((a) => a.textContent.trim()))))
  }
  const visto = (m) => visibles.some((t) => t.includes(m.nombre))
  const deMas = noDebeVer.filter(visto)
  ok(!deMas.length, `no ve módulos que su rol no tiene${deMas.length ? `: ${deMas.map((m) => m.nombre).join(', ')}` : ''}`)
  const planificados = plan.filter((m) => m.estado === 'planificado' && visto(m))
  ok(tiene('modulo:programa') || !planificados.length, `sin la hoja de ruta, no ve el plan${planificados.length ? `: ${planificados.map((m) => m.nombre).join(', ')}` : ''}`)
  for (const m of debeVer) {
    const r = await p.request.get(`${BASE}${m.ruta}`, { maxRedirects: 0 })
    ok(r.status() === 200, `${m.nombre} (${m.ruta}) abre para su rol (${r.status()})`)
  }
  // Por URL directa: la página pide su permiso y manda a Mi día con el aviso (la redirección llega con la página en
  // streaming, así que el estado HTTP no sirve: se mira a dónde termina el navegador).
  for (const m of noDebeVer.filter((x) => x.ruta.startsWith('/sistema/administracion'))) {
    await p.goto(`${BASE}${m.ruta}`, { waitUntil: 'networkidle' })
    const fin = new URL(p.url())
    ok(fin.pathname !== m.ruta, `${m.nombre} no abre por URL directa (termina en ${fin.pathname}${fin.search})`)
  }
  await p.screenshot({ path: `capturas/plataforma/menu-${ROL}.png` })
} finally {
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
