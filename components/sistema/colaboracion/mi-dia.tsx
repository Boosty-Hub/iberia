import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_NOTIFICACION, aNotificacion, leerTareas } from '@/components/sistema/colaboracion/datos'
import { ListaNotificaciones } from '@/components/sistema/colaboracion/lista-notificaciones'
import { ListaTareas } from '@/components/sistema/colaboracion/tareas'
import { vencida } from '@/lib/plataforma/colaboracion'

/**
 * Lo de trabajo en equipo en Mi día: mis tareas abiertas (las vencidas arriba y
 * marcadas) y las últimas veces que me mencionaron. Se lee con la sesión de
 * quien mira.
 */
export async function MiDiaColaboracion() {
  const supabase = await createClient()
  const [tareas, { data: menciones }] = await Promise.all([
    leerTareas({ abiertas: true, limite: 50 }),
    supabase.schema('nucleo').from('notificacion').select(COLUMNAS_NOTIFICACION).eq('tipo', 'mencion').order('creado_en', { ascending: false }).range(0, 4),
  ])
  const mias = tareas.filter((t) => t.mia).sort((a, b) => Number(vencida(b)) - Number(vencida(a)))
  const vencidas = mias.filter((t) => vencida(t)).length
  const lista = (menciones ?? []).map(aNotificacion)

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="mis-tareas">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--borde)] px-4 py-2.5">
          <h2 id="mis-tareas" className="text-[13px] font-semibold text-marca-900">
            Mis tareas <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[11px] text-marca-600">{mias.length}</span>
            {vencidas > 0 && <span className="ml-2 text-[11.5px] font-semibold text-[#a3241f]">⚠ {vencidas} vencida{vencidas === 1 ? '' : 's'}</span>}
          </h2>
          <Link href="/sistema/tareas" className="text-xs font-semibold text-acento-700 hover:underline">
            Tareas
          </Link>
        </header>
        <ListaTareas tareas={mias.slice(0, 6)} compacta vacio="No tienes tareas abiertas. Se crean desde la línea de tiempo de cualquier ficha o en Tareas." />
        {mias.length > 6 && (
          <Link href="/sistema/tareas" className="block border-t border-[#eef0f3] px-4 py-2 text-center text-xs text-marca-600 hover:bg-marca-50">
            y {mias.length - 6} más
          </Link>
        )}
      </section>

      <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="menciones">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--borde)] px-4 py-2.5">
          <h2 id="menciones" className="text-[13px] font-semibold text-marca-900">
            Menciones
          </h2>
          <Link href="/sistema/notificaciones?tipo=mencion" className="text-xs font-semibold text-acento-700 hover:underline">
            Todas
          </Link>
        </header>
        {lista.length ? (
          <ListaNotificaciones lista={lista} />
        ) : (
          <p className="px-4 py-6 text-center text-[12.5px] text-marca-400">Nadie te ha mencionado todavía. Cuando alguien escriba @ con tu nombre en una ficha, sale aquí.</p>
        )}
      </section>
    </div>
  )
}
