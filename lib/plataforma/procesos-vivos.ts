import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'

/**
 * Procesos y documentos «vivos» (rediseño del 28-nov-2026): una sola escalera, del mapa al texto del documento.
 *
 * - El mapa es el del informe (1.1–3.8): macroprocesos (nivel 0), procesos (1) y subprocesos (2) de `sgc.proceso`.
 * - Cada documento va a su proceso por `sgc.documento_proceso`: principal o «también aplica», sugerido por la revisión
 *   del 27-nov o confirmado por quien edita procesos.
 * - El texto vive en `sgc.documento_version`, por secciones y bloques.
 *
 * Todo se lee con la RLS de quien mira. Supabase corta en 1.000 filas: lo que puede pasar de mil se pagina.
 */

type Cliente = SupabaseClient<Database>

export const TIPOS_DOC: Record<string, string> = {
  '10': 'Manual', '11': 'Caracterización', '12': 'Política', '13': 'Normas y programas', '14': 'Organigrama',
  '20': 'Procedimiento', '22': 'Norma técnica', '23': 'Procedimiento operacional', '30': 'Norma / diagrama',
  '31': 'Instrucción de trabajo', '32': 'Especificación técnica', '33': 'Método de análisis', '34': 'Diagrama',
  '35': 'Instructivo operacional', '36': 'Mapa PHVA antiguo', '40': 'Formato / registro',
}

/** La escalera dentro de un proceso: lo que manda → cómo se hace → cómo se controla → dónde queda. */
export const NIVELES_DOC = [
  { clave: 'manda', nombre: 'Políticas, normas y procedimientos', nota: 'lo que manda', tipos: ['10', '12', '13', '20', '22', '30'] },
  { clave: 'hace', nombre: 'Instrucciones y procedimientos operacionales', nota: 'cómo se hace', tipos: ['31', '23', '35'] },
  { clave: 'controla', nombre: 'Métodos de análisis y especificaciones', nota: 'cómo se controla', tipos: ['33', '32'] },
  { clave: 'queda', nombre: 'Formatos y registros', nota: 'dónde queda', tipos: ['40'] },
  { clave: 'otros', nombre: 'Caracterizaciones, presentaciones y otros', nota: 'antecedentes', tipos: ['11', '14', '34', '36'] },
] as const

export const ETIQUETA_ESTADO_DOC: Record<string, string> = {
  vigente: 'Vigente', borrador: 'Borrador', sin_determinar: 'Por determinar', obsoleto: 'Obsoleto', retirado: 'Retirado',
}

export type DocEnlazado = {
  id: string
  codigo: string
  titulo: string
  tipo: string | null
  estado: string
  version: string | null
  fecha: string | null
  enlace: { id: string; rol: 'principal' | 'tambien'; estado: 'sugerido' | 'confirmado'; confianza: string | null; razon: string | null }
}

export type ProcesoMapa = {
  ref: string
  codigo: string
  nombre: string
  nivel: number
  padre: string | null
  tipo: string | null
  codigoSgc: string | null
  dueno: string | null
  conFicha: boolean
  estadoOperativo: string
  docs: DocEnlazado[]
}

export type Mapa = {
  procesos: ProcesoMapa[]
  porRef: Map<string, ProcesoMapa>
  porCodigo: Map<string, ProcesoMapa>
  hijos: (ref: string | null) => ProcesoMapa[]
  macroDe: (ref: string) => ProcesoMapa | null
}

async function todo<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999)
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return filas
}

/** El mapa entero con los documentos de cada proceso. Una lectura por página: son ~200 procesos y ~2.500 enlaces. */
export async function leerMapa(supabase: Cliente, opciones: { conDocs?: boolean } = {}): Promise<Mapa> {
  const sgc = supabase.schema('sgc')
  const [procesos, enlaces, docs] = await Promise.all([
    todo((a, b) =>
      sgc.from('proceso').select('ref, codigo_informe, codigo_sgc, nombre, nivel, padre_ref, orden, tipo, dueno_texto, area_texto, ficha, estado_operativo')
        .is('escenario_id', null).eq('estado', 'vigente').order('nivel').order('orden').range(a, b),
    ),
    opciones.conDocs === false
      ? Promise.resolve([])
      : todo((a, b) => sgc.from('documento_proceso').select('id, documento_id, proceso_ref, rol, estado, confianza, razon').neq('estado', 'descartado').range(a, b)),
    opciones.conDocs === false
      ? Promise.resolve([])
      : todo((a, b) => sgc.from('documento').select('id, codigo, titulo, tipo_yy, estado, version, fecha').range(a, b)),
  ])
  const docPorId = new Map(docs.map((d) => [d.id, d]))
  const porRef = new Map<string, ProcesoMapa>()
  const cuenta = new Map<string, number>()
  const lista: ProcesoMapa[] = procesos.map((p) => {
    // Los subprocesos no traen código: se numeran bajo su padre (2.9.3.1…), en el orden del mapa.
    let codigo = p.codigo_informe ?? p.codigo_sgc ?? ''
    const x: ProcesoMapa = {
      ref: p.ref, codigo, nombre: p.nombre, nivel: p.nivel, padre: p.padre_ref, tipo: p.tipo, codigoSgc: p.codigo_sgc,
      dueno: p.dueno_texto ?? p.area_texto, conFicha: !!p.ficha && Object.keys(p.ficha as object).length > 0,
      estadoOperativo: p.estado_operativo, docs: [],
    }
    porRef.set(p.ref, x)
    if (!codigo && p.padre_ref) {
      const padre = porRef.get(p.padre_ref)
      const n = (cuenta.get(p.padre_ref) ?? 0) + 1
      cuenta.set(p.padre_ref, n)
      codigo = `${padre?.codigo ?? '?'}.${n}`
      x.codigo = codigo
    }
    return x
  })
  for (const e of enlaces) {
    const p = porRef.get(e.proceso_ref)
    const d = docPorId.get(e.documento_id)
    if (!p || !d) continue
    p.docs.push({
      id: d.id, codigo: d.codigo, titulo: d.titulo, tipo: d.tipo_yy, estado: d.estado, version: d.version, fecha: d.fecha,
      enlace: { id: e.id, rol: e.rol as 'principal' | 'tambien', estado: e.estado as 'sugerido' | 'confirmado', confianza: e.confianza, razon: e.razon },
    })
  }
  const orden = (d: DocEnlazado) => NIVELES_DOC.findIndex((n) => (n.tipos as readonly string[]).includes(d.tipo ?? ''))
  for (const p of lista) p.docs.sort((a, b) => orden(a) - orden(b) || a.codigo.localeCompare(b.codigo))
  const porCodigo = new Map(lista.map((p) => [p.codigo, p]))
  const hijos = (ref: string | null) => lista.filter((p) => p.padre === ref)
  const macroDe = (ref: string) => {
    let p = porRef.get(ref)
    while (p && p.nivel > 0 && p.padre) p = porRef.get(p.padre)
    return p ?? null
  }
  return { procesos: lista, porRef, porCodigo, hijos, macroDe }
}

export const activos = (ds: DocEnlazado[]) => ds.filter((d) => d.estado !== 'obsoleto' && d.estado !== 'retirado')
export const principales = (ds: DocEnlazado[]) => ds.filter((d) => d.enlace.rol === 'principal')

/** Cómo está documentado un proceso, mirando sus documentos activos (principales). */
export function estadoDocumental(p: ProcesoMapa): { tono: 'ok' | 'sugerido' | 'formatos' | 'borrador' | 'sin'; texto: string } {
  const ds = principales(activos(p.docs))
  if (!ds.length) return { tono: 'sin', texto: 'Sin documentar' }
  if (ds.every((d) => d.enlace.estado === 'sugerido')) return { tono: 'sugerido', texto: 'Sugerido' }
  if (ds.every((d) => d.tipo === '40')) return { tono: 'formatos', texto: 'Solo formatos' }
  if (ds.some((d) => d.estado === 'borrador')) return { tono: 'borrador', texto: 'Con borrador' }
  return { tono: 'ok', texto: 'Documentado' }
}

/** El índice de la búsqueda de arriba del mapa: procesos y documentos activos, con dónde viven. */
export function indiceBusqueda(m: Mapa) {
  const procesos = m.procesos.filter((p) => p.nivel > 0).map((p) => ({ r: p.ref, c: p.codigo, n: p.nombre, m: m.macroDe(p.ref)?.nombre ?? '' }))
  const vistos = new Set<string>()
  const docs: { i: string; c: string; t: string; y: string; p: string; s: boolean }[] = []
  for (const p of m.procesos) {
    for (const d of principales(activos(p.docs))) {
      if (vistos.has(d.id)) continue
      vistos.add(d.id)
      docs.push({ i: d.id, c: d.codigo, t: d.titulo, y: TIPOS_DOC[d.tipo ?? ''] ?? '', p: p.codigo, s: d.enlace.estado === 'sugerido' })
    }
  }
  return { procesos, docs }
}
export type IndiceBusqueda = ReturnType<typeof indiceBusqueda>

// ── El documento ─────────────────────────────────────────────────────────────

export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'lista'; items: string[] }
  | { tipo: 'tabla'; filas: string[][] }
  | { tipo: 'paso'; responsable?: string; actividad: string }
  | { tipo: 'decision'; pregunta: string; si?: string; no?: string }
  | { tipo: 'referencia'; codigo: string; titulo?: string }
export type Seccion = { titulo: string; bloques: Bloque[] }
export type Contenido = { control?: Record<string, string | null>; secciones: Seccion[] }

export type VersionDoc = {
  id: string
  numero: number
  etiqueta: string | null
  fecha: string | null
  estado: 'transcripcion' | 'historica' | 'borrador' | 'en_revision' | 'vigente' | 'reemplazada'
  contenido: Contenido
  origen: string
  motivo: string | null
  creadoPor: string | null
  creadoEn: string
  vigenteDesde: string | null
  archivo_ruta: string | null
}

export function aContenido(j: Json | null): Contenido {
  const o = (j ?? {}) as { control?: Record<string, string | null>; secciones?: Seccion[] }
  return { control: o.control, secciones: Array.isArray(o.secciones) ? o.secciones : [] }
}

export async function leerDocumentoVivo(supabase: Cliente, id: string) {
  const sgc = supabase.schema('sgc')
  const [{ data: doc }, { data: versiones }, { data: enlaces }, { data: archivos }, { data: registros }] = await Promise.all([
    sgc.from('documento').select('id, codigo, titulo, tipo_yy, estado, version, fecha, proceso_ref, perimetro, datos_sensibles, alias').eq('id', id).maybeSingle(),
    sgc.from('documento_version').select('id, numero, etiqueta, fecha, estado, contenido, origen, motivo, creado_por, creado_en, vigente_desde, archivo_ruta').eq('documento_id', id).order('numero', { ascending: false }),
    sgc.from('documento_proceso').select('id, proceso_ref, rol, estado, confianza, razon').eq('documento_id', id).neq('estado', 'descartado'),
    sgc.from('documento_archivo').select('id, nombre, formato, estado, paginas, transcripcion').eq('documento_id', id).order('orden'),
    sgc.from('documento_registro').select('id, titulo, fecha, contenido, archivo_ruta, nota, editado_en').eq('documento_id', id).order('fecha', { ascending: false, nullsFirst: false }),
  ])
  if (!doc) return null
  const vs: VersionDoc[] = (versiones ?? []).map((v) => ({
    id: v.id, numero: v.numero, etiqueta: v.etiqueta, fecha: v.fecha, estado: v.estado as VersionDoc['estado'], contenido: aContenido(v.contenido),
    origen: v.origen, motivo: v.motivo, creadoPor: v.creado_por, creadoEn: v.creado_en, vigenteDesde: v.vigente_desde, archivo_ruta: v.archivo_ruta,
  }))
  const rs = (registros ?? []).map((r) => ({ ...r, contenido: aContenido(r.contenido) }))
  return { doc, versiones: vs, enlaces: enlaces ?? [], archivos: archivos ?? [], registros: rs }
}

/** Qué versión se lee: la vigente; si no hay, la transcripción por validar más reciente; si no, la histórica más nueva. */
export function versionDeLectura(vs: VersionDoc[]): VersionDoc | null {
  return vs.find((v) => v.estado === 'vigente') ?? vs.find((v) => v.estado === 'transcripcion') ?? vs.find((v) => v.estado === 'historica') ?? null
}

// Plantillas por tipo: las secciones que trae cada tipo de documento del SGC (lectura de 728 documentos, 27-nov-2026).
export const PLANTILLAS: Record<string, string[]> = {
  '20': ['Objetivo', 'Alcance', 'Referencias', 'Responsabilidades', 'Definición de términos', 'Normas generales', 'Descripción del procedimiento', 'Diagrama del proceso', 'Registros', 'Anexos', 'Control de cambios'],
  '31': ['Objetivo', 'Alcance', 'Referencias', 'Normas generales', 'Desarrollo de la instrucción', 'Anexos', 'Control de cambios'],
  '33': ['Objetivo', 'Alcance', 'Referencias', 'Principio', 'Materiales y equipos', 'Medidas de seguridad', 'Preparación de la muestra', 'Procedimiento', 'Cálculo y expresión de resultados', 'Anexos', 'Revisión'],
  '22': ['Objetivo', 'Alcance', 'Referencias', 'Normas generales', 'Normas específicas', 'Anexos', 'Control de cambios'],
  '30': ['Objetivo', 'Alcance', 'Referencias', 'Normas generales', 'Diagrama', 'Control de cambios'],
  '13': ['Objetivo', 'Alcance', 'Referencias', 'Normas generales', 'Programas', 'Control de cambios'],
  '12': ['Política', 'Objetivos', 'Alcance', 'Control de cambios'],
  '10': ['Presentación', 'Alcance del sistema', 'Política y objetivos', 'Estructura documental', 'Control de cambios'],
  '23': ['Objeto', 'Herramientas y materiales de trabajo', 'Procedimiento', 'Normas', 'Diagrama'],
  '35': ['Objeto', 'Herramientas y materiales', 'Modo operatorio', 'Seguridad'],
  '32': ['Requisitos del producto', 'Requisitos del empaque y presentación', 'Requisitos de almacenamiento', 'Requisitos de transporte', 'Muestra'],
  '11': ['Planificar', 'Hacer', 'Verificar', 'Actuar', 'Indicadores'],
  '40': ['Campos del formato'],
}

// ── La caracterización (ISO 9001:2026, cláusula 4.4) ─────────────────────────

/** Los campos de la caracterización, en el orden de la cláusula 4.4.1 de ISO 9001. */
export const CAMPOS_CARACTERIZACION = [
  { clave: 'objetivo', titulo: 'Objetivo', iso: '' },
  { clave: 'alcance', titulo: 'Alcance', iso: '' },
  { clave: 'proveedores', titulo: 'Proveedores', iso: '4.4.1 a)' },
  { clave: 'entradas', titulo: 'Entradas', iso: '4.4.1 a)' },
  { clave: 'actividades', titulo: 'Actividades (secuencia)', iso: '4.4.1 b)' },
  { clave: 'salidas', titulo: 'Salidas', iso: '4.4.1 a)' },
  { clave: 'clientes', titulo: 'Clientes', iso: '4.4.1 a)' },
  { clave: 'criterios', titulo: 'Criterios y métodos de control', iso: '4.4.1 c)' },
  { clave: 'indicadores', titulo: 'Indicadores', iso: '4.4.1 c)' },
  { clave: 'recursos', titulo: 'Recursos', iso: '4.4.1 d)' },
  { clave: 'responsabilidades', titulo: 'Responsabilidades y autoridades', iso: '4.4.1 e)' },
  { clave: 'riesgos', titulo: 'Riesgos', iso: '4.4.1 f)' },
  { clave: 'oportunidades', titulo: 'Oportunidades', iso: '4.4.1 f)' },
  { clave: 'evaluacion', titulo: 'Cómo se evalúa', iso: '4.4.1 g)' },
  { clave: 'mejora', titulo: 'Cómo se mejora', iso: '4.4.1 h)' },
] as const

/** El escalón de un documento por su tipo. Lo que no tiene tipo (presentaciones, minutas sin código…) va a «otros»: si no, se contaba y no se veía. */
export function nivelDe(tipo: string | null): (typeof NIVELES_DOC)[number]['clave'] {
  return NIVELES_DOC.find((n) => (n.tipos as readonly string[]).includes(tipo ?? ''))?.clave ?? 'otros'
}
