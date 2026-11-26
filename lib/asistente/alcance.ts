import 'server-only'
import { createAdminClient } from '@/lib/supabase/server'
import { catalogoFuentes } from '@/lib/asistente/fuentes'
import { permite, type MapaPermisos, type Nivel } from '@/lib/permisos'

export type EstadoFuente = 'si' | 'sin_permiso' | 'fuera_de_alcance' | 'apagada'

/**
 * Qué fuentes tendría el asistente de una persona, y por qué no las demás: la
 * misma regla de la ruta de fuentes (permiso de la pantalla ∩ alcance), sin
 * acuñar ninguna sesión. La usan «Ver como» y la revisión del linaje al compartir.
 */
export async function fuentesDePersona(perfilId: string): Promise<{ clave: string; titulo: string; estado: EstadoFuente }[]> {
  const admin = createAdminClient()
  const { data: perfil } = await admin.from('profiles').select('rol, rol_id, activo').eq('id', perfilId).maybeSingle()
  if (!perfil) return []
  const [{ data: permisos }, { data: fuentes }, { data: porRol }, { data: porUsuario }] = await Promise.all([
    admin.from('rol_permisos').select('recurso, ver, crear, editar, eliminar').eq('rol_id', perfil.rol_id),
    admin.schema('asistente').from('fuente').select('clave, encendida'),
    admin.schema('asistente').from('alcance_rol').select('fuente, permitido').eq('rol_id', perfil.rol_id),
    admin.schema('asistente').from('alcance_usuario').select('fuente, permitido').eq('perfil_id', perfilId),
  ])
  const mapa: MapaPermisos = {}
  for (const p of permisos ?? []) mapa[p.recurso] = { ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar }
  const encendida = new Map((fuentes ?? []).map((f) => [f.clave, f.encendida]))
  const rol = new Map((porRol ?? []).map((r) => [r.fuente, r.permitido]))
  const usuario = new Map((porUsuario ?? []).map((u) => [u.fuente, u.permitido]))
  return catalogoFuentes().map((f) => {
    const enAlcance = usuario.get(f.clave) ?? rol.get(f.clave) ?? false
    const conPermiso = !f.recurso || permite(perfil.rol as Nivel, mapa, f.recurso, f.accion)
    const estado: EstadoFuente = !perfil.activo || !encendida.get(f.clave) ? 'apagada' : !enAlcance ? 'fuera_de_alcance' : !conPermiso ? 'sin_permiso' : 'si'
    return { clave: f.clave, titulo: f.titulo, estado }
  })
}
