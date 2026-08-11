import type { Metadata } from 'next'
import Link from 'next/link'
import { ImportarEntrevistas } from '@/components/importar-entrevistas'
import { EncabezadoPagina } from '@/components/ui'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Importar entrevistas' }

export default async function ImportarEntrevistasPage() {
  await requerirEditor()
  const supabase = await createClient()

  const { data: areas } = await supabase.from('areas').select('id, nombre, slug, tipo').order('orden')

  return (
    <>
      <EncabezadoPagina
        rotulo="Corriente B · Diagnóstico"
        titulo="Importar entrevistas"
        descripcion="Carga los archivos de Fireflies y el sistema arma cada entrevista: entrevistado, cargo, área, sede, fecha, duración, resumen y transcripción completa."
        acciones={
          <Link href="/dashboard/entrevistas/nueva" className="btn-neutro">
            Crear a mano
          </Link>
        }
      />

      <ImportarEntrevistas areas={areas ?? []} />
    </>
  )
}
