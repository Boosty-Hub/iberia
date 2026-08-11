import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras, IconoBasura } from '@/components/iconos'
import { FormularioHallazgo } from '@/components/formulario-hallazgo'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  ESTADOS_HALLAZGO,
  NIVELES,
  TIPOS_HALLAZGO,
  type EstadoHallazgo,
  type Nivel,
  type TipoHallazgo,
} from '@/lib/types'
import { actualizarHallazgo, eliminarHallazgo } from '../acciones'

export async function generateMetadata({
  params,
}: PageProps<'/dashboard/hallazgos/[id]'>): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('hallazgos').select('titulo').eq('id', id).maybeSingle()
  return { title: data?.titulo ?? 'Hallazgo' }
}

const TONO_ESTADO: Record<EstadoHallazgo, 'ambar' | 'verde' | 'neutro'> = {
  propuesto: 'ambar',
  validado: 'verde',
  descartado: 'neutro',
}

export default async function HallazgoPage({ params }: PageProps<'/dashboard/hallazgos/[id]'>) {
  const [{ perfil }, { id }] = await Promise.all([requerirSesion(), params])
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const { data: hallazgo } = await supabase
    .from('hallazgos')
    .select('*, areas(nombre), entrevistas(id, codigo, entrevistado_nombre)')
    .eq('id', id)
    .maybeSingle()

  if (!hallazgo) notFound()

  const [{ data: areas }, { data: entrevistas }] = await Promise.all([
    supabase.from('areas').select('id, nombre, tipo').order('orden'),
    supabase.from('entrevistas').select('id, codigo, titulo, entrevistado_nombre').order('codigo'),
  ])

  return (
    <>
      <Link
        href="/dashboard/hallazgos"
        className="mb-4 inline-flex items-center gap-1 text-sm text-marca-500 hover:text-acento-700"
      >
        <IconoAtras className="h-4 w-4" />
        Hallazgos
      </Link>

      {/* Los lectores ven la ficha; los editores el formulario. */}
      {!puedeEditar ? (
        <>
          <EncabezadoPagina
            rotulo={TIPOS_HALLAZGO[hallazgo.tipo as TipoHallazgo]}
            titulo={hallazgo.titulo}
          />

          <div className="mb-5 flex flex-wrap gap-1.5">
            <Insignia tono={TONO_ESTADO[hallazgo.estado as EstadoHallazgo]}>
              {ESTADOS_HALLAZGO[hallazgo.estado as EstadoHallazgo]}
            </Insignia>
            {hallazgo.impacto && (
              <Insignia tono="marca">
                Impacto {NIVELES[hallazgo.impacto as Nivel].toLowerCase()}
              </Insignia>
            )}
            {hallazgo.esfuerzo && (
              <Insignia tono="neutro">
                Esfuerzo {NIVELES[hallazgo.esfuerzo as Nivel].toLowerCase()}
              </Insignia>
            )}
            {hallazgo.areas?.nombre && <Insignia tono="neutro">{hallazgo.areas.nombre}</Insignia>}
          </div>

          {hallazgo.descripcion && (
            <section className="tarjeta mb-4 p-5">
              <h2 className="mb-2 text-sm font-semibold text-marca-800">Descripción</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-marca-700">
                {hallazgo.descripcion}
              </p>
            </section>
          )}

          {hallazgo.cita_textual && (
            <section className="tarjeta p-5">
              <h2 className="mb-2 text-sm font-semibold text-marca-800">Cita que lo respalda</h2>
              <blockquote className="border-l-2 border-acento-400 bg-acento-50/60 py-2 pl-4 text-sm text-marca-700 italic">
                {hallazgo.cita_textual}
              </blockquote>
              {hallazgo.entrevistas && (
                <Link
                  href={`/dashboard/entrevistas/${hallazgo.entrevistas.id}`}
                  className="mt-3 inline-block text-xs text-acento-700 hover:underline"
                >
                  {hallazgo.entrevistas.codigo} · {hallazgo.entrevistas.entrevistado_nombre} →
                </Link>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="rotulo mb-2">{TIPOS_HALLAZGO[hallazgo.tipo as TipoHallazgo]}</p>
              <h1 className="text-2xl font-bold tracking-tight text-marca-800">
                Editar hallazgo
              </h1>
              {hallazgo.entrevistas && (
                <Link
                  href={`/dashboard/entrevistas/${hallazgo.entrevistas.id}`}
                  className="mt-1 inline-block text-sm text-acento-700 hover:underline"
                >
                  De {hallazgo.entrevistas.codigo} · {hallazgo.entrevistas.entrevistado_nombre}
                </Link>
              )}
            </div>

            <form action={eliminarHallazgo} className="shrink-0">
              <input type="hidden" name="id" value={id} />
              <button type="submit" className="btn-peligro">
                <IconoBasura className="h-4 w-4" />
                Eliminar
              </button>
            </form>
          </div>

          <FormularioHallazgo
            accion={actualizarHallazgo}
            areas={areas ?? []}
            entrevistas={entrevistas ?? []}
            hallazgo={hallazgo}
            cancelarHref="/dashboard/hallazgos"
          />
        </>
      )}
    </>
  )
}
