'use server'

import { revalidatePath } from 'next/cache'
import { puede, requerirPermiso, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hoyCaracas, VIGENTE_EN } from '@/components/sistema/organizacion/datos'
import type { Estado, PersonaEncontrada } from '@/components/sistema/organizacion/formulario'
import { nombreCargo, nombrePersona, nombrePlaza, nombreUnidad, proponer } from '@/lib/plataforma/cambios'
import {
  editarPlaza as editarPlazaFicha,
  editarUnidad as editarUnidadFicha,
  terminarOcupacion as terminarOcupacionFicha,
  editarCargo as editarCargoFicha,
} from '@/lib/plataforma/fichas/organizacion-acciones'

/**
 * Las acciones de la estructura. Ninguna escribe en la realidad: proponen el cambio (`lib/plataforma/cambios.ts`), que
 * queda en el borrador de cambios de quien lo hace y entra cuando se aprueba (24-nov-2026). La base lo simula con la
 * función de siempre (`org.editar_unidad`, `org.asignar_ocupacion`…), así que el error sale en el acto. Cada acción pide
 * el permiso otra vez: no confía en que el botón estuviera escondido.
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

// -----------------------------------------------------------------------------
// Unidades · todo se propone: entra a la realidad cuando se aprueba el lote (24-nov-2026)
// -----------------------------------------------------------------------------

/** Lo que el formulario cambia respecto de lo vigente, para proponer solo eso. */
function diferencias(actual: Record<string, unknown>, nuevo: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(nuevo)) if ((actual[k] ?? null) !== (v ?? null)) d[k] = v
  return d
}
const resultado = (r: { ok?: string; error?: string; aviso?: string }): Estado => (r.error ? { error: r.error } : { ok: r.ok, aviso: r.aviso })

export async function crearUnidad(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'crear')
  const supabase = await createClient()
  const nombre = texto(fd, 'nombre')
  const padre = nulo(texto(fd, 'padre_ref'))
  const r = await proponer(
    supabase,
    'crear_unidad',
    { p_clave: claveDe(nombre), p_nombre: nombre, p_tipo: texto(fd, 'tipo'), p_padre_ref: padre, p_sede: texto(fd, 'sede'), p_codigo: texto(fd, 'codigo'), p_nota: '' },
    `Unidad nueva «${nombre}», debajo de «${await nombreUnidad(supabase, padre)}»`,
    { objeto: 'unidad', ref: padre }
  )
  refrescar(padre ?? undefined)
  return resultado(r)
}

export async function editarUnidad(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const ref = texto(fd, 'ref')
  const { data: u } = await supabase.schema('org').from('unidad').select('nombre, tipo, padre_ref, sede, codigo_organigrama').eq('ref', ref).is('escenario_id', null).filter('vigencia', 'cs', VIGENTE_EN(hoyCaracas())).maybeSingle()
  if (!u) return { error: 'La unidad no está vigente hoy.' }
  const cambios = diferencias(
    { nombre: u.nombre, tipo: u.tipo, padre_ref: u.padre_ref, sede: u.sede, codigo: u.codigo_organigrama },
    { nombre: texto(fd, 'nombre'), tipo: texto(fd, 'tipo'), padre_ref: nulo(texto(fd, 'padre_ref')), sede: nulo(texto(fd, 'sede')), codigo: nulo(texto(fd, 'codigo')) }
  )
  if (fd.get('confirmar') === 'on') cambios.certeza = 'hecho'
  if (!Object.keys(cambios).length) return { error: 'No hay cambios que guardar.' }
  const r = await editarUnidadFicha(supabase, ref, hoyCaracas(), cambios)
  refrescar(ref)
  return resultado(r)
}

export async function cerrarUnidad(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const ref = texto(fd, 'ref')
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla para confirmar el cierre.' }
  const motivo = texto(fd, 'motivo')
  const r = await proponer(supabase, 'cerrar_unidad', { p_ref: ref, p_motivo: motivo }, `Cerrar la unidad «${await nombreUnidad(supabase, ref)}»${motivo ? `: ${motivo}` : ''}`, { objeto: 'unidad', ref })
  refrescar(ref)
  return resultado(r)
}

// -----------------------------------------------------------------------------
// Plazas
// -----------------------------------------------------------------------------

export async function crearPlaza(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'crear')
  const supabase = await createClient()
  const unidad = texto(fd, 'unidad_ref')
  const cargo = texto(fd, 'cargo_id')
  if (!cargo) return { error: 'Elige el cargo de la plaza.' }
  const dotacion = entero(fd, 'dotacion') ?? 1
  const r = await proponer(
    supabase,
    'crear_plaza',
    {
      p_unidad_ref: unidad,
      p_cargo_id: cargo,
      p_dotacion: dotacion,
      p_reporta_a_ref: nulo(texto(fd, 'reporta_a_ref')),
      p_tipo_nomina: texto(fd, 'tipo_nomina'),
      p_sede: texto(fd, 'sede'),
      p_estado: texto(fd, 'estado') || 'aprobada',
      p_nota: texto(fd, 'nota'),
    },
    `Plaza nueva de «${await nombreCargo(supabase, cargo)}» en «${await nombreUnidad(supabase, unidad)}», dotación ${dotacion}`,
    { objeto: 'unidad', ref: unidad }
  )
  refrescar(unidad)
  return resultado(r)
}

export async function editarPlaza(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const ref = texto(fd, 'ref')
  const { data: p } = await supabase.schema('org').from('plaza').select('dotacion, reporta_a_ref, estado, tipo_nomina, sede, unidad_ref').eq('ref', ref).is('escenario_id', null).filter('vigencia', 'cs', VIGENTE_EN(hoyCaracas())).maybeSingle()
  if (!p) return { error: 'La plaza no está vigente hoy.' }
  const cambios = diferencias(p, {
    dotacion: entero(fd, 'dotacion') ?? 0,
    reporta_a_ref: nulo(texto(fd, 'reporta_a_ref')),
    estado: texto(fd, 'estado') || p.estado,
    tipo_nomina: nulo(texto(fd, 'tipo_nomina')),
    sede: nulo(texto(fd, 'sede')),
    unidad_ref: nulo(texto(fd, 'unidad_ref')) ?? p.unidad_ref,
  })
  if (fd.get('confirmar') === 'on') cambios.certeza = 'hecho'
  if (!Object.keys(cambios).length) return { error: 'No hay cambios que guardar.' }
  const r = await editarPlazaFicha(supabase, ref, hoyCaracas(), cambios)
  refrescar(texto(fd, 'unidad_actual'))
  return resultado(r)
}

export async function cerrarPlaza(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  if (fd.get('confirmo') !== 'on') return { error: 'Marca la casilla para confirmar el cierre.' }
  const ref = texto(fd, 'ref')
  const motivo = texto(fd, 'motivo')
  const r = await proponer(supabase, 'cerrar_plaza', { p_ref: ref, p_motivo: motivo }, `Cerrar la plaza «${await nombrePlaza(supabase, ref)}»${motivo ? `: ${motivo}` : ''}`, { objeto: 'plaza', ref })
  refrescar(texto(fd, 'unidad_actual'))
  return resultado(r)
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
  const plaza = texto(fd, 'plaza_ref')
  const tipo = texto(fd, 'tipo') || 'titular'
  const r = await proponer(
    supabase,
    'asignar_ocupacion',
    { p_plaza_ref: plaza, p_empleado_id: empleado, p_tipo: tipo, p_excede: fd.get('excede') === 'on', p_motivo: texto(fd, 'motivo') },
    `${await nombrePersona(supabase, empleado)} entra a la plaza «${await nombrePlaza(supabase, plaza)}» como ${tipo}`,
    { objeto: 'plaza', ref: plaza }
  )
  refrescar(texto(fd, 'unidad_actual'))
  return resultado(r)
}

export async function moverOcupacion(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const destino = texto(fd, 'plaza_destino')
  if (!destino) return { error: 'Elige la plaza de destino.' }
  const id = texto(fd, 'id')
  const { data: o } = await supabase.schema('org').from('ocupacion').select('empleado_id').eq('id', id).maybeSingle()
  const r = await proponer(
    supabase,
    'mover_ocupacion',
    { p_id: id, p_plaza_destino: destino, p_tipo: texto(fd, 'tipo'), p_excede: fd.get('excede') === 'on', p_motivo: texto(fd, 'motivo') },
    `Mover a ${await nombrePersona(supabase, o?.empleado_id)} a la plaza «${await nombrePlaza(supabase, destino)}»`,
    { objeto: 'plaza', ref: destino }
  )
  refrescar(texto(fd, 'unidad_actual'))
  return resultado(r)
}

export async function terminarOcupacion(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const r = await terminarOcupacionFicha(supabase, texto(fd, 'id'), hoyCaracas(), texto(fd, 'motivo'))
  refrescar(texto(fd, 'unidad_actual'))
  return resultado(r)
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
  const nombre = texto(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre del cargo necesita al menos tres letras.' }
  const { data: iguales } = await supabase.schema('org').from('cargo').select('id').ilike('nombre', nombre)
  if (iguales?.length) return { error: 'Ya hay un cargo con ese nombre. Si es otro nombre para el mismo cargo, agrégalo como sinónimo.' }
  const r = await proponer(
    supabase,
    'crear_cargo',
    { p_nombre: nombre, p_familia: texto(fd, 'familia'), p_nivel: '', p_sinonimos: sinonimosDe(fd), p_proposito: texto(fd, 'proposito') },
    `Cargo nuevo «${nombre}»`,
    { objeto: 'cargo' }
  )
  revalidatePath('/sistema/nucleo/organizacion/cargos')
  return resultado(r)
}

/** Cada campo que cambió es un cambio propuesto (el formulario puede tocar varios a la vez). */
export async function editarCargo(_a: Estado, fd: FormData): Promise<Estado> {
  await requerirPermiso('sistema:estructura', 'editar')
  const supabase = await createClient()
  const id = texto(fd, 'id')
  const { data: c } = await supabase.schema('org').from('cargo').select('nombre, familia, nivel, sinonimos, proposito, activo').eq('id', id).maybeSingle()
  if (!c) return { error: 'Ese cargo no existe.' }
  const nuevo: Record<string, string> = {
    nombre: texto(fd, 'nombre'),
    familia: texto(fd, 'familia'),
    nivel: texto(fd, 'nivel'),
    sinonimos: sinonimosDe(fd).join(';'),
    proposito: texto(fd, 'proposito'),
    activo: fd.get('activo') === 'on' ? 'activo' : 'inactivo',
  }
  const actual: Record<string, string> = {
    nombre: c.nombre,
    familia: c.familia ?? '',
    nivel: c.nivel === null ? '' : String(c.nivel),
    sinonimos: (c.sinonimos ?? []).join(';'),
    proposito: c.proposito ?? '',
    activo: c.activo ? 'activo' : 'inactivo',
  }
  const campos = Object.keys(nuevo).filter((k) => nuevo[k] !== actual[k])
  if (!campos.length) return { error: 'No hay cambios que guardar.' }
  let ultimo: { ok?: string; error?: string } = {}
  for (const k of campos) {
    ultimo = await editarCargoFicha(supabase, id, k, nuevo[k])
    if (ultimo.error) return { error: ultimo.error }
  }
  revalidatePath('/sistema/nucleo/organizacion', 'layout')
  return resultado(ultimo)
}
