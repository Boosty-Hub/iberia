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
const { data: turnos } = await admin
  .from('transcripcion_segmentos')
  .select('id')
  .eq('hablante', viejo)

if (turnos?.length) {
  for (let i = 0; i < turnos.length; i += 500) {
    const lote = turnos.slice(i, i + 500).map((t) => t.id)
    await admin.from('transcripcion_segmentos').update({ hablante: nuevo }).in('id', lote)
  }
  console.log(`  ${turnos.length} turnos de transcripción reatribuidos`)
}

console.log(`\n✔ "${viejo}" → "${nuevo}"\n`)
