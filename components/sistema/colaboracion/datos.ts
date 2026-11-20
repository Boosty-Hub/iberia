import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  etiquetaCampo,
  tieneLinea,
  tituloCambio,
  valorLegible,
  type CambioCampo,
  type DatosLinea,
  type EntradaLinea,
  type NivelIa,
  type Notificacion,
  type Persona,
  type ResumenNotificaciones,
  type Tarea,
  type TipoNotificacion,
} from '@/lib/plataforma/colaboracion'

/**
 * Lo que la colaboración lee de la base, siempre con la sesión de quien mira:
 * la RLS decide qué eventos, notificaciones y tareas existen. Lo usan las
 * páginas (servidor) y las acciones (`acciones.ts`).
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

const QUINCE_MIN = 15 * 60 * 1000
const TOPE_CAMBIOS = 60

async function nombres(supabase: Cliente, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter(Boolean))] as string[]
  if (!unicos.length) return new Map()
  const { data } = await supabase.schema('nucleo').rpc('nombres', { p_ids: unicos })
  return new Map((data ?? []).map((n) => [n.id, n.nombre]))
}

/** Cómo se llaman unos objetos (solo los que quien mira puede ver). Llave: `tipo:id`. */
export async function titulosDe(supabase: Cliente, pares: { tipo: string | null; id: string | null }[]): Promise<Map<string, string>> {
  const unicos = [...new Map(pares.filter((p) => p.tipo && p.id).map((p) => [`${p.tipo}:${p.id}`, p])).values()]
  if (!unicos.length) return new Map()
  const { data } = await supabase
    .schema('nucleo')
    .rpc('titulos_objetos', { p_tipos: unicos.map((p) => p.tipo as string), p_ids: unicos.map((p) => p.id as string) })
  return new Map((data ?? []).map((t) => [`${t.tipo}:${t.id}`, t.titulo]))
}

/**
 * La línea de tiempo de un objeto: los eventos de `nucleo.evento` (comentarios
 * con sus respuestas, decisiones, IA, sistema) y los cambios de la auditoría
 * (`nucleo.cambios`, agrupados por persona y minuto). null si no está a tu alcance.
 */
export async function leerLinea(tipo: string, id: string): Promise<DatosLinea | null> {
  if (!tieneLinea(tipo) || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const nucleo = supabase.schema('nucleo')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: puede } = await nucleo.rpc('puede_ver_objeto', { p_tipo: tipo, p_id: id })
  if (!puede) return null

  const [{ data: eventos }, { data: cambios }, { data: sigo }] = await Promise.all([
    nucleo
      .from('evento')
      .select('id, tipo, autor, actor_es_ia, capacidad_ia, nivel_ia, texto, datos, padre_id, creado_en, editado_en, oculto')
      .eq('objeto_tipo', tipo)
      .eq('objeto_id', id)
      .order('creado_en', { ascending: false })
      .range(0, 299),
    nucleo.rpc('cambios', { p_tipo: tipo, p_id: id, p_limite: TOPE_CAMBIOS }),
    nucleo.from('seguimiento').select('perfil').eq('perfil', user.id).eq('objeto_tipo', tipo).eq('objeto_id', id).maybeSingle(),
  ])

  const filas = eventos ?? []
  const mencionIds = filas.flatMap((e) => ((e.datos as { menciones?: string[] } | null)?.menciones ?? []) as string[])
  const nombre = await nombres(supabase, [user.id, ...filas.map((e) => e.autor), ...mencionIds])
  const persona = (pid: string | null): Persona | null => (pid ? { id: pid, nombre: nombre.get(pid) ?? 'Alguien' } : null)
  const ahora = Date.now()

  // Comentarios: las respuestas cuelgan de su hilo (un nivel), en orden de llegada.
  const respuestas = new Map<string, EntradaLinea[]>()
  const comentario = (e: (typeof filas)[number]): EntradaLinea => {
    const mio = e.autor === user.id
    const hasta = new Date(e.creado_en).getTime() + QUINCE_MIN
    const datos = (e.datos ?? {}) as { menciones?: string[] }
    return {
      clase: 'comentario',
      id: e.id,
      en: e.creado_en,
      autor: persona(e.autor),
      texto: e.oculto && !mio ? '' : (e.texto ?? ''),
      editadoEn: e.editado_en,
      oculto: e.oculto,
      mio,
      editableHasta: mio && hasta > ahora ? new Date(hasta).toISOString() : null,
      menciones: (datos.menciones ?? []).map((m) => ({ id: m, nombre: nombre.get(m) ?? 'Alguien' })),
      respuestas: [],
    }
  }
  for (const e of [...filas].reverse()) {
    if (e.tipo === 'comentario' && e.padre_id) {
      const lista = respuestas.get(e.padre_id) ?? []
      lista.push(comentario(e))
      respuestas.set(e.padre_id, lista)
    }
  }

  const entradas: EntradaLinea[] = []
  const vistos = new Set<string>()
  for (const e of filas) {
    const datos = (e.datos ?? {}) as Record<string, unknown>
    if (e.tipo === 'comentario' || e.tipo === 'mencion') {
      if (e.padre_id && filas.some((p) => p.id === e.padre_id)) continue
      const c = comentario(e)
      if (c.clase === 'comentario') c.respuestas = respuestas.get(e.id) ?? []
      entradas.push(c)
      vistos.add(e.id)
    } else if (e.tipo === 'aprobacion') {
      entradas.push({
        clase: 'aprobacion',
        id: e.id,
        en: e.creado_en,
        autor: persona(e.autor),
        accion: String(datos.accion ?? ''),
        paso: typeof datos.paso === 'string' ? datos.paso : null,
        titulo: typeof datos.titulo === 'string' ? datos.titulo : null,
        texto: e.texto,
      })
    } else if (e.tipo === 'ia' && e.nivel_ia) {
      entradas.push({
        clase: 'ia',
        id: e.id,
        en: e.creado_en,
        capacidad: e.capacidad_ia ?? 'capacidad',
        nivel: e.nivel_ia as NivelIa,
        texto: e.texto,
        evidencia: typeof datos.evidencia === 'string' ? datos.evidencia : null,
        decididoPor: typeof datos.decidido_por_nombre === 'string' ? datos.decidido_por_nombre : null,
        deshacerHasta: typeof datos.deshacer_hasta === 'string' ? datos.deshacer_hasta : null,
      })
    } else {
      entradas.push({ clase: 'sistema', id: e.id, en: e.creado_en, autor: persona(e.autor), texto: e.texto })
    }
  }

  // Cambios: la misma persona en el mismo minuto sobre la misma tabla es un solo
  // cambio (una edición con fecha cierra una versión y abre otra).
  const auditoria = cambios ?? []
  let grupo: { clave: string; entrada: Extract<EntradaLinea, { clase: 'cambio' }> } | null = null
  for (const a of auditoria) {
    const clave = `${a.actor ?? '-'}|${a.tabla}|${a.en.slice(0, 16)}`
    const extra = (a.extra ?? null) as Record<string, unknown> | null
    const campos: CambioCampo[] = Object.entries((a.cambios ?? {}) as Record<string, [unknown, unknown]>).map(([campo, [antes, despues]]) => ({
      campo,
      etiqueta: etiquetaCampo(campo),
      antes: valorLegible(antes),
      despues: valorLegible(despues),
    }))
    if (grupo && grupo.clave === clave) {
      // Lo más reciente manda el título (la versión nueva sobre el cierre de la vieja).
      for (const c of campos) if (!grupo.entrada.cambios.some((x) => x.campo === c.campo)) grupo.entrada.cambios.push(c)
      if (a.accion === 'INSERT') grupo.entrada.titulo = tituloCambio(a.accion, a.tabla, extra)
      continue
    }
    grupo = {
      clave,
      entrada: {
        clase: 'cambio',
        id: `a${a.id}`,
        en: a.en,
        autor: a.actor ? { id: a.actor, nombre: a.actor_nombre ?? 'Alguien' } : null,
        titulo: tituloCambio(a.accion, a.tabla, extra),
        cambios: campos,
      },
    }
    entradas.push(grupo.entrada)
  }

  entradas.sort((x, y) => (x.en < y.en ? 1 : x.en > y.en ? -1 : 0))
  return { tipo, id, yo: { id: user.id, nombre: nombre.get(user.id) ?? 'Yo' }, siguiendo: Boolean(sigo), entradas, masCambios: auditoria.length >= TOPE_CAMBIOS }
}

// -----------------------------------------------------------------------------
// Notificaciones
// -----------------------------------------------------------------------------

type FilaNotificacion = {
  id: string
  tipo: string
  texto: string
  detalle: string | null
  objeto_tipo: string | null
  objeto_id: string | null
  enlace: string | null
  creado_en: string
  leida_en: string | null
}

export function aNotificacion(n: FilaNotificacion): Notificacion {
  return {
    id: n.id,
    tipo: n.tipo as TipoNotificacion,
    texto: n.texto,
    detalle: n.detalle,
    objetoTipo: n.objeto_tipo,
    objetoId: n.objeto_id,
    enlace: n.enlace,
    creadoEn: n.creado_en,
    leida: Boolean(n.leida_en),
  }
}

export const COLUMNAS_NOTIFICACION = 'id, tipo, texto, detalle, objeto_tipo, objeto_id, enlace, creado_en, leida_en'

/** Lo que pinta la campana: cuántas sin leer, las últimas y cuánto espera mi decisión. */
export async function leerResumen(porDecidir?: number): Promise<ResumenNotificaciones> {
  const supabase = await createClient()
  const nucleo = supabase.schema('nucleo')
  const [{ data: n }, { data: ultimas }, bandeja] = await Promise.all([
    nucleo.rpc('no_leidas'),
    nucleo.from('notificacion').select(COLUMNAS_NOTIFICACION).order('creado_en', { ascending: false }).range(0, 7),
    // Si quien llama ya leyó la bandeja (el layout), no se vuelve a pedir.
    porDecidir === undefined ? supabase.schema('flujo').rpc('bandeja') : null,
  ])
  return { noLeidas: n ?? 0, ultimas: (ultimas ?? []).map(aNotificacion), porDecidir: porDecidir ?? (bandeja?.data ?? []).length }
}

// -----------------------------------------------------------------------------
// Tareas
// -----------------------------------------------------------------------------

/** Mis tareas: las que me asignaron y las que creé. `abiertas` = solo las abiertas. */
export async function leerTareas({ abiertas = true, limite = 200 }: { abiertas?: boolean; limite?: number } = {}): Promise<Tarea[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []
  let q = supabase
    .schema('nucleo')
    .from('tarea')
    .select('id, titulo, detalle, objeto_tipo, objeto_id, asignada_a, creada_por, vence, estado, creado_en, cerrada_en')
    .order('estado')
    .order('vence', { ascending: true, nullsFirst: false })
    .order('creado_en', { ascending: false })
    .range(0, limite - 1)
  if (abiertas) q = q.eq('estado', 'abierta')
  const { data } = await q
  const filas = data ?? []
  const [nombre, titulos] = await Promise.all([
    nombres(supabase, filas.flatMap((t) => [t.asignada_a, t.creada_por])),
    titulosDe(supabase, filas.map((t) => ({ tipo: t.objeto_tipo, id: t.objeto_id }))),
  ])
  return filas.map((t) => ({
    id: t.id,
    titulo: t.titulo,
    detalle: t.detalle,
    objetoTipo: t.objeto_tipo,
    objetoId: t.objeto_id,
    objetoTitulo: t.objeto_tipo && t.objeto_id ? (titulos.get(`${t.objeto_tipo}:${t.objeto_id}`) ?? null) : null,
    asignadaA: { id: t.asignada_a, nombre: nombre.get(t.asignada_a) ?? 'Alguien' },
    creadaPor: { id: t.creada_por, nombre: nombre.get(t.creada_por) ?? 'Alguien' },
    vence: t.vence,
    estado: t.estado as Tarea['estado'],
    creadoEn: t.creado_en,
    cerradaEn: t.cerrada_en,
    mia: t.asignada_a === user.id,
  }))
}
