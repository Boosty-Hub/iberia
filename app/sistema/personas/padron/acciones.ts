'use server'

import {
  acunarEnlacesDe,
  marcarEnlacesMandadosDe,
  mandarEnlacesDe,
  matricularFichas,
  resolverCorreccionPadron,
  type Resultado,
} from '@/lib/padron-acciones'

/**
 * Las acciones de la barra del padrón (en lote) y de la lista de correcciones.
 * Solo enrutan: cada una vuelve a pedir `modulo:empleados` · editar en
 * `lib/padron-acciones.ts`. Solo funciones async.
 */

export async function matricular(ids: string[]): Promise<Resultado> {
  return matricularFichas(ids)
}

export async function acunar(ids: string[]): Promise<Resultado> {
  return acunarEnlacesDe(ids)
}

export async function mandarPorWhatsapp(ids: string[]): Promise<Resultado> {
  return mandarEnlacesDe(ids)
}

export async function marcarMandados(ids: string[]): Promise<Resultado> {
  return marcarEnlacesMandadosDe(ids)
}

/** «Ya se le pasó», desde la lista de correcciones de arriba del padrón. */
export async function yaSeLePaso(datos: FormData): Promise<void> {
  await resolverCorreccionPadron(String(datos.get('id') ?? ''))
}
