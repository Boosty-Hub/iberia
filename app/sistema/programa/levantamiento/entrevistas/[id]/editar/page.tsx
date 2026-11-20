import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { nombreSesion } from '@/lib/utils'
import { FormularioEntrevista } from '@/components/formulario-entrevista'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { actualizarEntrevista } from '../../acciones'

export const metadata: Metadata = { title: 'Editar sesión · Levantamiento' }

/** PRG-LEV · Editar los datos de una sesión (`modulo:entrevistas` · editar). */
export default async function EditarSesionPage({ params }: PageProps<'/sistema/programa/levantamiento/entrevistas/[id]/editar'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('modulo:entrevistas', 'editar'), params])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const [{ data: entrevista }, { data: areas }] = await Promise.all([
    supabase.from('entrevistas').select('*').eq('id', id).maybeSingle(),
    supabase.from('areas').select('id, nombre, tipo').order('orden'),
  ])
  if (!entrevista) notFound()

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="PRG-LEV"
        titulo="Editar la sesión"
        migas={[
          { etiqueta: 'Entrevistas', href: '/sistema/programa/levantamiento/entrevistas' },
          { etiqueta: entrevista.codigo, href: `/sistema/programa/levantamiento/entrevistas/${id}` },
          { etiqueta: 'Editar' },
        ]}
        descripcion={`Datos del levantamiento de ${nombreSesion(entrevista)}.`}
      />
      <div className="max-w-4xl">
        <FormularioEntrevista accion={actualizarEntrevista} areas={areas ?? []} entrevista={entrevista} cancelarHref={`/sistema/programa/levantamiento/entrevistas/${id}`} />
      </div>
    </>
  )
}
