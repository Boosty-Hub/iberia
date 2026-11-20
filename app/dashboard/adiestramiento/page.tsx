import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/**
 * El adiestramiento (curso de Ajito) vive ahora en Formación (NUC-FOR).
 * Se mudó a la Plataforma Iberia: la dirección vieja redirige con sus parámetros.
 */
export default async function AdiestramientoViejo({ searchParams }: PageProps<'/dashboard/adiestramiento'>) {
  redirect(rutaNueva('/sistema/nucleo/formacion', await searchParams))
}
