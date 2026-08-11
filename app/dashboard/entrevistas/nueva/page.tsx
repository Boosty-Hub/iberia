import type { Metadata } from 'next'
import { FormularioEntrevista } from '@/components/formulario-entrevista'
import { EncabezadoPagina } from '@/components/ui'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { crearEntrevista } from '../acciones'

export const metadata: Metadata = { title: 'Nueva entrevista' }

export default async function NuevaEntrevistaPage() {
  await requerirEditor()
  const supabase = await createClient()

  const { data: areas } = await supabase.from('areas').select('id, nombre, tipo').order('orden')

  return (
    <>
      <EncabezadoPagina
        rotulo="Corriente B · Diagnóstico"
        titulo="Nueva entrevista"
        descripcion="Registra la entrevista con sus datos básicos. La transcripción de Fireflies se importa después, desde el detalle."
      />

      <FormularioEntrevista
        accion={crearEntrevista}
        areas={areas ?? []}
        cancelarHref="/dashboard/entrevistas"
      />
    </>
  )
}
