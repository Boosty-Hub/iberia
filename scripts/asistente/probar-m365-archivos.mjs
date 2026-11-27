/**
 * La pestaña «Microsoft 365» del «/» y los archivos traídos que se quedan en Mis archivos (27-nov-2026), contra el
 * PROYECTO DE PRUEBAS (dev :3005) y un SIMULADOR de Entra y Graph en el :3999 (valida la aserción con el certificado).
 *
 * El dev de pruebas tiene que correr con:
 *   ASISTENTE_MS_LOGIN_URL=http://localhost:3999  ASISTENTE_GRAPH_URL=http://localhost:3999/v1.0
 *
 *   node --env-file=.env.local scripts/asistente/probar-m365-archivos.mjs
 *
 * No llama a ningún modelo: el «traer» del asistente se prueba por la ruta de las fuentes, como lo llama el ejecutor.
 */
import http from 'node:http'
import { createHash, createVerify, randomBytes, X509Certificate } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const TENANT = '11111111-1111-4111-8111-111111111111'
const CLIENTE = '22222222-2222-4222-8222-222222222222'
const admin = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY, { auth: { persistSession: false } })
const A = admin.schema('asistente')
mkdirSync('capturas/asistente', { recursive: true })
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

// ── El simulador ───────────────────────────────────────────────────────────────
const der = Buffer.from(process.env.MICROSOFT_CERTIFICADO, 'base64')
const publica = new X509Certificate(der).publicKey
const x5t = createHash('sha1').update(der).digest('base64url')
const sim = { codigos: new Map(), renovacion: new Set(), acceso: new Set(), descargas: 0, malas: 0 }
const ayer = new Date(Date.now() - 86400_000).toISOString()
const ARCHIVOS = {
  'd1:i1': { name: 'Ventas octubre.csv', webUrl: 'https://iberia-my.sharepoint.com/personal/ana/Documents/Ventas%20octubre.csv', mime: 'text/csv', contenido: 'zona,monto\nCentro,10\nOriente,20\n', mod: ayer },
  'd2:i2': { name: 'Presupuesto 2027.docx', webUrl: 'https://iberia.sharepoint.com/sites/Finanzas/Documentos/Presupuesto%202027.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', contenido: 'PRESUPUESTO v1', mod: ayer },
}
const recurso = (id) => {
  const [d, i] = id.split(':')
  const a = ARCHIVOS[id]
  return { id: i, name: a.name, webUrl: a.webUrl, size: Buffer.byteLength(a.contenido), lastModifiedDateTime: a.mod, file: { mimeType: a.mime }, parentReference: { driveId: d } }
}
function asercionValida(jwt) {
  try {
    const [h, p, f] = jwt.split('.')
    const cab = JSON.parse(Buffer.from(h, 'base64url'))
    const cue = JSON.parse(Buffer.from(p, 'base64url'))
    return createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publica, Buffer.from(f, 'base64url')) && cab.x5t === x5t && cue.iss === CLIENTE && cue.aud === `http://localhost:3999/${TENANT}/oauth2/v2.0/token`
  } catch {
    return false
  }
}
const json = (res, status, cuerpo) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(cuerpo))
}
const par = () => {
  const at = `at-${randomBytes(8).toString('hex')}`
  const rt = `rt-${randomBytes(8).toString('hex')}`
  sim.acceso.add(at)
  sim.renovacion.add(rt)
  return { access_token: at, refresh_token: rt, expires_in: 3600, token_type: 'Bearer' }
}
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost:3999')
  let cuerpo = ''
  for await (const t of req) cuerpo += t
  if (u.pathname === `/${TENANT}/oauth2/v2.0/authorize`) {
    const ret = new URL(u.searchParams.get('redirect_uri'))
    ret.searchParams.set('state', u.searchParams.get('state'))
    const code = `code-${randomBytes(6).toString('hex')}`
    sim.codigos.set(code, { reto: u.searchParams.get('code_challenge'), retorno: u.searchParams.get('redirect_uri') })
    ret.searchParams.set('code', code)
    res.writeHead(302, { Location: ret.toString() })
    return res.end()
  }
  if (u.pathname === `/${TENANT}/oauth2/v2.0/token`) {
    const f = new URLSearchParams(cuerpo)
    if (!asercionValida(f.get('client_assertion') ?? '')) {
      sim.malas++
      return json(res, 401, { error: 'invalid_client' })
    }
    if (f.get('grant_type') === 'authorization_code') {
      const c = sim.codigos.get(f.get('code'))
      if (!c || c.reto !== createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url')) return json(res, 400, { error: 'invalid_grant' })
      return json(res, 200, par())
    }
    if (f.get('grant_type') === 'refresh_token' && sim.renovacion.delete(f.get('refresh_token'))) return json(res, 200, par())
    return json(res, 400, { error: 'invalid_grant' })
  }
  if (u.pathname.startsWith('/v1.0/')) {
    if (!sim.acceso.has((req.headers.authorization ?? '').replace('Bearer ', ''))) return json(res, 401, {})
    const r = u.pathname.slice(5)
    if (r === '/me') return json(res, 200, { displayName: 'Ana Prueba', mail: 'ana.prueba@iberia.test' })
    if (r === '/me/drive/recent') return json(res, 200, { value: [recurso('d1:i1'), { id: 'carpeta', name: 'Una carpeta', folder: {}, parentReference: { driveId: 'd1' } }] })
    if (r === '/me/drive/sharedWithMe') return json(res, 200, { value: [{ id: 'x', name: 'Presupuesto 2027.docx', remoteItem: recurso('d2:i2') }] })
    if (r === '/search/query') {
      const q = JSON.parse(cuerpo).requests[0].query.queryString.toLowerCase()
      return json(res, 200, { value: [{ hitsContainers: [{ hits: Object.keys(ARCHIVOS).filter((id) => ARCHIVOS[id].name.toLowerCase().includes(q)).map((id) => ({ resource: recurso(id) })) }] }] })
    }
    const m = /^\/drives\/([^/]+)\/items\/([^/]+)(\/content)?$/.exec(r)
    if (m && ARCHIVOS[`${m[1]}:${m[2]}`]) {
      if (!m[3]) return json(res, 200, recurso(`${m[1]}:${m[2]}`))
      sim.descargas++
      res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
      return res.end(ARCHIVOS[`${m[1]}:${m[2]}`].contenido)
    }
    return json(res, 404, { error: { code: 'itemNotFound' } })
  }
  json(res, 404, {})
})
await new Promise((r) => servidor.listen(3999, r))

// ── La sesión ──────────────────────────────────────────────────────────────────
const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'admin.pruebas@plataforma.local' })
const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const yo = ver.user.id
const { data: perfil } = await admin.from('profiles').select('rol_id').eq('id', yo).single()
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
const n = `sb-${ref}-auth-token`
const galletas = valor.length <= 3180 ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / 3180) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * 3180, (i + 1) * 3180) }))
const nav = await chromium.launch()
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
await ctx.addCookies(galletas.map((x) => ({ ...x, domain: 'localhost', path: '/' })))
const p = await ctx.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(e.message))

const M365 = ['m365:correo', 'm365:calendario', 'm365:archivos', 'm365:teams']
const { data: cfgAntes } = await A.from('config').select('microsoft_tenant, microsoft_cliente').eq('id', true).single()
const { data: fuentesAntes } = await A.from('fuente').select('clave, encendida').in('clave', M365)
const copias = async () => (await A.from('archivo').select('id, nombre, bytes, ruta, carpeta_id, ms_item, ms_modificado, chat_id').eq('dueno', yo).eq('origen', 'microsoft').is('chat_id', null)).data ?? []
const caja = () => p.getByLabel('Mensaje para el asistente')
const abrirMicrosoft = async (texto) => {
  await caja().fill(texto)
  await p.locator('[data-pestana-archivos=microsoft]').click()
}
async function limpiar() {
  for (const c of await copias()) {
    await A.from('archivo').delete().eq('fuente_id', c.id)
    await admin.storage.from('asistente').remove([c.ruta])
    await A.from('archivo').delete().eq('id', c.id)
  }
  await A.from('carpeta').delete().eq('dueno', yo).is('padre_id', null).eq('nombre', 'Microsoft 365')
}

try {
  await limpiar()
  await A.rpc('borrar_microsoft', { p_perfil: yo })
  await A.from('config').update({ microsoft_tenant: TENANT, microsoft_cliente: CLIENTE }).eq('id', true)
  await A.from('fuente').upsert(M365.map((clave) => ({ clave, encendida: true, sensible: false })))
  await A.from('alcance_rol').upsert(M365.map((fuente) => ({ rol_id: perfil.rol_id, fuente, permitido: true })))

  // 1. Sin conectar: la pestaña está y ofrece conectar.
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await abrirMicrosoft('/')
  await p.waitForSelector('[data-m365-sin-conexion]', { timeout: 20_000 })
  ok(true, 'sin la cuenta conectada, la pestaña Microsoft 365 ofrece conectarla')
  await p.screenshot({ path: 'capturas/asistente/m365-sin-conexion.png' })

  // 2. Conectar (por la página de siempre).
  await p.goto(`${BASE}/sistema/asistente/conexiones`, { waitUntil: 'networkidle' })
  await p.getByRole('link', { name: 'Conectar mi cuenta' }).click()
  await p.waitForURL(/conexiones\?ok=/, { timeout: 20_000 })
  ok(sim.malas === 0, 'conecta con el certificado')

  // 3. «/» sin texto: recientes y compartidos, sin carpetas.
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await abrirMicrosoft('/')
  await p.waitForSelector('[data-menu-m365] button', { timeout: 20_000 }).catch(async (e) => {
    console.log('panel:', await p.locator('[data-menu-archivos]').innerText().catch(() => '(sin panel)'))
    throw e
  })
  const lista = await p.locator('[data-menu-m365]').innerText()
  ok(/Ventas octubre\.csv/.test(lista) && /Presupuesto 2027\.docx/.test(lista) && !/Una carpeta/.test(lista), 'sin escribir: recientes y compartidos conmigo, sin carpetas')
  ok(/OneDrive/.test(lista) && /SharePoint · Finanzas/.test(lista), 'cada uno dice de dónde viene (OneDrive, SharePoint · Finanzas)')
  await p.screenshot({ path: 'capturas/asistente/m365-recientes.png' })

  // 4. Buscar y elegir: queda en Mis archivos › Microsoft 365 y se adjunta.
  await caja().fill('/presu')
  await p.waitForFunction(() => /Presupuesto/.test(document.querySelector('[data-menu-m365]')?.textContent ?? '') && !/Ventas/.test(document.querySelector('[data-menu-m365]')?.textContent ?? ''), null, { timeout: 20_000 })
  ok(true, 'con texto, busca en Microsoft 365')
  await p.locator('[data-menu-m365] button', { hasText: 'Presupuesto 2027.docx' }).click()
  await p.waitForFunction(() => [...document.querySelectorAll('li')].some((l) => l.textContent?.includes('Presupuesto 2027.docx') && l.textContent.includes('📎')), null, { timeout: 30_000 })
  let cs = await copias()
  const { data: carpeta } = await A.from('carpeta').select('id, nombre, padre_id').eq('id', cs[0]?.carpeta_id ?? '00000000-0000-0000-0000-000000000000').maybeSingle()
  ok(cs.length === 1 && cs[0].ms_item === 'd2:i2' && carpeta?.nombre === 'Microsoft 365' && carpeta.padre_id === null, 'lo elegido queda en Mis archivos › Microsoft 365, con su id de Microsoft')
  const { data: adj } = await A.from('archivo').select('id').eq('origen', 'biblioteca').eq('fuente_id', cs[0].id)
  ok((adj ?? []).length === 1, 'y se adjunta al chat como un archivo de Mis archivos')
  await p.screenshot({ path: 'capturas/asistente/m365-adjunto.png' })
  const descargasAntes = sim.descargas

  // 5. Otra vez: ya está, no se duplica ni se vuelve a bajar.
  await abrirMicrosoft('/presu')
  await p.waitForSelector('[data-menu-m365] >> text=Ya en Mis archivos', { timeout: 20_000 })
  ok(true, 'la lista marca lo que ya está en Mis archivos')
  await p.locator('[data-menu-m365] button', { hasText: 'Presupuesto 2027.docx' }).click()
  await p.waitForFunction(() => [...document.querySelectorAll('li')].filter((l) => l.textContent?.includes('Presupuesto 2027.docx') && l.textContent.includes('📎')).length >= 2, null, { timeout: 30_000 })
  cs = await copias()
  ok(cs.length === 1 && sim.descargas === descargasAntes, 'volver a traerlo sin cambios no duplica ni descarga')

  // 6. Cambió en Microsoft: se actualiza la misma copia (y los adjuntos viejos apuntan a la nueva).
  const rutaVieja = cs[0].ruta
  ARCHIVOS['d2:i2'].contenido = 'PRESUPUESTO v2, con más líneas'
  ARCHIVOS['d2:i2'].mod = new Date().toISOString()
  await abrirMicrosoft('/presu')
  await p.waitForSelector('[data-menu-m365] >> text=Cambió: se actualiza', { timeout: 20_000 })
  await p.locator('[data-menu-m365] button', { hasText: 'Presupuesto 2027.docx' }).click()
  await p.waitForFunction(() => [...document.querySelectorAll('li')].filter((l) => l.textContent?.includes('Presupuesto 2027.docx') && l.textContent.includes('📎')).length >= 3, null, { timeout: 30_000 })
  const cs2 = await copias()
  const { data: adjs } = await A.from('archivo').select('ruta').eq('origen', 'biblioteca').eq('fuente_id', cs2[0].id)
  const { data: vieja } = await admin.storage.from('asistente').download(rutaVieja)
  ok(cs2.length === 1 && cs2[0].id === cs[0].id && Number(cs2[0].bytes) === Buffer.byteLength(ARCHIVOS['d2:i2'].contenido) && cs2[0].ruta !== rutaVieja, 'si cambió en Microsoft, se actualiza la misma copia')
  ok((adjs ?? []).every((a) => a.ruta === cs2[0].ruta) && !vieja, 'los adjuntos de antes apuntan a la versión nueva y los bytes viejos se borran')

  // 7. La pestaña Mis archivos la encuentra sin ir a Microsoft.
  await caja().fill('/presu')
  await p.locator('[data-pestana-archivos=plataforma]').click()
  await p.waitForSelector('[data-menu-biblioteca] >> text=Presupuesto 2027.docx', { timeout: 20_000 })
  ok(true, 'la pestaña Mis archivos la encuentra después, sin ir a Microsoft')
  await caja().fill('')

  // 8. El asistente con «traer» (la ruta de las fuentes, como la llama el ejecutor) también la deja en Mis archivos.
  const r = await (
    await fetch(`${BASE}/api/asistente/fuente`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': process.env.ASISTENTE_SECRETO },
      body: JSON.stringify({ accion: 'consultar', token: ver.session.access_token, turno: null, fuente: 'm365:archivos', args: { accion: 'traer', id: 'd1:i1', consulta: null, limite: null } }),
    })
  ).json()
  const cs3 = await copias()
  ok(!r.resultado?.error && cs3.length === 2 && cs3.some((c) => c.ms_item === 'd1:i1' && c.carpeta_id === cs2[0].carpeta_id), `«traer» del asistente también la guarda en la misma carpeta (${r.resultado?.guardado ?? r.resultado?.error})`)

  // 9. En Mis archivos se ve la carpeta con los dos.
  await p.goto(`${BASE}/sistema/archivos?c=${cs2[0].carpeta_id}`, { waitUntil: 'networkidle' })
  await p.waitForSelector('text=Ventas octubre.csv', { timeout: 20_000 })
  ok(await p.getByText('Presupuesto 2027.docx').first().isVisible(), 'Mis archivos muestra la carpeta Microsoft 365 con lo traído')
  await p.screenshot({ path: 'capturas/asistente/m365-mis-archivos.png' })
  ok(errores.length === 0, `sin errores en la página${errores.length ? `: ${errores[0].slice(0, 160)}` : ''}`)
} finally {
  await limpiar()
  await A.rpc('borrar_microsoft', { p_perfil: yo })
  await A.from('alcance_rol').delete().eq('rol_id', perfil.rol_id).in('fuente', M365)
  for (const clave of M365) {
    const antes = (fuentesAntes ?? []).find((f) => f.clave === clave)
    if (antes) await A.from('fuente').update({ encendida: antes.encendida }).eq('clave', clave)
    else await A.from('fuente').delete().eq('clave', clave)
  }
  await A.from('config').update(cfgAntes).eq('id', true)
  await nav.close()
  servidor.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
