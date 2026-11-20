'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { campo, mensajeError, type EstadoAccion } from '@/components/sistema/flujo/formato'
import type { Json } from '@/lib/database.types'

/**
 * Las rutas de aprobación son configuración sensible: deciden quién firma. Cada
 * escritura pide `sistema:aprobaciones` editar aquí y en la RLS, y queda en la
 * auditoría (trigger `control.auditar`). Las solicitudes en curso no cambian:
 * sus pasos se copiaron al iniciarse.
 */

const RUTA = '/sistema/administracion/aprobaciones'
const RESOLUTORES = ['cargo', 'plaza', 'jefe_unidad', 'director_unidad', 'rol']
const ACCIONES = ['aprobar', 'recibir', 'completar']

function listo(ruta: string, ok: string): EstadoAccion {
  revalidatePath(RUTA)
  revalidatePath(`${RUTA}/${ruta}`)
  return { ok }
}

export async function guardarRuta(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:aprobaciones', 'editar')
  const supabase = await createClient()
  const id = campo(fd, 'id')
  const nombre = campo(fd, 'nombre')
  if (nombre.length < 3) return { error: 'El nombre necesita al menos tres letras.' }
  const { data, error } = await supabase
    .schema('flujo')
    .from('ruta')
    .update({ nombre, descripcion: campo(fd, 'descripcion') || null, activa: fd.get('activa') === 'on' })
    .eq('id', id)
    .select('id')
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: 'La base no dejó guardarla.' }
  return listo(id, 'Ruta guardada.')
}

/** Lee el paso del formulario y lo valida contra lo que la base acepta. */
type FilaPaso = {
  nombre: string
  resolutor: string
  accion: string
  cargo_id: string | null
  plaza_ref: string | null
  rol_id: string | null
  condicion: Json | null
  ve_costos: boolean
  hito: boolean
}

function pasoDe(fd: FormData): { error?: string; fila?: FilaPaso } {
  const nombre = campo(fd, 'nombre')
  const resolutor = campo(fd, 'resolutor')
  const accion = campo(fd, 'accion')
  if (nombre.length < 3) return { error: 'Ponle nombre al paso: es lo que se lee en la línea de tiempo.' }
  if (!RESOLUTORES.includes(resolutor)) return { error: 'Elige cómo se resuelve quién firma.' }
  if (!ACCIONES.includes(accion)) return { error: 'Elige la acción del paso.' }
  const cargo = campo(fd, 'cargo_id') || null
  const plaza = campo(fd, 'plaza_ref') || null
  const rol = campo(fd, 'rol_id') || null
  if (resolutor === 'cargo' && !cargo) return { error: 'Un paso por cargo necesita el cargo.' }
  if (resolutor === 'plaza' && !plaza) return { error: 'Un paso por plaza necesita la plaza.' }
  if (resolutor === 'rol' && !rol) return { error: 'Un paso por rol necesita el rol.' }

  const condicion: { [k: string]: Json } = {}
  const origenes = fd.getAll('cond_origen').filter((x): x is string => typeof x === 'string' && x !== '')
  if (origenes.length) condicion.origen = origenes
  const plan = campo(fd, 'cond_fuera_de_plan')
  if (plan === 'si') condicion.fuera_de_plan = true
  if (plan === 'no') condicion.fuera_de_plan = false

  return {
    fila: {
      nombre,
      resolutor,
      accion,
      cargo_id: resolutor === 'cargo' ? cargo : null,
      plaza_ref: resolutor === 'plaza' ? plaza : null,
      rol_id: resolutor === 'rol' ? rol : null,
      condicion: Object.keys(condicion).length ? condicion : null,
      ve_costos: fd.get('ve_costos') === 'on',
      hito: fd.get('hito') === 'on',
    },
  }
}

export async function guardarPaso(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:aprobaciones', 'editar')
  const supabase = await createClient()
  const { error: invalido, fila } = pasoDe(fd)
  if (invalido || !fila) return { error: invalido }
  const ruta = campo(fd, 'ruta')
  const { data, error } = await supabase.schema('flujo').from('ruta_paso').update(fila).eq('id', campo(fd, 'id')).eq('ruta_id', ruta).select('id')
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: 'La base no dejó guardarlo.' }
  return listo(ruta, 'Paso guardado. Vale para las solicitudes que se envíen desde ahora.')
}

export async function agregarPaso(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:aprobaciones', 'editar')
  const supabase = await createClient()
  const { error: invalido, fila } = pasoDe(fd)
  if (invalido || !fila) return { error: invalido }
  const ruta = campo(fd, 'ruta')
  const { data: ultimo } = await supabase.schema('flujo').from('ruta_paso').select('orden').eq('ruta_id', ruta).order('orden', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase
    .schema('flujo')
    .from('ruta_paso')
    .insert({ ...fila, ruta_id: ruta, orden: (ultimo?.orden ?? 0) + 1 })
  if (error) return { error: mensajeError(error) }
  return listo(ruta, 'Paso agregado al final de la ruta.')
}

export async function quitarPaso(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:aprobaciones', 'editar')
  const supabase = await createClient()
  const ruta = campo(fd, 'ruta')
  const { data, error } = await supabase.schema('flujo').from('ruta_paso').delete().eq('id', campo(fd, 'id')).eq('ruta_id', ruta).select('id')
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: 'La base no dejó quitarlo.' }
  return listo(ruta, 'Paso quitado.')
}

/** Sube o baja un paso. `(ruta, orden)` es único: se intercambia pasando por un orden libre. */
export async function moverPaso(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:aprobaciones', 'editar')
  const supabase = await createClient()
  const flujo = supabase.schema('flujo')
  const ruta = campo(fd, 'ruta')
  const id = campo(fd, 'id')
  const sube = campo(fd, 'direccion') === 'arriba'
  const { data: pasos } = await flujo.from('ruta_paso').select('id, orden').eq('ruta_id', ruta).order('orden')
  const lista = pasos ?? []
  const i = lista.findIndex((p) => p.id === id)
  const j = sube ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return {}
  const a = lista[i]
  const b = lista[j]
  const libre = -1 - Math.abs(a.orden)
  for (const [pid, orden] of [
    [a.id, libre],
    [b.id, a.orden],
    [a.id, b.orden],
  ] as const) {
    const { error } = await flujo.from('ruta_paso').update({ orden }).eq('id', pid)
    if (error) return { error: mensajeError(error) }
  }
  return listo(ruta, 'Orden cambiado.')
}
