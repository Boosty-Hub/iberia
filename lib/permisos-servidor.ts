import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { construirInventario, type MapaPermisos, type Recurso } from '@/lib/permisos'

/**
 * El inventario completo, leído de la base con la sesión de quien administra:
 * los módulos del código, las secciones del informe en su orden y las lecciones
 * del curso. Solo lo piden las pantallas de roles, que son de administradores,
 * así que la RLS les devuelve todas las secciones y todas las lecciones.
 */
export async function leerInventario(): Promise<Recurso[]> {
  const supabase = await createClient()
  const [{ data: secciones }, { data: lecciones }] = await Promise.all([
    supabase.from('informe_secciones').select('slug, numero, titulo').order('orden'),
    supabase.from('lecciones').select('numero, titulo').order('numero'),
  ])
  // Una lección por número: si algún día hay dos cursos, la matriz no repite filas.
  const vistas = new Set<number>()
  const unicas = (lecciones ?? []).filter((l) => !vistas.has(l.numero) && vistas.add(l.numero))
  return construirInventario(secciones ?? [], unicas)
}

/** La matriz guardada de un rol, como mapa por recurso. */
export async function leerMatriz(rolId: string): Promise<MapaPermisos> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('rol_permisos')
    .select('recurso, ver, crear, editar, eliminar')
    .eq('rol_id', rolId)
  const mapa: MapaPermisos = {}
  for (const f of data ?? []) mapa[f.recurso] = { ver: f.ver, crear: f.crear, editar: f.editar, eliminar: f.eliminar }
  return mapa
}
