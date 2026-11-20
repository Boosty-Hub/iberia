'use server'

import { revalidatePath } from 'next/cache'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { campo, mensajeError, type EstadoAccion } from '@/components/sistema/flujo/formato'

/**
 * Los catálogos (tipos de unidad, de nómina, orígenes de requisición…) son datos
 * editables. **Nunca se borran**: las reglas y las llaves foráneas usan sus
 * claves. Se agregan, se renombran, se reordenan y se desactivan.
 */

const RUTA = '/sistema/administracion/catalogos'

export async function agregarEntrada(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:catalogos', 'crear')
  const supabase = await createClient()
  const tipo = campo(fd, 'tipo')
  const clave = campo(fd, 'clave').toLowerCase()
  const etiqueta = campo(fd, 'etiqueta')
  if (!/^[a-z0-9_]+$/.test(clave)) return { error: 'La clave va en minúsculas, sin tildes ni espacios (use _).' }
  if (etiqueta.length < 2) return { error: 'Escribe la etiqueta que se ve en pantalla.' }
  const { data: ultimo } = await supabase.schema('control').from('catalogo').select('orden').eq('tipo', tipo).order('orden', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase
    .schema('control')
    .from('catalogo')
    .insert({ tipo, clave, etiqueta, orden: (ultimo?.orden ?? 0) + 1, descripcion: campo(fd, 'descripcion') || null })
  if (error) return { error: error.code === '23505' ? 'Esa clave ya existe en el catálogo.' : mensajeError(error) }
  revalidatePath(RUTA)
  return { ok: `«${etiqueta}» agregada.` }
}

export async function guardarEntrada(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:catalogos', 'editar')
  const supabase = await createClient()
  const etiqueta = campo(fd, 'etiqueta')
  if (etiqueta.length < 2) return { error: 'La etiqueta necesita al menos dos letras.' }
  const { data, error } = await supabase
    .schema('control')
    .from('catalogo')
    .update({ etiqueta, descripcion: campo(fd, 'descripcion') || null })
    .eq('tipo', campo(fd, 'tipo'))
    .eq('clave', campo(fd, 'clave'))
    .select('clave')
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: 'La base no dejó guardarla.' }
  revalidatePath(RUTA)
  return { ok: 'Guardada.' }
}

export async function alternarEntrada(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:catalogos', 'editar')
  const supabase = await createClient()
  const activo = campo(fd, 'activo') === 'si'
  const { data, error } = await supabase
    .schema('control')
    .from('catalogo')
    .update({ activo })
    .eq('tipo', campo(fd, 'tipo'))
    .eq('clave', campo(fd, 'clave'))
    .select('clave')
  if (error) return { error: mensajeError(error) }
  if (!data?.length) return { error: 'La base no dejó cambiarla.' }
  revalidatePath(RUTA)
  // Sin mensaje: la fila cambia sola, y un aviso en ese hueco descuadraba la lista.
  return {}
}

/** Sube o baja una entrada dentro de su tipo, renumerando el orden de todas. */
export async function moverEntrada(_a: EstadoAccion, fd: FormData): Promise<EstadoAccion> {
  await requerirPermiso('sistema:catalogos', 'editar')
  const supabase = await createClient()
  const control = supabase.schema('control')
  const tipo = campo(fd, 'tipo')
  const clave = campo(fd, 'clave')
  const { data } = await control.from('catalogo').select('clave, orden').eq('tipo', tipo).order('orden').order('clave')
  const lista = (data ?? []).map((x) => x.clave)
  const i = lista.indexOf(clave)
  const j = campo(fd, 'direccion') === 'arriba' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= lista.length) return {}
  ;[lista[i], lista[j]] = [lista[j], lista[i]]
  const actuales = new Map((data ?? []).map((x) => [x.clave, x.orden]))
  for (const [n, k] of lista.entries()) {
    if (actuales.get(k) === n + 1) continue
    const { error } = await control.from('catalogo').update({ orden: n + 1 }).eq('tipo', tipo).eq('clave', k)
    if (error) return { error: mensajeError(error) }
  }
  revalidatePath(RUTA)
  return {}
}
