import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** Una sesión → su página en Levantamiento. Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ params, searchParams }: PageProps<'/dashboard/entrevistas/[id]'>) {
  const { id } = await params
  redirect(rutaNueva(`/sistema/programa/levantamiento/entrevistas/${id}`, await searchParams))
}
