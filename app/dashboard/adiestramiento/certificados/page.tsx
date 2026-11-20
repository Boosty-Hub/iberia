import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/**
 * La hoja de certificados para imprimir vive ahora en Formación › Certificados.
 * Se mudó a la Plataforma Iberia: la dirección vieja redirige con sus parámetros.
 */
export default async function CertificadosViejo({ searchParams }: PageProps<'/dashboard/adiestramiento/certificados'>) {
  redirect(rutaNueva('/sistema/nucleo/formacion/certificados/imprimir', await searchParams))
}
