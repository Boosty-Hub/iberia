import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoBasura } from '@/components/iconos'
import { CrearUsuario } from '@/components/crear-usuario'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { NIVELES, type Nivel } from '@/lib/permisos'
import { createClient } from '@/lib/supabase/server'
import { formatFecha } from '@/lib/utils'
import { ORGANIZACIONES, type Organizacion } from '@/lib/types'
import { alternarActivo, cambiarRol, eliminarUsuario } from './acciones'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function UsuariosPage() {
  const sesion = await requerirPermiso('modulo:usuarios')
  const { userId } = sesion
  const supabase = await createClient()

  const [{ data: usuarios }, { data: roles }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, nombre_completo, cargo, rol, rol_id, organizacion, activo, created_at, roles(nombre, nivel)')
      .order('organizacion')
      .order('email'),
    supabase.from('roles').select('id, clave, nombre, nivel, descripcion, sistema').order('sistema', { ascending: false }).order('nombre'),
  ])

  const lista = usuarios ?? []
  const rolesLista = roles ?? []
  const puedeCrear = puede(sesion, 'modulo:usuarios', 'crear')
  const puedeEditar = puede(sesion, 'modulo:usuarios', 'editar')
  const puedeEliminar = puede(sesion, 'modulo:usuarios', 'eliminar')

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
          <CrearUsuario roles={rolesLista} />
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
        Desactivar bloquea el acceso conservando la cuenta y su rastro en el levantamiento. Eliminar la borra
        por completo. Siempre queda al menos un administrador activo: la base no deja quitar el último.
      </p>
    </>
  )
}
