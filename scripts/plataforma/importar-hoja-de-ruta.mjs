/**
 * Plataforma Iberia · carga la hoja de ruta de la plataforma (PRG-PLN): fases,
 * hitos, lo que falta, las decisiones «para Gabriel» y lo construido de cada
 * módulo. **El plan es dato**: se lee de la carpeta del plan y de la semilla,
 * las dos fuera de git (NDA), y queda en la base, donde se edita después.
 *
 *   plataforma/plan/datos/modulos.csv       frontera y dueño de cada módulo
 *   plataforma/plan/datos/decisiones.csv    las G-xx (tipo abierta_gabriel)
 *   plataforma/semillas/hoja-de-ruta.json   fases, hitos, pendientes y lo construido
 *
 *   node --env-file=.env.local scripts/plataforma/importar-hoja-de-ruta.mjs              # pruebas: agrega lo que falta
 *   node --env-file=.env.local scripts/plataforma/importar-hoja-de-ruta.mjs --revisar    # dice qué haría, sin escribir
 *   node --env-file=.env.local scripts/plataforma/importar-hoja-de-ruta.mjs --pisar      # además reescribe lo que ya está
 *   … --destino produccion --confirmo                                                    # producción
 *
 * Idempotente por clave (fases, hitos y pendientes) y por código (decisiones).
 * ⚠️ Sin `--pisar` no toca las filas que ya existen: lo que se marcó resuelto,
 * hecho o decidido en la plataforma manda sobre el archivo (la lección de
 * `sembrar:horas`). Con `--pisar`, el archivo vuelve a mandar en todo. Lista lo
 * que está en la base y no en el archivo; no borra nada.
 * Requiere la migración `20261121090000_hoja_de_ruta.sql`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const REVISAR = args.includes('--revisar')
const PISAR = args.includes('--pisar')
const destino = args.includes('--destino') ? args[args.indexOf('--destino') + 1] : 'pruebas'
if (!['pruebas', 'produccion'].includes(destino)) {
  console.error('--destino debe ser pruebas o produccion.')
  process.exit(1)
}
if (destino === 'produccion' && !args.includes('--confirmo')) {
  console.error('Producción pide --confirmo.')
  process.exit(1)
}

const env = process.env
const cfg =
  destino === 'produccion'
    ? { url: env.NEXT_PUBLIC_SUPABASE_URL, clave: env.SUPABASE_SECRET_KEY }
    : { url: env.SUPABASE_PRUEBAS_URL, clave: env.SUPABASE_PRUEBAS_SECRET_KEY }
if (!cfg.url || !cfg.clave) throw new Error(`Faltan las variables del proyecto de ${destino}`)
if (destino === 'pruebas' && cfg.url === env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('SUPABASE_PRUEBAS_URL apunta a producción: no se corre')
const db = createClient(cfg.url, cfg.clave, { auth: { persistSession: false } })
console.log(`Destino: ${destino} (${new URL(cfg.url).host})${REVISAR ? ' · solo revisar' : ''}${PISAR ? ' · pisar' : ''}`)

const RAIZ = path.resolve(import.meta.dirname, '..', '..')
const DATOS = path.join(RAIZ, 'plataforma', 'plan', 'datos')
const SEMILLA = path.join(RAIZ, 'plataforma', 'semillas', 'hoja-de-ruta.json')
for (const f of [path.join(DATOS, 'modulos.csv'), path.join(DATOS, 'decisiones.csv'), SEMILLA]) {
  if (!fs.existsSync(f)) throw new Error(`No está ${path.relative(RAIZ, f)} (fuera de git: va en la máquina de quien carga)`)
}

function leerCsv(texto) {
  const filas = []
  let fila = [], campo = '', comillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (comillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') comillas = false
      else campo += c
    } else if (c === '"') comillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo); campo = ''
      if (fila.some((x) => x !== '')) filas.push(fila)
      fila = []
    } else campo += c
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila) }
  const [cab, ...resto] = filas
  return resto.map((f) => Object.fromEntries(cab.map((k, i) => [k.replace(/^﻿/, ''), f[i] ?? ''])))
}

const semilla = JSON.parse(fs.readFileSync(SEMILLA, 'utf8'))
const modulosCsv = leerCsv(fs.readFileSync(path.join(DATOS, 'modulos.csv'), 'utf8'))
const decisionesCsv = leerCsv(fs.readFileSync(path.join(DATOS, 'decisiones.csv'), 'utf8'))

// Nada de montos en lo que lee Iberia: si un texto trae una cifra de dinero, se detiene.
const DINERO = /(\$|USD|US\$|Bs\.?\s?\d|€|\bdólares\b|\bbolívares\b)/i
function sinDinero(tabla, filas, campos) {
  for (const f of filas) {
    if (f.solo_equipo) continue
    for (const c of campos) {
      if (typeof f[c] === 'string' && DINERO.test(f[c])) throw new Error(`${tabla} «${f.clave ?? f.codigo}»: «${c}» parece llevar un monto. Lo que lee Iberia no lleva dinero.`)
    }
  }
}

const n = (v) => (v === undefined || v === '' ? null : v)

const fases = semilla.fases.map((f) => ({
  clave: f.clave,
  orden: f.orden,
  nombre: f.nombre,
  periodo_texto: n(f.periodo_texto),
  inicio: n(f.inicio),
  fin: n(f.fin),
  estado: f.estado,
  contiene: n(f.contiene),
  criterio_salida: n(f.criterio_salida),
  contratada: Boolean(f.contratada),
  actual: Boolean(f.actual),
  situacion: n(f.situacion),
}))
if (fases.filter((f) => f.actual).length !== 1) throw new Error('La semilla tiene que marcar exactamente una fase como actual.')
const clavesFase = new Set(fases.map((f) => f.clave))

const hitos = semilla.hitos.map((h) => {
  if (h.fase && !clavesFase.has(h.fase)) throw new Error(`Hito «${h.clave}»: la fase «${h.fase}» no existe en la semilla`)
  return { clave: h.clave, fase: n(h.fase), titulo: h.titulo, fecha: n(h.fecha), estado: h.estado ?? 'pendiente', dueno: n(h.dueno), nota_interna: n(h.nota_interna), orden: h.orden ?? 0 }
})

const pendientes = semilla.pendientes.map((p) => ({
  clave: p.clave,
  titulo: p.titulo,
  detalle: n(p.detalle),
  dueno_tipo: p.dueno_tipo,
  dueno_cargo: n(p.dueno_cargo),
  bloquea: n(p.bloquea),
  fecha_limite: n(p.fecha_limite),
  fecha_texto: n(p.fecha_texto),
  estado: p.estado ?? 'abierto',
  resuelto_en: p.estado === 'resuelto' ? (p.resuelto_en ?? null) : null,
  solo_equipo: Boolean(p.solo_equipo),
  origen: n(p.origen),
  orden: p.orden ?? 0,
}))

const extraDecision = semilla.decisiones ?? {}
const decisiones = decisionesCsv
  .filter((d) => d.tipo === 'abierta_gabriel')
  .map((d, i) => ({
    codigo: d.id,
    pregunta: d.texto,
    opciones: n(d.opciones_o_alternativa),
    opcion_por_defecto: n(d.por_defecto_o_quien),
    antes_de: n(d.antes_de),
    fecha_limite: n(extraDecision[d.id]?.fecha_limite),
    estado: 'abierta',
    decision: null,
    decidida_en: null,
    // Las «para Gabriel» son de Boosty: nunca las lee Iberia.
    solo_equipo: true,
    orden: i + 1,
  }))

sinDinero('fase', fases, ['nombre', 'periodo_texto', 'contiene', 'criterio_salida', 'situacion'])
sinDinero('hito', hitos, ['titulo', 'dueno'])
sinDinero('pendiente', pendientes, ['titulo', 'detalle', 'dueno_cargo', 'bloquea', 'fecha_texto'])

// Lo construido, la frontera y el dueño de cada módulo (solo esas columnas: el
// estado lo pone la migración y después se edita en la plataforma).
const construido = semilla.modulos ?? {}
const modulos = modulosCsv.map((m) => ({ codigo: m.codigo, frontera: n(m.frontera), dueno: n(m.dueno), construido: n(construido[m.codigo]) }))
for (const codigo of Object.keys(construido)) if (!modulos.some((m) => m.codigo === codigo)) modulos.push({ codigo, frontera: null, dueno: null, construido: construido[codigo] })
sinDinero('modulo', modulos.map((m) => ({ ...m, clave: m.codigo })), ['construido'])

async function existentes(tabla, clave) {
  const { data, error } = await db.schema('control').from(tabla).select('*').range(0, 999)
  if (error) throw new Error(`control.${tabla}: ${error.message} (¿está aplicada la migración 20261121090000_hoja_de_ruta?)`)
  return new Map(data.map((r) => [r[clave], r]))
}

async function cargar(tabla, clave, filas) {
  const hay = await existentes(tabla, clave)
  const nuevas = filas.filter((f) => !hay.has(f[clave]))
  const viejas = filas.filter((f) => hay.has(f[clave]))
  const sobran = [...hay.keys()].filter((k) => !filas.some((f) => f[clave] === k))
  const escribir = PISAR ? filas : nuevas
  // Sin --pisar, lo que ya está solo se completa: un campo vacío en la base toma
  // el del archivo (las fases nacen en la migración con lo mínimo). Lo que tiene
  // valor no se toca: puede venir de la plataforma.
  const completar = PISAR
    ? []
    : viejas
        .map((f) => {
          const base = hay.get(f[clave])
          const cambio = {}
          for (const [k, v] of Object.entries(f)) {
            if (k === clave || v === null || v === undefined) continue
            if (k === 'actual') {
              if (v && ![...hay.values()].some((r) => r.actual)) cambio.actual = true
            } else if (base[k] === null) cambio[k] = v
          }
          return Object.keys(cambio).length ? { k: f[clave], cambio } : null
        })
        .filter(Boolean)
  console.log(
    `  control.${tabla}: ${nuevas.length} nuevas · ${viejas.length} ya estaban${PISAR ? ' (se reescriben)' : ` (${completar.length} se completan, el resto no se toca)`}${sobran.length ? ` · en la base y no en el archivo: ${sobran.join(', ')}` : ''}`
  )
  if (REVISAR) return
  for (const { k, cambio } of completar) {
    const { error } = await db.schema('control').from(tabla).update(cambio).eq(clave, k)
    if (error) throw new Error(`control.${tabla} ${k}: ${error.message}`)
  }
  if (!escribir.length) return
  // La fase actual es única: con --pisar se apaga antes la que hubiera.
  if (tabla === 'fase_plataforma' && escribir.some((f) => f.actual)) {
    const { error } = await db.schema('control').from(tabla).update({ actual: false }).eq('actual', true).not('clave', 'in', `(${escribir.filter((f) => f.actual).map((f) => f.clave).join(',')})`)
    if (error) throw new Error(`control.${tabla}: ${error.message}`)
  }
  const { error } = await db.schema('control').from(tabla).upsert(escribir, { onConflict: clave, ignoreDuplicates: !PISAR })
  if (error) throw new Error(`control.${tabla}: ${error.message}`)
}

console.log('Hoja de ruta…')
await cargar('fase_plataforma', 'clave', fases)
await cargar('hito_plataforma', 'clave', hitos)
await cargar('pendiente_plataforma', 'clave', pendientes)
await cargar('decision_plataforma', 'codigo', decisiones)

// Los módulos ya existen (los siembra `importar-base.mjs`): solo se completan.
const { data: enBase, error: errMod } = await db.schema('control').from('modulo').select('codigo, frontera, dueno, construido')
if (errMod) throw new Error(`control.modulo: ${errMod.message}`)
const porCodigo = new Map(enBase.map((m) => [m.codigo, m]))
let cambiados = 0
const faltan = []
for (const m of modulos) {
  const actual = porCodigo.get(m.codigo)
  if (!actual) { faltan.push(m.codigo); continue }
  const cambio = {}
  for (const c of ['frontera', 'dueno', 'construido']) {
    if (m[c] !== null && (PISAR || actual[c] === null) && actual[c] !== m[c]) cambio[c] = m[c]
  }
  if (!Object.keys(cambio).length) continue
  cambiados++
  if (REVISAR) continue
  const { error } = await db.schema('control').from('modulo').update(cambio).eq('codigo', m.codigo)
  if (error) throw new Error(`control.modulo ${m.codigo}: ${error.message}`)
}
console.log(`  control.modulo: ${cambiados} completados${faltan.length ? ` · no están en la base: ${faltan.join(', ')} (correr importar-base.mjs)` : ''}`)

if (!REVISAR) {
  const contar = async (t) => (await db.schema('control').from(t).select('*', { count: 'exact', head: true })).count
  console.log(`Listo: ${await contar('fase_plataforma')} fases · ${await contar('hito_plataforma')} hitos · ${await contar('pendiente_plataforma')} pendientes · ${await contar('decision_plataforma')} decisiones.`)
}
