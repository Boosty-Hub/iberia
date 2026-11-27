import type { Sesion } from '@/lib/auth'
import { hoyCaracas, leerAgenda } from '@/lib/plataforma/agenda'
import { AvisoMicrosoft, ItemAgenda, diaDe } from './piezas'

/** Las tareas de Microsoft To Do en Tareas (27-nov-2026). Nada si el rol no tiene Microsoft 365 o no está configurado. */
export async function TareasDeTodo({ sesion }: { sesion: Sesion }) {
  const hoy = hoyCaracas()
  const agenda = await leerAgenda(sesion, hoy, hoy, { conTodo: true, conEventos: false })
  const estado = agenda.microsoft.estado
  if (estado === 'sin-alcance' || estado === 'sin-configurar') return null
  const tareas = agenda.todo.tareas
  return (
    <section className="mt-3 min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="tareas-todo" data-tareas-todo>
      <header className="flex items-center gap-2 border-b border-[var(--borde)] px-4 py-2.5">
        <span className="inline-grid h-3 w-3 grid-cols-2 gap-px" aria-hidden>
          <span className="bg-[#f25022]" />
          <span className="bg-[#7fba00]" />
          <span className="bg-[#00a4ef]" />
          <span className="bg-[#ffb900]" />
        </span>
        <h2 id="tareas-todo" className="text-[13px] font-semibold text-marca-900">
          Microsoft To Do {agenda.todo.estado === 'ok' && <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[11px] text-marca-600">{tareas.length}</span>}
        </h2>
      </header>
      <div className="p-2.5 empty:hidden">
        <AvisoMicrosoft agenda={agenda} />
      </div>
      {agenda.todo.estado === 'ok' &&
        (tareas.length ? (
          <ul className="flex flex-col gap-1.5 p-2.5">
            {tareas.slice(0, 30).map((t) => {
              const v = t.vence ? diaDe(t.vence) : null
              return (
                <li key={t.id}>
                  <ItemAgenda item={{ tipo: 'todo', t }} />
                  {v && (
                    <span className={t.vence! < hoy ? 'px-1 text-[11px] font-medium text-acento-700' : 'px-1 text-[11px] text-marca-500'}>
                      {t.vence! < hoy ? 'Venció' : 'Vence'} el {v.semana} {v.numero} {v.mes}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-4 pb-4 text-center text-[12.5px] text-marca-400">No tienes tareas abiertas en Microsoft To Do.</p>
        ))}
      <p className="border-t border-[var(--borde)] px-4 py-2 text-[11px] text-marca-400">Se leen en vivo de tu Microsoft 365 y se cambian en To Do.</p>
    </section>
  )
}
