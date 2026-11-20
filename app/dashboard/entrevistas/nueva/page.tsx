import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** Crear una sesión a mano → Levantamiento. Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard/entrevistas/nueva'>) {
  redirect(rutaNueva('/sistema/programa/levantamiento/entrevistas/nueva', await searchParams))
}
