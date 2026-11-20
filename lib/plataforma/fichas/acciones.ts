import type { Sesion } from '@/lib/auth'
import type { ResultadoAccionFicha, TipoFicha } from '@/lib/plataforma/ficha-tipos'
import { ACCIONES_ORGANIZACION } from '@/lib/plataforma/fichas/organizacion-acciones'
import { manejarDocumento, manejarProceso } from '@/lib/plataforma/fichas/procesos'

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
  proceso: manejarProceso,
  documento: manejarDocumento,
}
