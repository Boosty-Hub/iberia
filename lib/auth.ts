import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { versionAceptada } from '@/lib/normas'
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
  /** La versión de las normas del canal que aceptó (0 si ninguna). Ver `lib/normas.ts`. */
  normasAceptadas: number
  /** El rol de verdad. Es el mismo que `rol`, salvo con «ver como» activo. */
  rolReal: RolAsignado
  /**
   * «Ver como» (solo el nivel administrador, cookie `ver_como` en `/sistema`):
   * `rol` y `permisos` pasan a ser los del rol que se previsualiza. **Solo
   * recorta**: quien lo usa es administrador, que ya lo puede todo, y la base
   * sigue respondiendo con su usuario real (la RLS no cambia).
   */
  vistaComo: { rolId: string; nombre: string } | null
}

/** La cookie de «ver como». Vive solo bajo `/sistema`: el panel y el canal no la oyen. */
export const COOKIE_VER_COMO = 'ver_como'

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

  // El `sub` del JWT (verificado en local con getClaims, sin red) deja pedir el
  // perfil y la matriz a la vez que getUser(), que sigue siendo quien decide:
  // si Auth no confirma al mismo usuario, no hay sesión. Una vuelta a la base
  // menos en cada página y cada acción (R6). PostgREST valida el mismo token,
  // así que lo leído en paralelo es lo que ese token ya podía leer.
  const { data: verificado } = await supabase.auth.getClaims()
  const sub = verificado?.claims?.sub
  if (!sub) return null

  const [
    {
      data: { user },
    },
    { data: perfil },
    { data: filas },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('profiles').select('*, roles(id, clave, nombre, nivel)').eq('id', sub).maybeSingle(),
    supabase.rpc('mis_permisos'),
  ])
  if (!user || user.id !== sub) return null

  // Sin perfil o desactivado, el usuario no opera: RLS le negaría todo de
  // cualquier forma, así que se trata como sesión inválida.
  if (!perfil || !perfil.activo) return null

  const { roles: rol, ...resto } = perfil
  const permisos: MapaPermisos = {}
  for (const f of filas ?? []) {
    permisos[f.recurso] = { ver: f.ver, crear: f.crear, editar: f.editar, eliminar: f.eliminar }
  }

  const rolReal: RolAsignado = (rol as RolAsignado | null) ?? {
    id: perfil.rol_id,
    clave: perfil.rol,
    nombre: perfil.rol,
    nivel: perfil.rol as Nivel,
  }
  const base: Sesion = {
    userId: user.id,
    email: user.email ?? perfil.email,
    perfil: resto as Profile,
    rol: rolReal,
    permisos,
    normasAceptadas: versionAceptada(user.user_metadata),
    rolReal,
    vistaComo: null,
  }

  // «Ver como»: solo para el nivel administrador. A cualquier otro se le ignora
  // la cookie, así que nunca da más de lo que la sesión tiene.
  if (rolReal.nivel !== 'admin') return base
  const verComo = (await cookies()).get(COOKIE_VER_COMO)?.value
  if (!verComo || verComo === rolReal.id || !/^[0-9a-f-]{36}$/i.test(verComo)) return base
  const [{ data: otro }, { data: matriz }] = await Promise.all([
    supabase.from('roles').select('id, clave, nombre, nivel').eq('id', verComo).maybeSingle(),
    supabase.from('rol_permisos').select('recurso, ver, crear, editar, eliminar').eq('rol_id', verComo),
  ])
  if (!otro) return base
  const permisosOtro: MapaPermisos = {}
  for (const f of matriz ?? []) {
    permisosOtro[f.recurso] = { ver: f.ver, crear: f.crear, editar: f.editar, eliminar: f.eliminar }
  }
  return { ...base, rol: otro as RolAsignado, permisos: permisosOtro, vistaComo: { rolId: otro.id, nombre: otro.nombre } }
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
  // Portal planta (24-nov-2026, Gabriel): el administrador entra al admin y tiene botones para pasar de uno a
  // otro; quien tiene el portal y no es administrador entra directo al portal; el resto, al admin.
  if (sesion.rol.nivel === 'admin') return '/sistema'
  if (puede(sesion, 'modulo:canal')) return '/canal'
  if (puede(sesion, 'modulo:panel')) return '/sistema'
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
  // El panel viejo se mudó a la plataforma (20-nov-2026): su portada es Mi día.
  ['/sistema', 'modulo:panel', 'ver'],
  ['/sistema/programa/levantamiento/entrevistas', 'modulo:entrevistas', 'ver'],
  ['/sistema/programa/levantamiento/archivos', 'modulo:archivos', 'ver'],
  ['/sistema/programa', 'modulo:programa', 'ver'],
  ['/sistema/programa/calendario', 'modulo:calendario', 'ver'],
  ['/sistema/nucleo/formacion', 'modulo:adiestramiento', 'ver'],
  ['/sistema/nucleo/formacion/certificados', 'modulo:certificados', 'ver'],
  ['/sistema/nucleo/formacion/recordatorios', 'modulo:recordatorios', 'editar'],
  ['/sistema/personas/padron', 'modulo:empleados', 'editar'],
  ['/sistema/nucleo/canal', 'modulo:reportes', 'ver'],
  ['/sistema/administracion/usuarios', 'modulo:usuarios', 'ver'],
  ['/sistema/administracion/roles', 'modulo:roles', 'ver'],
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
    // Con «ver como», la pantalla que el rol no abre devuelve a «Mi día», que
    // se abre con cualquier sesión: la previsualización no se sale de /sistema.
    // Y lo mismo con un recurso de la plataforma: quien entra a /sistema se
    // queda en /sistema, en vez de saltar al panel o a «sin acceso».
    if (sesion.vistaComo || recurso.startsWith('sistema:')) redirect('/sistema?aviso=sin-permiso')
    const panel = inicioDelPanel(sesion)
    redirect(panel === '/sistema' ? '/sistema?aviso=sin-permiso' : (panel ?? destinoInicial(sesion)))
  }
  return sesion
}

/** Exige rol admin o consultor. Los lectores de Iberia caen a Mi día, con el aviso. */
export async function requerirEditor(): Promise<Sesion> {
  const sesion = await requerirSesion()
  if (!ROLES_EDITORES.includes(sesion.perfil.rol as Rol)) {
    redirect('/sistema?aviso=solo-lectura')
  }
  return sesion
}

export async function requerirAdmin(): Promise<Sesion> {
  const sesion = await requerirSesion()
  if (sesion.perfil.rol !== 'admin') {
    redirect('/sistema?aviso=solo-admin')
  }
  return sesion
}

export function esEditor(perfil: Pick<Profile, 'rol'> | null | undefined): boolean {
  return !!perfil && ROLES_EDITORES.includes(perfil.rol as Rol)
}

export function esAdmin(perfil: Pick<Profile, 'rol'> | null | undefined): boolean {
  return perfil?.rol === 'admin'
}
