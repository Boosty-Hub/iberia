import { leerLinea } from '@/components/sistema/colaboracion/datos'
import { LineaTiempoCliente } from '@/components/sistema/colaboracion/linea-tiempo-cliente'

/**
 * La línea de tiempo de cualquier objeto (R3): comentarios con @menciones y
 * respuestas, seguir, tareas sobre el objeto, decisiones de aprobación, cambios
 * de la auditoría con su antes y después, y la IA con su nivel (N1–N4).
 *
 * API estable para las fichas:
 *
 *   // En una página o componente de servidor:
 *   <LineaTiempo tipo="plaza" id={ref} />
 *
 *   // En un componente de cliente (pide los datos al montar):
 *   <LineaTiempoCliente tipo="plaza" id={ref} />
 *
 * `tipo`: unidad · plaza · cargo · persona · requisicion · escenario · proceso ·
 * documento. `id`: el de la ficha (`ref` en unidad, plaza y proceso; `id` en lo
 * demás). Quién la ve lo decide la base (`nucleo.puede_ver_objeto`).
 * `FichaObjeto` ya la pinta en su pestaña «Línea de tiempo»: no hace falta pasar
 * la ranura.
 */
export async function LineaTiempo({ tipo, id }: { tipo: string; id: string }) {
  const datos = await leerLinea(tipo, id)
  return <LineaTiempoCliente key={`${tipo}:${id}`} tipo={tipo} id={id} inicial={datos} />
}

export { LineaTiempoCliente }
