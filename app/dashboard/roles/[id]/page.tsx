import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras, IconoCheck } from '@/components/iconos'
import { EditarRol, EliminarRol } from '@/components/roles/formularios-rol'
import { MatrizPermisos } from '@/components/roles/matriz-permisos'
import { Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { NIVELES, type Nivel } from '@/lib/permisos'
import { leerInventario, leerMatriz } from '@/lib/permisos-servidor'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Rol · Roles y permisos' }

const MOSTRAR = 15

export default async function RolPage({ params, searchParams }: PageProps<'/dashboard/roles/[id]'>) {
  const [sesion, { id }, consulta] = await Promise.all([requerirPermiso('modulo:roles'), params, searchParams])
  const supabase = await createClient()

  const { data: rol } = await supabase
    .from('roles')
    .select('id, clave, nombre, descripcion, nivel, sistema')
    .eq('id', id)
    .maybeSingle()
  if (!rol) notFound()

  const [inventario, matriz, { data: personas }] = await Promise.all([
    leerInventario(),
    leerMatriz(id),
    supabase.from('profiles').select('id, email, nombre_completo, activo').eq('rol_id', id).order('email'),
  ])

  const nivel = rol.nivel as Nivel
  const gente = personas ?? []
  const puedeEditar = puede(sesion, 'modulo:roles', 'editar')

  return (
    <>
      <Link href="/dashboard/roles" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Roles y permisos
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo mb-2">Rol</p>
          <h1 className="text-2xl font-bold tracking-tight text-marca-900">{rol.nombre}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Insignia tono={nivel === 'lector' ? 'neutro' : 'acento'}>{NIVELES[nivel]}</Insignia>
            {rol.sistema && <Insignia tono="neutro">De fábrica</Insignia>}
            <span className="text-xs text-marca-500">
              {gente.length} {gente.length === 1 ? 'persona' : 'personas'}
            </span>
          </div>
        </div>
        {puede(sesion, 'modulo:roles', 'eliminar') && <EliminarRol rol={rol} personas={gente.length} />}
      </div>

      {consulta.creado === '1' && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <IconoCheck className="h-4 w-4" />
          Rol creado. Ahora marca lo que puede hacer y guarda.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-labelledby="matriz-titulo" className="min-w-0">
          <h2 id="matriz-titulo" className="mb-3 text-sm font-semibold text-marca-800">
            Matriz de permisos
          </h2>
          {puedeEditar ? (
            <MatrizPermisos rolId={rol.id} nivel={nivel} inventario={inventario} inicial={matriz} />
          ) : (
            <p className="tarjeta p-5 text-sm text-marca-500">Tu rol puede ver los roles, pero no editar su matriz.</p>
          )}
        </section>

        <aside className="space-y-6 xl:sticky xl:top-[84px]">
          {puedeEditar && (
            <section aria-labelledby="datos-titulo">
              <h2 id="datos-titulo" className="mb-3 text-sm font-semibold text-marca-800">
                Datos del rol
              </h2>
              <EditarRol rol={rol} />
            </section>
          )}

          <section aria-labelledby="gente-titulo" className="tarjeta overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--borde)] px-5 py-3.5">
              <h2 id="gente-titulo" className="text-sm font-semibold text-marca-800">
                Quién lo tiene
              </h2>
              <Link href="/dashboard/usuarios" className="text-xs font-medium text-acento-700 hover:underline">
                Asignar en Usuarios
              </Link>
            </div>
            {gente.length ? (
              <ul className="divide-y divide-[var(--borde)]">
                {/* El personal de planta van a ser cientos: se ven los primeros y la cuenta. */}
                {gente.slice(0, MOSTRAR).map((p) => (
                  <li key={p.id} className="px-5 py-3">
                    <p className="truncate text-sm font-medium text-marca-800">{p.nombre_completo || p.email}</p>
                    <p className="truncate text-xs text-marca-500">
                      {p.email}
                      {!p.activo && ' · desactivada'}
                    </p>
                  </li>
                ))}
                {gente.length > MOSTRAR && (
                  <li className="px-5 py-3 text-xs text-marca-500">y {gente.length - MOSTRAR} más</li>
                )}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-marca-500">Nadie todavía.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
