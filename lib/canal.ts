import { redirect } from 'next/navigation'
import { inicioDelPanel, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import type { Row } from '@/lib/types'

/**
 * La ficha tal como la sirve la API a una sesión: sin cédula, teléfono, correo,
 * fecha de ingreso ni tipo de nómina (privilegios de columna, migración
 * `seguimiento_privacidad`): un `select('*')` sobre `empleados` lo rechaza la
 * base. El contacto se pide aparte con `contacto_empleados()`, que a cada quien
 * solo le da lo suyo.
 */
export const COLUMNAS_EMPLEADO =
  'id, ficha, nombre_completo, cargo, area_id, sede, nivel, familia_oficio, foto_url, activo, perfil_id, puede_publicar, es_moderador, created_at, updated_at' as const

export type Empleado = Omit<Row<'empleados'>, 'cedula' | 'telefono' | 'email' | 'fecha_ingreso' | 'tipo_nomina' | 'busqueda'>

export type EmpleadoConArea = Empleado & {
  areas: { id: string; nombre: string } | null
}

/**
 * El empleado que corresponde a la sesión, o null si quien entró no está en el
 * padrón. Los consultores de Boosty tienen sesión pero no son empleados de
 * Iberia: entran al dashboard, no al canal.
 */
export async function empleadoActual(): Promise<EmpleadoConArea | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('empleados')
    .select(`${COLUMNAS_EMPLEADO}, areas(id, nombre)`)
    .eq('perfil_id', user.id)
    .eq('activo', true)
    .maybeSingle()

  return data
}

export async function requerirEmpleado(): Promise<EmpleadoConArea> {
  const empleado = await empleadoActual()
  if (!empleado) redirect('/canal/entrar')
  return empleado
}

// -----------------------------------------------------------------------------
// Vocabulario del canal
// -----------------------------------------------------------------------------

/**
 * El nivel gobierna qué ve la persona al entrar. Un operador de molino no puede
 * aterrizar en la misma pantalla que la Gerencia General.
 */
export type NivelEmpleado =
  | 'direccion'
  | 'gerencia'
  | 'jefatura'
  | 'administrativo'
  | 'planta'

export const NIVELES_EMPLEADO: Record<NivelEmpleado, string> = {
  direccion: 'Dirección',
  gerencia: 'Gerencia',
  jefatura: 'Jefatura',
  administrativo: 'Administrativo',
  planta: 'Planta',
}

/** Orden jerárquico. Determina qué conexiones piden solicitud y cuáles no. */
export const ORDEN_NIVEL: Record<NivelEmpleado, number> = {
  direccion: 0,
  gerencia: 1,
  jefatura: 2,
  administrativo: 3,
  planta: 4,
}

/**
 * Entre pares —mismo nivel o adyacente— se solicita conexión y la otra persona
 * acepta. Hacia arriba se escribe directo desde el directorio, sin solicitud:
 * así nadie de planta queda expuesto a que la dirección le rechace una
 * solicitud dentro de su propia empresa.
 */
export function requiereSolicitud(
  mio: NivelEmpleado,
  otro: NivelEmpleado
): boolean {
  return Math.abs(ORDEN_NIVEL[mio] - ORDEN_NIVEL[otro]) <= 1
}

export type TipoPublicacion =
  | 'comunicado'
  | 'noticia'
  | 'nuestra_gente'
  | 'evento'
  | 'hito_ia'
  | 'formacion'

export const TIPOS_PUBLICACION: Record<TipoPublicacion, string> = {
  comunicado: 'Comunicado',
  noticia: 'Noticia',
  nuestra_gente: 'Nuestra gente',
  evento: 'Evento',
  hito_ia: 'Nueva etapa',
  formacion: 'Formación',
}

export type Audiencia =
  | 'todos'
  | 'direccion'
  | 'gerencia'
  | 'administrativo'
  | 'planta'
  | 'area'

export const AUDIENCIAS: Record<Audiencia, string> = {
  todos: 'Toda la organización',
  direccion: 'Dirección',
  gerencia: 'Gerencias',
  administrativo: 'Personal administrativo',
  planta: 'Personal de planta',
  area: 'Un área específica',
}

/** Iniciales para el avatar cuando la persona no tiene foto. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[1][0]).toUpperCase()
}

/** "hace 3 h", "ayer", "12 ago" — cómo se lee una fecha en un feed. */
export function haceCuanto(fecha: string | null | undefined, ahora: Date): string {
  if (!fecha) return ''
  const d = new Date(fecha)
  const minutos = Math.floor((ahora.getTime() - d.getTime()) / 60000)

  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`

  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`

  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`

  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
}

/**
 * ¿Tiene algo que abrir en la plataforma (`/sistema`)? Es lo que decide el
 * enlace «Plataforma» del canal: el nivel administrador, quien tiene alguna
 * pantalla del panel o alguna casilla `sistema:*` con ver. El personal de planta,
 * que solo tiene el canal y sus lecciones, no lo ve.
 */
export function tienePlataforma(sesion: Sesion | null | undefined): boolean {
  if (!sesion) return false
  if (sesion.rol.nivel === 'admin') return true
  if (inicioDelPanel(sesion)) return true
  return Object.entries(sesion.permisos).some(([recurso, p]) => recurso.startsWith('sistema:') && p.ver)
}

/** Las secciones del Portal planta que se prenden y se apagan desde el admin (`canal_modulos`, 24-nov-2026). */
export type SeccionPortal = 'tareas' | 'grupos' | 'mensajes' | 'gente' | 'adiestramiento' | 'avisos'

/**
 * Las secciones encendidas. Sin la tabla (migración sin aplicar) o si falla la lectura, todas: apagar una
 * sección es una decisión, y un error no la debe tomar por nadie.
 */
export async function seccionesActivas(): Promise<Set<SeccionPortal>> {
  const todas = new Set<SeccionPortal>(['tareas', 'grupos', 'mensajes', 'gente', 'adiestramiento', 'avisos'])
  const supabase = await createClient()
  const { data, error } = await supabase.from('canal_modulos' as never).select('clave, activo')
  if (error || !data) return todas
  for (const fila of data as { clave: SeccionPortal; activo: boolean }[]) if (!fila.activo) todas.delete(fila.clave)
  return todas
}

/** Una página de una sección apagada vuelve al inicio del portal. */
export async function requerirSeccion(...claves: SeccionPortal[]) {
  const activas = await seccionesActivas()
  if (!claves.some((c) => activas.has(c))) redirect('/canal')
}
