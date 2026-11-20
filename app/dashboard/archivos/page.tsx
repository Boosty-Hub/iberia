import { redirect } from 'next/navigation'
import { rutaNueva } from '@/lib/plataforma/redireccion'

/** El expediente → Levantamiento › Archivos (los filtros pasan a chips). Se mudó a la plataforma (20-nov-2026); los parámetros viajan. */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard/archivos'>) {
  redirect(rutaNueva('/sistema/programa/levantamiento/archivos', await searchParams, { categoria: 'f.categoria', area: 'f.area_id' }))
}
