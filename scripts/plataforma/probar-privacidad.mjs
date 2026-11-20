/**
 * Plataforma Iberia · privacidad del padrón y lo que dejó el hotfix
 * (migración `20261120234000_seguimiento_privacidad.sql`), contra el PROYECTO DE PRUEBAS.
 *
 * Con sesiones reales (enlace mágico acuñado con la clave de servicio de pruebas):
 *   · un TRABAJADOR (rol Personal de planta, ficha propia ficticia) no lee por la API la cédula,
 *     el teléfono ni el correo de nadie —ni en `select`, ni `select=*`, ni filtrando, ni
 *     embebido—, sí lee los suyos por `contacto_empleados()`, y el directorio sigue igual;
 *   · CAPITAL HUMANO (un rol de nivel usuario con `modulo:empleados` · editar) y el ADMIN sí
 *     leen el contacto ajeno por la función; el empujón lee el teléfono;
 *   · `personas` (el levantamiento) solo con la casilla de entrevistas;
 *   · la portada del informe cuenta los hallazgos validados con `hallazgos_validados()`
 *     aunque la tabla esté cerrada;
 *   · la línea de tiempo de `entrevista`, `archivo` y `actividad`: comentar, mencionar
 *     (solo a quien puede ver el objeto), títulos y recientes;
 *   · Ctrl K encuentra sesiones con la casilla de entrevistas, y sin ella no.
 *   · (privacidad_programa) sesiones, participantes y archivos —y el bucket— solo con su casilla;
 *     notas del consultor y enlace de Fireflies solo para el equipo; las cifras siguen saliendo a
 *     quien las ve (portada, hallazgos de la sesión, línea de tiempo, métrica, tablas); la cédula del
 *     certificado a su dueño, al equipo y a Certificados + Capital Humano; y el directorio completo.
 * Crea su gente de prueba (correos `*.privacidad@plataforma.local`, cédulas
 * `PRUEBA-PRIV-*`, un rol temporal) y la borra al salir, barriendo por prefijo.
 *
 *   node --env-file=.env.local scripts/plataforma/probar-privacidad.mjs [--base http://localhost:3005]
 *
 * La parte del directorio pide la página al servidor de pruebas (dev-pruebas.mjs, en el 3005).
 */
import { createClient } from '@supabase/supabase-js'

const URL_SUPA = process.env.SUPABASE_PRUEBAS_URL
const PUB = process.env.SUPABASE_PRUEBAS_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_PRUEBAS_SECRET_KEY
if (!URL_SUPA || !PUB || !SECRETO) throw new Error('Faltan las variables SUPABASE_PRUEBAS_* en .env.local')
if (process.env.SUPABASE_PROJECT_REF && URL_SUPA.includes(process.env.SUPABASE_PROJECT_REF)) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se corre')

const servicio = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, PUB, { auth: { persistSession: false } })
const MARCA = `[privacidad-prueba ${Date.now().toString(36)}]`
const CEDULA = 'PRUEBA-PRIV-'
const DOMINIO = '.privacidad@plataforma.local'
const ROL_CH = 'prueba-privacidad-ch'
const ROL_CERT = 'prueba-privacidad-cert'
const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://localhost:3005'
const REF = new URL(URL_SUPA).hostname.split('.')[0]
/** La cookie de sesión de Supabase para pedirle páginas al servidor de pruebas. */
function galletas(sesionSupa) {
  const nombre = `sb-${REF}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesionSupa)).toString('base64url')
  const L = 3180
  const partes = valor.length <= L ? [[nombre, valor]] : Array.from({ length: Math.ceil(valor.length / L) }, (_, i) => [`${nombre}.${i}`, valor.slice(i * L, (i + 1) * L)])
  return partes.map(([n, v]) => `${n}=${v}`).join('; ')
}

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
const negado = (r) => r.error?.code === '42501'

async function sesion(email) {
  const { data: enlace, error: e1 } = await servicio.auth.admin.generateLink({ type: 'magiclink', email })
  if (e1) throw new Error(`${email}: ${e1.message}`)
  const { data, error } = await anon.auth.verifyOtp({ token_hash: enlace.properties.hashed_token, type: 'magiclink' })
  if (error) throw error
  const cliente = createClient(URL_SUPA, PUB, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })
  return { cliente, id: data.user.id, email, sesion: data.session }
}

async function limpiar() {
  const s = servicio.schema('nucleo')
  await s.from('notificacion').delete().or(`texto.ilike.%${MARCA}%,detalle.ilike.%${MARCA}%`)
  const { data: evs } = await s.from('evento').select('id').ilike('texto', `%${MARCA}%`)
  const ids = (evs ?? []).map((e) => e.id)
  if (ids.length) {
    await s.from('notificacion').delete().in('evento_id', ids)
    await s.from('evento').delete().in('padre_id', ids)
    await s.from('evento').delete().in('id', ids)
  }
  await servicio.from('empleados').delete().like('cedula', `${CEDULA}%`)
  for (let pagina = 1; pagina < 20; pagina++) {
    const { data } = await servicio.auth.admin.listUsers({ page: pagina, perPage: 200 })
    const usuarios = data?.users ?? []
    for (const u of usuarios.filter((x) => x.email?.endsWith(DOMINIO))) {
      await s.from('seguimiento').delete().eq('perfil', u.id)
      await servicio.schema('ui').from('reciente').delete().eq('perfil', u.id)
      await servicio.auth.admin.deleteUser(u.id)
    }
    if (usuarios.length < 200) break
  }
  for (const clave of [ROL_CH, ROL_CERT]) {
    const { data: rol } = await servicio.from('roles').select('id').eq('clave', clave).maybeSingle()
    if (rol) {
      await servicio.from('rol_permisos').delete().eq('rol_id', rol.id)
      await servicio.from('roles').delete().eq('id', rol.id)
    }
  }
}

async function cuenta(nombre, rolClave, organizacion = 'iberia') {
  const email = `${nombre}${DOMINIO}`
  const { data, error } = await servicio.auth.admin.createUser({
    email,
    email_confirm: true,
    // Las normas del canal aceptadas: la app abre directo (la pantalla de normas se prueba aparte).
    user_metadata: { nombre_completo: `Prueba ${nombre} (privacidad)`, rol_clave: rolClave, organizacion, normas_aceptadas_version: 1 },
  })
  if (error) throw new Error(`${email}: ${error.message}`)
  return data.user.id
}

await limpiar()
// Lo que la prueba deja en cuentas que no son suyas (seguir al comentar, recientes): se borra al salir.
const ajenos = { seguimientos: [], recientes: [] }
let admin, consultor, lector, trabajador, ch, cert, usuario
try {
  // --- Gente de prueba -----------------------------------------------------------
  const { data: area } = await servicio.from('areas').select('id').limit(1).single()
  const { data: rol, error: eRol } = await servicio
    .from('roles')
    .insert({ clave: ROL_CH, nombre: 'Capital Humano (prueba de privacidad)', nivel: 'usuario' })
    .select('id')
    .single()
  if (eRol) throw new Error(`rol temporal: ${eRol.message}`)
  // Capital Humano: el padrón (editar), Certificados y Consumos (ver), sin entrevistas ni archivos.
  const casilla = (rol_id, recurso, editar = false) => ({ rol_id, recurso, ver: true, crear: false, editar, eliminar: false })
  const { error: ePerm } = await servicio.from('rol_permisos').upsert(
    [casilla(rol.id, 'modulo:empleados', true), casilla(rol.id, 'modulo:certificados'), casilla(rol.id, 'modulo:programa')],
    { onConflict: 'rol_id,recurso' }
  )
  if (ePerm) throw new Error(`permiso temporal: ${ePerm.message}`)
  // Solo Certificados · ver (sin Capital Humano): lee los certificados, no la cédula.
  const { data: rolCert, error: eRolCert } = await servicio.from('roles').insert({ clave: ROL_CERT, nombre: 'Certificados (prueba de privacidad)', nivel: 'lector' }).select('id').single()
  if (eRolCert) throw new Error(`rol temporal: ${eRolCert.message}`)
  const { error: ePermCert } = await servicio.from('rol_permisos').upsert(casilla(rolCert.id, 'modulo:certificados'), { onConflict: 'rol_id,recurso' })
  if (ePermCert) throw new Error(`permiso temporal: ${ePermCert.message}`)

  const idTrabajador = await cuenta('planta', 'personal-planta')
  await cuenta('ch', ROL_CH)
  await cuenta('cert', ROL_CERT)
  const base = { cargo: 'OPERADOR DE PRUEBA', area_id: area.id, nivel: 'planta', tipo_nomina: 'diaria', fecha_ingreso: '2020-01-01', familia_oficio: 'generico', activo: true }
  const { data: fichas, error: eF } = await servicio
    .from('empleados')
    .insert([
      { ...base, cedula: `${CEDULA}PLANTA`, nombre_completo: 'Trabajador Privacidad (prueba)', telefono: '04140000001', email: 'planta@prueba.local', perfil_id: idTrabajador },
      { ...base, cedula: `${CEDULA}OTRA`, nombre_completo: 'Compañera Privacidad (prueba)', telefono: '04140000002', email: 'otra@prueba.local', perfil_id: null },
    ])
    .select('id, cedula')
  if (eF) throw new Error(`fichas: ${eF.message}`)
  const miFicha = fichas.find((f) => f.cedula === `${CEDULA}PLANTA`).id
  const otra = fichas.find((f) => f.cedula === `${CEDULA}OTRA`).id

  // Un certificado ficticio del trabajador, con su cédula congelada.
  const { data: curso } = await servicio.from('cursos').select('id').eq('clave', 'ajito').single()
  const { data: mat, error: eMat } = await servicio.from('matriculas').insert({ curso_id: curso.id, empleado_id: miFicha }).select('id').single()
  if (eMat) throw new Error(`matrícula: ${eMat.message}`)
  const { data: certFila, error: eCert } = await servicio
    .from('certificados')
    .insert({ matricula_id: mat.id, codigo: `IB-PRUEBA-PRIV-${Date.now().toString(36)}`, nombre_completo: 'Trabajador Privacidad (prueba)', cedula: `${CEDULA}PLANTA`, cargo: 'Operador de prueba', area_nombre: 'Prueba' })
    .select('id')
    .single()
  if (eCert) throw new Error(`certificado: ${eCert.message}`)

  ;[admin, consultor, lector, trabajador, ch, cert, usuario] = await Promise.all([
    sesion('admin.pruebas@plataforma.local'),
    sesion('consultor.pruebas@plataforma.local'),
    sesion('lector.pruebas@plataforma.local'),
    sesion(`planta${DOMINIO}`),
    sesion(`ch${DOMINIO}`),
    sesion(`cert${DOMINIO}`),
    sesion('usuario.pruebas@plataforma.local'),
  ])

  // --- 1 · El trabajador ---------------------------------------------------------
  console.log('\n1 · Un trabajador (Personal de planta) contra la API')
  const t = trabajador.cliente
  for (const columna of ['cedula', 'telefono', 'email', 'fecha_ingreso', 'tipo_nomina']) {
    const r = await t.from('empleados').select(`id, ${columna}`).eq('id', otra)
    ok(negado(r), `no lee ${columna} de otra ficha`, r.error?.message ?? r.data)
  }
  {
    const r = await t.from('empleados').select('*').eq('id', otra)
    ok(negado(r), 'select=* lo rechaza la base', r.error?.message ?? r.data)
    const f = await t.from('empleados').select('id').eq('telefono', '04140000002')
    ok(negado(f), 'no puede filtrar por teléfono (ni sondear si existe)', f.error?.message ?? f.data)
    const o = await t.from('empleados').select('id').order('cedula').limit(1)
    ok(negado(o), 'no puede ordenar por cédula', o.error?.message ?? o.data)
    const emb = await t.from('conexiones').select('id, empleados!conexiones_solicita_id_fkey(telefono)').limit(1)
    ok(negado(emb), 'tampoco embebido desde otra tabla', emb.error?.message ?? emb.data)
    const mia = await t.from('empleados').select('id, cedula').eq('id', miFicha)
    ok(negado(mia), 'ni la propia por la tabla (la propia va por la función)', mia.error?.message ?? mia.data)
  }
  {
    const r = await t.from('empleados').select('id, nombre_completo, cargo, area_id, foto_url, nivel, sede, areas(nombre)').eq('activo', true).range(0, 999)
    ok(!r.error && (r.data?.length ?? 0) > 1 && r.data.some((p) => p.id === otra), `el directorio sigue: nombre, cargo, área y foto de ${r.data?.length ?? 0} personas`, r.error?.message)
    const yo = await t.from('empleados').select('id').eq('perfil_id', trabajador.id).maybeSingle()
    ok(yo.data?.id === miFicha, 'encuentra su ficha por su cuenta (la del canal)', yo.error?.message)
  }
  {
    const { data: propios, error } = await t.rpc('contacto_empleados', { p_ids: [miFicha, otra] })
    ok(!error && propios?.length === 1 && propios[0].empleado_id === miFicha && propios[0].telefono === '04140000001' && propios[0].cedula === `${CEDULA}PLANTA`,
      'contacto_empleados le da lo suyo y nada ajeno', error?.message ?? propios)
    const { data: todos } = await t.rpc('contacto_empleados')
    ok((todos ?? []).every((c) => c.empleado_id === miFicha), `sin filtro, igual solo lo suyo (${todos?.length ?? 0} fila)`, todos)
    const pend = await t.from('recordatorios_pendientes').select('empleado_id, telefono').range(0, 999)
    ok(!pend.error && (pend.data ?? []).every((p) => p.empleado_id === miFicha), 'el empujón no le enseña teléfonos ajenos', pend.error?.message ?? pend.data?.length)
    const pad = await t.from('padron_estado').select('id').limit(5)
    ok(!pad.error && !(pad.data ?? []).length, 'el padrón (padron_estado) le sale vacío', pad.error?.message ?? pad.data?.length)
    const per = await t.from('personas').select('id, nombre_completo').limit(5)
    ok(!per.error && !(per.data ?? []).length, 'las personas del levantamiento le salen vacías', per.error?.message ?? per.data?.length)
  }
  {
    // Lo que el trabajador sí hace con su ficha: «actualizo mi ficha» (foto) sigue.
    const r = await t.from('empleados').update({ foto_url: null }).eq('id', miFicha).select('id')
    ok(!r.error && r.data?.length === 1, 'actualiza lo suyo (foto) como antes', r.error?.message)
  }

  // --- 2 · Capital Humano y el equipo ----------------------------------------------
  console.log('\n2 · Capital Humano (modulo:empleados · editar) y el equipo')
  {
    const { data, error } = await ch.cliente.rpc('contacto_empleados', { p_ids: [otra] })
    ok(!error && data?.[0]?.cedula === `${CEDULA}OTRA` && data[0].telefono === '04140000002' && data[0].email === 'otra@prueba.local',
      'Capital Humano lee cédula, teléfono y correo ajenos por la función', error?.message ?? data)
    const r = await ch.cliente.from('empleados').select('id, telefono').eq('id', otra)
    ok(negado(r), 'pero la tabla tampoco se los sirve a él (una sola puerta)', r.error?.message ?? r.data)
  }
  {
    const { data, error } = await admin.cliente.rpc('contacto_empleados', { p_ids: [otra, miFicha] })
    ok(!error && data?.length === 2 && data.every((c) => c.cedula && c.telefono && c.email), 'el admin lee el contacto de las dos fichas', error?.message ?? data)
    const pend = await admin.cliente.from('recordatorios_pendientes').select('matricula_id, telefono').range(0, 4)
    ok(!pend.error, 'recordatorios_pendientes (con teléfono) responde al admin', pend.error?.message)
    const pad = await admin.cliente.from('padron_estado').select('id, cedula, telefono').eq('id', otra).maybeSingle()
    ok(!pad.error && pad.data?.telefono === '04140000002' && pad.data?.cedula === `${CEDULA}OTRA`, 'el padrón (padron_estado) le da cédula y teléfono', pad.error?.message ?? pad.data)
    const { data: lec } = await lector.cliente.rpc('contacto_empleados', { p_ids: [otra] })
    ok(!(lec ?? []).length, 'Lector Iberia no lee el contacto ajeno', lec)
    const per = await lector.cliente.from('personas').select('id').limit(3)
    ok(!per.error && (per.data ?? []).length > 0, 'Lector Iberia (con entrevistas · ver) sí lee las personas del levantamiento', per.error?.message)
  }

  // --- 3 · La portada del informe ---------------------------------------------------
  console.log('\n3 · Hallazgos validados en la portada del informe')
  {
    const { count } = await servicio.from('hallazgos').select('id', { count: 'exact', head: true }).eq('estado', 'validado')
    const [{ data: deLector, error }, { data: deTrabajador }, filas] = await Promise.all([
      lector.cliente.rpc('hallazgos_validados'),
      trabajador.cliente.rpc('hallazgos_validados'),
      lector.cliente.from('hallazgos').select('id').limit(5),
    ])
    ok(!error && deLector === count, `el lector cuenta ${deLector} validados (la base dice ${count})`, error?.message)
    ok(deTrabajador === count, 'la cuenta es la misma para cualquier sesión', deTrabajador)
    ok(!(filas.data ?? []).length, 'y la tabla de hallazgos le sigue cerrada', filas.data?.length)
    // Un cliente nuevo: `anon` guarda la última sesión que verificó.
    const sinSesion = await createClient(URL_SUPA, PUB, { auth: { persistSession: false } }).rpc('hallazgos_validados')
    ok(Boolean(sinSesion.error), 'sin sesión no responde', sinSesion.data)
  }

  // --- 4 · Línea de tiempo de los objetos del programa -------------------------------
  console.log('\n4 · Línea de tiempo: entrevista, archivo y actividad')
  const { data: ent } = await servicio.from('entrevistas').select('id, codigo').order('fecha_entrevista', { ascending: false }).limit(1).single()
  const { data: arc } = await servicio.from('archivos').select('id').limit(1).single()
  const { data: act } = await servicio.from('calendario_actividades').select('ref').limit(1).single()
  const puedeVer = async (u, tipo, id) => (await u.cliente.schema('nucleo').rpc('puede_ver_objeto', { p_tipo: tipo, p_id: id })).data === true
  ok(await puedeVer(admin, 'entrevista', ent.id), 'el admin ve la entrevista')
  ok(await puedeVer(lector, 'entrevista', ent.id) && await puedeVer(lector, 'archivo', arc.id), 'Lector Iberia ve entrevista y archivo (tiene sus casillas)')
  ok(!(await puedeVer(lector, 'actividad', act.ref)), 'Lector Iberia no ve la actividad (sin modulo:calendario)')
  ok(await puedeVer(consultor, 'actividad', act.ref), 'el consultor ve la actividad (modulo:calendario · ver)')
  ok(!(await puedeVer(trabajador, 'entrevista', ent.id)) && !(await puedeVer(trabajador, 'archivo', arc.id)) && !(await puedeVer(trabajador, 'actividad', act.ref)),
    'el trabajador no ve ninguno de los tres')
  ok(!(await puedeVer(admin, 'entrevista', otra)), 'un id que no es una entrevista no pasa')
  {
    const objetos = [ent.id, arc.id, act.ref]
    const { data: yaSeguia } = await servicio.schema('nucleo').from('seguimiento').select('perfil, objeto_id').in('perfil', [admin.id, lector.id]).in('objeto_id', objetos)
    for (const perfil of [admin.id, lector.id])
      for (const objeto of objetos)
        if (!(yaSeguia ?? []).some((x) => x.perfil === perfil && x.objeto_id === objeto)) ajenos.seguimientos.push({ perfil, objeto })
    const { data: yaReciente } = await servicio.schema('ui').from('reciente').select('objeto_id').eq('perfil', lector.id).eq('objeto_id', ent.id)
    if (!(yaReciente ?? []).length) ajenos.recientes.push({ perfil: lector.id, objeto: ent.id })
    const n = admin.cliente.schema('nucleo')
    const { data: idC, error: eC } = await n.rpc('comentar', { p_tipo: 'entrevista', p_id: ent.id, p_texto: `${MARCA} revisar el cierre de esta sesión`, p_menciones: [lector.id, trabajador.id] })
    ok(!eC && idC, 'el admin comenta en la entrevista', eC?.message)
    const { data: ev } = await servicio.schema('nucleo').from('evento').select('datos').eq('id', idC).single()
    const menciones = ev?.datos?.menciones ?? []
    ok(menciones.includes(lector.id) && !menciones.includes(trabajador.id), 'la mención le llega a quien puede ver la sesión y no al trabajador', menciones)
    const { data: avisos } = await lector.cliente.schema('nucleo').from('notificacion').select('id, texto').eq('evento_id', idC)
    ok((avisos ?? []).length === 1 && avisos[0].texto.includes(ent.codigo), `el lector recibe el aviso con el título («${avisos?.[0]?.texto ?? '—'}»)`, avisos)
    const { data: leeLector } = await lector.cliente.schema('nucleo').from('evento').select('id').eq('objeto_tipo', 'entrevista').eq('objeto_id', ent.id)
    ok((leeLector ?? []).some((e) => e.id === idC), 'el lector lee el comentario en la línea de tiempo')
    const { data: leeTrab } = await trabajador.cliente.schema('nucleo').from('evento').select('id').eq('objeto_id', ent.id)
    ok(!(leeTrab ?? []).length, 'el trabajador no lo lee')
    const { data: idR, error: eR } = await lector.cliente.schema('nucleo').rpc('comentar', { p_tipo: 'entrevista', p_id: ent.id, p_texto: `${MARCA} visto`, p_padre: idC })
    ok(!eR && idR, 'el lector responde en el hilo', eR?.message)
    const { error: eT } = await trabajador.cliente.schema('nucleo').rpc('comentar', { p_tipo: 'entrevista', p_id: ent.id, p_texto: `${MARCA} intruso` })
    ok(Boolean(eT), 'el trabajador no puede comentar ahí')
    const { data: idA, error: eA } = await n.rpc('comentar', { p_tipo: 'actividad', p_id: act.ref, p_texto: `${MARCA} confirmar fecha`, p_menciones: [lector.id, consultor.id] })
    ok(!eA && idA, 'el admin comenta en la actividad del calendario', eA?.message)
    const { data: evA } = await servicio.schema('nucleo').from('evento').select('datos').eq('id', idA).single()
    ok((evA?.datos?.menciones ?? []).join() === consultor.id, 'en la actividad solo se menciona a quien tiene el calendario', evA?.datos)
    const { data: idArc, error: eArc } = await n.rpc('comentar', { p_tipo: 'archivo', p_id: arc.id, p_texto: `${MARCA} falta la versión firmada` })
    ok(!eArc && idArc, 'el admin comenta en el archivo', eArc?.message)
    const { data: titulos } = await n.rpc('titulos_objetos', { p_tipos: ['entrevista', 'archivo', 'actividad'], p_ids: [ent.id, arc.id, act.ref] })
    ok((titulos ?? []).length === 3 && titulos.every((x) => x.titulo && x.titulo !== 'un objeto'), 'los tres tienen título', titulos)
    const { error: eRec } = await lector.cliente.schema('ui').rpc('registrar_reciente', { p_tipo: 'entrevista', p_id: ent.id, p_titulo: ent.codigo })
    const { data: rec } = await lector.cliente.schema('ui').rpc('recientes', { p_limite: 8 })
    ok(!eRec && (rec ?? []).some((r) => r.tipo === 'entrevista' && r.id === ent.id), 'la sesión entra a los recientes de Ctrl K', eRec?.message ?? rec)
  }

  // --- 5 · Ctrl K: sesiones ---------------------------------------------------------
  console.log('\n5 · Ctrl K encuentra sesiones')
  {
    const buscar = (u, q) => u.cliente.schema('ui').rpc('buscar', { p_q: q, p_limite: 10, p_tipo: 'entrevista' })
    const { data: deLector, error } = await buscar(lector, ent.codigo)
    const fila = (deLector ?? []).find((r) => r.id === ent.id)
    ok(!error && fila && fila.codigo === ent.codigo && fila.href.endsWith(`/entrevistas/${ent.id}`), `el lector encuentra ${ent.codigo}`, error?.message ?? deLector)
    ok(Object.keys(fila ?? {}).sort().join() === 'codigo,detalle,href,id,rango,tipo,titulo,total', 'solo código, título, detalle (tipo y fecha) y enlace', Object.keys(fila ?? {}))
    const { data: deTrabajador } = await buscar(trabajador, ent.codigo)
    ok(!(deTrabajador ?? []).length, 'el trabajador (sin entrevistas · ver) no encuentra sesiones', deTrabajador)
    const { data: todo } = await consultor.cliente.schema('ui').rpc('buscar', { p_q: ent.codigo.slice(0, 3), p_limite: 5 })
    ok((todo ?? []).some((r) => r.tipo === 'entrevista'), `sin filtro de tipo, las sesiones salen en la búsqueda general («${ent.codigo.slice(0, 3)}»)`, todo?.map((r) => r.tipo))
  }
  // --- 6 · Sesiones, participantes, archivos y lo «solo Boosty» ------------------------
  console.log('\n6 · Sesiones, participantes y archivos: con su casilla; las notas, solo el equipo')
  {
    for (const [quien, u] of [['el trabajador', trabajador], ['Usuario Iberia (sin entrevistas)', usuario], ['Capital Humano (sin entrevistas ni archivos)', ch]]) {
      const [e, p, a] = await Promise.all([
        u.cliente.from('entrevistas').select('id').limit(5),
        u.cliente.from('sesion_participantes').select('id').limit(5),
        u.cliente.from('archivos').select('id').limit(5),
      ])
      ok(!e.error && !p.error && !a.error && !(e.data?.length || p.data?.length || a.data?.length), `${quien} no lee sesiones, participantes ni archivos`,
        e.error?.message ?? p.error?.message ?? a.error?.message ?? [e.data?.length, p.data?.length, a.data?.length])
    }
    // El bucket del expediente: un archivo de prueba, que se borra al salir.
    const ruta = `${CEDULA.toLowerCase()}${Date.now().toString(36)}/nota.txt`
    const { error: eSubir } = await servicio.storage.from('archivos').upload(ruta, new Blob(['prueba de privacidad']), { contentType: 'text/plain' })
    ok(!eSubir, 'archivo de prueba en el bucket del expediente', eSubir?.message)
    try {
      const deTrabajador = await trabajador.cliente.storage.from('archivos').download(ruta)
      ok(Boolean(deTrabajador.error) && !deTrabajador.data, 'el trabajador no baja binarios del expediente')
      const firmado = await trabajador.cliente.storage.from('archivos').createSignedUrl(ruta, 60)
      ok(Boolean(firmado.error), 'ni firma un enlace para bajarlo')
      const deLector = await lector.cliente.storage.from('archivos').download(ruta)
      ok(!deLector.error && Boolean(deLector.data), 'Lector Iberia (archivos · ver) sí lo baja', deLector.error?.message)
    } finally {
      await servicio.storage.from('archivos').remove([ruta])
    }

    const [{ count: totalSesiones }, { count: conFecha }, { count: deTipoEntrevista }] = await Promise.all([
      servicio.from('entrevistas').select('id', { count: 'exact', head: true }),
      servicio.from('entrevistas').select('id', { count: 'exact', head: true }).not('fecha_entrevista', 'is', null),
      servicio.from('entrevistas').select('id', { count: 'exact', head: true }).eq('tipo', 'entrevista'),
    ])
    const l = await lector.cliente.from('entrevistas').select('id, codigo, resumen').range(0, 999)
    ok(!l.error && l.data?.length === totalSesiones, `Lector Iberia (entrevistas · ver) lee las ${totalSesiones} sesiones`, l.error?.message ?? l.data?.length)
    for (const columna of ['notas_consultor', 'fireflies_url', 'busqueda']) {
      for (const [quien, u] of [['Lector Iberia', lector], ['ni el admin', admin]]) {
        const r = await u.cliente.from('entrevistas').select(`id, ${columna}`).limit(1)
        ok(negado(r), `${quien}: la tabla no sirve ${columna}`, r.error?.message ?? r.data)
      }
    }
    const todo = await lector.cliente.from('entrevistas').select('*').limit(1)
    ok(negado(todo), 'select=* sobre entrevistas lo rechaza la base', todo.error?.message ?? todo.data)
    const { data: conNotas } = await servicio.from('entrevistas').select('id, notas_consultor').not('notas_consultor', 'is', null).limit(1).maybeSingle()
    if (!conNotas) ok(false, 'hace falta una sesión con notas del consultor en pruebas para probar la puerta')
    else {
      const [{ data: deLector }, { data: deAdmin }] = await Promise.all([
        lector.cliente.rpc('entrevistas_internas', { p_ids: [conNotas.id] }),
        admin.cliente.rpc('entrevistas_internas', { p_ids: [conNotas.id] }),
      ])
      ok(!(deLector ?? []).length, 'entrevistas_internas no le responde al lector', deLector)
      ok(deAdmin?.[0]?.notas_consultor === conNotas.notas_consultor, 'al admin le da las notas del consultor')
    }
    const per = await lector.cliente.from('personas').select('id, notas').limit(1)
    ok(negado(per), 'las notas de las personas del levantamiento ya no salen', per.error?.message ?? per.data)

    // Las cifras siguen saliendo a quien las ve.
    const cuentas = await Promise.all([lector, trabajador, usuario].map((u) => u.cliente.rpc('cuenta_entrevistas')))
    ok(cuentas.every((c) => c.data === deTipoEntrevista), `la portada del informe cuenta ${deTipoEntrevista} entrevistas para cualquiera`, cuentas.map((c) => c.data ?? c.error?.message))
    const { data: hall } = await servicio.from('hallazgos').select('entrevista_id, estado').not('entrevista_id', 'is', null).range(0, 999)
    const sesionConHallazgos = (hall ?? []).find((h) => h.estado === 'validado')?.entrevista_id ?? (hall ?? [])[0]?.entrevista_id
    if (!sesionConHallazgos) ok(false, 'hace falta una sesión con hallazgos en pruebas')
    else {
      const esperados = (hall ?? []).filter((h) => h.entrevista_id === sesionConHallazgos)
      const [{ data: deLector }, { data: deAdmin }, { data: deTrabajador }] = await Promise.all(
        [lector, admin, trabajador].map((u) => u.cliente.rpc('hallazgos_por_estado', { p_entrevista: sesionConHallazgos }))
      )
      const validados = esperados.filter((h) => h.estado === 'validado').length
      ok((deLector ?? []).every((f) => f.estado === 'validado') && ((deLector ?? []).find((f) => f.estado === 'validado')?.n ?? 0) === validados,
        `en la sesión el lector ve ${validados} validado(s) y nada más`, deLector)
      ok((deAdmin ?? []).reduce((a, f) => a + f.n, 0) === esperados.length, `el equipo ve los ${esperados.length} con su estado`, deAdmin)
      ok(!(deTrabajador ?? []).length, 'el trabajador no ve ni la cuenta', deTrabajador)
      const vista = await lector.cliente.schema('ui').from('programa_entrevistas').select('id, hallazgos, participantes').range(0, 999)
      ok(!vista.error && vista.data?.length === totalSesiones && vista.data.find((v) => v.id === sesionConHallazgos)?.hallazgos === validados,
        'la tabla de sesiones (ui.programa_entrevistas) le cuenta al lector sus validados', vista.error?.message ?? vista.data?.find((v) => v.id === sesionConHallazgos))
    }
    const vistaU = await usuario.cliente.schema('ui').from('programa_entrevistas').select('id').limit(3)
    ok(!vistaU.error && !(vistaU.data ?? []).length, 'y a quien no tiene entrevistas no le sale nada', vistaU.error?.message ?? vistaU.data?.length)
    const linea = await ch.cliente.from('linea_de_tiempo').select('origen').eq('origen', 'sesion').range(0, 1999)
    ok(!linea.error && linea.data?.length === conFecha, `la línea de tiempo de Consumos le sigue mostrando las ${conFecha} sesiones a quien tiene Consumos sin entrevistas`, linea.error?.message ?? linea.data?.length)
    const lineaT = await trabajador.cliente.from('linea_de_tiempo').select('origen').eq('origen', 'sesion').limit(3)
    ok(!(lineaT.data ?? []).length, 'al trabajador no', lineaT.data?.length)
    const [mCh, mAdmin, mDirecta] = await Promise.all([
      ch.cliente.schema('ui').rpc('metrica', { p_clave: 'programa_sesiones' }),
      admin.cliente.schema('ui').rpc('metrica', { p_clave: 'programa_sesiones' }),
      trabajador.cliente.schema('ui').rpc('m_programa_sesiones', {}),
    ])
    const valor = (m) => JSON.stringify(m.data?.valor ?? m.data?.cifra?.valor ?? m.data)
    ok(!mCh.error && valor(mCh) === valor(mAdmin) && /\d/.test(valor(mCh)), `la métrica «Sesiones de trabajo» dice lo mismo con Consumos sin entrevistas (${valor(mCh)})`, mCh.error?.message ?? [valor(mCh), valor(mAdmin)])
    ok(Boolean(mDirecta.error), 'llamada directa sin la casilla, la métrica se niega', mDirecta.data)
  }

  // --- 7 · La cédula del certificado -------------------------------------------------
  console.log('\n7 · La cédula del certificado')
  {
    const directa = await trabajador.cliente.from('certificados').select('id, cedula').eq('id', certFila.id)
    ok(negado(directa), 'la tabla no sirve la cédula ni a su dueño (va por la función)', directa.error?.message ?? directa.data)
    const propia = await trabajador.cliente.from('certificados').select('id, codigo').eq('id', certFila.id)
    ok(propia.data?.length === 1, 'el trabajador lee su certificado')
    const cedula = async (u) => (await u.cliente.rpc('cedulas_certificados', { p_ids: [certFila.id] })).data?.[0]?.cedula ?? null
    ok((await cedula(trabajador)) === `${CEDULA}PLANTA`, 'y su cédula, para la imagen que guarda o manda')
    ok((await cedula(admin)) === `${CEDULA}PLANTA`, 'el admin la ve (el lote impreso del equipo)')
    ok((await cedula(ch)) === `${CEDULA}PLANTA`, 'Certificados + Capital Humano la ve')
    const fila = await cert.cliente.from('certificados').select('id, codigo, ficha').eq('id', certFila.id)
    ok(fila.data?.length === 1, 'Certificados · ver lee el certificado')
    ok((await cedula(cert)) === null, 'pero no la cédula (su hoja sale con la ficha)')
    ok((await cedula(lector)) === null, 'Lector Iberia (sin Certificados) tampoco')
  }

  // --- 8 · El directorio del canal, completo ---------------------------------------
  console.log('\n8 · El directorio del canal, de a 100 y completo')
  {
    const { count: activos } = await servicio.from('empleados').select('id', { count: 'exact', head: true }).eq('activo', true)
    const cookie = galletas(trabajador.sesion)
    const leer = async (q) => {
      const r = await fetch(`${BASE}/canal/gente${q}`, { headers: { cookie } })
      return (await r.text()).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ')
    }
    const primera = await leer('')
    const n = Number(primera.match(/(\d+) personas en el directorio/)?.[1] ?? -1)
    ok(n === activos - 1, `dice ${n} personas (todas menos yo: ${activos - 1}), no 200`, primera.slice(0, 200))
    ok(/Ver 100 más · quedan \d+/.test(primera) && /ves 100/.test(primera), 'enseña las primeras 100 y ofrece ver más')
    const todas = await leer('?ver=1000')
    ok(!/quedan \d+/.test(todas) && todas.includes('Compañera Privacidad (prueba)'), 'con «ver más» hasta el final salen todas, la ficha de prueba incluida')
    ok(!/04140000002|otra@prueba\.local|PRUEBA-PRIV-OTRA/.test(todas), 'sin teléfono, correo ni cédula de nadie')
    const busca = await leer(`?q=${encodeURIComponent('Compañera Privacidad')}`)
    ok(/1 persona en el directorio/.test(busca), 'la búsqueda encuentra a la persona')
    const rara = await fetch(`${BASE}/canal/gente?q=${encodeURIComponent('a),cedula.ilike.(%')}`, { headers: { cookie } })
    ok(rara.status === 200, 'una búsqueda con comas y paréntesis no rompe el filtro', rara.status)
  }
} catch (e) {
  fallos++
  console.error(`\n✖ ${e.message}`)
} finally {
  for (const x of ajenos.seguimientos) await servicio.schema('nucleo').from('seguimiento').delete().eq('perfil', x.perfil).eq('objeto_id', x.objeto)
  for (const x of ajenos.recientes) await servicio.schema('ui').from('reciente').delete().eq('perfil', x.perfil).eq('objeto_id', x.objeto)
  await limpiar()
  console.log(`\n${pasos - fallos}/${pasos} comprobaciones bien${fallos ? ` · ${fallos} FALLARON` : ''}. Limpieza hecha.`)
  process.exitCode = fallos ? 1 : 0
}
