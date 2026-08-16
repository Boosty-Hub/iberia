/**
 * Qué contesta Ajito de verdad.
 *
 *   node --env-file=.env.local scripts/probar-ajito.mjs
 *   node --env-file=.env.local scripts/probar-ajito.mjs --caso pillame
 *
 * Que la devolución compile y devuelva 200 no dice nada: lo que hay que saber
 * es si Ajito le habla a una operadora de envasado como Ajito, o como un
 * asistente genérico traducido del inglés. Eso solo se sabe leyéndolo.
 *
 * Así que esto **crea un trabajador de prueba por caso, le mete una respuesta
 * realista y pide la devolución por el mismo camino que la pediría el
 * teléfono**. Después imprime lo que contestó —para leerlo— y le pasa por
 * encima las reglas del guion que se pueden comprobar a máquina:
 *
 *   · el largo, que es lo que decide si el audio dura veinte segundos o uno
 *   · el vocabulario prohibido: automatización, optimizar, monitorear, inglés
 *   · que no se ponga género a sí mismo
 *   · que no salga marcado de Markdown, que después se lee en voz alta
 *   · y lo propio de cada caso: en la lección 7 tiene que decir que no sabe, y
 *     en la 6 no puede opinar de la plata de nadie
 *
 * Las reglas cazan la regresión; leer las devoluciones es la verificación.
 *
 * Necesita el servidor de desarrollo levantado y ANTHROPIC_API_KEY.
 */

import { createClient } from '@supabase/supabase-js'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3000'
const SOLO = args.caso ?? null

const URL_SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL
const CLAVE_PUB = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const SECRETO = process.env.SUPABASE_SECRET_KEY
if (!URL_SUPA || !CLAVE_PUB || !SECRETO) {
  console.error('\n✖ Faltan las variables de Supabase en .env.local\n')
  process.exit(1)
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('\n✖ Falta ANTHROPIC_API_KEY en .env.local\n')
  process.exit(1)
}

const admin = createClient(URL_SUPA, SECRETO, { auth: { persistSession: false } })

const PREFIJO = 'prueba-ajito-'
const CEDULA = 'PRUEBA-AJITO-'

/**
 * Los casos. No son ejemplos bonitos: están escritos como contestaría alguien
 * en el comedor con el teléfono en una mano — sin tildes, con la frase cortada,
 * o de corrido y sin ordenar, que es justo lo que la lección 2 le pide.
 */
const CASOS = [
  {
    caso: 'apodo',
    leccion: 0,
    clave: 'apodo',
    familia: 'linea',
    nombre: 'Yorgelis Pérez',
    cargo: 'Operadora de Envasado',
    entrada: 'texto',
    respuesta: 'Yorge, asi me dicen todos aqui',
  },
  {
    caso: 'pregunta-corta',
    leccion: 1,
    clave: 'pregunta-corta',
    familia: 'linea',
    nombre: 'Yorgelis Pérez',
    cargo: 'Operadora de Envasado',
    entrada: 'texto',
    respuesta: 'como quito una mancha de aceite',
  },
  {
    caso: 'proceso',
    leccion: 2,
    clave: 'proceso',
    familia: 'cocina',
    nombre: 'Nancy Ruiz',
    cargo: 'Preparadora de Pruebas',
    entrada: 'voz',
    respuesta:
      'Bueno yo saco los ingredientes, aunque antes reviso la formula que me deja Delina en el cuaderno, ' +
      'entonces peso todo en la balanza chiquita porque la grande no agarra los gramos, ah y me lavo las ' +
      'manos y me pongo el gorro antes de eso obvio, y ya despues voy mezclando de a poquito y voy probando, ' +
      'si le falta sal le echo, y al final lo dejo tapado y anoto la hora.',
  },
  {
    caso: 'numeros',
    leccion: 6,
    clave: 'numeros-oficio',
    familia: 'linea',
    nombre: 'Yorgelis Pérez',
    cargo: 'Operadora de Envasado',
    entrada: 'voz',
    respuesta: 'La primera hora 180 cajas, después 210, luego 195, después 240 y la última 175',
    // Los números están puestos para que se pueda comprobar la cuenta a mano:
    // suman 1000 y el promedio es exactamente 200.
    debeTener: [/1\.?000|mil/i, /200|doscientos/i],
  },
  {
    caso: 'plata',
    leccion: 6,
    clave: 'cuenta-propia',
    familia: 'almacen',
    nombre: 'Wilmer Godoy',
    cargo: 'Montacarguista',
    entrada: 'texto',
    respuesta: 'gasto 40 bolivares diarios en pasaje y trabajo 24 dias al mes',
    // La cuenta tiene que salir; la opinión no puede salir.
    debeTener: [/960|novecientos sesenta/i],
    noPuedeTener:
      /\b(es mucho|es much[íi]simo|es poco|deber[íi]as|te conviene|te recomiendo|ahorrar|ahorro|vale la pena|considera)\b/i,
  },
  {
    caso: 'pillame',
    leccion: 7,
    clave: 'pillame',
    familia: 'almacen',
    nombre: 'Wilmer Godoy',
    cargo: 'Montacarguista',
    entrada: 'texto',
    respuesta: 'que hay en el rack 16 ahorita',
    // El ejercicio donde acertar sería el fracaso.
    debeTener: [/\bno\s+(lo\s+)?s[ée]\b|no tengo (c[óo]mo|forma|manera|acceso)|no puedo saber/i],
    noPuedeTener: /\b(probablemente|seguramente|suele haber|deber[íi]a haber|imagino que hay)\b/i,
  },
  {
    caso: 'campo',
    leccion: 7,
    clave: 'campo',
    esCampo: true,
    familia: 'mantenimiento',
    nombre: 'Argenis Mora',
    cargo: 'Técnico de Mantenimiento',
    entrada: 'voz',
    respuesta:
      'Mira, la envasadora dos cuando va a fallar suena distinto, hace como un chillido bajito antes de ' +
      'trancarse. Eso no está en ningún manual, eso lo aprendí yo aquí. Cuando la oigo así la paro y le ' +
      'reviso la banda, y casi siempre es eso.',
  },
  {
    caso: 'critica',
    leccion: 8,
    clave: 'como-te-fue-el-curso',
    familia: 'seguridad',
    nombre: 'Douglas Rangel',
    cargo: 'Vigilante',
    entrada: 'voz',
    respuesta:
      'La verdad muy largo, y algunas cosas no tienen nada que ver con lo que yo hago en la garita. ' +
      'Lo de los números no me sirvió de nada.',
    // No se defiende ni se justifica.
    noPuedeTener: /\b(pero |sin embargo|en realidad|lo que pasa es que|disculpa|perd[óo]n|lo siento)\b/i,
  },
]

/**
 * Qué hacer con cada motivo. La diferencia entre estos se paga en horas: uno se
 * arregla en la consola de facturación y otro manda a alguien a leer código.
 */
const QUE_HACER = {
  'sin-configurar': 'falta ANTHROPIC_API_KEY en .env.local',
  'sin-saldo': 'la clave sirve, pero la cuenta no tiene crédito · consola de Anthropic → Plans & Billing',
  'sin-permiso': 'la clave no vale, caducó, o no alcanza para este modelo',
  ocupado: 'el servicio está saturado o no hay red · se reintenta y ya',
  fallo: 'falló de verdad — hay que leer el detalle',
}

// --- las reglas que aplican a todas -------------------------------------------

const PROHIBIDAS =
  /\b(automatizaci[óo]n|automatizar|automatiza|robots?|sustituir|reemplazar|monitorear|monitoreo|optimizar|optimizaci[óo]n|eficiencia)\b/i
const INGLES =
  /\b(prompt|chatbot|feedback|input|output|skill|check|ok(ay)?|tips?|coach|update|software|hardware)\b/i
const GENERO = /\b(estoy list[oa]|encantad[oa]|estoy cansad[oa]|me cans[éo]|estoy segur[oa] de m[íi])\b/i
const MARCADO = /(\*\*|^#{1,6}\s|^\s*[-•]\s|^\s*\d+\.\s)/m
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u

function revisar(caso, texto) {
  const fallos = []
  const palabras = texto.trim().split(/\s+/).length

  if (palabras < 25) fallos.push(`muy corta: ${palabras} palabras`)
  if (palabras > 95) fallos.push(`muy larga: ${palabras} palabras (unos ${Math.round((palabras / 192) * 60)} s)`)

  const prohibida = texto.match(PROHIBIDAS)
  if (prohibida) fallos.push(`palabra prohibida: «${prohibida[0]}»`)

  const ingles = texto.match(INGLES)
  if (ingles) fallos.push(`inglés: «${ingles[0]}»`)

  const genero = texto.match(GENERO)
  if (genero) fallos.push(`se pone género: «${genero[0]}»`)

  if (MARCADO.test(texto)) fallos.push('trae marcado de Markdown; esto se lee en voz alta')
  if (EMOJI.test(texto)) fallos.push('trae emoji')
  if (/^(aqu[íi] (está|va)|gracias por)/i.test(texto.trim())) fallos.push('arranca con preámbulo')

  for (const debe of caso.debeTener ?? []) {
    if (!debe.test(texto)) fallos.push(`le falta lo que tenía que decir: ${debe}`)
  }
  if (caso.noPuedeTener) {
    const mal = texto.match(caso.noPuedeTener)
    if (mal) fallos.push(`dice lo que no podía decir: «${mal[0]}»`)
  }

  return { fallos, palabras }
}

// -----------------------------------------------------------------------------

async function limpiar() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const usuarios = (data?.users ?? []).filter((u) => (u.email ?? '').startsWith(PREFIJO))

  const { data: fichas } = await admin.from('empleados').select('id').like('cedula', `${CEDULA}%`)
  for (const ficha of fichas ?? []) await admin.from('empleados').delete().eq('id', ficha.id)
  for (const usuario of usuarios) await admin.auth.admin.deleteUser(usuario.id)
}

function cabeceraCookie(sesion) {
  const ref = new URL(URL_SUPA).hostname.split('.')[0]
  const nombre = `sb-${ref}-auth-token`
  const valor = 'base64-' + Buffer.from(JSON.stringify(sesion)).toString('base64url')
  const LIMITE = 3180

  if (valor.length <= LIMITE) return `${nombre}=${valor}`
  const trozos = []
  for (let i = 0; i < valor.length; i += LIMITE) {
    trozos.push(`${nombre}.${trozos.length}=${valor.slice(i, i + LIMITE)}`)
  }
  return trozos.join('; ')
}

// -----------------------------------------------------------------------------

await limpiar()

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
  .select('id, numero, titulo')
  .eq('curso_id', curso.id)

const porNumero = new Map(lecciones.map((l) => [l.numero, l]))

const { data: area } = await admin
  .from('areas')
  .select('id')
  .eq('slug', 'j-produccion')
  .maybeSingle()

const pendientes = SOLO ? CASOS.filter((c) => c.caso === SOLO) : CASOS
if (!pendientes.length) {
  console.error(`\n✖ No hay ningún caso llamado «${SOLO}».\n`)
  process.exit(1)
}

console.log(`\nAjito contestando · ${pendientes.length} casos\n`)

const problemas = []
let contestadas = 0

try {
  for (const caso of pendientes) {
    const leccion = porNumero.get(caso.leccion)
    const correo = `${PREFIJO}${caso.caso}@iberia.invalid`

    const { data: creado, error: errAuth } = await admin.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: { nombre_completo: caso.nombre, organizacion: 'iberia', rol: 'lector' },
    })
    if (errAuth) {
      problemas.push(`${caso.caso}: no se pudo crear el usuario · ${errAuth.message}`)
      continue
    }

    const { data: ficha, error: errFicha } = await admin
      .from('empleados')
      .insert({
        cedula: `${CEDULA}${caso.caso}`,
        nombre_completo: caso.nombre,
        cargo: caso.cargo,
        area_id: area?.id ?? null,
        nivel: 'planta',
        tipo_nomina: 'diaria',
        sede: 'cagua',
        familia_oficio: caso.familia,
        perfil_id: creado.user.id,
      })
      .select('id')
      .single()
    if (errFicha) {
      problemas.push(`${caso.caso}: no se pudo crear la ficha · ${errFicha.message}`)
      continue
    }

    const { data: matricula } = await admin
      .from('matriculas')
      .insert({
        curso_id: curso.id,
        empleado_id: ficha.id,
        familia_oficio: caso.familia,
        nombre_corto: caso.nombre.split(' ')[0],
      })
      .select('id')
      .single()

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
      problemas.push(`${caso.caso}: no se pudo abrir sesión · ${errSesion.message}`)
      continue
    }

    // La respuesta se inserta con la sesión de la persona, no con la clave de
    // servicio: si una política de RLS se rompiera, esto tiene que fallar aquí
    // igual que le fallaría a ella.
    const suyo = createClient(URL_SUPA, CLAVE_PUB, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sesion.session.access_token}` } },
    })

    const { error: errResp } = await suyo.from('respuestas').insert({
      matricula_id: matricula.id,
      leccion_id: leccion.id,
      clave_paso: caso.clave,
      es_pregunta_campo: Boolean(caso.esCampo),
      entrada: caso.entrada,
      texto: caso.respuesta,
      familia_oficio: caso.familia,
      area_id: area?.id ?? null,
    })
    if (errResp) {
      problemas.push(`${caso.caso}: no se pudo guardar la respuesta · ${errResp.message}`)
      continue
    }

    const arranque = Date.now()
    const peticion = await fetch(`${BASE}/canal/adiestramiento/${caso.leccion}/devolver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cabeceraCookie(sesion.session),
      },
      body: JSON.stringify({ clave_paso: caso.clave }),
    })
    const tardanza = ((Date.now() - arranque) / 1000).toFixed(1)

    if (!peticion.ok) {
      const cuerpo = await peticion.json().catch(() => ({}))
      const motivo = cuerpo.motivo ?? String(peticion.status)
      problemas.push(`${caso.caso}: ${motivo}${cuerpo.detalle ? ` · ${cuerpo.detalle}` : ''}`)
      console.log(`✖ ${caso.caso.padEnd(16)} ${QUE_HACER[motivo] ?? motivo}`)
      if (cuerpo.detalle) console.log(`  ${cuerpo.detalle.slice(0, 160)}`)
      console.log('')
      // Si el problema no es de esta respuesta sino del servicio, las siete que
      // vienen detrás van a fallar igual. Se para aquí en vez de gastar siete
      // vueltas más para llegar a la misma conclusión.
      if (motivo !== 'fallo') {
        console.log('  Le va a pasar lo mismo a las demás. Se para aquí.\n')
        break
      }
      continue
    }

    const { texto, audio } = await peticion.json()
    const { fallos, palabras } = revisar(caso, texto)
    contestadas++

    const marca = fallos.length ? '✖' : '·'
    console.log(
      `${marca} ${caso.caso.padEnd(16)} lección ${caso.leccion} · ${caso.familia.padEnd(14)}` +
        ` ${String(palabras).padStart(3)} palabras · ~${Math.round((palabras / 192) * 60)} s` +
        ` · ${tardanza} s en llegar${audio ? '' : ' · SIN AUDIO'}`
    )
    console.log(`  «${caso.respuesta.slice(0, 96)}${caso.respuesta.length > 96 ? '…' : ''}»`)
    console.log(
      texto
        .split('\n')
        .map((l) => `  ▸ ${l}`)
        .join('\n')
    )
    for (const fallo of fallos) {
      console.log(`  ✖ ${fallo}`)
      problemas.push(`${caso.caso}: ${fallo}`)
    }
    if (!audio) problemas.push(`${caso.caso}: no se generó el audio`)
    console.log('')
  }
} finally {
  await limpiar()
}

console.log(`${contestadas}/${pendientes.length} contestadas`)

if (problemas.length) {
  console.log(`\n✖ ${problemas.length} problema${problemas.length > 1 ? 's' : ''}:`)
  for (const p of problemas) console.log(`  · ${p}`)
  console.log('')
  process.exit(1)
}

console.log('\n✓ Todas dentro de las reglas. Ahora hay que leerlas.\n')
