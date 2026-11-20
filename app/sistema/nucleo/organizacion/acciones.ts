'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { puede, requerirPermiso, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hoyCaracas, mensajeDeError, VIGENTE_EN, fmtFecha } from '@/components/sistema/organizacion/datos'
import type { Estado, PersonaEncontrada } from '@/components/sistema/organizacion/formulario'

/**
 * Las acciones de la estructura. Ninguna escribe en las tablas directamente:
 * llaman a las funciones de la base (`org.editar_unidad`, `org.asignar_ocupacion`…),
 * que cierran la versión vigente y abren la nueva con su fecha, y que rechazan
 * la fecha retroactiva. Cada acción pide el permiso otra vez: no confía en que
 * el botón estuviera escondido.
 */

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}
const nulo = (s: string) => (s === '' ? null : s)
function entero(fd: FormData, campo: string): number | null {
  const n = Number.parseInt(texto(fd, campo), 10)
  return Number.isFinite(n) ? n : null
}

/** «Gerencia de Planta» → `gerencia-de-planta`. */
function claveDe(nombre: string): string {
  return (
    nombre
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'sin-nombre'
  )
}

function refrescar(ref?: string) {
  revalidatePath('/sistema/nucleo/organizacion', 'layout')
  if (ref) revalidatePath(`/sistema/nucleo/organizacion/unidades/${ref}`)
}

const desde = (fecha: string) => (fecha === hoyCaracas() ? 'desde hoy' : `desde el ${fmtFecha(fecha)}`)

// -----------------------------------------------------------------------------
// Unidades
// -----------------------------------------------------------------------------

export async function crearUnidad(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'crear')
  const supabase = await createClient()
  const nombre = texto(fd, 'nombre')
  const fecha = texto(fd, 'fecha')
  const { data, error } = await supabase.schema('org').rpc('crear_unidad', {
    p_clave: claveDe(nombre),
    p_nombre: nombre,
    p_tipo: texto(fd, 'tipo'),
    p_padre_ref: nulo(texto(fd, 'padre_ref')) as string,
    p_sede: texto(fd, 'sede'),
    p_fecha: fecha,
    p_codigo: texto(fd, 'codigo'),
  })
  if (error) return { error: mensajeDeError(error) }
  refrescar(texto(fd, 'padre_ref') || undefined)
  redirect(`/sistema/nucleo/organizacion/unidades/${data}?creada=1`)
}

export async function editarUnidad(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const ref = texto(fd, 'ref')
  const fecha = texto(fd, 'fecha')
  const { error } = await supabase.schema('org').rpc('editar_unidad', {
    p_ref: ref,
    p_fecha: fecha,
    p_nombre: texto(fd, 'nombre'),
    p_tipo: texto(fd, 'tipo'),
    p_padre_ref: nulo(texto(fd, 'padre_ref')) as string,
    p_sede: texto(fd, 'sede'),
    p_codigo: texto(fd, 'codigo'),
    p_certeza: fd.get('confirmar') === 'on' ? 'hecho' : '',
    p_nota: texto(fd, 'nota'),
  })
  if (error) return { error: mensajeDeError(error) }
  refrescar(ref)
  return { ok: `Guardado: la versión nueva rige ${desde(fecha)}. La anterior quedó cerrada en el historial.` }
}

export async function cerrarUnidad(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const ref = texto(fd, 'ref')
  const fecha = texto(fd, 'fecha')
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla para confirmar el cierre.' }
  const { error } = await supabase.schema('org').rpc('cerrar_unidad', { p_ref: ref, p_fecha: fecha, p_motivo: texto(fd, 'motivo') })
  if (error) return { error: mensajeDeError(error) }
  refrescar(ref)
  return { ok: `La unidad deja de regir ${desde(fecha)}. Sigue en el historial y en la estructura a fechas anteriores.` }
}

// -----------------------------------------------------------------------------
// Plazas
// -----------------------------------------------------------------------------

export async function crearPlaza(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'crear')
  const supabase = await createClient()
  const unidad = texto(fd, 'unidad_ref')
  const fecha = texto(fd, 'fecha')
  if (!texto(fd, 'cargo_id')) return { error: 'Elige el cargo de la plaza.' }
  const { error } = await supabase.schema('org').rpc('crear_plaza', {
    p_unidad_ref: unidad,
    p_cargo_id: texto(fd, 'cargo_id'),
    p_dotacion: entero(fd, 'dotacion') ?? 1,
    p_reporta_a_ref: nulo(texto(fd, 'reporta_a_ref')) as string,
    p_tipo_nomina: texto(fd, 'tipo_nomina'),
    p_sede: texto(fd, 'sede'),
    p_estado: texto(fd, 'estado') || 'aprobada',
    p_fecha: fecha,
    p_nota: texto(fd, 'nota'),
  })
  if (error) return { error: mensajeDeError(error) }
  refrescar(unidad)
  return { ok: `Plaza creada; rige ${desde(fecha)}.` }
}

export async function editarPlaza(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const unidad = texto(fd, 'unidad_actual')
  const fecha = texto(fd, 'fecha')
  const { data, error } = await supabase.schema('org').rpc('editar_plaza', {
    p_ref: texto(fd, 'ref'),
    p_fecha: fecha,
    p_dotacion: entero(fd, 'dotacion') ?? 0,
    p_reporta_a_ref: nulo(texto(fd, 'reporta_a_ref')) as string,
    p_estado: texto(fd, 'estado'),
    p_tipo_nomina: texto(fd, 'tipo_nomina'),
    p_sede: texto(fd, 'sede'),
    p_unidad_ref: nulo(texto(fd, 'unidad_ref')) as string,
    p_certeza: fd.get('confirmar') === 'on' ? 'hecho' : '',
    p_nota: texto(fd, 'nota'),
  })
  if (error) return { error: mensajeDeError(error) }
  refrescar(unidad)
  const r = (data ?? {}) as { titulares?: number; dotacion?: number; por_encima?: number }
  return {
    ok: `Guardado: la versión nueva rige ${desde(fecha)}.`,
    aviso: r.por_encima
      ? `La plaza tiene ${r.titulares} titular(es) para una dotación de ${r.dotacion}: ${r.por_encima} queda(n) por encima de la dotación.`
      : undefined,
  }
}

export async function cerrarPlaza(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla para confirmar el cierre.' }
  const { error } = await supabase.schema('org').rpc('cerrar_plaza', { p_ref: texto(fd, 'ref'), p_fecha: fecha, p_motivo: texto(fd, 'motivo') })
  if (error) return { error: mensajeDeError(error) }
  refrescar(texto(fd, 'unidad_actual'))
  return { ok: `La plaza deja de regir ${desde(fecha)}.` }
}

// -----------------------------------------------------------------------------
// Ocupaciones
// -----------------------------------------------------------------------------

export async function asignarOcupacion(_a: Estado, fd: FormData): Promise<Estado> {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'sistema:estructura', 'crear') && !puede(sesion, 'sistema:estructura', 'editar')) {
    return { error: 'Tu rol no puede asignar personas a plazas.' }
  }
  const empleado = texto(fd, 'empleado_id')
  if (!empleado) return { error: 'Busca y elige a la persona.' }
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  const { error } = await supabase.schema('org').rpc('asignar_ocupacion', {
    p_plaza_ref: texto(fd, 'plaza_ref'),
    p_empleado_id: empleado,
    p_tipo: texto(fd, 'tipo') || 'titular',
    p_fecha: fecha,
    p_excede: fd.get('excede') === 'on',
    p_motivo: texto(fd, 'motivo'),
  })
  if (error) return { error: mensajeDeError(error) }
  refrescar(texto(fd, 'unidad_actual'))
  return { ok: `Asignada ${desde(fecha)}.` }
}

export async function moverOcupacion(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  if (!texto(fd, 'plaza_destino')) return { error: 'Elige la plaza de destino.' }
  const { error } = await supabase.schema('org').rpc('mover_ocupacion', {
    p_id: texto(fd, 'id'),
    p_plaza_destino: texto(fd, 'plaza_destino'),
    p_fecha: fecha,
    p_tipo: texto(fd, 'tipo'),
    p_excede: fd.get('excede') === 'on',
    p_motivo: texto(fd, 'motivo'),
  })
  if (error) return { error: mensajeDeError(error) }
  refrescar(texto(fd, 'unidad_actual'))
  return { ok: `Movimiento registrado ${desde(fecha)}.` }
}

export async function terminarOcupacion(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const fecha = texto(fd, 'fecha')
  const { error } = await supabase.schema('org').rpc('terminar_ocupacion', {
    p_id: texto(fd, 'id'),
    p_fecha: fecha,
    p_motivo: texto(fd, 'motivo'),
  })
  if (error) return { error: mensajeDeError(error) }
  refrescar(texto(fd, 'unidad_actual'))
  return { ok: `La ocupación termina ${desde(fecha)}.` }
}

/**
 * Busca en el padrón activo por nombre o ficha, sin distinguir tildes. Devuelve
 * nombre, ficha, el cargo del padrón y la plaza que ocupa hoy: nada de contacto.
 */
export async function buscarEmpleados(q: string): Promise<PersonaEncontrada[]> {
  const sesion = await requerirSesion()
  if (!puede(sesion, 'sistema:estructura', 'crear') && !puede(sesion, 'sistema:estructura', 'editar')) return []
  const supabase = await createClient()
  const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const partes = plano(q).split(/\s+/).filter(Boolean)
  if (!partes.length) return []

  const filas: { id: string; nombre_completo: string; ficha: string | null; cargo: string | null }[] = []
  for (let desdeFila = 0; ; desdeFila += 1000) {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, ficha, cargo')
      .eq('activo', true)
      .range(desdeFila, desdeFila + 999)
    filas.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const hallados = filas
    .filter((e) => {
      const texto = plano(`${e.nombre_completo} ${e.ficha ?? ''}`)
      return partes.every((p) => texto.includes(p))
    })
    .slice(0, 20)
  if (!hallados.length) return []

  const hoy = hoyCaracas()
  const org = supabase.schema('org')
  const { data: ocup } = await org
    .from('ocupacion')
    .select('empleado_id, plaza_ref')
    .in('empleado_id', hallados.map((h) => h.id))
    .filter('vigencia', 'cs', VIGENTE_EN(hoy))
  const refs = [...new Set((ocup ?? []).map((o) => o.plaza_ref))]
  const { data: plazas } = refs.length
    ? await org.from('plaza').select('ref, unidad_ref, cargo:cargo_id(nombre)').in('ref', refs).is('escenario_id', null).filter('vigencia', 'cs', VIGENTE_EN(hoy))
    : { data: [] }
  const urefs = [...new Set((plazas ?? []).map((p) => p.unidad_ref))]
  const { data: unidades } = urefs.length
    ? await org.from('unidad').select('ref, nombre').in('ref', urefs).is('escenario_id', null).filter('vigencia', 'cs', VIGENTE_EN(hoy))
    : { data: [] }
  const nombreUnidad = new Map((unidades ?? []).map((u) => [u.ref, u.nombre]))
  const plazaDe = new Map(
    (plazas ?? []).map((p) => [p.ref, `${(p.cargo as unknown as { nombre: string } | null)?.nombre ?? 'Plaza'} · ${nombreUnidad.get(p.unidad_ref) ?? ''}`]),
  )
  const plazaDeEmpleado = new Map<string, string>()
  for (const o of ocup ?? []) {
    const d = plazaDe.get(o.plaza_ref)
    if (d) plazaDeEmpleado.set(o.empleado_id, plazaDeEmpleado.has(o.empleado_id) ? `${plazaDeEmpleado.get(o.empleado_id)}; ${d}` : d)
  }

  return hallados.map((e) => ({
    id: e.id,
    nombre: e.nombre_completo,
    ficha: e.ficha,
    cargo: e.cargo,
    plaza: plazaDeEmpleado.get(e.id) ?? null,
  }))
}

// -----------------------------------------------------------------------------
// Cargos: catálogo directo, con auditoría (Anexo D §4)
// -----------------------------------------------------------------------------

function sinonimosDe(fd: FormData): string[] {
  return [...new Set(texto(fd, 'sinonimos').split(/[\n;]+/).map((s) => s.trim()).filter(Boolean))]
}

export async function crearCargo(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'crear')
  const supabase = await createClient()
  const org = supabase.schema('org')
  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre del cargo necesita al menos tres letras.' }
  const { data: iguales } = await org.from('cargo').select('id').ilike('nombre', nombre)
  if (iguales?.length) return { error: 'Ya hay un cargo con ese nombre. Si es otro nombre para el mismo cargo, agrégalo como sinónimo.' }

  const base = claveDe(nombre)
  const { data: parecidas } = await org.from('cargo').select('clave').like('clave', `${base}%`)
  const usadas = new Set((parecidas ?? []).map((c) => c.clave))
  let clave = base
  for (let n = 2; usadas.has(clave); n++) clave = `${base}-${n}`

  const id = crypto.randomUUID()
  const { error } = await org.from('cargo').insert({
    id,
    clave,
    nombre,
    familia: nulo(texto(fd, 'familia')),
    sinonimos: sinonimosDe(fd),
    proposito: nulo(texto(fd, 'proposito')),
    activo: true,
  })
  if (error) return { error: mensajeDeError(error) }
  revalidatePath('/sistema/nucleo/organizacion/cargos')
  redirect(`/sistema/nucleo/organizacion/cargos?q=${encodeURIComponent(nombre)}&ficha=cargo:${id}`)
}

export async function editarCargo(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const org = supabase.schema('org')
  const id = texto(fd, 'id')
  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre del cargo necesita al menos tres letras.' }
  const { data: iguales } = await org.from('cargo').select('id').ilike('nombre', nombre).neq('id', id)
  if (iguales?.length) return { error: 'Ya hay otro cargo con ese nombre.' }
  const nivel = entero(fd, 'nivel')
  const { error } = await org
    .from('cargo')
    .update({
      nombre,
      familia: nulo(texto(fd, 'familia')),
      nivel,
      sinonimos: sinonimosDe(fd),
      proposito: nulo(texto(fd, 'proposito')),
      activo: fd.get('activo') === 'on',
    })
    .eq('id', id)
  if (error) return { error: mensajeDeError(error) }
  revalidatePath('/sistema/nucleo/organizacion', 'layout')
  return { ok: 'Guardado. El cambio queda en la auditoría.' }
}
