import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirSesion } from '@/lib/auth'
import { leerTareas } from '@/components/sistema/colaboracion/datos'
import { ListaTareas, TareaRapida } from '@/components/sistema/colaboracion/tareas'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { vencida } from '@/lib/plataforma/colaboracion'
import { numero } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Tareas · Plataforma Iberia' }

/**
 * Mis tareas (Anexo E §8): lo que me toca hacer —con fecha, y las vencidas
 * primero y marcadas— y lo que les encargué a otros. Alimentan Mi día. La RLS
 * deja ver solo las que me asignaron o las que creé.
 */
export default async function TareasPage({ searchParams }: PageProps<'/sistema/tareas'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  const todas = sp.ver === 'todas'
  const tareas = await leerTareas({ abiertas: !todas })
  const mias = tareas.filter((t) => t.mia)
  const encargadas = tareas.filter((t) => !t.mia)
  const vencidas = mias.filter((t) => vencida(t)).length
  const yo = { id: sesion.userId, nombre: sesion.perfil.nombre_completo || sesion.email }
  // Las vencidas, arriba.
  const orden = (a: (typeof tareas)[number], b: (typeof tareas)[number]) => Number(vencida(b)) - Number(vencida(a))

  const chip = (activo: boolean) =>
    cn(
      'inline-flex h-8 items-center rounded-full border px-3 text-xs',
      activo ? 'border-[#2b2a28] bg-[#2b2a28] font-semibold text-white' : 'border-[var(--borde)] bg-white text-marca-700 hover:bg-marca-50'
    )

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-DIA"
        titulo="Tareas"
        migas={[{ etiqueta: 'Tareas' }]}
        descripcion={`${numero(mias.filter((t) => t.estado === 'abierta').length)} abiertas para ti${vencidas ? `, ${numero(vencidas)} vencidas` : ''}. Se crean aquí o desde la línea de tiempo de cualquier ficha.`}
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-3">
          <nav aria-label="Qué tareas ver" className="flex gap-1.5">
            <Link href="/sistema/tareas" className={chip(!todas)} aria-current={!todas ? 'page' : undefined}>
              Abiertas
            </Link>
            <Link href="/sistema/tareas?ver=todas" className={chip(todas)} aria-current={todas ? 'page' : undefined}>
              Todas
            </Link>
          </nav>
          <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="me-toca">
            <header className="border-b border-[var(--borde)] px-4 py-2.5">
              <h2 id="me-toca" className="text-[13px] font-semibold text-marca-900">
                Me toca <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[11px] text-marca-600">{mias.length}</span>
              </h2>
            </header>
            <ListaTareas tareas={[...mias].sort(orden)} vacio={todas ? 'No tienes tareas.' : 'No tienes tareas abiertas.'} />
          </section>
          <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="encargue">
            <header className="border-b border-[var(--borde)] px-4 py-2.5">
              <h2 id="encargue" className="text-[13px] font-semibold text-marca-900">
                Lo que encargué <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[11px] text-marca-600">{encargadas.length}</span>
              </h2>
            </header>
            <ListaTareas tareas={[...encargadas].sort(orden)} vacio="No le has encargado nada a nadie." />
          </section>
        </div>
        <aside className="min-w-0">
          <TareaRapida yo={yo} />
          <p className="mt-2 px-1 text-[11.5px] text-marca-500">
            Una tarea sobre un objeto —una plaza, un proceso, una requisición— se crea desde su ficha, en «Línea de tiempo › Tarea»: solo se le puede asignar a quien puede ver ese objeto.
          </p>
        </aside>
      </div>
    </>
  )
}
