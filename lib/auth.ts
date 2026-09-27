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
  const panel = inicioDelPanel(sesion)
  if (panel) return panel
  if (Object.entries(sesion.permisos).some(([r, p]) => r.startsWith('informe:') && p.ver)) return '/informe'
  return '/sin-acceso'
}

/**
 * Las pantallas del panel, en el orden de la barra, con lo que exige cada una: lo
 * mismo que pide su página con `requerirPermiso`. Si no dijeran lo mismo, la
 * puerta al panel llevaría a una pantalla que la devuelve.
 */
const PANTALLAS_PANEL: [ruta: string, recurso: string, accion: Accion][] = [
  ['/dashboard', 'modulo:panel', 'ver'],
  ['/dashboard/entrevistas', 'modulo:entrevistas', 'ver'],
  ['/dashboard/archivos', 'modulo:archivos', 'ver'],
  ['/dashboard/programa', 'modulo:programa', 'ver'],
  ['/dashboard/adiestramiento', 'modulo:adiestramiento', 'ver'],
  ['/dashboard/adiestramiento/certificados', 'modulo:certificados', 'ver'],
  ['/dashboard/adiestramiento/recordatorios', 'modulo:recordatorios', 'editar'],
  ['/dashboard/empleados', 'modulo:empleados', 'editar'],
  ['/dashboard/usuarios', 'modulo:usuarios', 'ver'],
  ['/dashboard/roles', 'modulo:roles', 'ver'],
]

/**
 * La puerta al panel: la primera pantalla que esta sesión puede abrir, o `null` si
 * no tiene ninguna.
 *
 * ⚠️ **Tener módulos del panel no es tener su portada.** Un rol puede abrir
 * Adiestramiento sin tener «Panel» —el de Marketing, el 27 de septiembre de
 * 2026—, y hasta ese día `/dashboard` lo mandaba de vuelta al canal: los módulos
 * que su rol tenía no se podían abrir desde ninguna parte. Ahora el canal lleva
 * un botón a esta pantalla, y la portada que no le toca lo manda aquí.
 */
export function inicioDelPanel(sesion: Sesion | null | undefined): string | null {
  if (!sesion) return null
  return PANTALLAS_PANEL.find(([, recurso, accion]) => puede(sesion, recurso, accion))?.[0] ?? null
}

/**
 * Exige un permiso. Sin él, a la primera pantalla del panel que sí puede abrir
 * —a la portada con el aviso, si la tiene—, o si no tiene panel, a su destino
 * inicial. Sirve igual en páginas y en acciones de servidor: la acción no confía
 * en que el botón estuviera escondido.
 */
export async function requerirPermiso(recurso: string, accion: Accion = 'ver'): Promise<Sesion> {
  const sesion = await requerirSesion()
  if (!puede(sesion, recurso, accion)) {
    const panel = inicioDelPanel(sesion)
    redirect(panel === '/dashboard' ? '/dashboard?aviso=sin-permiso' : (panel ?? destinoInicial(sesion)))
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
