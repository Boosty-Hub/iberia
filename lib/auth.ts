import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { permite, type Accion, type MapaPermisos, type Nivel } from '@/lib/permisos'
import type { Profile, Rol } from '@/lib/types'

export type RolAsignado = { id: string; clave: string; nombre: string; nivel: Nivel }

export type Sesion = {
  userId: string
  email: string
  perfil: Profile
  rol: RolAsignado
  /** La matriz de su rol. El nivel administrador no la necesita: puede todo. */
  permisos: MapaPermisos
}

const ROLES_EDITORES: Rol[] = ['admin', 'consultor']

/**
 * Sesión + perfil + rol + matriz, o null si no hay usuario o el perfil está
 * inactivo.
 *
 * Va con `cache()` porque el layout y la página la piden los dos en la misma
 * petición, y cada vuelta a Supabase cuesta de 90 a 140 ms desde aquí: sin
 * memorizarla, cada pantalla pagaba la sesión dos veces.
 */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: perfil }, { data: filas }] = await Promise.all([
    supabase.from('profiles').select('*, roles(id, clave, nombre, nivel)').eq('id', user.id).maybeSingle(),
    supabase.rpc('mis_permisos'),
  ])

  // Sin perfil o desactivado, el usuario no opera: RLS le negaría todo de
  // cualquier forma, así que se trata como sesión inválida.
  if (!perfil || !perfil.activo) return null

  const { roles: rol, ...resto } = perfil
  const permisos: MapaPermisos = {}
  for (const f of filas ?? []) {
    permisos[f.recurso] = { ver: f.ver, crear: f.crear, editar: f.editar, eliminar: f.eliminar }
  }

  return {
    userId: user.id,
    email: user.email ?? perfil.email,
    perfil: resto as Profile,
    rol: (rol as RolAsignado | null) ?? {
      id: perfil.rol_id,
      clave: perfil.rol,
      nombre: perfil.rol,
      nivel: perfil.rol as Nivel,
    },
    permisos,
  }
})

export async function requerirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/login')
  return sesion
}

/** ¿Puede esta sesión hacer `accion` sobre `recurso`? La misma regla que `public.puede()`. */
export function puede(sesion: Sesion | null | undefined, recurso: string, accion: Accion = 'ver'): boolean {
  if (!sesion) return false
  return permite(sesion.rol.nivel, sesion.permisos, recurso, accion)
}

/**
 * A dónde va alguien que entra, según lo que su rol le deja abrir. El personal
 * de planta no tiene panel: su casa es el canal. Sin nada abierto, una página
 * que lo dice en vez de un bucle de redirecciones.
 */
export function destinoInicial(sesion: Sesion): string {
  if (puede(sesion, 'modulo:panel')) return '/dashboard'
  if (puede(sesion, 'modulo:canal')) return '/canal'
  if (Object.entries(sesion.permisos).some(([r, p]) => r.startsWith('informe:') && p.ver)) return '/informe'
  return '/sin-acceso'
}

/**
 * Exige un permiso. Sin él, de vuelta al panel con el aviso — o, si tampoco
 * tiene panel, a su destino inicial. Sirve igual en páginas y en acciones de
 * servidor: la acción no confía en que el botón estuviera escondido.
 */
export async function requerirPermiso(recurso: string, accion: Accion = 'ver'): Promise<Sesion> {
  const sesion = await requerirSesion()
  if (!puede(sesion, recurso, accion)) {
    const destino = destinoInicial(sesion)
    redirect(destino === '/dashboard' ? '/dashboard?aviso=sin-permiso' : destino)
  }
  return sesion
}

/** Exige rol admin o consultor. Los lectores de Iberia caen al dashboard. */
export async function requerirEditor(): Promise<Sesion> {
  const sesion = await requerirSesion()
  if (!ROLES_EDITORES.includes(sesion.perfil.rol as Rol)) {
    redirect('/dashboard?aviso=solo-lectura')
  }
  return sesion
}

export async function requerirAdmin(): Promise<Sesion> {
  const sesion = await requerirSesion()
  if (sesion.perfil.rol !== 'admin') {
    redirect('/dashboard?aviso=solo-admin')
  }
  return sesion
}

export function esEditor(perfil: Pick<Profile, 'rol'> | null | undefined): boolean {
  return !!perfil && ROLES_EDITORES.includes(perfil.rol as Rol)
}

export function esAdmin(perfil: Pick<Profile, 'rol'> | null | undefined): boolean {
  return perfil?.rol === 'admin'
}
