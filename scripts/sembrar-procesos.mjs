/**
 * Siembra el inventario de procesos en la base, desde el taller.
 *
 *   npm run sembrar:procesos
 *   npm run sembrar:procesos -- --revisar    # dice qué haría, sin escribir
 *
 * ⚠️ **El taller manda.** `contenido/informe/inventario-procesos.json` es la
 * fuente; estas tablas son su reflejo, igual que los anexos del informe. Cada
 * corrida **reemplaza** los procesos de cada macroproceso: si alguien los editó
 * a mano en la base, se pierden, y así debe ser — un inventario con dos
 * versiones deja de ser un inventario.
 *
 * Existe porque el mapa interactivo necesita el inventario **en tiempo de
 * lectura**, y el taller no está en git (material bajo NDA): leerlo del disco
 * daría una página que funciona en local y sale vacía al desplegar. El porqué
 * completo está en la migración `20260918120000_mapa_de_procesos.sql`.
 *
 * La idempotencia va por `(nivel, numero)` en los macroprocesos y por
 * `(macroproceso, orden)` en los procesos. ⚠️ Cambiarle el nombre a un
 * macroproceso **no deja una fila huérfana** porque la clave es el par, no el
 * nombre; pero mover uno de nivel sí crea una fila nueva, y por eso el script
 * lista al final lo que está en la base y no en el archivo.
 */

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'

const revisar = process.argv.includes('--revisar')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const ARCHIVO = 'contenido/informe/inventario-procesos.json'

let inventario
try {
  inventario = JSON.parse(await readFile(ARCHIVO, 'utf8'))
} catch (e) {
  console.error(`No se pudo leer ${ARCHIVO}: ${e.message}`)
  process.exit(1)
}

const macros = inventario.macroprocesos ?? []
if (!macros.length) {
  console.error('El inventario no trae macroprocesos.')
  process.exit(1)
}

console.log(`\n${ARCHIVO} · versión ${inventario.version ?? '—'} · ${macros.length} macroprocesos`)

if (revisar) {
  let procesos = 0
  let noSeHace = 0
  for (const m of macros) {
    procesos += m.procesos.length
    noSeHace += m.no_se_hace.length
    console.log(`  ${m.nivel.padEnd(12)} ${String(m.numero).padStart(2)} · ${m.nombre} — ${m.procesos.length} procesos${m.no_se_hace.length ? ` (+${m.no_se_hace.length} que no se hacen)` : ''}`)
  }
  console.log(`\n  ${procesos} procesos vigentes · ${noSeHace} que no se ejecutan o sin evidencia`)
  console.log('  (--revisar: no se escribió nada)')
  process.exit(0)
}

let macrosEscritos = 0
let procesosEscritos = 0
const vistos = new Set()

for (const m of macros) {
  const { data: fila, error } = await admin
    .from('macroprocesos')
    .upsert(
      { nivel: m.nivel, numero: m.numero, nombre: m.nombre, nuevo: !!m.nuevo, updated_at: new Date().toISOString() },
      { onConflict: 'nivel,numero' }
    )
    .select('id')
    .single()

  if (error) {
    console.error(`  ✖ ${m.nivel} ${m.numero} · ${m.nombre}: ${error.message}`)
    continue
  }
  macrosEscritos++
  vistos.add(`${m.nivel}|${m.numero}`)

  // ⚠️ Se borra y se vuelve a escribir en vez de hacer upsert fila por fila.
  // El `orden` es la posición en el inventario: si un proceso se elimina del
  // archivo, los de abajo suben, y un upsert por posición dejaría el último
  // duplicado al final con su nombre viejo.
  await admin.from('procesos').delete().eq('macroproceso_id', fila.id)

  const todos = [
    ...m.procesos.map((p) => ({ ...p, estado: p.estado ?? 'VIGENTE' })),
    ...m.no_se_hace,
  ]

  const filas = todos.map((p, i) => ({
    macroproceso_id: fila.id,
    orden: i + 1,
    nombre: p.nombre,
    estado: p.estado ?? 'VIGENTE',
    area: p.area || null,
    dueno_corregido: !!p.dueno_corregido,
    observacion: p.observacion || null,
  }))

  if (filas.length) {
    const { error: e2 } = await admin.from('procesos').insert(filas)
    if (e2) console.error(`  ✖ procesos de ${m.nombre}: ${e2.message}`)
    else procesosEscritos += filas.length
  }
}

// Lo que quedó en la base y ya no está en el archivo. No se borra solo: se
// avisa, porque borrar un macroproceso se lleva sus procesos por delante.
const { data: enBase } = await admin.from('macroprocesos').select('id, nivel, numero, nombre')
const sobrantes = (enBase ?? []).filter((x) => !vistos.has(`${x.nivel}|${x.numero}`))

console.log(`\n  ${macrosEscritos} macroprocesos · ${procesosEscritos} procesos escritos`)
if (sobrantes.length) {
  console.log('\n  ⚠️ En la base y no en el archivo (no se borraron):')
  for (const s of sobrantes) console.log(`     ${s.nivel} ${s.numero} · ${s.nombre}`)
}

const vigentes = procesosEscritos - macros.reduce((t, m) => t + m.no_se_hace.length, 0)
console.log(`  ${vigentes} vigentes · ${procesosEscritos - vigentes} que no se ejecutan o sin evidencia\n`)
