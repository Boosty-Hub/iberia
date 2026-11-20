/**
 * Plataforma Iberia · R3 · trabajo en equipo, contra el PROYECTO DE PRUEBAS.
 *
 * Con sesiones reales de las cuentas de prueba (admin, consultor, usuario,
 * lector; nunca la de una persona de Iberia) comprueba en la base:
 *   · una mención avisa al mencionado y solo si puede ver el objeto;
 *   · seguir un proceso avisa de cada comentario, menos al autor;
 *   · enviar una requisición avisa a quien decide el paso actual, aprobar un paso
 *     avisa a quien pidió y a los del paso siguiente, y todo queda en la línea;
 *   · las tareas avisan, se ven solo entre quien crea y quien recibe;
 *   · la ventana de 15 minutos, ocultar, marcar leído y que nadie escriba eventos
 *     ni notificaciones a mano.
 * Con `--ui` recorre además la interfaz en el 3005 (Playwright): el consultor
 * menciona al admin en una plaza, el admin ve el número en la campana y abre el
 * objeto desde ella, y Mi día enseña la tarea vencida. Capturas en
 * `capturas/sistema/colaboracion-*.png`. Al final borra lo que creó.
 *
 *   node --env-file=.env.local scripts/plataforma/probar-colaboracion.mjs [--ui] [--base http://localhost:3005]
 */
import { createClient } from '@supabase/supabase-js'
import { mkdir } from 'node:fs/promises'

const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
const CON_UI = argv.includes('--ui')
const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !PUB || !SECRETO) throw new Error('Faltan las variables SUPABASE_PRUEBAS_* en .env.local')
if (URL_SUPA === process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se corre')

const servicio = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const MARCA = `[r3-prueba ${Date.now().toString(36)}]`

let fallos = 0
let pasos = 0
function ok(cond, texto, extra) {
  pasos++
  if (cond) console.log(`  ✓ ${texto}`)
  else {
    fallos++
    console.log(`  ✖ ${texto}${extra ? ` · ${typeof extra === 'string' ? extra : JSON.stringify(extra)}` : ''}`)
  }
}

async function sesion(email) {
  const { data: enlace, error: e1 } = await servicio.auth.admin.generateLink({ type: 'magiclink', email })
  if (e1) throw new Error(`${email}: ${e1.message} (¿corriste mirar.mjs --como … una vez?)`)
  const { data, error } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (error) throw error
  const cliente = createClient(URL_SUPA, PUB, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })
  return { cliente, id: data.user.id, sesion: data.session, email }
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))
const n = (c) => c.schema('nucleo')

const creado = { eventos: [], tareas: [], seguimientos: [], requisiciones: [] }

const [admin, consultor, usuario, lector] = await Promise.all(
  ['admin', 'consultor', 'usuario', 'lector'].map((r) => sesion(`${r}.pruebas@plataforma.local`))
)
const { data: perfilAdmin } = await servicio.from('profiles').select('nombre_completo').eq('id', admin.id).single()
const nombreAdmin = perfilAdmin.nombre_completo

// Un objeto de cada tipo para probar.
const { data: plaza } = await servicio.schema('org').from('plaza').select('ref').is('escenario_id', null).limit(1).single()
const { data: proceso } = await servicio.schema('sgc').from('proceso').select('ref').is('escenario_id', null).eq('estado', 'vigente').limit(1).single()

async function noLeidas(u) {
  const { data } = await n(u.cliente).rpc('no_leidas')
  return data ?? 0
}

try {
  console.log('\n1 · Mención en una plaza')
  const antesAdmin = await noLeidas(admin)
  const texto = `${MARCA} @${nombreAdmin} ¿esta plaza queda con dos turnos en 2027?`
  const { data: idComentario, error: eC } = await n(consultor.cliente).rpc('comentar', {
    p_tipo: 'plaza',
    p_id: plaza.ref,
    p_texto: texto,
    p_menciones: [admin.id],
  })
  ok(!eC && idComentario, 'el consultor comenta en la plaza mencionando al admin', eC?.message)
  if (idComentario) creado.eventos.push(idComentario)
  const { data: mencion } = await n(admin.cliente).from('notificacion').select('id, tipo, texto, objeto_tipo, objeto_id, leida_en').eq('evento_id', idComentario).maybeSingle()
  ok(mencion?.tipo === 'mencion' && mencion.objeto_id === plaza.ref && !mencion.leida_en, 'al admin le llega la mención, sin leer, con el objeto', mencion)
  ok((await noLeidas(admin)) === antesAdmin + 1, 'el número de la campana del admin sube en uno')
  const { data: ajena } = await n(lector.cliente).from('notificacion').select('id').eq('evento_id', idComentario)
  ok(!ajena?.length, 'el lector no lee la notificación ajena')
  const { data: verLector } = await n(lector.cliente).from('evento').select('id').eq('id', idComentario)
  ok(verLector?.length === 1, 'el lector (con estructura) lee el comentario de la plaza')
  const { data: sigue } = await n(consultor.cliente).from('seguimiento').select('perfil').eq('objeto_id', plaza.ref)
  ok(sigue?.length === 1, 'quien comenta queda siguiendo el objeto')
  creado.seguimientos.push({ perfil: consultor.id, objeto_id: plaza.ref })

  console.log('\n2 · Escribir a mano no se puede')
  const { error: eDirecto } = await n(usuario.cliente).from('evento').insert({ objeto_tipo: 'plaza', objeto_id: plaza.ref, tipo: 'comentario', autor: usuario.id, texto: 'directo' })
  ok(Boolean(eDirecto), 'nadie inserta un evento sin pasar por nucleo.comentar', eDirecto?.message)
  const { error: eNoti } = await n(usuario.cliente).from('notificacion').insert({ destinatario: admin.id, tipo: 'sistema', texto: 'falsa' })
  ok(Boolean(eNoti), 'nadie se fabrica (ni le fabrica a otro) una notificación')
  const { data: suplanta } = await n(usuario.cliente).rpc('comentar', { p_tipo: 'requisicion', p_id: '00000000-0000-0000-0000-000000000000', p_texto: 'x' })
  ok(!suplanta, 'no se comenta un objeto fuera de alcance')
  const { data: leidasAjenas } = await n(usuario.cliente).rpc('marcar_leidas', { p_ids: [mencion?.id] })
  ok(leidasAjenas === 0, 'marcar leída una notificación ajena no hace nada')

  console.log('\n3 · Ventana de 15 minutos y ocultar')
  const { data: ed } = await n(consultor.cliente).from('evento').update({ texto: `${texto} (corregido)` }).eq('id', idComentario).select('editado_en')
  ok(ed?.length === 1 && ed[0].editado_en, 'el autor corrige su comentario y queda «editado»')
  const { data: edAjeno } = await n(admin.cliente).from('evento').update({ texto: 'pisado' }).eq('id', idComentario).select('id')
  ok(!edAjeno?.length, 'otra persona no lo corrige')
  const { data: aud } = await servicio.schema('control').from('auditoria').select('antes').eq('esquema', 'nucleo').eq('registro_id', idComentario).limit(1)
  ok(aud?.[0]?.antes?.texto === texto, 'la auditoría guarda el original')
  const { data: id2 } = await n(consultor.cliente).rpc('comentar', { p_tipo: 'plaza', p_id: plaza.ref, p_texto: `${MARCA} este lo voy a ocultar`, p_padre: idComentario })
  creado.eventos.push(id2)
  const { data: hilo } = await n(admin.cliente).from('evento').select('padre_id').eq('id', id2).single()
  ok(hilo?.padre_id === idComentario, 'una respuesta cuelga de su comentario')
  await n(consultor.cliente).from('evento').update({ oculto: true }).eq('id', id2)
  const { data: ocultoAdmin } = await n(admin.cliente).from('evento').select('id').eq('id', id2)
  const { data: ocultoAutor } = await n(consultor.cliente).from('evento').select('id').eq('id', id2)
  ok(!ocultoAdmin?.length && ocultoAutor?.length === 1, 'oculto: solo su autor lo sigue viendo')
  await servicio.schema('nucleo').from('evento').update({ creado_en: new Date(Date.now() - 20 * 60_000).toISOString() }).eq('id', idComentario)
  const { error: eTarde } = await n(consultor.cliente).from('evento').update({ texto: 'tarde' }).eq('id', idComentario)
  ok(Boolean(eTarde) && /15 minutos/.test(eTarde.message), 'pasados 15 minutos ya no se corrige', eTarde?.message)

  console.log('\n4 · Seguir un proceso')
  const { error: eSeg } = await n(admin.cliente).from('seguimiento').insert({ perfil: admin.id, objeto_tipo: 'proceso', objeto_id: proceso.ref })
  ok(!eSeg, 'el admin sigue un proceso', eSeg?.message)
  creado.seguimientos.push({ perfil: admin.id, objeto_id: proceso.ref })
  const { data: idProc } = await n(consultor.cliente).rpc('comentar', { p_tipo: 'proceso', p_id: proceso.ref, p_texto: `${MARCA} propongo revisar las entradas del proceso` })
  creado.eventos.push(idProc)
  const { data: segNoti } = await n(admin.cliente).from('notificacion').select('tipo, texto').eq('evento_id', idProc)
  ok(segNoti?.length === 1 && segNoti[0].tipo === 'seguimiento', 'al admin le llega el aviso de lo que sigue', segNoti)
  const { data: autorNoti } = await n(consultor.cliente).from('notificacion').select('id').eq('evento_id', idProc)
  ok(!autorNoti?.length, 'el autor no se avisa a sí mismo')
  const { data: cambios } = await n(lector.cliente).rpc('cambios', { p_tipo: 'plaza', p_id: plaza.ref, p_limite: 5 })
  ok(Array.isArray(cambios), 'la línea de cambios responde a quien ve la plaza')

  console.log('\n5 · Una requisición que avanza')
  const { data: origen } = await servicio.schema('control').from('catalogo').select('clave').eq('tipo', 'origen_requisicion').eq('clave', 'vacante').maybeSingle()
  const { data: origenes } = await servicio.schema('control').from('catalogo').select('clave').eq('tipo', 'origen_requisicion').neq('clave', 'cargo_nuevo').limit(1)
  const { data: pz } = await servicio.schema('org').from('plaza').select('ref, unidad_ref, cargo_id').is('escenario_id', null).limit(1).single()
  const idReq = crypto.randomUUID()
  const { error: eReq } = await usuario.cliente.schema('org').from('requisicion').insert({
    id: idReq,
    unidad_ref: pz.unidad_ref,
    cargo_id: pz.cargo_id,
    origen: origen?.clave ?? origenes[0].clave,
    cantidad: 1,
    justificacion: `${MARCA} prueba automática de avisos de aprobación`,
    creado_por: usuario.id,
  })
  ok(!eReq, 'la usuaria crea una requisición', eReq?.message)
  creado.requisiciones.push(idReq)
  const { error: eEnv } = await usuario.cliente.schema('org').rpc('enviar_requisicion', { p_req: idReq })
  ok(!eEnv, 'y la envía a aprobación', eEnv?.message)
  const { data: solicitud } = await servicio.schema('flujo').from('solicitud').select('id, paso_actual, paso(id, orden, nombre, aprobador_perfil)').eq('objeto_id', idReq).single()
  const actual = solicitud.paso.find((p) => p.orden === solicitud.paso_actual)
  const { data: avisosAprob } = await servicio.schema('nucleo').from('notificacion').select('destinatario, texto').eq('objeto_id', idReq).eq('tipo', 'aprobacion')
  const destinatarios = new Set((avisosAprob ?? []).map((a) => a.destinatario))
  const esperados = actual.aprobador_perfil ? [actual.aprobador_perfil] : [admin.id, consultor.id]
  ok(esperados.every((d) => destinatarios.has(d)) && !destinatarios.has(usuario.id), `el paso actual («${actual.nombre}») avisa a quien lo decide y no a quien pidió`, [...destinatarios])
  const { data: lineaReq } = await n(usuario.cliente).from('evento').select('tipo, datos').eq('objeto_id', idReq)
  ok(lineaReq?.some((e) => e.datos?.accion === 'enviada'), 'la línea de tiempo de la requisición dice que se envió')
  const { data: estado } = await consultor.cliente.schema('flujo').rpc('decidir', { p_paso: actual.id, p_decision: 'aprobado', p_comentario: `${MARCA} visto bueno` })
  ok(estado === 'en_curso' || estado === 'aprobada', 'el consultor aprueba el paso', estado)
  await esperar(300)
  const { data: lineaReq2 } = await n(usuario.cliente).from('evento').select('datos, texto').eq('objeto_id', idReq).eq('tipo', 'aprobacion')
  ok(lineaReq2?.some((e) => e.datos?.accion === 'aprobado' && e.texto?.includes('visto bueno')), 'la decisión y su comentario quedan en la línea de tiempo')
  const { data: viejos } = await n(admin.cliente).from('notificacion').select('id').eq('objeto_id', idReq).ilike('texto', `%${actual.nombre}%`).is('leida_en', null)
  ok(!viejos?.length, 'el «te toca decidir» del paso ya decidido se da por leído')
  const { data: avisoPidio } = await n(usuario.cliente).from('notificacion').select('texto').eq('objeto_id', idReq)
  ok(avisoPidio?.length >= 1, 'a quien pidió le llega que avanzó', avisoPidio)
  const { error: eCan } = await usuario.cliente.schema('org').rpc('cancelar_requisicion', { p_req: idReq, p_motivo: `${MARCA} era una prueba` })
  ok(!eCan, 'la usuaria la cancela', eCan?.message)
  const { data: lineaReq3 } = await n(usuario.cliente).from('evento').select('datos').eq('objeto_id', idReq)
  ok(lineaReq3?.some((e) => e.datos?.accion === 'cancelada'), 'la cancelación queda en la línea de tiempo')
  const { data: verReqLector } = await n(lector.cliente).from('evento').select('id').eq('objeto_id', idReq)
  ok(!verReqLector?.length, 'el lector (sin requisiciones) no lee esa línea de tiempo')

  console.log('\n6 · Tareas')
  const ayer = new Date(Date.now() - 86_400_000 - 4 * 3_600_000).toISOString().slice(0, 10)
  const idTarea = crypto.randomUUID()
  const { error: eT } = await n(consultor.cliente).from('tarea').insert({
    id: idTarea,
    titulo: `${MARCA} revisar la dotación de la plaza`,
    asignada_a: admin.id,
    creada_por: consultor.id,
    vence: ayer,
    objeto_tipo: 'plaza',
    objeto_id: plaza.ref,
  })
  ok(!eT, 'el consultor le asigna al admin una tarea sobre la plaza, vencida ayer', eT?.message)
  creado.tareas.push(idTarea)
  const { data: tAdmin } = await n(admin.cliente).from('tarea').select('id, vence').eq('id', idTarea)
  ok(tAdmin?.length === 1, 'el admin la ve')
  const { data: tLector } = await n(lector.cliente).from('tarea').select('id').eq('id', idTarea)
  ok(!tLector?.length, 'otra persona no')
  const { data: tNoti } = await n(admin.cliente).from('notificacion').select('tipo').eq('tipo', 'tarea').eq('objeto_id', plaza.ref)
  ok(tNoti?.length >= 1, 'al admin le llega el aviso de la tarea')
  const idT2 = crypto.randomUUID()
  const { error: eT2 } = await n(consultor.cliente).from('tarea').insert({ id: idT2, titulo: `${MARCA} sin acceso`, asignada_a: lector.id, creada_por: consultor.id, objeto_tipo: 'requisicion', objeto_id: idReq })
  ok(Boolean(eT2) && /no puede ver/.test(eT2.message), 'no se asigna una tarea sobre un objeto que esa persona no ve', eT2?.message)

  console.log('\n7 · Marcar leído')
  const antes = await noLeidas(admin)
  const { data: marcadas } = await n(admin.cliente).rpc('marcar_leidas', { p_ids: [mencion?.id] })
  ok(marcadas === 1 && (await noLeidas(admin)) === antes - 1, 'el admin marca leída su mención y la campana baja')

  if (CON_UI) await probarUi()
} finally {
  // Limpieza: lo creado por la prueba.
  const s = servicio.schema('nucleo')
  if (creado.tareas.length) await s.from('tarea').delete().in('id', creado.tareas)
  await s.from('notificacion').delete().or(`texto.ilike.%${MARCA}%,detalle.ilike.%${MARCA}%`)
  const { data: evs } = await s.from('evento').select('id').ilike('texto', `%${MARCA}%`)
  const ids = [...new Set([...creado.eventos.filter(Boolean), ...(evs ?? []).map((e) => e.id)])]
  if (ids.length) {
    await s.from('notificacion').delete().in('evento_id', ids)
    await s.from('evento').delete().in('padre_id', ids)
    await s.from('evento').delete().in('id', ids)
  }
  for (const r of creado.requisiciones) {
    await usuario.cliente.schema('org').rpc('cancelar_requisicion', { p_req: r, p_motivo: `${MARCA} limpieza` })
    await s.from('notificacion').delete().eq('objeto_id', r)
    await s.from('evento').delete().eq('objeto_id', r)
  }
  for (const x of creado.seguimientos) await s.from('seguimiento').delete().eq('perfil', x.perfil).eq('objeto_id', x.objeto_id)
  console.log(`\n${pasos - fallos}/${pasos} comprobaciones bien${fallos ? ` · ${fallos} FALLARON` : ''}. Limpieza hecha.`)
  process.exitCode = fallos ? 1 : 0
}

async function probarUi() {
  const { chromium } = await import('playwright')
  await mkdir('capturas/sistema', { recursive: true })
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const galletas = (s) => {
    const nombre = `sb-${ref}-auth-token`
    const valor = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64url')
    const L = 3180
    const partes = valor.length <= L ? [{ name: nombre, value: valor }] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => ({ name: `${nombre}.${i}`, value: valor.slice(i * L, (i + 1) * L) }))
    return partes.map((p) => ({ ...p, domain: new URL(BASE).hostname, path: '/' }))
  }
  // Cuatro entradas de IA de muestra, una por nivel, para ver su lenguaje visual (se borran al final).
  const hace = (min) => new Date(Date.now() - min * 60_000).toISOString()
  const { error: eIa } = await servicio.schema('nucleo').from('evento').insert([
    { objeto_tipo: 'plaza', objeto_id: plaza.ref, tipo: 'ia', actor_es_ia: true, capacidad_ia: 'NUC-ORG-IA-01', nivel_ia: 'N1', texto: `${MARCA} Resumen: la plaza tiene dos titulares y ninguna vacante.`, datos: {}, creado_en: hace(50) },
    { objeto_tipo: 'plaza', objeto_id: plaza.ref, tipo: 'ia', actor_es_ia: true, capacidad_ia: 'NUC-ORG-IA-05', nivel_ia: 'N2', texto: `${MARCA} La plaza está por encima de la dotación desde marzo.`, datos: { evidencia: 'Padrón de Capital Humano y organigrama II-21-14-003.' }, creado_en: hace(40) },
    { objeto_tipo: 'plaza', objeto_id: plaza.ref, tipo: 'ia', actor_es_ia: true, capacidad_ia: 'NUC-ORG-IA-07', nivel_ia: 'N3', texto: `${MARCA} Propongo abrir un escenario con dotación 3.`, datos: { evidencia: 'Turno de embalaje en 2026.' }, creado_en: hace(30) },
    { objeto_tipo: 'plaza', objeto_id: plaza.ref, tipo: 'ia', actor_es_ia: true, capacidad_ia: 'NUC-DOC-IA-02', nivel_ia: 'N4', texto: `${MARCA} Clasifiqué 2 documentos de la plaza (solo metadatos).`, datos: { deshacer_hasta: new Date(Date.now() + 10 * 60_000).toISOString() }, creado_en: hace(20) },
  ])
  ok(!eIa, 'cuatro entradas de IA de muestra (N1–N4)', eIa?.message)
  const nav = await chromium.launch()
  try {
    console.log('\n8 · Interfaz: el consultor menciona al admin desde la ficha de la plaza')
    const cc = await nav.newContext({ viewport: { width: 1440, height: 900 } })
    await cc.addCookies(galletas(consultor.sesion))
    const pc = await cc.newPage()
    await pc.goto(`${BASE}/sistema?ficha=plaza:${plaza.ref}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await pc.getByRole('tab', { name: /Línea de tiempo/ }).click({ timeout: 60_000 })
    const caja = pc.getByRole('combobox', { name: /Comenta o menciona/ })
    await caja.waitFor({ timeout: 60_000 })
    await caja.click()
    await caja.pressSequentially(`${MARCA} Hola @${nombreAdmin.split(' ')[0].slice(0, 5)}`, { delay: 15 })
    const opcion = pc.getByRole('option', { name: new RegExp(nombreAdmin) })
    await opcion.waitFor({ timeout: 20_000 })
    ok(true, 'la lista de @ ofrece al admin')
    await caja.press('Enter')
    await caja.pressSequentially('revisa esta plaza, por favor', { delay: 10 })
    await pc.getByRole('button', { name: 'Comentar', exact: true }).click()
    // La caja se vacía cuando la base guardó, y el comentario sale en la lista.
    await pc.waitForFunction(() => !document.querySelector('[role=combobox][aria-autocomplete=list]')?.value, null, { timeout: 30_000 })
    await pc.getByRole('list', { name: 'Línea de tiempo' }).getByText('revisa esta plaza, por favor').first().waitFor({ timeout: 30_000 })
    ok(true, 'el comentario aparece en la línea de tiempo')
    await pc.screenshot({ path: 'capturas/sistema/colaboracion-consultor-comenta.png' })
    await cc.close()

    console.log('\n9 · Interfaz: el admin ve la campana y abre el objeto')
    const ca = await nav.newContext({ viewport: { width: 1440, height: 900 } })
    await ca.addCookies(galletas(admin.sesion))
    const pa = await ca.newPage()
    await pa.goto(`${BASE}/sistema`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    const cuenta = pa.locator('[data-campana-cuenta]')
    await cuenta.waitFor({ timeout: 60_000 })
    ok(Number((await cuenta.textContent()).replace('+', '')) >= 1, `la campana del admin marca ${await cuenta.textContent()}`)
    await pa.getByText(/Vencida/).first().waitFor({ timeout: 30_000 }).then(
      () => ok(true, 'Mi día enseña la tarea vencida'),
      () => ok(false, 'Mi día enseña la tarea vencida')
    )
    await pa.screenshot({ path: 'capturas/sistema/colaboracion-admin-mi-dia.png', fullPage: true })
    await pa.getByRole('button', { name: /^Notificaciones:/ }).click()
    await pa.locator('[data-campana-abierta]').waitFor()
    await pa.screenshot({ path: 'capturas/sistema/colaboracion-admin-campana.png' })
    await pa.locator('[data-campana-abierta] button', { hasText: 'te mencionó' }).first().click()
    await pa.waitForURL(new RegExp(`ficha=plaza(%3A|:)${plaza.ref}`), { timeout: 30_000 })
    ok(true, 'tocar la mención abre la plaza en el panel lateral')
    await pa.getByRole('tab', { name: /Línea de tiempo/ }).click({ timeout: 60_000 })
    await pa.getByRole('list', { name: 'Línea de tiempo' }).getByText('revisa esta plaza, por favor').first().waitFor({ timeout: 30_000 })
    ok(true, 'y el admin lee el comentario en su línea de tiempo')
    await pa.screenshot({ path: 'capturas/sistema/colaboracion-admin-abre-objeto.png' })
    await pa.getByRole('button', { name: /^Cambios/ }).click()
    await pa.screenshot({ path: 'capturas/sistema/colaboracion-admin-ia-y-cambios.png' })
    // La página completa de la ficha, para ver la línea de tiempo con espacio.
    await pa.goto(`${BASE}/sistema/ficha/plaza/${plaza.ref}`, { waitUntil: 'domcontentloaded', timeout: 120_000 })
    await pa.getByRole('tab', { name: /Línea de tiempo/ }).click({ timeout: 60_000 })
    await pa.getByRole('list', { name: 'Línea de tiempo' }).getByText('revisa esta plaza, por favor').first().waitFor({ timeout: 30_000 })
    await pa.screenshot({ path: 'capturas/sistema/colaboracion-ficha-pagina.png', fullPage: true })
    // Una requisición esperando decisión, para ver la bandeja con trabajo (se cancela al final).
    const { data: pz2 } = await servicio.schema('org').from('plaza').select('unidad_ref, cargo_id').is('escenario_id', null).range(1, 1).single()
    const { data: org2 } = await servicio.schema('control').from('catalogo').select('clave').eq('tipo', 'origen_requisicion').neq('clave', 'cargo_nuevo').limit(1).single()
    const idReq2 = crypto.randomUUID()
    await usuario.cliente.schema('org').from('requisicion').insert({ id: idReq2, unidad_ref: pz2.unidad_ref, cargo_id: pz2.cargo_id, origen: org2.clave, cantidad: 2, justificacion: `${MARCA} para ver la bandeja con trabajo`, creado_por: usuario.id })
    creado.requisiciones.push(idReq2)
    await usuario.cliente.schema('org').rpc('enviar_requisicion', { p_req: idReq2 })
    await pa.goto(`${BASE}/sistema/bandeja`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {})
    await pa.getByRole('button', { name: /^Decidir/ }).first().click().catch(() => {})
    await pa.screenshot({ path: 'capturas/sistema/colaboracion-bandeja.png', fullPage: true })
    await pa.goto(`${BASE}/sistema/notificaciones`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {})
    await pa.screenshot({ path: 'capturas/sistema/colaboracion-notificaciones.png', fullPage: true })

    // Teléfono: la campana y la ficha caben sin desborde.
    const tel = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await tel.addCookies(galletas(admin.sesion))
    const pt = await tel.newPage()
    for (const ruta of ['/sistema', '/sistema/bandeja', '/sistema/notificaciones', '/sistema/tareas', `/sistema/notificaciones?ficha=plaza:${plaza.ref}`]) {
      await pt.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {})
      const ancho = await pt.evaluate(() => document.documentElement.scrollWidth)
      ok(ancho <= 391, `390 px sin desborde en ${ruta}`, `scrollWidth ${ancho}`)
      await pt.screenshot({ path: `capturas/sistema/colaboracion-telefono-${ruta.replace(/[^a-z]+/gi, '_')}.png` })
    }
    await ca.close()
    await tel.close()
  } catch (e) {
    ok(false, 'la interfaz', e.message.split('\n')[0])
    for (const c of nav.contexts()) for (const [i, p] of c.pages().entries()) await p.screenshot({ path: `capturas/sistema/colaboracion-fallo-${i}.png` }).catch(() => {})
  } finally {
    await nav.close()
  }
}
