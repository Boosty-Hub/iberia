/**
 * La memoria en tres capas y la ventana que sigue el chat (26-nov-2026, pedido de Gabriel), contra el PROYECTO DE
 * PRUEBAS (dev :3005), con sesión real y Haiku (centavos):
 *  1. resumen vivo: tras un turno en un chat de 8+ mensajes, el chat queda con su resumen;
 *  2. un chat largo viaja como resumen + los últimos mensajes: el asistente sabe lo que solo está en el resumen;
 *  3. buscar en chats anteriores: desde un chat nuevo, recupera lo acordado en otro;
 *  4. la memoria aprende sola (marcado «Aprendido» en Mi memoria);
 *  5. «Abrir en ventana» desde un chat abre ESE chat.
 *
 *   node --env-file=.env.local scripts/asistente/probar-memoria.mjs
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

// Una cuenta propia, limpia (rol Consultor: tiene el asistente).
const email = 'memoria.pruebas@plataforma.local'
const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 })
let u = lista.users.find((x) => x.email === email)
if (!u) u = (await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nombre_completo: 'Memoria Pruebas', rol_clave: 'consultor', organizacion: 'boosty' } })).data.user
const { data: rol } = await admin.from('roles').select('id').eq('clave', 'consultor').single()
await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: 'Memoria Pruebas' }).eq('id', u.id)
await A.from('chat').delete().eq('dueno', u.id)
await A.from('memoria').delete().eq('dueno', u.id)
await A.from('preferencia').upsert({ perfil_id: u.id, memoria: true })

// Mensajes sembrados (sin modelo), con fechas en orden.
const sembrar = async (titulo, pares, t0 = Date.now() - 3_600_000) => {
  const id = crypto.randomUUID()
  await A.from('chat').insert({ id, dueno: u.id, titulo, titulo_auto: false })
  const filas = pares.flatMap(([p, r], i) => [
    { chat_id: id, rol: 'usuario', autor: u.id, texto: p, adjuntos: [], creado_en: new Date(t0 + i * 60_000).toISOString() },
    { chat_id: id, rol: 'asistente', autor: null, texto: r, adjuntos: [], creado_en: new Date(t0 + i * 60_000 + 30_000).toISOString() },
  ])
  const { error } = await A.from('mensaje').insert(filas)
  if (error) throw new Error(error.message)
  return { id, filas }
}
const chatCompras = await sembrar('Mermas de envasado', [
  ['Trabajo en el área de Compras y prefiero los informes en una sola página, con viñetas.', 'Entendido: informes de una página, en viñetas.'],
  ['El proveedor clave de envases es Envases del Tuy.', 'Anotado: Envases del Tuy es el proveedor clave de envases.'],
  ['Acordemos la meta: reducir las mermas de envasado un 3,7 % este trimestre.', 'Acordado: meta de reducción de mermas de envasado de 3,7 % en el trimestre.'],
  ['Revisa conmigo cada lunes el avance de la meta.', 'Perfecto, cada lunes revisamos el avance.'],
])
const largo = await sembrar(
  'Chat largo',
  Array.from({ length: 20 }, (_, i) => [`Mensaje de relleno número ${i + 1} sobre la planta.`, `Respuesta de relleno ${i + 1}.`])
)
// Su resumen dice algo que NO está en los últimos mensajes.
await A.from('chat').update({ resumen: '- Se acordó que el código interno del proyecto es PALMERA-42.\n- La revisión es mensual.', resumen_hasta: largo.filas[19].creado_en, resumen_mensajes: 20 }).eq('id', largo.id)

const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
const ref = new URL(URL_SUPA).hostname.split('.')[0]
const valor = 'base64-' + Buffer.from(JSON.stringify(ver.session)).toString('base64url')
const L = 3180
const n = `sb-${ref}-auth-token`
const cookies = (valor.length <= L ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))).map((p) => ({ ...p, domain: 'localhost', path: '/' }))

const nav = await chromium.launch()
const preguntar = async (p, caja, texto) => {
  await caja.getByLabel('Modelo').selectOption('claude-haiku-5-5')
  await caja.getByLabel('Mensaje para el asistente').fill(texto)
  const desde = new Date().toISOString()
  await caja.getByRole('button', { name: 'Enviar' }).click()
  for (let i = 0; i < 120; i++) {
    const { data: t } = await A.from('turno').select('id, estado, error').eq('solicitante', u.id).gte('creado_en', desde).order('creado_en', { ascending: false }).limit(1).maybeSingle()
    if (t && !['en_cola', 'corriendo'].includes(t.estado)) {
      const { data: m } = await A.from('mensaje').select('texto, bloques').eq('turno_id', t.id).eq('rol', 'asistente').maybeSingle()
      return { ...t, texto: m?.texto ?? '', bloques: m?.bloques ?? [] }
    }
    await p.waitForTimeout(1500)
  }
  return { estado: 'sin_respuesta', texto: '', bloques: [] }
}
try {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addCookies(cookies)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))

  // 1 y 4: un turno en el chat de compras → resumen vivo y lo aprendido.
  await p.goto(`${BASE}/sistema/asistente/c/${chatCompras.id}`, { waitUntil: 'networkidle' })
  const r1 = await preguntar(p, p, 'Resume en una línea qué acordamos.')
  ok(r1.estado === 'listo', `turno en el chat de compras (${r1.estado})`)
  let resumen = null
  for (let i = 0; i < 20 && !resumen; i++) {
    const { data } = await A.from('chat').select('resumen').eq('id', chatCompras.id).single()
    resumen = data?.resumen
    if (!resumen) await p.waitForTimeout(1500)
  }
  ok(!!resumen && /3,7|3\.7/.test(resumen), `el chat queda con su resumen vivo («${(resumen ?? '').replace(/\s+/g, ' ').slice(0, 90)}»)`)
  const { data: aprendidos } = await A.from('memoria').select('texto').eq('dueno', u.id).eq('aprendido', true)
  ok((aprendidos ?? []).length > 0, `la memoria aprende sola (${(aprendidos ?? []).map((x) => `«${x.texto}»`).join(' · ').slice(0, 160)})`)

  // 5: la ventana sigue ESTE chat.
  await p.locator('[data-abrir-ventana]').click()
  const ventana = p.locator('[data-panel-asistente][data-modo=ventana]')
  await ventana.getByLabel('Mensaje para el asistente').waitFor({ timeout: 30_000 })
  await p.waitForTimeout(1500)
  ok(/Envases del Tuy/.test(await ventana.innerText()), '«Abrir en ventana» desde un chat abre ese mismo chat, con su conversación')
  await p.screenshot({ path: 'capturas/asistente/ventana-mismo-chat.png' })
  await ventana.getByLabel('Cerrar el asistente').click()

  // 2: el chat largo viaja con su resumen.
  await p.goto(`${BASE}/sistema/asistente/c/${largo.id}`, { waitUntil: 'networkidle' })
  const r2 = await preguntar(p, p, '¿Cuál es el código interno del proyecto que acordamos? Solo el código.')
  ok(/PALMERA-42/.test(r2.texto), `un chat largo viaja con su resumen: sabe lo que solo está en él («${r2.texto.slice(0, 60)}»)`)

  // 3: desde un chat nuevo, busca en los anteriores.
  await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
  const r3 = await preguntar(p, p, '¿Qué meta de reducción de mermas acordamos en otro chat? Busca en mis chats anteriores.')
  const busco = (r3.bloques ?? []).some((b) => b.tipo === 'paso' && /chats anteriores/.test(b.titulo ?? ''))
  ok(busco && /3,7|3\.7/.test(r3.texto), `desde un chat nuevo, busca en los anteriores y lo encuentra («${r3.texto.replace(/\s+/g, ' ').slice(0, 80)}»)`)

  // 4: Mi memoria marca lo aprendido.
  await p.goto(`${BASE}/sistema/asistente/memoria`, { waitUntil: 'networkidle' })
  ok((await p.getByText('Aprendido', { exact: true }).count()) > 0, 'en Mi memoria, lo aprendido sale marcado y se puede olvidar')
  await p.screenshot({ path: 'capturas/asistente/memoria-aprendida.png' })
  ok(!errores.length, `sin errores de página${errores[0] ? `: ${errores[0].slice(0, 120)}` : ''}`)
} finally {
  await A.from('chat').delete().eq('dueno', u.id)
  await A.from('memoria').delete().eq('dueno', u.id)
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
