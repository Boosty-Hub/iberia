import 'server-only'
import { PARTES_M365 } from '@/lib/asistente/microsoft'
import { createClient as clienteSupabase } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { FUENTES } from '@/lib/plataforma/tablas'
import { consultarPagina, type Cliente, type FuenteTabla } from '@/lib/plataforma/tabla-servidor'
import { permite, type MapaPermisos, type Nivel } from '@/lib/permisos'
import { hoyCaracas } from '@/lib/plataforma/formato'
import type { ContextoGlobal } from '@/lib/plataforma/servidor'
import type { EstadoTabla } from '@/lib/plataforma/tabla'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Las fuentes de datos del asistente (fase 2). Una fuente es una tabla de la
 * plataforma (`tabla:<id>`, las mismas definiciones de `lib/plataforma/tablas*.ts`:
 * el asistente da la misma cifra que la pantalla), las métricas del registro
 * (`metricas`) o los documentos del SGC (`documentos`).
 *
 * Puede consultarla quien: (1) tiene el permiso de su pantalla —la matriz, con
 * el nivel como techo—, (2) la tiene en su alcance (`asistente.mi_alcance()`:
 * encendida y permitida por su rol o su excepción) y (3) la RLS le deja las
 * filas, porque cada consulta corre con el token de su sesión.
 *
 * 🔴 Fuera del catálogo, a propósito: los mensajes del Portal planta, las
 * respuestas y charlas de Ajito, las transcripciones, las notas del consultor y
 * el contacto del padrón. No hay fuente que los alcance.
 */

/** Las tablas que nunca son fuente del asistente aunque existan en la plataforma. */
const FUERA = new Set(['padron', 'formacion-personas', 'canal-grupos', 'canal-uso', 'entrevistas', 'historial-org'])

export type FuenteAsistente = { clave: string; titulo: string; modulo: string; recurso: string; accion: 'ver' | 'crear' | 'editar'; tipo: 'tabla' | 'metricas' | 'documentos' | 'microsoft' }

/** Todas las fuentes posibles (lo que la administración puede encender). */
export function catalogoFuentes(): FuenteAsistente[] {
  const tablas = Object.values(FUENTES)
    .filter((f) => !FUERA.has(f.id))
    .map((f) => ({ clave: `tabla:${f.id}`, titulo: f.titulo, modulo: f.modulo, recurso: f.recurso, accion: f.accion ?? 'ver', tipo: 'tabla' as const }))
  return [
    ...tablas,
    { clave: 'metricas', titulo: 'Métricas del registro (cifras de la plataforma)', modulo: 'DAT-SEM', recurso: '', accion: 'ver', tipo: 'metricas' },
    { clave: 'documentos', titulo: 'Documentos del SGC (texto por página)', modulo: 'NUC-DOC', recurso: 'sistema:documentos', accion: 'ver', tipo: 'documentos' },
    // Fase 7: la cuenta de Microsoft de cada persona (permisos delegados: solo lo que ella ve en Microsoft).
    ...Object.entries(PARTES_M365).map(([clave, titulo]) => ({ clave, titulo, modulo: 'M365', recurso: '', accion: 'ver' as const, tipo: 'microsoft' as const })),
  ]
}

/** ¿Es una fuente de Microsoft 365? Su linaje es información de la persona, no de la plataforma. */
export const esMicrosoft = (clave: string) => clave.startsWith('m365:')

/** Un cliente de Supabase que actúa como el usuario dueño del token: la RLS de siempre. */
export function clienteDeToken(token: string): Cliente {
  return clienteSupabase<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  }) as unknown as Cliente
}

type Identidad = { uid: string; nivel: Nivel; permisos: MapaPermisos }

export async function identidad(cliente: Cliente, token: string): Promise<Identidad | null> {
  const { data: u } = await cliente.auth.getUser(token)
  if (!u?.user) return null
  const [{ data: perfil }, { data: filas }] = await Promise.all([cliente.from('profiles').select('rol, activo').eq('id', u.user.id).maybeSingle(), cliente.rpc('mis_permisos')])
  if (!perfil?.activo) return null
  const permisos: MapaPermisos = {}
  for (const f of filas ?? []) permisos[f.recurso] = { ver: f.ver, crear: f.crear, editar: f.editar, eliminar: f.eliminar }
  return { uid: u.user.id, nivel: perfil.rol as Nivel, permisos }
}

/** Las fuentes que esta persona puede consultar ahora: permiso de la pantalla ∩ alcance. */
export async function fuentesPermitidas(cliente: Cliente, yo: Identidad): Promise<(FuenteAsistente & { sensible: boolean })[]> {
  const { data } = await cliente.schema('asistente').rpc('mi_alcance')
  const alcance = new Map(((data ?? []) as { fuente: string; sensible: boolean }[]).map((a) => [a.fuente, a.sensible]))
  return catalogoFuentes()
    .filter((f) => alcance.has(f.clave) && (!f.recurso || permite(yo.nivel, yo.permisos, f.recurso, f.accion)))
    .map((f) => ({ ...f, sensible: alcance.get(f.clave) ?? false }))
}

const CTX = (): ContextoGlobal => ({ al: hoyCaracas(), esHoy: true, esc: null, moneda: 'USD' })

/** Lo que el modelo necesita saber de cada fuente para pedirla bien. */
export async function descripcionCatalogo(cliente: Cliente, fuentes: FuenteAsistente[]) {
  const tablas = fuentes
    .filter((f) => f.tipo === 'tabla')
    .map((f) => {
      const t = FUENTES[f.clave.slice(6)]
      return {
        fuente: f.clave,
        titulo: t.titulo,
        columnas: t.columnas.filter((c) => !c.acciones).map((c) => ({ clave: c.clave, etiqueta: c.etiqueta, filtrable: !!c.filtrable })),
        buscable: !!t.busqueda,
      }
    })
  let metricas: { clave: string; nombre: string; unidad: string }[] = []
  if (fuentes.some((f) => f.tipo === 'metricas')) {
    const { data } = await cliente.schema('ui').from('metrica').select('clave, nombre, unidad, recurso, accion').eq('estado', 'vigente').order('orden')
    metricas = (data ?? []).map((m) => ({ clave: m.clave, nombre: m.nombre, unidad: m.unidad }))
  }
  const partes = fuentes.filter((f) => f.tipo === 'microsoft').map((f) => f.clave)
  let conectado = false
  if (partes.length) {
    const { data } = await cliente.schema('asistente').from('conexion_microsoft').select('perfil_id').maybeSingle()
    conectado = !!data
  }
  return { tablas, metricas, documentos: fuentes.some((f) => f.tipo === 'documentos'), microsoft: partes.length ? { partes, conectado } : null }
}

type Args = { buscar?: string | null; filtros?: { columna: string; valores: string[] }[] | null; orden?: { columna: string; dir: 'asc' | 'desc' } | null; limite?: number | null }

/** Corre una consulta de tabla con el token de quien pregunta. Devuelve filas planas con sus etiquetas. */
export async function consultarTabla(cliente: Cliente, f: FuenteTabla, a: Args) {
  const columnas = f.columnas.filter((c) => !c.acciones)
  const validas = new Set(columnas.map((c) => c.clave))
  const filtros: Record<string, string[]> = {}
  for (const x of a.filtros ?? []) if (validas.has(x.columna) && Array.isArray(x.valores)) filtros[x.columna] = x.valores.map(String).slice(0, 30)
  const limite = Math.min(Math.max(Number(a.limite) || 50, 1), 200)
  const estado: EstadoTabla = {
    q: (a.buscar ?? '').slice(0, 100),
    filtros,
    orden: a.orden && validas.has(a.orden.columna) ? a.orden.columna : null,
    dir: a.orden?.dir === 'asc' ? 'asc' : 'desc',
    agrupar: null,
    columnas: columnas.map((c) => c.clave),
    pagina: 1,
    tamano: limite,
    vista: null,
  }
  const { filas, total, error } = await consultarPagina(f, estado, CTX(), cliente)
  if (error) return { error: 'No se pudo leer esa tabla.' }
  const etiquetas = Object.fromEntries(columnas.map((c) => [c.clave, c.etiqueta]))
  const planas = filas.map((r) => {
    const o: Record<string, unknown> = {}
    for (const c of columnas) {
      const v = c.etiquetaDe && r[c.etiquetaDe] !== undefined ? r[c.etiquetaDe] : c.etiquetas && r[c.clave] !== null && r[c.clave] !== undefined ? (c.etiquetas[String(r[c.clave])] ?? r[c.clave]) : r[c.clave]
      if (v !== null && v !== undefined && v !== '') o[c.etiqueta] = v
    }
    if (f.ficha && r[f.ficha.columna]) o['_enlace'] = `/sistema/ficha/${f.ficha.tipo}/${r[f.ficha.columna]}`
    return o
  })
  return { tabla: f.titulo, enlace_tabla: f.ruta, total, mostradas: planas.length, columnas: etiquetas, filas: planas }
}

export async function consultarMetrica(cliente: Cliente, clave: string) {
  const { data, error } = await cliente.schema('ui').rpc('metrica', { p_clave: clave, p_al: hoyCaracas() })
  if (error || !data) return { error: 'Esa métrica no está disponible para ti.' }
  const m = data as Record<string, unknown>
  if (!m.permitida) return { error: 'No tienes permiso para esa métrica.' }
  return { clave: m.clave, nombre: m.nombre, definicion: m.definicion, unidad: m.unidad, valor: m.valor, total: m.total, detalle: m.detalle, al: m.al, enlace: m.href }
}

export async function buscarDocumentos(cliente: Cliente, consulta: string, limite?: number | null) {
  const { data, error } = await cliente.schema('asistente').rpc('buscar_documentos', { p_consulta: consulta.slice(0, 300), p_limite: Math.min(Math.max(Number(limite) || 10, 1), 25) })
  if (error) return { error: 'No se pudo buscar en los documentos.' }
  return {
    resultados: (data ?? []).map((d) => ({
      documento: [d.codigo, d.titulo].filter(Boolean).join(' · '),
      estado: d.estado,
      archivo: d.archivo,
      pagina: d.pagina,
      extracto: d.extracto,
      enlace: `/sistema/ficha/documento/${d.documento_id}`,
    })),
  }
}

/** Anota la consulta (qué, con qué filtros y cuántas filas; nunca el contenido). */
export async function anotarConsulta(perfil: string, turno: string | null, fuente: string, parametros: unknown, filas: number) {
  await createAdminClient()
    .schema('asistente')
    .from('consulta_fuente')
    .insert({ perfil_id: perfil, turno_id: turno, fuente, parametros: (parametros ?? {}) as never, filas })
}
