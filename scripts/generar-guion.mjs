/**
 * Convierte el guion en datos que la aplicación puede recorrer.
 *
 *   node scripts/generar-guion.mjs
 *
 * Lee `contenido/adiestramiento/leccion-*.md` y escribe `guion.json` al lado.
 * El markdown sigue siendo la única fuente: el JSON es su sombra, y se
 * regenera. Nadie lo edita a mano.
 *
 * Además comprueba que el guion y `lib/adiestramiento.ts` estén de acuerdo:
 * cada 🎯 del guion tiene que tener una clave, y esa clave tiene que existir en
 * el catálogo de ejercicios de esa lección. Si alguien añade un ejercicio en un
 * sitio y se olvida del otro, esto lo caza antes de que llegue a un teléfono.
 *
 * No llama a Azure ni a nadie: es puro texto.
 */

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { leerLeccion } from '../lib/guion.ts'
import { ejerciciosDeLeccion, preguntaDeCampo } from '../lib/adiestramiento.ts'

/** El orden del guion es el orden del curso. Espeja el CHECK de `lecciones.forma`. */
const FORMAS = [
  'bienvenida', 'entiende', 'escucha', 've', 'dibuja',
  'habla', 'cuenta', 'se_equivoca', 'cierre',
]

const GUION = 'contenido/adiestramiento'
const DESTINO = join(GUION, 'guion.json')

const archivos = (await readdir(GUION)).filter((f) => /^leccion-\d+.*\.md$/.test(f)).sort()

const lecciones = []
const problemas = []

for (const archivo of archivos) {
  const leccion = leerLeccion(await readFile(join(GUION, archivo), 'utf8'), archivo)
  lecciones.push(leccion)

  const bloques = leccion.pasos.flatMap((p) => p.bloques)
  const audios = bloques.filter((b) => b.tipo === 'audio')
  const ejercicios = bloques.filter((b) => b.tipo === 'ejercicio')

  // --- El guion contra el catálogo -------------------------------------------
  // La forma sale del orden: la lección N del guion es la lección N del curso.
  const forma = FORMAS[leccion.numero]
  const catalogo = ejerciciosDeLeccion(forma, 'generico').map((e) => e.clave)
  if (preguntaDeCampo(forma, 'generico')) catalogo.push('campo')

  const enGuion = ejercicios.map((e) => e.clave)

  for (const [i, clave] of enGuion.entries()) {
    if (!clave) problemas.push(`${archivo}: el ejercicio ${i + 1} no tiene clave`)
    else if (!catalogo.includes(clave)) {
      problemas.push(`${archivo}: la clave «${clave}» no está en lib/adiestramiento.ts`)
    }
  }
  for (const clave of catalogo) {
    if (!enGuion.includes(clave)) {
      problemas.push(`${archivo}: «${clave}» está en lib/adiestramiento.ts pero no en el guion`)
    }
  }

  const conteo = `${String(leccion.pasos.length).padStart(2)} pasos · ${String(audios.length).padStart(2)} audios · ${ejercicios.length} ejercicios`
  console.log(`  Lección ${leccion.numero} · ${conteo}   ${leccion.titulo}`)
}

await writeFile(
  DESTINO,
  JSON.stringify({ generado: 'scripts/generar-guion.mjs', lecciones }, null, 2) + '\n',
  'utf8'
)

const audios = lecciones.reduce((t, l) => t + l.pasos.flatMap((p) => p.bloques).filter((b) => b.tipo === 'audio').length, 0)
const pasos = lecciones.reduce((t, l) => t + l.pasos.length, 0)

console.log(`\n${lecciones.length} lecciones · ${pasos} pasos · ${audios} audios → ${DESTINO}`)

if (problemas.length) {
  console.log(`\n${problemas.length} desacuerdos entre el guion y el catálogo:`)
  for (const p of problemas) console.log(`  ✖ ${p}`)
  process.exit(1)
}
console.log('El guion y el catálogo están de acuerdo.\n')
