import { redirect } from 'next/navigation'

/**
 * El formulario de borrador de la Etapa 1 se retiró: el borrador se edita en la
 * ficha (panel o página completa), campo por campo. Los enlaces viejos llegan a
 * la ficha.
 */
export default async function EditarProcesoPage({ params }: PageProps<'/sistema/nucleo/procesos/[ref]/editar'>) {
  const { ref } = await params
  redirect(`/sistema/nucleo/procesos/${ref}`)
}
