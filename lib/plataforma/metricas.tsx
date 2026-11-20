import 'server-only'
import { cache } from 'react'
import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaHora, fechaLarga, hoyCaracas, numero, porcentaje, tasa, variacion } from '@/lib/plataforma/formato'
import { Kpi, type EstadoFuente } from '@/components/sistema/ui/kpi'
import { IconoCandadito } from '@/components/sistema/shell/iconos'

/**
 * El registro de métricas (DAT-SEM, semilla): cada cifra de la plataforma se
 * define **una sola vez**, en una función `ui.m_*` de la base, y todas las
 * pantallas la leen de aquí. Así «procesos con ficha» dice lo mismo en Mi día
 * que en Procesos › Resumen.
 *
 * - `leerMetrica(clave, ctx)`: la cifra con su definición, memorizada por
 *   petición (la misma métrica en dos sitios de una página se pide una vez).
 * - `precargarMetricas(claves, ctx)`: varias en una sola vuelta a la base
 *   (`ui.metricas`); las `KpiMetrica` que vienen después ya la encuentran.
 * - `<KpiMetrica clave=… ctx=… />`: el Kpi con su sello de fuente, la
 *   definición en la ⓘ y el clic a la tabla que la origina.
 */

export type Metrica = {
  clave: string
  nombre: string
  definicion: string
  unidad: string
  modulo: string | null
  recurso: string
  accion: 'ver' | 'crear' | 'editar'
  dueno: string | null
  fuente: string
  href: string | null
  version: number
  con_fecha: boolean
  con_escenario: boolean
  al: string
  escenario: string | null
  permitida: boolean
  valor: number | null
  total: number | null
  detalle: Record<string, unknown>
  calculado_en: string | null
  ms: number | null
  error: string | null
}

export type ContextoMetrica = { al: string; esc: string | null }

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

function aMetrica(x: unknown): Metrica | null {
  if (!x || typeof x !== 'object') return null
  const r = x as Record<string, unknown>
  return {
    clave: String(r.clave),
    nombre: String(r.nombre ?? r.clave),
    definicion: String(r.definicion ?? ''),
    unidad: String(r.unidad ?? ''),
    modulo: (r.modulo as string | null) ?? null,
    recurso: String(r.recurso ?? ''),
    accion: ((r.accion as string) ?? 'ver') as Metrica['accion'],
    dueno: (r.dueno as string | null) ?? null,
    fuente: String(r.fuente ?? ''),
    href: (r.href as string | null) ?? null,
    version: Number(r.version ?? 1),
    con_fecha: Boolean(r.con_fecha),
    con_escenario: Boolean(r.con_escenario),
    al: String(r.al ?? hoyCaracas()),
    escenario: (r.escenario as string | null) ?? null,
    permitida: Boolean(r.permitida),
    valor: num(r.valor),
    total: num(r.total),
    detalle: (r.detalle as Record<string, unknown>) ?? {},
    calculado_en: (r.calculado_en as string | null) ?? null,
    ms: num(r.ms),
    error: (r.error as string | null) ?? null,
  }
}

/** Lo pedido en esta petición: clave|al|esc → la promesa de su métrica. */
const almacen = cache(() => new Map<string, Promise<Metrica | null>>())
const llave = (clave: string, ctx: ContextoMetrica) => `${clave}|${ctx.al}|${ctx.esc ?? ''}`

/** Una métrica, con su definición. Memorizada por petición. */
export function leerMetrica(clave: string, ctx: ContextoMetrica): Promise<Metrica | null> {
  const mapa = almacen()
  const k = llave(clave, ctx)
  let p = mapa.get(k)
  if (!p) {
    p = (async () => {
      const supabase = await createClient()
      const { data, error } = await supabase.schema('ui').rpc('metrica', { p_clave: clave, p_al: ctx.al, ...(ctx.esc ? { p_escenario: ctx.esc } : {}) })
      if (error) return null
      return aMetrica(data)
    })()
    mapa.set(k, p)
  }
  return p
}

/**
 * Varias métricas en una sola vuelta (`ui.metricas`). Deja cada una en el
 * almacén de la petición, así que las `KpiMetrica` de la página no vuelven a
 * pedirlas. Sin claves trae todo el registro.
 */
export async function precargarMetricas(claves: string[] | null, ctx: ContextoMetrica): Promise<Metrica[]> {
  const mapa = almacen()
  const pedir = claves ? claves.filter((c) => !mapa.has(llave(c, ctx))) : null
  if (pedir && pedir.length === 0) return (await Promise.all(claves!.map((c) => mapa.get(llave(c, ctx))!))).filter((m): m is Metrica => Boolean(m))
  const lote = (async () => {
    const supabase = await createClient()
    const { data } = await supabase.schema('ui').rpc('metricas', { ...(pedir ? { p_claves: pedir } : {}), p_al: ctx.al, ...(ctx.esc ? { p_escenario: ctx.esc } : {}) })
    return ((data ?? []) as unknown[]).map(aMetrica).filter((m): m is Metrica => Boolean(m))
  })()
  for (const c of pedir ?? []) mapa.set(llave(c, ctx), lote.then((l) => l.find((m) => m.clave === c) ?? null))
  const lista = await lote
  if (!claves) for (const m of lista) mapa.set(llave(m.clave, ctx), Promise.resolve(m))
  if (!claves) return lista
  return (await Promise.all(claves.map((c) => mapa.get(llave(c, ctx))!))).filter((m): m is Metrica => Boolean(m))
}

/** ¿La sesión (con «ver como», que solo recorta) puede ver esta cifra? */
export function puedeVerMetrica(sesion: Sesion, m: Pick<Metrica, 'recurso' | 'accion' | 'permitida'>): boolean {
  return m.permitida && (puede(sesion, m.recurso, m.accion) || (m.accion === 'crear' && puede(sesion, m.recurso)))
}

// -----------------------------------------------------------------------------
// Cómo se lee cada cifra
// -----------------------------------------------------------------------------

const d = (m: Metrica, k: string): number => Number(m.detalle?.[k] ?? 0) || 0
const plural = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`

/** El valor como se escribe, según su unidad. */
export function valorMetrica(m: Metrica, complemento = false): { valor: string; unidad?: string } {
  const v = complemento && m.total !== null && m.valor !== null ? m.total - m.valor : m.valor
  if (m.unidad === 'Bs') return { valor: tasa(v), unidad: 'Bs' }
  if (m.unidad === '%') return { valor: porcentaje(v, 2) }
  // Horas (el programa): hasta dos decimales, y la referencia en horas, nunca en dinero.
  if (m.unidad === 'horas') return { valor: `${numero(v, 2, 0)} h`, unidad: m.total !== null ? `de ${numero(m.total)} h` : undefined }
  return { valor: numero(v), unidad: m.total !== null ? `de ${numero(m.total)}` : undefined }
}

/** La línea de comparación de cada métrica: una sola redacción para todas las pantallas. */
const COMPARACION: Record<string, (m: Metrica) => string | null> = {
  dotacion_aprobada: (m) => plural(d(m, 'plazas'), 'plaza vigente', 'plazas vigentes'),
  dotacion_ocupada: (m) =>
    m.total ? `${porcentaje(((m.valor ?? 0) / m.total) * 100, 0)} de lo aprobado · ${numero(d(m, 'por_encima'))} por encima` : null,
  dotacion_vacantes: (m) => `puestos aprobados sin titular · ${plural(d(m, 'plazas_vacias'), 'plaza vacía', 'plazas vacías')}`,
  dotacion_por_encima: (m) => `en ${plural(d(m, 'plazas_por_encima'), 'plaza', 'plazas')}: es un hallazgo, no un error de carga`,
  dotacion_en_requisicion: (m) => (m.detalle?.plan === null || m.detalle?.plan === undefined ? 'Sin plan aprobado del año' : `Plan ${d(m, 'anio')}: ${numero(d(m, 'plan'))}`),
  requisiciones_abiertas: (m) => `${numero(d(m, 'en_aprobacion'))} en aprobación · ${numero(d(m, 'aprobada') + d(m, 'en_seleccion'))} aprobadas o en selección`,
  mis_requisiciones: (m) =>
    [d(m, 'en_aprobacion') && `${numero(d(m, 'en_aprobacion'))} en aprobación`, d(m, 'aprobada') && `${numero(d(m, 'aprobada'))} aprobadas o en selección`, d(m, 'borrador') && `${numero(d(m, 'borrador'))} en borrador`]
      .filter(Boolean)
      .join(' · ') || 'Ninguna viva',
  procesos_catalogo: (m) =>
    `${numero(d(m, 'macro'))} macro · ${numero(d(m, 'proceso'))} proc. · ${numero(d(m, 'subproceso'))} sub. · ${numero(d(m, 'actividad'))} act.${d(m, 'nuevos_en_borrador') ? ` · +${numero(d(m, 'nuevos_en_borrador'))} nuevos en borrador` : ''}`,
  procesos_con_ficha: (m) => (m.total ? `${porcentaje(((m.valor ?? 0) / m.total) * 100, 0)} de los niveles 1 a 3` : 'Sin procesos a esa fecha'),
  procesos_con_dueno: (m) => `${numero(d(m, 'vacante'))} con la plaza dueña vacante`,
  procesos_en_revision: (m) => `${plural(d(m, 'borradores'), 'borrador abierto', 'borradores abiertos')}${d(m, 'aprobadas_por_publicar') ? ` · ${numero(d(m, 'aprobadas_por_publicar'))} por publicar` : ''}`,
  procesos_sin_documentar: (m) => (m.total ? `${porcentaje(((m.valor ?? 0) / m.total) * 100, 0)} del catálogo, sin ficha ni documento` : null),
  procesos_validados: (m) => (m.total ? `${porcentaje(((m.valor ?? 0) / m.total) * 100, 0)} · vigentes que pasaron por la ruta de aprobación` : null),
  documentos_vigentes: (m) => (m.total ? `${porcentaje(((m.valor ?? 0) / m.total) * 100, 0)} del inventario que puedes ver · ${numero(d(m, 'con_proceso'))} con proceso` : null),
  documentos_inventario: (m) => `${numero(d(m, 'vigente'))} vigentes · ${numero(d(m, 'sin_determinar') + d(m, 'borrador'))} sin determinar o borrador · ${numero(d(m, 'obsoleto') + d(m, 'retirado'))} obsoletos o retirados`,
  documentos_en_conciliacion: (m) => `${numero(d(m, 'datos_sensibles'))} con datos sensibles · ${numero(d(m, 'codigo_reutilizado'))} con código reutilizado`,
  tasa_bcv_usd: (m) => {
    const v = m.detalle?.variacion === null || m.detalle?.variacion === undefined ? null : variacion(Number(m.detalle.variacion))
    return m.valor === null ? null : `${v ? `${v.texto} · ` : ''}vale desde ${fechaLarga(String(m.detalle?.fecha_valor ?? ''))}`
  },
  tasa_bcv_eur: (m) => {
    const v = m.detalle?.variacion === null || m.detalle?.variacion === undefined ? null : variacion(Number(m.detalle.variacion))
    return m.valor === null ? null : `${v ? `${v.texto} · ` : ''}vale desde ${fechaLarga(String(m.detalle?.fecha_valor ?? ''))}`
  },
  tasa_paralelo: () => 'Referencia de mercado · uso interno',
  brecha_cambiaria: (m) => {
    const ant = m.detalle?.anterior
    const h30 = m.detalle?.hace_30
    return [ant !== null && ant !== undefined ? `anterior ${porcentaje(Number(ant), 2)}` : null, h30 !== null && h30 !== undefined ? `hace 30 días ${porcentaje(Number(h30), 2)}` : null].filter(Boolean).join(' · ') || null
  },
  mis_tareas: (m) => (d(m, 'vencidas') ? `⚠ ${plural(d(m, 'vencidas'), 'vencida', 'vencidas')}` : d(m, 'vencen_hoy') ? `${numero(d(m, 'vencen_hoy'))} vencen hoy` : 'Ninguna vencida'),
  por_decidir: (m) => (d(m, 'mas_de_5_dias') ? `${numero(d(m, 'mas_de_5_dias'))} esperan más de 5 días` : 'Ninguna espera más de 5 días'),
  // PRG · el programa (lo lee Iberia: en horas y sin alarmas)
  programa_horas_mes: (m) => `promedio de la fase: ${numero(d(m, 'promedio'), 1, 0)} h al mes en ${plural(d(m, 'meses'), 'mes', 'meses')} · acumulado ${numero(d(m, 'acumulado'), 2, 0)} h`,
  programa_sesiones: (m) => `${numero(d(m, 'ent'))} entrevistas · ${numero(d(m, 'ses'))} reuniones y recorridos · ${numero(d(m, 'for'))} formaciones`,
  programa_entregables: (m) => {
    const s = m.detalle?.siguiente as { titulo?: string; fecha?: string } | null | undefined
    return `${numero(d(m, 'proximos_30'))} en 30 días${d(m, 'vencidos') ? ` · ${numero(d(m, 'vencidos'))} con la fecha pasada` : ''}${s?.fecha ? ` · el siguiente, ${fechaLarga(s.fecha)}` : ''}`
  },
  levantamiento_entrevistas: (m) => `meta de ~${numero(m.total)} de la cláusula 5 · ${numero(d(m, 'programada'))} programadas · SES y FOR aparte`,
  levantamiento_archivos: (m) => `${numero(d(m, 'confidenciales'))} confidenciales · ${numero(d(m, 'con_sesion'))} vinculados a una sesión`,
  // NUC-FOR · el curso de Ajito
  formacion_matriculados: (m) => `${numero(d(m, 'en_curso'))} en curso · ${numero(d(m, 'sin_empezar'))} sin empezar${d(m, 'sin_matricula') ? ` · a ${numero(d(m, 'sin_matricula'))} les falta` : ''}`,
  formacion_completaron: (m) => (m.total ? `${porcentaje(((m.valor ?? 0) / m.total) * 100, 0)} de los matriculados` : 'Nadie matriculado todavía'),
  formacion_avance: (m) => (m.detalle?.promedio === null || m.detalle?.promedio === undefined ? 'Sin matrículas' : `${numero(Number(m.detalle.promedio), 1)} de ${numero(d(m, 'lecciones'))} por persona, en promedio`),
  formacion_certificados: (m) => `${plural(d(m, 'entregados'), 'entregado', 'entregados')} en mano · ${numero(d(m, 'sin_entregar'))} por entregar`,
}

export function comparacionMetrica(m: Metrica): string | null {
  return COMPARACION[m.clave]?.(m) ?? null
}

/** El enlace de la cifra con el contexto («Datos al» y escenario) que la calculó. */
export function hrefMetrica(m: Metrica, ctx: ContextoMetrica): string | null {
  if (!m.href) return null
  const q = new URLSearchParams()
  if (m.con_fecha && ctx.al !== hoyCaracas()) q.set('al', ctx.al)
  if (m.con_escenario && ctx.esc) q.set('esc', ctx.esc)
  const s = q.toString()
  return s ? `${m.href}${m.href.includes('?') ? '&' : '?'}${s}` : m.href
}

function selloDe(m: Metrica, ctx: ContextoMetrica): { fuente: string; en: string | null; estado: EstadoFuente; detalle: string } {
  const estadoTasa = m.detalle?.estado as EstadoFuente | undefined
  const en = (m.detalle?.actualizado_en as string | null | undefined) ?? m.calculado_en
  const estado: EstadoFuente = m.error ? 'sin_dato' : estadoTasa ?? (m.valor === null ? 'sin_dato' : 'al_dia')
  const cuando = m.con_fecha ? `Datos al ${fechaLarga(ctx.al)}` : 'Estado de hoy'
  return { fuente: m.fuente, en, estado, detalle: `${cuando}. Hora del último cambio de la fuente.` }
}

/** Lo que dice la ⓘ: la definición del registro, su dueño y cómo se calculó. */
function Ayuda({ m, ctx, parte }: { m: Metrica; ctx: ContextoMetrica; parte?: string }) {
  const hoy = ctx.al === hoyCaracas()
  return (
    <>
      {parte && <span className="mb-1 block text-marca-500">«{parte}» es una parte de esta métrica:</span>}
      <span className="block font-semibold text-marca-900">{m.nombre}</span>
      <span className="mt-1 block">{m.definicion}</span>
      <span className="mt-2 block text-marca-500">
        {m.dueno ? `Dueño: ${m.dueno} · ` : ''}Fuente: {m.fuente}
      </span>
      <span className="block text-marca-500">
        {m.con_fecha ? `Calculada con los datos al ${fechaLarga(ctx.al)}` : hoy ? 'Es el estado de hoy' : `No tiene historia por fecha: es el estado de hoy, no el del ${fechaLarga(ctx.al)}`}
        {m.calculado_en ? ` · ${fechaHora(m.calculado_en)}` : ''}
      </span>
      <span className="block font-mono text-[10.5px] text-marca-400">
        {m.clave} v{m.version}
      </span>
    </>
  )
}

/**
 * El Kpi de una métrica del registro. Sin permiso no se pinta (la base tampoco
 * manda la cifra). `complemento` muestra total − valor con otro título (por
 * ejemplo, «sin ficha» a partir de «con ficha»), sin definir otra métrica.
 */
export async function KpiMetrica({
  clave,
  ctx,
  sesion,
  titulo,
  complemento,
  parte,
  className,
  sinTendencia,
}: {
  clave: string
  ctx: ContextoMetrica
  sesion: Sesion
  titulo?: string
  complemento?: { titulo: string; texto?: string; href?: string }
  /**
   * Una parte del detalle de la métrica como cifra propia (p. ej. «Obsoletos»
   * del inventario). La definición sigue siendo la del registro: no es otra métrica.
   */
  parte?: { detalle: string; titulo: string; texto?: string; href?: string; deTotal?: boolean }
  className?: string
  sinTendencia?: boolean
}) {
  const m = await leerMetrica(clave, ctx)
  if (!m || !puedeVerMetrica(sesion, m)) return null
  const sello = selloDe(m, ctx)
  if (m.error) {
    return (
      <Kpi
        titulo={complemento?.titulo ?? titulo ?? m.nombre}
        valor="—"
        comparacion={{ texto: 'No se pudo calcular ahora' }}
        sello={{ ...sello, detalle: m.error }}
        ayuda={<Ayuda m={m} ctx={ctx} />}
        metrica={m.clave}
        className={className}
      />
    )
  }
  if (parte) {
    const n = Number(m.detalle?.[parte.detalle] ?? 0) || 0
    return (
      <Kpi
        titulo={parte.titulo}
        valor={numero(n)}
        unidad={parte.deTotal && m.valor !== null ? `de ${numero(m.valor)}` : undefined}
        comparacion={{ texto: parte.texto ?? `Parte de «${m.nombre}»` }}
        sello={sello}
        href={parte.href ?? hrefMetrica(m, ctx) ?? undefined}
        ayuda={<Ayuda m={m} ctx={ctx} parte={parte.titulo} />}
        metrica={`${m.clave}.${parte.detalle}`}
        className={className}
      />
    )
  }
  const { valor, unidad } = valorMetrica(m, Boolean(complemento))
  const base = comparacionMetrica(m)
  const texto = complemento ? (complemento.texto ?? `Complemento de «${m.nombre}»`) : base
  const serie = sinTendencia ? undefined : (m.detalle?.serie as (number | null)[] | undefined)?.map((x) => (x === null ? null : Number(x)))
  const avisoHoy = !m.con_fecha && ctx.al !== hoyCaracas() ? ' · estado de hoy' : ''
  return (
    <Kpi
      titulo={complemento?.titulo ?? titulo ?? m.nombre}
      valor={valor}
      unidad={unidad}
      comparacion={texto || avisoHoy ? { texto: `${texto ?? ''}${avisoHoy}` } : null}
      serie={serie}
      escalones={m.unidad === 'Bs'}
      color={m.clave === 'brecha_cambiaria' ? '#8a5a12' : m.clave === 'tasa_paralelo' ? '#b7791f' : m.clave === 'tasa_bcv_eur' ? '#1e8a72' : undefined}
      sello={sello}
      href={complemento?.href ?? hrefMetrica(m, ctx) ?? undefined}
      ayuda={<Ayuda m={m} ctx={ctx} />}
        metrica={complemento ? `${m.clave}~complemento` : m.clave}
      icono={m.recurso === 'sistema:tasas-paralelo' ? <IconoCandadito className="h-3.5 w-3.5 text-[#b7791f]" aria-label="uso interno" /> : undefined}
      className={className}
    />
  )
}

// -----------------------------------------------------------------------------
// La portada de cada rol (Mi día)
// -----------------------------------------------------------------------------

/** Si un rol no tiene portada guardada, la de su nivel. */
export const PORTADA_POR_NIVEL: Record<string, string[]> = {
  // El programa entra en la portada: era lo primero que veía quien abría el panel viejo.
  admin: ['dotacion_ocupada', 'procesos_con_ficha', 'documentos_vigentes', 'requisiciones_abiertas', 'tasa_bcv_usd', 'programa_entregables'],
  consultor: ['dotacion_ocupada', 'procesos_con_ficha', 'documentos_vigentes', 'requisiciones_abiertas', 'tasa_bcv_usd', 'programa_horas_mes'],
  lector: ['dotacion_ocupada', 'dotacion_por_encima', 'procesos_con_ficha', 'brecha_cambiaria', 'programa_entregables', 'levantamiento_entrevistas'],
  usuario: ['mis_requisiciones', 'mis_tareas', 'tasa_bcv_usd'],
}

/**
 * Las cifras de Mi día para la sesión: la portada de su rol (con «ver como», la
 * del rol que se previsualiza) o, si no tiene, la de su nivel.
 */
export const portadaDe = cache(async (sesion: Sesion): Promise<{ claves: string[]; guardada: boolean }> => {
  const supabase = await createClient()
  const { data } = await supabase.schema('ui').from('portada_rol').select('metricas').eq('rol_id', sesion.rol.id).maybeSingle()
  if (data?.metricas?.length) return { claves: data.metricas, guardada: true }
  return { claves: PORTADA_POR_NIVEL[sesion.rol.nivel] ?? PORTADA_POR_NIVEL.usuario, guardada: false }
})
