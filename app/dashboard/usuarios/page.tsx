import type { Metadata } from 'next'
import { IconoBasura } from '@/components/iconos'
import { CrearUsuario } from '@/components/crear-usuario'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { requerirAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatFecha } from '@/lib/utils'
import { ORGANIZACIONES, ROLES, type Organizacion, type Rol } from '@/lib/types'
import { alternarActivo, cambiarRol, eliminarUsuario } from './acciones'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function UsuariosPage() {
  const { userId } = await requerirAdmin()
  const supabase = await createClient()

  const { data: usuarios } = await supabase
    .from('profiles')
    .select('id, email, nombre_completo, cargo, rol, organizacion, activo, created_at')
    .order('organizacion')
    .order('rol')
    .order('email')

  const lista = usuarios ?? []

  return (
    <>
      <EncabezadoPagina
        rotulo="Administración"
        titulo="Usuarios"
        descripcion="Quién entra al programa y con qué permisos. El equipo de Boosty edita; los lectores de Iberia consultan el levantamiento y el informe publicado."
      />

      <div className="mb-6">
        <CrearUsuario />
      </div>

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

            return (
              <li key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-marca-800">
                      {u.nombre_completo || u.email}
                    </span>
                    {esYo && <span className="text-xs text-acento-700">(tú)</span>}
                  </p>
                  <p className="truncate text-sm text-marca-500">{u.email}</p>
                  <p className="mt-1 text-xs text-marca-400">
                    {[u.cargo, `Alta ${formatFecha(u.created_at)}`].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Insignia tono={u.organizacion === 'boosty' ? 'marca' : 'neutro'}>
                    {ORGANIZACIONES[u.organizacion as Organizacion] ?? u.organizacion}
                  </Insignia>
                  <Insignia tono={u.rol === 'lector' ? 'neutro' : 'acento'}>
                    {ROLES[u.rol as Rol] ?? u.rol}
                  </Insignia>
                  {!u.activo && <Insignia tono="rojo">Desactivado</Insignia>}
                </div>

                {/* El propio admin no puede degradarse, desactivarse ni borrarse. */}
                {!esYo && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <form action={cambiarRol} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={u.id} />
                      <label htmlFor={`rol-${u.id}`} className="sr-only">
                        Rol de {u.email}
                      </label>
                      <select
                        id={`rol-${u.id}`}
                        name="rol"
                        defaultValue={u.rol}
                        className="campo w-auto py-1 text-xs"
                      >
                        {Object.entries(ROLES).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="btn-neutro px-2 py-1 text-xs">
                        Aplicar
                      </button>
                    </form>

                    <form action={alternarActivo}>
                      <input type="hidden" name="id" value={u.id} />
                      <button type="submit" className="btn-neutro px-2.5 py-1 text-xs">
                        {u.activo ? 'Desactivar' : 'Reactivar'}
                      </button>
                    </form>

                    <form action={eliminarUsuario}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className="btn-peligro px-2.5 py-1 text-xs"
                        title={`Eliminar la cuenta de ${u.email}`}
                      >
                        <IconoBasura className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </button>
                    </form>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <p className="mt-4 text-xs text-marca-500">
        Desactivar bloquea el acceso conservando la cuenta y su rastro en el levantamiento.
        Eliminar la borra por completo.
      </p>
    </>
  )
}
