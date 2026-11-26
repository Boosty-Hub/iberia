import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { construirInventario, type MapaPermisos, type Recurso } from '@/lib/permisos'
import { DOMINIOS, MODULOS_INTERFAZ, PESTANAS, RECURSOS_ALTERNOS, dominioDe } from '@/lib/plataforma/dominios'

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
  const { data: modulos } = await supabase.schema('control').from('modulo').select('codigo, nombre, dominio, estado, ruta, recurso').order('orden')
  return conMenu(construirInventario(secciones ?? [], unicas), modulos ?? [])
}

/**
 * A cada casilla, los módulos y pestañas del menú que abre: así Roles dice, por
 * módulo, qué se marca para que alguien lo vea (26-nov-2026, Gabriel).
 */
function conMenu(inventario: Recurso[], plan: { codigo: string; nombre: string; dominio: string; estado: string; ruta: string | null; recurso: string | null }[]): Recurso[] {
  const nombreDominio = (m: { codigo: string; dominio: string }) => {
    const clave = m.dominio === 'Mi día' ? 'inicio' : dominioDe(m as never)
    return DOMINIOS.find((d) => d.clave === clave)?.nombre ?? m.dominio
  }
  // recurso → módulo → pestañas que abre en él
  const menu = new Map<string, Map<string, string[]>>()
  const anotar = (recurso: string | null | undefined, lugar: string, pestana?: string) => {
    if (!recurso) return
    const porModulo = menu.get(recurso) ?? new Map<string, string[]>()
    const l = porModulo.get(lugar) ?? []
    if (pestana && !l.includes(pestana)) l.push(pestana)
    porModulo.set(lugar, l)
    menu.set(recurso, porModulo)
  }
  for (const m of [...MODULOS_INTERFAZ, ...plan]) {
    if (m.estado === 'planificado' || !m.ruta) continue
    const lugar = `${nombreDominio(m)} › ${m.nombre}`
    const pestanas = PESTANAS[m.codigo] ?? []
    if (!pestanas.length) anotar(m.recurso, lugar)
    for (const p of pestanas) anotar(p.recurso ?? m.recurso, lugar, p.etiqueta)
    for (const r of RECURSOS_ALTERNOS[m.codigo] ?? []) if (!r.endsWith(':*')) anotar(r, lugar)
  }
  const texto = (porModulo: Map<string, string[]>) => [...porModulo].map(([lugar, ps]) => (ps.length ? `${lugar} (${ps.join(', ')})` : lugar))
  return inventario.map((r) => (menu.has(r.clave) ? { ...r, menu: texto(menu.get(r.clave)!) } : r))
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
