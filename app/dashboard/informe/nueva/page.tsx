import type { Metadata } from 'next'
import { EditorSeccion } from '@/components/editor-seccion'
import { EncabezadoPagina } from '@/components/ui'
import { requerirEditor } from '@/lib/auth'
import { crearSeccion } from '../acciones'

export const metadata: Metadata = { title: 'Nueva sección' }

export default async function NuevaSeccionPage() {
  await requerirEditor()

  return (
    <>
      <EncabezadoPagina
        rotulo="Entregable de cierre · Fase 1"
        titulo="Nueva sección del informe"
        descripcion="Se crea como borrador: no aparece en el informe hasta que la publiques."
      />

      <EditorSeccion accion={crearSeccion} cancelarHref="/dashboard/informe" />
    </>
  )
}
