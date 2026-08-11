import Link from 'next/link'
import { cerrarSesion } from '@/app/login/actions'
import { IconoPanel, IconoSalir } from '@/components/iconos'
import { Marca } from '@/components/marca'
import { esEditor, requerirSesion } from '@/lib/auth'

/**
 * El informe vive fuera del dashboard: es una página propia, con su propia
 * cáscara de lectura. Sigue exigiendo sesión — el middleware la protege y
 * requerirSesion() la vuelve a comprobar en el servidor.
 */
export default async function InformeLayout({ children }: LayoutProps<'/informe'>) {
  const { perfil } = await requerirSesion()

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-[var(--borde)] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <Marca />

          <div className="flex items-center gap-2">
            {esEditor(perfil) && (
              <Link href="/dashboard/informe" className="btn-neutro px-3 text-xs">
                <IconoPanel className="h-4 w-4" />
                <span className="hidden sm:inline">Editar</span>
              </Link>
            )}
            <Link href="/dashboard" className="btn-neutro px-3 text-xs">
              <span className="hidden sm:inline">Dashboard</span>
              <span className="sm:hidden">Panel</span>
            </Link>
            <form action={cerrarSesion}>
              <button type="submit" className="btn-neutro px-3 text-xs" aria-label="Cerrar sesión">
                <IconoSalir className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--borde)] bg-marca-900 px-5 py-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/50">
            Información confidencial de Industrias Iberia bajo acuerdo de confidencialidad.
          </p>
          <p className="text-xs text-white/40">
            Boosty International LLC · Anthropic Partner
          </p>
        </div>
      </footer>
    </div>
  )
}
