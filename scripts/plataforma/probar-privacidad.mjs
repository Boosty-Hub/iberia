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
 * Crea su gente de prueba (correos `*.privacidad@plataforma.local`, cédulas
 * `PRUEBA-PRIV-*`, un rol temporal) y la borra al salir, barriendo por prefijo.
 *
 *   node --env-file=.env.local scripts/plataforma/probar-privacidad.mjs
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
  return { cliente, id: data.user.id, email }
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
  const { data: rol } = await servicio.from('roles').select('id').eq('clave', ROL_CH).maybeSingle()
  if (rol) {
    await servicio.from('rol_permisos').delete().eq('rol_id', rol.id)
    await servicio.from('roles').delete().eq('id', rol.id)
  }
}

async function cuenta(nombre, rolClave, organizacion = 'iberia') {
  const email = `${nombre}${DOMINIO}`
  const { data, error } = await servicio.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { nombre_completo: `Prueba ${nombre} (privacidad)`, rol_clave: rolClave, organizacion },
  })
  if (error) throw new Error(`${email}: ${error.message}`)
  return data.user.id
}

await limpiar()
// Lo que la prueba deja en cuentas que no son suyas (seguir al comentar, recientes): se borra al salir.
const ajenos = { seguimientos: [], recientes: [] }
let admin, consultor, lector, trabajador, ch
try {
  // --- Gente de prueba -----------------------------------------------------------
  const { data: area } = await servicio.from('areas').select('id').limit(1).single()
  const { data: rol, error: eRol } = await servicio
    .from('roles')
    .insert({ clave: ROL_CH, nombre: 'Capital Humano (prueba de privacidad)', nivel: 'usuario' })
    .select('id')
    .single()
  if (eRol) throw new Error(`rol temporal: ${eRol.message}`)
  const { error: ePerm } = await servicio.from('rol_permisos').upsert({ rol_id: rol.id, recurso: 'modulo:empleados', ver: true, crear: false, editar: true, eliminar: false }, { onConflict: 'rol_id,recurso' })
  if (ePerm) throw new Error(`permiso temporal: ${ePerm.message}`)

  const idTrabajador = await cuenta('planta', 'personal-planta')
  await cuenta('ch', ROL_CH)
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

  ;[admin, consultor, lector, trabajador, ch] = await Promise.all([
    sesion('admin.pruebas@plataforma.local'),
    sesion('consultor.pruebas@plataforma.local'),
    sesion('lector.pruebas@plataforma.local'),
    sesion(`planta${DOMINIO}`),
    sesion(`ch${DOMINIO}`),
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
    const per = await t.from('personas').select('id, email, telefono, notas').limit(5)
    ok(!per.error && !(per.data ?? []).length, 'las personas del levantamiento (correo, teléfono, notas) le salen vacías', per.error?.message ?? per.data?.length)
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
