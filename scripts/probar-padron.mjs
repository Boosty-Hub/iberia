/**
 * El padrón: enrolar en lote y el enlace como credencial.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/probar-padron.mjs
 *
 * **El enlace personal es una contraseña**, aunque no lo parezca: quien lo tiene
 * entra como esa persona. Así que lo que se comprueba aquí no es que la tabla se
 * pinte bonita, sino las cuatro maneras en que un enlace se convierte en un
 * agujero:
 *
 *   · que el token esté guardado en claro y cualquiera con acceso a la base
 *     pueda suplantar a doscientas personas
 *   · que un token inventado abra sesión
 *   · que uno caducado siga sirviendo
 *   · que se pueda leer `accesos` desde una sesión normal
 *
 * Y después lo que hace el módulo: matricular en lote, acuñar el enlace —que de
 * paso crea la cuenta a quien no la tiene— y que entrar con él deje sesión y
 * cuente el uso.
 *
 * Necesita el servidor de desarrollo levantado.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { acunarToken, huella, pareceToken } from '../lib/accesos.ts'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3000'
const EMAIL_ADMIN = args.email ?? 'gmontiel@spatiumgroup.com'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

const PREFIJO = 'prueba-padron-'
const CEDULA = 'PRUEBA-PADRON-'

const problemas = []
let pasadas = 0

function comprobar(descripcion, condicion, detalle = '') {
  if (condicion) {
    pasadas++
    console.log(`  ✓ ${descripcion}`)
  } else {
    problemas.push(`${descripcion}${detalle ? ` · ${detalle}` : ''}`)
    console.log(`  ✖ ${descripcion}${detalle ? ` · ${detalle}` : ''}`)
  }
}

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 500 })
  const { data: fichas } = await admin.from('empleados').select('id, cedula').like('cedula', `${CEDULA}%`)

  // Las cuentas se acuñan con la cédula, así que se barren por ahí también: si
  // una corrida se cae después de crear la cuenta y antes de la ficha, el
  // usuario huérfano se queda en auth para siempre.
  const correos = new Set((fichas ?? []).map((f) => `${f.cedula.replace(/[^0-9a-zA-Z]/g, '').toLowerCase()}@iberia.local`))
  for (const f of fichas ?? []) await admin.from('empleados').delete().eq('id', f.id)
  for (const u of data?.users ?? []) {
    const correo = (u.email ?? '').toLowerCase()
    if (correo.startsWith(PREFIJO) || correos.has(correo) || correo.startsWith('pruebapadron')) {
      await admin.auth.admin.deleteUser(u.id)
    }
  }
}

function cookiesDeSesion(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const LIMITE = 3180
  if (valor.length <= LIMITE) return [{ name: nombre, value: valor }]
  const trozos = []
  for (let i = 0; i < valor.length; i += LIMITE) {
    trozos.push({ name: `${nombre}.${trozos.length}`, value: valor.slice(i, i + LIMITE) })
  }
  return trozos
}

// =============================================================================

console.log('\nEl token, sin red\n')

const t1 = acunarToken()
const t2 = acunarToken()
comprobar('el token tiene forma de token', pareceToken(t1), t1)
comprobar('dos seguidos no se parecen', t1 !== t2)
comprobar('el token es largo (32 bytes)', Buffer.from(t1, 'base64url').length === 32)
comprobar(
  'la huella es el SHA-256 y no el token',
  huella(t1) === createHash('sha256').update(t1).digest('hex') && !huella(t1).includes(t1)
)
comprobar('un token inventado no tiene forma', !pareceToken('abc') && !pareceToken('../../etc'))

await limpiar()

const { data: curso } = await admin.from('cursos').select('id').eq('clave', 'ajito').single()

const { data: area } = await admin.from('areas').select('id').eq('slug', 'j-produccion').maybeSingle()

const navegador = await chromium.launch()

try {
  // --- una persona de planta, sin cuenta y sin matrícula --------------------
  const { data: ficha } = await admin
    .from('empleados')
    .insert({
      cedula: `${CEDULA}1`,
      nombre_completo: 'Yorgelis Pérez',
      cargo: 'Operadora de Envasado',
      area_id: area?.id ?? null,
      nivel: 'planta',
      tipo_nomina: 'diaria',
      sede: 'cagua',
      telefono: '0412-1234567',
      familia_oficio: 'linea',
    })
    .select('id, perfil_id')
    .single()

  comprobar('arranca sin cuenta, como el padrón real', ficha.perfil_id === null)

  // --- el módulo, con una sesión de editor ----------------------------------
  console.log('\nEl módulo\n')

  const { data: enlaceAdmin } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL_ADMIN,
  })
  const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
  const { data: sesionAdmin } = await anon.auth.verifyOtp({
    token_hash: enlaceAdmin.properties.hashed_token,
    type: 'magiclink',
  })

  const ctxAdmin = await navegador.newContext({
    viewport: { width: 1440, height: 1400 },
    locale: 'es-VE',
  })
  await ctxAdmin.addCookies(
    cookiesDeSesion(sesionAdmin.session).map((c) => ({
      ...c,
      domain: new URL(BASE).hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }))
  )

  const panel = await ctxAdmin.newPage()
  panel.on('console', (m) => {
    if (m.type() === 'error') problemas.push(`[consola] ${m.text()}`)
  })

  await panel.goto(`${BASE}/dashboard/empleados?q=Yorgelis`, { waitUntil: 'networkidle' })
  comprobar('la persona sale en el padrón', await panel.getByText('Yorgelis Pérez').isVisible())

  await panel.getByRole('checkbox', { name: /marcar a yorgelis/i }).check()

  /** Le da a un botón de la barra y espera al efecto, no a la red. */
  async function accionar(rotulo, hasta) {
    await panel.getByRole('button', { name: rotulo }).click()
    for (let i = 0; i < 40; i++) {
      if (await hasta()) return true
      await panel.waitForTimeout(250)
    }
    return hasta()
  }

  const matriculado = await accionar(/^matricular/i, async () => {
    const { count } = await admin
      .from('matriculas')
      .select('id', { count: 'exact', head: true })
      .eq('empleado_id', ficha.id)
      .eq('curso_id', curso.id)
    return (count ?? 0) > 0
  })
  comprobar('se matricula en lote desde el padrón', matriculado)

  await panel.getByRole('checkbox', { name: /marcar a yorgelis/i }).check()
  const acunado = await accionar(/acuñar enlace/i, async () => {
    const { count } = await admin
      .from('accesos')
      .select('id', { count: 'exact', head: true })
      .eq('empleado_id', ficha.id)
    return (count ?? 0) > 0
  })
  comprobar('se acuña el enlace en lote', acunado)

  const { data: recargada } = await admin
    .from('empleados')
    .select('perfil_id')
    .eq('id', ficha.id)
    .single()
  comprobar('y de paso se le crea la cuenta a quien no la tenía', Boolean(recargada.perfil_id))

  const { data: acceso } = await admin
    .from('accesos')
    .select('*')
    .eq('empleado_id', ficha.id)
    .single()

  // --- lo que no puede pasar ------------------------------------------------
  console.log('\nLo que no puede pasar\n')

  const enElMensaje = (acceso.mensaje ?? '').match(/\/entrar\/([A-Za-z0-9_-]+)/)?.[1]
  comprobar('el mensaje trae el enlace', Boolean(enElMensaje))

  comprobar(
    'el token NO está guardado en claro',
    acceso.token_hash !== enElMensaje && !JSON.stringify({ ...acceso, mensaje: '' }).includes(enElMensaje ?? '@'),
    'aparece en la fila'
  )
  comprobar(
    'lo guardado es la huella del token del mensaje',
    acceso.token_hash === huella(enElMensaje ?? '')
  )

  // Desde una sesión normal, `accesos` no se lee. Es donde viven los hashes.
  const suyo = createClient(URL_SUPA, CLAVE_PUB, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${sesionAdmin.session.access_token}` } },
  })
  const { data: fisgón } = await suyo.from('accesos').select('token_hash')
  comprobar('ni un editor lee la tabla de accesos', (fisgón ?? []).length === 0)

  const { data: vista } = await suyo.from('accesos_estado').select('*').eq('empleado_id', ficha.id)
  comprobar('pero sí ve el estado, sin el hash', vista?.length === 1 && !('token_hash' in vista[0]))

  // --- entrar con el enlace -------------------------------------------------
  console.log('\nEntrar con el enlace\n')

  const trabajador = await navegador.newContext({ locale: 'es-VE' })
  const pagina = await trabajador.newPage()

  // Un token inventado, con la forma buena.
  await pagina.goto(`${BASE}/entrar/${acunarToken()}`, { waitUntil: 'networkidle' })
  comprobar('un token inventado no abre nada', pagina.url().includes('/canal/entrar'), pagina.url())

  // Uno caducado.
  await admin
    .from('accesos')
    .update({ expira_en: new Date(Date.now() - 86400000).toISOString() })
    .eq('id', acceso.id)
  await pagina.goto(`${BASE}/entrar/${enElMensaje}`, { waitUntil: 'networkidle' })
  comprobar('uno caducado tampoco', pagina.url().includes('/canal/entrar'), pagina.url())

  // Y el bueno.
  await admin
    .from('accesos')
    .update({ expira_en: new Date(Date.now() + 86400000).toISOString() })
    .eq('id', acceso.id)
  await pagina.goto(`${BASE}/entrar/${enElMensaje}`, { waitUntil: 'networkidle' })
  comprobar(
    'el bueno entra directo al curso, sin clave',
    pagina.url().includes('/canal/adiestramiento'),
    pagina.url()
  )
  comprobar(
    'y ya está dentro con su nombre',
    (await pagina.locator('body').innerText()).includes('Ajito'),
  )

  // Se puede volver a usar: el curso son semanas.
  await pagina.goto(`${BASE}/entrar/${enElMensaje}`, { waitUntil: 'networkidle' })
  comprobar('se puede volver a usar', pagina.url().includes('/canal/adiestramiento'))

  const { data: contado } = await admin.from('accesos').select('usos, usado_en').eq('id', acceso.id).single()
  comprobar('los usos se cuentan', contado.usos === 2, String(contado.usos))
  comprobar('y queda cuándo se usó la primera vez', Boolean(contado.usado_en))

  // El panel tiene que decir lo mismo que la base. La primera versión de la
  // vista corría con la RLS de quien la llama y `accesos` niega el SELECT a
  // todos, así que decía «sin acuñar» de enlaces que existían — y eso lleva a
  // mandar el enlace dos veces a la misma persona.
  console.log('\nLo que ve el panel\n')

  const { data: fila } = await suyo
    .from('padron_estado')
    .select('acceso_expira, acceso_usos, matricula_id')
    .eq('id', ficha.id)
    .maybeSingle()

  comprobar('el panel ve el enlace acuñado', Boolean(fila?.acceso_expira))
  comprobar('y los usos que lleva', fila?.acceso_usos === 2, String(fila?.acceso_usos))
  comprobar('y la matrícula', Boolean(fila?.matricula_id))

  await panel.goto(`${BASE}/dashboard/empleados?q=Yorgelis`, { waitUntil: 'networkidle' })
  await panel.screenshot({ path: 'capturas/adiestramiento/13-padron.png', fullPage: true })

  await trabajador.close()
  await ctxAdmin.close()
} finally {
  await navegador.close()
  await limpiar()
  console.log('\n  · limpieza: fichas y cuentas de prueba borradas')
}

console.log(`\n${pasadas} comprobaciones pasaron.`)

if (problemas.length) {
  console.log(`\n✖ ${problemas.length} fallo${problemas.length > 1 ? 's' : ''}:`)
  for (const p of problemas) console.log(`  · ${p}`)
  console.log('')
  process.exit(1)
}

console.log('Sin fallos.\n')
