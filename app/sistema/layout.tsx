import { cerrarSesion } from '@/app/login/actions'
import { IconoChat, IconoSalir } from '@/components/iconos'
import Link from 'next/link'
import { Marca } from '@/components/marca'
import { MenuMovil } from '@/components/menu-movil'
import { NavSistema } from '@/components/nav-sistema'
import { Insignia } from '@/components/ui'
import { puede, requerirSesion } from '@/lib/auth'
import { destinosSistema } from '@/lib/sistema'
import { empleadoActual } from '@/lib/canal'

export default async function SistemaLayout({ children }: LayoutProps<'/sistema'>) {
  const sesion = await requerirSesion()
  const { perfil, email, rol } = sesion
  const permitidos = destinosSistema(sesion)
  const conCanal = puede(sesion, 'modulo:canal') && Boolean(await empleadoActual())

  return (
    <div className="flex min-h-full flex-1">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--borde)] bg-white lg:flex">
        <div className="border-b border-[var(--borde)] px-5 py-4">
          <Marca />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavSistema permitidos={permitidos} />
        </div>
        <div className="border-t border-[var(--borde)] px-5 py-3">
          <p className="text-[11px] leading-relaxed text-marca-400">
            Plataforma Iberia
            <br />
            Etapa 1 · Procesos y estructura
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-[var(--borde)] bg-white/95 px-4 backdrop-blur sm:px-5">
          <MenuMovil titulo="Menú" etiqueta="Abrir el menú">
            <NavSistema permitidos={permitidos} />
          </MenuMovil>
          <div className="lg:hidden">
            <Marca compacta alto={26} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {conCanal && (
              <Link href="/canal" className="btn-neutro h-10 px-3" aria-label="Ir al canal">
                <IconoChat className="h-4 w-4" />
                <span className="hidden md:inline">El canal</span>
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium text-marca-800">{perfil.nombre_completo || email}</p>
              <p className="text-xs leading-tight text-marca-500">{rol.nombre}</p>
            </div>
            <Insignia tono={rol.nivel === 'lector' ? 'neutro' : 'acento'} className="hidden sm:inline-flex">
              {rol.nombre}
            </Insignia>
            <form action={cerrarSesion}>
              <button type="submit" className="btn-neutro h-10 px-3" title="Cerrar sesión" aria-label="Cerrar sesión">
                <IconoSalir className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only">Salir</span>
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-5 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
