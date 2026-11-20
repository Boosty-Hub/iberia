import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { TipoFicha } from '@/lib/plataforma/ficha-tipos'
import { plano } from '@/lib/plataforma/formato'
import type { ContextoGlobal } from '@/lib/plataforma/servidor'
import type { Columna, EstadoTabla } from '@/lib/plataforma/tabla'

/**
 * El lado servidor de `TablaDatos`: una **fuente** dice qué consulta, con qué
 * columnas y con qué permiso; aquí se le aplican filtros, orden y rango, y se
 * calculan los totales y los grupos sobre **todo lo filtrado**, paginando de mil
 * en mil (Supabase corta en 1.000 sin avisar: AGENTS.md, «Trampas»). Todo con la
 * sesión de quien mira: la RLS decide qué filas existen.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>
// El constructor de PostgREST cambia de tipo con cada filtro; aquí se trata como
// una cadena de métodos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Consulta = any

export type FuenteTabla = {
  id: string
  titulo: string
  /** El código del módulo (`control.modulo`): ahí se listan sus vistas. */
  modulo: string
  recurso: string
  accion?: 'ver' | 'crear'
  ruta: string
  columnas: Columna[]
  /** La columna que identifica la fila. */
  claveFila: string
  /** Qué ficha abre la fila (`?ficha=tipo:valor`). */
  ficha?: { tipo: TipoFicha; columna: string }
  /** Una columna ya «plana» (sin tildes, minúsculas) para buscar texto. */
  busqueda?: string
  orden: { columna: string; dir: 'asc' | 'desc' }
  /** Filas por página si la URL no dice (por defecto 50). */
  tamano?: number
  /**
   * Fuentes chicas y caras (una función que arma todo el árbol, como
   * `ui.procesos`): se leen **una sola vez por petición** y se filtran, ordenan
   * y paginan en memoria. Sin esto, la página, los totales y las opciones de los
   * filtros pedían la función tres veces por render.
   */
  enMemoria?: boolean
  /** La consulta base, con el contexto (fecha, escenario) ya aplicado. */
  consulta: (supabase: Cliente, ctx: ContextoGlobal, select: string, opciones?: { count?: 'exact' }) => Consulta
}

const TOPE_ESCANEO = 20_000
const LOTE = 1000

function seleccion(f: FuenteTabla, extra: string[] = []): string {
  const cols = new Set([f.claveFila, ...(f.ficha ? [f.ficha.columna] : []), ...extra])
  for (const c of f.columnas) {
    cols.add(c.clave)
    if (c.etiquetaDe) cols.add(c.etiquetaDe)
  }
  return [...cols].join(',')
}

function filtrar(q: Consulta, f: FuenteTabla, e: EstadoTabla): Consulta {
  for (const [col, vals] of Object.entries(e.filtros)) {
    const nulos = vals.includes('∅')
    const resto = vals.filter((v) => v !== '∅')
    if (nulos && resto.length) q = q.or(`${col}.is.null,${col}.in.(${resto.map((v) => `"${v.replace(/"/g, '')}"`).join(',')})`)
    else if (nulos) q = q.is(col, null)
    else if (resto.length === 1) q = q.eq(col, resto[0])
    else q = q.in(col, resto)
  }
  if (e.q && f.busqueda) q = q.like(f.busqueda, `%${plano(e.q).replace(/[%_]/g, '')}%`)
  return q
}

function ordenar(q: Consulta, f: FuenteTabla, e: EstadoTabla): Consulta {
  if (e.agrupar) q = q.order(e.agrupar, { ascending: true, nullsFirst: false })
  const col = e.orden ?? f.orden.columna
  const dir = e.orden ? e.dir : f.orden.dir
  q = q.order(col, { ascending: dir === 'asc', nullsFirst: false })
  if (col !== f.claveFila) q = q.order(f.claveFila, { ascending: true })
  return q
}

export type Fila = Record<string, unknown>

// -----------------------------------------------------------------------------
// Fuentes en memoria: una lectura por petición
// -----------------------------------------------------------------------------
const lecturas = cache(() => new Map<string, Promise<Fila[]>>())

/** Todas las filas de una fuente `enMemoria`, leídas una vez por petición (y contexto). */
function filasDe(f: FuenteTabla, ctx: ContextoGlobal): Promise<Fila[]> {
  const mapa = lecturas()
  const k = `${f.id}|${ctx.al}|${ctx.esc ?? ''}`
  let p = mapa.get(k)
  if (!p) {
    p = (async () => {
      const supabase = await createClient()
      const { filas } = await escanear((d, h) => f.consulta(supabase, ctx, '*').order(f.claveFila).range(d, h))
      return filas
    })()
    mapa.set(k, p)
  }
  return p
}

const comoTexto = (v: unknown) => (v === null || v === undefined ? '∅' : String(v))

/** Los mismos filtros de `filtrar()`, en memoria. */
function filtrarEnMemoria(filas: Fila[], f: FuenteTabla, e: EstadoTabla): Fila[] {
  const texto = e.q && f.busqueda ? plano(e.q).replace(/[%_]/g, '') : ''
  return filas.filter((r) => {
    for (const [col, vals] of Object.entries(e.filtros)) if (!vals.includes(comoTexto(r[col]))) return false
    if (texto && !String(r[f.busqueda!] ?? '').includes(texto)) return false
    return true
  })
}

function comparar(a: unknown, b: unknown): number {
  const na = a === null || a === undefined
  const nb = b === null || b === undefined
  if (na || nb) return na === nb ? 0 : na ? 1 : -1 // los vacíos, al final (como nullsFirst: false)
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), 'es', { numeric: true })
}

/** El mismo orden de `ordenar()`, en memoria. */
function ordenarEnMemoria(filas: Fila[], f: FuenteTabla, e: EstadoTabla): Fila[] {
  const col = e.orden ?? f.orden.columna
  const sentido = (e.orden ? e.dir : f.orden.dir) === 'asc' ? 1 : -1
  const vacio = (v: unknown) => v === null || v === undefined
  return [...filas].sort((a, b) => {
    if (e.agrupar) {
      const g = comparar(a[e.agrupar], b[e.agrupar])
      if (g) return g
    }
    const x = a[col]
    const y = b[col]
    // Los vacíos van al final en los dos sentidos.
    const c = vacio(x) || vacio(y) ? comparar(x, y) : comparar(x, y) * sentido
    return c || comparar(a[f.claveFila], b[f.claveFila])
  })
}

/** Una página de la tabla, con el conteo exacto del total filtrado. */
export async function consultarPagina(f: FuenteTabla, e: EstadoTabla, ctx: ContextoGlobal) {
  if (f.enMemoria) {
    const todas = ordenarEnMemoria(filtrarEnMemoria(await filasDe(f, ctx), f, e), f, e)
    const desde = (e.pagina - 1) * e.tamano
    return { filas: todas.slice(desde, desde + e.tamano), total: todas.length, error: null }
  }
  const supabase = await createClient()
  const desde = (e.pagina - 1) * e.tamano
  let q = f.consulta(supabase, ctx, seleccion(f), { count: 'exact' })
  q = ordenar(filtrar(q, f, e), f, e).range(desde, desde + e.tamano - 1)
  const { data, count, error } = await q
  return { filas: (data ?? []) as Fila[], total: (count as number | null) ?? 0, error: error ? String(error.message) : null }
}

/** Recorre todo lo que devuelve una consulta, de mil en mil, hasta el tope. */
async function escanear(hacer: (desde: number, hasta: number) => Consulta): Promise<{ filas: Fila[]; cortado: boolean }> {
  const filas: Fila[] = []
  for (let desde = 0; desde < TOPE_ESCANEO; desde += LOTE) {
    const { data, error } = await hacer(desde, desde + LOTE - 1)
    if (error || !data) break
    filas.push(...(data as Fila[]))
    if (data.length < LOTE) return { filas, cortado: false }
  }
  return { filas, cortado: filas.length >= TOPE_ESCANEO }
}

export type Resumen = {
  totales: Record<string, number>
  grupos: Record<string, { n: number; sumas: Record<string, number> }>
  opciones: Record<string, { valor: string; etiqueta: string; n: number }[]>
}

/**
 * Totales y grupos sobre todo lo filtrado, y las opciones de cada filtro (sobre
 * todo lo que la sesión puede leer, para que un filtro no esconda sus hermanos).
 */
export async function resumir(f: FuenteTabla, e: EstadoTabla, ctx: ContextoGlobal): Promise<Resumen> {
  const supabase = await createClient()
  const conTotal = f.columnas.filter((c) => c.total).map((c) => c.clave)
  const filtrables = f.columnas.filter((c) => c.filtrable)
  const resumen: Resumen = { totales: {}, grupos: {}, opciones: {} }

  // Para sumar no hace falta el orden de la vista, solo uno estable: el de la
  // clave (ordenar por una columna que no se pidió falla en una RPC).
  const necesitaFiltrado = conTotal.length > 0 || e.agrupar
  const enMemoria = f.enMemoria ? await filasDe(f, ctx) : null
  const [filtrado, todo] = enMemoria ? [{ filas: filtrarEnMemoria(enMemoria, f, e) }, { filas: enMemoria }] : await Promise.all([
    necesitaFiltrado
      ? escanear((d, h) => filtrar(f.consulta(supabase, ctx, [f.claveFila, ...conTotal, ...(e.agrupar ? [e.agrupar] : [])].join(',')), f, e).order(f.claveFila).range(d, h))
      : Promise.resolve({ filas: [] as Fila[], cortado: false }),
    filtrables.length
      ? escanear((d, h) =>
          f
            .consulta(supabase, ctx, [f.claveFila, ...filtrables.flatMap((c) => [c.clave, ...(c.etiquetaDe ? [c.etiquetaDe] : [])])].join(','))
            .order(f.claveFila)
            .range(d, h)
        )
      : Promise.resolve({ filas: [] as Fila[], cortado: false }),
  ])

  for (const c of conTotal) resumen.totales[c] = filtrado.filas.reduce((s, r) => s + (Number(r[c]) || 0), 0)
  if (e.agrupar) {
    for (const r of filtrado.filas) {
      const k = r[e.agrupar] === null || r[e.agrupar] === undefined ? '∅' : String(r[e.agrupar])
      const g = (resumen.grupos[k] ??= { n: 0, sumas: {} })
      g.n++
      for (const c of conTotal) g.sumas[c] = (g.sumas[c] ?? 0) + (Number(r[c]) || 0)
    }
  }
  for (const c of filtrables) {
    const mapa = new Map<string, { etiqueta: string; n: number }>()
    for (const r of todo.filas) {
      const v = r[c.clave] === null || r[c.clave] === undefined ? '∅' : String(r[c.clave])
      const et = v === '∅' ? 'Sin dato' : (c.etiquetas?.[v] ?? (c.etiquetaDe ? String(r[c.etiquetaDe] ?? v) : v))
      const x = mapa.get(v)
      if (x) x.n++
      else mapa.set(v, { etiqueta: et, n: 1 })
    }
    resumen.opciones[c.clave] = [...mapa.entries()].map(([valor, x]) => ({ valor, ...x })).sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
  }
  return resumen
}

/** Todas las filas filtradas y ordenadas, para exportar (hasta el tope). */
export async function todasLasFilas(f: FuenteTabla, e: EstadoTabla, ctx: ContextoGlobal) {
  if (f.enMemoria) return { filas: ordenarEnMemoria(filtrarEnMemoria(await filasDe(f, ctx), f, e), f, e), cortado: false }
  const supabase = await createClient()
  return escanear((d, h) => ordenar(filtrar(f.consulta(supabase, ctx, seleccion(f)), f, e), f, e).range(d, h))
}
