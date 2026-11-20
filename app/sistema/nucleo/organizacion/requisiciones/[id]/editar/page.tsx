import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { IconoAtras } from '@/components/iconos'
import { datosFormularioRequisicion } from '@/components/sistema/flujo/datos'
import { ordenarArbol } from '@/components/sistema/flujo/estructura'
import { hoyCaracas } from '@/components/sistema/flujo/formato'
import { FormularioRequisicion, type RequisicionInicial } from '@/components/sistema/flujo/formulario-requisicion'
import { Aviso, EncabezadoPagina } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Corregir requisición' }

/** Corregir un borrador o una requisición devuelta. Lo enviado no se toca. */
export default async function EditarRequisicionPage({ params }: PageProps<'/sistema/nucleo/organizacion/requisiciones/[id]/editar'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('sistema:requisiciones', 'crear'), params])
  const supabase = await createClient()
  const { data: q } = await supabase.schema('org').from('requisicion').select('*').eq('id', id).maybeSingle()
  if (!q) notFound()
  const propia = q.creado_por === sesion.userId
  if (!['borrador', 'devuelta'].includes(q.estado) || !(propia || puede(sesion, 'sistema:requisiciones', 'editar'))) {
    redirect(`/sistema/nucleo/organizacion/requisiciones/${id}`)
  }
  const hoy = hoyCaracas()
  const [datos, ocupantes] = await Promise.all([
    datosFormularioRequisicion(supabase, hoy),
    q.origen.startsWith('vacante') ? supabase.schema('org').rpc('ocupantes_de_unidad', { p_unidad: q.unidad_ref }) : null,
  ])

  return (
    <>
      <Link href={`/sistema/nucleo/organizacion/requisiciones/${id}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Requisición N.º {q.numero}
      </Link>
      <EncabezadoPagina rotulo="Requisición de personal · II-21-40-001" titulo={`Corregir la requisición N.º ${q.numero}`} />
      {q.estado === 'devuelta' && <Aviso tono="ambar">Te la devolvieron. Corrige lo que te pidieron y vuelve a enviarla desde su página.</Aviso>}
      <FormularioRequisicion
        {...datos}
        unidades={ordenarArbol(datos.unidades)}
        puedeCrearCargo={puede(sesion, 'sistema:estructura', 'crear')}
        inicial={q as unknown as RequisicionInicial}
        ocupantesIniciales={(ocupantes?.data ?? []).map((o) => ({ plaza_ref: o.plaza_ref, cargo: o.cargo, empleado_id: o.empleado_id, nombre: o.nombre }))}
        hoy={hoy}
      />
    </>
  )
}
