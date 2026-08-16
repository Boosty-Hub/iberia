/**
 * Verificación por vista del módulo de adiestramiento.
 *
 *   node --env-file=.env.local scripts/capturar-adiestramiento.mjs
 *
 * A diferencia de `capturar.mjs` y `capturar-canal.mjs`, este no pide clave: la
 * sesión se acuña con un enlace mágico emitido con la clave de servicio y se
 * inyecta como cookie. No cambia ninguna credencial ni deja rastro en la cuenta
 * —el enlace se consume aquí mismo—, y así la verificación visual no depende de
 * que alguien esté delante para escribir su contraseña.
 *
 * El curso es para planta y administración, así que para poder mirarlo se le
 * abre una matrícula temporal al empleado de la sesión y **se borra al salir**,
 * pase lo que pase.
 *
 * Comprueba lo mismo que el del canal: desbordes horizontales, objetivos
 * táctiles menores de 44 px y errores de consola.
 *
 * Opciones: --email, --salida, --base
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
const EMAIL = args.email ?? 'gmontiel@spatiumgroup.com'
const SALIDA = args.salida ?? 'capturas/adiestramiento'

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })
const anon = createClient(URL_SUPA, CLAVE_PUB, { auth: { persistSession: false } })

// --- Sesión sin contraseña ---------------------------------------------------

const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email: EMAIL,
})
if (errEnlace) {
  console.error(`\n✖ No se pudo emitir el enlace para ${EMAIL}: ${errEnlace.message}\n`)
  process.exit(1)
}

const { data: verificado, error: errSesion } = await anon.auth.verifyOtp({
  token_hash: enlace.properties.hashed_token,
  type: 'magiclink',
})
if (errSesion) {
  console.error(`\n✖ No se pudo canjear el enlace: ${errSesion.message}\n`)
  process.exit(1)
}

/**
 * El formato de cookie de @supabase/ssr: el JSON de la sesión en base64url con
 * el prefijo `base64-`, partido en trozos numerados cuando pasa del límite que
 * aguanta una cookie.
 */
function cookiesDeSesion(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const LIMITE = 3180

  if (valor.length <= LIMITE) return [{ nombre, valor }]

  const trozos = []
  for (let i = 0; i < valor.length; i += LIMITE) {
    trozos.push({ nombre: `${nombre}.${trozos.length}`, valor: valor.slice(i, i + LIMITE) })
  }
  return trozos
}

// --- Matrícula temporal ------------------------------------------------------

const { data: empleado } = await admin
  .from('empleados')
  .select('id, nombre_completo, familia_oficio, perfil_id')
  .eq('perfil_id', verificado.user.id)
  .maybeSingle()

const { data: curso } = await admin.from('cursos').select('id, abierto').eq('clave', 'ajito').single()

let matriculaTemporal = null

if (empleado) {
  const { data: ya } = await admin
    .from('matriculas')
    .select('id')
    .eq('curso_id', curso.id)
    .eq('empleado_id', empleado.id)
    .maybeSingle()

  if (!ya) {
    const { data: creada, error } = await admin
      .from('matriculas')
      .insert({ curso_id: curso.id, empleado_id: empleado.id, familia_oficio: 'linea' })
      .select('id')
      .single()

    if (error) console.error(`  ⚠ No se pudo abrir la matrícula temporal: ${error.message}`)
    else matriculaTemporal = creada.id
  }
}

// --- Recorrido ----------------------------------------------------------------

const PAGINAS = [
  { nombre: '01-canal-inicio', ruta: '/canal', movil: true },
  { nombre: '02-curso', ruta: '/canal/adiestramiento', movil: true },
  { nombre: '03-leccion-0', ruta: '/canal/adiestramiento/0', movil: true },
  { nombre: '04-leccion-3', ruta: '/canal/adiestramiento/3', movil: true },
  { nombre: '05-leccion-7', ruta: '/canal/adiestramiento/7', movil: true },
  { nombre: '06-panel-admin', ruta: '/dashboard/adiestramiento', movil: false },
  // La hoja que Boosty manda a imprimir para que el Gerente de Planta la
  // entregue en mano. Es la misma que ve el trabajador en el teléfono.
  { nombre: '10-certificados', ruta: '/dashboard/adiestramiento/certificados', movil: false },
  // El empujón y la conexión con WhatsApp, que hoy está sin conectar: hay que
  // ver que la página se sostenga apagada, que es como va a estar meses.
  { nombre: '11-empujon', ruta: '/dashboard/adiestramiento/recordatorios', movil: false },
]

await mkdir(SALIDA, { recursive: true })

const navegador = await chromium.launch()
const problemas = []

try {
  const cookies = cookiesDeSesion(verificado.session).map(({ nombre, valor }) => ({
    name: nombre,
    value: valor,
    domain: new URL(BASE).hostname,
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }))

  for (const { nombre, ruta, movil } of PAGINAS) {
    const contexto = await navegador.newContext({
      ...(movil ? devices['iPhone 14'] : { viewport: { width: 1440, height: 1000 } }),
      locale: 'es-VE',
    })
    await contexto.addCookies(cookies)

    const pagina = await contexto.newPage()
    pagina.on('console', (msg) => {
      if (msg.type() === 'error') problemas.push(`[consola] ${nombre}: ${msg.text()}`)
    })

    const respuesta = await pagina.goto(BASE + ruta, { waitUntil: 'networkidle' })
    if (!respuesta?.ok()) problemas.push(`[http ${respuesta?.status()}] ${nombre} · ${ruta}`)

    const destino = new URL(pagina.url()).pathname
    if (destino !== ruta) problemas.push(`[redirigió] ${nombre}: ${ruta} → ${destino}`)

    // Lo que una captura no muestra.
    const medidas = await pagina.evaluate(() => {
      const desborde = document.documentElement.scrollWidth > window.innerWidth + 1
      const chicos = []
      for (const el of document.querySelectorAll('a, button, input, textarea, [role="button"]')) {
        const r = el.getBoundingClientRect()
        // Un control de 1 px no es un objetivo táctil chico: es un control
        // escondido a propósito —el típico `sr-only` del selector de archivo—
        // y quien recibe el toque es la etiqueta que lo envuelve.
        if (r.width <= 1 || r.height <= 1) continue
        if (r.height < 44) {
          chicos.push(`${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 32)}» ${Math.round(r.height)}px`)
        }
      }
      return { desborde, ancho: document.documentElement.scrollWidth, chicos }
    })

    if (medidas.desborde) problemas.push(`[desborda] ${nombre}: ${medidas.ancho}px de ancho`)
    if (movil) {
      for (const chico of medidas.chicos) problemas.push(`[toque <44px] ${nombre}: ${chico}`)
    }

    await pagina.screenshot({ path: join(SALIDA, `${nombre}.png`), fullPage: true })
    console.log(`  ✓ ${nombre}`)
    await contexto.close()
  }

  // --- El flujo: la lección turno a turno -----------------------------------
  // La lección es una conversación: Ajito habla, se toca un botón, sigue. Una
  // captura de la portada no enseña nada de eso, así que aquí se recorre.
  {
    // Se limpia el avance de la lección 3 para que el recorrido salga desde el
    // principio. Solo el de esta sesión y solo el de esa lección.
    if (empleado) {
      const { data: m } = await admin
        .from('matriculas')
        .select('id')
        .eq('curso_id', curso.id)
        .eq('empleado_id', empleado.id)
        .maybeSingle()
      const { data: l } = await admin
        .from('lecciones')
        .select('id')
        .eq('curso_id', curso.id)
        .eq('numero', 3)
        .single()
      if (m) {
        await admin.from('respuestas').delete().eq('matricula_id', m.id).eq('leccion_id', l.id)
        await admin.from('avances').delete().eq('matricula_id', m.id).eq('leccion_id', l.id)
      }
    }

    const contexto = await navegador.newContext({ ...devices['iPhone 14'], locale: 'es-VE' })
    await contexto.addCookies(cookies)
    const pagina = await contexto.newPage()
    pagina.on('console', (msg) => {
      if (msg.type() === 'error') problemas.push(`[consola] flujo: ${msg.text()}`)
    })

    await pagina.goto(BASE + '/canal/adiestramiento/3', { waitUntil: 'networkidle' })

    const empezar = pagina.getByRole('button', { name: /empezar la lecci/i })
    if (await empezar.count()) {
      await empezar.click()
      // `state: 'attached'`: un <audio> sin controles no tiene tamaño, así que
      // esperarlo «visible» —que es lo que hace Playwright por defecto— falla
      // aunque el turno haya abierto perfectamente.
      await pagina
        .waitForSelector('audio', { state: 'attached', timeout: 15000 })
        .catch(() => problemas.push('[flujo] «Empezar» no abrió el primer turno'))
    }

    await pagina.screenshot({ path: join(SALIDA, '07-turno-1.png'), fullPage: true })
    console.log('  ✓ 07-turno-1')

    // Se avanza turno a turno: si toca contestar, se contesta; si toca botón,
    // se toca. Como en la vida.
    const RESPUESTAS = [
      'Aquí estoy en el comedor, con el uniforme puesto.',
      'Este es Pedro, del almacén. Me dio permiso.',
      'Le tomé foto a la salsa de soya que tengo en la cocina.',
      'Los códigos de lote en los frascos, que son chiquitos y hay que revisarlos uno por uno.',
    ]
    let contestadas = 0

    for (let vuelta = 0; vuelta < 14; vuelta++) {
      const turnos = await pagina.locator('section').count()

      // Los ejercicios salen por defecto en voz o en foto. Sin micrófono ni
      // cámara en el navegador de pruebas, se toma la salida escrita — que es
      // justamente la que tiene que estar siempre disponible.
      const prefiero = pagina.getByRole('button', { name: /prefiero (escribirlo|cont[aá]rselo)/i })
      if (await prefiero.count()) await prefiero.last().click()

      const caja = pagina.locator('textarea:visible').last()
      if (await caja.count()) {
        await caja.fill(RESPUESTAS[contestadas % RESPUESTAS.length])
        contestadas++
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
        .waitForFunction((n) => document.querySelectorAll('section').length > n, turnos, {
          timeout: 15000,
        })
        .catch(() => null)

      if (!crecio) break
      if (vuelta === 2) {
        await pagina.screenshot({ path: join(SALIDA, '08-conversacion.png'), fullPage: true })
        console.log('  ✓ 08-conversacion')
      }
    }

    await pagina.screenshot({ path: join(SALIDA, '09-leccion-completa.png'), fullPage: true })
    console.log(`  ✓ 09-leccion-completa (${contestadas} ejercicios contestados)`)

    if (contestadas === 0) problemas.push('[flujo] no se pudo contestar ningún ejercicio')

    await contexto.close()
  }
  // --- La nota de voz, de punta a punta --------------------------------------
  // El navegador de pruebas no tiene micrófono, así que la nota se simula: se
  // sintetiza una frase de planta en el WAV que espera Azure y se manda por la
  // misma ruta que usaría el grabador. Comprueba sesión, permiso, subida al
  // bucket privado y transcripción — que es donde se juega el curso.
  if (process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) {
    const FRASE = 'Lo que más reviso todos los días son los códigos de lote del frasco.'
    const ssml =
      `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-VE'>` +
      `<voice name='es-VE-PaolaNeural'>${FRASE}</voice></speak>`

    const tts = await fetch(
      `https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'riff-16khz-16bit-mono-pcm',
        },
        body: ssml,
      }
    )

    if (!tts.ok) {
      problemas.push(`[voz] no se pudo sintetizar la nota de prueba: ${tts.status}`)
    } else {
      const wav = Buffer.from(await tts.arrayBuffer())
      const cuerpo = new FormData()
      cuerpo.append('audio', new Blob([wav], { type: 'audio/wav' }), 'nota.wav')
      cuerpo.append('clave_paso', 'prueba-voz')

      const galleta = cookies.map((c) => `${c.name}=${c.value}`).join('; ')
      const r = await fetch(BASE + '/canal/adiestramiento/3/adjuntar', {
        method: 'POST',
        headers: { cookie: galleta },
        body: cuerpo,
      })
      const datos = await r.json().catch(() => ({}))

      if (!r.ok || !datos.texto) {
        problemas.push(`[voz] la nota no volvió transcrita: ${r.status} ${JSON.stringify(datos).slice(0, 120)}`)
      } else {
        // Se compara sin tildes ni puntuación: lo que importa es que entendió,
        // no que coincida carácter por carácter.
        const limpiar = (t) =>
          t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim()
        const parecido = limpiar(datos.texto) === limpiar(FRASE)
        console.log(`  ${parecido ? '✓' : '~'} voz · «${datos.texto}»`)
        if (!parecido) problemas.push(`[voz] transcribió distinto: «${datos.texto}»`)
      }

      if (datos.ruta) await admin.storage.from('adiestramiento-respuestas').remove([datos.ruta])
    }
  } else {
    console.log('  · voz · sin clave de Azure, no se probó')
  }

} finally {
  await navegador.close()
  if (matriculaTemporal) {
    await admin.from('matriculas').delete().eq('id', matriculaTemporal)
    console.log('  · matrícula temporal retirada')
  }
}

console.log(`\nCapturas en ${SALIDA}/`)
if (problemas.length === 0) {
  console.log('Sin desbordes, sin objetivos táctiles chicos y sin errores de consola.\n')
} else {
  console.log(`\n${problemas.length} cosas que revisar:`)
  for (const p of problemas) console.log(`  ✖ ${p}`)
  console.log()
}
