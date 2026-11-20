import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/**
 * El empujón vive ahora en Formación › Recordatorios.
 * Se mudó a la Plataforma Iberia: la dirección vieja redirige con sus parámetros.
 */
export default async function RecordatoriosViejo({ searchParams }: PageProps<'/dashboard/adiestramiento/recordatorios'>) {
  redirect(rutaNueva('/sistema/nucleo/formacion/recordatorios', await searchParams))
}
