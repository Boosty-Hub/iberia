import { redirect } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'

/**
 * La página del cargo de la Etapa 1 se retiró en R1: el cargo se trabaja en su
 * ficha, sobre la tabla del catálogo. Los enlaces viejos llegan allá.
 */
export default async function CargoPage({ params }: PageProps<'/sistema/nucleo/organizacion/cargos/[id]'>) {
  const [, { id }] = await Promise.all([requerirPermiso('sistema:estructura'), params])
  redirect(/^[0-9a-f-]{36}$/i.test(id) ? `/sistema/nucleo/organizacion/cargos?ficha=cargo:${id}` : '/sistema/nucleo/organizacion/cargos')
}
