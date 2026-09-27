import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoBasura } from '@/components/iconos'
import { CrearUsuario } from '@/components/crear-usuario'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { legible } from '@/lib/certificado'
import { mejorFicha } from '@/lib/coincidencia'
import { NIVELES, type Nivel } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { formatFecha } from '@/lib/utils'
import { ORGANIZACIONES, type Organizacion } from '@/lib/types'
import { alternarActivo, cambiarRol, desenlazarFicha, eliminarUsuario, enlazarFicha } from './acciones'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function UsuariosPage() {
  const sesion = await requerirPermiso('modulo:usuarios')
  const { userId } = sesion
  const supabase = await createClient()

  const [{ data: usuarios }, { data: roles }, { data: padron }, { data: conCanal }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, nombre_completo, cargo, rol, rol_id, organizacion, activo, created_at, roles(nombre, nivel)')
      .order('organizacion')
      .order('email'),
    supabase.from('roles').select('id, clave, nombre, nivel, descripcion, sistema').order('sistema', { ascending: false }).order('nombre'),
    // El padrón, para enlazar cada cuenta con su ficha: sin ficha no se entra al
    // canal. Son menos de mil, así que va de una.
    supabase
      .from('empleados')
      .select('id, ficha, nombre_completo, cargo, perfil_id')
      .eq('activo', true)
      .order('nombre_completo'),
    supabase.from('rol_permisos').select('rol_id').eq('recurso', 'modulo:canal').eq('ver', true),
  ])

  const lista = usuarios ?? []
  const rolesLista = roles ?? []
  const puedeCrear = puede(sesion, 'modulo:usuarios', 'crear')
  const puedeEditar = puede(sesion, 'modulo:usuarios', 'editar')
  const puedeEliminar = puede(sesion, 'modulo:usuarios', 'eliminar')

  const fichas = padron ?? []
  const libres = fichas.filter((f) => !f.perfil_id)
  const fichaDe = new Map(fichas.filter((f) => f.perfil_id).map((f) => [f.perfil_id, f]))
  // Qué roles entran al canal: los que lo tienen en la matriz, y el de nivel
  // administrador, que lo puede todo y no tiene matriz.
  const rolesConCanal = new Set([
    ...(conCanal ?? []).map((p) => p.rol_id),
    ...rolesLista.filter((r) => r.nivel === 'admin').map((r) => r.id),
  ])

  return (
    <>
      <EncabezadoPagina
        rotulo="Administración"
        titulo="Usuarios"
        descripcion={
          <>
            Quién entra al programa y con qué rol. Lo que cada rol puede ver, crear, editar o eliminar
            se decide en{' '}
            <Link href="/dashboard/roles" className="font-medium text-acento-700 underline decoration-acento-300 underline-offset-2">
              Roles y permisos
            </Link>
            .
          </>
        }
      />

      {puedeCrear && (
        <div className="mb-6">
          <CrearUsuario roles={rolesLista} fichas={libres.map((f) => ({ id: f.id, rotulo: rotuloFicha(f) }))} />
        </div>
      )}

      <section className="tarjeta overflow-hidden">
        <div className="border-b border-[var(--borde)] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-marca-800">
            Cuentas
            <span className="ml-1.5 text-xs font-normal text-marca-500">{lista.length}</span>
          </h2>
        </div>

        <ul className="divide-y divide-[var(--borde)]">
          {lista.map((u) => {
            const esYo = u.id === userId
            const rol = u.roles as { nombre: string; nivel: string } | null
            const ficha = fichaDe.get(u.id)
            // El aviso solo va donde hace falta: una cuenta de Iberia que entra al
            // canal. Las de Boosty no están en el padrón, y está bien.
            const leFaltaFicha = !ficha && u.organizacion === 'iberia' && rolesConCanal.has(u.rol_id)
            const propuesta = leFaltaFicha ? mejorFicha(u.nombre_completo, libres) : null

            return (
              <li key={u.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-marca-800">{u.nombre_completo || u.email}</span>
                    {esYo && <span className="text-xs text-acento-700">(tú)</span>}
                  </p>
                  <p className="truncate text-sm text-marca-500">{u.email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Insignia tono={u.organizacion === 'boosty' ? 'marca' : 'neutro'}>
                      {ORGANIZACIONES[u.organizacion as Organizacion] ?? u.organizacion}
                    </Insignia>
                    <Link href={`/dashboard/roles/${u.rol_id}`}>
                      <Insignia tono={u.rol === 'lector' ? 'neutro' : 'acento'}>{rol?.nombre ?? u.rol}</Insignia>
                    </Link>
                    {!u.activo && <Insignia tono="rojo">Desactivado</Insignia>}
                    <span className="text-xs text-marca-400">
                      {[u.cargo, `Alta ${formatFecha(u.created_at)}`].filter(Boolean).join(' · ')}
                    </span>
                  </div>

                  {ficha && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-marca-500" data-ficha-enlazada>
                      <span>
                        Padrón: <span className="font-medium text-marca-700">{rotuloFicha(ficha)}</span>
                      </span>
                      {puedeEditar && !esYo && (
                        <form action={desenlazarFicha}>
                          <input type="hidden" name="id" value={u.id} />
                          <button type="submit" className="text-marca-500 underline underline-offset-2 hover:text-marca-800">
                            Quitar
                          </button>
                        </form>
                      )}
                    </div>
                  )}

                  {leFaltaFicha && (
                    <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5" data-sin-ficha>
                      <p className="text-xs leading-relaxed text-amber-800">
                        <span className="font-semibold">Sin ficha del padrón:</span> entra al programa pero no al
                        canal, que cuelga todo de la ficha.
                        {propuesta ? ' Esta es la que coincide con su nombre; revísala antes de enlazar.' : ' Elige la suya.'}
                      </p>
                      {puedeEditar && (
                        <form action={enlazarFicha} className="mt-2 flex flex-wrap items-center gap-1.5">
                          <input type="hidden" name="id" value={u.id} />
                          <label htmlFor={`ficha-${u.id}`} className="sr-only">
                            Ficha del padrón de {u.email}
                          </label>
                          <select
                            id={`ficha-${u.id}`}
                            name="empleado_id"
                            required
                            defaultValue={propuesta?.id ?? ''}
                            className="campo h-10 w-auto max-w-full min-w-0 flex-1 py-1 text-sm"
                          >
                            <option value="" disabled>
                              Elige la ficha…
                            </option>
                            {libres.map((f) => (
                              <option key={f.id} value={f.id}>
                                {rotuloFicha(f)}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="btn-neutro h-10 px-3 text-sm">
                            Enlazar
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {/* El propio admin no puede degradarse, desactivarse ni borrarse. */}
                {!esYo && (puedeEditar || puedeEliminar) && (
                  <div className="flex flex-wrap items-center gap-2">
                    {puedeEditar && (
                      <form action={cambiarRol} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={u.id} />
                        <label htmlFor={`rol-${u.id}`} className="sr-only">
                          Rol de {u.email}
                        </label>
                        <select id={`rol-${u.id}`} name="rol_id" defaultValue={u.rol_id} className="campo h-10 w-auto max-w-[14rem] py-1 text-sm">
                          {rolesLista.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.nombre} · {NIVELES[r.nivel as Nivel]}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="btn-neutro h-10 px-3 text-sm">
                          Aplicar
                        </button>
                      </form>
                    )}

                    {puedeEditar && (
                      <form action={alternarActivo}>
                        <input type="hidden" name="id" value={u.id} />
                        <button type="submit" className="btn-neutro h-10 px-3 text-sm">
                          {u.activo ? 'Desactivar' : 'Reactivar'}
                        </button>
                      </form>
                    )}

                    {puedeEliminar && (
                      <form action={eliminarUsuario}>
                        <input type="hidden" name="id" value={u.id} />
                        <button
                          type="submit"
                          className="btn-peligro h-10 w-10 p-0"
                          title={`Eliminar la cuenta de ${u.email}`}
                          aria-label={`Eliminar la cuenta de ${u.email}`}
                        >
                          <IconoBasura className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <p className="mt-4 text-xs text-marca-500">
        Enlazar la ficha le abre el canal con su nombre, su cargo y su área del padrón; las cuentas que se
        acuñan desde el padrón nacen enlazadas. Desactivar bloquea el acceso conservando la cuenta y su rastro en el levantamiento. Eliminar la borra
        por completo. Siempre queda al menos un administrador activo: la base no deja quitar el último.
      </p>
    </>
  )
}

/**
 * «Martha Elena Alvarez Trejo · Gerente de mercadeo · ficha 5034». Las fichas sin
 * número son las que se cargaron a mano antes del listado de Capital Humano, y hay
 * gente que está dos veces: el rótulo lo dice, para no enlazar la equivocada.
 */
function rotuloFicha(f: { nombre_completo: string; cargo: string | null; ficha: string | null }): string {
  return [f.nombre_completo, f.cargo && legible(f.cargo), f.ficha ? `ficha ${f.ficha}` : 'cargada a mano']
    .filter(Boolean)
    .join(' · ')
}
