'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { claveDe, descendientes } from '@/components/sistema/flujo/estructura'
import { campo, hoyCaracas, mensajeError, type EstadoAccion } from '@/components/sistema/flujo/formato'

/**
 * El editor de un escenario de estructura. Todo opera sobre las filas con
 * `escenario_id` —son un borrador— y **cada consulta filtra por ese escenario**:
 * la realidad no se toca desde aquí. La base lo garantiza también: la política
 * que deja escribir con `sistema:escenarios` exige `escenario_id` y que el
 * escenario siga en borrador.
 */

const RUTA = '/sistema/nucleo/escenarios'

async function enBorrador(esc: string) {
  const supabase = await createClient()
  const { data } = await supabase.schema('org').from('escenario').select('id, estado, fecha_base, alcance').eq('id', esc).maybeSingle()
  if (!data) return { supabase, error: 'El escenario no existe.' }
  if (data.alcance !== 'estructura') return { supabase, error: 'Este no es un escenario de estructura.' }
  if (data.estado !== 'borrador') return { supabase, error: 'El escenario ya no está en borrador: no se edita.' }
  return { supabase, escenario: data }
}

function listo(esc: string, ok: string): EstadoAccion {
  revalidatePath(`${RUTA}/${esc}`)
  return { ok }
}

export async function crearEscenario(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'crear')
  const supabase = await createClient()
  const nombre = campo(fd, 'nombre')
  if (nombre.length < 3) return { error: 'Ponle un nombre de al menos tres letras.' }
  const { data, error } = await supabase
    .schema('org')
    .rpc('crear_escenario_estructura', { p_nombre: nombre, p_descripcion: campo(fd, 'descripcion') || undefined, p_fecha: hoyCaracas() })
  if (error) return { error: mensajeError(error) }
  revalidatePath(RUTA)
  redirect(`${RUTA}/${data}`)
}

export async function renombrarUnidad(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, error } = await enBorrador(esc)
  if (error) return { error }
  const nombre = campo(fd, 'nombre')
  const tipo = campo(fd, 'tipo')
  if (nombre.length < 2) return { error: 'El nombre necesita al menos dos letras.' }
  const cambios: { nombre: string; tipo?: string } = { nombre }
  if (tipo) cambios.tipo = tipo
  const { data, error: e } = await supabase.schema('org').from('unidad').update(cambios).eq('escenario_id', esc).eq('ref', campo(fd, 'ref')).select('id')
  if (e) return { error: mensajeError(e) }
  if (!data?.length) return { error: 'No se encontró la unidad en el escenario.' }
  return listo(esc, 'Unidad actualizada.')
}

export async function moverUnidad(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, error } = await enBorrador(esc)
  if (error) return { error }
  const ref = campo(fd, 'ref')
  const padre = campo(fd, 'padre_ref') || null
  const { data: unidades } = await supabase.schema('org').from('unidad').select('ref, nombre, padre_ref').eq('escenario_id', esc)
  const todas = unidades ?? []
  if (padre === ref) return { error: 'Una unidad no depende de sí misma.' }
  if (padre && descendientes(todas, ref).has(padre)) return { error: 'No se puede mover debajo de una de sus propias unidades.' }
  if (padre && !todas.some((u) => u.ref === padre)) return { error: 'Esa unidad no está en el escenario.' }
  const { data, error: e } = await supabase.schema('org').from('unidad').update({ padre_ref: padre }).eq('escenario_id', esc).eq('ref', ref).select('id')
  if (e) return { error: mensajeError(e) }
  if (!data?.length) return { error: 'No se encontró la unidad en el escenario.' }
  return listo(esc, 'Unidad movida.')
}

/** Pasar una plaza a otra unidad del escenario (el arrastre del lienzo). Conserva a quién reporta. */
export async function moverPlaza(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, error } = await enBorrador(esc)
  if (error) return { error }
  const ref = campo(fd, 'ref')
  const unidad = campo(fd, 'unidad_ref')
  if (!unidad) return { error: 'Elige la unidad a la que pasa la plaza.' }
  const org = supabase.schema('org')
  const { data: destino } = await org.from('unidad').select('ref').eq('escenario_id', esc).eq('ref', unidad).maybeSingle()
  if (!destino) return { error: 'Esa unidad no está en el escenario.' }
  const { data, error: e } = await org.from('plaza').update({ unidad_ref: unidad }).eq('escenario_id', esc).eq('ref', ref).select('id')
  if (e) return { error: mensajeError(e) }
  if (!data?.length) return { error: 'No se encontró la plaza en el escenario.' }
  return listo(esc, 'Plaza movida.')
}

export async function agregarUnidad(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, escenario, error } = await enBorrador(esc)
  if (error || !escenario) return { error }
  const nombre = campo(fd, 'nombre')
  const tipo = campo(fd, 'tipo')
  if (nombre.length < 2) return { error: 'Ponle nombre a la unidad.' }
  if (!tipo) return { error: 'Elige el tipo de unidad.' }
  const { error: e } = await supabase
    .schema('org')
    .from('unidad')
    .insert({
      clave: claveDe(nombre),
      nombre,
      tipo,
      padre_ref: campo(fd, 'padre_ref') || null,
      escenario_id: esc,
      vigencia: `[${escenario.fecha_base},)`,
      fuente: 'Escenario',
    })
  if (e) return { error: mensajeError(e) }
  return listo(esc, `Unidad «${nombre}» agregada.`)
}

/** Cerrar una unidad en el escenario: sale con sus plazas. Las hijas, primero se mueven o se cierran. */
export async function cerrarUnidad(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, error } = await enBorrador(esc)
  if (error) return { error }
  const ref = campo(fd, 'ref')
  const org = supabase.schema('org')
  const { count } = await org.from('unidad').select('id', { count: 'exact', head: true }).eq('escenario_id', esc).eq('padre_ref', ref)
  if (count) return { error: `Tiene ${count} unidad(es) debajo: muévelas o ciérralas primero.` }
  // Lo que reportaba a sus plazas desde otras unidades queda sin jefe en el escenario.
  const { data: suyas } = await org.from('plaza').select('ref').eq('escenario_id', esc).eq('unidad_ref', ref)
  const refs = (suyas ?? []).map((p) => p.ref)
  if (refs.length) await org.from('plaza').update({ reporta_a_ref: null }).eq('escenario_id', esc).in('reporta_a_ref', refs).neq('unidad_ref', ref)
  const { error: e1 } = await org.from('plaza').delete().eq('escenario_id', esc).eq('unidad_ref', ref)
  if (e1) return { error: mensajeError(e1) }
  const { data, error: e2 } = await org.from('unidad').delete().eq('escenario_id', esc).eq('ref', ref).select('id')
  if (e2) return { error: mensajeError(e2) }
  if (!data?.length) return { error: 'La base no dejó cerrarla.' }
  return listo(esc, 'Unidad cerrada en el escenario, con sus plazas.')
}

export async function agregarPlaza(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, escenario, error } = await enBorrador(esc)
  if (error || !escenario) return { error }
  const cargo = campo(fd, 'cargo_id')
  const dotacion = Number(campo(fd, 'dotacion') || '1')
  if (!cargo) return { error: 'Elige el cargo de la plaza.' }
  if (!Number.isInteger(dotacion) || dotacion < 0 || dotacion > 999) return { error: 'La dotación es un número entero.' }
  const { error: e } = await supabase
    .schema('org')
    .from('plaza')
    .insert({
      unidad_ref: campo(fd, 'unidad_ref'),
      cargo_id: cargo,
      reporta_a_ref: campo(fd, 'reporta_a_ref') || null,
      dotacion,
      tipo_nomina: campo(fd, 'tipo_nomina') || null,
      estado: 'aprobada',
      escenario_id: esc,
      vigencia: `[${escenario.fecha_base},)`,
      fuente: 'Escenario',
    })
  if (e) return { error: mensajeError(e) }
  return listo(esc, 'Plaza agregada.')
}

export async function cambiarDotacion(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, error } = await enBorrador(esc)
  if (error) return { error }
  const dotacion = Number(campo(fd, 'dotacion'))
  if (!Number.isInteger(dotacion) || dotacion < 0 || dotacion > 999) return { error: 'La dotación es un número entero.' }
  const { data, error: e } = await supabase.schema('org').from('plaza').update({ dotacion }).eq('escenario_id', esc).eq('ref', campo(fd, 'ref')).select('id')
  if (e) return { error: mensajeError(e) }
  if (!data?.length) return { error: 'No se encontró la plaza en el escenario.' }
  return listo(esc, `Dotación en ${dotacion}.`)
}

export async function cerrarPlaza(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const { supabase, error } = await enBorrador(esc)
  if (error) return { error }
  const ref = campo(fd, 'ref')
  const org = supabase.schema('org')
  // Las plazas que le reportaban pasan a reportar a quien ella reportaba.
  const { data: plaza } = await org.from('plaza').select('reporta_a_ref').eq('escenario_id', esc).eq('ref', ref).maybeSingle()
  if (!plaza) return { error: 'No se encontró la plaza en el escenario.' }
  await org.from('plaza').update({ reporta_a_ref: plaza.reporta_a_ref }).eq('escenario_id', esc).eq('reporta_a_ref', ref)
  const { data, error: e } = await org.from('plaza').delete().eq('escenario_id', esc).eq('ref', ref).select('id')
  if (e) return { error: mensajeError(e) }
  if (!data?.length) return { error: 'La base no dejó cerrarla.' }
  return listo(esc, 'Plaza cerrada en el escenario.')
}

export async function enviarEscenario(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'editar')
  const esc = campo(fd, 'escenario')
  const desde = campo(fd, 'vigente_desde')
  if (!desde) return { error: 'Elige desde cuándo rige.' }
  if (desde < hoyCaracas()) return { error: 'No se permite una vigencia retroactiva: elige hoy o una fecha futura.' }
  const supabase = await createClient()
  const { error } = await supabase.schema('org').rpc('enviar_escenario', { p_esc: esc, p_vigente_desde: desde })
  if (error) return { error: mensajeError(error) }
  revalidatePath(RUTA, 'layout')
  revalidatePath('/sistema/bandeja')
  return { ok: 'Enviado a aprobación. Cuando firme el último paso, se publica solo con esa fecha.' }
}

export async function descartarEscenario(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:escenarios', 'eliminar')
  const esc = campo(fd, 'escenario')
  const supabase = await createClient()
  const { data, error } = await supabase.schema('org').from('escenario').update({ estado: 'descartado' }).eq('id', esc).eq('estado', 'borrador').select('id')
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: 'Solo se descarta un escenario en borrador.' }
  revalidatePath(RUTA, 'layout')
  return { ok: 'Escenario descartado. Queda como registro; no se borra.' }
}
