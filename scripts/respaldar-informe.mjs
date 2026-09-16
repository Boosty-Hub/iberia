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
 *
 * Restaurar escribe de vuelta `contenido_md` sección por sección, casando por
 * `slug`. No crea secciones que ya no existan: avisa cuáles no pudo devolver.
 *
 * Material de Iberia bajo NDA: la carpeta de salida no va a ningún repositorio.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
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

console.log(`\nRespaldo en ${SALIDA}`)
console.log(`  ${secciones.length} secciones · ${conTexto.length} con texto · ${caracteres.toLocaleString('es-VE')} caracteres`)
console.log('  informe.json · informe-completo.md · secciones/')
console.log('\nSecciones con texto:')
for (const s of conTexto) {
  console.log(`  ${String(s.numero ?? '').padStart(2)} · ${String(s.contenido_md.length).padStart(6)}c · ${s.titulo}`)
}
console.log(`\nPara devolverlo:\n  npm run respaldar:informe -- --restaurar "${SALIDA}"`)
