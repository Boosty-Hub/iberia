import { redirect } from 'next/navigation'

/**
 * Se mudó a la plataforma: Canal › Moderación (NUC-CAN, 20-nov-2026). Conserva
 * la vista de revisados.
 */
export default async function Redireccion({ searchParams }: PageProps<'/dashboard/reportes'>) {
  const sp = await searchParams
  redirect(sp.estado === 'revisado' ? '/sistema/nucleo/canal/moderacion?estado=revisado' : '/sistema/nucleo/canal/moderacion')
}
