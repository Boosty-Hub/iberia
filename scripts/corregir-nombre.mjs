/**
 * Corrige el nombre de una persona en todo el sistema: su ficha, los campos de
 * entrevistador y las atribuciones de la transcripción.
 *
 *   node --env-file=.env.local scripts/corregir-nombre.mjs "Nombre viejo" "Nombre nuevo"
 */

import { createClient } from '@supabase/supabase-js'

const [viejo, nuevo] = process.argv.slice(2)
if (!viejo || !nuevo) {
  console.error('\n✖ Uso: corregir-nombre.mjs "Nombre viejo" "Nombre nuevo"\n')
  process.exit(1)
}
// Iguales, la reatribución de abajo nunca se quedaría sin turnos que renombrar.
if (viejo === nuevo) {
  console.error('\n✖ El nombre nuevo es igual al viejo.\n')
  process.exit(1)
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

// --- Ficha de la persona ------------------------------------------------------
const { data: persona } = await admin
  .from('personas')
  .select('id')
  .ilike('nombre_completo', viejo)
  .maybeSingle()

if (!persona) {
  console.error(`\n✖ No existe la persona "${viejo}".\n`)
  process.exit(1)
}

await admin.from('personas').update({ nombre_completo: nuevo }).eq('id', persona.id)
console.log(`\n  ficha actualizada`)

// --- Campo entrevistador de las sesiones -------------------------------------
const { data: sesiones } = await admin
  .from('entrevistas')
  .select('id, codigo, entrevistador')
  .ilike('entrevistador', `%${viejo}%`)

for (const s of sesiones ?? []) {
  await admin
    .from('entrevistas')
    .update({ entrevistador: s.entrevistador.replaceAll(viejo, nuevo) })
    .eq('id', s.id)
  console.log(`  ${s.codigo}: entrevistador actualizado`)
}

// --- Atribuciones en la transcripción ----------------------------------------
// En tandas hasta que no quede ninguno: Supabase corta cada consulta en 1.000
// filas, y un entrevistador pasa de sobra de ahí —Gabriel lleva más de 5.000
// turnos—. Leerlos de una vez reatribuía los primeros mil y dejaba el resto con
// el nombre viejo, sin avisar. Cada tanda ya renombrada deja de coincidir con
// el filtro, así que la siguiente consulta trae la próxima.
let reatribuidos = 0
for (;;) {
  const { data: turnos, error } = await admin
    .from('transcripcion_segmentos')
    .select('id')
    .eq('hablante', viejo)
    .limit(500)
  if (error) throw new Error(`transcripción: ${error.message}`)
  if (!turnos?.length) break

  const { error: errUpd } = await admin
    .from('transcripcion_segmentos')
    .update({ hablante: nuevo })
    .in('id', turnos.map((t) => t.id))
  if (errUpd) throw new Error(`transcripción: ${errUpd.message}`)
  reatribuidos += turnos.length
}
if (reatribuidos) console.log(`  ${reatribuidos} turnos de transcripción reatribuidos`)

console.log(`\n✔ "${viejo}" → "${nuevo}"\n`)
