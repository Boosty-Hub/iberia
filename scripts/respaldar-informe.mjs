/**
 * Respalda a disco el contenido del informe, y lo devuelve si hace falta.
 *
 *   node --env-file=.env.local scripts/respaldar-informe.mjs
 *   node --env-file=.env.local scripts/respaldar-informe.mjs --salida "ruta/carpeta"
 *   node --env-file=.env.local scripts/respaldar-informe.mjs --restaurar "ruta/carpeta"
 *
 * El respaldo se guarda en `Insumos/Respaldo_Informe_<fecha>/` y lleva tres cosas:
 *
 *   informe.json          las filas tal cual están en la base — es lo que restaura
 *   informe-completo.md   las 28 secciones seguidas, para leerlo de corrido
 *   secciones/NN-slug.md  una por sección, con su cabecera
 *   taller/*.json         la prosa de la que salen — **lo único que permite revertir**
 *
 * Restaurar escribe de vuelta `contenido_md` sección por sección, casando por
 * `slug`. No crea secciones que ya no existan: avisa cuáles no pudo devolver.
 *
 * ⚠️ **Restaurar no basta para revertir.** Las secciones se regeneran siempre, así
 * que la próxima corrida del generador pisa lo restaurado. Volver de verdad a una
 * versión anterior son tres pasos: copiar `taller/` de vuelta a
 * `contenido/informe/`, `git checkout` del generador, y regenerar.
 *
 * Material de Iberia bajo NDA: la carpeta de salida no va a ningún repositorio.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, readFile, cp, readdir } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const hoy = new Date().toISOString().slice(0, 10)

// --- Restaurar ---------------------------------------------------------------
if (args.restaurar) {
  const crudo = JSON.parse(await readFile(join(args.restaurar, 'informe.json'), 'utf8'))
  const secciones = crudo.secciones ?? crudo
  let devueltas = 0
  const perdidas = []

  for (const s of secciones) {
    const { error, data } = await admin
      .from('informe_secciones')
      .update({ contenido_md: s.contenido_md })
      .eq('slug', s.slug)
      .select('slug')

    if (error) {
      console.error(`  ✖ ${s.slug}: ${error.message}`)
      perdidas.push(s.slug)
    } else if (!data?.length) {
      perdidas.push(s.slug)
    } else {
      devueltas++
    }
  }

  console.log(`\nDevueltas ${devueltas} de ${secciones.length} secciones.`)
  if (perdidas.length) {
    console.log('No existen hoy en el informe (no se crearon):')
    for (const p of perdidas) console.log(`  · ${p}`)
  }
  process.exit(0)
}

// --- Respaldar ---------------------------------------------------------------
const SALIDA = args.salida ?? join('Insumos', `Respaldo_Informe_${hoy}`)

const { data: secciones, error } = await admin
  .from('informe_secciones')
  .select('*')
  .order('orden')

if (error) {
  console.error('No se pudo leer el informe:', error.message)
  process.exit(1)
}

await mkdir(join(SALIDA, 'secciones'), { recursive: true })

const conTexto = secciones.filter((s) => (s.contenido_md ?? '').trim().length > 0)
const caracteres = secciones.reduce((t, s) => t + (s.contenido_md ?? '').length, 0)

await writeFile(
  join(SALIDA, 'informe.json'),
  JSON.stringify(
    {
      respaldado_en: new Date().toISOString(),
      proyecto: process.env.NEXT_PUBLIC_SUPABASE_URL,
      total_secciones: secciones.length,
      secciones_con_texto: conTexto.length,
      caracteres: caracteres,
      secciones,
    },
    null,
    2
  ),
  'utf8'
)

const partes = []
partes.push('# Informe · respaldo del contenido escrito')
partes.push('')
partes.push(`Volcado el ${hoy} desde \`informe_secciones\`.`)
partes.push(
  `${secciones.length} secciones · ${conTexto.length} con texto · ${caracteres.toLocaleString('es-VE')} caracteres.`
)
partes.push('')
partes.push('---')

let parteActual = ''
for (const s of secciones) {
  const relleno = String(s.orden).padStart(3, '0')
  const nombre = `${relleno}-${s.slug}.md`

  const cabecera = [
    '---',
    `numero: ${s.numero ?? ''}`,
    `titulo: ${s.titulo}`,
    `subtitulo: ${s.subtitulo ?? ''}`,
    `slug: ${s.slug}`,
    `parte: ${s.parte}`,
    `orden: ${s.orden}`,
    `publicado: ${s.publicado}`,
    `actualizado: ${s.updated_at}`,
    '---',
    '',
  ].join('\n')

  await writeFile(join(SALIDA, 'secciones', nombre), cabecera + (s.contenido_md ?? ''), 'utf8')

  if (s.parte !== parteActual) {
    parteActual = s.parte
    partes.push('')
    partes.push(`## PARTE · ${s.parte.toUpperCase()}`)
  }
  partes.push('')
  partes.push(`### ${s.numero ? s.numero + ' · ' : ''}${s.titulo}`)
  if (s.subtitulo) partes.push(`*${s.subtitulo}*`)
  partes.push(`\`/informe#${s.slug}\``)
  partes.push('')
  partes.push((s.contenido_md ?? '').trim() || '_(sin contenido)_')
  partes.push('')
  partes.push('---')
}

await writeFile(join(SALIDA, 'informe-completo.md'), partes.join('\n'), 'utf8')

// --- El taller ---------------------------------------------------------------
//
// ⚠️ **Sin esto el respaldo no sirve para revertir, solo para leer.** Las quince
// secciones están en `GENERADAS`, o sea que **se regeneran siempre**: devolver
// `contenido_md` a la base recupera el texto hasta la próxima corrida, que lo
// vuelve a pisar con lo que digan los talleres.
//
// Y los talleres **no están en git** —llevan material bajo NDA y `contenido/*`
// está ignorado—, así que esta copia es su único historial. Sin ella, deshacer
// una reescritura de prosa significa volver a escribirla a mano.
//
// El generador sí está versionado, de modo que la reversión completa es:
// restaurar esta carpeta, `git checkout` del script y volver a generar.
const TALLER = join('contenido', 'informe')
let archivosTaller = 0
try {
  archivosTaller = (await readdir(TALLER)).filter((f) => f.endsWith('.json')).length
  await cp(TALLER, join(SALIDA, 'taller'), { recursive: true })
} catch (e) {
  console.warn(
    `\n  ⚠️ No se pudo copiar el taller (${e.message}). El respaldo sirve para leer, no para revertir.`
  )
}

// --- Los circuitos -------------------------------------------------------------
//
// Los dibujos de «Los circuitos del negocio» y de «La arquitectura de IA» no
// viven en `informe_secciones`: tienen sus tres tablas, sembradas desde
// `contenido/circuitos/circuitos.json`. Van las filas y el taller, por lo mismo
// que arriba: el taller no está en git y esta copia es su único historial.
let circuitos = 'no'
try {
  const volcado = {}
  for (const tabla of ['informe_circuito_puntos', 'informe_modulos', 'informe_circuito_textos', 'informe_hallazgos']) {
    const { data, error: e } = await admin.from(tabla).select('*')
    if (e) throw new Error(`${tabla}: ${e.message}`)
    volcado[tabla] = data
  }
  await writeFile(join(SALIDA, 'circuitos.json'), JSON.stringify(volcado, null, 2), 'utf8')
  await cp(join('contenido', 'circuitos'), join(SALIDA, 'taller-circuitos'), { recursive: true })
  circuitos = `${volcado.informe_circuito_puntos.length} puntos · ${volcado.informe_modulos.length} módulos`
} catch (e) {
  console.warn('  ⚠️ No se pudieron respaldar los circuitos: ' + e.message.slice(0, 120))
}

// --- El expediente de trazabilidad ------------------------------------------
//
// ⚠️ **Desde que el informe va sin citas, sin códigos y sin nombres, el
// expediente es el único puente entre lo que el documento afirma y la sesión
// donde se dijo.** El informe se puede regenerar del taller; el expediente sale
// de `hallazgos` y `entrevistas`, que esta copia no guardaba. Va dentro, y por
// eso va en el script: un respaldo que hay que acordarse de completar a mano no
// es un respaldo.
let expediente = 'no'
try {
  execFileSync(
    process.execPath,
    ['--env-file=.env.local', 'scripts/expediente-trazabilidad.mjs', '--salida', join(SALIDA, 'expediente')],
    { stdio: 'pipe' }
  )
  expediente = 'sí'
} catch (e) {
  console.warn('  ⚠️ No se pudo generar el expediente: ' + e.message.slice(0, 120))
}

console.log(`\nRespaldo en ${SALIDA}`)
console.log(`  ${secciones.length} secciones · ${conTexto.length} con texto · ${caracteres.toLocaleString('es-VE')} caracteres`)
console.log(`  informe.json · informe-completo.md · secciones/ · taller/ (${archivosTaller} json) · expediente/ (${expediente})`)
console.log(`  circuitos.json · taller-circuitos/ (${circuitos})`)
console.log('\nSecciones con texto:')
for (const s of conTexto) {
  console.log(`  ${String(s.numero ?? '').padStart(2)} · ${String(s.contenido_md.length).padStart(6)}c · ${s.titulo}`)
}
console.log(`\nPara devolverlo:\n  npm run respaldar:informe -- --restaurar "${SALIDA}"`)
