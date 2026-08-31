/**
 * Carga hallazgos propuestos desde los archivos de `contenido/hallazgos/`.
 *
 *   npm run cargar:hallazgos
 *   npm run cargar:hallazgos -- --revisar          # dice qué cargaría, sin escribir
 *   npm run cargar:hallazgos -- --archivo tanda-1.json
 *
 * Los hallazgos entran **siempre en estado `propuesto`**, que es lo que el
 * esquema ya prevé. Un hallazgo propuesto no es un hallazgo: es un candidato con
 * su cita al lado, para que alguien que estuvo en la entrevista lo valide o lo
 * descarte desde `/dashboard/hallazgos`. Nada de esto entra al informe sin pasar
 * por esa mano.
 *
 * El área no se pide en el archivo: se hereda de la entrevista, que ya la tiene
 * bien puesta. Un hallazgo de la entrevista de Compras es de Compras.
 *
 * Idempotente por la pareja (entrevista, título): volver a correrlo actualiza,
 * no duplica. Y **nunca pisa el estado**: si alguien ya validó o descartó un
 * hallazgo, una recarga no lo devuelve a propuesto.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const CARPETA = 'contenido/hallazgos'

const TIPOS = [
  'cuello_botella',
  'trabajo_manual',
  'dato_disponible',
  'oportunidad_ia',
  'riesgo',
  'sistema',
  'supuesto',
]
const NIVELES = ['alto', 'medio', 'bajo']

const args = process.argv.slice(2)
const revisar = args.includes('--revisar')
const soloArchivo = args.includes('--archivo') ? args[args.indexOf('--archivo') + 1] : null

if (!existsSync(CARPETA)) {
  console.error(`\n✖ No existe ${CARPETA}\n`)
  process.exit(1)
}

const archivos = (soloArchivo ? [soloArchivo] : readdirSync(CARPETA))
  .filter((f) => f.endsWith('.json'))
  // Los que llevan «en-espera» están retenidos a propósito y no se cargan.
  .filter((f) => !f.includes('en-espera'))
  .sort()

if (!archivos.length) {
  console.error(`\n✖ No hay archivos que cargar en ${CARPETA}\n`)
  process.exit(1)
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const { data: entrevistas, error: errEnt } = await admin
  .from('entrevistas')
  .select('id, codigo, area_id, entrevistado_nombre')
if (errEnt) {
  console.error(`\n✖ ${errEnt.message}\n`)
  process.exit(1)
}
const porCodigo = new Map(entrevistas.map((e) => [e.codigo, e]))

let nuevos = 0
let actualizados = 0
const porTipo = {}
const rechazados = []

for (const archivo of archivos) {
  const crudo = JSON.parse(readFileSync(resolve(CARPETA, archivo), 'utf8'))
  const lista = Array.isArray(crudo) ? crudo : [crudo]
  console.log(`\n── ${archivo} · ${lista.length}`)

  for (const h of lista) {
    const entrevista = porCodigo.get(h.entrevista)
    if (!entrevista) {
      rechazados.push(`${archivo}: entrevista desconocida «${h.entrevista}»`)
      continue
    }
    if (!TIPOS.includes(h.tipo)) {
      rechazados.push(`${h.entrevista}: tipo inválido «${h.tipo}» en «${h.titulo}»`)
      continue
    }
    if (!h.titulo?.trim()) {
      rechazados.push(`${h.entrevista}: hallazgo sin título`)
      continue
    }

    porTipo[h.tipo] = (porTipo[h.tipo] ?? 0) + 1
    if (revisar) continue

    const fila = {
      entrevista_id: entrevista.id,
      // El área se hereda de la entrevista: no se pide dos veces el mismo dato.
      area_id: entrevista.area_id,
      tipo: h.tipo,
      titulo: h.titulo.trim().slice(0, 200),
      descripcion: h.descripcion?.trim() ?? null,
      cita_textual: h.cita_textual?.trim() ?? null,
      impacto: NIVELES.includes(h.impacto) ? h.impacto : null,
      esfuerzo: NIVELES.includes(h.esfuerzo) ? h.esfuerzo : null,
    }

    const { data: existente } = await admin
      .from('hallazgos')
      .select('id')
      .eq('entrevista_id', entrevista.id)
      .eq('titulo', fila.titulo)
      .maybeSingle()

    if (existente) {
      // Sin `estado`: si alguien ya lo validó o lo descartó, eso manda.
      const { error } = await admin.from('hallazgos').update(fila).eq('id', existente.id)
      if (error) {
        rechazados.push(`${h.entrevista}: ${error.message}`)
        continue
      }
      actualizados++
    } else {
      const { error } = await admin.from('hallazgos').insert({ ...fila, estado: 'propuesto' })
      if (error) {
        rechazados.push(`${h.entrevista}: ${error.message}`)
        continue
      }
      nuevos++
    }
  }
}

console.log('\n── Por tipo')
for (const t of TIPOS) {
  if (porTipo[t]) console.log(`  ${t.padEnd(16)} ${String(porTipo[t]).padStart(3)}`)
}

console.log(
  revisar
    ? `\nRevisión: ${Object.values(porTipo).reduce((a, b) => a + b, 0)} hallazgos, nada escrito.\n`
    : `\n${nuevos} nuevos · ${actualizados} actualizados.\n`
)

if (rechazados.length) {
  console.log('⚠️  No entraron:')
  for (const r of rechazados) console.log(`     · ${r}`)
  console.log('')
}

const enEspera = readdirSync(CARPETA).filter((f) => f.includes('en-espera'))
if (enEspera.length) {
  console.log('⏸  Retenidos a propósito, no se cargaron:')
  for (const f of enEspera) {
    const n = JSON.parse(readFileSync(resolve(CARPETA, f), 'utf8')).length
    console.log(`     · ${f}  (${n})`)
  }
  console.log('')
}

console.log('Todos entran como «propuesto». Se validan en /dashboard/hallazgos.\n')
