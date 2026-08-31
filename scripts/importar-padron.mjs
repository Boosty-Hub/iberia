/**
 * Carga el padrón de Capital Humano al módulo de empleados.
 *
 *   npm run importar:padron
 *   npm run importar:padron -- --revisar     # dice qué haría, sin escribir
 *
 * Lee el `.xlsx` del bucket de archivos, no de la carpeta de descargas de nadie:
 * el expediente es la fuente. Un `.xlsx` es un ZIP con XML adentro, así que se
 * parsea a mano y no hace falta una dependencia para leer una hoja.
 *
 * ⚠️ **El padrón de julio de 2026 no trae cédula, teléfono ni correo.** La clave
 * es la **ficha**, que es la que usa Capital Humano y contra la que va a venir el
 * segundo archivo. Sin cédula no se puede acuñar el enlace personal y sin
 * teléfono no se puede mandar: las dos cosas están pedidas.
 *
 * Tampoco trae sede. Se puede intuir por el centro de costo, pero **una sede mal
 * puesta manda a alguien al ejercicio equivocado**, así que se deja vacía y se
 * pide. Ver `--sedes` para el reparto que sugieren los centros de costo.
 *
 * Idempotente por ficha: reimportar actualiza, no duplica, y **no pisa lo que se
 * haya editado a mano** en teléfono, correo, cédula ni sede.
 */

import { createClient } from '@supabase/supabase-js'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const RUTA_STORAGE = 'referencia/listado-de-personal-activo-julio-2026.xlsx'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const revisar = process.argv.includes('--revisar')
const verSedes = process.argv.includes('--sedes')

// --- Leer el .xlsx ------------------------------------------------------------

const { data: blob, error: errorBajada } = await admin.storage
  .from('archivos')
  .download(RUTA_STORAGE)

if (errorBajada) {
  console.error(`\n✖ No se pudo bajar ${RUTA_STORAGE}: ${errorBajada.message}`)
  console.error('  Corre antes: npm run subir:documentos\n')
  process.exit(1)
}

const temporal = mkdtempSync(join(tmpdir(), 'padron-'))
try {
  const zip = join(temporal, 'padron.xlsx')
  const { writeFileSync } = await import('node:fs')
  writeFileSync(zip, Buffer.from(await blob.arrayBuffer()))
  execFileSync('unzip', ['-o', '-q', zip, '-d', temporal])

  var hoja = readFileSync(join(temporal, 'xl/worksheets/sheet1.xml'), 'utf8')
  var cadenas = readFileSync(join(temporal, 'xl/sharedStrings.xml'), 'utf8')
} catch (e) {
  console.error(`\n✖ No se pudo abrir el .xlsx: ${e.message}\n`)
  process.exit(1)
} finally {
  // Es material bajo NDA: no se queda descomprimido en el disco.
  rmSync(temporal, { recursive: true, force: true })
}

function desescapar(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/** Las cadenas compartidas: una celda de texto guarda el índice, no el texto. */
const TEXTOS = [...cadenas.matchAll(/<si>(.*?)<\/si>/gs)].map(([, si]) =>
  desescapar([...si.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(([, t]) => t).join(''))
)

/** Las filas, como mapa de columna → valor ya resuelto. */
const FILAS = new Map()
for (const [, ref, fila] of hoja.matchAll(/<row r="(\d+)"[^>]*>(.*?)<\/row>/gs)) {
  const celdas = {}
  for (const [, dir, tipo, cuerpo] of fila.matchAll(
    /<c r="([A-Z]+)\d+"(?:[^>]*?t="([^"]*)")?[^>]*>(.*?)<\/c>/gs
  )) {
    const v = cuerpo.match(/<v>(.*?)<\/v>/s)?.[1]
    if (v === undefined) continue
    celdas[dir] = tipo === 's' ? TEXTOS[Number(v)] : v
  }
  FILAS.set(Number(ref), celdas)
}

/** Serial de Excel → `YYYY-MM-DD`. El día 1 es el 1 de enero de 1900. */
function fechaExcel(serial) {
  const n = Number(serial)
  if (!Number.isFinite(n) || n <= 0) return null
  // Excel cree que 1900 fue bisiesto: hay que descontar ese día fantasma.
  const ms = Date.UTC(1899, 11, 30) + n * 86_400_000
  return new Date(ms).toISOString().slice(0, 10)
}

/** Sin acentos, sin dobles espacios, en mayúsculas. Para comparar nombres. */
function normalizar(s) {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

/**
 * «SARRAMERA GUZMAN , JOSE JESUS» → «Jose Jesus Sarramera Guzman».
 *
 * El archivo trae tres formatos en la misma columna: con espacio antes de la
 * coma, sin espacio, y doce filas sin coma ninguna. Esas doce no se pueden
 * partir y se dejan como vienen — mejor un nombre en otro orden que un apellido
 * convertido en nombre de pila.
 */
function nombreLegible(crudo) {
  const limpio = (crudo ?? '').replace(/\s+/g, ' ').trim()
  const partes = limpio.split(',')
  const texto =
    partes.length === 2 ? `${partes[1].trim()} ${partes[0].trim()}` : limpio
  return texto
    .toLowerCase()
    .replace(/(^|\s|\.)([a-záéíóúñ])/g, (_, antes, letra) => antes + letra.toUpperCase())
}

// --- Del cargo a la familia de oficio. Mismas reglas que sembrar:adiestramiento.
const REGLAS_FAMILIA = [
  ['supervision', /supervisor|coordinador|jefe|encargad/i],
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
  for (const [familia, patron] of REGLAS_FAMILIA) if (patron.test(cargo ?? '')) return familia
  return 'generico'
}

/**
 * El nivel gobierna qué ve la persona al entrar. Sale del cargo, no del tipo de
 * nómina: hay gente de nómina mensual que es de planta y jefes en nómina diaria.
 */
function nivelDe(cargo, nomina) {
  const c = normalizar(cargo)
  if (/^DIRECTOR|^SUB DIRECTOR|^PRESIDENTE|^VICEPRESIDENTE/.test(c)) return 'direccion'
  if (/^GERENTE/.test(c)) return 'gerencia'
  if (/^JEFE|^COORDINADOR|^SUPERVISOR/.test(c)) return 'jefatura'
  if (nomina === 'DIARIA') return 'planta'
  return 'administrativo'
}

// --- Cargar --------------------------------------------------------------------

const { data: areas } = await admin.from('areas').select('id, nombre, slug')

/** Índice de áreas por nombre normalizado, para casar el departamento. */
const porNombre = new Map((areas ?? []).map((a) => [normalizar(a.nombre), a.id]))

/**
 * El archivo escribe el mismo departamento de varias formas —«ALMACEN DE PROD.
 * TERMINADOS» y «ALMACEN DE PRODUCTOS TERMINADOS»— y usa nombres que no calzan
 * con el organigrama cargado. Estas son las equivalencias que no salen solas.
 */
const EQUIVALENCIAS = {
  'JEFATURA ALMACEN MAT PRIMA': 'j-almacen-materia-prima',
  'ALMACEN DE PROD. TERMINADOS': 'g-distribucion',
  'ALMACEN DE PRODUCTOS TERMINADOS': 'g-distribucion',
  MANTENIMIENTO: 'j-mantenimiento',
  'GERENCIA DE MANTENIMIENTO E INGIENERIA': 'g-mantenimiento',
  'GCIA. RECURSOS HUMANOS': 'g-recursos-humanos',
  'CREDITO Y COBRANZA': 'j-credito-cobranza',
  'TECNOLOGIA DE LA INFORMACION': 'g-tecnologia',
  'GCIA TECNOLOGIA DE INFORMACION': 'g-tecnologia',
  'DIRECCION CAPITAL HUMANO': 'capital-humano',
  'DIRECCION DE CAPITAL HUMANO': 'capital-humano',
  'DIRECCION DE OPERACIONES': 'operaciones',
  'DIRECCION DE FINANZAS': 'finanzas',
  'DIRECCION DE COMERCIALIZACION': 'comercializacion',
  'GCIA. NACIONAL DE VENTAS': 'g-ventas',
  'GERENCIA OPERATIVA DE VENTAS': 'g-ventas',
  'JUNTA DIRECTIVA': 'direccion-general',
  'GERENCIA GENERAL': 'direccion-general',
  'DIRECCION GENERAL': 'direccion-general',
}
const porSlug = new Map((areas ?? []).map((a) => [a.slug, a.id]))

function areaDe(departamento, direccion) {
  const d = normalizar(departamento)
  if (EQUIVALENCIAS[d]) return porSlug.get(EQUIVALENCIAS[d]) ?? null
  if (porNombre.has(d)) return porNombre.get(d)
  const dir = normalizar(direccion)
  if (EQUIVALENCIAS[dir]) return porSlug.get(EQUIVALENCIAS[dir]) ?? null
  return porNombre.get(dir) ?? null
}

const NOMINAS = { DIARIA: 'diaria', MENSUAL: 'mensual', CONFIDENCIAL: 'mensual', VENTAS: 'mensual' }

const gente = []
for (let f = 6; f <= 281; f++) {
  const c = FILAS.get(f)
  if (!c?.C) continue
  const nomina = normalizar(c.A)
  gente.push({
    ficha: String(c.B),
    nombre_completo: nombreLegible(c.C),
    cargo: (c.H ?? '').replace(/\s+/g, ' ').trim(),
    departamento: (c.F ?? '').trim(),
    direccion: (c.G ?? '').trim(),
    uo: String(c.E ?? ''),
    tipo_nomina: NOMINAS[nomina] ?? 'mensual',
    nomina_original: nomina,
    fecha_ingreso: fechaExcel(c.I),
  })
}

if (verSedes) {
  // Se muestra el reparto crudo por prefijo de centro de costo y por dirección,
  // sin interpretarlo. Cualquier regla que yo invente para deducir la sede va a
  // mandar a alguien al ejercicio equivocado, y eso es peor que no saberla.
  const porPrefijo = {}
  const porDireccion = {}
  for (const p of gente) {
    const pre = p.uo.padStart(5, '0').slice(0, 2)
    ;(porPrefijo[pre] ??= { n: 0, deptos: new Set() }).n++
    porPrefijo[pre].deptos.add(p.departamento)
    porDireccion[p.direccion] = (porDireccion[p.direccion] ?? 0) + 1
  }

  console.log('\n── Por prefijo de centro de costo (crudo, no se carga)')
  for (const [pre, { n, deptos }] of Object.entries(porPrefijo).sort())
    console.log(`   ${pre}  ${String(n).padStart(4)}  ${[...deptos].slice(0, 3).join(' · ')}`)

  console.log('\n── Por dirección')
  for (const [d, n] of Object.entries(porDireccion).sort((a, b) => b[1] - a[1]))
    console.log(`   ${String(n).padStart(4)}  ${d}`)

  console.log('\n   La sede hay que pedirla: el archivo no la trae y deducirla es adivinar.\n')
}

// --- Escribir -------------------------------------------------------------------

const { data: yaEstan } = await admin
  .from('empleados')
  .select('id, ficha, nombre_completo, cedula, telefono, email, sede')

const porFicha = new Map((yaEstan ?? []).filter((e) => e.ficha).map((e) => [e.ficha, e]))
const porNombreExistente = new Map(
  (yaEstan ?? []).map((e) => [normalizar(e.nombre_completo), e])
)

let nuevos = 0
let actualizados = 0
let sinArea = []
const porFamilia = {}
const porNivel = {}

for (const p of gente) {
  const familia = familiaDe(p.cargo)
  const nivel = nivelDe(p.cargo, p.nomina_original)
  porFamilia[familia] = (porFamilia[familia] ?? 0) + 1
  porNivel[nivel] = (porNivel[nivel] ?? 0) + 1

  const areaId = areaDe(p.departamento, p.direccion)
  if (!areaId) sinArea.push(`${p.departamento} · ${p.direccion}`)

  if (revisar) continue

  // Se casa por ficha; y si la ficha no está todavía, por nombre — así las 17
  // fichas de muestra sembradas a mano se enganchan en vez de duplicarse.
  const previo = porFicha.get(p.ficha) ?? porNombreExistente.get(normalizar(p.nombre_completo))

  const fila = {
    ficha: p.ficha,
    nombre_completo: p.nombre_completo,
    cargo: p.cargo,
    area_id: areaId,
    nivel,
    tipo_nomina: p.tipo_nomina,
    familia_oficio: familia,
    fecha_ingreso: p.fecha_ingreso,
    activo: true,
  }

  if (previo) {
    // Lo que alguien haya conseguido a mano —teléfono, correo, cédula, sede— no
    // se pisa con los vacíos del archivo.
    await admin.from('empleados').update(fila).eq('id', previo.id)
    actualizados++
  } else {
    const { error } = await admin.from('empleados').insert(fila)
    if (error) {
      console.error(`\n✖ ficha ${p.ficha} · ${p.nombre_completo}: ${error.message}\n`)
      process.exit(1)
    }
    nuevos++
  }
}

console.log(`\n── Padrón · ${gente.length} personas`)
console.log(`   ${nuevos} nuevas · ${actualizados} actualizadas`)

console.log('\n── Por nivel')
for (const [k, n] of Object.entries(porNivel).sort((a, b) => b[1] - a[1]))
  console.log(`   ${String(n).padStart(4)}  ${k}`)

console.log('\n── Por familia de oficio')
for (const [k, n] of Object.entries(porFamilia).sort((a, b) => b[1] - a[1]))
  console.log(`   ${String(n).padStart(4)}  ${k}`)

if (sinArea.length) {
  const unicos = [...new Set(sinArea)]
  console.log(`\n⚠️  ${sinArea.length} personas sin área (${unicos.length} departamentos):`)
  for (const d of unicos.slice(0, 15)) console.log(`     · ${d}`)
  if (unicos.length > 15) console.log(`     … y ${unicos.length - 15} más`)
}

console.log('\n⚠️  El padrón no trae cédula, teléfono ni correo.')
console.log('   Sin cédula no se acuña el enlace; sin teléfono no se manda.')
console.log('   Hace falta un segundo archivo de Capital Humano con ficha + cédula + celular.')
console.log('   Tampoco trae sede: `npm run importar:padron -- --sedes` muestra lo que')
console.log('   sugieren los centros de costo, pero no se carga.\n')
