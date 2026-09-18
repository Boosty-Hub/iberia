/**
 * El expediente de trazabilidad del informe — **solo para el equipo consultor**.
 *
 *   npm run expediente
 *   npm run expediente -- --salida "ruta/carpeta"
 *
 * Existe porque el 18 de septiembre de 2026 se decidió —con Gabriel— que el
 * informe va **sin citas textuales, sin códigos de sesión y sin nombres**: se
 * sostiene en la autoría del equipo consultor y no en un aparato de
 * referencias. Esa decisión quita del documento lo que permitía defenderlo
 * delante del comité, y esto es donde vuelve a estar.
 *
 * ⚠️ **Este archivo pasa a ser el único puente entre el informe y su
 * evidencia.** Sale a `Insumos/`, que está fuera de git —material bajo NDA— y
 * dentro del respaldo. No se comparte con el cliente: es la carpeta de la que
 * el consultor echa mano cuando alguien pregunta «¿y eso quién lo dijo?».
 *
 * ⚠️ **`ENT-005` no entra.** Se grabó sin que la persona lo supiera y pidió que
 * se borrara. No citarla incluye no guardarla acá.
 *
 * Deja tres piezas:
 *
 *   hallazgos.md    los hallazgos, con área, sesión, quién, cargo y la cita literal
 *   sesiones.md     el cuadro de sesiones: código, fecha, quién, cargo, área, sede
 *   expediente.json lo mismo en crudo, por si hay que cruzarlo con otra cosa
 */

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
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

/** La misma guarda que el generador del informe. */
const SIN_CONSENTIMIENTO = new Set(['ENT-005'])

const hoy = new Date().toISOString().slice(0, 10)
const SALIDA = args.salida ?? join('Insumos', `Expediente_Trazabilidad_${hoy}`)

const SEDES = { caracas: 'Caracas', cagua: 'Planta Cagua', remoto: 'Remoto' }

function fecha(iso) {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`
}

/** Una celda de tabla no puede llevar barras ni saltos: los rompe. */
function celda(t) {
  return (t ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim() || '—'
}

const { data: sesiones, error: e1 } = await admin
  .from('entrevistas')
  .select('codigo, tipo, titulo, entrevistado_nombre, entrevistado_cargo, sede, fecha_entrevista, areas(nombre)')
  .order('codigo')

const { data: hallazgos, error: e2 } = await admin
  .from('hallazgos')
  .select('titulo, tipo, estado, impacto, descripcion, cita_textual, areas(nombre), entrevistas(codigo, entrevistado_nombre, entrevistado_cargo, fecha_entrevista)')
  .order('titulo')

if (e1 || e2) {
  console.error('No se pudo leer:', (e1 ?? e2).message)
  process.exit(1)
}

const vivas = (sesiones ?? []).filter((s) => !SIN_CONSENTIMIENTO.has(s.codigo))
const vivos = (hallazgos ?? []).filter((h) => !SIN_CONSENTIMIENTO.has(h.entrevistas?.codigo))
const retenidos = (hallazgos ?? []).length - vivos.length

await mkdir(SALIDA, { recursive: true })

// --- La cabecera, que es media utilidad del archivo --------------------------
const AVISO = [
  '> ⚠️ **Material bajo NDA. Uso interno del equipo consultor de Boosty.**',
  '>',
  '> El informe que se entrega a Iberia **no lleva citas, ni códigos de sesión, ni nombres**:',
  '> se sostiene en la autoría del equipo consultor. Este expediente es su respaldo — de dónde',
  '> salió cada afirmación, por si hay que defenderla. **No se comparte con el cliente.**',
  '>',
  `> Generado el ${fecha(hoy)} con \`npm run expediente\`. Se regenera; no se edita a mano.`,
  '',
]

// --- Las sesiones ------------------------------------------------------------
const s1 = [...AVISO]
s1.unshift('')
s1.unshift('# Expediente · las sesiones del levantamiento')
s1.push(
  `**${(sesiones ?? []).length} sesiones**, de las cuales ${vivas.length} se pueden citar.` +
    (retenidos ? ` Una quedó retenida a solicitud de la persona entrevistada y no figura acá.` : '')
)
s1.push('')
s1.push('| Código | Fecha | Quién | Cargo | Área | Sede |')
s1.push('|---|---|---|---|---|---|')
for (const s of vivas) {
  s1.push(
    `| \`${s.codigo}\` | ${fecha(s.fecha_entrevista)} | ${celda(s.entrevistado_nombre ?? s.titulo)} | ` +
      `${celda(s.entrevistado_cargo)} | ${celda(s.areas?.nombre)} | ${SEDES[s.sede] ?? '—'} |`
  )
}
await writeFile(join(SALIDA, 'sesiones.md'), s1.join('\n'), 'utf8')

// --- Los hallazgos, agrupados por área --------------------------------------
//
// Por área y no por sesión porque así es como llega la pregunta: alguien
// discute algo de Compras, no algo de ENT-009.
const porArea = new Map()
for (const h of vivos) {
  const a = h.areas?.nombre ?? 'Sin área'
  if (!porArea.has(a)) porArea.set(a, [])
  porArea.get(a).push(h)
}

const s2 = ['# Expediente · los hallazgos, con su evidencia', '', ...AVISO]
s2.push(`**${vivos.length} hallazgos citables**, repartidos en ${porArea.size} áreas.`)
s2.push('')
s2.push('Cada uno lleva **la frase literal** de la sesión donde se levantó. Es lo que el informe')
s2.push('dice en prosa formal, y lo que sostiene esa prosa si alguien la discute.')

let conCita = 0
for (const [area, suyos] of [...porArea.entries()].sort((a, b) => b[1].length - a[1].length)) {
  s2.push('')
  s2.push('---')
  s2.push('')
  s2.push(`## ${area} · ${suyos.length}`)
  for (const h of suyos.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))) {
    const e = h.entrevistas
    s2.push('')
    s2.push(`### ${h.titulo}`)
    s2.push('')
    s2.push(
      `\`${e?.codigo ?? '—'}\` · **${e?.entrevistado_nombre ?? '—'}**` +
        (e?.entrevistado_cargo ? ` · ${e.entrevistado_cargo}` : '') +
        ` · ${fecha(e?.fecha_entrevista)}`
    )
    s2.push('')
    s2.push(`*${h.tipo} · ${h.estado}${h.impacto ? ` · impacto ${h.impacto}` : ''}*`)
    if (h.descripcion) {
      s2.push('')
      s2.push(h.descripcion.trim())
    }
    if (h.cita_textual) {
      conCita++
      s2.push('')
      for (const linea of h.cita_textual.trim().split('\n')) s2.push(`> ${linea}`)
    }
  }
}
await writeFile(join(SALIDA, 'hallazgos.md'), s2.join('\n'), 'utf8')

// --- Y en crudo --------------------------------------------------------------
await writeFile(
  join(SALIDA, 'expediente.json'),
  JSON.stringify(
    {
      generado_en: new Date().toISOString(),
      aviso: 'Material bajo NDA. Uso interno del equipo consultor. No se comparte con el cliente.',
      sesiones: vivas,
      hallazgos: vivos,
      retenidos_sin_consentimiento: [...SIN_CONSENTIMIENTO],
    },
    null,
    2
  ),
  'utf8'
)

console.log(`\nExpediente en ${SALIDA}`)
console.log(`  sesiones.md      ${vivas.length} sesiones citables de ${(sesiones ?? []).length}`)
console.log(`  hallazgos.md     ${vivos.length} hallazgos en ${porArea.size} áreas · ${conCita} con cita literal`)
console.log(`  expediente.json  lo mismo en crudo`)
if (retenidos) console.log(`  ⛔ ${retenidos} hallazgo(s) retenido(s) por falta de consentimiento, fuera del expediente`)
console.log('\n⚠️ Bajo NDA: no va a ningún repositorio, y no se comparte con el cliente.')
