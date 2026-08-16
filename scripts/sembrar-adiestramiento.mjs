/**
 * Prepara el adiestramiento sobre el padrón que haya en la base.
 *
 *   node --env-file=.env.local scripts/sembrar-adiestramiento.mjs
 *   node --env-file=.env.local scripts/sembrar-adiestramiento.mjs --abrir
 *
 * Hace tres cosas, todas idempotentes:
 *
 *  1. Clasifica a cada empleado en una familia de oficio a partir de su cargo.
 *     Lo que no reconoce queda en `generico`, que no es el descarte: es el
 *     ejercicio general, escrito para funcionar con cualquiera.
 *  2. Matricula a todo el personal de planta y administrativo.
 *  3. Con `--abrir`, abre el curso.
 *
 * Cuando llegue la lista real de cargos de Capital Humano se vuelve a correr:
 * reclasifica y matricula solo a los que falten.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secreto = process.env.SUPABASE_SECRET_KEY
if (!url || !secreto) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY.')
  process.exit(1)
}

const abrir = process.argv.includes('--abrir')
const db = createClient(url, secreto, { auth: { persistSession: false } })

/**
 * Del cargo a la familia. El orden importa: gana la primera que coincida, y
 * por eso la supervisión va de primera —un «supervisor de almacén» es antes
 * supervisor que almacenista para lo que este curso le va a pedir.
 */
const REGLAS = [
  ['supervision', /supervisor|coordinador|jefe|encargad/i],
  // Ojo con «preparador»: el organigrama tiene PREPARADOR DE MEZCLAS Y PRODUCTOS
  // colgando de Jefatura de Producción, y ese es de línea, no de la cocina de
  // pruebas. La cocina es Diseño y Desarrollo: prueba, cata, formula.
  ['cocina', /cocin|prepar.*prueba|desarrollo de producto|formulaci|degustaci|cata/i],
  ['laboratorio', /laboratorio|analista de calidad|inspector|asegurami|microbiol/i],
  ['mantenimiento', /mantenimiento|t[eé]cnic|mec[aá]nic|electric|repuesto/i],
  ['almacen', /almac[eé]n|montacarg|despach|distribuci[oó]n|inventario|dep[oó]sito/i],
  ['limpieza', /limpiez|limpiador|servicios generales|sanitiz|aseo/i],
  ['seguridad', /vigilan|seguridad|prevenci[oó]n|p[eé]rdidas|enfermer|m[eé]dic/i],
  ['linea', /operador|operadora|empacad|embalad|alimentad|envasad|molino|producci[oó]n|m[aá]quina|prepar.*mezcla/i],
  ['oficina', /analista|auxiliar|asistente|secretari|n[oó]mina|recepci|motorizad|contab/i],
]

function familiaDe(cargo) {
  if (!cargo) return 'generico'
  for (const [familia, patron] of REGLAS) {
    if (patron.test(cargo)) return familia
  }
  return 'generico'
}

// --- 1) Clasificar -----------------------------------------------------------

const { data: empleados, error: errEmpleados } = await db
  .from('empleados')
  .select('id, cargo, nivel, familia_oficio')
  .eq('activo', true)

if (errEmpleados) {
  console.error('No se pudo leer el padrón:', errEmpleados.message)
  process.exit(1)
}

const cuenta = {}
let reclasificados = 0

for (const e of empleados) {
  const familia = familiaDe(e.cargo)
  cuenta[familia] = (cuenta[familia] ?? 0) + 1
  if (familia === e.familia_oficio) continue

  const { error } = await db
    .from('empleados')
    .update({ familia_oficio: familia })
    .eq('id', e.id)

  if (error) console.error(`  ✗ ${e.cargo}: ${error.message}`)
  else reclasificados++
}

console.log(`Padrón: ${empleados.length} activos, ${reclasificados} reclasificados.`)
for (const [familia, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${familia}`)
}

// --- 2) Matricular -----------------------------------------------------------

const { data: nuevas, error: errMatricula } = await db.rpc('matricular_pendientes', {
  curso_clave: 'ajito',
})

if (errMatricula) {
  console.error('No se pudo matricular:', errMatricula.message)
  process.exit(1)
}

// La familia de la matrícula se congela al crearla; si alguien se reclasificó
// después, hay que ponerla al día antes de que empiece.
const { data: curso } = await db.from('cursos').select('id').eq('clave', 'ajito').single()
const { data: matriculas } = await db
  .from('matriculas')
  .select('id, empleado_id, estado, familia_oficio')
  .eq('curso_id', curso.id)

const porId = new Map(empleados.map((e) => [e.id, e.familia_oficio]))
let sincronizadas = 0

for (const m of matriculas ?? []) {
  const familia = familiaDe(empleados.find((e) => e.id === m.empleado_id)?.cargo)
  // A quien ya empezó no se le cambian los ejercicios por debajo.
  if (m.estado !== 'pendiente' || m.familia_oficio === familia) continue
  await db.from('matriculas').update({ familia_oficio: familia }).eq('id', m.id)
  sincronizadas++
}

console.log(
  `Matrículas: ${matriculas?.length ?? 0} en total, ${nuevas} nuevas, ${sincronizadas} puestas al día.`
)
void porId

// --- 3) Abrir ----------------------------------------------------------------

if (abrir) {
  const { error } = await db
    .from('cursos')
    .update({ abierto: true, updated_at: new Date().toISOString() })
    .eq('clave', 'ajito')

  if (error) console.error('No se pudo abrir el curso:', error.message)
  else console.log('El curso quedó abierto.')
} else {
  console.log('El curso sigue cerrado. Para abrirlo: --abrir')
}
