import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { puede, requerirPermiso } from '@/lib/auth'
import { legible } from '@/lib/certificado'
import { fechaHora } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { cn } from '@/lib/utils'
import { editarGrupo, miembroDeGrupo } from '../../acciones'

export const metadata: Metadata = { title: 'Grupo · Portal planta' }

const BOTON =
  'inline-flex min-h-7 items-center rounded-md border border-[var(--borde)] bg-white px-2 text-[11.5px] font-medium text-marca-800 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500'
const BOTON_PELIGRO =
  'inline-flex min-h-7 items-center rounded-md border border-acento-200 bg-white px-2 text-[11.5px] font-semibold text-acento-700 hover:bg-acento-50 focus-visible:outline-2 focus-visible:outline-acento-500'
const CAMPO = 'h-8 rounded-md border border-[var(--borde)] bg-white px-2 text-[12.5px] text-marca-900'

type Miembro = { empleado_id: string; nombre: string; cargo: string | null; rol: string; desde: string }
type Mensaje = { id: string; autor: string; texto: string; estado: string; creado_en: string }
type Grupo = {
  id: string
  nombre: string
  proposito: string | null
  tipo: string
  activo: boolean
  creado_en: string
  creador: string | null
  miembros: Miembro[]
  mensajes?: Mensaje[]
}

/**
 * Un grupo del Portal planta, desde el admin (24-nov-2026): sus datos, sus miembros (agregar, quitar, coordinador)
 * y sus mensajes. Decisión de Gabriel: el admin lee los mensajes de los GRUPOS; los directos, no. Leerlos pide
 * `modulo:reportes` · editar, se abren con un botón y cada lectura queda registrada (`canal_grupo_lecturas`).
 */
export default async function GrupoCanalPage({ params, searchParams }: PageProps<'/sistema/nucleo/canal/grupos/[id]'>) {
  const [sesion, { id }, sp] = await Promise.all([requerirPermiso('modulo:reportes'), params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const editar = puede(sesion, 'modulo:reportes', 'editar')
  const conMensajes = editar && sp.mensajes === '1'
  const buscar = typeof sp.q === 'string' ? sp.q.trim().slice(0, 60) : ''
  const supabase = await createClient()

  const [{ data, error }, personas] = await Promise.all([
    supabase.schema('ui').rpc('canal_grupo' as never, { p_grupo: id, p_con_mensajes: conMensajes } as never),
    editar && buscar
      ? supabase.schema('ui').rpc('canal_personas' as never, { p_buscar: buscar } as never)
      : Promise.resolve({ data: [] as unknown }),
  ])
  if (error || !data) notFound()
  const g = data as unknown as Grupo
  const adentro = new Set(g.miembros.map((m) => m.empleado_id))
  const candidatos = ((personas.data ?? []) as { id: string; nombre: string; cargo: string | null; area: string | null }[]).filter(
    (p) => !adentro.has(p.id)
  )
  const ruta = `/sistema/nucleo/canal/grupos/${id}`

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Portal planta"
        migas={[{ etiqueta: 'Grupos', href: '/sistema/nucleo/canal/grupos' }, { etiqueta: g.nombre }]}
        descripcion={`${g.tipo === 'abierto' ? 'Grupo abierto' : 'Grupo cerrado'}${g.creador ? ` · lo creó ${g.creador}` : ''} · ${fechaHora(g.creado_en)}${g.activo ? '' : ' · ARCHIVADO'}`}
      />

      {sp.aviso === 'error' && (
        <p role="alert" className="mb-3 rounded-xl border border-acento-200 bg-acento-50 px-3.5 py-2.5 text-[12.5px] text-acento-800">
          No se pudo guardar el cambio. Inténtalo otra vez.
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {editar && (
            <section aria-labelledby="datos" className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
              <h2 id="datos" className="mb-2 text-[13px] font-semibold text-marca-900">
                Datos del grupo
              </h2>
              <form action={editarGrupo} className="grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="grupo" value={g.id} />
                <input type="hidden" name="volver" value={ruta} />
                <label className="flex flex-col gap-1 text-[12px] font-medium text-marca-700">
                  Nombre
                  <input name="nombre" defaultValue={g.nombre} maxLength={120} required className={CAMPO} />
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-medium text-marca-700">
                  Tipo
                  <select name="tipo" defaultValue={g.tipo} className={CAMPO}>
                    <option value="abierto">Abierto: cualquiera se une</option>
                    <option value="cerrado">Cerrado: lo arma quien coordina</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[12px] font-medium text-marca-700 sm:col-span-2">
                  Propósito
                  <input name="proposito" defaultValue={g.proposito ?? ''} maxLength={400} className={CAMPO} />
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="submit" className={BOTON}>
                    Guardar
                  </button>
                </div>
              </form>
              <form action={editarGrupo} className="mt-2">
                <input type="hidden" name="grupo" value={g.id} />
                <input type="hidden" name="volver" value={ruta} />
                <input type="hidden" name="activo" value={g.activo ? 'no' : 'si'} />
                <button type="submit" className={g.activo ? BOTON_PELIGRO : BOTON}>
                  {g.activo ? 'Archivar el grupo (deja de verse en el portal)' : 'Restaurar el grupo'}
                </button>
              </form>
            </section>
          )}

          <section aria-labelledby="miembros" className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
            <h2 id="miembros" className="text-[13px] font-semibold text-marca-900">
              Miembros ({g.miembros.length})
            </h2>
            <ul className="mt-2 divide-y divide-[#eef0f3]">
              {g.miembros.map((m) => (
                <li key={m.empleado_id} className="flex flex-wrap items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-marca-900">{m.nombre}</p>
                    <p className="text-[11.5px] text-marca-500">
                      {m.rol === 'coordinador' ? 'Coordina' : 'Miembro'}
                      {m.cargo ? ` · ${legible(m.cargo)}` : ''} · desde {fechaHora(m.desde)}
                    </p>
                  </div>
                  {editar && (
                    <div className="flex gap-1">
                      <form action={miembroDeGrupo}>
                        <input type="hidden" name="grupo" value={g.id} />
                        <input type="hidden" name="empleado" value={m.empleado_id} />
                        <input type="hidden" name="accion" value={m.rol === 'coordinador' ? 'miembro' : 'coordinador'} />
                        <input type="hidden" name="volver" value={ruta} />
                        <button type="submit" className={BOTON}>
                          {m.rol === 'coordinador' ? 'Quitar coordinación' : 'Hacer coordinador'}
                        </button>
                      </form>
                      <form action={miembroDeGrupo}>
                        <input type="hidden" name="grupo" value={g.id} />
                        <input type="hidden" name="empleado" value={m.empleado_id} />
                        <input type="hidden" name="accion" value="quitar" />
                        <input type="hidden" name="volver" value={ruta} />
                        <button type="submit" className={BOTON_PELIGRO} title={`Sacar a ${m.nombre} del grupo`}>
                          Sacar
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
              {g.miembros.length === 0 && <li className="py-2 text-[12px] text-marca-500">El grupo no tiene miembros.</li>}
            </ul>

            {editar && (
              <div className="mt-3 border-t border-[var(--borde)] pt-3">
                <form method="get" action={ruta} className="flex flex-wrap items-end gap-2">
                  {conMensajes && <input type="hidden" name="mensajes" value="1" />}
                  <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[12px] font-medium text-marca-700">
                    Agregar a alguien del padrón
                    <input name="q" defaultValue={buscar} placeholder="Nombre o cargo" className={CAMPO} />
                  </label>
                  <button type="submit" className={BOTON}>
                    Buscar
                  </button>
                </form>
                {buscar && candidatos.length === 0 && <p className="mt-2 text-[12px] text-marca-500">Nadie más con ese nombre o cargo.</p>}
                <ul className="mt-2 divide-y divide-[#eef0f3]">
                  {candidatos.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-marca-900">{p.nombre}</p>
                        <p className="text-[11.5px] text-marca-500">{[p.cargo ? legible(p.cargo) : null, p.area].filter(Boolean).join(' · ')}</p>
                      </div>
                      <form action={miembroDeGrupo}>
                        <input type="hidden" name="grupo" value={g.id} />
                        <input type="hidden" name="empleado" value={p.id} />
                        <input type="hidden" name="accion" value="agregar" />
                        <input type="hidden" name="volver" value={ruta} />
                        <button type="submit" className={BOTON}>
                          Agregar
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <section aria-labelledby="mensajes" className="rounded-xl border border-[var(--borde)] bg-white p-3.5">
          <h2 id="mensajes" className="text-[13px] font-semibold text-marca-900">
            Mensajes del grupo
          </h2>
          {!editar ? (
            <p className="mt-2 text-[12px] text-marca-500">Leer los mensajes pide editar en «Reportes del canal».</p>
          ) : !conMensajes ? (
            <div className="mt-2">
              <p className="mb-2 text-[12px] text-marca-500">
                Los miembros ven en el grupo el aviso de que la administración puede leerlo. Cada lectura queda registrada con quién y cuándo.
              </p>
              <Link href={`${ruta}?mensajes=1${buscar ? `&q=${encodeURIComponent(buscar)}` : ''}`} className={BOTON}>
                Ver los mensajes
              </Link>
            </div>
          ) : (g.mensajes ?? []).length === 0 ? (
            <p className="mt-2 text-[12px] text-marca-500">Todavía no hay mensajes en este grupo.</p>
          ) : (
            <ol className="mt-2 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
              {(g.mensajes ?? []).map((m) => (
                <li key={m.id} className={cn('rounded-lg bg-[#f6f7f9] px-3 py-2', m.estado === 'oculto' && 'opacity-60')}>
                  <p className="text-[11px] text-marca-500">
                    <span className="font-semibold text-marca-800">{m.autor}</span> · {fechaHora(m.creado_en)}
                    {m.estado === 'oculto' && <span className="font-semibold text-acento-700"> · oculto</span>}
                  </p>
                  <p className="mt-0.5 text-[12.5px] whitespace-pre-line text-marca-900">{m.texto}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  )
}
