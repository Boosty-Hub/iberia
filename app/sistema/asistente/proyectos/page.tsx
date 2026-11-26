import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaHora, numero } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { NuevoProyecto } from '@/components/sistema/asistente/f3-formularios'

export const metadata: Metadata = { title: 'Proyectos · Asistente de IA' }

/** Proyectos (fase 3): chats agrupados con instrucciones y archivos fijos. Son de su dueño. */
export default async function ProyectosPage() {
  const sesion = await requerirPermiso('sistema:asistente')
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: proyectos }, { data: chats }, { data: archivos }] = await Promise.all([
    db.from('proyecto').select('id, nombre, instrucciones, actualizado_en').eq('dueno', sesion.userId).order('actualizado_en', { ascending: false }),
    db.from('chat').select('proyecto_id').eq('dueno', sesion.userId).not('proyecto_id', 'is', null),
    db.from('archivo').select('proyecto_id').eq('dueno', sesion.userId).not('proyecto_id', 'is', null),
  ])
  const cuenta = (xs: { proyecto_id: string | null }[] | null, id: string) => (xs ?? []).filter((x) => x.proyecto_id === id).length

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" migas={[{ etiqueta: 'Proyectos' }]} descripcion="Agrupa tus chats con instrucciones y archivos fijos: el asistente los tiene en cada chat del proyecto." />
      <div className="mb-4">
        <NuevoProyecto />
      </div>
      {(proyectos ?? []).length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--borde)] bg-white px-4 py-8 text-center text-[13px] text-marca-500">Todavía no tienes proyectos.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(proyectos ?? []).map((p) => (
            <Link key={p.id} href={`/sistema/asistente/proyectos/${p.id}`} className="rounded-xl border border-[var(--borde)] bg-white p-4 hover:border-marca-300">
              <p className="text-[14px] font-semibold text-marca-900">{p.nombre}</p>
              <p className="mt-1 line-clamp-2 min-h-[2.5em] text-[12.5px] text-marca-500">{p.instrucciones || 'Sin instrucciones.'}</p>
              <p className="mt-2 text-[11.5px] text-marca-400">
                {numero(cuenta(chats, p.id))} chats · {numero(cuenta(archivos, p.id))} archivos · {fechaHora(p.actualizado_en)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
