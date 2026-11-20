import { redirect } from 'next/navigation'

/** Se mudó a la administración única de la plataforma (20-nov-2026). */
export default async function Redireccion({ params }: PageProps<'/dashboard/roles/[id]'>) {
  const { id } = await params
  redirect(`/sistema/administracion/roles/${id}`)
}
