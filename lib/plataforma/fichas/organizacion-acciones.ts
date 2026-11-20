import 'server-only'
import { puede } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { mensajeDeError } from '@/components/sistema/organizacion/datos'
import type { ResultadoAccionFicha, TipoFicha } from '@/lib/plataforma/ficha-tipos'
import { fechaLarga, hoyCaracas } from '@/lib/plataforma/formato'
import type { EntradaAccionFicha, ManejadorFicha } from '@/lib/plataforma/fichas/acciones'

/**
 * Lo que se guarda desde las fichas y las tablas de Organización. **Nada se
 * corrige en el sitio**: cada cambio de estructura va por la función de la base
 * (`org.editar_unidad`, `org.editar_plaza`, `org.fijar_costo_referencia`…),
 * que cierra la versión que rige y abre otra desde la fecha, y rechaza la fecha
 * retroactiva. El catálogo de cargos se edita directo con auditoría (Anexo D
 * §4). Cada acción vuelve a pedir su permiso: no confía en que el botón
 * estuviera escondido.
 */

type Cliente = Awaited<ReturnType<typeof createClient>>
const vigente = (d: string) => `[${d},${d}]`
const desde = (f: string) => (f === hoyCaracas() ? 'desde hoy' : `desde el ${fechaLarga(f)}`)
const nulo = (s: string | null | undefined) => (s === undefined || s === null || s.trim() === '' ? null : s.trim())
const sinPermiso = (que: string): ResultadoAccionFicha => ({ error: `Tu rol no puede ${que}.` })

/** «1.234,5» o «1234.5» → 1234.5. */
export function aNumero(v: string | undefined): number | null {
  let s = (v ?? '').replace(/\s/g, '').replace(/^(Bs|USD)/i, '')
  if (!s) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// -----------------------------------------------------------------------------
// Estructura: unidad y plaza (versionadas, con fecha)
// -----------------------------------------------------------------------------

type CambiosUnidad = Partial<{ nombre: string; tipo: string; padre_ref: string | null; sede: string | null; codigo: string | null; certeza: string }>

export async function editarUnidad(supabase: Cliente, ref: string, fecha: string, c: CambiosUnidad): Promise<ResultadoAccionFicha> {
  const org = supabase.schema('org')
  const { data: u } = await org
    .from('unidad')
    .select('nombre, tipo, padre_ref, sede, codigo_organigrama, certeza, nota')
    .eq('ref', ref)
    .is('escenario_id', null)
    .filter('vigencia', 'cs', vigente(fecha))
    .maybeSingle()
  if (!u) return { error: `La unidad no está vigente el ${fechaLarga(fecha)}.` }
  const { error } = await org.rpc('editar_unidad', {
    p_ref: ref,
    p_fecha: fecha,
    p_nombre: c.nombre ?? u.nombre,
    p_tipo: c.tipo ?? u.tipo,
    p_padre_ref: ('padre_ref' in c ? c.padre_ref : u.padre_ref) as string,
    p_sede: ('sede' in c ? c.sede : u.sede) ?? '',
    p_codigo: ('codigo' in c ? c.codigo : u.codigo_organigrama) ?? '',
    p_certeza: c.certeza ?? '',
    p_nota: '',
  })
  if (error) return { error: mensajeDeError(error) }
  return { ok: `Guardado: la versión nueva rige ${desde(fecha)}. La anterior quedó en el historial.` }
}

type CambiosPlaza = Partial<{ dotacion: number; reporta_a_ref: string | null; estado: string; tipo_nomina: string | null; sede: string | null; unidad_ref: string; certeza: string }>

export async function editarPlaza(supabase: Cliente, ref: string, fecha: string, c: CambiosPlaza): Promise<ResultadoAccionFicha> {
  const org = supabase.schema('org')
  const { data: p } = await org
    .from('plaza')
    .select('dotacion, reporta_a_ref, estado, tipo_nomina, sede, unidad_ref, certeza')
    .eq('ref', ref)
    .is('escenario_id', null)
    .filter('vigencia', 'cs', vigente(fecha))
    .maybeSingle()
  if (!p) return { error: `La plaza no está vigente el ${fechaLarga(fecha)}.` }
  const { data, error } = await org.rpc('editar_plaza', {
    p_ref: ref,
    p_fecha: fecha,
    p_dotacion: c.dotacion ?? p.dotacion,
    p_reporta_a_ref: ('reporta_a_ref' in c ? c.reporta_a_ref : p.reporta_a_ref) as string,
    p_estado: c.estado ?? p.estado,
    p_tipo_nomina: ('tipo_nomina' in c ? c.tipo_nomina : p.tipo_nomina) ?? '',
    p_sede: ('sede' in c ? c.sede : p.sede) ?? '',
    p_unidad_ref: c.unidad_ref ?? p.unidad_ref,
    p_certeza: c.certeza ?? '',
    p_nota: '',
  })
  if (error) return { error: mensajeDeError(error) }
  const r = (data ?? {}) as { titulares?: number; dotacion?: number; por_encima?: number }
  return {
    ok: `Guardado: la versión nueva rige ${desde(fecha)}.`,
    aviso: r.por_encima ? `Tiene ${r.titulares} titular(es) para una dotación de ${r.dotacion}: ${r.por_encima} queda(n) por encima.` : undefined,
  }
}

/** La dotación de una plaza dentro de un escenario en borrador (la realidad no se toca). */
export async function dotacionEnEscenario(supabase: Cliente, esc: string, ref: string, dotacion: number): Promise<ResultadoAccionFicha> {
  const org = supabase.schema('org')
  const { data: e } = await org.from('escenario').select('estado, alcance').eq('id', esc).maybeSingle()
  if (!e || e.alcance !== 'estructura') return { error: 'Ese escenario no existe o no es de estructura.' }
  if (e.estado !== 'borrador') return { error: 'El escenario ya no está en borrador: no se edita.' }
  const { data, error } = await org.from('plaza').update({ dotacion }).eq('escenario_id', esc).eq('ref', ref).select('id')
  if (error) return { error: mensajeDeError(error) }
  if (!data?.length) return { error: 'Esa plaza no está en el escenario.' }
  return { ok: `Dotación en ${dotacion} dentro del escenario.` }
}

export async function terminarOcupacion(supabase: Cliente, id: string, fecha: string, motivo?: string): Promise<ResultadoAccionFicha> {
  const { error } = await supabase.schema('org').rpc('terminar_ocupacion', { p_id: id, p_fecha: fecha, p_motivo: motivo ?? '' })
  if (error) return { error: mensajeDeError(error) }
  return { ok: `La ocupación termina ${desde(fecha)}.` }
}

// -----------------------------------------------------------------------------
// Cargos: catálogo directo, con auditoría
// -----------------------------------------------------------------------------

export async function editarCargo(supabase: Cliente, id: string, campo: string, valor: string): Promise<ResultadoAccionFicha> {
  const org = supabase.schema('org')
  const v = valor.trim()
  let cambio: { nombre?: string; familia?: string | null; nivel?: number | null; sinonimos?: string[]; proposito?: string | null; activo?: boolean }
  switch (campo) {
    case 'nombre': {
      if (v.length < 3) return { error: 'El nombre del cargo necesita al menos tres letras.' }
      const { data: iguales } = await org.from('cargo').select('id').ilike('nombre', v).neq('id', id)
      if (iguales?.length) return { error: 'Ya hay otro cargo con ese nombre. Si es el mismo cargo con otro nombre, agrégalo como sinónimo.' }
      cambio = { nombre: v }
      break
    }
    case 'familia':
      cambio = { familia: nulo(v) }
      break
    case 'nivel': {
      if (!v) {
        cambio = { nivel: null }
        break
      }
      const n = Number.parseInt(v, 10)
      if (!Number.isInteger(n) || n < 0 || n > 30) return { error: 'El nivel es un número entero de 0 a 30.' }
      cambio = { nivel: n }
      break
    }
    case 'sinonimos':
      cambio = { sinonimos: [...new Set(v.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean))] }
      break
    case 'proposito':
      cambio = { proposito: nulo(v) }
      break
    case 'activo':
      if (!['activo', 'inactivo'].includes(v)) return { error: 'Elige activo o inactivo.' }
      cambio = { activo: v === 'activo' }
      break
    default:
      return { error: 'Ese campo del cargo no se edita.' }
  }
  const { data, error } = await org.from('cargo').update(cambio).eq('id', id).select('id')
  if (error) return { error: mensajeDeError(error) }
  if (!data?.length) return { error: 'La base no dejó guardar: revisa tu permiso.' }
  return { ok: 'Guardado. El cambio queda en la auditoría.' }
}

// -----------------------------------------------------------------------------
// Costos · perímetro de nómina
// -----------------------------------------------------------------------------

export async function fijarCostoCargo(supabase: Cliente, cargo: string, fecha: string, c: Partial<{ salario: number; moneda: string; bonos: number }>): Promise<ResultadoAccionFicha> {
  const org = supabase.schema('org')
  const { data: r } = await org.from('costo_referencia').select('salario_mensual, moneda, bonos_usd_mensual, fuente').eq('cargo_id', cargo).filter('vigencia', 'cs', vigente(fecha)).maybeSingle()
  const salario = c.salario ?? r?.salario_mensual ?? null
  if (salario === null) return { error: 'Primero escribe el salario de referencia del cargo.' }
  if (salario < 0 || (c.bonos ?? 0) < 0) return { error: 'Los montos no pueden ser negativos.' }
  const { error } = await org.rpc('fijar_costo_referencia', {
    p_cargo: cargo,
    p_salario: salario,
    p_moneda: c.moneda ?? r?.moneda ?? 'VES',
    p_bonos_usd: c.bonos ?? r?.bonos_usd_mensual ?? 0,
    p_fecha: fecha,
    p_fuente: 'Edición en la plataforma',
  })
  if (error) return { error: mensajeDeError(error) }
  return { ok: `Costo de referencia guardado; rige ${desde(fecha)}.` }
}

export async function editarComponente(supabase: Cliente, id: string, fecha: string, c: Partial<{ valor: number; base_legal: string; por_confirmar: boolean }>): Promise<ResultadoAccionFicha> {
  const org = supabase.schema('org')
  const { data: x } = await org.from('componente_costo').select('*').eq('id', id).maybeSingle()
  if (!x) return { error: 'Ese componente no existe.' }
  const { error } = await org.rpc('editar_componente_costo', {
    p_id: id,
    p_fecha: fecha,
    p_forma: x.forma,
    p_valor: c.valor ?? Number(x.valor),
    p_base: x.base,
    p_tope: x.tope_salarios_minimos as number,
    p_piso: x.piso_parametro ?? '',
    p_moneda: x.moneda ?? '',
    p_aplica_a: x.aplica_a,
    p_base_legal: c.base_legal ?? x.base_legal ?? '',
    p_fuente: x.fuente ?? '',
    p_por_confirmar: c.por_confirmar ?? x.por_confirmar,
    p_nota: x.nota ?? '',
  })
  if (error) return { error: mensajeDeError(error) }
  return { ok: `Guardado: la versión nueva del componente rige ${desde(fecha)}.` }
}

// -----------------------------------------------------------------------------
// Aprobaciones (la misma `flujo.decidir` de la bandeja)
// -----------------------------------------------------------------------------

async function decidir(supabase: Cliente, e: EntradaAccionFicha, requisicion?: string): Promise<ResultadoAccionFicha> {
  const [decision, paso] = (e.param ?? '').split(':')
  if (!paso || !['aprobado', 'rechazado', 'devuelto'].includes(decision)) return { error: 'Decisión no válida.' }
  const comentario = (e.motivo ?? '').trim()
  if (decision !== 'aprobado' && comentario.length < 3) return { error: 'Para devolver o rechazar, escribe el motivo: quien lo pidió lo va a leer.' }
  if (requisicion && decision === 'aprobado') {
    const { data: p } = await supabase.schema('flujo').from('paso').select('accion').eq('id', paso).maybeSingle()
    if (p?.accion === 'completar') {
      if (comentario.length < 3) return { error: 'Escribe el nombre del candidato.' }
      if (!e.fecha) return { error: 'Falta la fecha de ingreso.' }
      const { error } = await supabase.schema('org').rpc('registrar_candidato', { p_req: requisicion, p_candidato: comentario, p_fecha: e.fecha })
      if (error) return { error: mensajeDeError(error) }
    }
  }
  const { data, error } = await supabase
    .schema('flujo')
    .rpc('decidir', { p_paso: paso, p_decision: decision, p_comentario: decision === 'aprobado' && requisicion ? undefined : comentario || undefined })
  if (error) return { error: mensajeDeError(error) }
  return {
    ok:
      decision === 'aprobado'
        ? data === 'aprobada'
          ? 'Aprobado. Era el último paso: quedó aprobada.'
          : 'Aprobado. Pasó al siguiente paso.'
        : decision === 'devuelto'
          ? 'Devuelto a quien lo pidió, con tu comentario.'
          : 'Rechazado. Quien lo pidió verá tu motivo.',
  }
}

// -----------------------------------------------------------------------------
// Los manejadores por tipo
// -----------------------------------------------------------------------------

const unidad: ManejadorFicha = async (sesion, ref, accion, e) => {
  const supabase = await createClient()
  const fecha = e.fecha ?? hoyCaracas()
  if (!puede(sesion, 'sistema:estructura', 'editar')) return sinPermiso('editar la estructura')
  const v = e.valor ?? ''
  switch (accion) {
    case 'unidad.nombre':
      return editarUnidad(supabase, ref, fecha, { nombre: v })
    case 'unidad.tipo':
      return editarUnidad(supabase, ref, fecha, { tipo: v })
    case 'unidad.padre':
      return editarUnidad(supabase, ref, fecha, { padre_ref: nulo(v) })
    case 'unidad.sede':
      return editarUnidad(supabase, ref, fecha, { sede: nulo(v) })
    case 'unidad.codigo':
      return editarUnidad(supabase, ref, fecha, { codigo: nulo(v) })
    case 'unidad.confirmar':
      return editarUnidad(supabase, ref, fecha, { certeza: 'hecho' })
    case 'unidad.cerrar': {
      const { error } = await supabase.schema('org').rpc('cerrar_unidad', { p_ref: ref, p_fecha: fecha, p_motivo: e.motivo ?? '' })
      if (error) return { error: mensajeDeError(error) }
      return { ok: `La unidad deja de regir ${desde(fecha)}. Sigue en el historial.` }
    }
  }
  return { error: 'Acción no válida.' }
}

const plaza: ManejadorFicha = async (sesion, ref, accion, e) => {
  const supabase = await createClient()
  const fecha = e.fecha ?? hoyCaracas()
  if (!puede(sesion, 'sistema:estructura', 'editar')) return sinPermiso('editar la estructura')
  const v = e.valor ?? ''
  switch (accion) {
    case 'plaza.dotacion': {
      const n = Number.parseInt(v, 10)
      if (!Number.isInteger(n) || n < 1 || n > 999) return { error: 'La dotación es un número entero de 1 en adelante. Para quitar la plaza, ciérrala.' }
      return editarPlaza(supabase, ref, fecha, { dotacion: n })
    }
    case 'plaza.estado':
      return editarPlaza(supabase, ref, fecha, { estado: v })
    case 'plaza.nomina':
      return editarPlaza(supabase, ref, fecha, { tipo_nomina: nulo(v) })
    case 'plaza.sede':
      return editarPlaza(supabase, ref, fecha, { sede: nulo(v) })
    case 'plaza.reporta':
      return editarPlaza(supabase, ref, fecha, { reporta_a_ref: nulo(v) })
    case 'plaza.unidad':
      if (!v) return { error: 'Elige la unidad.' }
      return editarPlaza(supabase, ref, fecha, { unidad_ref: v })
    case 'plaza.confirmar':
      return editarPlaza(supabase, ref, fecha, { certeza: 'hecho' })
    case 'plaza.cerrar': {
      const { error } = await supabase.schema('org').rpc('cerrar_plaza', { p_ref: ref, p_fecha: fecha, p_motivo: e.motivo ?? '' })
      if (error) return { error: mensajeDeError(error) }
      return { ok: `La plaza deja de regir ${desde(fecha)}.` }
    }
    case 'ocupacion.terminar':
      if (!e.param) return { error: 'Falta la ocupación.' }
      return terminarOcupacion(supabase, e.param, fecha, e.motivo)
  }
  return { error: 'Acción no válida.' }
}

const cargo: ManejadorFicha = async (sesion, id, accion, e) => {
  const supabase = await createClient()
  const fecha = e.fecha ?? hoyCaracas()
  const v = e.valor ?? ''
  if (accion.startsWith('cargo.') && ['cargo.salario', 'cargo.moneda', 'cargo.bonos'].includes(accion)) {
    if (!puede(sesion, 'sistema:costos', 'editar')) return sinPermiso('editar costos')
    if (accion === 'cargo.moneda') return fijarCostoCargo(supabase, id, fecha, { moneda: v === 'USD' ? 'USD' : 'VES' })
    const n = aNumero(v)
    if (n === null) return { error: 'Escribe un monto (por ejemplo, 1.250,00).' }
    return fijarCostoCargo(supabase, id, fecha, accion === 'cargo.salario' ? { salario: n } : { bonos: n })
  }
  if (!puede(sesion, 'sistema:estructura', 'editar')) return sinPermiso('editar el catálogo de cargos')
  const campo = accion.replace(/^cargo\./, '')
  return editarCargo(supabase, id, campo, v)
}

const persona: ManejadorFicha = async (sesion, id, accion, e) => {
  const supabase = await createClient()
  const fecha = e.fecha ?? hoyCaracas()
  if (!puede(sesion, 'sistema:estructura', 'editar')) return sinPermiso('mover personas entre plazas')
  if (accion === 'ocupacion.terminar') {
    if (!e.param) return { error: 'Falta la ocupación.' }
    // La ocupación tiene que ser de esta persona.
    const { data } = await supabase.schema('org').from('ocupacion').select('id').eq('id', e.param).eq('empleado_id', id).maybeSingle()
    if (!data) return { error: 'Esa ocupación no es de esta persona.' }
    return terminarOcupacion(supabase, e.param, fecha, e.motivo)
  }
  if (accion === 'persona.mover') {
    const destino = nulo(e.valor)
    if (!destino) return { error: 'Elige la plaza de destino.' }
    const hoy = hoyCaracas()
    const { data: o } = await supabase
      .schema('org')
      .from('ocupacion')
      .select('id, tipo')
      .eq('empleado_id', id)
      .filter('vigencia', 'cs', vigente(fecha < hoy ? hoy : fecha))
      .order('tipo')
      .range(0, 9)
    const actual = (o ?? []).find((x) => x.tipo === 'titular') ?? o?.[0]
    if (!actual) return { error: 'La persona no ocupa ninguna plaza en esa fecha.' }
    const { error } = await supabase.schema('org').rpc('mover_ocupacion', { p_id: actual.id, p_plaza_destino: destino, p_fecha: fecha, p_tipo: '', p_excede: false, p_motivo: '' })
    if (error) return { error: mensajeDeError(error) }
    return { ok: `Movimiento registrado ${desde(fecha)}.` }
  }
  return { error: 'Acción no válida.' }
}

const requisicion: ManejadorFicha = async (sesion, id, accion, e) => {
  const supabase = await createClient()
  const org = supabase.schema('org')
  switch (accion) {
    case 'decidir':
      return decidir(supabase, e, id)
    case 'req.enviar': {
      if (!puede(sesion, 'sistema:requisiciones', 'crear')) return sinPermiso('enviar requisiciones')
      const { error } = await org.rpc('enviar_requisicion', { p_req: id })
      if (error) return { error: mensajeDeError(error) }
      return { ok: 'Enviada. El impacto quedó congelado y arrancó la ruta de aprobación.' }
    }
    case 'req.cancelar': {
      const { error } = await org.rpc('cancelar_requisicion', { p_req: id, p_motivo: e.motivo || undefined })
      if (error) return { error: mensajeDeError(error) }
      return { ok: 'Requisición cancelada.' }
    }
    case 'req.salario':
    case 'req.moneda':
    case 'req.bonos':
    case 'req.nota': {
      if (!puede(sesion, 'sistema:costos', 'editar')) return sinPermiso('editar la propuesta salarial')
      const { data: actual } = await org.from('requisicion_costo').select('salario_propuesto, moneda, bonos_usd, nota').eq('requisicion_id', id).maybeSingle()
      const fila = { salario_propuesto: actual?.salario_propuesto ?? null, moneda: actual?.moneda ?? 'VES', bonos_usd: actual?.bonos_usd ?? null, nota: actual?.nota ?? null }
      const v = e.valor ?? ''
      if (accion === 'req.moneda') fila.moneda = v === 'USD' ? 'USD' : 'VES'
      else if (accion === 'req.nota') fila.nota = nulo(v)
      else {
        const n = v.trim() === '' ? null : aNumero(v)
        if (v.trim() !== '' && (n === null || n < 0)) return { error: 'Escribe un monto positivo (por ejemplo, 1.250,00).' }
        if (accion === 'req.salario') fila.salario_propuesto = n
        else fila.bonos_usd = n
      }
      const { error } = await org.from('requisicion_costo').upsert({ requisicion_id: id, ...fila }, { onConflict: 'requisicion_id' })
      if (error) return { error: mensajeDeError(error) }
      return { ok: 'Propuesta salarial guardada.' }
    }
  }
  return { error: 'Acción no válida.' }
}

const escenario: ManejadorFicha = async (sesion, id, accion, e) => {
  const supabase = await createClient()
  const org = supabase.schema('org')
  switch (accion) {
    case 'decidir':
      return decidir(supabase, e)
    case 'esc.nombre':
    case 'esc.descripcion': {
      if (!puede(sesion, 'sistema:escenarios', 'editar')) return sinPermiso('editar escenarios')
      const v = (e.valor ?? '').trim()
      if (accion === 'esc.nombre' && v.length < 3) return { error: 'El nombre necesita al menos tres letras.' }
      const cambio = accion === 'esc.nombre' ? { nombre: v } : { descripcion: nulo(v) }
      const { data, error } = await org.from('escenario').update(cambio).eq('id', id).eq('estado', 'borrador').select('id')
      if (error) return { error: mensajeDeError(error) }
      if (!data?.length) return { error: 'Solo se edita un escenario en borrador.' }
      return { ok: 'Guardado.' }
    }
    case 'esc.enviar': {
      if (!puede(sesion, 'sistema:escenarios', 'editar')) return sinPermiso('enviar escenarios')
      const fecha = e.fecha ?? hoyCaracas()
      if (fecha < hoyCaracas()) return { error: 'No se permite una vigencia retroactiva: elige hoy o una fecha futura.' }
      const { error } = await org.rpc('enviar_escenario', { p_esc: id, p_vigente_desde: fecha })
      if (error) return { error: mensajeDeError(error) }
      return { ok: `Enviado a aprobación. Al firmar el último paso se publica solo, y rige ${desde(fecha)}.` }
    }
    case 'esc.descartar': {
      if (!puede(sesion, 'sistema:escenarios', 'eliminar')) return sinPermiso('descartar escenarios')
      const { data, error } = await org.from('escenario').update({ estado: 'descartado' }).eq('id', id).eq('estado', 'borrador').select('id')
      if (error) return { error: mensajeDeError(error) }
      if (!data?.length) return { error: 'Solo se descarta un escenario en borrador.' }
      return { ok: 'Escenario descartado. Queda como registro.' }
    }
  }
  return { error: 'Acción no válida.' }
}

const conciliacion: ManejadorFicha = async (_sesion, id, accion, e) => {
  // El permiso lo decide `control.resolver_conciliacion` según el módulo del punto.
  const supabase = await createClient()
  const estado = accion === 'conc.resolver' ? 'resuelto' : accion === 'conc.descartar' ? 'descartado' : accion === 'conc.reabrir' ? 'abierto' : null
  if (!estado) return { error: 'Acción no válida.' }
  const { error } = await supabase.schema('control').rpc('resolver_conciliacion', { p_id: id, p_estado: estado, p_resolucion: e.motivo ?? '' })
  if (error) return { error: mensajeDeError(error) }
  return { ok: estado === 'resuelto' ? 'Resuelto. Sale de la cola.' : estado === 'descartado' ? 'Descartado, con su motivo.' : 'Reabierto: vuelve a la cola.' }
}

export const ACCIONES_ORGANIZACION: Partial<Record<TipoFicha, ManejadorFicha>> = {
  unidad,
  plaza,
  cargo,
  persona,
  requisicion,
  escenario,
  conciliacion,
}
