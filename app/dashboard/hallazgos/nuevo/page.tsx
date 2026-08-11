import type { Metadata } from 'next'
import { FormularioHallazgo } from '@/components/formulario-hallazgo'
import { EncabezadoPagina } from '@/components/ui'
import { requerirEditor } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { crearHallazgo } from '../acciones'

export const metadata: Metadata = { title: 'Nuevo hallazgo' }

export default async function NuevoHallazgoPage({
  searchParams,
}: PageProps<'/dashboard/hallazgos/nuevo'>) {
  await requerirEditor()
  const params = await searchParams
  const supabase = await createClient()

  const uno = (k: string) => {
    const v = params[k]
    const s = Array.isArray(v) ? v[0] : v
    return s?.trim() || null
  }

  const entrevistaId = uno('entrevista')
  const segmentoId = uno('segmento')
  const cita = uno('cita')

  const [{ data: areas }, { data: entrevistas }] = await Promise.all([
    supabase.from('areas').select('id, nombre, tipo').order('orden'),
    supabase.from('entrevistas').select('id, codigo, titulo, entrevistado_nombre').order('codigo'),
  ])

  // Si el hallazgo nace de una entrevista, hereda su área como sugerencia.
  let areaId: string | null = null
  if (entrevistaId) {
    const { data } = await supabase
      .from('entrevistas')
      .select('area_id')
      .eq('id', entrevistaId)
      .maybeSingle()
    areaId = data?.area_id ?? null
  }

  return (
    <>
      <EncabezadoPagina
        rotulo="Insumo de la arquitectura"
        titulo="Nuevo hallazgo"
        descripcion={
          cita
            ? 'La cita viene del turno que marcaste en la transcripción. Completa el resto.'
            : 'Registra un cuello de botella, un trabajo manual o una oportunidad de IA.'
        }
      />

      <FormularioHallazgo
        accion={crearHallazgo}
        areas={areas ?? []}
        entrevistas={entrevistas ?? []}
        iniciales={{ entrevistaId, segmentoId, cita, areaId }}
        cancelarHref={
          entrevistaId ? `/dashboard/entrevistas/${entrevistaId}` : '/dashboard/hallazgos'
        }
      />
    </>
  )
}
