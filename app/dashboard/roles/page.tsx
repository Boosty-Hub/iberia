import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoCheck, IconoEscudo } from '@/components/iconos'
import { CrearRol } from '@/components/roles/formularios-rol'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { NIVELES, type Nivel } from '@/lib/permisos'
import { leerInventario } from '@/lib/permisos-servidor'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Roles y permisos' }

/**
 * Los roles del programa. Cada uno tiene un nivel —el techo que respeta la
 * base— y una matriz de permisos por módulo, por sección del informe y por
 * lección del curso. Aquí se ven de un vistazo y se crean; la matriz se edita
 * en la página de cada rol.
 */
export default async function RolesPage({ searchParams }: PageProps<'/dashboard/roles'>) {
  const [sesion, params] = await Promise.all([requerirPermiso('modulo:roles'), searchParams])
  const supabase = await createClient()

  const [{ data: roles }, inventario] = await Promise.all([
    supabase
      .from('roles')
      .select('id, clave, nombre, descripcion, nivel, sistema, profiles(count), rol_permisos(count)')
      .order('sistema', { ascending: false })
      .order('nombre'),
    leerInventario(),
  ])

  const lista = (roles ?? []).map((r) => ({
    ...r,
    personas: (r.profiles as unknown as { count: number }[])[0]?.count ?? 0,
    recursos: r.nivel === 'admin' ? inventario.length : ((r.rol_permisos as unknown as { count: number }[])[0]?.count ?? 0),
  }))

  return (
    <>
      <EncabezadoPagina
        rotulo="Administración"
        titulo="Roles y permisos"
        descripcion="Cada rol decide qué puede ver, crear, editar o eliminar la gente que lo tiene: módulo por módulo, sección por sección del informe y lección por lección del curso de Ajito. El nivel es el techo: un rol de solo lectura nunca escribe, aunque se le marque."
      />

      {params.borrado === '1' && (
        <p role="status" className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <IconoCheck className="h-4 w-4" />
          Rol borrado.
        </p>
      )}

      <section aria-labelledby="lista-roles">
        <h2 id="lista-roles" className="sr-only">
          Roles
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/roles/${r.id}`} className="tarjeta-rol group">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-acento-50 text-acento-600">
                      <IconoEscudo className="h-5 w-5" />
                    </span>
                    <span className="truncate font-semibold text-marca-900 group-hover:text-acento-700">{r.nombre}</span>
                  </span>
                  {r.sistema && <Insignia tono="neutro">De fábrica</Insignia>}
                </span>
                <span className="mt-3 block text-sm text-pretty text-marca-600">
                  {r.descripcion ?? 'Sin descripción.'}
                </span>
                <span className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--borde)] pt-3 text-xs text-marca-500">
                  <Insignia tono={r.nivel === 'lector' ? 'neutro' : 'acento'}>{NIVELES[r.nivel as Nivel]}</Insignia>
                  <span>
                    <span className="font-semibold text-marca-800 tabular-nums">{r.personas}</span>{' '}
                    {r.personas === 1 ? 'persona' : 'personas'}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {r.nivel === 'admin' ? (
                      'Todo habilitado'
                    ) : (
                      <>
                        <span className="font-semibold text-marca-800 tabular-nums">{r.recursos}</span> de{' '}
                        {inventario.length} recursos
                      </>
                    )}
                  </span>
                  <span className="ml-auto font-medium text-acento-700">Abrir la matriz →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {puede(sesion, 'modulo:roles', 'crear') && (
        <div className="mt-8">
          <CrearRol roles={lista.map((r) => ({ id: r.id, nombre: r.nombre, nivel: r.nivel, descripcion: r.descripcion, sistema: r.sistema }))} />
        </div>
      )}

      <p className="mt-6 text-xs text-pretty text-marca-500">
        Los cuatro roles de fábrica reproducen el acceso que había antes de este módulo y no se borran. Una
        sección nueva del informe o una lección nueva entra sola en su matriz; en los roles que crees aquí entra
        apagada, para que decidas tú quién la ve.
      </p>
    </>
  )
}
