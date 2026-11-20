import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** Importar de Fireflies → Levantamiento. Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard/entrevistas/importar'>) {
  redirect(rutaNueva('/sistema/programa/levantamiento/entrevistas/importar', await searchParams))
}
