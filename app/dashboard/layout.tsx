import { cerrarSesion } from '@/app/login/actions'
import { IconoSalir } from '@/components/iconos'
import { Marca } from '@/components/marca'
import { NavLateral } from '@/components/nav-lateral'
import { Insignia } from '@/components/ui'
import { esAdmin, requerirSesion } from '@/lib/auth'
import { ORGANIZACIONES, ROLES, type Organizacion, type Rol } from '@/lib/types'

export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const { perfil, email } = await requerirSesion()
  const rol = perfil.rol as Rol

  return (
    <div className="flex min-h-full flex-1">
      {/* Barra lateral. En claro, como el canal: el carbón oscuro partía el
          producto en dos mitades que no parecían la misma aplicación. */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--borde)] bg-white lg:flex">
        <div className="border-b border-[var(--borde)] px-5 py-4">
          <Marca />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLateral esAdmin={esAdmin(perfil)} />
        </div>
        <div className="border-t border-[var(--borde)] px-5 py-3">
          <p className="text-[11px] leading-relaxed text-marca-400">
            Fase 1 · Entender
            <br />
            Boosty Digital
          </p>
        </div>
      </aside>

      {/* Columna de contenido */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-[var(--borde)] bg-white px-5 py-3">
          {/* En móvil la marca vive en la barra superior, no en el aside. */}
          <div className="lg:hidden">
            <Marca />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium text-marca-800">
                {perfil.nombre_completo || email}
              </p>
              <p className="text-xs leading-tight text-marca-500">
                {ORGANIZACIONES[perfil.organizacion as Organizacion] ?? perfil.organizacion}
              </p>
            </div>
            <Insignia tono={rol === 'lector' ? 'neutro' : 'acento'}>{ROLES[rol] ?? rol}</Insignia>

            <form action={cerrarSesion}>
              <button
                type="submit"
                className="btn-neutro px-3"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <IconoSalir className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Salir</span>
              </button>
            </form>
          </div>
        </header>

        {/* Navegación compacta para móvil */}
        <div className="border-b border-[var(--borde)] bg-white lg:hidden">
          <NavLateral esAdmin={esAdmin(perfil)} />
        </div>

        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
