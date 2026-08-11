import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, Rol } from '@/lib/types'

export type Sesion = {
  userId: string
  email: string
  perfil: Profile
}

const ROLES_EDITORES: Rol[] = ['admin', 'consultor']

/** Sesión + perfil, o null si no hay usuario autenticado o el perfil está inactivo. */
export async function obtenerSesion(): Promise<Sesion | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  // Sin perfil o desactivado, el usuario no opera: RLS le negaría todo de
  // cualquier forma, así que se trata como sesión inválida.
  if (!perfil || !perfil.activo) return null

  return { userId: user.id, email: user.email ?? perfil.email, perfil }
}

export async function requerirSesion(): Promise<Sesion> {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/login')
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
