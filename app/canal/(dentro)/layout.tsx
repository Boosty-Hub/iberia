import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { IconoCampana } from '@/components/iconos'
import { NavInferior } from '@/components/canal/nav-inferior'
import { iniciales, requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: { default: 'Iberia', template: '%s · Iberia' },
  description: 'El canal de comunicación interna de Industrias Iberia.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#D4332C',
  // Sin zoom: en un feed táctil el pinch estorba más de lo que ayuda, y el
  // tamaño de letra ya está pensado para leerse a pulso.
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function CanalLayout({ children }: LayoutProps<'/canal'>) {
  const empleado = await requerirEmpleado()
  const supabase = await createClient()

  // Los dos contadores de la cabecera y del pie. Se preguntan aquí una vez y
  // no en cada pantalla.
  const [{ data: sinLeer }, { count: solicitudes }] = await Promise.all([
    supabase.rpc('mensajes_sin_leer'),
    supabase
      .from('conexiones')
      .select('id', { count: 'exact', head: true })
      .eq('recibe_id', empleado.id)
      .eq('estado', 'pendiente'),
  ])

  return (
    <div className="canal flex min-h-full flex-1 flex-col">
      {/* Cabecera. Discreta a propósito: lo que importa es el contenido. */}
      <header className="sticky top-0 z-30 border-b border-marca-200/60 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          {/* El margen negativo agranda el área táctil a 44 px sin engordar
              la cabecera. */}
          <Link href="/canal" className="-my-2.5 flex min-h-11 items-center py-2.5">
            <Image
              src="/marca/iberia.png"
              alt="Industrias Iberia"
              width={1400}
              height={362}
              priority
              style={{ height: 24, width: 'auto' }}
            />
          </Link>

          <div className="flex items-center gap-1">
            <Link
              href="/canal/avisos"
              aria-label="Avisos"
              className="toque relative w-11 rounded-full text-marca-500 active:bg-marca-100"
            >
              <IconoCampana className="h-6 w-6" />
              {(solicitudes ?? 0) > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-acento-600 ring-2 ring-white" />
              )}
            </Link>

            <Link href="/canal/yo" aria-label="Mi perfil" className="toque w-11">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-oro-300 text-[13px] font-bold text-marca-900">
                {iniciales(empleado.nombre_completo)}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* pb-20 deja sitio a la navegación fija del pie. */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 pb-20">{children}</main>

      <NavInferior mensajesSinLeer={sinLeer ?? 0} />
    </div>
  )
}
