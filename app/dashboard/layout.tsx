import { cerrarSesion } from '@/app/login/actions'
import { IconoNuevaPestana, IconoSalir, IconoVerInforme } from '@/components/iconos'
import Link from 'next/link'
import { Marca } from '@/components/marca'
import { MenuMovil } from '@/components/menu-movil'
import { NavLateral, type ClaveNav } from '@/components/nav-lateral'
import { Insignia } from '@/components/ui'
import { puede, requerirSesion, type Sesion } from '@/lib/auth'
import { ORGANIZACIONES, type Organizacion } from '@/lib/types'

/** Qué destinos de la barra puede abrir esta sesión: el mismo permiso que exige cada página. */
function destinosPermitidos(sesion: Sesion): ClaveNav[] {
  const reglas: [ClaveNav, boolean][] = [
    ['panel', puede(sesion, 'modulo:panel')],
    ['entrevistas', puede(sesion, 'modulo:entrevistas')],
    ['archivos', puede(sesion, 'modulo:archivos')],
    ['adiestramiento', puede(sesion, 'modulo:adiestramiento')],
    // El padrón se abre con «editar»: sus vistas solo le responden al equipo.
    ['empleados', puede(sesion, 'modulo:empleados', 'editar')],
    ['programa', puede(sesion, 'modulo:programa')],
    ['usuarios', puede(sesion, 'modulo:usuarios')],
    ['roles', puede(sesion, 'modulo:roles')],
    ['curso', puede(sesion, 'modulo:adiestramiento', 'editar') && puede(sesion, 'modulo:canal')],
    [
      'ver-informe',
      Object.entries(sesion.permisos).some(([r, p]) => r.startsWith('informe:') && p.ver) ||
        sesion.rol.nivel === 'admin',
    ],
  ]
  return reglas.filter(([, si]) => si).map(([clave]) => clave)
}

export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const sesion = await requerirSesion()
  const { perfil, email, rol } = sesion
  const permitidos = destinosPermitidos(sesion)

  return (
    <div className="flex min-h-full flex-1">
      {/* Barra lateral. En claro, como el canal: el carbón oscuro partía el
          producto en dos mitades que no parecían la misma aplicación. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--borde)] bg-white lg:flex">
        <div className="border-b border-[var(--borde)] px-5 py-4">
          <Marca />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavLateral permitidos={permitidos} />
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
        <header className="sticky top-0 z-30 flex h-[60px] items-center gap-3 border-b border-[var(--borde)] bg-white/95 px-4 backdrop-blur sm:px-5">
          {/* En teléfono, la barra se abre desde aquí. Antes se pintaba entera
              arriba del contenido: ocho enlaces antes de la primera línea de
              la página. */}
          <MenuMovil titulo="Menú" etiqueta="Abrir el menú">
            <NavLateral permitidos={permitidos} />
          </MenuMovil>
          <div className="lg:hidden">
            <Marca compacta alto={26} />
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* El informe, en la cabecera y no en la barra: es el destino de todo
                el panel, y abajo del menú no se encontraba. Abre en otra pestaña,
                porque es otra aplicación y volver al panel no puede costar el sitio. */}
            {permitidos.includes('ver-informe') && (
              <Link href="/informe" target="_blank" className="btn-neutro h-10 px-3 text-acento-700" aria-label="Ver el informe (abre en otra pestaña)">
                <IconoVerInforme className="h-4 w-4" />
                <span className="hidden md:inline">Ver el informe</span>
                <IconoNuevaPestana className="hidden h-3.5 w-3.5 text-acento-400 md:inline" />
              </Link>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium text-marca-800">
                {perfil.nombre_completo || email}
              </p>
              <p className="text-xs leading-tight text-marca-500">
                {ORGANIZACIONES[perfil.organizacion as Organizacion] ?? perfil.organizacion}
              </p>
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
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
