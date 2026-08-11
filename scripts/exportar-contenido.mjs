/**
 * Vuelca a disco todo lo cargado en el sistema, para poder leerlo.
 *
 *   node --env-file=.env.local scripts/exportar-contenido.mjs [--salida <carpeta>]
 *
 * Escribe una transcripción por entrevista y descarga los archivos del bucket.
 * La carpeta de salida contiene material confidencial de Iberia: está ignorada
 * por git.
 */

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args[process.argv[i].slice(2)] = process.argv[i + 1]
}

const SALIDA = args.salida ?? 'contenido'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

await mkdir(join(SALIDA, 'transcripciones'), { recursive: true })
await mkdir(join(SALIDA, 'archivos'), { recursive: true })

function mmss(segundos) {
  if (segundos === null || segundos === undefined) return '     '
  const t = Math.floor(Number(segundos))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const p = (v) => String(v).padStart(2, '0')
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

// --- Transcripciones ---------------------------------------------------------
const { data: entrevistas } = await admin
  .from('entrevistas')
  .select('id, codigo, entrevistado_nombre, entrevistado_cargo, sede, fecha_entrevista, duracion_minutos, estado, resumen, notas_consultor, areas(nombre)')
  .order('codigo')

console.log(`\n${entrevistas?.length ?? 0} entrevistas\n`)

for (const e of entrevistas ?? []) {
  // Se pagina: una entrevista larga supera el límite por defecto de PostgREST.
  const segmentos = []
  const TAMANO = 1000
  for (let desde = 0; ; desde += TAMANO) {
    const { data, error } = await admin
      .from('transcripcion_segmentos')
      .select('indice, hablante, inicio_segundos, texto')
      .eq('entrevista_id', e.id)
      .order('indice')
      .range(desde, desde + TAMANO - 1)
    if (error) throw new Error(`${e.codigo}: ${error.message}`)
    if (!data?.length) break
    segmentos.push(...data)
    if (data.length < TAMANO) break
  }

  const cabecera = [
    `# ${e.codigo} · ${e.entrevistado_nombre}`,
    '',
    `- Cargo: ${e.entrevistado_cargo ?? '—'}`,
    `- Área: ${e.areas?.nombre ?? '—'}`,
    `- Sede: ${e.sede ?? '—'}`,
    `- Fecha: ${e.fecha_entrevista ?? '—'}`,
    `- Duración: ${e.duracion_minutos ? `${e.duracion_minutos} min` : '—'}`,
    `- Estado: ${e.estado}`,
    `- Turnos: ${segmentos.length}`,
    '',
    e.resumen ? `## Resumen\n\n${e.resumen}\n` : '',
    e.notas_consultor ? `## Notas del consultor\n\n${e.notas_consultor}\n` : '',
    '## Transcripción',
    '',
  ].join('\n')

  const cuerpo = segmentos
    .map((s) => `[${mmss(s.inicio_segundos)}] ${s.hablante ?? 'Sin atribuir'}: ${s.texto}`)
    .join('\n\n')

  const archivo = join(SALIDA, 'transcripciones', `${e.codigo}.md`)
  await writeFile(archivo, cabecera + cuerpo, 'utf8')

  const palabras = segmentos.reduce(
    (n, s) => n + s.texto.trim().split(/\s+/).filter(Boolean).length,
    0
  )
  console.log(
    `  ${e.codigo}  ${String(segmentos.length).padStart(4)} turnos  ${String(palabras).padStart(6)} palabras  ${e.entrevistado_nombre}`
  )
}

// --- Archivos del bucket -----------------------------------------------------
const { data: archivos } = await admin
  .from('archivos')
  .select('id, nombre, storage_path, mime_type, tamano_bytes')
  .order('created_at')

console.log(`\n${archivos?.length ?? 0} archivos\n`)

for (const a of archivos ?? []) {
  const { data, error } = await admin.storage.from('archivos').download(a.storage_path)
  if (error) {
    console.log(`  ✖ ${a.nombre}: ${error.message}`)
    continue
  }
  const bytes = Buffer.from(await data.arrayBuffer())
  // El nombre original puede traer caracteres que no valen como ruta.
  const seguro = a.nombre.replace(/[^\w.\- ]+/g, '_').slice(0, 120)
  await writeFile(join(SALIDA, 'archivos', seguro), bytes)
  console.log(`  ${seguro}  (${bytes.length} bytes)`)
}

console.log(`\nTodo en ./${SALIDA}\n`)
