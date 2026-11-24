import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { DECISION, ESTADO_SOLICITUD, enlaceObjeto } from '@/components/sistema/flujo/formato'
import {
  ESTADOS_OPERATIVOS,
  FASES_PHVA,
  LISTAS_FICHA,
  NIVELES,
  TIPOS,
  TIPOS_CRUCE,
  claveDe,
  comparar,
  normalizarFicha,
  plano,
  vigenciaTexto,
  type Ficha as FichaPhva,
} from '@/components/sistema/procesos/comun'
import { leerCatalogo } from '@/components/sistema/procesos/datos'
import { TIPOS_FICHA, type AccionFicha, type ArchivoFicha, type BloqueFicha, type DatoFicha, type Ficha, type ResultadoAccionFicha, type SeccionFicha, type TonoFicha } from '@/lib/plataforma/ficha-tipos'
import type { EntradaAccionFicha, ManejadorFicha } from '@/lib/plataforma/fichas/acciones'
import { fechaCorta, hoyCaracas } from '@/lib/plataforma/formato'
import { ETIQUETAS_ESTADO_DOC, ETIQUETAS_MOTIVO } from '@/lib/plataforma/tablas-procesos'
import type { Database, Json } from '@/lib/database.types'

type CambioProceso = Database['sgc']['Tables']['proceso']['Update']
type CambioDocumento = Database['sgc']['Tables']['documento']['Update']

/**
 * Las fichas de Procesos y Documentos (R2): el resolutor que arma cada ficha con
 * la sesión de quien mira (RLS) y los manejadores de lo que se edita en ella.
 *
 * Proceso: una versión publicada nunca se edita (trigger en la base). Editar un
 * campo abre el borrador (`sgc.nuevo_borrador`, o devuelve el que ya hay) y lo
 * cambia ahí; «Enviar a revisión» llama a `sgc.enviar_proceso`, que abre la
 * solicitud de la ruta «proceso». Aprobar no se hace en la ficha: lo hace la
 * bandeja, y quien pidió nunca aprueba lo suyo.
 *
 * Documento: corrección trazada de metadatos (la auditoría guarda antes y
 * después) y la cola de conciliación (`sgc.documento_conciliacion`). Los
 * archivos de origen se muestran por su nombre: nunca la ruta del disco.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUMNAS =
  'id, ref, nivel, padre_ref, orden, nombre, tipo, codigo_sgc, generacion, codigo_informe, estado_operativo, dueno_plaza_ref, dueno_texto, area_texto, ficha, estado, version, vigencia, fuente, nota, creado_por, creado_en'

type Version = {
  id: string
  ref: string
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
  fuente: string[]
  nota: string | null
  creado_por: string | null
  creado_en: string
}

/** Solo el nombre del archivo: una ruta de disco («I:\…») no sale nunca de la base. */
export function soloNombre(ruta: string | null | undefined): string | null {
  if (!ruta) return null
  const nombre = ruta.split(/[\\/]/).filter(Boolean).pop() ?? ''
  return nombre.replace(/\.txt$/i, '') || null
}

function vacia(tipo: 'proceso' | 'documento', id: string, titulo: string): Ficha {
  return { tipo, id, tipoEtiqueta: TIPOS_FICHA[tipo], titulo, datos: [], relaciones: [], linea: [], lineaVisible: false, documentos: [], aprobaciones: [], perimetro: false }
}

const ACCION_AUDITORIA: Record<string, string> = { INSERT: 'Creado', UPDATE: 'Modificado', DELETE: 'Eliminado' }
const RUIDO = new Set(['busqueda', 'esc', 'tipo_cat', 'estado_cat', 'perim_cat'])

/** La línea de tiempo desde la auditoría (hasta que R3 la reemplace por `nucleo.evento`). */
async function lineaDe(supabase: Cliente, sesion: Sesion, tablas: { tabla: string; ids: string[] }[]) {
  const visible = puede(sesion, 'sistema:auditoria')
  const ids = tablas.flatMap((t) => t.ids)
  if (!visible || !ids.length) return { linea: [] as Ficha['linea'], visible }
  const consultas = await Promise.all(
    tablas
      .filter((t) => t.ids.length)
      .map((t) =>
        supabase
          .schema('control')
          .from('auditoria')
          .select('accion, en, actor, antes, despues, tabla')
          .eq('esquema', 'sgc')
          .eq('tabla', t.tabla)
          .in('registro_id', t.ids)
          .order('en', { ascending: false })
          .range(0, 29)
      )
  )
  const filas = consultas.flatMap((c) => c.data ?? []).sort((a, b) => (a.en < b.en ? 1 : -1)).slice(0, 40)
  const actores = [...new Set(filas.map((a) => a.actor).filter(Boolean))] as string[]
  const { data: nombres } = actores.length ? await supabase.schema('flujo').rpc('nombres', { p_ids: actores }) : { data: [] as { id: string; nombre: string }[] }
  const nombre = new Map((nombres ?? []).map((p) => [p.id, p.nombre]))
  return {
    visible: true,
    linea: filas.map((a) => {
      const antes = (a.antes ?? {}) as Record<string, unknown>
      const despues = (a.despues ?? {}) as Record<string, unknown>
      const fila = a.accion === 'DELETE' ? antes : despues
      let texto = ACCION_AUDITORIA[a.accion] ?? a.accion
      if (a.tabla === 'documento_conciliacion') {
        texto = a.accion === 'DELETE' ? `Conciliación reabierta · ${ETIQUETAS_MOTIVO[String(fila.motivo)] ?? fila.motivo}` : `Conciliado · ${ETIQUETAS_MOTIVO[String(fila.motivo)] ?? fila.motivo}: ${fila.resolucion ?? ''}`
      } else if (a.accion === 'UPDATE') {
        const cambios = Object.keys(despues).filter((k) => !RUIDO.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
        if (antes.estado !== despues.estado && despues.estado) texto = `${String(antes.estado ?? '—')} → ${String(despues.estado)}`
        else if (cambios.length) texto = `Modificado · ${cambios.slice(0, 5).join(', ')}${cambios.length > 5 ? '…' : ''}`
      } else if (a.accion === 'INSERT' && fila.version) texto = `Versión ${fila.version} creada (${String(fila.estado ?? '')})`
      return { en: a.en, texto, quien: a.actor ? (nombre.get(a.actor) ?? 'Alguien') : 'Sistema (carga)' }
    }),
  }
}

type SolicitudConPasos = {
  id: string
  objeto_id: string
  titulo: string
  estado: string
  paso_actual: number | null
  creado_en: string
  creado_por: string | null
  paso: { orden: number; nombre: string; decision: string; decidido_en: string | null; comentario: string | null; aprobador_plaza_ref: string | null; decidido_por: string | null }[] | null
}

async function solicitudesDe(supabase: Cliente, ids: string[]): Promise<SolicitudConPasos[]> {
  if (!ids.length) return []
  const { data } = await supabase
    .schema('flujo')
    .from('solicitud')
    .select('id, objeto_id, titulo, estado, paso_actual, creado_en, creado_por, paso(orden, nombre, decision, decidido_en, comentario, aprobador_plaza_ref, decidido_por)')
    .in('objeto_id', ids)
    .order('creado_en', { ascending: false })
    .range(0, 19)
  return (data ?? []) as unknown as SolicitudConPasos[]
}

const TONO_DECISION: Record<string, TonoFicha> = { pendiente: 'ambar', aprobado: 'verde', rechazado: 'rojo', devuelto: 'ambar', omitido: 'neutro' }

// ─────────────────────────────────────────────────────────────────────────────
// PROCESO
// ─────────────────────────────────────────────────────────────────────────────

const lineas = (xs: string[]) => (xs.length ? xs.map((x) => `• ${x}`).join('\n') : '—')
const deLineas = (t: string) =>
  t
    .split(/\r?\n/)
    .map((x) => x.replace(/^\s*[•\-*]\s*/, '').trim())
    .filter(Boolean)
const indicadorTexto = (i: FichaPhva['indicadores'][number]) => [i.nombre, i.formula ?? '', i.meta ?? '', i.frecuencia ?? ''].join(' | ').replace(/( \| )+$/, '')

/** Los campos PHVA que se editan como lista (uno por renglón). */
const LISTAS: Record<string, string> = { ...Object.fromEntries(LISTAS_FICHA), ...Object.fromEntries(FASES_PHVA.map(([k, e]) => [`actividades.${k}`, `Actividades · ${e}`])) }

export async function fichaProceso(sesion: Sesion, ref: string): Promise<Ficha | null> {
  if (!puede(sesion, 'sistema:procesos') || !UUID.test(ref)) return null
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  await sgc.rpc('activar_programados')
  const { data } = await sgc.from('proceso').select(COLUMNAS).eq('ref', ref).is('escenario_id', null).order('version', { ascending: false })
  const versiones = (data ?? []) as unknown as Version[]
  if (!versiones.length) return null

  const editar = puede(sesion, 'sistema:procesos', 'editar')
  const crear = puede(sesion, 'sistema:procesos', 'crear')
  const eliminar = puede(sesion, 'sistema:procesos', 'eliminar')
  const vigente = versiones.find((v) => v.estado === 'vigente') ?? null
  const abierto = versiones.find((v) => v.estado === 'borrador' || v.estado === 'en_revision') ?? null
  const programada = versiones.find((v) => v.estado === 'aprobada') ?? null
  // Quien edita trabaja sobre lo abierto; quien lee, sobre lo que rige.
  const p = (editar ? (abierto ?? vigente) : (vigente ?? programada ?? abierto)) ?? versiones[0]
  const enBorrador = p.estado === 'borrador'
  const editable = editar && (enBorrador || (p.estado === 'vigente' && !abierto))
  const f = normalizarFicha(p.ficha)
  const hoy = hoyCaracas()

  const [padres, hijos, docs, cruces, catalogo, plazaDueno, aprob, hist, opcionesPlaza, candidatos] = await Promise.all([
    p.padre_ref || abierto?.padre_ref
      ? sgc.from('proceso').select('ref, nombre, codigo_sgc, codigo_informe').in('ref', [p.padre_ref, vigente?.padre_ref].filter(Boolean) as string[]).is('escenario_id', null).eq('estado', 'vigente')
      : Promise.resolve({ data: [] as { ref: string; nombre: string; codigo_sgc: string | null; codigo_informe: string | null }[] }),
    sgc.from('proceso').select('ref, nombre, codigo_sgc, codigo_informe, nivel, estado').eq('padre_ref', ref).is('escenario_id', null).in('estado', ['vigente', 'borrador', 'en_revision']).order('orden').range(0, 99),
    puede(sesion, 'sistema:documentos')
      ? sgc.rpc('buscar_documentos', { p_proceso: ref, p_limite: 60 })
      : Promise.resolve({ data: [] as { id: string; codigo: string; titulo: string; estado: string; total: number }[] }),
    sgc.from('proceso_cruce').select('id, tipo, confirmado, nota, informe_proceso_id, informe_macro_id').eq('proceso_ref', ref),
    leerCatalogo(supabase),
    p.dueno_plaza_ref ? supabase.schema('ui').rpc('plazas', { p_al: hoy }).eq('ref', p.dueno_plaza_ref).maybeSingle() : Promise.resolve({ data: null }),
    solicitudesDe(supabase, versiones.map((v) => v.id)),
    lineaDe(supabase, sesion, [{ tabla: 'proceso', ids: versiones.map((v) => v.id) }]),
    editable && puede(sesion, 'sistema:estructura')
      ? supabase.schema('ui').rpc('plazas', { p_al: hoy }).select('ref, cargo, unidad').order('cargo').range(0, 1999)
      : Promise.resolve({ data: [] as { ref: string; cargo: string | null; unidad: string | null }[] }),
    editable && p.nivel > 0
      ? sgc.from('proceso').select('ref, nombre, codigo_sgc, codigo_informe').eq('nivel', p.nivel - 1).is('escenario_id', null).eq('estado', 'vigente').order('nombre').range(0, 999)
      : Promise.resolve({ data: [] as { ref: string; nombre: string; codigo_sgc: string | null; codigo_informe: string | null }[] }),
  ])
  const nombrePadre = new Map((padres.data ?? []).map((x) => [x.ref, x]))
  const padre = p.padre_ref ? nombrePadre.get(p.padre_ref) : undefined
  const duenoPlaza = plazaDueno.data as { ref: string; cargo: string | null; unidad: string | null; unidad_ref: string | null; ocupadas: number } | null
  const duenoTexto = duenoPlaza ? [duenoPlaza.cargo, duenoPlaza.unidad].filter(Boolean).join(' · ') : null

  // Cruces con el inventario de la Fase 1 (la RLS del inventario decide si se ven los nombres).
  const procIds = (cruces.data ?? []).map((c) => c.informe_proceso_id).filter(Boolean) as string[]
  const macroIds = (cruces.data ?? []).map((c) => c.informe_macro_id).filter(Boolean) as string[]
  const [{ data: inf }, { data: macs }] = await Promise.all([
    procIds.length ? supabase.from('procesos').select('id, nombre').in('id', procIds) : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    macroIds.length ? supabase.from('macroprocesos').select('id, nombre').in('id', macroIds) : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ])
  const nombreInf = new Map([...(inf ?? []), ...(macs ?? [])].map((x) => [x.id, x.nombre]))

  // Lo que cambia el borrador frente a la vigente.
  const etiquetaPlaza = new Map((opcionesPlaza.data ?? []).map((x) => [x.ref, [x.cargo, x.unidad].filter(Boolean).join(' · ')]))
  if (duenoPlaza) etiquetaPlaza.set(duenoPlaza.ref, duenoTexto ?? 'Plaza')
  const cambios =
    abierto && vigente
      ? comparar(vigente, abierto, (tipo, r) =>
          !r ? '—' : tipo === 'proceso' ? (nombrePadre.get(r)?.nombre ?? 'Otro proceso') : (etiquetaPlaza.get(r) ?? 'Otra plaza')
        )
      : []

  const solicitud = aprob.find((s) => s.objeto_id === abierto?.id) ?? null

  // ── Estado de la ficha ──
  const estado: Ficha['estado'] = !vigente && abierto
    ? { etiqueta: `Nuevo · ${abierto.estado === 'borrador' ? 'borrador' : 'en revisión'}`, tono: 'ambar' }
    : abierto?.estado === 'borrador' && editar
      ? { etiqueta: `Borrador v${abierto.version} · ${cambios.length} ${cambios.length === 1 ? 'cambio' : 'cambios'}`, tono: 'ambar' }
      : abierto?.estado === 'en_revision'
        ? { etiqueta: `En revisión · v${abierto.version}`, tono: 'azul' }
        : programada
          ? { etiqueta: `Aprobada v${programada.version} · rige ${vigenciaTexto(programada.vigencia).toLowerCase()}`, tono: 'azul' }
          : { etiqueta: `Vigente · v${p.version}`, tono: 'verde' }

  // ── Datos (cabecera del proceso) ──
  const campo = (accion: string, control: NonNullable<DatoFicha['editar']>['control'], valor: string | null, extra?: Partial<NonNullable<DatoFicha['editar']>>) =>
    editable ? { editar: { accion, control, valor: valor ?? '', ...extra } } : {}
  const opciones = (m: Record<string, string>, vacio?: string) => [...(vacio !== undefined ? [{ valor: '', etiqueta: vacio }] : []), ...Object.entries(m).map(([valor, etiqueta]) => ({ valor, etiqueta }))]
  const tipos = { ...TIPOS, ...catalogo.tipos }
  const estados = { ...ESTADOS_OPERATIVOS, ...catalogo.estados }
  const origen = f.origen
  const datos: DatoFicha[] = [
    { etiqueta: 'Nombre', valor: p.nombre, ...campo('campo:nombre', 'texto', p.nombre) },
    { etiqueta: 'Nivel', valor: NIVELES[p.nivel] ?? String(p.nivel) },
    { etiqueta: 'Tipo', valor: p.tipo ? (tipos[p.tipo] ?? p.tipo) : '—', ...campo('campo:tipo', 'opciones', p.tipo, { opciones: opciones(tipos, 'Sin tipo') }) },
    { etiqueta: 'Estado operativo', valor: estados[p.estado_operativo] ?? p.estado_operativo, ...campo('campo:estado_operativo', 'opciones', p.estado_operativo, { opciones: opciones(estados) }) },
    { etiqueta: 'Código SGC', valor: p.codigo_sgc ? `${p.codigo_sgc}${p.generacion ? ` (${p.generacion})` : ''}` : '—', mono: true, ...campo('campo:codigo_sgc', 'texto', p.codigo_sgc, { ayuda: 'II-XX (o II-XX-YY-NNN). Un código nuevo lo aprueba Iberia.' }) },
    { etiqueta: 'Código del informe', valor: p.codigo_informe ?? '—', mono: true, ...campo('campo:codigo_informe', 'texto', p.codigo_informe) },
    {
      etiqueta: 'Cuelga de',
      valor: p.nivel === 0 ? 'Es un macroproceso' : padre ? `${padre.codigo_sgc ?? padre.codigo_informe ?? ''} ${padre.nombre}`.trim() : 'Proceso no vigente',
      ...(p.nivel > 0
        ? campo('mover', 'opciones', p.padre_ref, {
            opciones: (candidatos.data ?? []).map((c) => ({ valor: c.ref, etiqueta: `${c.codigo_sgc ?? c.codigo_informe ?? ''} ${c.nombre}`.trim() })),
            ayuda: 'Mover queda en el borrador: rige cuando se apruebe.',
          })
        : {}),
    },
    {
      etiqueta: 'Dueño (plaza)',
      valor: duenoPlaza ? `${duenoTexto}${duenoPlaza.ocupadas === 0 ? ' · ⚠ vacante' : ''}` : p.dueno_plaza_ref ? 'Plaza fuera de tu alcance' : 'Sin plaza asignada',
      ...(opcionesPlaza.data?.length
        ? campo('campo:dueno_plaza_ref', 'opciones', p.dueno_plaza_ref, {
            opciones: [{ valor: '', etiqueta: 'Sin plaza asignada' }, ...(opcionesPlaza.data ?? []).map((x) => ({ valor: x.ref, etiqueta: [x.cargo, x.unidad].filter(Boolean).join(' · ') }))],
            ayuda: 'Cambiar el dueño es sensible: mueve quién aprueba sus documentos. Lo revisa el SGC.',
          })
        : {}),
    },
    { etiqueta: 'Dueño según la fuente', valor: p.dueno_texto ?? '—', ...campo('campo:dueno_texto', 'texto', p.dueno_texto) },
    { etiqueta: 'Área según la fuente', valor: p.area_texto ?? '—', ...campo('campo:area_texto', 'texto', p.area_texto) },
    { etiqueta: 'Versión', valor: `v${p.version} · ${vigenciaTexto(p.vigencia)}${vigente && abierto && editar ? ` · rige la v${vigente.version} hasta que se apruebe` : ''}` },
    {
      etiqueta: 'Hoja de origen',
      valor: origen ? [origen.codigo, origen.anio, soloNombre(origen.archivo), origen.calidad && `texto ${origen.calidad}`].filter(Boolean).join(' · ') : 'Sin hoja PHVA en el levantamiento',
    },
    { etiqueta: 'Nota', valor: p.nota ?? '—', ...campo('campo:nota', 'textoLargo', p.nota) },
  ]

  // ── Ficha PHVA (pestaña propia) ──
  const filaLista = (clave: string, etiqueta: string, items: string[]): DatoFicha => ({
    etiqueta,
    valor: lineas(items),
    ...campo(`phva:${clave}`, 'textoLargo', items.join('\n'), { ayuda: 'Uno por renglón.' }),
  })
  const listas = Object.fromEntries(LISTAS_FICHA) as Record<string, string>
  const bloquesPhva: BloqueFicha[] = [
    {
      tipo: 'datos',
      titulo: 'Propósito',
      filas: [
        { etiqueta: 'Objetivo', valor: f.objetivo || '—', ...campo('phva:objetivo', 'textoLargo', f.objetivo) },
        { etiqueta: 'Alcance', valor: f.alcance || '—', ...campo('phva:alcance', 'textoLargo', f.alcance) },
      ],
    },
    { tipo: 'datos', titulo: 'Entradas y salidas', filas: (['proveedores', 'entradas', 'salidas', 'clientes'] as const).map((k) => filaLista(k, listas[k], f[k])) },
    { tipo: 'datos', titulo: 'Actividades · ciclo PHVA', filas: FASES_PHVA.map(([k, e]) => filaLista(`actividades.${k}`, e, f.actividades[k])) },
    {
      tipo: 'datos',
      titulo: 'Indicadores',
      filas: [
        {
          etiqueta: f.indicadores.length ? `${f.indicadores.length} indicador${f.indicadores.length === 1 ? '' : 'es'}` : 'Indicadores',
          valor: f.indicadores.length
            ? f.indicadores.map((i) => `• ${i.nombre}${i.meta ? ` · meta ${i.meta}` : ' · sin meta'}${i.frecuencia ? ` · ${i.frecuencia}` : ''}${i.formula ? `\n   ${i.formula}` : ''}`).join('\n')
            : 'Sin indicadores en la ficha',
          ...campo('phva:indicadores', 'textoLargo', f.indicadores.map(indicadorTexto).join('\n'), { ayuda: 'Uno por renglón: nombre | fórmula | meta | frecuencia.' }),
        },
      ],
    },
    { tipo: 'datos', titulo: 'Soporte', filas: (['recursos', 'documentos', 'registros', 'requisitos'] as const).map((k) => filaLista(k, listas[k], f[k])) },
    { tipo: 'datos', titulo: 'Riesgos y oportunidades (ISO 9001, por separado)', filas: (['riesgos', 'oportunidades'] as const).map((k) => filaLista(k, listas[k], f[k])) },
    {
      tipo: 'datos',
      titulo: 'De la hoja de origen',
      filas: [
        { etiqueta: 'Dueño según la hoja', valor: f.dueno_segun_ficha ?? '—', ...campo('phva:dueno_segun_ficha', 'texto', f.dueno_segun_ficha) },
        { etiqueta: 'Nota de la ficha', valor: f.nota_ficha ?? '—', ...campo('phva:nota_ficha', 'textoLargo', f.nota_ficha) },
      ],
    },
  ]
  const llenos = [f.objetivo, f.alcance, ...LISTAS_FICHA.map(([k]) => f[k].length), ...FASES_PHVA.map(([k]) => f.actividades[k].length), f.indicadores.length].filter(Boolean).length

  // ── Ciclo: banner, acciones, aprobación y cambios ──
  const bloquesCiclo: BloqueFicha[] = []
  if (!abierto && !programada)
    bloquesCiclo.push({
      tipo: 'texto',
      texto: editar
        ? `Rige la versión ${p.version}. Para cambiarla, edita cualquier campo (o «Abrir borrador»): se abre la versión ${p.version + 1} en borrador y la vigente no se toca hasta que se apruebe.`
        : `Rige la versión ${p.version}.`,
    })
  if (abierto?.estado === 'borrador')
    bloquesCiclo.push({
      tipo: 'texto',
      tono: 'ambar',
      texto: `Borrador v${abierto.version} abierto${vigente ? ` · rige la v${vigente.version} mientras tanto` : ' · proceso nuevo, sin versión vigente'}. ${solicitud?.estado === 'devuelta' ? 'La revisión lo devolvió: corrige lo que dice el comentario y vuelve a enviarlo. ' : ''}Cuando esté listo, «Enviar a revisión»: revisa la Coordinación del SGC y aprueba la Gerencia de Calidad y Desarrollo.`,
    })
  if (abierto?.estado === 'en_revision')
    bloquesCiclo.push({ tipo: 'texto', tono: 'azul', texto: `La v${abierto.version} está en revisión: nadie la edita mientras la ruta decide. Si la devuelven, vuelve a ser borrador.` })
  if (programada) bloquesCiclo.push({ tipo: 'texto', tono: 'azul', texto: `La v${programada.version} está aprobada y entra en vigor ${vigenciaTexto(programada.vigencia).toLowerCase()}.` })

  const accionesCiclo: AccionFicha[] = []
  if (editar && abierto?.estado === 'borrador') accionesCiclo.push({ accion: 'enviar', etiqueta: 'Enviar a revisión', tono: 'principal', confirmar: `¿Enviar la v${abierto.version} a revisión? Mientras la ruta decide, nadie la edita.` })
  if (eliminar && abierto?.estado === 'borrador' && vigente)
    accionesCiclo.push({ accion: 'descartar', etiqueta: 'Descartar borrador', tono: 'peligro', confirmar: 'Se pierden los cambios del borrador; la versión vigente no se toca. ¿Descartarlo?' })
  if (editar && !abierto && vigente && !programada) accionesCiclo.push({ accion: 'abrir_borrador', etiqueta: 'Abrir borrador', tono: 'neutro' })
  if (accionesCiclo.length) bloquesCiclo.push({ tipo: 'acciones', acciones: accionesCiclo })

  if (solicitud)
    bloquesCiclo.push({
      tipo: 'pasos',
      titulo: `Aprobación · ${ESTADO_SOLICITUD[solicitud.estado]?.etiqueta ?? solicitud.estado}`,
      pasos: [...(solicitud.paso ?? [])]
        .sort((a, b) => a.orden - b.orden)
        .map((x) => ({
          orden: x.orden,
          nombre: x.nombre,
          estado: solicitud.estado === 'en_curso' && solicitud.paso_actual === x.orden ? 'Le toca' : (DECISION[x.decision]?.etiqueta ?? x.decision),
          tono: solicitud.estado === 'en_curso' && solicitud.paso_actual === x.orden ? 'ambar' : (TONO_DECISION[x.decision] ?? 'neutro'),
          en: x.decidido_en,
          comentario: x.comentario,
        })),
    })
  if (abierto && vigente)
    bloquesCiclo.push({
      tipo: 'lista',
      titulo: `Qué cambia frente a la v${vigente.version}`,
      vacio: 'Todavía no hay cambios: el borrador es igual a la vigente.',
      items: cambios.map((c) => ({
        tipo: c.campo,
        titulo: c.agregados || c.quitados ? [...(c.quitados ?? []).map((x) => `− ${x}`), ...(c.agregados ?? []).map((x) => `+ ${x}`)].join('\n') : `${c.antes} → ${c.despues}`,
      })),
    })

  // ── Calidad del dato ──
  const notas: string[] = []
  const duenoCatalogo = duenoTexto ?? p.dueno_texto ?? ''
  if (f.dueno_segun_ficha && !plano(duenoCatalogo).includes(plano(f.dueno_segun_ficha)))
    notas.push(`La hoja PHVA dice que el dueño es «${f.dueno_segun_ficha}», y el catálogo dice «${duenoCatalogo || 'sin dueño'}». Hay que confirmar cuál vale hoy.`)
  if (!p.dueno_plaza_ref && p.dueno_texto) notas.push(`El dueño viene como texto de la fuente («${p.dueno_texto}») y todavía no está casado con una plaza de la estructura.`)
  if (duenoPlaza && duenoPlaza.ocupadas === 0) notas.push('La plaza dueña está vacante: nadie firma por este proceso hoy.')
  if (llenos > 0 && !f.indicadores.length) notas.push('La ficha no tiene indicadores: el proceso no se puede medir.')
  if (origen?.codigo && p.codigo_sgc && origen.codigo.slice(0, 5) !== p.codigo_sgc.slice(0, 5)) notas.push(`La hoja de origen usa el código ${origen.codigo}, que no es del ${p.codigo_sgc}: código dudoso.`)
  if (f.nota_ficha) notas.push(`Nota de la carga: ${f.nota_ficha}`)

  const secciones: SeccionFicha[] = [
    { clave: 'phva', etiqueta: 'Ficha PHVA', n: llenos || undefined, bloques: bloquesPhva },
    { clave: 'ciclo', etiqueta: 'Ciclo', n: cambios.length || undefined, bloques: bloquesCiclo },
    ...(notas.length ? [{ clave: 'calidad', etiqueta: 'Calidad del dato', n: notas.length, bloques: notas.map((t) => ({ tipo: 'texto' as const, texto: t, tono: 'ambar' as const })) }] : []),
  ]

  const acciones: AccionFicha[] = [...accionesCiclo.filter((a) => a.accion === 'enviar')]
  if (crear && p.nivel < 3 && vigente)
    acciones.push({ accion: 'hijo', etiqueta: `＋ ${NIVELES[p.nivel + 1] ?? 'Hijo'}`, tono: 'neutro', motivo: 'obligatorio', rotuloMotivo: `Nombre del ${(NIVELES[p.nivel + 1] ?? 'proceso').toLowerCase()} (nace en borrador)` })
  acciones.push({ href: `/sistema/nucleo/procesos/${ref}/imprimir`, etiqueta: 'Imprimir', tono: 'neutro' })

  const docsLista = (docs.data ?? []) as { id: string; codigo: string; titulo: string; estado: string; total: number }[]
  return {
    ...vacia('proceso', ref, p.nombre),
    subtitulo: [NIVELES[p.nivel], p.tipo ? tipos[p.tipo] : null, duenoTexto ?? p.dueno_texto].filter(Boolean).join(' · '),
    codigo: p.codigo_sgc ?? p.codigo_informe,
    estado,
    hrefModulo: `/sistema/nucleo/procesos/${ref}`,
    datos,
    secciones,
    acciones,
    relaciones: [
      ...(padre ? [{ tipo: 'Pertenece a', titulo: padre.nombre, detalle: padre.codigo_sgc ?? padre.codigo_informe, ficha: `proceso:${padre.ref}` }] : []),
      ...(hijos.data ?? []).map((h) => ({
        tipo: NIVELES[h.nivel] ?? 'Hijo',
        titulo: h.nombre,
        detalle: [h.codigo_sgc ?? h.codigo_informe, h.estado !== 'vigente' ? (h.estado === 'borrador' ? 'nuevo · borrador' : 'nuevo · en revisión') : null].filter(Boolean).join(' · ') || null,
        ficha: `proceso:${h.ref}`,
      })),
      ...(duenoPlaza ? [{ tipo: 'Plaza dueña', titulo: duenoPlaza.cargo ?? 'Plaza', detalle: `${duenoPlaza.unidad ?? ''}${duenoPlaza.ocupadas === 0 ? ' · vacante' : ''}`, ficha: `plaza:${duenoPlaza.ref}` }] : []),
      ...(duenoPlaza?.unidad_ref ? [{ tipo: 'Unidad dueña', titulo: duenoPlaza.unidad ?? 'Unidad', ficha: `unidad:${duenoPlaza.unidad_ref}` }] : []),
      ...(cruces.data ?? []).map((c) => ({
        tipo: 'Cruce Fase 1',
        titulo: (c.informe_proceso_id && nombreInf.get(c.informe_proceso_id)) || (c.informe_macro_id && nombreInf.get(c.informe_macro_id)) || (c.informe_proceso_id || c.informe_macro_id ? 'Proceso del informe (sin acceso)' : 'Sin par en el informe'),
        detalle: `${TIPOS_CRUCE[c.tipo] ?? c.tipo} · ${c.confirmado ? 'confirmado' : 'por confirmar'}${c.nota ? ` · ${c.nota}` : ''}`,
        href: '/sistema/nucleo/procesos/cruce',
      })),
    ],
    documentos: docsLista.map((d) => ({ codigo: d.codigo, titulo: d.titulo, estado: ETIQUETAS_ESTADO_DOC[d.estado] ?? d.estado, href: `/sistema/nucleo/documentos/${d.id}` })),
    aprobaciones: aprob.map((s) => ({
      titulo: s.titulo,
      estado: ESTADO_SOLICITUD[s.estado]?.etiqueta ?? s.estado,
      creado_en: s.creado_en,
      href: enlaceObjeto('proceso', s.objeto_id, ref),
      pasos: [...(s.paso ?? [])].sort((a, b) => a.orden - b.orden).map((x) => ({ orden: x.orden, nombre: x.nombre, decision: DECISION[x.decision]?.etiqueta ?? x.decision, decidido_en: x.decidido_en })),
    })),
    linea: hist.linea,
    lineaVisible: hist.visible,
  }
}

// ── Lo que se edita en la ficha de un proceso ──

function mensajeDe(error: { message: string; code?: string }): string {
  if (error.code === '42501') return 'No tienes permiso para hacer eso.'
  if (error.code === '23P01') return 'Ya hay otra versión vigente que choca con esas fechas.'
  if (error.code === '23503') return 'Ese valor no está en el catálogo.'
  return error.message
}

/** El borrador abierto del proceso, o uno nuevo desde la vigente. */
async function borradorDe(supabase: Cliente, ref: string): Promise<{ id: string; nivel: number; ficha: unknown; estado: string } | { error: string }> {
  const { data: id, error } = await supabase.schema('sgc').rpc('nuevo_borrador', { p_ref: ref })
  if (error || !id) {
    // Un proceso nuevo (sin vigente) ya es borrador: se edita ese.
    const { data: nuevo } = await supabase.schema('sgc').from('proceso').select('id, nivel, ficha, estado').eq('ref', ref).is('escenario_id', null).eq('estado', 'borrador').maybeSingle()
    if (nuevo) return nuevo
    return { error: mensajeDe(error ?? { message: 'No se pudo abrir el borrador.' }) }
  }
  const { data } = await supabase.schema('sgc').from('proceso').select('id, nivel, ficha, estado').eq('id', id).maybeSingle()
  if (!data) return { error: 'No se encontró el borrador.' }
  if (data.estado !== 'borrador') return { error: 'Este proceso tiene una versión en revisión: espera la decisión antes de cambiarlo.' }
  return data
}

async function validarPadre(supabase: Cliente, padre: string | null, nivel: number): Promise<string | null> {
  if (nivel === 0) return padre ? 'Un macroproceso no cuelga de otro proceso.' : null
  if (!padre || !UUID.test(padre)) return 'Elige de qué proceso cuelga.'
  const { data } = await supabase.schema('sgc').from('proceso').select('nivel').eq('ref', padre).is('escenario_id', null).eq('estado', 'vigente').limit(1).maybeSingle()
  if (!data) return 'El proceso padre no existe o no está vigente.'
  if (data.nivel !== nivel - 1) return 'El proceso padre tiene que estar exactamente un nivel arriba.'
  return null
}

const CAMPOS_NODO = new Set(['nombre', 'tipo', 'estado_operativo', 'codigo_sgc', 'codigo_informe', 'dueno_plaza_ref', 'dueno_texto', 'area_texto', 'nota'])

/** Aplica un cambio de la ficha PHVA (lista, texto o indicadores) sobre el JSON del borrador. */
function aplicarPhva(ficha: unknown, clave: string, valor: string): Json {
  const previa = (ficha && typeof ficha === 'object' && !Array.isArray(ficha) ? ficha : {}) as Record<string, unknown>
  const f = normalizarFicha(previa)
  const texto = valor.trim()
  if (clave === 'objetivo' || clave === 'alcance') f[clave] = texto
  else if (clave === 'dueno_segun_ficha' || clave === 'nota_ficha') f[clave] = texto || null
  else if (clave === 'indicadores')
    f.indicadores = deLineas(valor).map((l) => {
      const [nombre, formula, meta, frecuencia] = l.split('|').map((x) => x.trim())
      return { nombre, formula: formula || null, meta: meta || null, frecuencia: frecuencia || null }
    })
  else if (clave.startsWith('actividades.')) {
    const fase = clave.slice('actividades.'.length) as keyof FichaPhva['actividades']
    if (!(fase in f.actividades)) throw new Error('Fase PHVA no válida.')
    f.actividades[fase] = deLineas(valor)
  } else if (LISTAS[clave]) (f as unknown as Record<string, string[]>)[clave] = deLineas(valor)
  else throw new Error('Ese campo de la ficha no existe.')
  // Lo que la pantalla no edita (el origen de la hoja, claves de la carga) se conserva.
  return JSON.parse(JSON.stringify({ ...previa, ...f, origen: previa.origen ?? null, objetivo: f.objetivo || null, alcance: f.alcance || null })) as Json
}

export const manejarProceso: ManejadorFicha = async (sesion, ref, accion, entrada: EntradaAccionFicha): Promise<ResultadoAccionFicha> => {
  if (!UUID.test(ref)) return { error: 'Proceso no válido.' }
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const valor = (entrada.valor ?? '').trim()

  if (accion === 'hijo') {
    if (!puede(sesion, 'sistema:procesos', 'crear')) return { error: 'No tienes permiso para crear procesos.' }
    return crearHijo(supabase, ref, entrada.motivo ?? entrada.valor ?? '')
  }
  if (!puede(sesion, 'sistema:procesos', 'editar')) return { error: 'No tienes permiso para editar procesos.' }

  if (accion === 'abrir_borrador') {
    const b = await borradorDe(supabase, ref)
    return 'error' in b ? b : { ok: 'Borrador abierto: edita los campos y envíalo a revisión.' }
  }

  if (accion === 'enviar' || accion === 'descartar') {
    const { data: b } = await sgc.from('proceso').select('id, version').eq('ref', ref).is('escenario_id', null).eq('estado', 'borrador').maybeSingle()
    if (!b) return { error: 'No hay un borrador abierto.' }
    if (accion === 'enviar') {
      const { error } = await sgc.rpc('enviar_proceso', { p_id: b.id })
      return error ? { error: mensajeDe(error) } : { ok: `v${b.version} enviada a revisión. La decide la bandeja de quien firma.` }
    }
    if (!puede(sesion, 'sistema:procesos', 'eliminar')) return { error: 'Descartar un borrador pide el permiso de eliminar procesos.' }
    const { data: vig } = await sgc.from('proceso').select('id').eq('ref', ref).is('escenario_id', null).eq('estado', 'vigente').maybeSingle()
    const { error, count } = await sgc.from('proceso').delete({ count: 'exact' }).eq('id', b.id).eq('estado', 'borrador')
    if (error) return { error: mensajeDe(error) }
    if (!count) return { error: 'No se descartó: el borrador ya no existe o está fuera de tu alcance.' }
    return vig ? { ok: 'Borrador descartado. Rige la versión vigente.' } : { ok: 'Borrador descartado.', href: '/sistema/nucleo/procesos/catalogo' }
  }

  const b = await borradorDe(supabase, ref)
  if ('error' in b) return b

  if (accion === 'mover') {
    const padre = valor || null
    const err = await validarPadre(supabase, padre, b.nivel)
    if (err) return { error: err }
    const { error } = await sgc.from('proceso').update({ padre_ref: padre }).eq('id', b.id).eq('estado', 'borrador')
    return error ? { error: mensajeDe(error) } : { ok: 'Movido en el borrador. Rige cuando se apruebe.' }
  }

  if (accion.startsWith('campo:')) {
    const col = accion.slice('campo:'.length)
    if (!CAMPOS_NODO.has(col)) return { error: 'Ese campo no se edita desde la ficha.' }
    if (col === 'nombre' && valor.length < 3) return { error: 'El nombre necesita al menos tres letras.' }
    if (col === 'codigo_sgc' && valor && !/^II-\d{2}(-\d{2}){0,2}(-\d{3})?$/.test(valor)) return { error: 'El código SGC va como II-XX (o II-XX-YY-NNN).' }
    if (col === 'dueno_plaza_ref' && valor && !UUID.test(valor)) return { error: 'Plaza no válida.' }
    const cambio = { [col]: col === 'estado_operativo' ? valor || 'vigente' : valor || null }
    const { error } = await sgc.from('proceso').update(cambio as CambioProceso).eq('id', b.id).eq('estado', 'borrador')
    return error ? { error: mensajeDe(error) } : { ok: 'Guardado en el borrador.' }
  }

  if (accion.startsWith('phva:')) {
    let ficha: Json
    try {
      ficha = aplicarPhva(b.ficha, accion.slice('phva:'.length), entrada.valor ?? '')
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'No se pudo leer el cambio.' }
    }
    const { error } = await sgc.from('proceso').update({ ficha }).eq('id', b.id).eq('estado', 'borrador')
    return error ? { error: mensajeDe(error) } : { ok: 'Guardado en el borrador.' }
  }

  return { error: 'Acción no reconocida.' }
}

/** Un proceso hijo nuevo: nace como borrador, versión 1, sin vigencia. Devuelve su ficha. */
export async function crearHijo(supabase: Cliente, padreRef: string, nombreCrudo: string): Promise<ResultadoAccionFicha> {
  const nombre = nombreCrudo.trim()
  if (nombre.length < 3) return { error: 'El nombre necesita al menos tres letras.' }
  const sgc = supabase.schema('sgc')
  const { data: padre } = await sgc
    .from('proceso')
    .select('ref, nivel, tipo, dueno_plaza_ref, dueno_texto, area_texto')
    .eq('ref', padreRef)
    .is('escenario_id', null)
    .eq('estado', 'vigente')
    .maybeSingle()
  if (!padre) return { error: 'El proceso padre no está vigente.' }
  if (padre.nivel >= 3) return { error: 'Las actividades (nivel 3) no tienen hijos.' }
  const { count } = await sgc.from('proceso').select('id', { count: 'exact', head: true }).eq('padre_ref', padreRef).is('escenario_id', null)
  const ref = crypto.randomUUID()
  const { error } = await sgc.from('proceso').insert({
    id: crypto.randomUUID(),
    ref,
    clave: claveDe(nombre),
    nivel: padre.nivel + 1,
    padre_ref: padreRef,
    orden: 10000 + (count ?? 0),
    nombre,
    tipo: padre.tipo,
    codigo_sgc: null,
    codigo_informe: null,
    estado_operativo: 'propuesto',
    dueno_plaza_ref: padre.dueno_plaza_ref,
    dueno_texto: padre.dueno_plaza_ref ? null : padre.dueno_texto,
    area_texto: padre.area_texto,
    ficha: {},
    estado: 'borrador',
    version: 1,
    vigencia: null,
    fuente: ['plataforma'],
    nota: null,
  })
  if (error) return { error: mensajeDe(error) }
  return { ok: `«${nombre}» creado en borrador. Completa su ficha y envíalo a revisión.`, ficha: `proceso:${ref}` }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTO
// ─────────────────────────────────────────────────────────────────────────────

const DESTINOS: Record<string, string> = { formulario: 'Formulario de la plataforma', funcion: 'Función del sistema', vista_espejo: 'Vista del espejo de JD', no_migra: 'No migra' }

export async function fichaDocumento(sesion: Sesion, id: string): Promise<Ficha | null> {
  if (!puede(sesion, 'sistema:documentos') || !UUID.test(id)) return null
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  // La RLS decide: un documento de perímetro, sin el permiso, no existe.
  const { data: d } = await sgc.from('documento').select('*').eq('id', id).maybeSingle()
  if (!d) return null
  const editar = puede(sesion, 'sistema:documentos', 'editar')

  const [{ data: tipos }, proc, { data: decisiones }, { data: mismos }, hist, opcionesProceso, opciones] = await Promise.all([
    d.tipo_yy ? sgc.from('tipo_documento').select('yy, generacion, nombre').eq('yy', d.tipo_yy) : Promise.resolve({ data: [] as { yy: string; generacion: string; nombre: string }[] }),
    d.proceso_ref ? sgc.from('proceso').select('ref, nombre, codigo_sgc, codigo_informe').eq('ref', d.proceso_ref).is('escenario_id', null).eq('estado', 'vigente').maybeSingle() : Promise.resolve({ data: null }),
    sgc.from('documento_conciliacion').select('motivo, resolucion, decidido_por, decidido_en').eq('documento_id', id),
    sgc.from('documento').select('id, titulo, estado').eq('codigo', d.codigo).neq('id', id).range(0, 19),
    lineaDe(supabase, sesion, [{ tabla: 'documento', ids: [id] }]),
    editar && puede(sesion, 'sistema:procesos')
      ? sgc.from('proceso').select('ref, nombre, nivel, codigo_sgc, codigo_informe').is('escenario_id', null).eq('estado', 'vigente').lte('nivel', 2).order('codigo_informe').range(0, 999)
      : Promise.resolve({ data: [] as { ref: string; nombre: string; nivel: number; codigo_sgc: string | null; codigo_informe: string | null }[] }),
    editar ? sgc.rpc('opciones_documentos') : Promise.resolve({ data: [] as { campo: string; valor: string; total: number }[] }),
  ])
  const archivosCargados = await archivosDeDocumento(supabase, id)
  // La auditoría de la conciliación se guarda con el id de cada decisión: se buscan aparte.
  const { data: idsConc } = await sgc.from('documento_conciliacion').select('id').eq('documento_id', id)
  const histConc = idsConc?.length ? await lineaDe(supabase, sesion, [{ tabla: 'documento_conciliacion', ids: idsConc.map((x) => x.id) }]) : { linea: [], visible: hist.visible }
  const linea = [...hist.linea, ...histConc.linea].sort((a, b) => (a.en < b.en ? 1 : -1))

  const actores = [...new Set((decisiones ?? []).map((x) => x.decidido_por))]
  const { data: nombres } = actores.length ? await supabase.schema('flujo').rpc('nombres', { p_ids: actores }) : { data: [] as { id: string; nombre: string }[] }
  const nombreDe = new Map((nombres ?? []).map((n) => [n.id, n.nombre]))
  const tipoNombre = [...new Set((tipos ?? []).map((t) => t.nombre))].join(' · ') || null
  const archivos = [...new Set((d.archivos as string[]).map(soloNombre).filter(Boolean))] as string[]
  const p = proc.data as { ref: string; nombre: string; codigo_sgc: string | null; codigo_informe: string | null } | null

  const campo = (accion: string, control: NonNullable<DatoFicha['editar']>['control'], valor: string | null, extra?: Partial<NonNullable<DatoFicha['editar']>>) =>
    editar ? { editar: { accion, control, valor: valor ?? '', ...extra } } : {}
  const familias = (opciones.data ?? []).filter((o) => o.campo === 'familia' && o.valor).map((o) => o.valor as string)

  const datos: DatoFicha[] = [
    ...(d.datos_sensibles
      ? [{ etiqueta: '⚠ Aviso', valor: 'Contiene datos personales o credenciales. No se publica ni se difunde hasta sanearlo; si trae claves, se reportan a TI para rotarlas.' }]
      : []),
    { etiqueta: 'Código', valor: d.codigo, mono: true },
    { etiqueta: 'Título', valor: d.titulo },
    { etiqueta: 'Estado', valor: ETIQUETAS_ESTADO_DOC[d.estado] ?? d.estado, ...campo('campo:estado', 'opciones', d.estado, { opciones: Object.entries(ETIQUETAS_ESTADO_DOC).map(([valor, etiqueta]) => ({ valor, etiqueta })) }) },
    { etiqueta: 'Evidencia del estado', valor: d.evidencia_estado ?? '—' },
    { etiqueta: 'Tipo (YY)', valor: d.tipo_yy ? `${d.tipo_yy}${tipoNombre ? ` · ${tipoNombre}` : ''}` : '—', mono: false },
    { etiqueta: 'Proceso (XX)', valor: d.proceso_xx ?? '—', mono: true },
    {
      etiqueta: 'Proceso vinculado',
      valor: p ? `${p.codigo_sgc ?? p.codigo_informe ?? ''} ${p.nombre}`.trim() : d.proceso_ref ? 'Proceso no vigente o fuera de tu alcance' : 'Sin proceso',
      ...(opcionesProceso.data?.length
        ? campo('campo:proceso_ref', 'opciones', d.proceso_ref, {
            opciones: [
              { valor: '', etiqueta: 'Sin proceso' },
              ...(opcionesProceso.data ?? []).map((x) => ({ valor: x.ref, etiqueta: `${'  '.repeat(x.nivel)}${x.codigo_sgc ?? x.codigo_informe ?? ''} ${x.nombre}`.trim() })),
            ],
          })
        : {}),
    },
    { etiqueta: 'Versión', valor: d.version ?? '—' },
    { etiqueta: 'Fecha', valor: fechaCorta(d.fecha) },
    { etiqueta: 'Familia', valor: d.familia ?? '—', ...campo('campo:familia', 'texto', d.familia, { ayuda: familias.length ? `Existentes: ${familias.slice(0, 12).join(', ')}` : undefined }) },
    { etiqueta: 'Destino en la plataforma', valor: d.destino ? (DESTINOS[d.destino] ?? d.destino) : 'Sin decidir', ...campo('campo:destino', 'opciones', d.destino, { opciones: [{ valor: '', etiqueta: 'Sin decidir' }, ...Object.entries(DESTINOS).map(([valor, etiqueta]) => ({ valor, etiqueta }))] }) },
    { etiqueta: 'Perímetro', valor: d.perimetro === 'general' ? 'General' : `🔒 ${d.perimetro}` },
    {
      etiqueta: 'Datos sensibles',
      valor: d.datos_sensibles ? 'Sí' : 'No',
      ...campo('campo:datos_sensibles', 'opciones', d.datos_sensibles ? 'si' : 'no', {
        opciones: [
          { valor: 'si', etiqueta: 'Sí: trae datos personales o credenciales' },
          { valor: 'no', etiqueta: 'No (ya se saneó o no los trae)' },
        ],
      }),
    },
    { etiqueta: 'Alias', valor: d.alias.length ? d.alias.join('\n') : '—', mono: true, ...campo('campo:alias', 'textoLargo', d.alias.join('\n'), { ayuda: 'Códigos anteriores u otros nombres, uno por renglón.' }) },
    { etiqueta: 'Nota', valor: d.nota ?? '—', ...campo('campo:nota', 'textoLargo', d.nota) },
  ]

  // ── La cola de conciliación de este documento ──
  const decidido = new Map((decisiones ?? []).map((x) => [x.motivo, x]))
  const motivos: { motivo: string; detalle: string }[] = [
    ...(d.datos_sensibles ? [{ motivo: 'datos_sensibles', detalle: 'Trae datos personales o credenciales: sanear antes de difundir.' }] : []),
    ...(mismos?.length ? [{ motivo: 'codigo_reutilizado', detalle: `El código lo usan también: ${(mismos ?? []).map((m) => `«${m.titulo}» (${ETIQUETAS_ESTADO_DOC[m.estado] ?? m.estado})`).join('; ')}.` }] : []),
    ...(d.estado === 'sin_determinar' ? [{ motivo: 'sin_determinar', detalle: d.evidencia_estado ? `Evidencia: ${d.evidencia_estado}` : 'Sin evidencia del estado: decidir si es vigente, obsoleto o se retira.' }] : []),
    ...(d.estado === 'obsoleto' ? [{ motivo: 'obsoleto', detalle: 'Confirmar que se retira de la circulación (o rescatarlo como vigente).' }] : []),
  ]
  const pendientes = motivos.filter((m) => !decidido.has(m.motivo)).length
  const secciones: SeccionFicha[] = []
  if (motivos.length)
    secciones.push({
      clave: 'conciliacion',
      etiqueta: 'Conciliación',
      n: pendientes || undefined,
      bloques: [
        {
          tipo: 'pasos',
          titulo: pendientes ? `${pendientes} por decidir` : 'Todo decidido',
          pasos: motivos.map((m, i) => {
            const x = decidido.get(m.motivo)
            return {
              orden: i + 1,
              nombre: ETIQUETAS_MOTIVO[m.motivo] ?? m.motivo,
              quien: x ? (nombreDe.get(x.decidido_por) ?? null) : null,
              estado: x ? 'Decidido' : 'Pendiente',
              tono: x ? 'verde' : 'ambar',
              en: x?.decidido_en ?? null,
              comentario: x?.resolucion ?? null,
              nota: m.detalle,
              acciones: editar
                ? x
                  ? [{ accion: 'reabrir', param: m.motivo, etiqueta: 'Reabrir', tono: 'neutro' as const, confirmar: 'El punto vuelve a la cola. ¿Reabrirlo?' }]
                  : [{ accion: 'conciliar', param: m.motivo, etiqueta: 'Marcar resuelto', tono: 'principal' as const, motivo: 'obligatorio' as const, rotuloMotivo: 'Qué se decidió (queda en la auditoría)' }]
                : undefined,
            }
          }),
        },
      ],
    })
  secciones.push(
    archivosCargados
      ? {
          clave: 'origen',
          etiqueta: 'Archivos de origen',
          n: archivosCargados.length || undefined,
          bloques: [
            ...(archivosCargados.some((a) => a.estado !== 'disponible')
              ? [{ tipo: 'texto' as const, texto: avisoArchivos(archivosCargados) }]
              : []),
            { tipo: 'archivos', archivos: archivosCargados, vacio: 'Sin archivo propio: solo citado en un listado o anexo.' },
          ],
        }
      : {
          clave: 'origen',
          etiqueta: 'Archivos de origen',
          n: archivos.length || undefined,
          bloques: [
            { tipo: 'texto', texto: 'Los archivos del levantamiento no están cargados en la plataforma: aquí va solo su nombre, para ubicarlos en el repositorio de Iberia.' },
            { tipo: 'lista', items: archivos.map((a) => ({ tipo: 'Archivo', titulo: a })), vacio: 'Sin archivo propio: solo citado en un listado o anexo.' },
          ],
        }
  )

  const tono: TonoFicha = d.estado === 'vigente' ? 'verde' : d.estado === 'obsoleto' || d.estado === 'retirado' ? 'neutro' : 'ambar'
  return {
    ...vacia('documento', id, d.titulo),
    subtitulo: [tipoNombre, p?.nombre, d.datos_sensibles ? '⚠ datos sensibles' : null].filter(Boolean).join(' · ') || null,
    codigo: d.codigo,
    estado: { etiqueta: `${ETIQUETAS_ESTADO_DOC[d.estado] ?? d.estado}${d.version ? ` · v${d.version}` : ''}`, tono },
    hrefModulo: `/sistema/nucleo/documentos/${id}`,
    datos,
    secciones,
    relaciones: [
      ...(p ? [{ tipo: 'Proceso', titulo: p.nombre, detalle: p.codigo_sgc ?? p.codigo_informe, ficha: `proceso:${p.ref}` }] : []),
      ...(mismos ?? []).map((m) => ({ tipo: 'Mismo código', titulo: m.titulo, detalle: ETIQUETAS_ESTADO_DOC[m.estado] ?? m.estado, ficha: `documento:${m.id}` })),
    ],
    linea,
    lineaVisible: hist.visible,
    perimetro: d.perimetro !== 'general' || d.datos_sensibles,
  }
}

/**
 * Los archivos cargados de un documento (`sgc.documento_archivo`, con la RLS de quien mira). `null` si la tabla no
 * existe todavía (antes de la migración del 24-nov-2026): la ficha vuelve a la lista de nombres.
 */
async function archivosDeDocumento(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<ArchivoFicha[] | null> {
  const { data, error } = await supabase
    .schema('sgc')
    .from('documento_archivo')
    .select('id, nombre, formato, estado, pdf_ruta, pdf_tamano, paginas, original_ruta, tamano_original')
    .eq('documento_id', id)
    .order('orden')
    .range(0, 99)
  if (error) return null
  const BASE_ARCHIVO = '/sistema/nucleo/documentos/archivo'
  return (data ?? []).map((a) => {
    const disponible = a.estado === 'disponible' && !!a.pdf_ruta
    const detalle = disponible
      ? [`${a.formato.toUpperCase()} → PDF`, a.paginas ? `${a.paginas} pág.` : null, a.pdf_tamano ? pesoLegible(a.pdf_tamano) : null].filter(Boolean).join(' · ')
      : ESTADO_ARCHIVO[a.estado as ArchivoFicha['estado']] ?? a.estado
    return {
      id: a.id,
      nombre: a.nombre,
      formato: a.formato,
      estado: a.estado as ArchivoFicha['estado'],
      detalle,
      ver: disponible ? `${BASE_ARCHIVO}/${a.id}/ver` : null,
      descargar: disponible ? `${BASE_ARCHIVO}/${a.id}/descargar` : null,
      original: a.original_ruta ? `${BASE_ARCHIVO}/${a.id}/descargar?original=1` : null,
    }
  })
}

const ESTADO_ARCHIVO: Record<ArchivoFicha['estado'], string> = {
  disponible: 'Disponible',
  pendiente_plan: 'Se carga con la ampliación del almacenamiento',
  sin_conversion: 'Formato sin vista previa: se carga el original con la ampliación',
  retenido: 'Trae datos personales: se carga cuando se sanee',
  falta: 'No está en la copia del repositorio',
}

function avisoArchivos(xs: ArchivoFicha[]): string {
  const n = xs.filter((a) => a.estado === 'disponible').length
  if (!n) return 'Los archivos de este documento todavía no se pueden ver aquí: cada uno dice por qué.'
  return `${n} de ${xs.length} se pueden ver y descargar en PDF. Los demás dicen por qué todavía no.`
}

function pesoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

const ESTADOS_DOC = new Set(Object.keys(ETIQUETAS_ESTADO_DOC))
const MOTIVOS = new Set(Object.keys(ETIQUETAS_MOTIVO))

export const manejarDocumento: ManejadorFicha = async (sesion, id, accion, entrada) => {
  if (!puede(sesion, 'sistema:documentos', 'editar')) return { error: 'Corregir documentos pide el permiso de editar documentos.' }
  if (!UUID.test(id)) return { error: 'Documento no válido.' }
  const supabase = await createClient()
  const sgc = supabase.schema('sgc')
  const valor = (entrada.valor ?? '').trim()

  if (accion === 'conciliar' || accion === 'reabrir') {
    const motivo = entrada.param ?? ''
    if (!MOTIVOS.has(motivo)) return { error: 'Motivo de conciliación no válido.' }
    if (accion === 'reabrir') {
      const { error, count } = await sgc.from('documento_conciliacion').delete({ count: 'exact' }).eq('documento_id', id).eq('motivo', motivo)
      if (error) return { error: error.message }
      return count ? { ok: 'El punto volvió a la cola.' } : { error: 'No había una decisión que reabrir.' }
    }
    return conciliar(supabase, sesion.userId, id, motivo, entrada.motivo ?? entrada.valor ?? '')
  }

  if (!accion.startsWith('campo:')) return { error: 'Acción no reconocida.' }
  const col = accion.slice('campo:'.length)
  let cambio: CambioDocumento
  switch (col) {
    case 'estado':
      if (!ESTADOS_DOC.has(valor)) return { error: 'Elige un estado válido.' }
      cambio = { estado: valor }
      break
    case 'destino':
      if (valor && !DESTINOS[valor]) return { error: 'Destino no válido.' }
      cambio = { destino: valor || null }
      break
    case 'proceso_ref': {
      if (valor) {
        if (!UUID.test(valor)) return { error: 'Proceso no válido.' }
        const { count } = await sgc.from('proceso').select('id', { count: 'exact', head: true }).eq('ref', valor).is('escenario_id', null).eq('estado', 'vigente')
        if (!count) return { error: 'El proceso elegido no está vigente.' }
      }
      cambio = { proceso_ref: valor || null }
      break
    }
    case 'familia':
      cambio = { familia: valor || null }
      break
    case 'nota':
      cambio = { nota: valor || null }
      break
    case 'datos_sensibles':
      if (valor !== 'si' && valor !== 'no') return { error: 'Elige sí o no.' }
      cambio = { datos_sensibles: valor === 'si' }
      break
    case 'alias':
      cambio = { alias: [...new Set(valor.split(/[\n,;]+/).map((a) => a.trim()).filter(Boolean))] }
      break
    default:
      return { error: 'Ese campo no se corrige desde la ficha.' }
  }
  const { data, error } = await sgc.from('documento').update(cambio).eq('id', id).select('id')
  if (error) return { error: error.code === '42501' ? 'No tienes permiso para corregir documentos.' : error.message }
  // Sin política que lo deje, Postgres no se queja: filtra la fila y no cambia nada.
  if (!data?.length) return { error: 'No se guardó: el documento no existe o está fuera de tu alcance.' }
  return { ok: 'Guardado. El cambio queda en la auditoría.' }
}

/** Saca un punto de la cola de conciliación con su decisión (auditada). */
export async function conciliar(supabase: Cliente, userId: string, id: string, motivo: string, resolucion: string): Promise<ResultadoAccionFicha> {
  const texto = resolucion.trim()
  if (texto.length < 3) return { error: 'Escribe qué se decidió (al menos tres letras).' }
  const { error } = await supabase
    .schema('sgc')
    .from('documento_conciliacion')
    .upsert({ documento_id: id, motivo, resolucion: texto.slice(0, 1000), decidido_por: userId, decidido_en: new Date().toISOString() }, { onConflict: 'documento_id,motivo' })
  if (error) return { error: error.code === '42501' ? 'No tienes permiso para conciliar documentos.' : error.message }
  return { ok: 'Decidido: el punto sale de la cola.' }
}

