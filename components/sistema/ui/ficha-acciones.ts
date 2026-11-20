'use server'

import { revalidatePath } from 'next/cache'
import { requerirSesion } from '@/lib/auth'
import { leerFicha, type ResultadoAccionFicha } from '@/lib/plataforma/ficha-tipos'
import { ACCIONES_FICHA, type EntradaAccionFicha } from '@/lib/plataforma/fichas/acciones'

/**
 * La acción de servidor que ejecutan los botones y los campos editables de
 * `FichaObjeto`. Solo enruta: el manejador del tipo pide su permiso y llama a
 * la base. Solo exporta funciones async.
 */
export async function ejecutarAccionFicha(valor: string, accion: string, entrada: EntradaAccionFicha): Promise<ResultadoAccionFicha> {
  const sesion = await requerirSesion()
  const f = leerFicha(valor)
  if (!f) return { error: 'Esa ficha no es válida.' }
  const manejador = ACCIONES_FICHA[f.tipo]
  if (!manejador) return { error: 'Este tipo de objeto todavía no se edita desde la ficha.' }
  const limpio: EntradaAccionFicha = {
    valor: typeof entrada?.valor === 'string' ? entrada.valor.slice(0, 4000) : undefined,
    motivo: typeof entrada?.motivo === 'string' ? entrada.motivo.trim().slice(0, 2000) : undefined,
    fecha: typeof entrada?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entrada.fecha) ? entrada.fecha : undefined,
    param: typeof entrada?.param === 'string' ? entrada.param.slice(0, 200) : undefined,
  }
  try {
    const r = await manejador(sesion, f.id, accion, limpio)
    if (r.ok) revalidatePath('/sistema', 'layout')
    return r
  } catch (e) {
    // `redirect()` y `notFound()` viajan como excepción: se dejan pasar.
    if (e && typeof e === 'object' && 'digest' in e) throw e
    return { error: e instanceof Error ? e.message : 'No se pudo completar la acción.' }
  }
}
