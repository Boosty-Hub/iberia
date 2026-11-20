/**
 * Plataforma Iberia · copia el PROGRAMA de producción al proyecto de PRUEBAS
 * (integración del programa en /sistema, 20-nov-2026).
 *
 * Producción se lee y **nunca se escribe**: el cliente de producción solo hace
 * `select` y `storage.download`. Lo que se copia, con los mismos ids:
 *
 *   personas · entrevistas · sesion_participantes · transcripcion_segmentos ·
 *   hallazgos · hitos · registros_horas · calendario_actividades (su estado) ·
 *   archivos (metadata) y **un** binario del bucket `archivos` para probar la
 *   previa (el más chico que se pueda previsualizar).
 *
 * Las transcripciones son material de Iberia bajo NDA: van al proyecto de
 * pruebas, que es de la misma organización. Las columnas que apuntan a un
 * usuario de producción (`created_by`, `uploaded_by`, `updated_by`) quedan en
 * null: en pruebas esos usuarios no existen.
 *
 *   node --env-file=.env.local scripts/plataforma/importar-programa.mjs            # copia
 *   node --env-file=.env.local scripts/plataforma/importar-programa.mjs --revisar  # dice qué copiaría
 *
 * Es idempotente: upsert por id.
 */
import { createClient } from '@supabase/supabase-js'

const REVISAR = process.argv.includes('--revisar')
const env = process.env
if (!env.SUPABASE_PRUEBAS_URL || !env.SUPABASE_PRUEBAS_SECRET_KEY) throw new Error('Faltan las variables del proyecto de pruebas')
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new Error('Faltan las variables de producción (solo lectura)')
if (new URL(env.SUPABASE_PRUEBAS_URL).host === new URL(env.NEXT_PUBLIC_SUPABASE_URL).host) throw new Error('Pruebas y producción son el mismo proyecto: no se corre')

const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const pruebas = createClient(env.SUPABASE_PRUEBAS_URL, env.SUPABASE_PRUEBAS_SECRET_KEY, { auth: { persistSession: false } })
console.log(`Origen (solo lectura): ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host}`)
console.log(`Destino: ${new URL(env.SUPABASE_PRUEBAS_URL).host}`)

/** Las columnas generadas (los tsvector de búsqueda) no se insertan. */
async function generadas() {
  const ref = new URL(env.SUPABASE_PRUEBAS_URL).hostname.split('.')[0]
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: "select table_name, column_name from information_schema.columns where table_schema = 'public' and (is_generated = 'ALWAYS' or generation_expression is not null)" }),
  })
  if (!r.ok) throw new Error(`No se pudieron leer las columnas generadas: ${r.status}`)
  const filas = await r.json()
  const mapa = {}
  for (const f of filas) (mapa[f.table_name] ??= new Set()).add(f.column_name)
  return mapa
}

async function todo(tabla, orden = 'id') {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await prod.from(tabla).select('*').order(orden).range(desde, desde + 999)
    if (error) throw new Error(`${tabla} (producción): ${error.message}`)
    filas.push(...data)
    if (data.length < 1000) return filas
  }
}

const SIN_USUARIO = ['created_by', 'uploaded_by', 'updated_by']

async function copiar(tabla, filas, quitar) {
  const limpias = filas.map((f) => {
    const c = { ...f }
    for (const k of SIN_USUARIO) if (k in c) c[k] = null
    for (const k of quitar?.[tabla] ?? []) delete c[k]
    return c
  })
  if (REVISAR) return console.log(`  [revisar] ${tabla}: ${limpias.length}`)
  for (let i = 0; i < limpias.length; i += 500) {
    const { error } = await pruebas.from(tabla).upsert(limpias.slice(i, i + 500), { onConflict: 'id' })
    if (error) throw new Error(`${tabla} (pruebas): ${error.message}`)
  }
  console.log(`  ${tabla}: ${limpias.length}`)
}

/**
 * Los turnos de la transcripción tienen el id `generated always` y los
 * hallazgos apuntan a él (`segmento_id`): para conservarlo hace falta
 * `overriding system value`, que PostgREST no ofrece. Van por la Management API,
 * en tandas, con el JSON dentro de una cadena dólar (sin pasar por argv).
 */
async function copiarSegmentos() {
  const filas = await todo('transcripcion_segmentos')
  if (REVISAR) return console.log(`  [revisar] transcripcion_segmentos: ${filas.length}`)
  const ref = new URL(env.SUPABASE_PRUEBAS_URL).hostname.split('.')[0]
  const cols = ['id', 'entrevista_id', 'indice', 'hablante', 'inicio_segundos', 'fin_segundos', 'texto', 'hablante_original']
  for (let i = 0; i < filas.length; i += 1500) {
    const lote = JSON.stringify(filas.slice(i, i + 1500).map((f) => Object.fromEntries(cols.map((c) => [c, f[c] ?? null]))))
    if (lote.includes('$seg$')) throw new Error('Un turno contiene el delimitador $seg$')
    const query = `insert into public.transcripcion_segmentos (${cols.join(', ')}) overriding system value
      select ${cols.join(', ')} from jsonb_populate_recordset(null::public.transcripcion_segmentos, $seg$${lote}$seg$::jsonb)
      on conflict (id) do update set ${cols.slice(1).map((c) => `${c} = excluded.${c}`).join(', ')}`
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!r.ok) throw new Error(`transcripcion_segmentos (pruebas): ${r.status} ${(await r.text()).slice(0, 300)}`)
  }
  // Que la identidad siga después del último id copiado.
  await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "select setval(pg_get_serial_sequence('public.transcripcion_segmentos', 'id'), greatest((select max(id) from public.transcripcion_segmentos), 1))",
    }),
  })
  console.log(`  transcripcion_segmentos: ${filas.length}`)
}

const quitar = await generadas()
// En el orden de las llaves foráneas.
await copiar('personas', await todo('personas'), quitar)
await copiar('entrevistas', await todo('entrevistas'), quitar)
await copiar('sesion_participantes', await todo('sesion_participantes'), quitar)
await copiarSegmentos()
await copiar('hallazgos', await todo('hallazgos'), quitar)
await copiar('hitos', await todo('hitos'), quitar)
await copiar('registros_horas', await todo('registros_horas'), quitar)
await copiar('calendario_actividades', await todo('calendario_actividades'), quitar)
const archivos = await todo('archivos')
await copiar('archivos', archivos, quitar)

// ── Un solo binario, para la prueba de la previa ────────────────────────────
const previa = archivos
  .filter((a) => /pdf|markdown|text\/|image\//.test(a.mime_type ?? '') && (a.tamano_bytes ?? 0) > 0)
  .sort((a, b) => (a.tamano_bytes ?? 0) - (b.tamano_bytes ?? 0))[0]
if (!previa) console.log('  (no hay un archivo previsualizable que copiar)')
else if (REVISAR) console.log(`  [revisar] binario: ${previa.nombre} (${previa.tamano_bytes} bytes)`)
else {
  const { data, error } = await prod.storage.from('archivos').download(previa.storage_path)
  if (error || !data) throw new Error(`No se pudo leer ${previa.nombre} de producción: ${error?.message}`)
  const { error: e2 } = await pruebas.storage
    .from('archivos')
    .upload(previa.storage_path, Buffer.from(await data.arrayBuffer()), { contentType: previa.mime_type ?? 'application/octet-stream', upsert: true })
  if (e2) throw new Error(`No se pudo subir ${previa.nombre} a pruebas: ${e2.message}`)
  console.log(`  binario: ${previa.nombre} (${previa.id})`)
}
console.log('Listo.')
