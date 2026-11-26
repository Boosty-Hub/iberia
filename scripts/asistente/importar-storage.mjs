/**
 * Mis archivos (26-nov-2026, pedido de Gabriel): «todos los archivos que están en Supabase deben salir en el módulo de
 * archivos bajo el usuario de gmontiel, ordenados en carpetas y subcarpetas». Recorre los buckets y crea, a nombre de
 * esa persona, el árbol de carpetas y una fila `referencia` por objeto: no copia bytes (no duplica Storage) y lo
 * original sigue donde estaba, con sus propias reglas.
 *
 *   node --env-file=.env.local scripts/asistente/importar-storage.mjs [--email admin.pruebas@plataforma.local] [--revisar]
 *   node --env-file=.env.local scripts/asistente/importar-storage.mjs --destino produccion --confirmo [--email gmontiel@spatiumgroup.com]
 *
 * El árbol:
 *   Documentos del SGC/      ← documentos: la ruta original de cada archivo en «Procesos Iberia» (manifiesto local);
 *                              lo que no está en el manifiesto, en «Sin carpeta de origen»
 *   Expediente del programa/ ← archivos: por categoría
 *   Curso de Ajito/          ← adiestramiento: como está en el bucket (lección, voz, fichas, referencias)
 *   Respuestas de los trabajadores/ ← adiestramiento-respuestas: una carpeta por persona (nombre y ficha)
 *   Portal planta/           ← canal: como está en el bucket
 *   Tutoriales/              ← tutoriales: como está en el bucket
 * El bucket del asistente NO entra: son los chats de cada quien, que nadie lee salvo Boosty para soporte y con
 * registro (decisión 9). Lo de Gabriel ya está en su asistente.
 *
 * Marca con `aviso` lo privado (respuestas de los trabajadores, documentos de perímetro sensible, expediente
 * confidencial): compartirlo pide confirmación expresa. Idempotente: vuelve a correr y solo agrega lo nuevo.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const arg = (n) => {
  const i = process.argv.indexOf(n)
  return i > 0 ? process.argv[i + 1] : undefined
}
const e = process.env
const produccion = arg('--destino') === 'produccion'
if (produccion && !process.argv.includes('--confirmo')) throw new Error('Producción pide --confirmo (y el OK de Gabriel).')
const REVISAR = process.argv.includes('--revisar')
const url = produccion ? e.NEXT_PUBLIC_SUPABASE_URL : e.SUPABASE_PRUEBAS_URL
const clave = produccion ? e.SUPABASE_SECRET_KEY : e.SUPABASE_PRUEBAS_SECRET_KEY
if (!url || !clave) throw new Error('Faltan la URL o la clave de servicio')
const EMAIL = arg('--email') ?? (produccion ? 'gmontiel@spatiumgroup.com' : 'admin.pruebas@plataforma.local')
const db = createClient(url, clave, { auth: { persistSession: false } })
const A = db.schema('asistente')

const { data: lista } = await db.auth.admin.listUsers({ perPage: 1000 })
const dueno = lista.users.find((u) => u.email === EMAIL)?.id
if (!dueno) throw new Error(`No existe la cuenta ${EMAIL} en ${produccion ? 'producción' : 'pruebas'}`)
console.log(`${produccion ? 'PRODUCCIÓN' : 'pruebas'} · a nombre de ${EMAIL}${REVISAR ? ' · solo revisar' : ''}`)

// ── Storage: todos los objetos de un bucket, recorriendo carpetas ──────────────
const { data: buckets } = await db.storage.listBuckets()
const existe = new Set((buckets ?? []).map((b) => b.id))
async function objetos(bucket, prefijo = '') {
  if (!prefijo && !existe.has(bucket)) {
    console.warn(`⚠ No existe el bucket «${bucket}» en este proyecto: se salta.`)
    return []
  }
  const salida = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefijo, { limit: 1000, offset: desde, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`${bucket}/${prefijo}: ${error.message}`)
    for (const o of data ?? []) {
      const ruta = prefijo ? `${prefijo}/${o.name}` : o.name
      if (o.id === null) salida.push(...(await objetos(bucket, ruta)))
      else if (o.name !== '.emptyFolderPlaceholder') salida.push({ ruta, bytes: Number(o.metadata?.size ?? 0), mime: o.metadata?.mimetype ?? 'application/octet-stream' })
    }
    if ((data ?? []).length < 1000) break
  }
  return salida
}

// ── Carpetas: crear (o encontrar) una ruta de nombres ──────────────────────────
const limpio = (n) => String(n).replace(/[\\/]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 200) || 'Sin nombre'
const cache = new Map()
{
  const { data } = await A.from('carpeta').select('id, padre_id, nombre').eq('dueno', dueno).limit(20000)
  for (const c of data ?? []) cache.set(`${c.padre_id ?? ''}|${c.nombre.toLowerCase()}`, c.id)
}
let carpetasNuevas = 0
async function carpeta(partes) {
  let padre = null
  for (const p of partes.map(limpio)) {
    const k = `${padre ?? ''}|${p.toLowerCase()}`
    let id = cache.get(k)
    if (!id) {
      id = crypto.randomUUID()
      carpetasNuevas++
      if (!REVISAR) {
        const { error } = await A.from('carpeta').insert({ id, dueno, padre_id: padre, nombre: p })
        if (error) throw new Error(`carpeta ${partes.join('/')}: ${error.message}`)
      }
      cache.set(k, id)
    }
    padre = id
  }
  return padre
}

// ── Lo que ya está importado ───────────────────────────────────────────────────
const ya = new Set()
for (let desde = 0; ; desde += 1000) {
  const { data } = await A.from('archivo').select('bucket, ruta').eq('dueno', dueno).eq('origen', 'referencia').range(desde, desde + 999)
  for (const r of data ?? []) ya.add(`${r.bucket}|${r.ruta}`)
  if ((data ?? []).length < 1000) break
}
const pendientes = []
async function referencia(bucket, o, partes, nombre, aviso = null) {
  if (ya.has(`${bucket}|${o.ruta}`)) return
  ya.add(`${bucket}|${o.ruta}`)
  const carpeta_id = await carpeta(partes)
  pendientes.push({ dueno, origen: 'referencia', estado: 'listo', bucket, ruta: o.ruta, nombre: limpio(nombre).slice(0, 255), mime: o.mime, bytes: Math.min(o.bytes, 104857600), carpeta_id, aviso })
}
const base = (r) => r.split('/').pop()
const sinExt = (n) => n.replace(/\.[^.]+$/, '')

// 1) Documentos del SGC, con su carpeta de origen.
{
  const objs = await objetos('documentos')
  const manifiestoRuta = 'plataforma/_trabajo/documentos-pdf/manifiesto.json'
  const porHuella = new Map()
  if (existsSync(manifiestoRuta)) {
    for (const m of JSON.parse(readFileSync(manifiestoRuta, 'utf8'))) if (!porHuella.has(m.hash)) porHuella.set(m.hash, m.ruta)
  } else console.warn('⚠ Sin manifiesto local: los documentos van a «Sin carpeta de origen».')
  // Qué documento cita cada archivo, para el aviso de perímetro.
  const { data: filas } = await db.schema('sgc').from('documento_archivo').select('huella, pdf_ruta, original_ruta, documento_id').limit(20000)
  const docs = [...new Set((filas ?? []).map((f) => f.documento_id))]
  const perimetro = new Map()
  for (let i = 0; i < docs.length; i += 500) {
    const { data } = await db.schema('sgc').from('documento').select('id, perimetro, datos_sensibles').in('id', docs.slice(i, i + 500))
    for (const d of data ?? []) perimetro.set(d.id, d.perimetro !== 'general' || d.datos_sensibles)
  }
  const porRuta = new Map()
  for (const f of filas ?? []) {
    if (f.pdf_ruta) porRuta.set(f.pdf_ruta, f)
    if (f.original_ruta) porRuta.set(f.original_ruta, f)
  }
  for (const o of objs) {
    const f = porRuta.get(o.ruta)
    const origen = f ? porHuella.get(f.huella) : null
    const sensible = f ? perimetro.get(f.documento_id) : false
    const aviso = sensible ? 'Documento de perímetro sensible: hoy solo lo ve quien tiene «Perímetros»' : null
    if (origen) {
      const partes = origen.split(/[\\/]/)
      const archivo = partes.pop()
      const esPdf = o.ruta.endsWith('.pdf') && !archivo.toLowerCase().endsWith('.pdf')
      await referencia('documentos', o, ['Documentos del SGC', ...partes], esPdf ? `${sinExt(archivo)}.pdf` : archivo, aviso)
    } else await referencia('documentos', o, ['Documentos del SGC', 'Sin carpeta de origen'], base(o.ruta), aviso)
  }
  console.log(`documentos: ${objs.length} objetos`)
}

// 2) El expediente del programa, por categoría.
{
  const ETIQUETA = { entrevista: 'Entrevistas', proceso: 'Procesos', sistema: 'Sistema - ERP', dato: 'Datos', politica: 'Políticas', comunicacion: 'Comunicación', formacion: 'Formación', referencia: 'Referencia', otro: 'Otros' }
  const objs = await objetos('archivos')
  const { data: filas } = await db.from('archivos').select('nombre, storage_path, categoria, confidencial').limit(5000)
  const porRuta = new Map((filas ?? []).map((f) => [f.storage_path, f]))
  for (const o of objs) {
    const f = porRuta.get(o.ruta)
    await referencia('archivos', o, ['Expediente del programa', ETIQUETA[f?.categoria] ?? 'Otros'], f?.nombre ?? base(o.ruta), f?.confidencial === false ? null : 'Expediente confidencial del programa (solo el equipo con «Archivos»)')
  }
  console.log(`expediente: ${objs.length} objetos`)
}

// 3) El curso de Ajito, 5) el Portal planta y 6) los tutoriales: como están en su bucket.
for (const [bucket, raiz] of [
  ['adiestramiento', 'Curso de Ajito'],
  ['canal', 'Portal planta'],
  ['tutoriales', 'Tutoriales'],
]) {
  const objs = await objetos(bucket)
  for (const o of objs) {
    const partes = o.ruta.split('/')
    const nombre = partes.pop()
    await referencia(bucket, o, [raiz, ...partes], nombre)
  }
  console.log(`${bucket}: ${objs.length} objetos`)
}

// 4) Las respuestas de los trabajadores: una carpeta por persona.
{
  const objs = await objetos('adiestramiento-respuestas')
  const ids = [...new Set(objs.map((o) => o.ruta.split('/')[1]).filter(Boolean))]
  const nombre = new Map()
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await db.from('empleados').select('id, nombre_completo, ficha').in('id', ids.slice(i, i + 300))
    for (const x of data ?? []) nombre.set(x.id, `${x.nombre_completo}${x.ficha ? ` (${x.ficha})` : ''}`)
  }
  for (const o of objs) {
    const [, empleado, ...resto] = o.ruta.split('/')
    const archivo = resto.pop() ?? base(o.ruta)
    await referencia('adiestramiento-respuestas', o, ['Respuestas de los trabajadores', nombre.get(empleado) ?? `Ficha ${empleado?.slice(0, 8) ?? 'sin dueño'}`, ...resto], archivo, 'Respuesta privada de un trabajador: hoy solo la leen su autor y el equipo editor')
  }
  console.log(`respuestas: ${objs.length} objetos`)
}

// ── Escribir ───────────────────────────────────────────────────────────────────
console.log(`${carpetasNuevas} carpetas nuevas · ${pendientes.length} archivos nuevos (${pendientes.filter((p) => p.aviso).length} marcados privados)`)
if (!REVISAR) {
  for (let i = 0; i < pendientes.length; i += 500) {
    const { error } = await A.from('archivo').insert(pendientes.slice(i, i + 500))
    if (error) throw new Error(`archivos ${i}: ${error.message}`)
  }
  console.log('listo')
}
