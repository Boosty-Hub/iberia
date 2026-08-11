import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { FormularioEntrevista } from '@/components/formulario-entrevista'
import { EncabezadoPagina } from '@/components/ui'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { actualizarEntrevista } from '../../acciones'

export const metadata: Metadata = { title: 'Editar entrevista' }

export default async function EditarEntrevistaPage({
  params,
}: PageProps<'/dashboard/entrevistas/[id]/editar'>) {
  await requerirEditor()
  const { id } = await params
  const supabase = await createClient()

  const [{ data: entrevista }, { data: areas }] = await Promise.all([
    supabase.from('entrevistas').select('*').eq('id', id).maybeSingle(),
    supabase.from('areas').select('id, nombre, tipo').order('orden'),
  ])

  if (!entrevista) notFound()

  return (
    <>
      <EncabezadoPagina
        rotulo={entrevista.codigo}
        titulo="Editar entrevista"
        descripcion={`Datos del levantamiento de ${entrevista.entrevistado_nombre}.`}
      />

      <FormularioEntrevista
        accion={actualizarEntrevista}
        areas={areas ?? []}
        entrevista={entrevista}
        cancelarHref={`/dashboard/entrevistas/${id}`}
      />
    </>
  )
}
