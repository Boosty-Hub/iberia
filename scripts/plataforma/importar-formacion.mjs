/**
 * Plataforma Iberia · copia al PROYECTO DE PRUEBAS lo que Formación y el padrón
 * necesitan para verse con datos: el estado del curso de Ajito (abierto,
 * asistente), las lecciones, las matrículas, los avances, los certificados, los
 * recordatorios, las correcciones del padrón y el estado de los enlaces.
 *
 *   node --env-file=.env.local scripts/plataforma/importar-formacion.mjs            # copia
 *   node --env-file=.env.local scripts/plataforma/importar-formacion.mjs --revisar  # dice qué copiaría
 *   node --env-file=.env.local scripts/plataforma/importar-formacion.mjs --audios   # y los audios del curso (bucket adiestramiento)
 *
 * 🔴 Producción solo se LEE: el cliente de producción no escribe nada en todo el
 * script (solo `select`), y el de destino es el de pruebas, que se niega si su
 * dirección es la de producción.
 *
 * Lo que NO se copia, a propósito:
 *  · el token de WhatsApp ni ningún secreto de `ajustes_whatsapp` (la conexión de
 *    pruebas queda apagada: desde pruebas no sale un mensaje a nadie);
 *  · las respuestas de la gente a Ajito (solo su autor y el equipo las leen; aquí
 *    no hacen falta) ni sus archivos;
 *  · los enlaces personales: de `accesos` viaja solo el estado (acuñado, mandado,
 *    usos, caducidad). La huella se reemplaza por la de un token al azar que nadie
 *    tiene y el mensaje —que lleva el enlace en claro— no viaja. Un enlace de
 *    producción no abre nada en pruebas ni al revés.
 *  · los audios del curso, salvo con `--audios` (solo el bucket del curso).
 *
 * Los ids de matrículas, avances, certificados y demás se conservan (las fichas
 * del padrón ya tienen los ids de producción, de `importar-base.mjs`); el curso
 * y las lecciones de pruebas tienen ids propios (los sembraron las migraciones),
 * así que se traducen por clave y por número.
 *
 * Además deja una ficha sintética («Cuenta de pruebas · Plataforma») enlazada a
 * `admin.pruebas@plataforma.local`: `probar:adiestramiento` prueba la RLS con la
 * sesión de alguien que tiene ficha, y en pruebas nadie entra con la cuenta de
 * un cliente.
 */
import { createHash, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const REVISAR = process.argv.includes('--revisar')
const env = process.env
for (const v of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_PRUEBAS_URL', 'SUPABASE_PRUEBAS_SECRET_KEY'])
  if (!env[v]) throw new Error(`Falta ${v} en .env.local`)
if (new URL(env.SUPABASE_PRUEBAS_URL).host === new URL(env.NEXT_PUBLIC_SUPABASE_URL).host)
  throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se copia nada')

const opciones = { auth: { persistSession: false } }
const prod = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, opciones) // solo lectura
const db = createClient(env.SUPABASE_PRUEBAS_URL, env.SUPABASE_PRUEBAS_SECRET_KEY, opciones)
console.log(`Origen (solo lectura): ${new URL(env.NEXT_PUBLIC_SUPABASE_URL).host}`)
console.log(`Destino: ${new URL(env.SUPABASE_PRUEBAS_URL).host}${REVISAR ? ' · revisar, sin escribir' : ''}`)

/** Todo lo de una tabla de producción, de mil en mil (Supabase corta en 1.000). */
async function leerProd(tabla, columnas = '*') {
  const filas = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await prod.from(tabla).select(columnas).order('id').range(desde, desde + 999)
    if (error) throw new Error(`${tabla} (producción): ${error.message}`)
    filas.push(...data)
    if (data.length < 1000) return filas
  }
}

async function escribir(tabla, filas, onConflict) {
  if (!filas.length) return console.log(`  ${tabla}: nada que copiar`)
  if (REVISAR) return console.log(`  [revisar] ${tabla}: ${filas.length} filas`)
  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await db.from(tabla).upsert(filas.slice(i, i + 500), { onConflict })
    if (error) throw new Error(`${tabla}: ${error.message}`)
  }
  console.log(`  ${tabla}: ${filas.length}`)
}

// ── El curso y las lecciones: se traducen por clave y número ────────────────
const [{ data: cursosProd }, { data: cursosPru }] = await Promise.all([
  prod.from('cursos').select('id, clave, abierto, asistente_libre_activo'),
  db.from('cursos').select('id, clave'),
])
const curso = new Map()
for (const c of cursosProd ?? []) {
  const destino = (cursosPru ?? []).find((x) => x.clave === c.clave)
  if (!destino) {
    console.log(`  ⚠️ el curso «${c.clave}» no existe en pruebas: no se copia lo suyo`)
    continue
  }
  curso.set(c.id, destino.id)
  if (!REVISAR) await db.from('cursos').update({ abierto: c.abierto, asistente_libre_activo: c.asistente_libre_activo }).eq('id', destino.id)
}

const [leccionesProd, { data: leccionesPru }] = await Promise.all([
  leerProd('lecciones', 'id, curso_id, numero, titulo, resumen, minutos, activa'),
  db.from('lecciones').select('id, curso_id, numero'),
])
const leccion = new Map()
for (const l of leccionesProd) {
  const destino = (leccionesPru ?? []).find((x) => x.curso_id === curso.get(l.curso_id) && x.numero === l.numero)
  if (!destino) continue
  leccion.set(l.id, destino.id)
  if (!REVISAR) await db.from('lecciones').update({ titulo: l.titulo, resumen: l.resumen, minutos: l.minutos, activa: l.activa }).eq('id', destino.id)
}
console.log(`  curso: ${curso.size} · lecciones: ${leccion.size}`)

// Solo las fichas que existen en pruebas (las copió importar-base.mjs).
const { data: fichas } = await db.from('empleados').select('id').range(0, 4999)
const existe = new Set((fichas ?? []).map((f) => f.id))

// ── Matrículas, avances, certificados y recordatorios ───────────────────────
const matriculas = (await leerProd('matriculas')).filter((m) => curso.has(m.curso_id) && existe.has(m.empleado_id))
await escribir('matriculas', matriculas.map((m) => ({ ...m, curso_id: curso.get(m.curso_id) })), 'id')
const conMatricula = new Set(matriculas.map((m) => m.id))

const avances = (await leerProd('avances')).filter((a) => conMatricula.has(a.matricula_id) && leccion.has(a.leccion_id))
await escribir('avances', avances.map((a) => ({ ...a, leccion_id: leccion.get(a.leccion_id) })), 'id')

const certificados = (await leerProd('certificados')).filter((c) => conMatricula.has(c.matricula_id))
await escribir('certificados', certificados, 'id')

const recordatorios = (await leerProd('recordatorios')).filter((r) => conMatricula.has(r.matricula_id))
await escribir('recordatorios', recordatorios, 'id')

// ── Correcciones del padrón («No soy yo») ────────────────────────────────────
// Quién la resolvió es una cuenta de producción: en pruebas no existe.
// El trigger congela lo que decía el padrón al insertar: lo recalcula de la ficha
// copiada, que es la misma de producción.
const correcciones = (await leerProd('correcciones_padron')).filter((c) => existe.has(c.empleado_id))
await escribir('correcciones_padron', correcciones.map((c) => ({ ...c, resuelta_por: null })), 'id')

// ── El estado de los enlaces, sin el enlace ─────────────────────────────────
const accesos = (await leerProd('accesos', 'id, empleado_id, enviado_en, expira_en, usado_en, canal, created_at, motivo, usos, ultimo_uso')).filter((a) => existe.has(a.empleado_id))
await escribir(
  'accesos',
  accesos.map((a) => ({
    ...a,
    publicacion_id: null,
    // La huella de un token al azar que nadie conoce: el estado viaja, la credencial no.
    token_hash: createHash('sha256').update(randomBytes(32).toString('base64url')).digest('hex'),
    mensaje: null,
  })),
  'id'
)

// ── La conexión de WhatsApp: solo lo que no es secreto, y apagada ───────────
const { data: conexion } = await prod.from('ajustes_whatsapp').select('plantilla, numero_visible').eq('id', true).maybeSingle()
if (!REVISAR)
  await db
    .from('ajustes_whatsapp')
    .update({ activo: false, plantilla: conexion?.plantilla ?? null, numero_visible: conexion?.numero_visible ?? null })
    .eq('id', true)
console.log(`  ajustes_whatsapp: apagada, sin token${conexion?.plantilla ? `, plantilla «${conexion.plantilla}»` : ''}`)

// ── Una ficha sintética para la cuenta de administración de pruebas ─────────
const CORREO = 'admin.pruebas@plataforma.local'
const CEDULA = 'PRUEBA-PLATAFORMA-ADMIN'
const { data: perfil } = await db.from('profiles').select('id').eq('email', CORREO).maybeSingle()
if (!perfil) console.log(`  ⚠️ no existe ${CORREO} en pruebas: sin ficha sintética`)
else if (!REVISAR) {
  const { data: ya } = await db.from('empleados').select('id').eq('perfil_id', perfil.id).maybeSingle()
  if (ya) console.log(`  ${CORREO} ya tiene ficha`)
  else {
    const { error } = await db.from('empleados').insert({
      cedula: CEDULA,
      nombre_completo: 'Cuenta de pruebas Plataforma',
      cargo: 'Analista de pruebas',
      nivel: 'administrativo',
      tipo_nomina: 'mensual',
      familia_oficio: 'oficina',
      perfil_id: perfil.id,
      activo: true,
    })
    console.log(error ? `  ⚠️ ficha sintética: ${error.message}` : `  ficha sintética enlazada a ${CORREO}`)
  }
}

// ── Con --audios: los audios del curso (bucket `adiestramiento`) ────────────
// Solo los de Ajito —el guion grabado, igual para todos—, nunca el bucket de lo
// que la gente responde (`adiestramiento-respuestas`). `probar:certificado`
// recorre la lección 8 y pide su audio.
if (process.argv.includes('--audios')) {
  const BUCKET = 'adiestramiento'
  async function listar(carpeta = '') {
    const archivos = []
    for (let desde = 0; ; desde += 100) {
      const { data, error } = await prod.storage.from(BUCKET).list(carpeta, { limit: 100, offset: desde })
      if (error) throw new Error(`listar ${carpeta || '/'} (producción): ${error.message}`)
      for (const o of data) {
        const ruta = carpeta ? `${carpeta}/${o.name}` : o.name
        if (o.id === null) archivos.push(...(await listar(ruta)))
        else archivos.push({ ruta, tipo: o.metadata?.mimetype ?? 'application/octet-stream' })
      }
      if (data.length < 100) return archivos
    }
  }
  const archivos = await listar()
  const { data: ya } = await db.storage.from(BUCKET).list('', { limit: 1 })
  console.log(`  audios del curso: ${archivos.length} archivos en producción${ya?.length ? ' (pruebas ya tiene algunos: se pisan)' : ''}`)
  if (!REVISAR) {
    let copiados = 0
    for (const a of archivos) {
      const { data: blob, error } = await prod.storage.from(BUCKET).download(a.ruta)
      if (error) throw new Error(`bajar ${a.ruta}: ${error.message}`)
      const { error: e2 } = await db.storage.from(BUCKET).upload(a.ruta, blob, { upsert: true, contentType: a.tipo })
      if (e2) throw new Error(`subir ${a.ruta}: ${e2.message}`)
      copiados++
    }
    console.log(`  audios del curso copiados: ${copiados}`)
  }
}

console.log(REVISAR ? '\nRevisión terminada: no se escribió nada.' : '\nListo. Producción no se tocó.')
