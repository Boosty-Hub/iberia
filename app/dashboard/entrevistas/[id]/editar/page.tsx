import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** Editar una sesión → Levantamiento. Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ params, searchParams }: PageProps<'/dashboard/entrevistas/[id]/editar'>) {
  const { id } = await params
  redirect(rutaNueva(`/sistema/programa/levantamiento/entrevistas/${id}/editar`, await searchParams))
}
