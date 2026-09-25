/**
 * Siembra los circuitos del informe en la base, desde el taller.
 *
 *   npm run sembrar:circuitos
 *   npm run sembrar:circuitos -- --revisar    # dice qué haría, sin escribir
 *
 * ⚠️ **El taller manda.** `contenido/circuitos/circuitos.json` es la fuente; las
 * tablas `informe_circuito_puntos`, `informe_modulos` e
 * `informe_circuito_textos` son su reflejo. Cada corrida **pisa**: lo que
 * alguien haya editado a mano en la base se reemplaza, y lo que ya no está en el
 * taller se borra. Un circuito con dos versiones deja de ser un circuito.
 *
 * Existe por la misma razón que `sembrar:procesos`: las vistas interactivas del
 * informe necesitan este contenido al leer, y el taller no está en git porque
 * es material bajo NDA. El porqué completo está en la migración
 * `20260924120000_circuitos_del_informe.sql`.
 *
 * Antes de escribir comprueba que el taller sea coherente: que cada punto que
 * un módulo dice destapar exista, y que no haya números repetidos. Un enlace
 * roto entre circuitos no da error en pantalla: simplemente no lleva a nada.
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const revisar = process.argv.includes('--revisar')
const ARCHIVO = 'contenido/circuitos/circuitos.json'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
})

let taller
try {
  taller = JSON.parse(await readFile(ARCHIVO, 'utf8'))
} catch (e) {
  console.error(`\n✖ No se pudo leer ${ARCHIVO}: ${e.message}\n`)
  process.exit(1)
}

const puntos = taller.puntos ?? []
const modulos = taller.modulos ?? []
const textos = taller.textos ?? {}

// --- Coherencia del taller ---------------------------------------------------
const problemas = []
const ids = new Set(puntos.map((p) => p.id))
if (ids.size !== puntos.length) problemas.push('hay claves de punto repetidas')
for (const c of ['flujo', 'sistemas']) {
  const nums = puntos.filter((p) => p.circuito === c).map((p) => p.numero)
  if (new Set(nums).size !== nums.length) problemas.push(`hay números repetidos en el circuito ${c}`)
}
if (new Set(modulos.map((m) => m.numero)).size !== modulos.length) problemas.push('hay módulos con el mismo número')
for (const m of modulos) {
  for (const d of m.destapa ?? []) if (!ids.has(d)) problemas.push(`el módulo ${m.id} destapa ${d}, que no existe`)
  if (!(m.cubre ?? []).length) problemas.push(`el módulo ${m.id} no cubre nada`)
}
for (const clave of ['flujo', 'sistemas', 'espejo']) if (!textos[clave]) problemas.push(`faltan los textos de «${clave}»`)
// Cada tipo de destape lleva su rótulo en `DESTAPE` de components/circuitos-informe.tsx.
// Uno que no esté ahí sale en la tarjeta como una etiqueta vacía, sin error.
const DESTAPES = ['erp', 'regla', 'captura', 'ia', 'espejo']
for (const p of puntos)
  for (const d of p.destapes ?? [])
    if (!DESTAPES.includes(d.tipo)) problemas.push(`el punto ${p.id} tiene un destape de tipo «${d.tipo}», que no tiene rótulo`)

if (problemas.length) {
  console.error(`\n✖ El taller no es coherente:\n${problemas.map((p) => `   · ${p}`).join('\n')}\n`)
  process.exit(1)
}

const ia = modulos.reduce((t, m) => t + m.cubre.filter((c) => c.ia).length, 0)
const capacidades = modulos.reduce((t, m) => t + m.cubre.length, 0)
console.log(`\n${ARCHIVO} · versión ${taller.version ?? '—'}`)
console.log(`  ${puntos.filter((p) => p.circuito === 'flujo').length} puntos del flujo · ${puntos.filter((p) => p.circuito === 'sistemas').length} de sistemas`)
console.log(`  ${modulos.length} módulos · ${capacidades} capacidades, ${ia} de ellas con IA`)

if (revisar) {
  console.log('\nRevisión: no se escribió nada.\n')
  process.exit(0)
}

// --- Escribir, pisando -------------------------------------------------------
async function volcar(tabla, filas, clave) {
  const { error } = await admin.from(tabla).upsert(filas.map((f) => ({ ...f, updated_at: new Date().toISOString() })), { onConflict: clave })
  if (error) throw new Error(`${tabla}: ${error.message}`)
  const { data: enBase, error: errLeer } = await admin.from(tabla).select(clave)
  if (errLeer) throw new Error(`${tabla}: ${errLeer.message}`)
  const sobran = (enBase ?? []).map((f) => f[clave]).filter((k) => !filas.some((f) => f[clave] === k))
  if (sobran.length) {
    const { error: errBorrar } = await admin.from(tabla).delete().in(clave, sobran)
    if (errBorrar) throw new Error(`${tabla}: ${errBorrar.message}`)
  }
  return sobran
}

try {
  const sinPuntos = await volcar('informe_circuito_puntos', puntos, 'id')
  const sinModulos = await volcar('informe_modulos', modulos, 'id')
  await volcar('informe_circuito_textos', Object.entries(textos).map(([clave, contenido]) => ({ clave, contenido })), 'clave')
  console.log('\n✔ Sembrado.')
  if (sinPuntos.length || sinModulos.length) {
    console.log(`  Borrado lo que ya no está en el taller: ${[...sinPuntos, ...sinModulos].join(', ')}`)
  }
  console.log('')
} catch (e) {
  console.error(`\n✖ ${e.message}\n`)
  process.exit(1)
}
