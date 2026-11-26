import Link from 'next/link'
import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { describirFrecuencia, fechaCaracas, type Frecuencia } from '@/lib/asistente/tipos'

/**
 * «Mis tableros» en Mi día (fase 5): los tableros vivos y las tareas que la
 * persona fijó, con la fecha de sus datos. Solo lo propio; con «ver como», nada.
 */
export async function MisTableros({ sesion }: { sesion: Sesion }) {
  if (sesion.vistaComo || !puede(sesion, 'sistema:asistente')) return null
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const { data: tareas } = await db.from('tarea').select('id, tipo, nombre, html_grupo, frecuencia, hora, dias, dia_mes, cada_horas, estado, proxima_en').eq('dueno', sesion.userId).eq('en_mi_dia', true).order('creado_en').limit(6)
  if (!tareas?.length) return null
  const grupos = tareas.map((t) => t.html_grupo).filter((g): g is string => !!g)
  const otras = tareas.filter((t) => !t.html_grupo).map((t) => t.id)
  const [{ data: versiones }, { data: corridas }] = await Promise.all([
    grupos.length ? db.from('html').select('id, grupo, version, creado_en, tipo').in('grupo', grupos).eq('dueno', sesion.userId).order('version', { ascending: false }) : Promise.resolve({ data: [] }),
    otras.length ? db.from('corrida').select('tarea_id, chat_id, terminado_en').in('tarea_id', otras).eq('estado', 'lista').order('terminado_en', { ascending: false }).limit(30) : Promise.resolve({ data: [] }),
  ])
  const ultima = new Map<string, { id: string; version: number; creado_en: string; tipo: string }>()
  for (const v of versiones ?? []) if (!ultima.has(v.grupo)) ultima.set(v.grupo, v)
  const ultimaCorrida = new Map<string, { chat_id: string | null; terminado_en: string | null }>()
  for (const c of corridas ?? []) if (!ultimaCorrida.has(c.tarea_id)) ultimaCorrida.set(c.tarea_id, c)

  return (
    <section className="mb-3" aria-labelledby="mis-tableros">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="mis-tableros" className="text-[13px] font-semibold text-marca-900">
          Mis tableros
        </h2>
        <Link href="/sistema/asistente/tareas" className="text-xs font-semibold text-acento-700 hover:underline">
          Tareas programadas
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {tareas.map((t) => {
          const v = t.html_grupo ? ultima.get(t.html_grupo) : undefined
          const c = ultimaCorrida.get(t.id)
          const frec = describirFrecuencia({ ...t, hora: String(t.hora), frecuencia: t.frecuencia as Frecuencia['frecuencia'] })
          return (
            <article key={t.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--borde)] bg-white" data-tablero={t.id}>
              <header className="flex items-start gap-2 px-3.5 pt-3 pb-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[13.5px] font-semibold text-marca-900">{t.nombre}</h3>
                  <p className="text-[11.5px] text-marca-500">
                    {v ? `Datos al ${fechaCaracas(v.creado_en)}` : c?.terminado_en ? `Última corrida: ${fechaCaracas(c.terminado_en)}` : 'Todavía sin datos'} · {t.estado === 'activa' ? frec : 'Pausado'}
                  </p>
                </div>
                {v ? (
                  <a href={`/sistema/asistente/html/${v.id}`} target="_blank" rel="noopener" className="btn-neutro h-7 shrink-0 px-2.5 text-[12px]">
                    Abrir
                  </a>
                ) : c?.chat_id ? (
                  <Link href={`/sistema/asistente/c/${c.chat_id}`} className="btn-neutro h-7 shrink-0 px-2.5 text-[12px]">
                    Ver
                  </Link>
                ) : null}
              </header>
              {v && v.tipo === 'html' && (
                <div className="relative h-[220px] overflow-hidden border-t border-[var(--borde)] bg-[#f6f7f9]">
                  {/* Vista previa a escala: el tablero completo, sin interacción (para eso, «Abrir»). */}
                  <iframe
                    title={`Vista previa de ${t.nombre}`}
                    src={`/sistema/asistente/html/${v.id}`}
                    sandbox="allow-scripts"
                    loading="lazy"
                    tabIndex={-1}
                    className="pointer-events-none absolute top-0 left-0 h-[550px] w-[250%] origin-top-left scale-[0.4] border-0"
                  />
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
