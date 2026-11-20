import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** Las entrevistas → Levantamiento › Entrevistas (los filtros pasan a chips). Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard/entrevistas'>) {
  redirect(rutaNueva('/sistema/programa/levantamiento/entrevistas', await searchParams, { estado: 'f.estado', area: 'f.area_id', sede: 'f.sede', tipo: 'f.tipo' }))
}
