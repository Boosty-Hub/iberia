/**
 * Lo que comparten las pantallas de procesos y documentos (servidor y cliente):
 * el vocabulario, la forma de la ficha PHVA, la búsqueda sin tildes y la
 * comparación entre dos versiones de un proceso.
 *
 * ⚠️ Las etiquetas de tipo y estado operativo son **datos** (`control.catalogo`,
 * editable en Catálogos). Lo de aquí es solo el respaldo para quien no puede
 * leer el catálogo; las pantallas pasan el catálogo cuando lo tienen.
 */

import type { Tono } from '@/components/ui'

export const TIPOS: Record<string, string> = {
  estrategico: 'Estratégico',
  operativo: 'Operativo',
  soporte: 'Soporte',
}

export const ESTADOS_OPERATIVOS: Record<string, string> = {
  vigente: 'Se ejecuta',
  nuevo: 'No documentado',
  propuesto: 'Propuesto',
  no_se_ejecuta: 'No se ejecuta',
  sin_evidencia: 'Sin evidencia',
}

/** «Se ejecuta» es lo normal y no lleva insignia en el mapa; lo demás sí. */
export const TONO_ESTADO_OPERATIVO: Record<string, Tono> = {
  vigente: 'verde',
  nuevo: 'ambar',
  propuesto: 'marca',
  no_se_ejecuta: 'neutro',
  sin_evidencia: 'ambar',
}

export const ESTADOS_VERSION: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  aprobada: 'Aprobada, espera su fecha',
  vigente: 'Vigente',
  reemplazada: 'Reemplazada',
  retirada: 'Retirada',
}

export const TONO_VERSION: Record<string, Tono> = {
  borrador: 'ambar',
  en_revision: 'ambar',
  aprobada: 'marca',
  vigente: 'verde',
  reemplazada: 'neutro',
  retirada: 'neutro',
}

export const NIVELES: Record<number, string> = {
  0: 'Macroproceso',
  1: 'Proceso',
  2: 'Subproceso',
  3: 'Actividad',
}

/** Las familias del mapa, con el mismo color que el mapa de la Fase 1. */
export const FAMILIAS = [
  { tipo: 'estrategico', titulo: 'Estratégicos', rotulo: 'Orientan el rumbo', barra: 'bg-acento-500', texto: 'text-acento-700' },
  { tipo: 'operativo', titulo: 'Cadena de valor', rotulo: 'Producen y entregan', barra: 'bg-oro-500', texto: 'text-oro-800' },
  { tipo: 'soporte', titulo: 'Soporte', rotulo: 'Sostienen a los demás', barra: 'bg-marca-600', texto: 'text-marca-800' },
] as const

export const ESTADOS_SOLICITUD: Record<string, string> = {
  en_curso: 'En curso',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  devuelta: 'Devuelta',
  cancelada: 'Cancelada',
}

export const DECISIONES: Record<string, string> = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  devuelto: 'Devuelto',
  omitido: 'No aplica',
}

export const TONO_DECISION: Record<string, Tono> = {
  pendiente: 'ambar',
  aprobado: 'verde',
  rechazado: 'rojo',
  devuelto: 'ambar',
  omitido: 'neutro',
}

export const ESTADOS_ESCENARIO: Record<string, string> = {
  borrador: 'En edición',
  en_aprobacion: 'En aprobación',
  aprobado: 'Aprobado',
  publicado: 'Publicado',
  descartado: 'Descartado',
}

export const TONO_ESCENARIO: Record<string, Tono> = {
  borrador: 'ambar',
  en_aprobacion: 'ambar',
  aprobado: 'marca',
  publicado: 'verde',
  descartado: 'neutro',
}

export const ESTADOS_DOCUMENTO: Record<string, string> = {
  vigente: 'Vigente',
  obsoleto: 'Obsoleto',
  borrador: 'Borrador',
  sin_determinar: 'Sin determinar',
  retirado: 'Retirado',
}

export const TONO_DOCUMENTO: Record<string, Tono> = {
  vigente: 'verde',
  obsoleto: 'neutro',
  borrador: 'ambar',
  sin_determinar: 'ambar',
  retirado: 'neutro',
}

export const DESTINOS_DOCUMENTO: Record<string, string> = {
  formulario: 'Formulario de la plataforma',
  funcion: 'Función del sistema',
  vista_espejo: 'Vista del espejo de JD',
  no_migra: 'No migra',
}

export const PERIMETROS: Record<string, string> = {
  general: 'General',
  nomina: 'Nómina',
  medico: 'Servicio médico',
  pcp: 'Prevención y Control de Pérdidas',
  formulas: 'Fórmulas',
}

export const TIPOS_CRUCE: Record<string, string> = {
  equivalente: 'Equivalente',
  contiene: 'Contiene',
  parcial: 'Parcial',
  sin_par: 'Sin par',
}

// -----------------------------------------------------------------------------
// La ficha PHVA
// -----------------------------------------------------------------------------

export type Indicador = { nombre: string; formula: string | null; meta: string | null; frecuencia: string | null }

export type Ficha = {
  origen: { codigo: string | null; anio: number | null; archivo: string | null; calidad: string | null } | null
  objetivo: string
  alcance: string
  proveedores: string[]
  entradas: string[]
  actividades: { planificar: string[]; hacer: string[]; verificar: string[]; actuar: string[] }
  salidas: string[]
  clientes: string[]
  recursos: string[]
  documentos: string[]
  registros: string[]
  indicadores: Indicador[]
  requisitos: string[]
  riesgos: string[]
  oportunidades: string[]
  dueno_segun_ficha: string | null
  nota_ficha: string | null
}

/** Las listas simples de la ficha, en el orden en que se leen. */
export const LISTAS_FICHA = [
  ['proveedores', 'Proveedores'],
  ['entradas', 'Entradas'],
  ['salidas', 'Salidas'],
  ['clientes', 'Clientes'],
  ['recursos', 'Recursos'],
  ['documentos', 'Documentos que usa'],
  ['registros', 'Registros'],
  ['requisitos', 'Requisitos legales y técnicos'],
  ['riesgos', 'Riesgos'],
  ['oportunidades', 'Oportunidades'],
] as const

export type ListaFicha = (typeof LISTAS_FICHA)[number][0]

export const FASES_PHVA = [
  ['planificar', 'Planificar'],
  ['hacer', 'Hacer'],
  ['verificar', 'Verificar'],
  ['actuar', 'Actuar'],
] as const

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' ? x : x == null ? '' : String(x))).map((x) => x.trim()).filter(Boolean)
}

function textoONulo(v: unknown): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t ? t : null
}

/** Cualquier JSON de la base → una ficha con todos sus campos (vacíos si no vienen). */
export function normalizarFicha(json: unknown): Ficha {
  const f = (json && typeof json === 'object' && !Array.isArray(json) ? json : {}) as Record<string, unknown>
  const act = (f.actividades && typeof f.actividades === 'object' ? f.actividades : {}) as Record<string, unknown>
  const o = (f.origen && typeof f.origen === 'object' ? f.origen : null) as Record<string, unknown> | null
  return {
    origen: o
      ? {
          codigo: textoONulo(o.codigo),
          anio: typeof o.anio === 'number' ? o.anio : o.anio ? Number(o.anio) || null : null,
          archivo: textoONulo(o.archivo),
          calidad: textoONulo(o.calidad),
        }
      : null,
    objetivo: textoONulo(f.objetivo) ?? '',
    alcance: textoONulo(f.alcance) ?? '',
    proveedores: lista(f.proveedores),
    entradas: lista(f.entradas),
    actividades: {
      planificar: lista(act.planificar),
      hacer: lista(act.hacer),
      verificar: lista(act.verificar),
      actuar: lista(act.actuar),
    },
    salidas: lista(f.salidas),
    clientes: lista(f.clientes),
    recursos: lista(f.recursos),
    documentos: lista(f.documentos),
    registros: lista(f.registros),
    indicadores: Array.isArray(f.indicadores)
      ? f.indicadores
          .map((i) => {
            const x = (i && typeof i === 'object' ? i : { nombre: i }) as Record<string, unknown>
            return {
              nombre: textoONulo(x.nombre) ?? '',
              formula: textoONulo(x.formula),
              meta: textoONulo(x.meta),
              frecuencia: textoONulo(x.frecuencia),
            }
          })
          .filter((i) => i.nombre)
      : [],
    requisitos: lista(f.requisitos),
    riesgos: lista(f.riesgos),
    oportunidades: lista(f.oportunidades),
    dueno_segun_ficha: textoONulo(f.dueno_segun_ficha) ?? textoONulo(f.dueno),
    nota_ficha: textoONulo(f.nota_ficha) ?? textoONulo(f.nota),
  }
}

export function fichaVacia(f: Ficha): boolean {
  return (
    !f.objetivo &&
    !f.alcance &&
    !f.indicadores.length &&
    LISTAS_FICHA.every(([k]) => !f[k].length) &&
    FASES_PHVA.every(([k]) => !f.actividades[k].length)
  )
}

// -----------------------------------------------------------------------------
// Texto y fechas
// -----------------------------------------------------------------------------

/** «Gestión» → «gestion»: para buscar sin que importen tildes ni mayúsculas. */
export function plano(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Todas las palabras de la búsqueda aparecen en el texto, en cualquier orden. */
export function coincide(texto: string, busqueda: string): boolean {
  const t = plano(texto)
  return plano(busqueda)
    .split(/\s+/)
    .filter(Boolean)
    .every((p) => t.includes(p))
}

const FECHA = new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', day: '2-digit', month: 'short', year: 'numeric' })
const FECHA_HORA = new Intl.DateTimeFormat('es-VE', {
  timeZone: 'America/Caracas',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/** Una fecha `aaaa-mm-dd` de la base: se lee como mediodía para que ningún huso la corra. */
export function fecha(d: string | null | undefined): string {
  if (!d) return '—'
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : d
  return FECHA.format(new Date(iso))
}

export function fechaHora(d: string | null | undefined): string {
  if (!d) return '—'
  return FECHA_HORA.format(new Date(d))
}

/** Hoy en Caracas, `aaaa-mm-dd`. */
export function hoy(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
}

/** `[2026-01-01,2026-11-20)` → «desde 01 ene 2026 hasta 20 nov 2026». */
export function vigenciaTexto(rango: unknown): string {
  if (typeof rango !== 'string' || !rango || rango === 'empty') return 'Sin vigencia'
  const m = rango.match(/^[[(]([^,]*),([^\])]*)[\])]$/)
  if (!m) return rango
  const desde = m[1].replace(/"/g, '')
  const hasta = m[2].replace(/"/g, '')
  return hasta ? `Del ${fecha(desde)} al ${fecha(hasta)}` : `Desde el ${fecha(desde)}`
}

export function claveDe(nombre: string): string {
  const base =
    plano(nombre)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
      .replace(/-+$/, '') || 'proceso'
  return `${base}-${Math.random().toString(36).slice(2, 7)}`
}

// -----------------------------------------------------------------------------
// Comparar dos versiones
// -----------------------------------------------------------------------------

export type ProcesoComparable = {
  nombre: string
  tipo: string | null
  estado_operativo: string
  codigo_sgc: string | null
  codigo_informe: string | null
  padre_ref: string | null
  dueno_plaza_ref: string | null
  dueno_texto: string | null
  ficha: unknown
}

export type Diferencia = {
  campo: string
  antes?: string
  despues?: string
  agregados?: string[]
  quitados?: string[]
}

function difLista(campo: string, a: string[], b: string[]): Diferencia | null {
  const A = new Set(a)
  const B = new Set(b)
  const agregados = b.filter((x) => !A.has(x))
  const quitados = a.filter((x) => !B.has(x))
  if (!agregados.length && !quitados.length) {
    return a.join('\u0001') === b.join('\u0001') ? null : { campo, antes: 'Mismo contenido', despues: 'otro orden' }
  }
  return { campo, agregados, quitados }
}

/** Lo que cambia de `a` (vigente) a `b` (borrador). `nombres` traduce refs de padre y plaza. */
export function comparar(
  a: ProcesoComparable,
  b: ProcesoComparable,
  nombres: (tipo: 'proceso' | 'plaza', ref: string | null) => string,
): Diferencia[] {
  const d: Diferencia[] = []
  const simple = (campo: string, x: string | null | undefined, y: string | null | undefined) => {
    if ((x ?? '') !== (y ?? '')) d.push({ campo, antes: x || '—', despues: y || '—' })
  }
  simple('Nombre', a.nombre, b.nombre)
  simple('Tipo', TIPOS[a.tipo ?? ''] ?? a.tipo, TIPOS[b.tipo ?? ''] ?? b.tipo)
  simple('Estado operativo', ESTADOS_OPERATIVOS[a.estado_operativo] ?? a.estado_operativo, ESTADOS_OPERATIVOS[b.estado_operativo] ?? b.estado_operativo)
  simple('Código SGC', a.codigo_sgc, b.codigo_sgc)
  simple('Código del informe', a.codigo_informe, b.codigo_informe)
  if (a.padre_ref !== b.padre_ref) d.push({ campo: 'Cuelga de', antes: nombres('proceso', a.padre_ref), despues: nombres('proceso', b.padre_ref) })
  if (a.dueno_plaza_ref !== b.dueno_plaza_ref)
    d.push({ campo: 'Dueño (plaza)', antes: nombres('plaza', a.dueno_plaza_ref), despues: nombres('plaza', b.dueno_plaza_ref) })
  simple('Dueño (texto)', a.dueno_texto, b.dueno_texto)

  const fa = normalizarFicha(a.ficha)
  const fb = normalizarFicha(b.ficha)
  simple('Objetivo', fa.objetivo, fb.objetivo)
  simple('Alcance', fa.alcance, fb.alcance)
  for (const [k, etiqueta] of FASES_PHVA) {
    const x = difLista(`Actividades · ${etiqueta}`, fa.actividades[k], fb.actividades[k])
    if (x) d.push(x)
  }
  for (const [k, etiqueta] of LISTAS_FICHA) {
    const x = difLista(etiqueta, fa[k], fb[k])
    if (x) d.push(x)
  }
  const ind = (i: Indicador) => [i.nombre, i.formula && `fórmula: ${i.formula}`, i.meta && `meta: ${i.meta}`, i.frecuencia && `frecuencia: ${i.frecuencia}`].filter(Boolean).join(' · ')
  const x = difLista('Indicadores', fa.indicadores.map(ind), fb.indicadores.map(ind))
  if (x) d.push(x)
  simple('Nota de la ficha', fa.nota_ficha, fb.nota_ficha)
  return d
}

/** Los nodos en el orden en que se lee el árbol (padre, luego sus hijos), sangrados por nivel. */
export function enOrdenDeArbol<T extends { ref: string; padre_ref: string | null; orden: number }>(nodos: T[]): T[] {
  const hijos = new Map<string | null, T[]>()
  const refs = new Set(nodos.map((n) => n.ref))
  for (const n of nodos) {
    const padre = n.padre_ref && refs.has(n.padre_ref) ? n.padre_ref : null
    ;(hijos.get(padre) ?? hijos.set(padre, []).get(padre)!).push(n)
  }
  for (const l of hijos.values()) l.sort((a, b) => a.orden - b.orden)
  const salida: T[] = []
  const visitar = (padre: string | null, prof: number) => {
    if (prof > 8) return
    for (const n of hijos.get(padre) ?? []) {
      salida.push(n)
      visitar(n.ref, prof + 1)
    }
  }
  visitar(null, 0)
  return salida
}

/** Opción de un selector de procesos, sangrada por nivel (el espacio largo no colapsa en <option>). */
export function etiquetaSangrada(p: { nivel: number; codigo_sgc: string | null; nombre: string }): string {
  return `${' '.repeat(p.nivel)}${p.codigo_sgc ? `${p.codigo_sgc} · ` : ''}${p.nombre}`
}
