import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { ESTADOS_OPERATIVOS, TIPOS, hoy } from './comun'

/**
 * Lecturas de servidor de procesos, plazas y catálogos.
 *
 * ⚠️ **La API corta en mil filas sin avisar** (AGENTS.md, «Trampas»): todo lo
 * que pueda crecer se lee por páginas con `.range()`. Hoy son ~200 procesos,
 * pero el nivel 3 (actividades) llega «a demanda».
 *
 * ⚠️ **`sgc.proceso` guarda también las filas de los escenarios.** Toda lectura
 * de la realidad filtra `escenario_id is null`.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

export const COLUMNAS_PROCESO =
  'id, ref, clave, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe, estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha, estado, version, vigencia, escenario_id, fuente, nota, creado_por, creado_en'

export type FilaProceso = {
  id: string
  ref: string
  clave: string
  nivel: number
  padre_ref: string | null
  orden: number
  nombre: string
  tipo: string | null
  codigo_sgc: string | null
  generacion: string | null
  codigo_informe: string | null
  estado_operativo: string
  dueno_plaza_ref: string | null
  dueno_texto: string | null
  area_texto: string | null
  ficha: unknown
  estado: string
  version: number
  vigencia: unknown
  escenario_id: string | null
  fuente: string[]
  nota: string | null
  creado_por: string | null
  creado_en: string
}

const PAGINA = 1000

/** Lee todas las filas que cumplan `filtro`, de mil en mil. */
export async function todasLasFilas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1)
    if (error) throw new Error(error.message)
    filas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }
  return filas
}

/** Lo publicado con fecha futura entra en vigor al llegar su día (no hay cron). */
export async function activarProgramados(supabase: Cliente) {
  await supabase.schema('sgc').rpc('activar_programados')
}

/**
 * La realidad de hoy: las versiones vigentes y, aparte, los borradores y
 * revisiones abiertas (por ref), incluidos los procesos nuevos que todavía no
 * tienen vigente.
 */
export async function leerProcesos(supabase: Cliente) {
  const filas = await todasLasFilas<FilaProceso>((d, h) =>
    supabase
      .schema('sgc')
      .from('proceso')
      .select(COLUMNAS_PROCESO)
      .is('escenario_id', null)
      .in('estado', ['vigente', 'borrador', 'en_revision', 'aprobada'])
      .order('orden')
      .order('ref')
      .range(d, h) as unknown as PromiseLike<{ data: FilaProceso[] | null; error: { message: string } | null }>,
  )
  const vigentes = filas.filter((f) => f.estado === 'vigente')
  const abiertos = new Map<string, FilaProceso>()
  const programados = new Map<string, FilaProceso>()
  for (const f of filas) {
    if (f.estado === 'borrador' || f.estado === 'en_revision') abiertos.set(f.ref, f)
    if (f.estado === 'aprobada') programados.set(f.ref, f)
  }
  return { vigentes, abiertos, programados }
}

export async function leerFilasDeEscenario(supabase: Cliente, escenario: string) {
  return todasLasFilas<FilaProceso>((d, h) =>
    supabase
      .schema('sgc')
      .from('proceso')
      .select(COLUMNAS_PROCESO)
      .eq('escenario_id', escenario)
      .order('orden')
      .order('ref')
      .range(d, h) as unknown as PromiseLike<{ data: FilaProceso[] | null; error: { message: string } | null }>,
  )
}

export type OpcionPlaza = { ref: string; etiqueta: string; cargo: string; unidad: string }

/**
 * Las plazas vigentes con su cargo y su unidad, para elegir dueño. Sin
 * `sistema:estructura` la RLS devuelve vacío y la pantalla cae al texto.
 */
export async function leerPlazas(supabase: Cliente): Promise<OpcionPlaza[]> {
  const org = supabase.schema('org')
  const dia = hoy()
  const [plazas, unidades] = await Promise.all([
    todasLasFilas<{ ref: string; unidad_ref: string; cargo: { nombre: string } | null }>((d, h) =>
      org
        .from('plaza')
        .select('ref, unidad_ref, cargo:cargo_id(nombre)')
        .is('escenario_id', null)
        .filter('vigencia', 'cs', `[${dia},${dia}]`)
        .range(d, h) as unknown as PromiseLike<{ data: { ref: string; unidad_ref: string; cargo: { nombre: string } | null }[] | null; error: { message: string } | null }>,
    ),
    todasLasFilas<{ ref: string; nombre: string }>((d, h) =>
      org
        .from('unidad')
        .select('ref, nombre')
        .is('escenario_id', null)
        .filter('vigencia', 'cs', `[${dia},${dia}]`)
        .range(d, h) as unknown as PromiseLike<{ data: { ref: string; nombre: string }[] | null; error: { message: string } | null }>,
    ),
  ]).catch(() => [[], []] as [never[], never[]])
  const nombreUnidad = new Map(unidades.map((u) => [u.ref, u.nombre]))
  return plazas
    .map((p) => {
      const cargo = p.cargo?.nombre ?? 'Cargo sin nombre'
      const unidad = nombreUnidad.get(p.unidad_ref) ?? 'Unidad sin nombre'
      return { ref: p.ref, cargo, unidad, etiqueta: `${cargo} · ${unidad}` }
    })
    .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
}

/** Las etiquetas del catálogo editable, con el respaldo fijo si no se puede leer. */
export async function leerCatalogo(supabase: Cliente) {
  const { data } = await supabase
    .schema('control')
    .from('catalogo')
    .select('tipo, clave, etiqueta, activo, orden')
    .in('tipo', ['tipo_proceso', 'estado_operativo'])
    .order('orden')
  const tipos: Record<string, string> = { ...TIPOS }
  const estados: Record<string, string> = { ...ESTADOS_OPERATIVOS }
  for (const c of data ?? []) {
    if (c.tipo === 'tipo_proceso') tipos[c.clave] = c.etiqueta
    if (c.tipo === 'estado_operativo') estados[c.clave] = c.etiqueta
  }
  return { tipos, estados }
}

export type PasoLeido = {
  id: string
  orden: number
  nombre: string
  accion: string
  hito: boolean
  decision: string
  comentario: string | null
  decidido_en: string | null
  decidido_por: string | null
  aprobador: string
  sin_cuenta: boolean
  decidido_por_nombre: string | null
}

export type SolicitudLeida = {
  id: string
  objeto_id: string
  titulo: string
  estado: string
  paso_actual: number | null
  creado_en: string
  cerrado_en: string | null
  creado_por_nombre: string | null
  pasos: PasoLeido[]
}

/**
 * Las solicitudes de aprobación de unos objetos, con sus pasos y quién firma
 * cada uno (la plaza resuelta desde la estructura). La RLS deja ver la
 * solicitud a quien la abrió, a quien firma y a quien administra aprobaciones.
 */
export async function leerSolicitudes(supabase: Cliente, tipo: string, objetos: string[]): Promise<SolicitudLeida[]> {
  if (!objetos.length) return []
  const flujo = supabase.schema('flujo')
  const { data: sols } = await flujo
    .from('solicitud')
    .select('id, objeto_id, titulo, estado, paso_actual, creado_en, cerrado_en, creado_por, paso(id, orden, nombre, accion, hito, decision, comentario, decidido_en, decidido_por, aprobador_plaza_ref, aprobador_perfil, regla)')
    .eq('tipo_objeto', tipo)
    .in('objeto_id', objetos)
    .order('creado_en', { ascending: false })
  const lista = sols ?? []
  const perfiles = new Set<string>()
  const plazas = new Set<string>()
  for (const s of lista) {
    if (s.creado_por) perfiles.add(s.creado_por)
    for (const p of s.paso ?? []) {
      if (p.decidido_por) perfiles.add(p.decidido_por)
      if (p.aprobador_perfil) perfiles.add(p.aprobador_perfil)
      if (p.aprobador_plaza_ref) plazas.add(p.aprobador_plaza_ref)
    }
  }
  const [nombres, descr] = await Promise.all([
    perfiles.size ? flujo.rpc('nombres', { p_ids: [...perfiles] }) : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    plazas.size ? supabase.schema('org').rpc('describir_plazas', { p_refs: [...plazas] }) : Promise.resolve({ data: [] as { ref: string; cargo: string; unidad: string }[] }),
  ])
  const nombre = new Map((nombres.data ?? []).map((n) => [n.id, n.nombre]))
  const plaza = new Map((descr.data ?? []).map((p) => [p.ref, `${p.cargo}${p.unidad ? ` · ${p.unidad}` : ''}`]))
  return lista.map((s) => ({
    id: s.id,
    objeto_id: s.objeto_id,
    titulo: s.titulo,
    estado: s.estado,
    paso_actual: s.paso_actual,
    creado_en: s.creado_en,
    cerrado_en: s.cerrado_en,
    creado_por_nombre: s.creado_por ? (nombre.get(s.creado_por) ?? null) : null,
    pasos: [...(s.paso ?? [])]
      .sort((a, b) => a.orden - b.orden)
      .map((p) => {
        const regla = (p.regla ?? {}) as Record<string, unknown>
        const quien = p.aprobador_plaza_ref ? plaza.get(p.aprobador_plaza_ref) : null
        const persona = p.aprobador_perfil ? nombre.get(p.aprobador_perfil) : null
        return {
          id: p.id,
          orden: p.orden,
          nombre: p.nombre,
          accion: p.accion,
          hito: p.hito,
          decision: p.decision,
          comentario: p.comentario,
          decidido_en: p.decidido_en,
          decidido_por: p.decidido_por,
          decidido_por_nombre: p.decidido_por ? (nombre.get(p.decidido_por) ?? null) : null,
          sin_cuenta: Boolean(regla.sin_cuenta),
          aprobador: [quien, persona].filter(Boolean).join(' — ') || (p.aprobador_plaza_ref ? 'Plaza sin describir' : 'Sin plaza resuelta'),
        }
      }),
  }))
}

/** Documentos por proceso, sumados hacia arriba del árbol. */
export async function conteoDocumentos(supabase: Cliente, procesos: { ref: string; padre_ref: string | null }[]) {
  const { data } = await supabase.schema('sgc').rpc('conteo_documentos')
  const propio = new Map<string, { total: number; vigentes: number }>()
  for (const f of data ?? []) if (f.proceso_ref) propio.set(f.proceso_ref, { total: Number(f.total), vigentes: Number(f.vigentes) })
  const padre = new Map(procesos.map((p) => [p.ref, p.padre_ref]))
  const acumulado = new Map<string, { total: number; vigentes: number }>()
  for (const [ref, c] of propio) {
    let r: string | null | undefined = ref
    for (let i = 0; r && i < 8; i++) {
      const a = acumulado.get(r) ?? { total: 0, vigentes: 0 }
      acumulado.set(r, { total: a.total + c.total, vigentes: a.vigentes + c.vigentes })
      r = padre.get(r)
    }
  }
  return { propio, acumulado }
}
