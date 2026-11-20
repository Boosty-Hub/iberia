import { esEditor, puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_ENTREVISTA, hallazgosPorEstado, internasDeEntrevistas } from '@/lib/contacto'
import { FRENTE, ESTADOS_ACTIVIDAD, TIPOS_ACTIVIDAD, rango, type EstadoActividad, type Frente, type TipoActividad } from '@/lib/calendario'
import type { BloqueFicha, DatoFicha, Ficha, ResultadoAccionFicha, SeccionFicha, TonoFicha } from '@/lib/plataforma/ficha-tipos'
import type { ManejadorFicha } from '@/lib/plataforma/fichas/acciones'
import { fechaCorta, fechaHora, numero } from '@/lib/plataforma/formato'
import { SERIES_SESION } from '@/lib/plataforma/tablas-programa'
import {
  CATEGORIAS_ARCHIVO,
  ESTADOS_ENTREVISTA,
  ESTADOS_HALLAZGO,
  ROLES_PARTICIPANTE,
  SEDES,
  TIPOS_SESION,
  type CategoriaArchivo,
  type EstadoEntrevista,
  type RolParticipante,
  type Sede,
  type TipoSesion,
} from '@/lib/types'
import { formatBytes, nombreSesion } from '@/lib/utils'
import { actualizarActividad } from '@/app/sistema/programa/calendario/acciones'

/**
 * Las fichas del Programa (PRG): `entrevista` (una sesión del levantamiento),
 * `archivo` (un documento del expediente) y `actividad` (una del calendario de
 * la Fase 2 y New Iberia). Cada una pide la casilla de su módulo —las mismas de
 * siempre: `modulo:entrevistas`, `modulo:archivos`, `modulo:calendario`— y lee
 * con la RLS de quien mira.
 *
 * ⚠️ Lo lee Iberia. Nada de dinero. Lo «solo Boosty» —la transcripción, las
 * notas del consultor y los hallazgos sin validar— solo llega al equipo
 * (`esEditor`): para el cliente esas piezas no existen en la ficha.
 */

const UUID = /^[0-9a-f-]{36}$/i
const BASE_LEV = '/sistema/programa/levantamiento'

const TONO_ESTADO_ENTREVISTA: Record<EstadoEntrevista, TonoFicha> = {
  programada: 'neutro',
  realizada: 'ambar',
  transcrita: 'azul',
  analizada: 'verde',
}

const TONO_ESTADO_ACTIVIDAD: Record<EstadoActividad, TonoFicha> = {
  por_agendar: 'neutro',
  por_confirmar: 'ambar',
  agendado: 'azul',
  en_curso: 'azul',
  hecho: 'verde',
}

export const TIPOS_PROGRAMA = ['entrevista', 'archivo', 'actividad'] as const
export type TipoPrograma = (typeof TIPOS_PROGRAMA)[number]
export function esTipoPrograma(t: string): t is TipoPrograma {
  return (TIPOS_PROGRAMA as readonly string[]).includes(t)
}

export async function cargarFichaPrograma(sesion: Sesion, tipo: TipoPrograma, id: string): Promise<Ficha | null> {
  if (!UUID.test(id)) return null
  if (tipo === 'entrevista') return fichaEntrevista(sesion, id)
  if (tipo === 'archivo') return fichaArchivo(sesion, id)
  return fichaActividad(sesion, id)
}

// ── Entrevista ───────────────────────────────────────────────────────────────

async function fichaEntrevista(sesion: Sesion, id: string): Promise<Ficha | null> {
  if (!puede(sesion, 'modulo:entrevistas')) return null
  const supabase = await createClient()
  const { data: fila } = await supabase.from('entrevistas').select(`${COLUMNAS_ENTREVISTA}, areas(id, nombre)`).eq('id', id).maybeSingle()
  if (!fila) return null
  const equipo = esEditor(sesion.perfil)
  // Las notas del consultor no salen de la tabla: solo el equipo las pide.
  const interna = equipo ? (await internasDeEntrevistas(supabase, [id])).get(id) : undefined
  const e = { ...fila, notas_consultor: interna?.notas_consultor ?? null }

  const [{ data: participantes }, hallazgos, { data: archivos }, turnos] = await Promise.all([
    supabase
      .from('sesion_participantes')
      .select('id, rol, etiqueta_hablante, personas(id, nombre_completo, cargo, organizacion)')
      .eq('entrevista_id', id),
    hallazgosPorEstado(supabase, id),
    puede(sesion, 'modulo:archivos') ? supabase.from('archivos').select('id, nombre, tamano_bytes').eq('entrevista_id', id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] as { id: string; nombre: string; tamano_bytes: number | null }[] }),
    // La transcripción es «solo Boosty»: al cliente ni siquiera se le cuenta.
    equipo ? supabase.from('transcripcion_segmentos').select('id', { count: 'exact', head: true }).eq('entrevista_id', id) : Promise.resolve({ count: null }),
  ])

  const estado = e.estado as EstadoEntrevista
  const serie = e.codigo.slice(0, 3)
  const datos: DatoFicha[] = [
    { etiqueta: 'Código', valor: e.codigo, mono: true },
    { etiqueta: 'Serie', valor: SERIES_SESION[serie] ?? serie },
    { etiqueta: 'Tipo', valor: TIPOS_SESION[e.tipo as TipoSesion] ?? e.tipo },
    { etiqueta: 'Estado', valor: ESTADOS_ENTREVISTA[estado] ?? e.estado },
    ...(e.entrevistado_nombre ? [{ etiqueta: 'Entrevistado', valor: e.entrevistado_nombre }] : []),
    { etiqueta: 'Cargo', valor: e.entrevistado_cargo ?? '—' },
    { etiqueta: 'Área', valor: e.areas?.nombre ?? '—' },
    { etiqueta: 'Sede', valor: e.sede ? (SEDES[e.sede as Sede] ?? e.sede) : '—' },
    { etiqueta: 'Fecha', valor: fechaCorta(e.fecha_entrevista) },
    { etiqueta: 'Duración', valor: e.duracion_minutos ? `${numero(e.duracion_minutos)} min` : '—' },
    { etiqueta: 'Entrevistador', valor: e.entrevistador ?? '—' },
    { etiqueta: 'Resumen', valor: e.resumen?.trim() || '—' },
    // Las notas del consultor son de trabajo interno: no las lee el cliente.
    ...(equipo && e.notas_consultor?.trim() ? [{ etiqueta: 'Notas del consultor 🔒', valor: e.notas_consultor.trim() }] : []),
  ]

  const conteo = (est: string) => hallazgos.get(est) ?? 0
  const secciones: SeccionFicha[] = []

  const gente = participantes ?? []
  secciones.push({
    clave: 'participantes',
    etiqueta: 'Participantes',
    n: gente.length,
    bloques: [
      {
        tipo: 'lista',
        items: gente.map((p) => ({
          tipo: p.rol === 'participante' ? 'Participante' : (ROLES_PARTICIPANTE[p.rol as RolParticipante] ?? p.rol),
          titulo: `${p.personas?.nombre_completo ?? '—'}${p.personas && p.personas.organizacion !== 'iberia' ? ' (externo)' : ''}`,
          detalle: [p.personas?.cargo, equipo ? p.etiqueta_hablante : null].filter(Boolean).join(' · ') || null,
        })),
        vacio: 'Sin participantes identificados.',
      },
    ],
  })

  // Hallazgos: el cliente ve los validados; el equipo, también los propuestos.
  const cifrasHallazgos = [
    { etiqueta: ESTADOS_HALLAZGO.validado, valor: numero(conteo('validado')), tono: 'verde' as TonoFicha },
    ...(equipo
      ? [
          { etiqueta: `${ESTADOS_HALLAZGO.propuesto} 🔒`, valor: numero(conteo('propuesto')), detalle: 'Candidatos con su cita, por validar', tono: 'ambar' as TonoFicha },
          { etiqueta: ESTADOS_HALLAZGO.descartado, valor: numero(conteo('descartado')), tono: 'neutro' as TonoFicha },
        ]
      : []),
  ]
  secciones.push({
    clave: 'hallazgos',
    etiqueta: 'Hallazgos',
    n: equipo ? [...hallazgos.values()].reduce((a, b) => a + b, 0) : conteo('validado'),
    bloques: [
      { tipo: 'cifras', cifras: cifrasHallazgos },
      { tipo: 'texto', texto: 'Los hallazgos se leen en el informe, cada uno en su punto del circuito. Sin cita textual no hay hallazgo.' },
    ],
  })

  if (equipo) {
    const n = turnos.count ?? 0
    const bloques: BloqueFicha[] = [
      { tipo: 'cifras', cifras: [{ etiqueta: 'Turnos', valor: numero(n), detalle: n ? 'La transcripción completa, con su buscador, en la página de la sesión' : 'Sin transcripción cargada' }] },
      { tipo: 'texto', texto: 'Perímetro «solo Boosty»: material de Iberia bajo NDA. El cliente no ve esta pestaña.', tono: 'morado' },
    ]
    if (n) bloques.push({ tipo: 'acciones', acciones: [{ href: `${BASE_LEV}/entrevistas/${id}#transcripcion`, etiqueta: 'Leer la transcripción', tono: 'principal' }] })
    secciones.push({ clave: 'transcripcion', etiqueta: 'Transcripción', candado: true, n, bloques })
  }

  return {
    tipo: 'entrevista',
    id,
    tipoEtiqueta: 'Sesión del levantamiento',
    titulo: nombreSesion(e),
    subtitulo: [e.entrevistado_cargo, e.areas?.nombre].filter(Boolean).join(' · ') || null,
    codigo: e.codigo,
    estado: { etiqueta: ESTADOS_ENTREVISTA[estado] ?? e.estado, tono: TONO_ESTADO_ENTREVISTA[estado] ?? 'neutro' },
    hrefModulo: `${BASE_LEV}/entrevistas`,
    datos,
    secciones,
    acciones: [
      { href: `${BASE_LEV}/entrevistas/${id}`, etiqueta: 'Abrir la sesión', tono: 'principal' },
      ...(puede(sesion, 'modulo:entrevistas', 'editar') ? [{ href: `${BASE_LEV}/entrevistas/${id}/editar`, etiqueta: 'Editar' }] : []),
    ],
    relaciones: [
      ...(e.areas ? [{ tipo: 'Área', titulo: e.areas.nombre }] : []),
      ...(archivos ?? []).map((a) => ({ tipo: 'Archivo', titulo: a.nombre, detalle: formatBytes(a.tamano_bytes), ficha: `archivo:${a.id}` })),
    ],
    linea: [],
    lineaVisible: true,
    documentos: [],
    aprobaciones: [],
    perimetro: false,
  }
}

// ── Archivo ──────────────────────────────────────────────────────────────────

async function fichaArchivo(sesion: Sesion, id: string): Promise<Ficha | null> {
  if (!puede(sesion, 'modulo:archivos')) return null
  const supabase = await createClient()
  const { data: a } = await supabase
    .from('archivos')
    .select('id, nombre, descripcion, mime_type, tamano_bytes, categoria, fase, confidencial, created_at, areas(nombre), entrevistas(id, codigo, titulo, entrevistado_nombre)')
    .eq('id', id)
    .maybeSingle()
  if (!a) return null
  const ent = a.entrevistas
  const datos: DatoFicha[] = [
    { etiqueta: 'Nombre', valor: a.nombre },
    { etiqueta: 'Descripción', valor: a.descripcion?.trim() || '—' },
    { etiqueta: 'Categoría', valor: CATEGORIAS_ARCHIVO[a.categoria as CategoriaArchivo] ?? a.categoria },
    { etiqueta: 'Área', valor: a.areas?.nombre ?? '—' },
    { etiqueta: 'Sesión', valor: ent ? `${ent.codigo} · ${nombreSesion(ent)}` : '—' },
    { etiqueta: 'Fase', valor: a.fase ? String(a.fase) : '—' },
    { etiqueta: 'Tamaño', valor: formatBytes(a.tamano_bytes) },
    { etiqueta: 'Tipo de archivo', valor: a.mime_type ?? '—', mono: true },
    { etiqueta: 'Subido', valor: fechaHora(a.created_at) },
    { etiqueta: 'Confidencial', valor: a.confidencial ? 'Sí · material bajo NDA' : 'No' },
  ]
  return {
    tipo: 'archivo',
    id,
    tipoEtiqueta: 'Archivo del expediente',
    titulo: a.nombre,
    subtitulo: [CATEGORIAS_ARCHIVO[a.categoria as CategoriaArchivo], a.areas?.nombre].filter(Boolean).join(' · ') || null,
    estado: a.confidencial ? { etiqueta: 'Confidencial', tono: 'ambar' } : null,
    hrefModulo: `${BASE_LEV}/archivos`,
    datos,
    acciones: [{ href: `${BASE_LEV}/archivos/${id}`, etiqueta: 'Ver el archivo', tono: 'principal' }],
    relaciones: ent && puede(sesion, 'modulo:entrevistas') ? [{ tipo: 'Sesión', titulo: `${ent.codigo} · ${nombreSesion(ent)}`, ficha: `entrevista:${ent.id}` }] : [],
    linea: [],
    lineaVisible: true,
    documentos: [],
    aprobaciones: [],
    perimetro: false,
  }
}

// ── Actividad del calendario ─────────────────────────────────────────────────

const CAMPOS_ACTIVIDAD = 'id, ref, titulo, detalle, frente, tipo, estado, inicio, fin, fecha_confirmada, responsable, participantes, nota, updated_at'

async function fichaActividad(sesion: Sesion, ref: string): Promise<Ficha | null> {
  if (!puede(sesion, 'modulo:calendario')) return null
  const supabase = await createClient()
  const { data: a } = await supabase.from('calendario_actividades').select(CAMPOS_ACTIVIDAD).eq('ref', ref).maybeSingle()
  if (!a) return null
  const editar = puede(sesion, 'modulo:calendario', 'editar')
  const estado = a.estado as EstadoActividad
  const campo = (accion: string, control: 'texto' | 'textoLargo' | 'opciones' | 'fecha', valor: string | null, extra?: { opciones?: { valor: string; etiqueta: string }[]; ayuda?: string }) =>
    editar ? { editar: { accion, control, valor: valor ?? '', ...extra } } : {}

  // El título, las fechas previstas y el responsable no se editan desde aquí: son
  // lo acordado con Iberia y con el señor Carlos, y se cambian en la base.
  const datos: DatoFicha[] = [
    { etiqueta: 'Frente', valor: FRENTE[a.frente as Frente]?.nombre ?? a.frente },
    { etiqueta: 'Tipo', valor: TIPOS_ACTIVIDAD[a.tipo as TipoActividad] ?? a.tipo },
    {
      etiqueta: 'Estado',
      valor: ESTADOS_ACTIVIDAD[estado]?.nombre ?? a.estado,
      ...campo('campo:estado', 'opciones', a.estado, { opciones: Object.entries(ESTADOS_ACTIVIDAD).map(([valor, x]) => ({ valor, etiqueta: x.nombre })) }),
    },
    { etiqueta: 'Fechas previstas', valor: rango(a) },
    { etiqueta: 'Fecha confirmada', valor: a.fecha_confirmada ? fechaCorta(a.fecha_confirmada) : 'Sin confirmar', ...campo('campo:fecha_confirmada', 'fecha', a.fecha_confirmada, { ayuda: 'Déjala vacía si todavía no se confirmó.' }) },
    { etiqueta: 'Responsable', valor: a.responsable || '—' },
    { etiqueta: 'Participantes', valor: a.participantes || '—' },
    { etiqueta: 'Detalle', valor: a.detalle || '—' },
    { etiqueta: 'Nota de coordinación', valor: a.nota || '—', ...campo('campo:nota', 'textoLargo', a.nota, { ayuda: 'Hasta 500 caracteres. No sale en el documento del calendario para Iberia.' }) },
    { etiqueta: 'Actualizada', valor: fechaHora(a.updated_at) },
  ]
  return {
    tipo: 'actividad',
    id: ref,
    tipoEtiqueta: 'Actividad del calendario',
    titulo: a.titulo,
    subtitulo: `${FRENTE[a.frente as Frente]?.nombre ?? a.frente} · ${rango(a)}`,
    codigo: a.id,
    estado: { etiqueta: ESTADOS_ACTIVIDAD[estado]?.nombre ?? a.estado, tono: TONO_ESTADO_ACTIVIDAD[estado] ?? 'neutro' },
    hrefModulo: '/sistema/programa/calendario',
    datos,
    relaciones: [],
    linea: [],
    lineaVisible: true,
    documentos: [],
    aprobaciones: [],
    perimetro: false,
  }
}

/**
 * Lo que se edita en la ficha de una actividad: estado, fecha confirmada y nota.
 * Pasa por la misma acción de la agenda (`actualizarActividad`), que vuelve a
 * pedir `modulo:calendario` · editar y valida igual: una sola regla.
 */
export const manejarActividad: ManejadorFicha = async (sesion, ref, accion, entrada): Promise<ResultadoAccionFicha> => {
  if (!puede(sesion, 'modulo:calendario', 'editar')) return { error: 'Tu rol no actualiza el calendario.' }
  if (!UUID.test(ref)) return { error: 'No se encontró la actividad.' }
  const supabase = await createClient()
  const { data: a } = await supabase.from('calendario_actividades').select('id, estado, fecha_confirmada, nota').eq('ref', ref).maybeSingle()
  if (!a) return { error: 'No se encontró la actividad.' }
  const fd = new FormData()
  fd.set('id', a.id)
  fd.set('estado', accion === 'campo:estado' ? (entrada.valor ?? '') : a.estado)
  fd.set('fecha_confirmada', accion === 'campo:fecha_confirmada' ? (entrada.valor ?? '') : (a.fecha_confirmada ?? ''))
  fd.set('nota', accion === 'campo:nota' ? (entrada.valor ?? '') : (a.nota ?? ''))
  if (!['campo:estado', 'campo:fecha_confirmada', 'campo:nota'].includes(accion)) return { error: 'Ese campo no se edita desde aquí.' }
  const r = await actualizarActividad({}, fd)
  return r.error ? { error: r.error } : { ok: 'Guardado.', ficha: `actividad:${ref}` }
}
