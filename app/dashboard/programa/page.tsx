import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** «Consumos y línea de tiempo» → Plan y seguimiento › Consumos. Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard/programa'>) {
  redirect(rutaNueva('/sistema/programa/consumos', await searchParams))
}
