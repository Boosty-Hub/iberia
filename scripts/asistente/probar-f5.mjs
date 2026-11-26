/**
 * Asistente de IA · fase 5: tareas programadas, tableros vivos e investigación
 * profunda, contra el PROYECTO DE PRUEBAS (dev :3005) y con el reloj adelantado
 * (el programador acepta `ahora` fuera de producción).
 *
 * Para el correo, el dev de pruebas corre con ASISTENTE_CORREO_DESVIO=delivered@resend.dev
 * (la casilla de prueba de Resend) y la prueba pone de remitente onboarding@resend.dev;
 * para la reanudación, con ASISTENTE_TRAMO_MS=60000.
 *
 *   node --env-file=.env.local scripts/asistente/probar-f5.mjs [--solo programador|fallas|chat|tablero|investigacion]
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE = 'http://localhost:3005'
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Esto corre solo contra pruebas')
const solo = process.argv.includes('--solo') ? process.argv[process.argv.indexOf('--solo') + 1] : null
const toca = (s) => !solo || solo === s
const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const A = admin.schema('asistente')
let fallos = 0
const ok = (c, t) => {
  console.log(`${c ? '✓' : '✖'} ${t}`)
  if (!c) fallos++
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

async function sesion(email, nombre, rolClave) {
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 200 })
  let u = lista.users.find((x) => x.email === email)
  if (!u) u = (await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { nombre_completo: nombre, rol_clave: rolClave, organizacion: 'boosty' } })).data.user
  const { data: rol } = await admin.from('roles').select('id').eq('clave', rolClave).single()
  await admin.from('profiles').update({ rol_id: rol.id, activo: true, nombre_completo: nombre }).eq('id', u.id)
  const { data: enlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const { data: ver } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  return { s: ver.session, id: u.id, nombre, rolId: rol.id }
}
const cookies = (s) => {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const valor = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64url')
  const L = 3180
  const n = `sb-${ref}-auth-token`
  const partes = valor.length <= L ? [{ name: n, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${n}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
  return partes.map((p) => ({ ...p, domain: 'localhost', path: '/' }))
}
const comoUsuario = (q) => createClient(URL_SUPA, PUB, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${q.s.access_token}` } } })

async function tick(ahora) {
  const r = await fetch(`${BASE}/api/asistente/programador`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-asistente-secreto': process.env.ASISTENTE_SECRETO },
    body: JSON.stringify({ accion: 'tick', ahora }),
  })
  return (await r.json()).corridas ?? []
}
/** Espera a que la corrida termine (lista, fallida o saltada). */
async function esperarCorrida(id, ms = 300_000) {
  const fin = Date.now() + ms
  while (Date.now() < fin) {
    const { data } = await A.from('corrida').select('*').eq('id', id).single()
    if (['lista', 'fallida', 'saltada'].includes(data.estado)) return data
    await dormir(3000)
  }
  return (await A.from('corrida').select('*').eq('id', id).single()).data
}
const caracas = (iso) => new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))
const masSeg = (iso, s) => new Date(Date.parse(iso) + s * 1000).toISOString()

const yo = await sesion('admin.pruebas@plataforma.local', 'Administración de pruebas', 'administrador')
const otro = await sesion('consultor.pruebas@plataforma.local', 'Consultoría de pruebas', 'consultor')
const ca = comoUsuario(yo)

// Limpieza de corridas anteriores y configuración de la prueba (se devuelve al final).
await A.from('tarea').delete().in('dueno', [yo.id, otro.id])
const { data: configAntes } = await A.from('config').select('correo_remitente, tope_investigacion_usd, programador_pausado').eq('id', true).single()
await A.from('config').update({ correo_remitente: 'onboarding@resend.dev', tope_investigacion_usd: 1.5, programador_pausado: false }).eq('id', true)

const nav = await chromium.launch()
const pagina = async (q) => {
  const c = await nav.newContext({ viewport: { width: 1440, height: 900 } })
  await c.addCookies(cookies(q.s))
  return c.newPage()
}

try {
  // ─────────────────────────────────────────────────────────────────────────
  if (toca('programador')) {
    console.log('\n— El programador: tres semanas, sin doble corrida, linaje, correo y fuente perdida')
    const { data: t, error } = await ca
      .schema('asistente')
      .from('tarea')
      .insert({
        dueno: yo.id,
        nombre: 'Vacantes de la semana',
        instruccion: 'Consulta la tabla de plazas y dime en una sola línea cuántas plazas vacantes hay, citando la fuente. Además guarda un CSV vacantes.csv con ese número.',
        modelo: 'claude-haiku-5-5',
        frecuencia: 'semanal',
        hora: '08:00',
        dias: [1],
        canales: ['plataforma', 'correo'],
        destinatarios: [otro.id],
      })
      .select('*')
      .single()
    ok(!error && t, `la persona crea la tarea con su sesión ${error?.message ?? ''}`)
    ok(/lun/i.test(caracas(t.proxima_en)) && /08:00/.test(caracas(t.proxima_en)), `la próxima es un lunes a las 8:00 de Caracas (${caracas(t.proxima_en)})`)

    let ahora = masSeg(t.proxima_en, 30)
    const corridas = []
    for (let semana = 1; semana <= 3; semana++) {
      const tomadas = await tick(ahora)
      const otraVez = await tick(ahora)
      ok(tomadas.length === 1 && otraVez.length === 0, `semana ${semana}: corre una vez y no dos (${tomadas.length}, luego ${otraVez.length})`)
      const c = await esperarCorrida(tomadas[0])
      corridas.push(c)
      ok(c.estado === 'lista', `semana ${semana}: la corrida terminó (${c.estado}${c.error ? ` · ${c.error}` : ''})`)
      const { data: tt } = await A.from('tarea').select('proxima_en').eq('id', t.id).single()
      ok(Date.parse(tt.proxima_en) - Date.parse(c.programada_para) === 7 * 86400_000, `semana ${semana}: la próxima queda una semana después (${caracas(tt.proxima_en)})`)
      ahora = masSeg(tt.proxima_en, 30)
    }
    const c1 = corridas[0]
    const { data: chat } = await A.from('chat').select('titulo, dueno, tarea_id').eq('id', c1.chat_id).single()
    ok(chat.dueno === yo.id && chat.tarea_id === t.id && /^Tarea · Vacantes de la semana/.test(chat.titulo), `deja el chat «${chat.titulo}»`)
    const { data: turno } = await A.from('turno').select('solicitante, costo_usd').eq('id', c1.turno_id).single()
    ok(turno.solicitante === yo.id, `corre a nombre del dueño y gasta contra él (US$ ${Number(turno.costo_usd).toFixed(4)})`)
    const { data: q } = await A.from('consulta_fuente').select('fuente').eq('turno_id', c1.turno_id)
    ok((q ?? []).length > 0, `consultó la plataforma con los permisos del dueño (${[...new Set((q ?? []).map((x) => x.fuente))].join(', ')})`)
    const { data: aviso } = await admin.schema('nucleo').from('notificacion').select('texto, enlace').eq('destinatario', yo.id).ilike('texto', '%Vacantes de la semana%lista%').order('creado_en', { ascending: false }).limit(1).maybeSingle()
    ok(aviso && aviso.enlace === `/sistema/asistente/c/${corridas[2].chat_id}`, `aviso en la campana con el enlace a la corrida («${aviso?.texto}»)`)
    const e = c1.entregas
    ok(e.some((x) => x.canal === 'plataforma' && x.a === otro.nombre && x.estado === 'bloqueada'), `al destinatario sin Plazas no se le manda: «${e.find((x) => x.a === otro.nombre)?.detalle}»`)
    const { data: part } = await A.from('participante').select('perfil_id').eq('chat_id', c1.chat_id)
    ok(!(part ?? []).some((p) => p.perfil_id === otro.id), 'ni entra al chat de la corrida')
    const correo = e.filter((x) => x.canal === 'correo')
    ok(correo.length === 1 && correo[0].estado === 'enviada' && correo[0].a === yo.nombre, `el correo sale solo al dueño (${JSON.stringify(correo)})`)
    ok(!correo[0]?.detalle?.includes('adjunto'), 'y sin adjunto: el resultado trae datos de la plataforma')
    const { data: gen } = await A.from('archivo').select('nombre').eq('chat_id', c1.chat_id).eq('origen', 'generado')
    ok((gen ?? []).length >= 1, `el archivo generado sí queda en la plataforma (${(gen ?? []).map((g) => g.nombre).join(', ')})`)

    // El dueño pierde las fuentes que usó la última corrida: la corrida lo dice.
    const { data: tu } = await A.from('tarea').select('fuentes_usadas').eq('id', t.id).single()
    ok(tu.fuentes_usadas.length > 0, `la tarea recuerda qué fuentes usó (${tu.fuentes_usadas.join(', ')})`)
    const { data: alc } = await A.from('alcance_rol').select('*').eq('rol_id', yo.rolId).in('fuente', tu.fuentes_usadas)
    await A.from('alcance_rol').delete().eq('rol_id', yo.rolId).in('fuente', tu.fuentes_usadas)
    try {
      const [id4] = await tick(ahora)
      const c4 = await esperarCorrida(id4)
      const { data: m4 } = await A.from('mensaje').select('texto').eq('chat_id', c4.chat_id).eq('rol', 'asistente').single()
      const { data: q4 } = await A.from('consulta_fuente').select('fuente').eq('turno_id', c4.turno_id)
      console.log('   respuesta sin la fuente:', m4.texto.slice(0, 400).replace(/\n/g, ' '))
      ok(c4.estado === 'lista' && /(ya no tienes acceso|no tienes acceso|ya no puedes|sin acceso)/i.test(m4.texto.slice(0, 400)), 'si perdió una fuente, el resultado lo dice al principio')
      ok(!(q4 ?? []).some((x) => tu.fuentes_usadas.includes(x.fuente)), 'y no la consulta')
    } finally {
      if (alc?.length) await A.from('alcance_rol').upsert(alc)
    }
    await A.from('tarea').update({ estado: 'pausada' }).eq('id', t.id)

    // Sin datos de la plataforma, el archivo sí va adjunto. Y «Correr ahora» desde la pantalla.
    const { data: t2 } = await ca
      .schema('asistente')
      .from('tarea')
      .insert({ dueno: yo.id, nombre: 'Archivo de prueba', instruccion: 'Genera un archivo numeros.csv con una columna n y las filas 1, 2 y 3, y dime en una línea que está listo. No consultes la plataforma.', modelo: 'claude-haiku-5-5', frecuencia: 'diaria', hora: '06:00', canales: ['plataforma', 'correo'] })
      .select('id')
      .single()
    const p = await pagina(yo)
    await p.goto(`${BASE}/sistema/asistente/tareas`, { waitUntil: 'networkidle' })
    await p.screenshot({ path: 'capturas/asistente/f5-tareas.png', fullPage: true })
    await p.locator(`[data-tarea="${t2.id}"]`).getByRole('button', { name: 'Correr ahora' }).click()
    await p.waitForSelector('text=Corriendo; te aviso al terminar.', { timeout: 30_000 }).catch(() => null)
    const { data: cm } = await A.from('corrida').select('id, manual').eq('tarea_id', t2.id).order('creado_en', { ascending: false }).limit(1).single()
    ok(cm?.manual, '«Correr ahora» desde la pantalla lanza una corrida a mano')
    const c5 = await esperarCorrida(cm.id)
    ok(c5.entregas.some((x) => x.canal === 'correo' && x.estado === 'enviada' && /adjunto/.test(x.detalle ?? '')), `sin datos de la plataforma, el correo lleva el adjunto (${JSON.stringify(c5.entregas.filter((x) => x.canal === 'correo'))})`)
    await p.reload({ waitUntil: 'networkidle' })
    await p.locator(`[data-tarea="${t2.id}"]`).getByRole('button', { name: /Historial/ }).click()
    await p.screenshot({ path: 'capturas/asistente/f5-historial.png', fullPage: true })
    await A.from('tarea').update({ estado: 'pausada' }).eq('id', t2.id)
    await p.context().close()
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (toca('fallas')) {
    console.log('\n— Fallas: reintenta una vez; a las tres seguidas, se pausa y avisa')
    await A.from('modelo').upsert({ id: 'claude-falla-prueba', proveedor: 'anthropic', nombre: 'Falla (prueba)', precio_entrada: 1, precio_salida: 1, esfuerzos: ['low', 'medium'], encendido: true, orden: 99, verificado_en: '2026-11-26' })
    try {
      const { data: t, error } = await ca
        .schema('asistente')
        .from('tarea')
        .insert({ dueno: yo.id, nombre: 'Tarea que falla', instruccion: 'Di hola en una línea.', modelo: 'claude-falla-prueba', frecuencia: 'diaria', hora: '07:00', canales: ['plataforma'] })
        .select('*')
        .single()
      if (error) throw error
      let ahora = masSeg(t.proxima_en, 30)
      const [a1] = await tick(ahora)
      const r1 = await esperarCorrida(a1)
      ok(r1.estado === 'fallida', `primera corrida falla (${r1.error?.slice(0, 80)})`)
      const { data: re } = await A.from('corrida').select('id, intento, estado, reintentar_en').eq('tarea_id', t.id).eq('intento', 2).maybeSingle()
      ok(re?.estado === 'en_cola' && Date.parse(re.reintentar_en) - Date.now() > 4 * 60_000, 'queda un reintento en cola para dentro de 5 minutos')
      const [a2] = await tick(masSeg(new Date().toISOString(), 6 * 60))
      ok(a2 === re.id, 'el reintento se toma a su hora')
      const r2 = await esperarCorrida(a2)
      ok(r2.estado === 'fallida', 'el reintento también falla')
      const { data: t1 } = await A.from('tarea').select('proxima_en, fallas_seguidas, estado').eq('id', t.id).single()
      ok(t1.fallas_seguidas === 2 && t1.estado === 'activa', `van ${t1.fallas_seguidas} fallas seguidas y sigue activa`)
      const [a3] = await tick(masSeg(t1.proxima_en, 30))
      const r3 = await esperarCorrida(a3)
      const { data: t3 } = await A.from('tarea').select('fallas_seguidas, estado, pausada_motivo, proxima_en').eq('id', t.id).single()
      ok(r3.estado === 'fallida' && t3.estado === 'pausada' && t3.proxima_en === null, `a la tercera falla seguida se pausa sola («${t3.pausada_motivo}»)`)
      const { data: av } = await admin.schema('nucleo').from('notificacion').select('texto').eq('destinatario', yo.id).ilike('texto', '%Tarea que falla%pausó%').limit(1).maybeSingle()
      ok(!!av, `y avisa: «${av?.texto}»`)
      const { error: eRe } = await ca.schema('asistente').from('tarea').update({ estado: 'activa' }).eq('id', t.id)
      const { data: t4 } = await A.from('tarea').select('fallas_seguidas, estado').eq('id', t.id).single()
      ok(!eRe && t4.estado === 'activa' && t4.fallas_seguidas === 0, 'al reanudarla, la cuenta de fallas vuelve a cero')
      await A.from('tarea').delete().eq('id', t.id)
    } finally {
      await A.from('modelo').delete().eq('id', 'claude-falla-prueba')
    }

    // Lo que la base no deja.
    const { error: e1 } = await ca.schema('asistente').from('tarea').insert({ dueno: yo.id, nombre: 'Cada hora', instruccion: 'Di hola.', frecuencia: 'horas', cada_horas: 1, hora: '08:00', canales: ['plataforma'] }).select('id').single()
    const { error: e0 } = await ca.schema('asistente').from('tarea').insert({ dueno: otro.id, nombre: 'Ajena', instruccion: 'Di hola.', frecuencia: 'diaria', hora: '08:00', canales: ['plataforma'] }).select('id').single()
    ok(!!e0, 'nadie crea tareas a nombre de otro')
    ok(!e1, 'cada hora se permite con la frecuencia mínima de fábrica (1 h)')
    await A.from('config').update({ frecuencia_min_min: 360 }).eq('id', true)
    const { error: e2 } = await ca.schema('asistente').from('tarea').insert({ dueno: yo.id, nombre: 'Cada dos horas', instruccion: 'Di hola.', frecuencia: 'horas', cada_horas: 2, hora: '08:00', canales: ['plataforma'] }).select('id').single()
    ok(!!e2 && /6 horas/.test(e2.message), `pero no por debajo de la frecuencia mínima de la administración («${e2?.message}»)`)
    await A.from('config').update({ frecuencia_min_min: 60 }).eq('id', true)
    await A.from('tarea').delete().eq('dueno', yo.id).in('nombre', ['Cada hora', 'Cada dos horas'])
    // Lo que lleva la cuenta es del programador, y el máximo de tareas activas lo fija la administración.
    const { data: tc } = await ca.schema('asistente').from('tarea').insert({ dueno: yo.id, nombre: 'Cuenta', instruccion: 'Di hola.', frecuencia: 'diaria', hora: '08:00', canales: ['plataforma'] }).select('id').single()
    await A.from('tarea').update({ fallas_seguidas: 2, fuentes_usadas: ['tabla:plazas'] }).eq('id', tc.id)
    await ca.schema('asistente').from('tarea').update({ fallas_seguidas: 0, fuentes_usadas: [], nombre: 'Cuenta 2' }).eq('id', tc.id)
    const { data: tc2 } = await A.from('tarea').select('nombre, fallas_seguidas, fuentes_usadas').eq('id', tc.id).single()
    ok(tc2.nombre === 'Cuenta 2' && tc2.fallas_seguidas === 2 && tc2.fuentes_usadas.length === 1, 'la persona cambia su tarea, pero no la cuenta de fallas ni el linaje')
    await A.from('config').update({ max_tareas: 1 }).eq('id', true)
    const { error: eMax } = await ca.schema('asistente').from('tarea').insert({ dueno: yo.id, nombre: 'Otra más', instruccion: 'Di hola.', frecuencia: 'diaria', hora: '09:00', canales: ['plataforma'] }).select('id').single()
    ok(!!eMax && /máximo/.test(eMax.message), `el máximo de tareas activas se respeta («${eMax?.message}»)`)
    await A.from('config').update({ max_tareas: 10 }).eq('id', true)
    await A.from('tarea').delete().eq('id', tc.id)
    const { error: e3 } = await ca.schema('asistente').rpc('tomar_vencidas', {})
    ok(!!e3, 'una sesión no puede tomar la cola del programador')
    const r = await fetch(`${BASE}/api/asistente/programador`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'tick' }) })
    ok(r.status === 401, `la ruta del programador pide el secreto (${r.status})`)
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (toca('chat')) {
    console.log('\n— La propuesta desde el chat: la IA propone, la persona confirma')
    const p = await pagina(yo)
    await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
    await p.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
    await p.getByLabel('Mensaje para el asistente').fill('Programa que cada lunes y jueves a las 7:30 de la mañana me mandes por correo un resumen de las plazas vacantes por unidad.')
    await p.getByRole('button', { name: 'Enviar' }).click()
    await p.waitForSelector('[data-propuesta]', { timeout: 180_000 })
    await p.waitForFunction(() => !document.querySelector('[aria-live=polite]') && document.querySelectorAll('[aria-label="Copiar la respuesta"]').length >= 1, null, { timeout: 180_000 })
    const tarjeta = await p.locator('[data-propuesta]').innerText()
    ok(/lunes y jueves a las 7:30/i.test(tarjeta) && /Correo/.test(tarjeta), `la tarjeta propone «${tarjeta.split('\n').slice(1, 3).join(' · ')}»`)
    const chat = p.url().split('/c/')[1]
    const { count: antes } = await A.from('tarea').select('id', { count: 'exact', head: true }).eq('dueno', yo.id).eq('origen_chat', chat)
    ok(antes === 0, 'hasta confirmarla, la tarea no existe')
    await p.locator('[data-propuesta]').getByRole('button', { name: 'Programar' }).click()
    await p.waitForSelector('text=✓ Programada', { timeout: 20_000 })
    const { data: t } = await A.from('tarea').select('*').eq('dueno', yo.id).eq('origen_chat', chat).single()
    ok(t && t.frecuencia === 'semanal' && t.dias.join() === '1,4' && String(t.hora).startsWith('07:30') && t.canales.includes('correo'), `queda programada como se propuso (${t?.dias}, ${t?.hora}, ${t?.canales})`)
    await p.reload({ waitUntil: 'networkidle' })
    ok((await p.locator('text=✓ Programada').count()) > 0, 'al volver al chat, la tarjeta dice que ya está programada')
    await p.screenshot({ path: 'capturas/asistente/f5-propuesta.png' })
    await A.from('tarea').delete().eq('id', t.id)
    await p.context().close()
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (toca('tablero')) {
    console.log('\n— Tablero vivo: «Mantener al día», versión nueva a su hora, en Mi día')
    const p = await pagina(yo)
    await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
    await p.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
    await p.getByLabel('Mensaje para el asistente').fill('Consulta la tabla de plazas y hazme un tablero HTML sencillo con el total de plazas, las vacantes y una barra por estado. Pon «Datos al» con la fecha.')
    await p.getByRole('button', { name: 'Enviar' }).click()
    await p.waitForFunction(() => !document.querySelector('[aria-live=polite]') && document.querySelectorAll('[aria-label="Copiar la respuesta"]').length >= 1, null, { timeout: 300_000 })
    const chat = p.url().split('/c/')[1]
    const { data: h1 } = await A.from('html').select('id, grupo, version').eq('chat_id', chat).order('creado_en', { ascending: false }).limit(1).single()
    ok(!!h1, 'el tablero existe')
    if (!(await p.getByRole('button', { name: 'Mantener al día' }).count())) await p.locator('button:has-text("Abrir")').last().click()
    await p.getByRole('button', { name: 'Mantener al día' }).click()
    await p.locator('#mad-frec').selectOption('diaria')
    await p.locator('#mad-hora').fill('06:30')
    await p.screenshot({ path: 'capturas/asistente/f5-mantener.png' })
    await p.getByRole('dialog', { name: 'Mantener al día' }).getByRole('button', { name: 'Programar' }).click()
    await p.waitForSelector('text=/Listo: todos los días a las 6:30/', { timeout: 20_000 })
    const { data: t } = await A.from('tarea').select('*').eq('html_grupo', h1.grupo).single()
    ok(t?.tipo === 'tablero' && t.en_mi_dia, 'queda un tablero vivo, fijado en Mi día')
    const [cid] = await tick(masSeg(t.proxima_en, 30))
    const c = await esperarCorrida(cid)
    const { data: h2 } = await A.from('html').select('id, version, chat_id').eq('grupo', h1.grupo).order('version', { ascending: false }).limit(1).single()
    ok(c.estado === 'lista' && h2.version === h1.version + 1, `la corrida le agrega una versión al mismo tablero (v${h2.version}, ${c.estado})`)
    await p.goto(`${BASE}/sistema`, { waitUntil: 'networkidle' })
    const card = p.locator(`[data-tablero="${t.id}"]`)
    ok((await card.count()) > 0 && /Datos al/.test(await card.innerText()), `Mi día lo muestra con la fecha de sus datos («${(await card.innerText()).split('\n')[1]}»)`)
    await p.waitForTimeout(2500)
    await p.screenshot({ path: 'capturas/asistente/f5-mi-dia.png' })
    await A.from('tarea').delete().eq('id', t.id)
    await p.context().close()
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (toca('investigacion')) {
    console.log('\n— Investigación profunda: tramos, tope e informe con fuentes')
    const p = await pagina(yo)
    await p.goto(`${BASE}/sistema/asistente`, { waitUntil: 'networkidle' })
    await p.getByLabel('Modelo').selectOption('claude-sonnet-5-5')
    await p.getByRole('button', { name: /Investigación/ }).click()
    await p.screenshot({ path: 'capturas/asistente/f5-investigacion-modo.png' })
    await p.getByLabel('Mensaje para el asistente').fill('Investiga el mercado de mayonesas en Venezuela en 2025 y 2026: principales marcas, presentaciones y tendencias de precio. Informe breve.')
    await p.getByRole('button', { name: 'Enviar' }).click()
    await p.waitForFunction(() => !document.querySelector('[aria-live=polite]') && document.querySelectorAll('[aria-label="Copiar la respuesta"]').length >= 1, null, { timeout: 1_200_000 })
    const chat = p.url().split('/c/')[1]
    const { data: t } = await A.from('turno').select('estado, modo, tramos, costo_usd, duracion_ms').eq('chat_id', chat).single()
    ok(t.modo === 'investigacion' && t.estado === 'listo', `terminó en modo investigación (${t.estado})`)
    ok(t.tramos >= 1, `se partió en ${t.tramos + 1} tramos y siguió donde iba (${Math.round(t.duracion_ms / 1000)} s)`)
    ok(Number(t.costo_usd) <= 1.5 * 1.25, `respetó su tope de US$ 1,50 (US$ ${Number(t.costo_usd).toFixed(3)})`)
    const { data: m } = await A.from('mensaje').select('bloques').eq('chat_id', chat).eq('rol', 'asistente').single()
    const informe = m.bloques.find((b) => b.tipo === 'artefacto')
    const fuentes = m.bloques.filter((b) => b.tipo === 'fuente').length
    ok(!!informe && fuentes >= 3, `entregó el informe «${informe?.titulo}» con ${fuentes} fuentes`)
    await p.screenshot({ path: 'capturas/asistente/f5-investigacion.png' })
    await p.context().close()
  }
} finally {
  await A.from('config').update(configAntes).eq('id', true)
  await A.from('tarea').delete().in('dueno', [yo.id, otro.id])
  await nav.close()
}
console.log(fallos ? `\n${fallos} fallo(s)` : '\nTodo bien.')
process.exit(fallos ? 1 : 0)
