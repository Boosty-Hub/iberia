import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** El calendario → Plan y seguimiento › Calendario. Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard/calendario'>) {
  redirect(rutaNueva('/sistema/programa/calendario', await searchParams))
}
