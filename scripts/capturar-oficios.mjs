/**
 * El mismo curso, visto por cada oficio.
 *
 *   node --env-file=.env.local scripts/capturar-oficios.mjs
 *   node --env-file=.env.local scripts/capturar-oficios.mjs --leccion 6
 *
 * Los ejercicios bifurcan por familia de oficio, y mirar el curso siempre desde
 * el mismo lado es no mirarlo. Lo que puede estar mal y no se ve de otra forma
 * es que a la cocinera de pruebas le llegue el ejercicio del codificador de
 * frascos — el daño que Gabriel señaló desde el principio.
 *
 * Así que este script **crea un trabajador de prueba por oficio**, con su
 * sesión y su matrícula, recorre la lección hasta el ejercicio y lo captura.
 * Después borra todo: los empleados, los usuarios de auth y lo que hayan
 * respondido. La limpieza barre por prefijo, no por lo que recuerde esta
 * corrida, así que recoge también lo que quede de una que se haya caído.
 *
 * Opciones: --leccion N (por defecto la 2, que es la que más bifurca) · --salida
 */

import { createClient } from '@supabase/supabase-js'
import { ejerciciosDeLeccion, preguntaDeCampo } from '../lib/adiestramiento.ts'
import { chromium, devices } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3000'
const LECCION = Number(args.leccion ?? 2)
const SALIDA = args.salida ?? 'capturas/oficios'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

/** Con esto se reconoce y se barre todo lo que crea este script. */
const PREFIJO = 'prueba-oficio-'
const CEDULA = 'PRUEBA-OFICIO-'

/**
 * Un trabajador de mentira por oficio, con el cargo que de verdad tendría. El
 * cargo importa: es lo que se ve en el directorio y lo que hace creíble la
 * captura.
 */
const GENTE = [
  { familia: 'linea', nombre: 'Yorgelis Pérez', cargo: 'Operadora de Envasado' },
  { familia: 'cocina', nombre: 'Nancy Ruiz', cargo: 'Preparadora de Pruebas' },
  { familia: 'almacen', nombre: 'Wilmer Godoy', cargo: 'Montacarguista' },
  { familia: 'mantenimiento', nombre: 'Argenis Mora', cargo: 'Técnico de Mantenimiento' },
  { familia: 'laboratorio', nombre: 'Keila Sánchez', cargo: 'Inspectora de Procesos' },
  { familia: 'seguridad', nombre: 'Douglas Rangel', cargo: 'Vigilante' },
  { familia: 'oficina', nombre: 'Marisol Piña', cargo: 'Analista de Nómina' },
  { familia: 'generico', nombre: 'Rosa Delgado', cargo: null },
]

// -----------------------------------------------------------------------------

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const usuarios = (data?.users ?? []).filter((u) => (u.email ?? '').startsWith(PREFIJO))

  const { data: fichas } = await admin
    .from('empleados')
    .select('id')
    .like('cedula', `${CEDULA}%`)

  for (const ficha of fichas ?? []) {
    // Las matrículas, avances y respuestas caen en cascada con la ficha.
    await admin.from('empleados').delete().eq('id', ficha.id)
  }
  for (const usuario of usuarios) {
    await admin.auth.admin.deleteUser(usuario.id)
  }

  return { fichas: fichas?.length ?? 0, usuarios: usuarios.length }
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

await limpiar() // por si quedó algo de una corrida anterior
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

const { data: leccionFila } = await admin
  .from('lecciones')
  .select('forma, titulo')
  .eq('curso_id', curso.id)
  .eq('numero', LECCION)
  .single()

const forma = leccionFila.forma

const { data: area } = await admin
  .from('areas')
  .select('id')
  .eq('slug', 'j-produccion')
  .maybeSingle()

const navegador = await chromium.launch()
const problemas = []
const vistos = []

console.log(`\nLección ${LECCION} · ${leccionFila.titulo} — vista por ${GENTE.length} oficios\n`)

try {
  for (const persona of GENTE) {
    const correo = `${PREFIJO}${persona.familia}@iberia.invalid`

    const { data: creado, error: errAuth } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: { nombre_completo: persona.nombre, organizacion: 'iberia', rol: 'lector' },
    })
    if (errAuth) {
      problemas.push(`${persona.familia}: no se pudo crear el usuario · ${errAuth.message}`)
      continue
    }

    const { data: ficha, error: errFicha } = await admin
      .from('empleados')
      .insert({
        cedula: `${CEDULA}${persona.familia}`,
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

    if (errFicha) {
      problemas.push(`${persona.familia}: no se pudo crear la ficha · ${errFicha.message}`)
      continue
    }

    await admin.from('matriculas').insert({
      curso_id: curso.id,
      empleado_id: ficha.id,
      familia_oficio: persona.familia,
      nombre_corto: persona.nombre.split(' ')[0],
    })

    // Sesión sin contraseña, como en el resto de las verificaciones.
    const { data: enlace } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: correo,
    })
    const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })
    const { data: sesion, error: errSesion } = await anon.auth.verifyOtp({
      token_hash: enlace.properties.hashed_token,
      type: 'magiclink',
    })
    if (errSesion) {
      problemas.push(`${persona.familia}: no se pudo abrir sesión · ${errSesion.message}`)
      continue
    }

    const contexto = await navegador.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
    await contexto.addCookies(
      cookiesDeSesion(sesion.session).map((c) => ({
        ...c,
        domain: new URL(BASE).hostname,
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      }))
    )

    const pagina = await contexto.newPage()
    pagina.on('console', (msg) => {
      if (msg.type() === 'error') problemas.push(`[consola] ${persona.familia}: ${msg.text()}`)
    })

    await pagina.goto(`${BASE}/canal/adiestramiento/${LECCION}`, { waitUntil: 'networkidle' })

    const empezar = pagina.getByRole('button', { name: /empezar la lecci/i })
    if (await empezar.count()) {
      await empezar.click()
      // Se espera al primer turno, no al <audio>: si se sigue antes de que
      // React repinte, el bucle vuelve a tocar «Empezar» y se queda pegado.
      await pagina
        .waitForSelector('section', { state: 'attached', timeout: 20000 })
        .catch(() => problemas.push(`${persona.familia}: la lección no abrió`))
    }

    // Se recorre la lección entera y se anota qué consigna le tocó a cada
    // ejercicio. Pararse en el primero no serviría: en la lección 2 el primero
    // es igual para todos, y el que bifurca es el segundo.
    const recibidas = new Map()

    for (let vuelta = 0; vuelta < 16; vuelta++) {
      // Se anota lo que hay en pantalla ANTES de tocar nada: al contestar el
      // último ejercicio la lección se cierra y redirige a la siguiente, así
      // que recoger al final sería leer la página equivocada.
      for (const tarjeta of await pagina.locator('[data-ejercicio]').all()) {
        const clave = await tarjeta.getAttribute('data-ejercicio')
        const texto = (await tarjeta.locator('[data-consigna]').textContent())?.trim() ?? ''
        if (clave) recibidas.set(clave, texto)
      }

      // Si ya saltó a otra lección, este recorrido terminó.
      if (!pagina.url().endsWith(`/adiestramiento/${LECCION}`)) break

      const antes = await pagina.locator('section').count()

      // Sin micrófono ni cámara, la salida es la vía escrita — que es
      // justamente la que tiene que estar siempre disponible. Se toca primero
      // porque en modo voz la caja de texto no existe hasta entonces.
      const prefiero = pagina.getByRole('button', { name: /prefiero (escribirlo|cont[aá]rselo)/i })
      if (await prefiero.count()) await prefiero.last().click()

      const caja = pagina.locator('textarea:visible').last()
      if (await caja.count()) {
        await caja.fill('Respuesta de prueba.')
        await pagina.getByRole('button', { name: /mand[aá]rselo a ajito/i }).last().click()
      } else {
        const seguir = pagina
          .locator('form[action] button[type="submit"]')
          .filter({ hasNotText: /terminar la lecci/i })
          .last()
        if (!(await seguir.count())) break
        await seguir.click()
      }

      const crecio = await pagina
        .waitForFunction((n) => document.querySelectorAll('section').length > n, antes, {
          timeout: 15000,
        })
        .catch(() => null)
      if (!crecio) break
    }

    // La captura se toma de la lección, no de donde haya ido a parar después.
    if (!pagina.url().endsWith(`/adiestramiento/${LECCION}`)) {
      await pagina.goto(`${BASE}/canal/adiestramiento/${LECCION}`, { waitUntil: 'networkidle' })
    }

    await pagina.screenshot({ path: join(SALIDA, `${persona.familia}.png`), fullPage: true })

    // --- Lo recibido contra lo que dice el catálogo --------------------------
    const esperadas = new Map(
      ejerciciosDeLeccion(forma, persona.familia).map((e) => [e.clave, e.consigna])
    )
    const campo = preguntaDeCampo(forma, persona.familia)
    if (campo) esperadas.set('campo', campo)

    const pelar = (t) => t.toLowerCase().replace(/[^a-zaeiouñü ]/gi, ' ').replace(/ +/g, ' ').trim()

    for (const [clave, esperada] of esperadas) {
      const recibida = recibidas.get(clave)
      if (!recibida) {
        problemas.push(`${persona.familia}: no se mostró el ejercicio «${clave}»`)
      } else if (!pelar(recibida).includes(pelar(esperada).slice(0, 40))) {
        problemas.push(
          `${persona.familia}/${clave}: recibió «${recibida.slice(0, 46)}…» pero el catálogo dice «${esperada.slice(0, 46)}…»`
        )
      }
    }

    vistos.push({ familia: persona.familia, cargo: persona.cargo ?? '—', recibidas })
    console.log(
      `  ✓ ${persona.familia.padEnd(14)} ${(persona.cargo ?? '—').padEnd(28)} ${recibidas.size} ejercicios`
    )

    await contexto.close()
  }
} finally {
  await navegador.close()
  const { fichas, usuarios } = await limpiar()
  console.log(`\n  · limpieza: ${fichas} fichas y ${usuarios} usuarios de prueba borrados`)
}

const claves = [...new Set(vistos.flatMap((v) => [...v.recibidas.keys()]))]

for (const clave of claves) {
  const distintas = new Set(vistos.map((v) => v.recibidas.get(clave)).filter(Boolean))
  const bifurca = distintas.size > 1

  console.log(`
  ${clave}  ${bifurca ? `· ${distintas.size} versiones` : '· igual para todos'}`)
  if (bifurca) {
    for (const v of vistos) {
      console.log(`    ${v.familia.padEnd(14)} ${(v.recibidas.get(clave) ?? '—').slice(0, 78)}`)
    }
  } else {
    console.log(`    ${[...distintas][0]?.slice(0, 96) ?? '—'}`)
  }
}

console.log(`\nCapturas en ${SALIDA}/`)
if (problemas.length) {
  console.log(`\n${problemas.length} cosas que revisar:`)
  for (const p of problemas) console.log(`  ✖ ${p}`)
  process.exit(1)
}
console.log('Cada oficio recibe lo suyo.\n')
