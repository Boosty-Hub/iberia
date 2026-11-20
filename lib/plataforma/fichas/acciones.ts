import type { Sesion } from '@/lib/auth'
import type { ResultadoAccionFicha, TipoFicha } from '@/lib/plataforma/ficha-tipos'
import { ACCIONES_ORGANIZACION } from '@/lib/plataforma/fichas/organizacion-acciones'
import { manejarDocumento, manejarProceso } from '@/lib/plataforma/fichas/procesos'
import { manejarPadron } from '@/lib/plataforma/fichas/padron'
import { manejarActividad } from '@/lib/plataforma/fichas/programa'
import { manejarModulo } from '@/lib/plataforma/fichas/hoja-de-ruta'

/**
 * El registro de lo que se puede hacer desde una ficha, por tipo. Cada módulo
 * aporta su manejador; `ejecutarAccionFicha` (components/sistema/ui) lo busca
 * aquí. Cada manejador vuelve a pedir su permiso y llama a las funciones de la
 * base: la ficha solo dice qué botón hay, nunca decide.
 */

export type EntradaAccionFicha = { valor?: string; motivo?: string; fecha?: string; param?: string }

export type ManejadorFicha = (sesion: Sesion, id: string, accion: string, entrada: EntradaAccionFicha) => Promise<ResultadoAccionFicha>

export const ACCIONES_FICHA: Partial<Record<TipoFicha, ManejadorFicha>> = {
  ...ACCIONES_ORGANIZACION,
  // La persona: lo del padrón (`padron.*`) va a su manejador; lo de la estructura, al de Organización.
  persona: (sesion, id, accion, e) => (accion.startsWith('padron.') ? manejarPadron(sesion, id, accion, e) : ACCIONES_ORGANIZACION.persona!(sesion, id, accion, e)),
  proceso: manejarProceso,
  documento: manejarDocumento,
  // Programa: estado, fecha confirmada y nota de una actividad del calendario.
  actividad: manejarActividad,
  // Hoja de ruta: el estado de un módulo del plan.
  modulo: manejarModulo,
}
