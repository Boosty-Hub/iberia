/**
 * El certificado: quién puede emitirlo, y cómo se ve.
 *
 *   node --env-file=.env.local scripts/probar-certificado.mjs
 *
 * El certificado es lo contractual del adiestramiento y va registrado en
 * Capital Humano, así que lo que hay que comprobar no es que salga bonito sino
 * que **no se lo pueda fabricar quien lo recibe**. La política de la tabla no
 * deja al trabajador escribir en ella; la emisión pasa por
 * `emitir_mi_certificado()`, que es `security definer` y por lo tanto se salta
 * esa política. Una función así es exactamente donde se cuelan los agujeros, y
 * por eso se prueba con sesiones reales de dos personas distintas.
 *
 * Después abre la página con Playwright y la captura, que para eso no hay
 * comprobación automática que valga.
 *
 * Crea dos trabajadores de prueba y los borra al salir, barriendo por prefijo.
 */

import { createClient } from '@supabase/supabase-js'
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3000'
const SALIDA = args.salida ?? 'capturas/certificado'
/** Para mirar la hoja de impresión hace falta una sesión de editor. */
const EMAIL_ADMIN = args.email ?? 'gmontiel@spatiumgroup.com'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

const PREFIJO = 'prueba-cert-'
const CEDULA = 'PRUEBA-CERT-'

/**
 * Dos personas. Yorgelis termina el curso; Douglas se queda a mitad, y es el
 * que de verdad importa: es quien no debe poder emitir nada.
 */
const GENTE = [
  { id: 'termina', nombre: 'Yorgelis Pérez', cargo: 'Operadora de Envasado', familia: 'linea' },
  { id: 'a-medias', nombre: 'Douglas Rangel', cargo: 'Vigilante', familia: 'seguridad' },
]

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
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const usuarios = (data?.users ?? []).filter((u) => (u.email ?? '').startsWith(PREFIJO))
  const { data: fichas } = await admin.from('empleados').select('id').like('cedula', `${CEDULA}%`)
  for (const f of fichas ?? []) await admin.from('empleados').delete().eq('id', f.id)
  for (const u of usuarios) await admin.auth.admin.deleteUser(u.id)
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

// -----------------------------------------------------------------------------

await limpiar()
await mkdir(SALIDA, { recursive: true })

const { data: curso } = await admin
  .from('cursos')
  .select('id, abierto')
  .eq('clave', 'ajito')
  .single()

if (!curso.abierto) {
  console.error('\n✖ El curso está cerrado. Ábrelo: npm run sembrar:adiestramiento -- --abrir\n')
  process.exit(1)
}

const { data: lecciones } = await admin
  .from('lecciones')
  .select('id, numero')
  .eq('curso_id', curso.id)
  .eq('activa', true)
  .order('numero')

const { data: area } = await admin
  .from('areas')
  .select('id')
  .eq('slug', 'j-produccion')
  .maybeSingle()

const montadas = {}
const navegador = await chromium.launch()

console.log('\nEl certificado del curso\n')

try {
  // --- montar las dos personas ----------------------------------------------
  for (const persona of GENTE) {
    const correo = `${PREFIJO}${persona.id}@iberia.invalid`

    const { data: creado } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: { nombre_completo: persona.nombre, organizacion: 'iberia', rol: 'lector' },
    })

    const { data: ficha } = await admin
      .from('empleados')
      .insert({
        cedula: `${CEDULA}${persona.id}`,
        nombre_completo: persona.nombre,
        cargo: persona.cargo,
        area_id: area?.id ?? null,
        nivel: 'planta',
        tipo_nomina: 'diaria',
        sede: 'cagua',
        familia_oficio: persona.familia,
        perfil_id: creado.user.id,
      })
      .select('id')
      .single()

    const { data: matricula } = await admin
      .from('matriculas')
      .insert({
        curso_id: curso.id,
        empleado_id: ficha.id,
        familia_oficio: persona.familia,
        nombre_corto: persona.nombre.split(' ')[0],
      })
      .select('id')
      .single()

    const { data: enlace } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: correo,
    })
    const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
    const { data: sesion } = await anon.auth.verifyOtp({
      token_hash: enlace.properties.hashed_token,
      type: 'magiclink',
    })

    const suyo = createClient(URL_SUPA, CLAVE_PUB, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sesion.session.access_token}` } },
    })

    // Yorgelis termina las nueve; Douglas solo las tres primeras. Los avances se
    // escriben con la sesión de cada quien, como los escribiría la aplicación.
    const cuantas = persona.id === 'termina' ? lecciones.length : 3
    await suyo.from('avances').insert(
      lecciones.slice(0, cuantas).map((l) => ({
        matricula_id: matricula.id,
        leccion_id: l.id,
        estado: 'completada',
        completada_en: new Date().toISOString(),
      }))
    )

    montadas[persona.id] = { ...persona, ficha, matricula, sesion: sesion.session, suyo }
  }

  const termina = montadas['termina']
  const aMedias = montadas['a-medias']

  // --- las guardas de la función --------------------------------------------
  console.log('Quién puede emitirlo')

  {
    const { error } = await aMedias.suyo.rpc('emitir_mi_certificado', {
      p_matricula: aMedias.matricula.id,
    })
    comprobar(
      'a medio curso no se emite nada',
      /faltan lecciones/i.test(error?.message ?? ''),
      error ? '' : 'emitió igual'
    )
  }

  {
    // El agujero clásico de una función security definer: pasarle el id de otro.
    const { error } = await aMedias.suyo.rpc('emitir_mi_certificado', {
      p_matricula: termina.matricula.id,
    })
    comprobar(
      'no puedo emitir el de otra persona',
      /no es tuya/i.test(error?.message ?? ''),
      error ? '' : 'emitió el ajeno'
    )
  }

  {
    const { error } = await termina.suyo
      .from('certificados')
      .insert({
        matricula_id: termina.matricula.id,
        codigo: 'IB-FALSO-0001',
        nombre_completo: 'Yo Mismo',
        cedula: 'V-00000000',
      })
    comprobar('no puedo escribir en la tabla a mano', Boolean(error), error ? '' : 'insertó')
  }

  console.log('\nEmisión')

  const { data: primero, error: errPrimero } = await termina.suyo.rpc('emitir_mi_certificado', {
    p_matricula: termina.matricula.id,
  })
  comprobar('terminado el curso, se emite', Boolean(primero), errPrimero?.message ?? '')

  if (primero) {
    comprobar(
      `el código es legible · ${primero.codigo}`,
      /^IB-AJITO-\d{4}-\d{4}$/.test(primero.codigo),
      primero.codigo
    )
    comprobar(
      'congela nombre, cédula y cargo',
      primero.nombre_completo === termina.nombre && primero.cargo === termina.cargo,
      `${primero.nombre_completo} · ${primero.cargo}`
    )

    const { data: segundo } = await termina.suyo.rpc('emitir_mi_certificado', {
      p_matricula: termina.matricula.id,
    })
    comprobar(
      'emitirlo dos veces devuelve el mismo',
      segundo?.codigo === primero.codigo,
      `${primero.codigo} vs ${segundo?.codigo}`
    )
  }

  {
    const { data } = await aMedias.suyo
      .from('certificados')
      .select('codigo')
      .eq('matricula_id', termina.matricula.id)
    comprobar('no leo el certificado de otro', (data ?? []).length === 0)
  }

  // --- la vista --------------------------------------------------------------
  console.log('\nLa vista')

  for (const persona of [termina, aMedias]) {
    const contexto = await navegador.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
    await contexto.addCookies(
      cookiesDeSesion(persona.sesion).map((c) => ({
        ...c,
        domain: new URL(BASE).hostname,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      }))
    )

    const pagina = await contexto.newPage()
    pagina.on('console', (m) => {
      if (m.type() === 'error') problemas.push(`[consola] ${persona.id}: ${m.text()}`)
    })

    await pagina.goto(`${BASE}/canal/adiestramiento/certificado`, { waitUntil: 'networkidle' })

    const tarjeta = pagina.locator('[data-certificado]')
    const tiene = (await tarjeta.count()) > 0

    if (persona.id === 'termina') {
      comprobar('quien terminó ve su certificado', tiene)
      if (tiene) {
        const texto = await tarjeta.innerText()
        comprobar('sale su nombre', texto.includes(persona.nombre))
        comprobar('sale su cargo', texto.includes(persona.cargo))
        comprobar('sale el código', /IB-AJITO-\d{4}-\d{4}/.test(texto))
      }
    } else {
      comprobar('quien no terminó no ve certificado', !tiene)
      const cuerpo = await pagina.locator('body').innerText()
      comprobar('y se le dice qué le falta', /nueve lecciones/i.test(cuerpo))
    }

    // Lo que una captura no enseña: desborde horizontal.
    const ancho = await pagina.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    comprobar(`sin desborde horizontal (${persona.id})`, ancho <= 1, `${ancho}px de más`)

    await pagina.screenshot({
      path: join(SALIDA, `${persona.id}.png`),
      fullPage: true,
    })
    await contexto.close()
  }

  // --- la hoja de impresión --------------------------------------------------
  //
  // Hay que mirarla **con un certificado dentro**, y el único que existe es el
  // de prueba que se borra al salir de aquí. Por eso va en este script y no en
  // `capturar:adiestramiento`, que la encontraría siempre vacía.
  console.log('\nLa hoja de impresión')

  const { data: enlaceAdmin } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: EMAIL_ADMIN,
  })

  if (!enlaceAdmin?.properties?.hashed_token) {
    comprobar(`hay una cuenta de editor (${EMAIL_ADMIN})`, false, 'no se pudo acuñar la sesión')
  } else {
    const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
    const { data: sesionAdmin } = await anon.auth.verifyOtp({
      token_hash: enlaceAdmin.properties.hashed_token,
      type: 'magiclink',
    })

    const contexto = await navegador.newContext({
      viewport: { width: 1280, height: 1200 },
      locale: 'es-VE',
    })
    await contexto.addCookies(
      cookiesDeSesion(sesionAdmin.session).map((c) => ({
        ...c,
        domain: new URL(BASE).hostname,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      }))
    )

    const pagina = await contexto.newPage()
    await pagina.goto(`${BASE}/dashboard/adiestramiento/certificados`, {
      waitUntil: 'networkidle',
    })

    const hojas = await pagina.locator('[data-certificado]').count()
    comprobar('el editor ve la hoja para imprimir', hojas >= 1, `${hojas} hojas`)

    await pagina.screenshot({ path: join(SALIDA, 'impresion.png'), fullPage: true })
    await contexto.close()
  }
} finally {
  await navegador.close()
  await limpiar()
  console.log('\n  · limpieza: fichas y usuarios de prueba borrados')
}

console.log(`\n${pasadas} comprobaciones pasaron.`)

if (problemas.length) {
  console.log(`\n✖ ${problemas.length} fallo${problemas.length > 1 ? 's' : ''}:`)
  for (const p of problemas) console.log(`  · ${p}`)
  console.log('')
  process.exit(1)
}

console.log(`Sin fallos. Capturas en ${SALIDA}/ — ahora hay que abrirlas.\n`)
