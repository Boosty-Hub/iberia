import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaHora } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { ArchivosProyecto, EditarProyecto } from '@/components/sistema/asistente/f3-formularios'

export const metadata: Metadata = { title: 'Proyecto · Asistente de IA' }

export default async function ProyectoPage({ params }: PageProps<'/sistema/asistente/proyectos/[id]'>) {
  const [sesion, { id }] = await Promise.all([requerirPermiso('sistema:asistente'), params])
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound()
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: p }, { data: chats }, { data: archivos }] = await Promise.all([
    db.from('proyecto').select('id, nombre, instrucciones').eq('id', id).eq('dueno', sesion.userId).maybeSingle(),
    db.from('chat').select('id, titulo, actualizado_en').eq('proyecto_id', id).order('actualizado_en', { ascending: false }),
    db.from('archivo').select('id, nombre, bytes').eq('proyecto_id', id).eq('estado', 'listo').order('creado_en', { ascending: false }),
  ])
  if (!p) notFound()

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" migas={[{ etiqueta: 'Proyectos', href: '/sistema/asistente/proyectos' }, { etiqueta: p.nombre }]} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <EditarProyecto id={p.id} nombre={p.nombre} instrucciones={p.instrucciones} />
        <div className="flex flex-col gap-3">
          <ArchivosProyecto proyectoId={p.id} archivos={(archivos ?? []).map((a) => ({ id: a.id, nombre: a.nombre, bytes: Number(a.bytes) }))} />
          <section className="rounded-xl border border-[var(--borde)] bg-white">
            <header className="border-b border-[var(--borde)] px-4 py-2.5">
              <h2 className="text-[13px] font-semibold text-marca-900">Chats del proyecto</h2>
            </header>
            <ul className="px-4 py-2 text-[13px]">
              {(chats ?? []).map((c) => (
                <li key={c.id} className="flex items-center gap-2 border-b border-[var(--borde)] py-1.5 last:border-0">
                  <Link href={`/sistema/asistente/c/${c.id}`} className="min-w-0 flex-1 truncate text-marca-800 hover:underline">
                    {c.titulo}
                  </Link>
                  <span className="text-[11.5px] text-marca-400">{fechaHora(c.actualizado_en)}</span>
                </li>
              ))}
              {!(chats ?? []).length && <li className="py-2 text-[12.5px] text-marca-400">Sin chats todavía.</li>}
            </ul>
          </section>
        </div>
      </div>
    </>
  )
}
