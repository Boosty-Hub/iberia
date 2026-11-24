import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras, IconoMas } from '@/components/iconos'
import { legible } from '@/lib/certificado'
import { iniciales, requerirEmpleado, requerirSeccion } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { agregarAlGrupo, cambiarRolEnGrupo, quitarDelGrupo } from '../acciones'

export const metadata: Metadata = { title: 'Miembros del grupo' }

/**
 * Los miembros de un grupo (24-nov-2026). Los ve cualquiera que esté adentro; quien lo coordina —quien lo creó o
 * quien tenga rol coordinador— además mete y saca gente y nombra coordinadores. La base vuelve a preguntarlo
 * (`coordino_grupo`): esconder los botones no es la regla.
 */
export default async function MiembrosGrupoPage({ params, searchParams }: PageProps<'/canal/grupos/[id]'>) {
  await requerirSeccion('grupos')
  const [yo, { id }, sp] = await Promise.all([requerirEmpleado(), params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()

  const { data: grupo } = await supabase
    .from('grupos')
    .select('id, nombre, proposito, tipo, creador_id, activo')
    .eq('id', id)
    .maybeSingle()
  if (!grupo) notFound()

  const { data: miembros } = await supabase
    .from('grupo_miembros')
    .select('empleado_id, rol, empleados(id, nombre_completo, cargo)')
    .eq('grupo_id', id)
    .order('rol')

  const lista = (miembros ?? []).filter((m) => m.empleados)
  const yoAdentro = lista.find((m) => m.empleado_id === yo.id)
  const coordino = grupo.creador_id === yo.id || yoAdentro?.rol === 'coordinador'
  if (!yoAdentro && !coordino && grupo.tipo !== 'abierto') notFound()

  // Para sumar gente: el mismo directorio del portal, con búsqueda.
  const q = typeof sp.q === 'string' ? sp.q.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : ''
  const adentro = new Set(lista.map((m) => m.empleado_id))
  let candidatos: { id: string; nombre_completo: string; cargo: string | null }[] = []
  if (coordino && q) {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre_completo, cargo')
      .eq('activo', true)
      .or(`nombre_completo.ilike.%${q}%,cargo.ilike.%${q}%`)
      .order('nombre_completo')
      .limit(20)
    candidatos = (data ?? []).filter((p) => !adentro.has(p.id))
  }

  return (
    <>
      <Link href="/canal/grupos" className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-marca-500 active:text-marca-800">
        <IconoAtras className="h-4 w-4" />
        Grupos
      </Link>
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">{grupo.nombre}</h1>
        <p className="mt-1 text-[13px] text-marca-500">
          {grupo.tipo === 'abierto' ? 'Grupo abierto' : 'Grupo cerrado'} · {lista.length} {lista.length === 1 ? 'miembro' : 'miembros'}
          {coordino && ' · lo coordinas tú'}
        </p>
      </header>

      {coordino && (
        <section className="tarjeta-canal mb-4 p-4" aria-labelledby="sumar">
          <h2 id="sumar" className="mb-2 text-[15px] font-semibold text-marca-900">
            Agregar personas
          </h2>
          <form className="flex gap-2" action={`/canal/grupos/${id}`}>
            <input
              name="q"
              defaultValue={q}
              placeholder="Nombre o cargo"
              aria-label="Buscar a quién agregar"
              className="min-h-11 w-full rounded-xl border border-marca-200 bg-white px-3.5 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:ring-2 focus:ring-acento-100 focus:outline-none"
            />
            <button type="submit" className="btn-canal btn-canal-suave shrink-0 px-4">
              Buscar
            </button>
          </form>
          {q && candidatos.length === 0 && <p className="mt-3 text-[14px] text-marca-500">Nadie más con ese nombre o cargo.</p>}
          {candidatos.length > 0 && (
            <ul className="mt-3 divide-y divide-marca-100">
              {candidatos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marca-100 text-[12px] font-bold text-marca-700">
                    {iniciales(p.nombre_completo)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-marca-900">{p.nombre_completo}</p>
                    {p.cargo && <p className="truncate text-[12px] text-marca-500">{legible(p.cargo)}</p>}
                  </div>
                  <form action={agregarAlGrupo}>
                    <input type="hidden" name="grupo_id" value={id} />
                    <input type="hidden" name="empleado_id" value={p.id} />
                    <button type="submit" className="btn-canal btn-canal-rojo px-3 text-[13px]">
                      <IconoMas className="h-4 w-4" />
                      Agregar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="miembros">
        <h2 id="miembros" className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-500 uppercase">
          Miembros
        </h2>
        <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
          {lista.map((m) => {
            const persona = m.empleados!
            const esCoordinador = m.rol === 'coordinador' || persona.id === grupo.creador_id
            return (
              <li key={m.empleado_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-marca-100 text-[12px] font-bold text-marca-700">
                  {iniciales(persona.nombre_completo)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-marca-900">
                    {persona.nombre_completo}
                    {persona.id === yo.id && <span className="font-normal text-marca-500"> (tú)</span>}
                  </p>
                  <p className="truncate text-[12px] text-marca-500">
                    {esCoordinador ? 'Coordina' : 'Miembro'}
                    {persona.cargo ? ` · ${legible(persona.cargo)}` : ''}
                  </p>
                </div>
                {coordino && persona.id !== grupo.creador_id && persona.id !== yo.id && (
                  <div className="flex gap-1.5">
                    <form action={cambiarRolEnGrupo}>
                      <input type="hidden" name="grupo_id" value={id} />
                      <input type="hidden" name="empleado_id" value={persona.id} />
                      <input type="hidden" name="rol" value={m.rol === 'coordinador' ? 'miembro' : 'coordinador'} />
                      <button type="submit" className="btn-canal btn-canal-suave px-3 text-[12px]">
                        {m.rol === 'coordinador' ? 'Quitar coordinación' : 'Hacer coordinador'}
                      </button>
                    </form>
                    <form action={quitarDelGrupo}>
                      <input type="hidden" name="grupo_id" value={id} />
                      <input type="hidden" name="empleado_id" value={persona.id} />
                      <button type="submit" className="btn-canal btn-canal-suave px-3 text-[12px] text-acento-700" aria-label={`Sacar a ${persona.nombre_completo} del grupo`}>
                        Sacar
                      </button>
                    </form>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <p className="mt-3 px-1 text-[12px] leading-relaxed text-marca-500">
          La administración del portal puede ver los miembros y leer los mensajes de los grupos.
        </p>
      </section>
    </>
  )
}
