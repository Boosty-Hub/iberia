import type { Metadata } from 'next'
import { IconoChat, IconoGrupo, IconoMas } from '@/components/iconos'
import { requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { abrirGrupo, crearGrupo, unirmeAGrupo } from './acciones'

export const metadata: Metadata = { title: 'Grupos' }

export default async function GruposPage() {
  const yo = await requerirEmpleado()
  const supabase = await createClient()

  // RLS decide qué se ve: los abiertos, más los cerrados donde participo.
  const [{ data: grupos }, { data: mias }] = await Promise.all([
    supabase
      .from('grupos')
      .select('id, nombre, proposito, tipo, areas(nombre)')
      .eq('activo', true)
      .order('nombre'),
    supabase.from('grupo_miembros').select('grupo_id').eq('empleado_id', yo.id),
  ])

  const soyMiembro = new Set((mias ?? []).map((m) => m.grupo_id))
  const lista = grupos ?? []

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">
          Grupos
        </h1>
        <p className="mt-1 text-[13px] text-marca-500">
          Espacios de trabajo por tema, área o proyecto
        </p>
      </header>

      {lista.length === 0 ? (
        <div className="tarjeta-canal mb-4 px-6 py-10 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-100 text-marca-400">
            <IconoGrupo className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-marca-900">
            Todavía no hay grupos
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-marca-500">
            Un grupo reúne a quienes trabajan en lo mismo: un turno, una línea,
            un proyecto.
          </p>
        </div>
      ) : (
        <ul className="mb-5 space-y-2.5">
          {lista.map((grupo) => {
            const miembro = soyMiembro.has(grupo.id)
            return (
              <li key={grupo.id} className="tarjeta-canal p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-acento-50 text-acento-700">
                    <IconoGrupo className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] leading-snug font-semibold text-marca-900">
                      {grupo.nombre}
                    </p>
                    {grupo.proposito && (
                      <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-marca-500">
                        {grupo.proposito}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="chip bg-marca-100 text-marca-600">
                        {grupo.tipo === 'abierto' ? 'Abierto' : 'Cerrado'}
                      </span>
                      {grupo.areas?.nombre && (
                        <span className="chip bg-marca-100 text-marca-600">
                          {grupo.areas.nombre}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  {miembro ? (
                    <form action={abrirGrupo}>
                      <input type="hidden" name="grupo_id" value={grupo.id} />
                      <button type="submit" className="btn-canal btn-canal-suave w-full">
                        <IconoChat className="h-4 w-4" />
                        Abrir conversación
                      </button>
                    </form>
                  ) : grupo.tipo === 'abierto' ? (
                    <form action={unirmeAGrupo}>
                      <input type="hidden" name="grupo_id" value={grupo.id} />
                      <button type="submit" className="btn-canal btn-canal-rojo w-full">
                        <IconoMas className="h-4 w-4" />
                        Unirme
                      </button>
                    </form>
                  ) : (
                    <p className="text-[13px] text-marca-400">
                      Este grupo es cerrado: su coordinador suma a los miembros.
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <details className="tarjeta-canal overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-[15px] font-semibold text-marca-800">
          <IconoMas className="h-5 w-5 text-acento-600" />
          Crear un grupo
        </summary>
        <form action={crearGrupo} className="space-y-3 border-t border-marca-100 p-4">
          <div>
            <label htmlFor="nombre" className="mb-1 block text-[13px] font-medium text-marca-600">
              Nombre
            </label>
            <input
              id="nombre"
              name="nombre"
              required
              maxLength={120}
              placeholder="Turno de la mañana, Línea de salsas…"
              className="min-h-11 w-full rounded-xl border border-marca-200 bg-white px-3.5 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:ring-2 focus:ring-acento-100 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="proposito" className="mb-1 block text-[13px] font-medium text-marca-600">
              Para qué es
            </label>
            <textarea
              id="proposito"
              name="proposito"
              rows={2}
              maxLength={400}
              placeholder="En una línea"
              className="w-full rounded-xl border border-marca-200 bg-white px-3.5 py-2.5 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:ring-2 focus:ring-acento-100 focus:outline-none"
            />
          </div>
          <fieldset>
            <legend className="mb-1 text-[13px] font-medium text-marca-600">Quién entra</legend>
            <div className="flex gap-2">
              <label className="toque flex flex-1 items-center justify-center gap-2 rounded-xl border border-marca-200 bg-white text-[14px] text-marca-700 has-checked:border-acento-500 has-checked:bg-acento-50 has-checked:text-acento-800">
                <input type="radio" name="tipo" value="abierto" defaultChecked className="sr-only" />
                Abierto
              </label>
              <label className="toque flex flex-1 items-center justify-center gap-2 rounded-xl border border-marca-200 bg-white text-[14px] text-marca-700 has-checked:border-acento-500 has-checked:bg-acento-50 has-checked:text-acento-800">
                <input type="radio" name="tipo" value="cerrado" className="sr-only" />
                Cerrado
              </label>
            </div>
          </fieldset>
          <button type="submit" className="btn-canal btn-canal-rojo w-full">
            Crear grupo
          </button>
        </form>
      </details>
    </>
  )
}
