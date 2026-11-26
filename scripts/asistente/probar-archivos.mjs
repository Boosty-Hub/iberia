/**
 * Mis archivos (26-nov-2026), contra el PROYECTO DE PRUEBAS (dev :3005), con sesiones reales:
 * el menú y la casilla, el árbol importado del Storage (`importar-storage.mjs`), carpetas, subir, vista previa,
 * compartir (y lo privado pide confirmación), la RLS desde la API, el «/» del chat y borrar.
 *
 *   node --env-file=.env.local scripts/asistente/probar-archivos.mjs
 *
 * Gasta centavos (un turno con Haiku). Borra lo que crea.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const A = admin.schema('asistente')
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}

async function sesion(email, rolClave) {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 500 })
  const u = lista.users.find((x) => x.email === email)
  if (!u) throw new Error(`Falta la cuenta ${email}`)
  const { data: rol } = await admin.from('roles').select('id').eq('clave', rolClave).single()
  await admin.from('profiles').update({ rol_id: rol.id, activo: true }).eq('id', u.id)
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  return { s: ver.session, id: u.id }
}
const cookies = (s) => {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64url')
  const L = 3180
  const n = `sb-${ref}-auth-token`
  const partes = valor.length <= L ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: 'localhost', path: '/' }))
}
const comoCliente = (s) => createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } })

const yo = await sesion('admin.pruebas@plataforma.local', 'administrador')
const otro = await sesion('consultor.pruebas@plataforma.local', 'consultor')
const fuera = await sesion('lector.pruebas@plataforma.local', 'lector-iberia').catch(() => null)
const NOMBRE = `Prueba archivos ${Date.now().toString(36)}`

const nav = await chromium.launch()
const abrir = async (q) => {
  const c = await nav.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
  await c.addCookies(cookies(q.s))
  const p = await c.newPage()
  p.errores = []
  p.on('pageerror', (e) => p.errores.push(e.message))
  return p
}
const pa = await abrir(yo)
const pb = await abrir(otro)

try {
  // 1) El menú y el árbol importado.
  await pa.goto(`${BASE}/sistema`, { waitUntil: 'networkidle' })
  ok((await pa.locator('a[href="/sistema/archivos"]').count()) > 0, 'Mis archivos sale en el menú de Mi día')
  await pa.goto(`${BASE}/sistema/archivos`, { waitUntil: 'networkidle' })
  const raiz = await pa.locator('[data-explorador]').innerText()
  ok(/Documentos del SGC/.test(raiz) && /Curso de Ajito/.test(raiz) && /Expediente del programa/.test(raiz), 'el Storage importado sale en carpetas (Documentos del SGC, Expediente, Curso de Ajito…)')
  await pa.getByRole('link', { name: /Documentos del SGC/ }).click()
  await pa.waitForURL(/\?c=/)
  await pa.waitForLoadState('networkidle')
  ok(/Mis carpetas/.test(await pa.locator('nav[aria-label="Migas"]').innerText()), 'dentro de una carpeta, las migas vuelven a Mis carpetas')
  // Una vista previa de PDF: la carpeta de un documento con su nombre de origen.
  const { data: doc } = await A.from('archivo').select('nombre, carpeta_id').eq('dueno', yo.id).eq('bucket', 'documentos').not('nombre', 'ilike', '%0%0%0%0%').limit(1).maybeSingle()
  if (doc) {
    await pa.goto(`${BASE}/sistema/archivos?c=${doc.carpeta_id}`, { waitUntil: 'networkidle' })
    await pa.locator('[data-explorador] tbody button', { hasText: doc.nombre }).first().click()
    const visor = pa.getByRole('dialog', { name: /Vista previa/ })
    await visor.waitFor()
    await visor.locator('canvas').first().waitFor({ timeout: 30_000 }).catch(() => undefined)
    ok((await visor.locator('canvas').count()) > 0, `un documento del SGC se abre en la vista previa con pdf.js («${doc.nombre}»)`)
    await pa.keyboard.press('Escape')
  } else ok(false, 'no hay documentos del SGC importados para la vista previa')

  // 2) Carpeta nueva y subir.
  await pa.goto(`${BASE}/sistema/archivos`, { waitUntil: 'networkidle' })
  await pa.getByRole('button', { name: '+ Nueva carpeta' }).click()
  await pa.getByLabel('Nombre de la carpeta').fill(NOMBRE)
  await pa.getByRole('button', { name: 'Guardar' }).click()
  await pa.getByRole('link', { name: NOMBRE }).waitFor({ timeout: 20_000 })
  ok(true, 'se crea una carpeta')
  await pa.getByRole('link', { name: NOMBRE }).click()
  await pa.waitForURL(/\?c=/)
  const carpetaId = new URL(pa.url()).searchParams.get('c')
  await pa.getByLabel('Subir archivos a esta carpeta').setInputFiles({ name: 'ventas-prueba.csv', mimeType: 'text/csv', buffer: Buffer.from('producto,ventas\nMayonesa Iberia,4827\nSalsa de ajo,1310\n') })
  await pa.locator('[data-explorador]', { hasText: 'ventas-prueba.csv' }).waitFor({ timeout: 30_000 })
  const { data: subido } = await A.from('archivo').select('id, ruta, bucket, estado, carpeta_id').eq('carpeta_id', carpetaId).eq('nombre', 'ventas-prueba.csv').single()
  ok(subido?.estado === 'listo' && subido.bucket === 'asistente', 'se sube un archivo a la carpeta (listo, en el bucket del asistente)')

  // 3) Antes de compartir, la otra cuenta no lo ve ni lo baja.
  const rNo = await pb.request.get(`${BASE}/sistema/archivos/${subido.id}/descargar`, { maxRedirects: 0 })
  ok(rNo.status() === 404, `sin compartir, otra cuenta no lo descarga (${rNo.status()})`)
  const cOtro = comoCliente(otro.s).schema('asistente')
  const { data: verOtro } = await cOtro.from('carpeta').select('id').eq('id', carpetaId)
  ok((verOtro ?? []).length === 0, 'sin compartir, otra cuenta no lee la carpeta por la API')

  // 4) Compartir la carpeta desde la pantalla.
  await pa.goto(`${BASE}/sistema/archivos`, { waitUntil: 'networkidle' })
  await pa.locator('tr', { hasText: NOMBRE }).getByRole('button', { name: 'Compartir' }).click()
  await pa.getByLabel('Con quién').selectOption(otro.id)
  await pa.getByRole('dialog', { name: 'Compartir' }).getByRole('button', { name: 'Compartir', exact: true }).click()
  await pa.getByText('Ya lo tienen').waitFor({ timeout: 20_000 })
  ok(true, 'se comparte la carpeta con otra persona')
  await pa.keyboard.press('Escape')
  await pb.goto(`${BASE}/sistema/archivos/compartido`, { waitUntil: 'networkidle' })
  ok(new RegExp(NOMBRE).test(await pb.locator('[data-explorador]').innerText()), 'la otra persona la ve en «Compartido conmigo»')
  await pb.getByRole('link', { name: NOMBRE }).click()
  await pb.waitForURL(/\?c=/)
  await pb.waitForLoadState('networkidle')
  const dentro = await pb.locator('[data-explorador]').innerText()
  ok(/ventas-prueba\.csv/.test(dentro) && (await pb.getByRole('button', { name: 'Renombrar' }).count()) === 0, 'entra a la carpeta compartida: ve el archivo y no puede cambiar nada')
  const rSi = await pb.request.get(`${BASE}/sistema/archivos/${subido.id}/descargar`, { maxRedirects: 0 })
  ok([302, 303, 307].includes(rSi.status()), `compartido, lo descarga (${rSi.status()})`)

  // 5) Lo privado pide confirmación.
  const { data: privado } = await A.from('archivo').select('id, nombre, carpeta_id').eq('dueno', yo.id).not('aviso', 'is', null).limit(1).maybeSingle()
  if (privado) {
    await pa.goto(`${BASE}/sistema/archivos${privado.carpeta_id ? `?c=${privado.carpeta_id}` : ''}`, { waitUntil: 'networkidle' })
    await pa.locator('tr', { hasText: privado.nombre }).getByRole('button', { name: 'Compartir' }).click()
    await pa.getByLabel('Con quién').selectOption(otro.id)
    await pa.getByRole('dialog', { name: 'Compartir' }).getByRole('button', { name: 'Compartir', exact: true }).click()
    await pa.getByRole('button', { name: 'Compartir igual' }).waitFor({ timeout: 20_000 })
    ok(/material privado/i.test(await pa.getByRole('dialog', { name: 'Compartir' }).innerText()), 'compartir algo privado (marcado al importar) pide confirmación expresa')
    const { data: noCompartido } = await A.from('compartido').select('id').eq('objeto_id', privado.id)
    ok((noCompartido ?? []).length === 0, 'sin confirmar, no se comparte')
    await pa.keyboard.press('Escape')
  } else ok(false, 'no hay archivos marcados privados para probar la confirmación')

  // 6) La RLS: con sesión no se crea una referencia ni se apunta a otro bucket.
  const cYo = comoCliente(yo.s).schema('asistente')
  const { error: e1 } = await cYo.from('archivo').insert({ dueno: yo.id, origen: 'referencia', estado: 'listo', bucket: 'documentos', ruta: 'pdf/cualquiera.pdf', nombre: 'x.pdf' })
  ok(!!e1, 'una sesión no puede crear una referencia a otro bucket')
  const { error: e2 } = await cOtro.from('carpeta').insert({ dueno: otro.id, padre_id: carpetaId, nombre: 'intrusa' })
  ok(!!e2, 'nadie crea carpetas dentro de una carpeta ajena (aunque se la hayan compartido)')
  const { data: upd } = await cOtro.from('carpeta').update({ nombre: 'renombrada' }).eq('id', carpetaId).select('id')
  ok(!(upd ?? []).length, 'nadie renombra una carpeta ajena')

  // 7) «/» en el chat: busca en Mis archivos y adjunta.
  await pa.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  await pa.getByLabel('Modelo').selectOption('claude-haiku-5-5')
  await pa.getByLabel('Mensaje para el asistente').fill('/ventas-prueba')
  await pa.locator('[data-menu-biblioteca]').waitFor({ timeout: 20_000 })
  ok(/ventas-prueba\.csv/.test(await pa.locator('[data-menu-biblioteca]').innerText()), '«/» en el chat encuentra el archivo de Mis archivos')
  await pa.locator('[data-menu-biblioteca] button', { hasText: 'ventas-prueba.csv' }).click()
  await pa.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim().endsWith('Enviar') && !b.disabled), null, { timeout: 30_000 })
  await pa.getByLabel('Mensaje para el asistente').fill('¿Cuánto vendió «Mayonesa Iberia» según el archivo adjunto? Solo el número.')
  const desde = new Date().toISOString()
  await pa.getByRole('button', { name: 'Enviar' }).click()
  let turno = null
  for (let i = 0; i < 120 && !turno; i++) {
    const { data: t } = await A.from('turno').select('id, estado, error').eq('solicitante', yo.id).gte('creado_en', desde).order('creado_en', { ascending: false }).limit(1).maybeSingle()
    if (t && !['en_cola', 'corriendo'].includes(t.estado)) turno = t
    else await pa.waitForTimeout(1500)
  }
  const { data: m } = turno ? await A.from('mensaje').select('texto').eq('turno_id', turno.id).eq('rol', 'asistente').maybeSingle() : { data: null }
  ok(turno?.estado === 'listo' && /4[.,]?827/.test(m?.texto ?? ''), `el asistente lee el archivo citado con «/» («${(m?.texto ?? turno?.error ?? '').slice(0, 80)}»)`)

  // 8) Borrar la carpeta se lleva lo subido (bytes incluidos), no lo importado de otro módulo.
  await pa.goto(`${BASE}/sistema/archivos`, { waitUntil: 'networkidle' })
  await pa.locator('tr', { hasText: NOMBRE }).getByRole('button', { name: `Borrar ${NOMBRE}` }).click()
  await pa.getByRole('dialog', { name: 'Borrar' }).getByRole('button', { name: /Borrar/ }).click()
  await pa.locator('tr', { hasText: NOMBRE }).waitFor({ state: 'detached', timeout: 20_000 })
  const { data: objeto } = await admin.storage.from('asistente').list(subido.ruta.slice(0, subido.ruta.lastIndexOf('/')), { search: subido.ruta.split('/').pop() })
  const { count: refs } = await A.from('archivo').select('id', { count: 'exact', head: true }).eq('dueno', yo.id).eq('origen', 'referencia')
  ok(!(objeto ?? []).length && (refs ?? 0) > 0, `borrar la carpeta se lleva el archivo subido de Storage y deja las ${refs} referencias importadas`)
  const { data: compartidoQueda } = await A.from('compartido').select('id').eq('objeto_id', carpetaId)
  ok(!(compartidoQueda ?? []).length, 'y lo compartido de esa carpeta se retira')

  // 9) Sin la casilla, no se entra.
  if (fuera) {
    const { data: pf } = await admin.from('rol_permisos').select('ver').eq('recurso', 'sistema:archivos').eq('rol_id', (await admin.from('profiles').select('rol_id').eq('id', fuera.id).single()).data.rol_id).maybeSingle()
    if (!pf?.ver) {
      const pc = await abrir(fuera)
      await pc.goto(`${BASE}/sistema/archivos`, { waitUntil: 'networkidle' })
      ok(new URL(pc.url()).pathname !== '/sistema/archivos', 'sin la casilla «Mis archivos», la pantalla lo saca')
    }
  }
  ok(pa.errores.length === 0 && pb.errores.length === 0, `sin errores de página${[...pa.errores, ...pb.errores][0] ? `: ${[...pa.errores, ...pb.errores][0].slice(0, 140)}` : ''}`)
} finally {
  // Lo que haya quedado de una corrida que se cayó.
  const { data: restos } = await A.from('carpeta').select('id').eq('dueno', yo.id).like('nombre', 'Prueba archivos %')
  for (const r of restos ?? []) {
    const { data: fs } = await A.from('archivo').select('ruta, origen').eq('carpeta_id', r.id)
    const propios = (fs ?? []).filter((f) => f.origen === 'subido').map((f) => f.ruta)
    if (propios.length) await admin.storage.from('asistente').remove(propios)
    await A.from('carpeta').delete().eq('id', r.id)
  }
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
