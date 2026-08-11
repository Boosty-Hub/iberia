import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras, IconoBasura } from '@/components/iconos'
import { EditorSeccion } from '@/components/editor-seccion'
import { Insignia } from '@/components/ui'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PARTES_INFORME, type ParteInforme } from '@/lib/types'
import { actualizarSeccion, eliminarSeccion } from '../acciones'

export async function generateMetadata({
  params,
}: PageProps<'/dashboard/informe/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('informe_secciones')
    .select('titulo')
    .eq('slug', slug)
    .maybeSingle()

  return { title: data?.titulo ?? 'Sección del informe' }
}

export default async function EditarSeccionPage({
  params,
}: PageProps<'/dashboard/informe/[slug]'>) {
  await requerirEditor()
  const { slug } = await params
  const supabase = await createClient()

  const { data: seccion } = await supabase
    .from('informe_secciones')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (!seccion) notFound()

  return (
    <>
      <Link
        href="/dashboard/informe"
        className="mb-4 inline-flex items-center gap-1 text-sm text-marca-500 hover:text-acento-700"
      >
        <IconoAtras className="h-4 w-4" />
        Editor del informe
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo mb-2">
            {PARTES_INFORME[seccion.parte as ParteInforme]}
            {seccion.numero && ` · ${seccion.numero}`}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-marca-800">
            {seccion.titulo}
          </h1>
          <p className="mt-1 font-mono text-xs text-marca-400">/informe#{seccion.slug}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Insignia tono={seccion.publicado ? 'verde' : 'ambar'}>
            {seccion.publicado ? 'Publicada' : 'Borrador'}
          </Insignia>

          <form action={eliminarSeccion}>
            <input type="hidden" name="id" value={seccion.id} />
            <button type="submit" className="btn-peligro">
              <IconoBasura className="h-4 w-4" />
              Eliminar
            </button>
          </form>
        </div>
      </div>

      <EditorSeccion
        accion={actualizarSeccion}
        seccion={seccion}
        cancelarHref="/dashboard/informe"
      />
    </>
  )
}
