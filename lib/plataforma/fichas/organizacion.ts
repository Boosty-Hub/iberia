import 'server-only'
import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { contextoFlujo, type ContextoFlujo } from '@/components/sistema/flujo/datos'
import { ACCION_PASO, DECISION, ESTADO_ESCENARIO, ESTADO_REQUISICION, ESTADO_SOLICITUD, enlaceObjeto } from '@/components/sistema/flujo/formato'
import {
  TIPOS_FICHA,
  type AccionFicha,
  type BloqueFicha,
  type DatoFicha,
  type Ficha,
  type SeccionFicha,
  type TipoFicha,
  type TonoFicha,
} from '@/lib/plataforma/ficha-tipos'
import { fechaCorta, fechaHora, fechaLarga, hoyCaracas, numero } from '@/lib/plataforma/formato'
import { fuenteLegible } from '@/lib/plataforma/fuentes'
import { leerMoneda } from '@/lib/plataforma/servidor'

/**
 * Las fichas de Organización (R1): unidad, plaza, cargo, persona, requisición,
 * escenario y punto de conciliación. Cada una se arma con la sesión de quien la
 * pide —la RLS decide— y además pide el permiso del módulo antes de preguntar.
 * Lo que es perímetro de nómina (costos, salario propuesto) **no se consulta**
 * sin `sistema:costos`: la pestaña no existe, no se esconde.
 *
 * Lo editable se describe aquí y se guarda en `organizacion-acciones.ts`, que
 * llama a las funciones de la base (cierran la versión que rige y abren otra
 * con su fecha: lo publicado nunca se corrige en el sitio).
 */

type Cliente = Awaited<ReturnType<typeof createClient>>

export const TIPOS_ORGANIZACION = ['unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'conciliacion'] as const
export type TipoOrganizacion = (typeof TIPOS_ORGANIZACION)[number]
export function esTipoOrganizacion(t: TipoFicha): t is TipoOrganizacion {
  return (TIPOS_ORGANIZACION as readonly string[]).includes(t)
}

const BASE = '/sistema/nucleo/organizacion'
const vigente = (d: string) => `[${d},${d}]`
const TONO: Record<string, TonoFicha> = { neutro: 'neutro', marca: 'azul', acento: 'rojo', rojo: 'rojo', ambar: 'ambar', verde: 'verde' }

function vacia(tipo: TipoFicha, id: string, titulo: string): Ficha {
  return { tipo, id, tipoEtiqueta: TIPOS_FICHA[tipo], titulo, datos: [], relaciones: [], linea: [], lineaVisible: false, documentos: [], aprobaciones: [], perimetro: false }
}

// -----------------------------------------------------------------------------
// Ayudas comunes
// -----------------------------------------------------------------------------

type Opcion = { valor: string; etiqueta: string }

async function catalogo(supabase: Cliente, tipos: string[]): Promise<Record<string, Opcion[]>> {
  const { data } = await supabase.schema('control').from('catalogo').select('tipo, clave, etiqueta').in('tipo', tipos).eq('activo', true).order('orden')
  const r: Record<string, Opcion[]> = {}
  for (const c of data ?? []) (r[c.tipo] ??= []).push({ valor: c.clave, etiqueta: c.etiqueta })
  return r
}
const etiquetaDe = (lista: Opcion[] | undefined, v: string | null | undefined, vacio = '—') => (v ? (lista?.find((o) => o.valor === v)?.etiqueta ?? v) : vacio)

const CAMPO: Record<string, string> = {
  nombre: 'nombre',
  tipo: 'tipo',
  padre_ref: 'dependencia',
  sede: 'sede',
  codigo_organigrama: 'código',
  vigencia: 'vigencia',
  certeza: 'certeza',
  nota: 'nota',
  fuente: 'fuente',
  dotacion: 'dotación',
  reporta_a_ref: 'a quién reporta',
  tipo_nomina: 'nómina',
  estado: 'estado',
  unidad_ref: 'unidad',
  cargo_id: 'cargo',
  familia: 'familia',
  nivel: 'nivel',
  sinonimos: 'sinónimos',
  proposito: 'propósito',
  activo: 'activo',
  cantidad: 'cantidad',
  motivo: 'motivo',
  excede_dotacion: 'por encima de la dotación',
  candidato: 'candidato',
  fecha_ingreso: 'ingreso',
  justificacion: 'justificación',
  descripcion: 'descripción',
  vigente_desde: 'rige desde',
}
const FUERA = new Set(['id', 'ref', 'esc', 'busqueda', 'tipo_cat', 'sede_cat', 'nomina_cat', 'estado_cat', 'familia_cat', 'origen_cat', 'escenario_id', 'creado_en', 'creado_por', 'clave', 'area_id', 'impacto', 'perfil', 'condiciones', 'solicitud_id', 'orden'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function valorCorto(k: string, v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (k === 'vigencia' && typeof v === 'string') {
    if (v === 'empty') return 'reemplazada'
    const m = v.match(/^[[(]([\d-]*),([\d-]*)[\])]$/)
    if (m) return m[2] ? `${fechaCorta(m[1])} al ${fechaCorta(m[2])}` : `desde ${fechaCorta(m[1])}`
  }
  if (typeof v === 'boolean') return v ? 'sí' : 'no'
  if (typeof v === 'string' && UUID.test(v)) return 'otro registro'
  if (k === 'fuente' && typeof v === 'string') return fuenteLegible(v) ?? v
  const t = Array.isArray(v) ? v.join(', ') : String(v)
  return t.length > 60 ? `${t.slice(0, 57)}…` : t
}

/** El cambio de una fila de auditoría, en una frase. */
function textoCambio(accion: string, antes: Record<string, unknown>, despues: Record<string, unknown>): string {
  if (accion === 'INSERT') {
    const v = despues.vigencia ? ` · ${valorCorto('vigencia', despues.vigencia)}` : ''
    return `Alta${v}`
  }
  if (accion === 'DELETE') return 'Baja'
  const cambios = Object.keys(despues).filter((k) => !FUERA.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
  if (!cambios.length) return 'Cambio sin diferencias visibles'
  return cambios
    .slice(0, 4)
    .map((k) => `${CAMPO[k] ?? k.replace(/_/g, ' ')}: ${valorCorto(k, antes[k])} → ${valorCorto(k, despues[k])}`)
    .join(' · ')
}

/** La línea de tiempo: la auditoría de todas las versiones del objeto, con el cambio escrito para leerse. */
async function lineaDe(supabase: Cliente, sesion: Sesion, esquema: string, tabla: string, ids: string[]) {
  const visible = puede(sesion, 'sistema:auditoria')
  if (!visible || !ids.length) return { linea: [] as Ficha['linea'], visible }
  const { data } = await supabase
    .schema('control')
    .from('auditoria')
    .select('accion, en, actor, antes, despues')
    .eq('esquema', esquema)
    .eq('tabla', tabla)
    .in('registro_id', ids)
    .order('en', { ascending: false })
    .range(0, 39)
  const actores = [...new Set((data ?? []).map((a) => a.actor).filter(Boolean))] as string[]
  const { data: nombres } = actores.length ? await supabase.schema('flujo').rpc('nombres', { p_ids: actores }) : { data: [] as { id: string; nombre: string }[] }
  const nombre = new Map((nombres ?? []).map((p) => [p.id, p.nombre]))
  return {
    visible: true,
    linea: (data ?? []).map((a) => ({
      en: a.en,
      texto: textoCambio(a.accion, (a.antes ?? {}) as Record<string, unknown>, (a.despues ?? {}) as Record<string, unknown>),
      quien: a.actor ? (nombre.get(a.actor) ?? 'Alguien') : 'Sistema',
    })),
  }
}

async function aprobacionesDe(supabase: Cliente, ids: string[]): Promise<Ficha['aprobaciones']> {
  if (!ids.length) return []
  const { data } = await supabase
    .schema('flujo')
    .from('solicitud')
    .select('id, tipo_objeto, objeto_id, titulo, estado, creado_en, paso(orden, nombre, decision, decidido_en)')
    .in('objeto_id', ids)
    .order('creado_en', { ascending: false })
    .range(0, 9)
  return (data ?? []).map((s) => ({
    titulo: s.titulo,
    estado: ESTADO_SOLICITUD[s.estado]?.etiqueta ?? s.estado,
    creado_en: s.creado_en,
    href: enlaceObjeto(s.tipo_objeto, s.objeto_id),
    pasos: ((s.paso ?? []) as { orden: number; nombre: string; decision: string; decidido_en: string | null }[])
      .sort((a, b) => a.orden - b.orden)
      .map((p) => ({ ...p, decision: DECISION[p.decision]?.etiqueta ?? p.decision })),
  }))
}

/** La ruta de una solicitud como bloque de pasos, con los botones del paso que le toca a quien mira. */
function bloqueRuta(flujo: ContextoFlujo, opciones: { requisicion?: boolean } = {}): BloqueFicha[] {
  if (!flujo.solicitudes.length) return [{ tipo: 'texto', texto: 'Todavía no ha pasado por su ruta de aprobación.' }]
  return flujo.solicitudes.slice(0, 3).map((s, i) => ({
    tipo: 'pasos' as const,
    titulo: `${i === 0 ? 'Ruta actual' : 'Ruta anterior'} · ${ESTADO_SOLICITUD[s.estado]?.etiqueta ?? s.estado} · ${fechaLarga(s.creado_en)}`,
    pasos: s.pasos.map((p) => {
      const dec = DECISION[p.decision] ?? { etiqueta: p.decision, tono: 'neutro' as const }
      const actual = s.estado === 'en_curso' && p.orden === s.paso_actual
      const quien = p.decidido_por
        ? flujo.nombres[p.decidido_por]
        : p.aprobador_perfil
          ? flujo.nombres[p.aprobador_perfil]
          : p.aprobador_plaza_ref
            ? `${flujo.plazas[p.aprobador_plaza_ref] ?? 'Plaza'}${p.regla?.sin_cuenta ? ' · sin cuenta en la plataforma' : ''}`
            : 'Sin firmante resuelto'
      const acciones: AccionFicha[] = []
      if (flujo.decidible?.id === p.id) {
        const completar = opciones.requisicion && p.accion === 'completar'
        acciones.push({
          accion: 'decidir',
          param: `aprobado:${p.id}`,
          etiqueta: ACCION_PASO[p.accion]?.boton ?? 'Aprobar',
          tono: 'principal',
          ...(completar ? { motivo: 'obligatorio' as const, rotuloMotivo: 'Candidato (nombre y apellido)', conFecha: true, rotuloFecha: 'Fecha de ingreso' } : {}),
        })
        acciones.push({ accion: 'decidir', param: `devuelto:${p.id}`, etiqueta: 'Devolver', motivo: 'obligatorio', rotuloMotivo: 'Qué hay que corregir' })
        acciones.push({ accion: 'decidir', param: `rechazado:${p.id}`, etiqueta: 'Rechazar', tono: 'peligro', motivo: 'obligatorio', rotuloMotivo: 'Motivo del rechazo' })
      }
      return {
        orden: p.orden,
        nombre: p.nombre,
        quien,
        estado: actual ? 'Le toca' : dec.etiqueta,
        tono: (actual ? 'ambar' : TONO[dec.tono] ?? 'neutro') as TonoFicha,
        en: p.decidido_en,
        comentario: p.comentario,
        nota: p.hito ? 'Hito: con esta firma queda aprobada.' : p.ve_costos ? 'Este paso ve el costo.' : null,
        acciones,
      }
    }),
  }))
}

function moneda(v: number | null | undefined, m: 'VES' | 'USD') {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return m === 'USD' ? `USD ${numero(v, 2)}` : `Bs ${numero(v, 2)}`
}

type CostoCargo = {
  salario_ves?: number
  bonos_ves?: number
  componentes?: { nombre: string; monto_ves: number | null; por_confirmar: boolean }[]
  total_ves?: number
  total_usd?: number | null
  tasa?: number | null
  tasa_fecha?: string | null
  tasa_fuente?: string | null
  por_confirmar?: boolean
} | null

/** El costo de un cargo como bloques (perímetro). `veces` = cuántos puestos. */
function bloquesCosto(c: CostoCargo, veces: number, mon: 'VES' | 'USD', titulo = 'Costo mensual de referencia'): BloqueFicha[] {
  if (!c) return [{ tipo: 'texto', tono: 'ambar', texto: 'Falta el costo de referencia de este cargo. Se carga en Costos 🔒 y rige desde la fecha que se indique.' }]
  const usd = (ves: number | null | undefined) => (c.tasa && ves !== null && ves !== undefined ? ves / c.tasa : null)
  const ver = (ves: number | null | undefined) => (mon === 'USD' ? moneda(usd(ves), 'USD') : moneda(ves, 'VES'))
  const total = c.total_ves ?? 0
  return [
    {
      tipo: 'cifras',
      titulo,
      cifras: [
        { etiqueta: 'Por puesto, al mes', valor: ver(total) },
        { etiqueta: `× ${numero(veces)} puesto${veces === 1 ? '' : 's'}, al mes`, valor: ver(total * veces) },
        { etiqueta: 'Al año', valor: ver(total * veces * 12) },
        { etiqueta: 'Componentes', valor: c.por_confirmar ? 'Por confirmar' : 'Confirmados', tono: c.por_confirmar ? 'ambar' : 'verde' },
      ],
      sello: c.tasa ? `Tasa BCV ${numero(c.tasa, 2)} Bs/USD · fecha valor ${fechaCorta(c.tasa_fecha ?? null)}${c.tasa_fuente && c.tasa_fuente !== 'BCV' ? ` (${c.tasa_fuente})` : ''}` : 'Sin tasa BCV cargada: no se puede convertir.',
    },
    {
      tipo: 'datos',
      titulo: 'Desglose por puesto',
      filas: [
        { etiqueta: 'Salario', valor: ver(c.salario_ves) },
        { etiqueta: 'Bonos en divisas', valor: ver(c.bonos_ves) },
        ...(c.componentes ?? []).map((x) => ({ etiqueta: x.nombre, valor: `${ver(x.monto_ves)}${x.por_confirmar ? ' · por confirmar' : ''}` })),
      ],
    },
  ]
}

// -----------------------------------------------------------------------------
// El armador
// -----------------------------------------------------------------------------

export async function cargarFichaOrganizacion(sesion: Sesion, tipo: TipoOrganizacion, id: string): Promise<Ficha | null> {
  const supabase = await createClient()
  switch (tipo) {
    case 'unidad':
      return puede(sesion, 'sistema:estructura') ? fichaUnidad(supabase, sesion, id) : null
    case 'plaza':
      return puede(sesion, 'sistema:estructura') ? fichaPlaza(supabase, sesion, id) : null
    case 'cargo':
      return puede(sesion, 'sistema:estructura') ? fichaCargo(supabase, sesion, id) : null
    case 'persona':
      return puede(sesion, 'sistema:estructura') ? fichaPersona(supabase, sesion, id) : null
    case 'requisicion':
      // La ve quien la pidió, quien tiene el permiso y quien firma en su ruta: lo decide la RLS.
      return fichaRequisicion(supabase, sesion, id)
    case 'escenario':
      return puede(sesion, 'sistema:escenarios') ? fichaEscenario(supabase, sesion, id) : null
    case 'conciliacion':
      return puede(sesion, 'sistema:estructura') || puede(sesion, 'sistema:procesos') || puede(sesion, 'sistema:documentos') ? fichaConciliacion(supabase, sesion, id) : null
  }
}

// -----------------------------------------------------------------------------
// Unidad
// -----------------------------------------------------------------------------

async function fichaUnidad(supabase: Cliente, sesion: Sesion, ref: string): Promise<Ficha | null> {
  const hoy = hoyCaracas()
  const org = supabase.schema('org')
  const editar = puede(sesion, 'sistema:estructura', 'editar')
  const verCostos = puede(sesion, 'sistema:costos')
  const [{ data: versiones }, { data: plazas }, { data: hijas }, { data: gente }, cat, { data: unidades }] = await Promise.all([
    org.from('unidad').select('id, nombre, tipo, codigo_organigrama, sede, padre_ref, certeza, fuente, nota, vigencia').eq('ref', ref).is('escenario_id', null).order('vigencia', { ascending: false }),
    supabase.schema('ui').rpc('plazas', { p_al: hoy }).eq('unidad_ref', ref).order('cargo').range(0, 199),
    org.from('unidad').select('ref, nombre, tipo').eq('padre_ref', ref).is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).order('orden').range(0, 49),
    org.rpc('ocupantes_de_unidad', { p_unidad: ref }),
    catalogo(supabase, ['tipo_unidad', 'sede']),
    editar ? org.from('unidad').select('ref, nombre').is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).order('nombre').range(0, 499) : Promise.resolve({ data: [] as { ref: string; nombre: string }[] }),
  ])
  const u = (versiones ?? []).find((v) => typeof v.vigencia === 'string' && v.vigencia !== 'empty' && enRango(v.vigencia, hoy)) ?? versiones?.[0]
  if (!u) return null
  const padre = u.padre_ref
    ? (await org.from('unidad').select('ref, nombre').eq('ref', u.padre_ref).is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).maybeSingle()).data
    : null
  const filas = plazas ?? []
  const dot = filas.reduce((s, p) => s + (p.dotacion ?? 0), 0)
  const ocu = filas.reduce((s, p) => s + (p.ocupadas ?? 0), 0)
  const vac = filas.reduce((s, p) => s + (p.vacantes ?? 0), 0)
  const exc = filas.reduce((s, p) => s + (p.exceso ?? 0), 0)
  const refsPlaza = filas.map((p) => p.ref)
  const [{ linea, visible }, procesos, costo] = await Promise.all([
    lineaDe(supabase, sesion, 'org', 'unidad', (versiones ?? []).map((v) => v.id)),
    puede(sesion, 'sistema:procesos') && refsPlaza.length
      ? supabase.schema('sgc').from('proceso').select('ref, nombre, codigo_sgc, dueno_plaza_ref').in('dueno_plaza_ref', refsPlaza).is('escenario_id', null).eq('estado', 'vigente').range(0, 49)
      : Promise.resolve({ data: [] as { ref: string; nombre: string; codigo_sgc: string | null; dueno_plaza_ref: string | null }[] }),
    // Perímetro: sin el permiso, ni se pregunta.
    verCostos ? supabase.schema('ui').rpc('costo_unidades', { p_fecha: hoy }).eq('unidad_ref', ref).maybeSingle() : Promise.resolve({ data: null }),
  ])
  const inferida = u.certeza === 'inferencia'
  const conFecha = (accion: string, control: 'texto' | 'opciones', valor: string, opciones?: Opcion[]) =>
    editar ? { editar: { accion, control, valor, opciones, conFecha: true, ayuda: 'El cambio crea una versión nueva desde la fecha; la de hoy queda en el historial.' } } : {}
  const datos: DatoFicha[] = [
    { etiqueta: 'Nombre', valor: u.nombre, ...conFecha('unidad.nombre', 'texto', u.nombre) },
    { etiqueta: 'Tipo', valor: etiquetaDe(cat.tipo_unidad, u.tipo), ...conFecha('unidad.tipo', 'opciones', u.tipo, cat.tipo_unidad) },
    {
      etiqueta: 'Depende de',
      valor: padre?.nombre ?? 'Ninguna (raíz)',
      ...conFecha('unidad.padre', 'opciones', u.padre_ref ?? '', [{ valor: '', etiqueta: 'Ninguna (raíz)' }, ...(unidades ?? []).filter((x) => x.ref !== ref).map((x) => ({ valor: x.ref, etiqueta: x.nombre }))]),
    },
    { etiqueta: 'Sede', valor: etiquetaDe(cat.sede, u.sede), ...conFecha('unidad.sede', 'opciones', u.sede ?? '', [{ valor: '', etiqueta: 'Sin sede' }, ...(cat.sede ?? [])]) },
    { etiqueta: 'Código', valor: u.codigo_organigrama ?? '—', mono: true, ...conFecha('unidad.codigo', 'texto', u.codigo_organigrama ?? '') },
    { etiqueta: 'Certeza', valor: inferida ? 'Inferencia: la carga la dedujo sin poder confirmarla' : 'Hecho (con fuente)' },
    { etiqueta: 'Fuente', valor: fuenteLegible(u.fuente) ?? '—' },
    { etiqueta: 'Vigente', valor: textoVigencia(u.vigencia) },
    { etiqueta: 'Versiones', valor: numero(versiones?.length ?? 0) },
    ...(u.nota ? [{ etiqueta: 'Nota', valor: u.nota }] : []),
  ]
  const secciones: SeccionFicha[] = [
    {
      clave: 'dotacion',
      etiqueta: 'Dotación',
      bloques: [
        {
          tipo: 'cifras',
          cifras: [
            { etiqueta: 'Aprobada', valor: numero(dot) },
            { etiqueta: 'Ocupada', valor: numero(ocu) },
            { etiqueta: 'Vacantes', valor: numero(vac), tono: vac ? 'ambar' : 'neutro' },
            { etiqueta: 'Por encima', valor: numero(exc), tono: exc ? 'rojo' : 'neutro' },
          ],
          sello: `Plazas vigentes al ${fechaLarga(hoy)} · ${numero(filas.length)} plaza${filas.length === 1 ? '' : 's'} propias (sin las de las unidades de abajo)`,
        },
        {
          tipo: 'lista',
          titulo: 'Plazas',
          vacio: 'Esta unidad no tiene plazas propias.',
          items: filas.map((p) => ({
            tipo: 'Plaza',
            titulo: p.cargo ?? 'Cargo',
            detalle: `${numero(p.ocupadas)} de ${numero(p.dotacion)}${p.exceso ? ` · ${p.exceso} por encima` : p.vacantes ? ` · ${p.vacantes} vacante${p.vacantes === 1 ? '' : 's'}` : ''}`,
            ficha: `plaza:${p.ref}`,
          })),
        },
      ],
    },
  ]
  if (verCostos) {
    const c = costo.data as { costo_ves: number | null; costo_usd: number | null; dotacion_sin_costo: number; tasa: number | null; tasa_fecha: string | null } | null
    const mon = await leerMoneda()
    secciones.push({
      clave: 'costo',
      etiqueta: 'Costo',
      candado: true,
      bloques: c
        ? [
            {
              tipo: 'cifras',
              titulo: 'Costo mensual de referencia de la unidad',
              cifras: [
                { etiqueta: 'Al mes', valor: c.costo_ves === null ? 'Falta costo de referencia' : moneda(mon === 'USD' ? c.costo_usd : c.costo_ves, mon) },
                { etiqueta: 'Al año', valor: c.costo_ves === null ? '—' : moneda((mon === 'USD' ? (c.costo_usd ?? 0) : c.costo_ves) * 12, mon) },
                { etiqueta: 'Puestos sin costo', valor: numero(c.dotacion_sin_costo), tono: c.dotacion_sin_costo ? 'ambar' : 'neutro', detalle: c.dotacion_sin_costo ? 'no suman: falta su costo de referencia' : null },
              ],
              sello: `Σ dotación × costo mensual del cargo · tasa BCV ${numero(c.tasa, 2)} Bs/USD, fecha valor ${fechaCorta(c.tasa_fecha)}`,
            },
          ]
        : [{ tipo: 'texto', texto: 'La unidad no tiene plazas vigentes.' }],
    })
  }
  const acciones: AccionFicha[] = [
    { href: `${BASE}?al=${hoy}`, etiqueta: 'Ver en el organigrama' },
    ...(editar && inferida ? [{ accion: 'unidad.confirmar', etiqueta: 'Confirmar: es un hecho', conFecha: true, confirmar: 'Queda como dato confirmado desde la fecha; la versión inferida, en el historial.' }] : []),
    ...(editar ? [{ accion: 'unidad.cerrar', etiqueta: 'Cerrar unidad', tono: 'peligro' as const, motivo: 'obligatorio' as const, conFecha: true, confirmar: 'Solo se cierra vacía: sin unidades ni plazas debajo en esa fecha.' }] : []),
  ]
  return {
    ...vacia('unidad', ref, u.nombre),
    subtitulo: [etiquetaDe(cat.tipo_unidad, u.tipo), etiquetaDe(cat.sede, u.sede, '')].filter(Boolean).join(' · '),
    codigo: u.codigo_organigrama,
    estado: inferida ? { etiqueta: 'Inferida', tono: 'ambar' } : { etiqueta: 'Vigente', tono: 'verde' },
    hrefModulo: `${BASE}/unidades/${ref}`,
    datos,
    secciones,
    acciones,
    relaciones: [
      ...(padre ? [{ tipo: 'Depende de', titulo: padre.nombre, ficha: `unidad:${padre.ref}` }] : []),
      ...(hijas ?? []).map((h) => ({ tipo: 'Unidad hija', titulo: h.nombre, detalle: etiquetaDe(cat.tipo_unidad, h.tipo), ficha: `unidad:${h.ref}` })),
      ...(gente ?? []).map((g) => ({ tipo: g.tipo === 'titular' ? 'Persona' : `Persona (${g.tipo})`, titulo: g.nombre, detalle: g.cargo, ficha: `persona:${g.empleado_id}` })),
      ...(procesos.data ?? []).map((p) => ({ tipo: 'Proceso que dirige', titulo: p.nombre, detalle: p.codigo_sgc, ficha: `proceso:${p.ref}` })),
    ],
    linea,
    lineaVisible: visible,
  }
}

function enRango(rango: string, dia: string): boolean {
  const m = rango.match(/^[[(]([\d-]*),([\d-]*)[\])]$/)
  if (!m) return false
  return (!m[1] || m[1] <= dia) && (!m[2] || dia < m[2])
}
function textoVigencia(rango: unknown): string {
  if (typeof rango !== 'string') return '—'
  if (rango === 'empty') return 'Reemplazada'
  const m = rango.match(/^[[(]([\d-]*),([\d-]*)[\])]$/)
  if (!m) return rango
  return m[2] ? `Del ${fechaLarga(m[1])} al ${fechaLarga(m[2])} (sin incluirlo)` : `Desde el ${fechaLarga(m[1])}`
}

// -----------------------------------------------------------------------------
// Plaza
// -----------------------------------------------------------------------------

async function fichaPlaza(supabase: Cliente, sesion: Sesion, ref: string): Promise<Ficha | null> {
  const hoy = hoyCaracas()
  const org = supabase.schema('org')
  const editar = puede(sesion, 'sistema:estructura', 'editar')
  const verCostos = puede(sesion, 'sistema:costos')
  const [{ data: fila }, { data: versiones }, { data: ocupantes }, cat, { data: lePorta }] = await Promise.all([
    supabase.schema('ui').rpc('plazas', { p_al: hoy }).eq('ref', ref).maybeSingle(),
    org.from('plaza').select('id, nota, fuente, reporta_a_ref, vigencia').eq('ref', ref).is('escenario_id', null).order('vigencia', { ascending: false }),
    org.from('ocupacion').select('id, tipo, vigencia, certeza, excede_dotacion, empleado_id, empleados(nombre_completo, ficha)').eq('plaza_ref', ref).filter('vigencia', 'cs', vigente(hoy)).range(0, 49),
    catalogo(supabase, ['tipo_nomina', 'sede', 'estado_plaza', 'tipo_ocupacion']),
    org.from('plaza').select('ref, cargo_id, cargo(nombre)').eq('reporta_a_ref', ref).is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).range(0, 99),
  ])
  if (!fila) return null
  const actual = (versiones ?? []).find((v) => typeof v.vigencia === 'string' && enRango(v.vigencia, hoy)) ?? versiones?.[0]
  const [{ linea, visible }, dep, reporta, plazasUnidad, costo, unidades] = await Promise.all([
    lineaDe(supabase, sesion, 'org', 'plaza', (versiones ?? []).map((v) => v.id)),
    org.rpc('dependencias', { p_cargo: fila.cargo_id, p_plaza: ref }),
    actual?.reporta_a_ref ? org.rpc('describir_plazas', { p_refs: [actual.reporta_a_ref] }) : Promise.resolve({ data: [] as { ref: string; cargo: string; unidad: string }[] }),
    editar ? supabase.schema('ui').rpc('plazas', { p_al: hoy }).select('ref, cargo, unidad').neq('ref', ref).order('unidad').range(0, 499) : Promise.resolve({ data: [] as { ref: string; cargo: string | null; unidad: string | null }[] }),
    verCostos ? org.rpc('costo_mensual', { p_cargo: fila.cargo_id, p_fecha: hoy }) : Promise.resolve({ data: null }),
    editar ? org.from('unidad').select('ref, nombre').is('escenario_id', null).filter('vigencia', 'cs', vigente(hoy)).order('nombre').range(0, 499) : Promise.resolve({ data: [] as { ref: string; nombre: string }[] }),
  ])
  const d = (dep.data ?? { procesos: [], rutas: [] }) as { procesos: { ref: string; nombre: string; codigo: string | null }[]; rutas: { ruta: string; paso: string }[] }
  const jefe = reporta.data?.[0]
  const estado: Ficha['estado'] =
    fila.exceso > 0
      ? { etiqueta: `${fila.exceso} por encima`, tono: 'rojo' }
      : fila.vacantes > 0
        ? { etiqueta: `${fila.vacantes} vacante${fila.vacantes === 1 ? '' : 's'}`, tono: 'ambar' }
        : { etiqueta: 'Completa', tono: 'verde' }
  const ed = (accion: string, control: 'entero' | 'opciones', valor: string, opciones?: Opcion[]) =>
    editar ? { editar: { accion, control, valor, opciones, conFecha: true, ayuda: 'Crea una versión nueva de la plaza desde la fecha.' } } : {}
  const estadosEditables = (cat.estado_plaza ?? []).filter((o) => o.valor !== 'cerrada')
  const personas = (ocupantes ?? []).map((o) => {
    const e = o.empleados as unknown as { nombre_completo: string; ficha: string | null } | null
    return { id: o.id, empleado: o.empleado_id, nombre: e?.nombre_completo ?? 'Persona', ficha: e?.ficha ?? null, tipo: o.tipo, desde: typeof o.vigencia === 'string' ? (o.vigencia.match(/^[[(]([\d-]*)/)?.[1] ?? null) : null, excede: o.excede_dotacion }
  })
  const secciones: SeccionFicha[] = [
    {
      clave: 'ocupantes',
      etiqueta: 'Ocupantes',
      n: personas.length,
      bloques: [
        {
          tipo: 'lista',
          vacio: 'Nadie ocupa esta plaza hoy.',
          items: personas.map((p) => ({
            tipo: etiquetaDe(cat.tipo_ocupacion, p.tipo),
            titulo: p.nombre,
            detalle: `${p.ficha ? `Ficha ${p.ficha} · ` : ''}desde ${fechaCorta(p.desde)}${p.excede ? ' · por encima de la dotación' : ''}`,
            ficha: `persona:${p.empleado}`,
          })),
        },
        ...(editar && personas.length
          ? [
              {
                tipo: 'acciones' as const,
                titulo: 'Terminar una ocupación',
                acciones: personas.map((p) => ({
                  accion: 'ocupacion.terminar',
                  param: p.id,
                  etiqueta: `Termina ${p.nombre.split(' ')[0]}`,
                  motivo: 'opcional' as const,
                  conFecha: true,
                  rotuloFecha: 'Último día + 1 (deja de ocupar desde)',
                  confirmar: `${p.nombre} deja de ocupar esta plaza desde la fecha. Queda en su trayectoria.`,
                })),
              },
            ]
          : []),
      ],
    },
    {
      clave: 'dependencias',
      etiqueta: 'Dependencias',
      n: d.procesos.length + d.rutas.length + (lePorta?.length ?? 0),
      bloques: [
        {
          tipo: 'texto',
          texto: 'Lo que se mueve si esta plaza cambia o se cierra: los procesos que dirige, las rutas de aprobación donde firma su cargo y las plazas que le reportan.',
        },
        { tipo: 'lista', titulo: 'Procesos que dirige', vacio: 'No es dueña de ningún proceso vigente.', items: d.procesos.map((p) => ({ tipo: 'Proceso', titulo: p.nombre, detalle: p.codigo, ficha: `proceso:${p.ref}` })) },
        { tipo: 'lista', titulo: 'Rutas donde firma', vacio: 'Su cargo no firma en ninguna ruta activa.', items: d.rutas.map((r) => ({ tipo: 'Ruta', titulo: r.paso, detalle: r.ruta })) },
        {
          tipo: 'lista',
          titulo: 'Le reportan',
          vacio: 'Ninguna plaza le reporta.',
          items: (lePorta ?? []).map((p) => ({ tipo: 'Plaza', titulo: (p.cargo as unknown as { nombre: string } | null)?.nombre ?? 'Plaza', ficha: `plaza:${p.ref}` })),
        },
      ],
    },
  ]
  if (verCostos) {
    secciones.push({ clave: 'costo', etiqueta: 'Costo', candado: true, bloques: bloquesCosto(costo.data as CostoCargo, fila.dotacion, await leerMoneda()) })
  }
  const inferida = fila.certeza === 'inferencia'
  return {
    ...vacia('plaza', ref, fila.cargo ?? 'Plaza'),
    subtitulo: fila.unidad,
    estado,
    hrefModulo: fila.unidad_ref ? `${BASE}/unidades/${fila.unidad_ref}` : null,
    datos: [
      { etiqueta: 'Cargo', valor: fila.cargo ?? '—' },
      {
        etiqueta: 'Unidad',
        valor: fila.unidad ?? '—',
        ...ed('plaza.unidad', 'opciones', fila.unidad_ref ?? '', (unidades.data ?? []).map((u) => ({ valor: u.ref, etiqueta: u.nombre }))),
      },
      { etiqueta: 'Dotación aprobada', valor: numero(fila.dotacion), ...ed('plaza.dotacion', 'entero', String(fila.dotacion)) },
      { etiqueta: 'Titulares', valor: `${numero(fila.ocupadas)}${fila.exceso ? ` (${fila.exceso} por encima)` : fila.vacantes ? ` (${fila.vacantes} vacante${fila.vacantes === 1 ? '' : 's'})` : ''}` },
      {
        etiqueta: 'Reporta a',
        valor: jefe ? `${jefe.cargo} · ${jefe.unidad}` : '—',
        ...ed('plaza.reporta', 'opciones', actual?.reporta_a_ref ?? '', [
          { valor: '', etiqueta: 'A nadie (encabeza)' },
          ...(plazasUnidad.data ?? []).map((p) => ({ valor: p.ref as string, etiqueta: `${p.cargo ?? 'Plaza'} · ${p.unidad ?? ''}` })),
        ]),
      },
      { etiqueta: 'Estado', valor: etiquetaDe(cat.estado_plaza, fila.estado), ...ed('plaza.estado', 'opciones', fila.estado ?? 'aprobada', estadosEditables) },
      { etiqueta: 'Nómina', valor: fila.nomina ?? '—', ...ed('plaza.nomina', 'opciones', fila.tipo_nomina ?? '', [{ valor: '', etiqueta: 'Sin definir' }, ...(cat.tipo_nomina ?? [])]) },
      { etiqueta: 'Sede', valor: fila.sede_nombre ?? '—', ...ed('plaza.sede', 'opciones', fila.sede ?? '', [{ valor: '', etiqueta: 'Sin sede' }, ...(cat.sede ?? [])]) },
      { etiqueta: 'Certeza', valor: inferida ? 'Inferencia: la carga la dedujo' : 'Hecho (con fuente)' },
      { etiqueta: 'Fuente', valor: fuenteLegible(actual?.fuente) ?? '—' },
      { etiqueta: 'Vigente', valor: textoVigencia(actual?.vigencia) },
      ...(actual?.nota ? [{ etiqueta: 'Nota', valor: actual.nota }] : []),
    ],
    secciones,
    acciones: [
      ...(editar && inferida ? [{ accion: 'plaza.confirmar', etiqueta: 'Confirmar: es un hecho', conFecha: true, confirmar: 'Queda como dato confirmado desde la fecha.' }] : []),
      ...(editar
        ? [{ accion: 'plaza.cerrar', etiqueta: 'Cerrar plaza', tono: 'peligro' as const, motivo: 'obligatorio' as const, conFecha: true, confirmar: 'Solo se cierra sin gente adentro y sin plazas que le reporten.' }]
        : []),
    ],
    relaciones: [
      ...(fila.unidad_ref ? [{ tipo: 'Unidad', titulo: fila.unidad ?? 'Unidad', ficha: `unidad:${fila.unidad_ref}` }] : []),
      ...(fila.cargo_id ? [{ tipo: 'Cargo', titulo: fila.cargo ?? 'Cargo', ficha: `cargo:${fila.cargo_id}` }] : []),
      ...(jefe && actual?.reporta_a_ref ? [{ tipo: 'Reporta a', titulo: jefe.cargo, detalle: jefe.unidad, ficha: `plaza:${actual.reporta_a_ref}` }] : []),
      ...personas.map((p) => ({ tipo: p.tipo === 'titular' ? 'Ocupa' : `Ocupa (${p.tipo})`, titulo: p.nombre, detalle: p.ficha ? `Ficha ${p.ficha}` : null, ficha: `persona:${p.empleado}` })),
      ...d.procesos.map((p) => ({ tipo: 'Proceso que dirige', titulo: p.nombre, detalle: p.codigo, ficha: `proceso:${p.ref}` })),
      ...d.rutas.map((r) => ({ tipo: 'Firma en', titulo: r.paso, detalle: r.ruta })),
    ],
    linea,
    lineaVisible: visible,
  }
}

// -----------------------------------------------------------------------------
// Cargo
// -----------------------------------------------------------------------------

async function fichaCargo(supabase: Cliente, sesion: Sesion, id: string): Promise<Ficha | null> {
  const hoy = hoyCaracas()
  const org = supabase.schema('org')
  const editar = puede(sesion, 'sistema:estructura', 'editar')
  const verCostos = puede(sesion, 'sistema:costos')
  const editarCostos = puede(sesion, 'sistema:costos', 'editar')
  const [{ data: c }, { data: plazas }, cat, dep, { linea, visible }] = await Promise.all([
    org.from('cargo').select('id, nombre, clave, familia, nivel, sinonimos, proposito, activo').eq('id', id).maybeSingle(),
    supabase.schema('ui').rpc('plazas', { p_al: hoy }).eq('cargo_id', id).order('unidad').range(0, 199),
    catalogo(supabase, ['familia_cargo']),
    org.rpc('dependencias', { p_cargo: id }),
    lineaDe(supabase, sesion, 'org', 'cargo', [id]),
  ])
  if (!c) return null
  const filas = plazas ?? []
  const dot = filas.reduce((s, p) => s + (p.dotacion ?? 0), 0)
  const ocu = filas.reduce((s, p) => s + (p.ocupadas ?? 0), 0)
  const d = (dep.data ?? { procesos: [], rutas: [] }) as { procesos: { ref: string; nombre: string; codigo: string | null }[]; rutas: { ruta: string; paso: string }[] }
  const ed = (accion: string, control: 'texto' | 'textoLargo' | 'entero' | 'opciones', valor: string, opciones?: Opcion[], ayuda?: string) =>
    editar ? { editar: { accion, control, valor, opciones, ayuda: ayuda ?? 'El catálogo de cargos se edita directo; el cambio queda en la auditoría.' } } : {}
  const secciones: SeccionFicha[] = [
    {
      clave: 'dependencias',
      etiqueta: 'Dependencias',
      n: d.procesos.length + d.rutas.length,
      bloques: [
        { tipo: 'lista', titulo: 'Procesos que dirigen sus plazas', vacio: 'Ninguna plaza de este cargo es dueña de un proceso vigente.', items: d.procesos.map((p) => ({ tipo: 'Proceso', titulo: p.nombre, detalle: p.codigo, ficha: `proceso:${p.ref}` })) },
        { tipo: 'lista', titulo: 'Rutas de aprobación donde firma', vacio: 'No firma en ninguna ruta activa.', items: d.rutas.map((r) => ({ tipo: 'Ruta', titulo: r.paso, detalle: r.ruta })) },
      ],
    },
  ]
  if (verCostos) {
    const [{ data: ref }, { data: costo }] = await Promise.all([
      org.from('costo_referencia').select('id, salario_mensual, moneda, bonos_usd_mensual, vigencia, fuente').eq('cargo_id', id).filter('vigencia', 'cs', vigente(hoy)).maybeSingle(),
      org.rpc('costo_mensual', { p_cargo: id, p_fecha: hoy }),
    ])
    const edCosto = (accion: string, control: 'numero' | 'opciones', valor: string, opciones?: Opcion[]) =>
      editarCostos ? { editar: { accion, control, valor, opciones, conFecha: true, ayuda: 'El costo de referencia nuevo rige desde la fecha; el anterior queda cerrado.' } } : {}
    secciones.push({
      clave: 'costo',
      etiqueta: 'Costo',
      candado: true,
      bloques: [
        {
          tipo: 'datos',
          titulo: 'Costo de referencia del cargo (no es el salario de nadie)',
          filas: [
            { etiqueta: 'Salario mensual', valor: ref ? moneda(ref.salario_mensual, ref.moneda as 'VES' | 'USD') : 'Falta costo de referencia', ...edCosto('cargo.salario', 'numero', ref ? String(ref.salario_mensual) : '') },
            {
              etiqueta: 'Moneda',
              valor: ref ? (ref.moneda === 'USD' ? 'USD' : 'Bs') : '—',
              ...edCosto('cargo.moneda', 'opciones', ref?.moneda ?? 'VES', [
                { valor: 'VES', etiqueta: 'Bs' },
                { valor: 'USD', etiqueta: 'USD' },
              ]),
            },
            { etiqueta: 'Bonos en divisas', valor: ref ? `USD ${numero(ref.bonos_usd_mensual, 2)}` : '—', ...edCosto('cargo.bonos', 'numero', ref ? String(ref.bonos_usd_mensual) : '0') },
            { etiqueta: 'Rige', valor: ref ? textoVigencia(ref.vigencia) : '—' },
            { etiqueta: 'Fuente', valor: fuenteLegible(ref?.fuente) ?? '—' },
          ],
        },
        ...(ref ? bloquesCosto(costo as CostoCargo, dot, await leerMoneda(), 'Lo que cuestan sus plazas') : []),
      ],
    })
  }
  return {
    ...vacia('cargo', id, c.nombre),
    subtitulo: etiquetaDe(cat.familia_cargo, c.familia, 'Sin familia'),
    codigo: c.clave,
    estado: c.activo ? { etiqueta: 'Activo', tono: 'verde' } : { etiqueta: 'Inactivo', tono: 'neutro' },
    hrefModulo: `${BASE}/cargos?ficha=cargo:${id}`,
    datos: [
      { etiqueta: 'Nombre', valor: c.nombre, ...ed('cargo.nombre', 'texto', c.nombre) },
      { etiqueta: 'Familia', valor: etiquetaDe(cat.familia_cargo, c.familia), ...ed('cargo.familia', 'opciones', c.familia ?? '', [{ valor: '', etiqueta: 'Sin familia' }, ...(cat.familia_cargo ?? [])]) },
      { etiqueta: 'Nivel', valor: c.nivel === null ? '—' : String(c.nivel), ...ed('cargo.nivel', 'entero', c.nivel === null ? '' : String(c.nivel)) },
      {
        etiqueta: 'Sinónimos',
        valor: c.sinonimos?.length ? c.sinonimos.join('; ') : '—',
        ...ed('cargo.sinonimos', 'textoLargo', (c.sinonimos ?? []).join('; '), undefined, 'Otros nombres con los que aparece el mismo cargo, separados por «;».'),
      },
      { etiqueta: 'Propósito', valor: c.proposito ?? '—', ...ed('cargo.proposito', 'textoLargo', c.proposito ?? '') },
      {
        etiqueta: 'Estado',
        valor: c.activo ? 'Activo' : 'Inactivo',
        ...ed('cargo.activo', 'opciones', c.activo ? 'activo' : 'inactivo', [
          { valor: 'activo', etiqueta: 'Activo' },
          { valor: 'inactivo', etiqueta: 'Inactivo (no se usa en plazas nuevas)' },
        ]),
      },
      { etiqueta: 'Plazas', valor: `${numero(filas.length)} · dotación ${numero(dot)} · ${numero(ocu)} titulares` },
    ],
    secciones,
    relaciones: filas.map((p) => ({ tipo: 'Plaza', titulo: p.unidad ?? 'Unidad', detalle: `${numero(p.ocupadas)} de ${numero(p.dotacion)}`, ficha: `plaza:${p.ref}` })),
    linea,
    lineaVisible: visible,
  }
}

// -----------------------------------------------------------------------------
// Persona (quien ocupa plazas). Del padrón, solo nombre y ficha: nada de contacto.
// -----------------------------------------------------------------------------

async function fichaPersona(supabase: Cliente, sesion: Sesion, id: string): Promise<Ficha | null> {
  const hoy = hoyCaracas()
  const org = supabase.schema('org')
  const editar = puede(sesion, 'sistema:estructura', 'editar')
  const [{ data: e }, { data: ocup }, cat] = await Promise.all([
    supabase.from('empleados').select('id, nombre_completo, ficha, cargo, activo').eq('id', id).maybeSingle(),
    org.from('ocupacion').select('id, plaza_ref, tipo, vigencia, certeza, excede_dotacion, motivo').eq('empleado_id', id).order('creado_en', { ascending: false }).range(0, 49),
    catalogo(supabase, ['tipo_ocupacion']),
  ])
  if (!e) return null
  const ocupaciones = (ocup ?? []).filter((o) => o.vigencia !== 'empty')
  const vigentes = ocupaciones.filter((o) => typeof o.vigencia === 'string' && enRango(o.vigencia, hoy))
  const refs = [...new Set(ocupaciones.map((o) => o.plaza_ref))]
  const [{ data: desc }, { data: plazasHoy }, { linea, visible }] = await Promise.all([
    refs.length ? org.rpc('describir_plazas', { p_refs: refs }) : Promise.resolve({ data: [] as { ref: string; cargo: string; unidad: string }[] }),
    refs.length ? supabase.schema('ui').rpc('plazas', { p_al: hoy }).in('ref', refs) : Promise.resolve({ data: [] as { ref: string; unidad_ref: string; cargo_id: string }[] }),
    lineaDe(supabase, sesion, 'org', 'ocupacion', ocupaciones.map((o) => o.id)),
  ])
  const plaza = new Map((desc ?? []).map((p) => [p.ref, p]))
  const hoyPlaza = new Map((plazasHoy ?? []).map((p) => [p.ref, p]))
  const principal = vigentes.find((o) => o.tipo === 'titular') ?? vigentes[0]
  const pp = principal ? hoyPlaza.get(principal.plaza_ref) : null
  const dep = pp ? (await org.rpc('dependencias', { p_cargo: pp.cargo_id, p_plaza: principal!.plaza_ref })).data : null
  const d = (dep ?? { procesos: [], rutas: [] }) as { procesos: { ref: string; nombre: string; codigo: string | null }[]; rutas: { ruta: string; paso: string }[] }
  const desde = (v: unknown) => (typeof v === 'string' ? (v.match(/^[[(]([\d-]*)/)?.[1] ?? null) : null)
  const hasta = (v: unknown) => (typeof v === 'string' ? (v.match(/,([\d-]*)[\])]$/)?.[1] ?? null) : null)
  const CERTEZA: Record<string, string> = { exacta: 'Exacta', por_nombre_de_cargo: 'Por nombre del cargo: conviene confirmarla', manual: 'Registrada a mano' }

  let plazasDestino: Opcion[] = []
  if (editar && principal) {
    const { data } = await supabase.schema('ui').rpc('plazas', { p_al: hoy }).select('ref, cargo, unidad, vacantes').neq('ref', principal.plaza_ref).order('unidad').range(0, 499)
    plazasDestino = (data ?? []).map((p) => ({ valor: p.ref as string, etiqueta: `${p.cargo ?? 'Plaza'} · ${p.unidad ?? ''}${(p.vacantes as number) > 0 ? ` (${p.vacantes} vacante${p.vacantes === 1 ? '' : 's'})` : ' (llena)'}` }))
  }
  const desc0 = principal ? plaza.get(principal.plaza_ref) : null
  return {
    ...vacia('persona', id, e.nombre_completo),
    subtitulo: desc0 ? `${desc0.cargo} · ${desc0.unidad}` : 'Sin plaza al día de hoy',
    codigo: e.ficha ? `Ficha ${e.ficha}` : null,
    estado: !e.activo ? { etiqueta: 'Inactiva en el padrón', tono: 'neutro' } : principal ? { etiqueta: etiquetaDe(cat.tipo_ocupacion, principal.tipo), tono: 'verde' } : { etiqueta: 'Sin plaza', tono: 'ambar' },
    hrefModulo: `${BASE}/personas?ficha=persona:${id}`,
    datos: [
      { etiqueta: 'Nombre', valor: e.nombre_completo },
      { etiqueta: 'Ficha', valor: e.ficha ?? '—', mono: true },
      { etiqueta: 'Cargo según el padrón', valor: e.cargo ?? '—' },
      {
        etiqueta: 'Plaza',
        valor: desc0 ? `${desc0.cargo} · ${desc0.unidad}` : '—',
        ...(editar && principal
          ? {
              editar: {
                accion: 'persona.mover',
                control: 'opciones' as const,
                valor: '',
                opciones: [{ valor: '', etiqueta: 'Elige la plaza de destino…' }, ...plazasDestino],
                conFecha: true,
                ayuda: 'Mover termina la ocupación en su plaza y abre otra en la de destino, desde la misma fecha. Si la de destino está llena, no se mueve nada.',
              },
            }
          : {}),
      },
      { etiqueta: 'Ocupación', valor: principal ? etiquetaDe(cat.tipo_ocupacion, principal.tipo) : '—' },
      { etiqueta: 'Desde', valor: principal ? fechaLarga(desde(principal.vigencia)) : '—' },
      { etiqueta: 'Certeza', valor: principal ? (CERTEZA[principal.certeza] ?? principal.certeza) : '—' },
      ...(principal?.excede_dotacion ? [{ etiqueta: 'Sobre la dotación', valor: 'Sí: está registrada por encima de la dotación aprobada' }] : []),
      { etiqueta: 'Datos personales', valor: 'Los lleva Capital Humano en el padrón; aquí solo se muestra el nombre y la ficha.' },
    ],
    secciones: [
      {
        clave: 'trayectoria',
        etiqueta: 'Trayectoria',
        n: ocupaciones.length,
        bloques: [
          {
            tipo: 'pasos',
            pasos: ocupaciones.map((o, i) => {
              const p = plaza.get(o.plaza_ref)
              const viva = typeof o.vigencia === 'string' && enRango(o.vigencia, hoy)
              return {
                orden: ocupaciones.length - i,
                nombre: p ? `${p.cargo} · ${p.unidad}` : 'Plaza',
                quien: `${etiquetaDe(cat.tipo_ocupacion, o.tipo)} · desde ${fechaCorta(desde(o.vigencia))}${hasta(o.vigencia) ? ` hasta ${fechaCorta(hasta(o.vigencia))}` : ''}`,
                estado: viva ? 'Vigente' : 'Terminada',
                tono: (viva ? 'verde' : 'neutro') as TonoFicha,
                nota: o.motivo,
                acciones:
                  editar && viva
                    ? [
                        {
                          accion: 'ocupacion.terminar',
                          param: o.id,
                          etiqueta: 'Terminar',
                          motivo: 'opcional' as const,
                          conFecha: true,
                          rotuloFecha: 'Deja de ocupar desde',
                          confirmar: 'La ocupación se cierra con esa fecha; queda en la trayectoria.',
                        },
                      ]
                    : [],
              }
            }),
          },
        ],
      },
      {
        clave: 'dependencias',
        etiqueta: 'Dependencias',
        n: d.procesos.length + d.rutas.length,
        bloques: [
          { tipo: 'lista', titulo: 'Procesos que dirige su plaza', vacio: 'Su plaza no es dueña de ningún proceso vigente.', items: d.procesos.map((p) => ({ tipo: 'Proceso', titulo: p.nombre, detalle: p.codigo, ficha: `proceso:${p.ref}` })) },
          { tipo: 'lista', titulo: 'Rutas donde firma su cargo', vacio: 'Su cargo no firma en ninguna ruta activa.', items: d.rutas.map((r) => ({ tipo: 'Ruta', titulo: r.paso, detalle: r.ruta })) },
        ],
      },
    ],
    relaciones: [
      ...vigentes.flatMap((o) => {
        const p = hoyPlaza.get(o.plaza_ref)
        const ds = plaza.get(o.plaza_ref)
        return [
          { tipo: 'Plaza', titulo: ds?.cargo ?? 'Plaza', detalle: ds?.unidad ?? null, ficha: `plaza:${o.plaza_ref}` },
          ...(p ? [{ tipo: 'Unidad', titulo: ds?.unidad ?? 'Unidad', ficha: `unidad:${p.unidad_ref}` }, { tipo: 'Cargo', titulo: ds?.cargo ?? 'Cargo', ficha: `cargo:${p.cargo_id}` }] : []),
        ]
      }),
      ...d.procesos.map((p) => ({ tipo: 'Proceso que dirige', titulo: p.nombre, detalle: p.codigo, ficha: `proceso:${p.ref}` })),
      ...d.rutas.map((r) => ({ tipo: 'Firma en', titulo: r.paso, detalle: r.ruta })),
    ],
    linea,
    lineaVisible: visible,
  }
}

// -----------------------------------------------------------------------------
// Requisición
// -----------------------------------------------------------------------------

type Impacto = {
  dotacion_aprobada?: number
  dotacion_ocupada?: number
  dotacion_despues?: number
  plan_del_anio?: number | null
  fuera_de_plan?: boolean
  tramo_jefe_antes?: number
  tramo_jefe_despues?: number
  procesos_del_cargo?: { nombre: string; codigo: string | null }[]
  rutas_donde_firma?: { ruta: string; paso: string }[]
  plazas_que_le_reportan?: number
  fecha?: string
}

async function fichaRequisicion(supabase: Cliente, sesion: Sesion, id: string): Promise<Ficha | null> {
  const hoy = hoyCaracas()
  const org = supabase.schema('org')
  const { data: q } = await org.from('requisicion').select('*, cargo(nombre)').eq('id', id).maybeSingle()
  if (!q) return null
  const verCostos = puede(sesion, 'sistema:costos')
  const editarCostos = puede(sesion, 'sistema:costos', 'editar')
  const rrhh = puede(sesion, 'sistema:requisiciones', 'editar')
  const propia = q.creado_por === sesion.userId
  const enviada = q.impacto !== null
  const [{ data: unidad }, impactoVivo, flujo, cat, reemplaza, pidio, aprob, { linea, visible }] = await Promise.all([
    org.from('unidad').select('ref, nombre').eq('ref', q.unidad_ref).is('escenario_id', null).order('vigencia', { ascending: false }).limit(1).maybeSingle(),
    enviada ? Promise.resolve({ data: null }) : org.rpc('impacto_requisicion', { p_req: id }),
    contextoFlujo(supabase, 'requisicion_personal', id),
    catalogo(supabase, ['origen_requisicion', 'tipo_nomina']),
    q.reemplaza_empleado_id ? supabase.from('empleados').select('nombre_completo').eq('id', q.reemplaza_empleado_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.schema('flujo').rpc('nombres', { p_ids: [q.creado_por].filter(Boolean) as string[] }),
    aprobacionesDe(supabase, [id]),
    lineaDe(supabase, sesion, 'org', 'requisicion', [id]),
  ])
  const cargo = (q.cargo as unknown as { nombre: string } | null)?.nombre ?? 'Cargo'
  const est = ESTADO_REQUISICION[q.estado] ?? { etiqueta: q.estado, tono: 'neutro' as const }
  const imp = ((enviada ? q.impacto : impactoVivo.data) ?? null) as Impacto | null
  const perfil = (q.perfil ?? {}) as Record<string, string | null>
  const cond = (q.condiciones ?? {}) as Record<string, string | null>
  const corregible = ['borrador', 'devuelta'].includes(q.estado) && (propia || rrhh)
  const cancelable = ['borrador', 'devuelta', 'en_aprobacion'].includes(q.estado) && (propia || rrhh)
  const ingresable = ['aprobada', 'en_seleccion'].includes(q.estado) && rrhh && Boolean(q.plaza_ref)
  const viva = flujo.solicitudes.find((s) => s.estado === 'en_curso')
  const pasoActual = viva?.pasos.find((p) => p.orden === viva.paso_actual)
  const POSTURA: Record<string, string> = { de_pie: 'De pie', sentado: 'Sentado', alterna: 'Alterna' }

  const secciones: SeccionFicha[] = [
    {
      clave: 'impacto',
      etiqueta: 'Impacto',
      bloques: imp
        ? [
            {
              tipo: 'cifras',
              cifras: [
                { etiqueta: 'Dotación de la unidad', valor: `${numero(imp.dotacion_aprobada)} → ${numero(imp.dotacion_despues)}`, detalle: `${numero(imp.dotacion_ocupada)} ocupada hoy` },
                {
                  etiqueta: `Plan ${(imp.fecha ?? hoy).slice(0, 4)}`,
                  valor: imp.plan_del_anio === null || imp.plan_del_anio === undefined ? 'Sin plan' : numero(imp.plan_del_anio),
                  detalle: imp.fuera_de_plan ? 'Fuera del plan' : 'Dentro del plan',
                  tono: imp.fuera_de_plan ? 'ambar' : 'verde',
                },
                { etiqueta: 'Tramo del jefe', valor: `${numero(imp.tramo_jefe_antes)} → ${numero(imp.tramo_jefe_despues)}`, detalle: 'plazas que le reportan' },
                { etiqueta: 'Le reportarían', valor: numero(imp.plazas_que_le_reportan) },
              ],
              sello: enviada ? `Congelado al enviarla, el ${fechaLarga(imp.fecha ?? null)}` : 'Calculado ahora: se congela al enviarla',
            },
            { tipo: 'lista', titulo: 'Procesos que dirige el cargo', vacio: 'Ninguno.', items: (imp.procesos_del_cargo ?? []).map((p) => ({ tipo: 'Proceso', titulo: p.nombre, detalle: p.codigo })) },
            { tipo: 'lista', titulo: 'Rutas donde firma el cargo', vacio: 'Ninguna.', items: (imp.rutas_donde_firma ?? []).map((r) => ({ tipo: 'Ruta', titulo: r.paso, detalle: r.ruta })) },
          ]
        : [{ tipo: 'texto', texto: 'Sin impacto calculado.' }],
    },
    { clave: 'ruta', etiqueta: 'Ruta', n: viva ? 1 : undefined, bloques: bloqueRuta(flujo, { requisicion: true }) },
    {
      clave: 'pide',
      etiqueta: 'Lo que se pide',
      bloques: [
        {
          tipo: 'datos',
          filas: [
            { etiqueta: 'Origen', valor: etiquetaDe(cat.origen_requisicion, q.origen) },
            { etiqueta: 'Cantidad', valor: numero(q.cantidad) },
            { etiqueta: 'Nómina', valor: etiquetaDe(cat.tipo_nomina, q.tipo_nomina) },
            ...(reemplaza.data ? [{ etiqueta: 'Reemplaza a', valor: (reemplaza.data as { nombre_completo: string }).nombre_completo }] : []),
            ...(q.motivo_contrato ? [{ etiqueta: 'Motivo del contrato', valor: `${q.motivo_contrato}${q.tiempo_contrato ? ` · ${q.tiempo_contrato}` : ''}` }] : []),
            { etiqueta: 'Justificación', valor: q.justificacion },
            { etiqueta: 'Fecha deseada', valor: fechaLarga(q.fecha_deseada) },
          ],
        },
        {
          tipo: 'datos',
          titulo: 'Perfil',
          filas: [
            { etiqueta: 'Nivel educativo', valor: perfil.nivel_educativo ?? '—' },
            { etiqueta: 'Especialidad', valor: perfil.especialidad ?? '—' },
            { etiqueta: 'Conocimientos', valor: perfil.conocimientos ?? '—' },
            ...(perfil.requisito_fisico ? [{ etiqueta: 'Requisito físico', valor: `${perfil.requisito_fisico} — ${perfil.requisito_fisico_justificacion ?? ''}` }] : []),
          ],
        },
        {
          tipo: 'datos',
          titulo: 'Condiciones del cargo',
          filas: [
            { etiqueta: 'Turnos', valor: cond.turnos ?? '—' },
            { etiqueta: 'Postura', valor: cond.postura ? (POSTURA[cond.postura] ?? cond.postura) : '—' },
            { etiqueta: 'Carga', valor: cond.carga ?? '—' },
          ],
        },
        ...(q.candidato ? [{ tipo: 'datos' as const, titulo: 'Selección', filas: [{ etiqueta: 'Candidato', valor: q.candidato }, { etiqueta: 'Ingreso', valor: fechaLarga(q.fecha_ingreso) }] }] : []),
      ],
    },
  ]

  // Perímetro de nómina: sin el permiso, la pestaña no existe y la tabla no se lee.
  if (verCostos) {
    const [{ data: fila }, vivo] = await Promise.all([
      org.from('requisicion_costo').select('salario_propuesto, moneda, bonos_usd, impacto_costo, nota').eq('requisicion_id', id).maybeSingle(),
      enviada ? Promise.resolve({ data: null }) : org.rpc('costo_mensual', { p_cargo: q.cargo_id, p_fecha: hoy }),
    ])
    const congelado = ((fila?.impacto_costo as { por_plaza?: CostoCargo } | null)?.por_plaza ?? null) as CostoCargo
    const costo = enviada ? congelado : (vivo.data as CostoCargo)
    const mon = await leerMoneda()
    const edSal = (accion: string, control: 'numero' | 'opciones' | 'textoLargo', valor: string, opciones?: Opcion[]) =>
      editarCostos ? { editar: { accion, control, valor, opciones, ayuda: 'La propuesta salarial es perímetro de nómina: solo la ven los pasos y roles con costos.' } } : {}
    secciones.push({
      clave: 'costo',
      etiqueta: 'Costo',
      candado: true,
      bloques: [
        ...bloquesCosto(costo, q.cantidad, mon, enviada ? 'Costo congelado al enviarla' : 'Costo si se aprobara hoy'),
        {
          tipo: 'datos',
          titulo: 'Propuesta salarial',
          filas: [
            {
              etiqueta: 'Salario propuesto',
              valor: fila?.salario_propuesto !== null && fila?.salario_propuesto !== undefined ? moneda(fila.salario_propuesto, (fila.moneda ?? 'VES') as 'VES' | 'USD') : '—',
              ...edSal('req.salario', 'numero', fila?.salario_propuesto !== null && fila?.salario_propuesto !== undefined ? String(fila.salario_propuesto) : ''),
            },
            {
              etiqueta: 'Moneda',
              valor: fila?.moneda === 'USD' ? 'USD' : 'Bs',
              ...edSal('req.moneda', 'opciones', fila?.moneda ?? 'VES', [
                { valor: 'VES', etiqueta: 'Bs' },
                { valor: 'USD', etiqueta: 'USD' },
              ]),
            },
            { etiqueta: 'Bonos (USD)', valor: fila?.bonos_usd !== null && fila?.bonos_usd !== undefined ? `USD ${numero(fila.bonos_usd, 2)}` : '—', ...edSal('req.bonos', 'numero', fila?.bonos_usd ? String(fila.bonos_usd) : '') },
            { etiqueta: 'Nota', valor: fila?.nota ?? '—', ...edSal('req.nota', 'textoLargo', fila?.nota ?? '') },
          ],
        },
      ],
    })
  }

  const acciones: AccionFicha[] = [
    ...(corregible && q.estado === 'borrador' || (corregible && q.estado === 'devuelta')
      ? [{ accion: 'req.enviar', etiqueta: q.estado === 'devuelta' ? 'Reenviar a aprobación' : 'Enviar a aprobación', tono: 'principal' as const, confirmar: 'Al enviarla se congela el impacto y arranca la ruta de aprobación.' }]
      : []),
    ...(corregible ? [{ href: `${BASE}/requisiciones/${id}/editar`, etiqueta: 'Corregir' }] : []),
    ...(ingresable ? [{ href: `${BASE}/requisiciones/${id}#ingreso`, etiqueta: 'Registrar ingreso' }] : []),
    ...(cancelable ? [{ accion: 'req.cancelar', etiqueta: 'Cancelar', tono: 'peligro' as const, motivo: 'opcional' as const, confirmar: 'La requisición queda cancelada y la ruta, cerrada.' }] : []),
  ]

  return {
    ...vacia('requisicion', id, `${cargo}${q.cantidad > 1 ? ` × ${q.cantidad}` : ''}`),
    subtitulo: `${unidad?.nombre ?? 'Unidad'} · ${etiquetaDe(cat.origen_requisicion, q.origen)}`,
    codigo: `N.º ${q.numero}`,
    estado: { etiqueta: est.etiqueta, tono: TONO[est.tono] ?? 'neutro' },
    hrefModulo: `${BASE}/requisiciones/${id}`,
    datos: [
      { etiqueta: 'Cargo', valor: cargo },
      { etiqueta: 'Unidad', valor: unidad?.nombre ?? '—' },
      { etiqueta: 'Personas', valor: numero(q.cantidad) },
      { etiqueta: 'Origen', valor: etiquetaDe(cat.origen_requisicion, q.origen) },
      { etiqueta: 'Estado', valor: est.etiqueta },
      ...(pasoActual ? [{ etiqueta: 'Paso actual', valor: `${pasoActual.nombre}${pasoActual.aprobador_perfil ? ` · ${flujo.nombres[pasoActual.aprobador_perfil] ?? ''}` : ''}` }] : []),
      { etiqueta: 'Pedida por', valor: pidio.data?.[0]?.nombre ?? '—' },
      { etiqueta: 'Pedida', valor: fechaHora(q.creado_en) },
      { etiqueta: 'Formato', valor: 'Requisición de Personal II-21-40-001' },
    ],
    secciones,
    acciones,
    relaciones: [
      ...(unidad ? [{ tipo: 'Unidad', titulo: unidad.nombre, ficha: `unidad:${unidad.ref}` }] : []),
      { tipo: 'Cargo', titulo: cargo, ficha: `cargo:${q.cargo_id}` },
      ...(q.plaza_ref ? [{ tipo: 'Plaza', titulo: cargo, detalle: unidad?.nombre ?? null, ficha: `plaza:${q.plaza_ref}` }] : []),
      ...(q.reemplaza_empleado_id && reemplaza.data ? [{ tipo: 'Reemplaza a', titulo: (reemplaza.data as { nombre_completo: string }).nombre_completo, ficha: `persona:${q.reemplaza_empleado_id}` }] : []),
    ],
    aprobaciones: aprob,
    linea,
    lineaVisible: visible,
  }
}

// -----------------------------------------------------------------------------
// Escenario de estructura
// -----------------------------------------------------------------------------

type Cambio = { objeto: string; ref: string; cambio: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }
const CAMBIO: Record<string, { etiqueta: string; tono: TonoFicha }> = {
  alta: { etiqueta: 'Alta', tono: 'verde' },
  baja: { etiqueta: 'Cierre', tono: 'rojo' },
  renombre: { etiqueta: 'Renombre', tono: 'azul' },
  movimiento: { etiqueta: 'Movimiento', tono: 'ambar' },
  dotacion: { etiqueta: 'Dotación', tono: 'ambar' },
  cambio: { etiqueta: 'Cambio', tono: 'neutro' },
}

async function fichaEscenario(supabase: Cliente, sesion: Sesion, id: string): Promise<Ficha | null> {
  const org = supabase.schema('org')
  const hoy = hoyCaracas()
  const { data: e } = await org.from('escenario').select('*').eq('id', id).maybeSingle()
  if (!e || e.alcance !== 'estructura') return null
  const borrador = e.estado === 'borrador'
  const editar = borrador && puede(sesion, 'sistema:escenarios', 'editar')
  const comparable = ['borrador', 'en_aprobacion', 'aprobado'].includes(e.estado)
  const [cmp, { data: uEsc }, { data: cargos }, flujo, creador, { linea, visible }, aprob] = await Promise.all([
    comparable ? org.rpc('comparar_escenario', { p_escenario: id }) : Promise.resolve({ data: [] }),
    org.from('unidad').select('ref, nombre').eq('escenario_id', id).range(0, 999),
    org.from('cargo').select('id, nombre').range(0, 1999),
    contextoFlujo(supabase, 'escenario_estructura', id),
    supabase.schema('flujo').rpc('nombres', { p_ids: [e.creado_por].filter(Boolean) as string[] }),
    lineaDe(supabase, sesion, 'org', 'escenario', [id]),
    aprobacionesDe(supabase, [id]),
  ])
  const cambios = (cmp.data ?? []) as unknown as Cambio[]
  const { data: uReal } = await org.from('unidad').select('ref, nombre').is('escenario_id', null).filter('vigencia', 'cs', vigente(e.fecha_base)).range(0, 999)
  const nombreU = new Map<string, string>([...(uReal ?? []).map((u) => [u.ref, u.nombre] as [string, string]), ...(uEsc ?? []).map((u) => [u.ref, u.nombre] as [string, string])])
  const nombreC = new Map((cargos ?? []).map((c) => [c.id, c.nombre]))
  const dot = (x: Record<string, unknown> | null) => Number(x?.dotacion ?? 0)
  const deltaDot = cambios.filter((c) => c.objeto === 'plaza').reduce((s, c) => s + dot(c.despues) - dot(c.antes), 0)
  const altas = cambios.filter((c) => c.cambio === 'alta').length
  const bajas = cambios.filter((c) => c.cambio === 'baja').length

  const describir = (c: Cambio) => {
    const x = (c.despues ?? c.antes ?? {}) as Record<string, string | number | null>
    if (c.objeto === 'unidad') {
      const titulo = String(x.nombre ?? nombreU.get(c.ref) ?? 'Unidad')
      const detalle =
        c.cambio === 'movimiento'
          ? `De ${nombreU.get(String(c.antes?.padre_ref ?? '')) ?? 'la raíz'} a ${nombreU.get(String(c.despues?.padre_ref ?? '')) ?? 'la raíz'}`
          : c.cambio === 'renombre'
            ? `Antes «${String(c.antes?.nombre ?? '')}»`
            : null
      return { titulo, detalle }
    }
    const cargo = nombreC.get(String(x.cargo_id ?? '')) ?? 'Plaza'
    const unidad = nombreU.get(String(x.unidad_ref ?? '')) ?? ''
    const detalle =
      c.cambio === 'dotacion' || c.cambio === 'alta' || c.cambio === 'baja'
        ? `${unidad} · dotación ${c.antes ? dot(c.antes) : 0} → ${c.despues ? dot(c.despues) : 0}`
        : c.cambio === 'movimiento'
          ? `De ${nombreU.get(String(c.antes?.unidad_ref ?? '')) ?? '—'} a ${nombreU.get(String(c.despues?.unidad_ref ?? '')) ?? '—'}`
          : unidad
    return { titulo: cargo, detalle }
  }

  const secciones: SeccionFicha[] = [
    {
      clave: 'cambios',
      etiqueta: 'Cambios',
      n: cambios.length,
      bloques: comparable
        ? [
            {
              tipo: 'cifras',
              cifras: [
                { etiqueta: 'Altas', valor: numero(altas) },
                { etiqueta: 'Cierres', valor: numero(bajas), tono: bajas ? 'ambar' : 'neutro' },
                { etiqueta: 'Otros cambios', valor: numero(cambios.length - altas - bajas) },
                { etiqueta: 'Δ dotación', valor: `${deltaDot > 0 ? '+' : ''}${numero(deltaDot)}`, tono: deltaDot > 0 ? 'ambar' : deltaDot < 0 ? 'azul' : 'neutro' },
              ],
              sello: `Contra la estructura real del ${fechaLarga(e.fecha_base)}`,
            },
            {
              tipo: 'lista',
              vacio: 'Todavía es igual a la realidad: ábrelo en el lienzo y arrastra cajas para cambiar dependencias.',
              items: cambios.slice(0, 80).map((c) => {
                const d = describir(c)
                return {
                  tipo: `${CAMBIO[c.cambio]?.etiqueta ?? c.cambio} · ${c.objeto === 'unidad' ? 'unidad' : 'plaza'}`,
                  titulo: d.titulo,
                  detalle: d.detalle,
                  ficha: c.cambio === 'alta' ? null : c.objeto === 'unidad' ? `unidad:${c.ref}` : `plaza:${c.ref}`,
                }
              }),
            },
          ]
        : [{ tipo: 'texto', texto: e.estado === 'publicado' ? `Publicado: sus cambios rigen desde el ${fechaLarga(e.vigente_desde)}. Queda como evidencia.` : 'Descartado: queda como registro; no se compara.' }],
    },
  ]
  if (comparable && puede(sesion, 'sistema:costos')) {
    // Δ costo = Σ Δdotación × costo mensual de referencia del cargo. Perímetro de nómina.
    const porCargo = new Map<string, number>()
    for (const c of cambios.filter((x) => x.objeto === 'plaza')) {
      const a = c.antes?.cargo_id as string | undefined
      const b = c.despues?.cargo_id as string | undefined
      if (a) porCargo.set(a, (porCargo.get(a) ?? 0) - dot(c.antes))
      if (b) porCargo.set(b, (porCargo.get(b) ?? 0) + dot(c.despues))
    }
    const conDelta = [...porCargo.entries()].filter(([, d]) => d !== 0)
    const costos = await Promise.all(conDelta.map(([cargo]) => org.rpc('costo_mensual', { p_cargo: cargo, p_fecha: hoy })))
    let ves = 0
    let tasa: number | null = null
    let tasaFecha: string | null = null
    const faltan: string[] = []
    conDelta.forEach(([cargo, d], i) => {
      const c = costos[i].data as CostoCargo
      if (!c) faltan.push(nombreC.get(cargo) ?? 'Cargo')
      else {
        ves += d * (c.total_ves ?? 0)
        tasa = c.tasa ?? tasa
        tasaFecha = c.tasa_fecha ?? tasaFecha
      }
    })
    const mon = await leerMoneda()
    const ver = (v: number) => (mon === 'USD' ? moneda(tasa ? v / tasa : null, 'USD') : moneda(v, 'VES'))
    secciones.push({
      clave: 'costo',
      etiqueta: 'Costo',
      candado: true,
      bloques: [
        {
          tipo: 'cifras',
          titulo: 'Δ costo de referencia',
          cifras: [
            { etiqueta: 'Al mes', valor: `${ves > 0 ? '+' : ''}${ver(ves)}` },
            { etiqueta: 'Al año', valor: `${ves > 0 ? '+' : ''}${ver(ves * 12)}` },
          ],
          sello: tasa ? `Tasa BCV ${numero(tasa, 2)} Bs/USD · fecha valor ${fechaCorta(tasaFecha)}` : null,
        },
        ...(faltan.length ? [{ tipo: 'texto' as const, tono: 'ambar' as const, texto: `Falta costo de referencia (no suman): ${faltan.join(', ')}.` }] : []),
      ],
    })
  }
  if (flujo.solicitudes.length) secciones.push({ clave: 'ruta', etiqueta: 'Ruta', bloques: bloqueRuta(flujo) })

  const est = ESTADO_ESCENARIO[e.estado] ?? { etiqueta: e.estado, tono: 'neutro' as const }
  const ed = (accion: string, control: 'texto' | 'textoLargo', valor: string) => (editar ? { editar: { accion, control, valor } } : {})
  return {
    ...vacia('escenario', id, e.nombre),
    subtitulo: `Escenario de estructura · base ${fechaLarga(e.fecha_base)}`,
    estado: { etiqueta: est.etiqueta, tono: borrador ? 'morado' : (TONO[est.tono] ?? 'neutro') },
    hrefModulo: `/sistema/nucleo/escenarios/${id}`,
    datos: [
      { etiqueta: 'Nombre', valor: e.nombre, ...ed('esc.nombre', 'texto', e.nombre) },
      { etiqueta: 'Para qué', valor: e.descripcion ?? '—', ...ed('esc.descripcion', 'textoLargo', e.descripcion ?? '') },
      { etiqueta: 'Estado', valor: est.etiqueta },
      { etiqueta: 'Fecha base', valor: fechaLarga(e.fecha_base) },
      { etiqueta: 'Rige desde', valor: e.vigente_desde ? fechaLarga(e.vigente_desde) : '—' },
      { etiqueta: 'Creado por', valor: creador.data?.[0]?.nombre ?? '—' },
      { etiqueta: 'Creado', valor: fechaHora(e.creado_en) },
      ...(e.publicado_en ? [{ etiqueta: 'Publicado', valor: fechaHora(e.publicado_en) }] : []),
    ],
    secciones,
    acciones: [
      ...(comparable ? [{ href: `${BASE}?esc=${id}`, etiqueta: borrador ? 'Abrir en el lienzo' : 'Ver en el lienzo', tono: 'principal' as const }] : []),
      ...(comparable ? [{ href: `/sistema/nucleo/escenarios/${id}?vista=comparar`, etiqueta: 'Comparar e impacto' }] : []),
      ...(editar
        ? [
            {
              accion: 'esc.enviar',
              etiqueta: 'Enviar a aprobación',
              conFecha: true,
              confirmar: 'Elige desde cuándo regirá. Cuando firme el último paso, se publica solo con esa fecha.',
            },
          ]
        : []),
      ...(borrador && puede(sesion, 'sistema:escenarios', 'eliminar')
        ? [{ accion: 'esc.descartar', etiqueta: 'Descartar', tono: 'peligro' as const, confirmar: 'Queda como registro; no se borra ni toca la realidad.' }]
        : []),
    ],
    relaciones: [],
    aprobaciones: aprob,
    linea,
    lineaVisible: visible,
  }
}

// -----------------------------------------------------------------------------
// Punto de conciliación (la cola de calidad del dato)
// -----------------------------------------------------------------------------

const MODULO_CONC: Record<string, string> = { 'NUC-ORG': 'Organización', 'NUC-PRO': 'Procesos', 'NUC-DOC': 'Documentos' }
const TIPO_CONC: Record<string, string> = { contradiccion: 'Contradicción', faltante: 'Faltante', sin_casar: 'Sin casar', inferencia: 'Inferencia', decision: 'Decisión pendiente' }

async function fichaConciliacion(supabase: Cliente, sesion: Sesion, id: string): Promise<Ficha | null> {
  const { data: c } = await supabase.schema('ui').rpc('conciliacion').eq('id', id).maybeSingle()
  if (!c) return null
  const recurso = c.modulo === 'NUC-PRO' ? 'sistema:procesos' : c.modulo === 'NUC-DOC' ? 'sistema:documentos' : 'sistema:estructura'
  const resolver = puede(sesion, recurso, 'editar')
  const { linea, visible } = await lineaDe(supabase, sesion, 'control', 'conciliacion', [id])
  const abierto = c.estado === 'abierto'
  return {
    ...vacia('conciliacion', id, c.descripcion),
    subtitulo: `${TIPO_CONC[c.tipo] ?? c.tipo} · ${MODULO_CONC[c.modulo] ?? c.modulo}`,
    estado: abierto ? { etiqueta: 'Abierto', tono: 'ambar' } : c.estado === 'resuelto' ? { etiqueta: 'Resuelto', tono: 'verde' } : { etiqueta: 'Descartado', tono: 'neutro' },
    hrefModulo: `/sistema/nucleo/conciliacion?ficha=conciliacion:${id}`,
    datos: [
      { etiqueta: 'Qué hay que decidir', valor: c.descripcion },
      { etiqueta: 'Tipo', valor: TIPO_CONC[c.tipo] ?? c.tipo },
      { etiqueta: 'Objeto', valor: c.objeto ?? '—' },
      { etiqueta: 'Módulo', valor: MODULO_CONC[c.modulo] ?? c.modulo },
      { etiqueta: 'Lo resuelve', valor: c.responsable ?? '—' },
      { etiqueta: 'Fuente', valor: c.fuente ?? '—' },
      { etiqueta: 'Entró', valor: `${fechaLarga(c.creado_en)} · hace ${numero(c.dias)} día${c.dias === 1 ? '' : 's'}` },
      ...(c.resolucion ? [{ etiqueta: c.estado === 'descartado' ? 'Por qué se descartó' : 'Cómo se resolvió', valor: c.resolucion }] : []),
      ...(c.resuelto_por ? [{ etiqueta: 'Lo cerró', valor: `${c.resuelto_por} · ${fechaHora(c.resuelto_en)}` }] : []),
    ],
    acciones: resolver
      ? abierto
        ? [
            { accion: 'conc.resolver', etiqueta: 'Resolver', tono: 'principal', motivo: 'obligatorio', rotuloMotivo: 'Cómo se resolvió (qué se corrigió y dónde)' },
            { accion: 'conc.descartar', etiqueta: 'Descartar', motivo: 'obligatorio', rotuloMotivo: 'Por qué se descarta' },
          ]
        : [{ accion: 'conc.reabrir', etiqueta: 'Reabrir', confirmar: 'Vuelve a la cola como abierto.' }]
      : [],
    linea,
    lineaVisible: visible,
  }
}
