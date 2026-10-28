/**
 * El calendario de la Fase 2 y de New Iberia (`/dashboard/calendario`): el
 * vocabulario de la tabla `calendario_actividades`. Las claves espejan los
 * `CHECK` de la migración `calendario`; los valores son lo que se ve.
 *
 * Salió del HTML que Gabriel armó el 28 de octubre de 2026 con la conversación
 * del 27 con el señor Carlos y las dos propuestas de octubre. Los colores de los
 * frentes son los de ese HTML: son categorías, no la marca, y el rojo de Iberia
 * queda para la acción.
 *
 * Este archivo no importa nada del servidor: lo usa también la vista, que corre
 * en el navegador.
 */

export type Frente =
  | 'coordinacion'
  | 'activacion'
  | 'acompanamiento'
  | 'procesos'
  | 'desempeno'
  | 'gestion_organizacional'
  | 'estructura'
  | 'tecnologia'

/** En el orden de la línea de tiempo. */
export const FRENTES: { clave: Frente; nombre: string; color: string }[] = [
  { clave: 'coordinacion', nombre: 'Coordinación', color: '#8A96A3' },
  { clave: 'activacion', nombre: 'Activación', color: '#2E8B85' },
  { clave: 'acompanamiento', nombre: 'Acompañamiento', color: '#2D4868' },
  { clave: 'procesos', nombre: 'Procesos', color: '#5BA9A3' },
  { clave: 'desempeno', nombre: 'Desempeño', color: '#7A6CC0' },
  { clave: 'gestion_organizacional', nombre: 'Gestión Organizacional', color: '#B5648A' },
  { clave: 'estructura', nombre: 'Estructura', color: '#9DB21F' },
  { clave: 'tecnologia', nombre: 'Tecnología', color: '#2F6FB3' },
]

export const FRENTE = Object.fromEntries(FRENTES.map((f) => [f.clave, f])) as Record<
  Frente,
  (typeof FRENTES)[number]
>

export type TipoActividad = 'actividad' | 'reunion' | 'entregable' | 'hito'

export const TIPOS_ACTIVIDAD: Record<TipoActividad, string> = {
  actividad: 'Actividad',
  reunion: 'Reunión',
  entregable: 'Entregable',
  hito: 'Hito',
}

export type EstadoActividad = 'por_agendar' | 'por_confirmar' | 'agendado' | 'en_curso' | 'hecho'

/** El color va en el punto de la etiqueta: el estado se lee por el nombre, y el punto lo ubica en la leyenda. */
export const ESTADOS_ACTIVIDAD: Record<EstadoActividad, { nombre: string; color: string }> = {
  por_agendar: { nombre: 'Por agendar', color: '#8A96A3' },
  por_confirmar: { nombre: 'Por confirmar', color: '#C98A12' },
  agendado: { nombre: 'Agendado', color: '#2F6FB3' },
  en_curso: { nombre: 'En curso', color: '#2E8B85' },
  hecho: { nombre: 'Hecho', color: '#3D8B4A' },
}

export type Actividad = {
  id: string
  titulo: string
  detalle: string
  frente: Frente
  tipo: TipoActividad
  estado: EstadoActividad
  inicio: string
  fin: string | null
  fecha_confirmada: string | null
  responsable: string
  participantes: string
  nota: string
  orden: number
}

/** La ventana de la línea de tiempo: de octubre de 2026 a octubre de 2027, trece meses. */
export const VENTANA = { desde: '2026-10-01', hasta: '2027-11-01' }

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
export const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** `YYYY-MM-DD` a días desde 1970, sin pasar por la zona horaria del navegador. */
export function dia(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5
}

/** «4 nov», o «4 nov 26» si hace falta el año. */
export function fechaCorta(iso: string, conAnio = false): string {
  const texto = `${+iso.slice(8, 10)} ${MESES_CORTOS[+iso.slice(5, 7) - 1]}`
  return conAnio ? `${texto} ${iso.slice(2, 4)}` : texto
}

/** «4 nov – 13 nov», o una sola fecha si empieza y termina el mismo día. */
export function rango(a: Pick<Actividad, 'inicio' | 'fin'>): string {
  const conAnio = Boolean(a.fin && a.fin.slice(0, 4) !== a.inicio.slice(0, 4))
  const desde = fechaCorta(a.inicio, conAnio)
  return a.fin && a.fin !== a.inicio ? `${desde} – ${fechaCorta(a.fin, conAnio)}` : desde
}

/** Los rombos de la línea de tiempo: lo que se entrega o marca un antes y un después. */
export function esHito(tipo: TipoActividad): boolean {
  return tipo === 'hito' || tipo === 'entregable'
}

/**
 * Las personas de «responsable», una por una: «Carlos y Gabriel» son dos. Es lo
 * que llena el filtro de la agenda.
 */
export function responsables(actividades: Pick<Actividad, 'responsable'>[]): string[] {
  const nombres = new Set<string>()
  for (const a of actividades) {
    for (const n of a.responsable.split(/,| y /)) if (n.trim()) nombres.add(n.trim())
  }
  return [...nombres].sort((x, y) => x.localeCompare(y, 'es'))
}
