import type { createClient } from '@/lib/supabase/server'

/**
 * Lectura de la estructura para las pantallas de Organización (NUC-ORG).
 *
 * Todo sale de las tablas versionadas: unidades, plazas y ocupaciones con su
 * vigencia, filtradas «a la fecha». Las cuentas (dotación, ocupadas, vacantes,
 * por encima) se hacen aquí, una vez, para que el organigrama, la ficha de la
 * unidad y el tablero de dotación digan lo mismo.
 *
 * Del padrón solo se lee nombre, ficha y cargo: el organigrama no lleva datos
 * de contacto (cap. 05 §6.2, riesgo de datos personales).
 */

export type Cliente = Awaited<ReturnType<typeof createClient>>

// -----------------------------------------------------------------------------
// Fechas: siempre con la hora de Caracas
// -----------------------------------------------------------------------------

/** Hoy en Caracas, `AAAA-MM-DD`. */
export function hoyCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
}

/** La fecha de la consulta si es válida; si no, hoy. */
export function fechaDe(valor: unknown): string {
  const v = typeof valor === 'string' ? valor : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : hoyCaracas()
}

/** `2026-11-20` → «20 nov 2026», leída al mediodía de Caracas (sin el corrimiento de UTC). */
export function fmtFecha(fecha: string | null | undefined, largo = false): string {
  if (!fecha) return '—'
  const d = new Date(`${fecha.slice(0, 10)}T12:00:00-04:00`)
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: largo ? 'long' : 'short',
    year: 'numeric',
  }).format(d)
}

export function fmtMomento(ts: string | null | undefined): string {
  if (!ts) return '—'
  return new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ts))
}

export type Rango = { desde: string | null; hasta: string | null; vacia: boolean }

/** `[2026-01-01,2026-11-20)` → { desde, hasta }. `hasta` es exclusivo: el día en que deja de regir. */
export function rango(v: unknown): Rango {
  const s = typeof v === 'string' ? v : ''
  if (!s || s === 'empty') return { desde: null, hasta: null, vacia: true }
  const m = s.match(/^[[(]([^,]*),([^\])]*)[\])]$/)
  if (!m) return { desde: null, hasta: null, vacia: false }
  const limpio = (x: string) => x.replace(/"/g, '').trim() || null
  return { desde: limpio(m[1]), hasta: limpio(m[2]), vacia: false }
}

/** El filtro PostgREST «vigente en esta fecha»: el rango contiene el día. */
export const VIGENTE_EN = (fecha: string) => `[${fecha},${fecha}]`

// -----------------------------------------------------------------------------
// Números
// -----------------------------------------------------------------------------

const ENTERO = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 })
const MONEDA = new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtEntero = (n: number) => ENTERO.format(n)
export const fmtBs = (n: number) => `Bs ${MONEDA.format(n)}`
export const fmtUsd = (n: number) => `USD ${MONEDA.format(n)}`
export const fmtNumero = (n: number) => MONEDA.format(n)

// -----------------------------------------------------------------------------
// Lectura paginada: Supabase corta en 1.000 filas y no avisa
// -----------------------------------------------------------------------------

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

export async function todas<T>(pedir: (desde: number, hasta: number) => Pagina<T>): Promise<T[]> {
  const PASO = 1000
  const salida: T[] = []
  for (let desde = 0; ; desde += PASO) {
    const { data, error } = await pedir(desde, desde + PASO - 1)
    if (error) throw new Error(error.message)
    salida.push(...(data ?? []))
    if (!data || data.length < PASO) break
  }
  return salida
}

// -----------------------------------------------------------------------------
// Catálogos
// -----------------------------------------------------------------------------

export type Opcion = { clave: string; etiqueta: string; activo: boolean }
export type Catalogos = Record<'tipo_unidad' | 'tipo_nomina' | 'sede' | 'estado_plaza' | 'tipo_ocupacion' | 'familia_cargo', Opcion[]>

export async function leerCatalogos(supabase: Cliente): Promise<Catalogos> {
  const { data } = await supabase
    .schema('control')
    .from('catalogo')
    .select('tipo, clave, etiqueta, activo, orden')
    .in('tipo', ['tipo_unidad', 'tipo_nomina', 'sede', 'estado_plaza', 'tipo_ocupacion', 'familia_cargo'])
    .order('orden')
  const c: Catalogos = { tipo_unidad: [], tipo_nomina: [], sede: [], estado_plaza: [], tipo_ocupacion: [], familia_cargo: [] }
  for (const f of data ?? []) c[f.tipo as keyof Catalogos]?.push({ clave: f.clave, etiqueta: f.etiqueta, activo: f.activo })
  return c
}

export function etiquetaDe(lista: Opcion[], clave: string | null | undefined, vacio = 'Sin definir'): string {
  if (!clave) return vacio
  return lista.find((o) => o.clave === clave)?.etiqueta ?? clave
}

// -----------------------------------------------------------------------------
// La estructura a una fecha
// -----------------------------------------------------------------------------

export type Unidad = {
  id: string
  ref: string
  clave: string
  nombre: string
  tipo: string
  padre_ref: string | null
  sede: string | null
  orden: number
  certeza: string
  codigo_organigrama: string | null
  nota: string | null
  vigencia: unknown
}

export type Plaza = {
  id: string
  ref: string
  unidad_ref: string
  cargo_id: string
  reporta_a_ref: string | null
  dotacion: number
  tipo_nomina: string | null
  sede: string | null
  estado: string
  certeza: string
  nota: string | null
  vigencia: unknown
}

export type Ocupante = {
  id: string
  empleado_id: string
  nombre: string
  ficha: string | null
  tipo: string
  excede: boolean
  certeza: string
  desde: string | null
  hasta: string | null
  motivo: string | null
}

export type PlazaVista = Plaza & {
  cargo: string
  familia: string | null
  sedeEfectiva: string | null
  ocupantes: Ocupante[]
  titulares: number
  vacantes: number
  porEncima: number
}

export type Totales = { plazas: number; dotacion: number; ocupadas: number; vacantes: number; porEncima: number }

export type Nodo = {
  unidad: Unidad
  profundidad: number
  ruta: string[]
  sedeEfectiva: string | null
  plazas: PlazaVista[]
  hijos: Nodo[]
  propio: Totales
  total: Totales
  /** Los totales con los filtros puestos (los llena `filtrar`). */
  visibleTotal: Totales
}

export type Estructura = {
  fecha: string
  unidades: Map<string, Unidad>
  plazas: Map<string, PlazaVista>
  cargos: Map<string, { id: string; nombre: string; familia: string | null; activo: boolean }>
  raices: Nodo[]
  nodos: Map<string, Nodo>
}

const CERO = (): Totales => ({ plazas: 0, dotacion: 0, ocupadas: 0, vacantes: 0, porEncima: 0 })

function sumar(a: Totales, b: Totales) {
  a.plazas += b.plazas
  a.dotacion += b.dotacion
  a.ocupadas += b.ocupadas
  a.vacantes += b.vacantes
  a.porEncima += b.porEncima
}

export function totalesDe(plazas: PlazaVista[]): Totales {
  const t = CERO()
  for (const p of plazas) {
    t.plazas += 1
    t.dotacion += p.dotacion
    t.ocupadas += p.titulares
    t.vacantes += p.vacantes
    t.porEncima += p.porEncima
  }
  return t
}

export async function leerEstructura(supabase: Cliente, fecha: string): Promise<Estructura> {
  const org = supabase.schema('org')
  const [unidades, plazas, cargos, ocupaciones, empleados] = await Promise.all([
    todas<Unidad>((a, b) =>
      org
        .from('unidad')
        .select('id, ref, clave, nombre, tipo, padre_ref, sede, orden, certeza, codigo_organigrama, nota, vigencia')
        .is('escenario_id', null)
        .filter('vigencia', 'cs', VIGENTE_EN(fecha))
        .order('orden')
        .order('nombre')
        .range(a, b),
    ),
    todas<Plaza>((a, b) =>
      org
        .from('plaza')
        .select('id, ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, tipo_nomina, sede, estado, certeza, nota, vigencia')
        .is('escenario_id', null)
        .filter('vigencia', 'cs', VIGENTE_EN(fecha))
        .range(a, b),
    ),
    todas((a, b) => org.from('cargo').select('id, nombre, familia, activo').order('nombre').range(a, b)),
    todas((a, b) =>
      org
        .from('ocupacion')
        .select('id, plaza_ref, empleado_id, tipo, excede_dotacion, certeza, vigencia, motivo')
        .filter('vigencia', 'cs', VIGENTE_EN(fecha))
        .range(a, b),
    ),
    leerNombres(supabase),
  ])

  const mapaCargos = new Map(cargos.map((c) => [c.id, c]))
  const mapaUnidades = new Map(unidades.map((u) => [u.ref, u]))

  // La sede se hereda: una jefatura sin sede propia está donde está su gerencia.
  const sedeDe = (ref: string | null, guardia = 0): string | null => {
    const u = ref ? mapaUnidades.get(ref) : undefined
    if (!u || guardia > 20) return null
    return u.sede ?? sedeDe(u.padre_ref, guardia + 1)
  }

  const porPlaza = new Map<string, Ocupante[]>()
  for (const o of ocupaciones) {
    const r = rango(o.vigencia)
    const e = empleados.get(o.empleado_id)
    const lista = porPlaza.get(o.plaza_ref) ?? []
    lista.push({
      id: o.id,
      empleado_id: o.empleado_id,
      nombre: e?.nombre ?? 'Persona fuera del padrón activo',
      ficha: e?.ficha ?? null,
      tipo: o.tipo,
      excede: o.excede_dotacion,
      certeza: o.certeza,
      desde: r.desde,
      hasta: r.hasta,
      motivo: o.motivo,
    })
    porPlaza.set(o.plaza_ref, lista)
  }

  const mapaPlazas = new Map<string, PlazaVista>()
  for (const p of plazas) {
    const ocupantes = (porPlaza.get(p.ref) ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    const titulares = ocupantes.filter((o) => o.tipo === 'titular').length
    const cargo = mapaCargos.get(p.cargo_id)
    mapaPlazas.set(p.ref, {
      ...p,
      cargo: cargo?.nombre ?? 'Cargo sin nombre',
      familia: cargo?.familia ?? null,
      sedeEfectiva: p.sede ?? sedeDe(p.unidad_ref),
      ocupantes,
      titulares,
      vacantes: Math.max(0, p.dotacion - titulares),
      porEncima: Math.max(0, titulares - p.dotacion),
    })
  }

  // El árbol. Primero quien encabeza (la plaza que no reporta dentro de la unidad), luego por cargo.
  const nodos = new Map<string, Nodo>()
  for (const u of unidades) {
    const propias = [...mapaPlazas.values()].filter((p) => p.unidad_ref === u.ref)
    const refs = new Set(propias.map((p) => p.ref))
    propias.sort((a, b) => {
      const ja = a.reporta_a_ref && refs.has(a.reporta_a_ref) ? 1 : 0
      const jb = b.reporta_a_ref && refs.has(b.reporta_a_ref) ? 1 : 0
      return ja - jb || a.cargo.localeCompare(b.cargo, 'es')
    })
    nodos.set(u.ref, {
      unidad: u,
      profundidad: 0,
      ruta: [],
      sedeEfectiva: sedeDe(u.ref),
      plazas: propias,
      hijos: [],
      propio: totalesDe(propias),
      total: CERO(),
      visibleTotal: CERO(),
    })
  }
  const raices: Nodo[] = []
  for (const n of nodos.values()) {
    const padre = n.unidad.padre_ref ? nodos.get(n.unidad.padre_ref) : undefined
    if (padre) padre.hijos.push(n)
    else raices.push(n)
  }
  const ordenar = (lista: Nodo[]) =>
    lista.sort((a, b) => a.unidad.orden - b.unidad.orden || a.unidad.nombre.localeCompare(b.unidad.nombre, 'es'))
  const recorrer = (n: Nodo, profundidad: number, ruta: string[]) => {
    n.profundidad = profundidad
    n.ruta = ruta
    ordenar(n.hijos)
    sumar(n.total, n.propio)
    for (const h of n.hijos) {
      recorrer(h, profundidad + 1, [...ruta, n.unidad.ref])
      sumar(n.total, h.total)
    }
  }
  ordenar(raices)
  for (const r of raices) recorrer(r, 0, [])

  return { fecha, unidades: mapaUnidades, plazas: mapaPlazas, cargos: mapaCargos, raices, nodos }
}

/** Nombre y ficha del padrón activo: lo único que el organigrama muestra de una persona. */
export async function leerNombres(supabase: Cliente) {
  const filas = await todas((a, b) =>
    supabase.from('empleados').select('id, nombre_completo, ficha').eq('activo', true).range(a, b),
  )
  return new Map(filas.map((e) => [e.id, { nombre: e.nombre_completo, ficha: e.ficha }]))
}

/** Los nodos en orden de lectura (padre, hijos), con su profundidad. */
export function aplanar(raices: Nodo[]): Nodo[] {
  const salida: Nodo[] = []
  const ir = (n: Nodo) => {
    salida.push(n)
    n.hijos.forEach(ir)
  }
  raices.forEach(ir)
  return salida
}

/** La dirección (o dirección general) que contiene a una unidad; lo de más arriba es su propia dirección. */
export function direccionDe(e: Estructura, ref: string): string {
  let actual = e.unidades.get(ref)
  let guardia = 0
  while (actual && guardia++ < 20) {
    if (actual.tipo === 'direccion' || actual.tipo === 'direccion_general' || !actual.padre_ref) return actual.ref
    const padre = e.unidades.get(actual.padre_ref)
    if (!padre) return actual.ref
    actual = padre
  }
  return ref
}

/** Nombre de una plaza para un selector: «Cargo · Unidad». */
export function nombrePlaza(e: Estructura, ref: string | null | undefined): string {
  if (!ref) return 'Sin plaza superior'
  const p = e.plazas.get(ref)
  if (!p) return 'Plaza fuera de la estructura vigente'
  return `${p.cargo} · ${e.unidades.get(p.unidad_ref)?.nombre ?? '—'}`
}

/** Traduce el rechazo de la base a algo legible. Los mensajes de las funciones ya vienen en español. */
export function mensajeDeError(error: { message: string; code?: string } | null | undefined): string {
  if (!error) return 'No se pudo guardar.'
  if (error.code === '23P01') return 'Se cruza con otra versión vigente en ese período. Revisa la fecha.'
  if (error.code === '23505') return 'Ya existe un registro con esos datos.'
  if (/row-level security|permission denied/i.test(error.message)) return 'Tu rol no tiene permiso para este cambio.'
  return error.message
}

/**
 * Con filtros, qué plazas pasan y qué unidades quedan (las que tienen alguna
 * plaza que pasa, en sí mismas o debajo). Deja en cada nodo sus totales filtrados.
 */
export function filtrar(e: Estructura, pasa: (p: PlazaVista) => boolean) {
  const plazas = new Set<string>()
  const unidades = new Set<string>()
  const ir = (n: Nodo): Totales => {
    const propias = n.plazas.filter(pasa)
    propias.forEach((p) => plazas.add(p.ref))
    const t = totalesDe(propias)
    for (const h of n.hijos) sumar(t, ir(h))
    n.visibleTotal = t
    if (t.plazas > 0) unidades.add(n.unidad.ref)
    return t
  }
  e.raices.forEach(ir)
  return { plazas, unidades }
}
