/**
 * Roles y permisos, contra la base real.
 *
 *   node --env-file=.env.local scripts/probar-permisos.mjs
 *
 * No pide contraseña ni toca dato de nadie: crea sus propias cuentas, su rol y
 * una sección temporal —todo con el prefijo `prueba-`, que `probar:supabase`
 * exige que no quede— y lo borra al salir, también si algo revienta a mitad.
 *
 * Lo que comprueba es lo que la matriz promete:
 *   · nadie se sube el rol a sí mismo;
 *   · el techo del nivel se cumple en la base, no solo en el formulario;
 *   · la casilla «ver» de una sección, del mapa y de una lección cierra de verdad
 *     la lectura, y la de «editar»/«eliminar» cierra la escritura;
 *   · el alta con `rol_clave` enlaza el rol pedido.
 */
import { createClient } from '@supabase/supabase-js'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL_SUPA, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const PREFIJO = 'prueba-permisos'

let pasadas = 0
const fallos = []
function comprobar(nombre, ok, detalle = '') {
  if (ok) {
    pasadas++
    console.log(`  ✓ ${nombre}`)
  } else {
    fallos.push(nombre)
    console.log(`  ✖ ${nombre}${detalle ? ` — ${detalle}` : ''}`)
  }
}

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of data?.users ?? []) if ((u.email ?? '').startsWith(PREFIJO)) await admin.auth.admin.deleteUser(u.id)
  await admin.from('informe_secciones').delete().like('slug', `${PREFIJO}%`)
  await admin.from('roles').delete().like('clave', `${PREFIJO}%`)
}

/** Una cuenta de prueba con su sesión propia, como la tendría cualquiera. */
async function cuenta(sufijo, metadatos) {
  const email = `${PREFIJO}-${sufijo}@iberia.local`
  const password = crypto.randomUUID()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { organizacion: 'iberia', ...metadatos },
  })
  if (error) throw new Error(`no se pudo crear ${email}: ${error.message}`)
  const cliente = createClient(URL_SUPA, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  })
  const { error: e2 } = await cliente.auth.signInWithPassword({ email, password })
  if (e2) throw new Error(`no se pudo entrar como ${email}: ${e2.message}`)
  return { id: data.user.id, cliente }
}

async function idDeRol(clave) {
  const { data } = await admin.from('roles').select('id').eq('clave', clave).single()
  return data.id
}

await limpiar()

try {
  console.log('\nLos roles de fábrica\n')
  const { data: fabrica } = await admin.from('roles').select('clave, nivel, sistema, rol_permisos(count)').eq('sistema', true)
  const claves = new Set((fabrica ?? []).map((r) => r.clave))
  comprobar(
    'existen los cuatro de fábrica',
    ['administrador', 'consultor', 'lector', 'personal-planta'].every((c) => claves.has(c))
  )
  const adm = fabrica.find((r) => r.clave === 'administrador')
  comprobar('el administrador no lleva matriz: lo puede todo', adm?.rol_permisos?.[0]?.count === 0)
  const { data: sinRol } = await admin.from('profiles').select('id').is('rol_id', null)
  comprobar('ninguna cuenta se quedó sin rol', (sinRol ?? []).length === 0)

  console.log('\nNadie se sube el rol\n')
  const lector = await cuenta('lector', { rol: 'lector' })
  const r1 = await lector.cliente.from('profiles').update({ rol: 'admin' }).eq('id', lector.id).select('rol')
  comprobar('un lector no se pone rol = admin', Boolean(r1.error), JSON.stringify(r1.data))
  const r2 = await lector.cliente
    .from('profiles')
    .update({ rol_id: await idDeRol('administrador') })
    .eq('id', lector.id)
    .select('rol')
  comprobar('ni rol_id = administrador', Boolean(r2.error), JSON.stringify(r2.data))
  const r3 = await lector.cliente.from('profiles').update({ activo: true, organizacion: 'boosty' }).eq('id', lector.id).select('id')
  comprobar('ni se cambia de organización', Boolean(r3.error))
  const r4 = await lector.cliente.from('profiles').update({ cargo: 'Cargo de prueba' }).eq('id', lector.id).select('cargo')
  comprobar('pero sí su cargo', !r4.error && r4.data?.[0]?.cargo === 'Cargo de prueba', r4.error?.message)

  console.log('\nEl alta con rol_clave\n')
  const planta = await cuenta('planta', { rol: 'lector', rol_clave: 'personal-planta' })
  const { data: pPlanta } = await admin.from('profiles').select('rol, roles(clave)').eq('id', planta.id).single()
  comprobar('queda con el rol pedido y su nivel', pPlanta.roles?.clave === 'personal-planta' && pPlanta.rol === 'lector')

  console.log('\nEl techo del nivel, en la base\n')
  const idLectura = crypto.randomUUID()
  const idConsulta = crypto.randomUUID()
  await admin.from('roles').insert([
    { id: idLectura, clave: `${PREFIJO}-lectura`, nombre: 'Prueba · lectura', nivel: 'lector' },
    { id: idConsulta, clave: `${PREFIJO}-consulta`, nombre: 'Prueba · consultor', nivel: 'consultor' },
  ])
  const t1 = await admin.from('rol_permisos').insert({ rol_id: idLectura, recurso: 'modulo:hallazgos', editar: true })
  comprobar('un rol de solo lectura no guarda «editar»', Boolean(t1.error))
  const t2 = await admin.from('rol_permisos').insert({ rol_id: idConsulta, recurso: 'modulo:roles', ver: true })
  comprobar('un consultor no gestiona roles', Boolean(t2.error))
  const t3 = await admin.from('rol_permisos').insert({ rol_id: idConsulta, recurso: 'modulo:hallazgos', eliminar: true }).select('ver').single()
  comprobar('marcar «eliminar» marca también «ver»', t3.data?.ver === true, t3.error?.message)
  const t4 = await admin.from('roles').update({ nivel: 'lector' }).eq('clave', 'consultor')
  comprobar('un rol de fábrica no cambia de nivel', Boolean(t4.error))
  const t5 = await admin.from('rol_permisos').insert({ rol_id: idConsulta, recurso: 'cualquier-cosa', ver: true })
  comprobar('un recurso mal escrito no entra', Boolean(t5.error))

  console.log('\nLa casilla «ver», cerrando de verdad\n')
  // Una sección temporal: sin publicar, para probar lectura y escritura del equipo.
  const slugPrueba = `${PREFIJO}-seccion`
  const { error: eSec } = await admin.from('informe_secciones').insert({
    slug: slugPrueba,
    titulo: 'Sección de prueba (se borra sola)',
    parte: 'arquitectura',
    orden: 9999,
    publicado: false,
  })
  if (eSec) throw new Error(`no se pudo crear la sección de prueba: ${eSec.message}`)
  const { data: deFabrica } = await admin.from('rol_permisos').select('roles(clave)').eq('recurso', `informe:${slugPrueba}`)
  comprobar(
    'una sección nueva entra sola en los roles de fábrica',
    (deFabrica ?? []).length === 2,
    JSON.stringify(deFabrica)
  )

  // Consultor de prueba: ve y edita la sección temporal, no la borra; no ve «inicio».
  // ⚠️ En una inserción de varias filas, supabase-js pone NULL en la columna que
  // una fila no trae —no el valor por defecto—, así que van las cuatro siempre.
  const { error: ePerm } = await admin.from('rol_permisos').insert([
    { rol_id: idConsulta, recurso: `informe:${slugPrueba}`, ver: true, crear: false, editar: true, eliminar: false },
    { rol_id: idConsulta, recurso: 'modulo:informe', ver: true, crear: false, editar: false, eliminar: false },
  ])
  if (ePerm) throw new Error(`no se pudo armar la matriz de prueba: ${ePerm.message}`)
  const consultor = await cuenta('consultor', { rol: 'consultor', rol_clave: `${PREFIJO}-consulta` })
  const { data: ve } = await consultor.cliente.from('informe_secciones').select('slug')
  const vistas = new Set((ve ?? []).map((s) => s.slug))
  comprobar('ve la sección que tiene marcada', vistas.has(slugPrueba))
  comprobar('no ve las que no tiene marcadas', !vistas.has('inicio') && vistas.size === 1, [...vistas].join(', '))
  const u1 = await consultor.cliente
    .from('informe_secciones')
    .update({ subtitulo: 'Editada por la prueba' })
    .eq('slug', slugPrueba)
    .select('subtitulo')
  comprobar('edita la sección con «editar»', u1.data?.[0]?.subtitulo === 'Editada por la prueba', u1.error?.message)
  const d1 = await consultor.cliente.from('informe_secciones').delete().eq('slug', slugPrueba).select('slug')
  comprobar('no la borra sin «eliminar»', (d1.data ?? []).length === 0)
  const u2 = await consultor.cliente.from('informe_secciones').update({ subtitulo: 'x' }).eq('slug', 'inicio').select('slug')
  comprobar('no edita una sección que no ve', (u2.data ?? []).length === 0)
  const c1 = await consultor.cliente
    .from('informe_secciones')
    .insert({ slug: `${PREFIJO}-nueva`, titulo: 'x', parte: 'arquitectura' })
  comprobar('no crea secciones sin «crear» en el editor', Boolean(c1.error))

  // Lector de prueba sin nada marcado: ni el mapa ni las lecciones.
  const vacio = await cuenta('vacio', { rol: 'lector', rol_clave: `${PREFIJO}-lectura` })
  const { data: mapaVacio } = await vacio.cliente.from('macroprocesos').select('id').limit(1)
  comprobar('sin la casilla del mapa, el mapa no se lee', (mapaVacio ?? []).length === 0)
  const { data: leccVacio } = await vacio.cliente.from('lecciones').select('numero')
  comprobar('sin las casillas de las lecciones, no ve ninguna', (leccVacio ?? []).length === 0)
  const { data: mapaLector } = await lector.cliente.from('macroprocesos').select('id').limit(1)
  comprobar('el lector de fábrica sí lee el mapa', (mapaLector ?? []).length === 1)
  const { data: leccPlanta } = await planta.cliente.from('lecciones').select('numero')
  comprobar('el personal de planta ve las nueve lecciones', (leccPlanta ?? []).length === 9, String(leccPlanta?.length))
  const { data: secPlanta } = await planta.cliente.from('informe_secciones').select('slug')
  comprobar('y ninguna sección del informe', (secPlanta ?? []).length === 0)
  const { data: secLector } = await lector.cliente.from('informe_secciones').select('slug, publicado')
  comprobar('el lector solo recibe lo publicado', (secLector ?? []).every((s) => s.publicado))

  console.log('\nLa pregunta\n')
  const { data: puedeUsuarios } = await lector.cliente.rpc('puede', { p_recurso: 'modulo:usuarios', p_accion: 'ver' })
  comprobar('puede(): un lector no ve usuarios', puedeUsuarios === false)
  const { data: puedeInicio } = await lector.cliente.rpc('puede', { p_recurso: 'informe:inicio', p_accion: 'ver' })
  comprobar('puede(): un lector sí tiene la casilla de «inicio»', puedeInicio === true)
  const { data: puedeEditar } = await lector.cliente.rpc('puede', { p_recurso: 'informe:inicio', p_accion: 'editar' })
  comprobar('puede(): pero no la edita', puedeEditar === false)
  const { data: mias } = await consultor.cliente.rpc('mis_permisos')
  comprobar('mis_permisos(): devuelve la matriz de su rol', (mias ?? []).length === 3, String(mias?.length))
  const { data: ajena } = await consultor.cliente.from('rol_permisos').select('rol_id').neq('rol_id', idConsulta).limit(1)
  comprobar('y no deja leer la matriz de otro rol', (ajena ?? []).length === 0)
  const { data: rolesVistos } = await lector.cliente.from('roles').select('id')
  comprobar('los nombres de los roles sí se leen con sesión', (rolesVistos ?? []).length >= 4)
  const rNuevo = await lector.cliente.from('roles').insert({ clave: `${PREFIJO}-intruso`, nombre: 'x', nivel: 'admin' })
  comprobar('pero un lector no crea roles', Boolean(rNuevo.error))
} finally {
  await limpiar()
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const restos = (data?.users ?? []).filter((u) => (u.email ?? '').startsWith(PREFIJO))
  const { data: secRestos } = await admin.from('informe_secciones').select('slug').like('slug', `${PREFIJO}%`)
  const { data: permRestos } = await admin.from('rol_permisos').select('recurso').like('recurso', `%${PREFIJO}%`)
  console.log('\nLimpieza\n')
  comprobar('no quedan cuentas, secciones ni permisos de prueba', !restos.length && !secRestos?.length && !permRestos?.length)
}

console.log(`\n${pasadas} comprobaciones pasaron${fallos.length ? `, ${fallos.length} fallaron` : ''}.`)
process.exit(fallos.length ? 1 : 0)
