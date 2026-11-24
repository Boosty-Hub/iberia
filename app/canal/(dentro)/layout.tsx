import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { IconoCampana, IconoPanel } from '@/components/iconos'
import { AceptarNormas } from '@/components/canal/aceptar-normas'
import { NavInferior } from '@/components/canal/nav-inferior'
import { NormasDeUso } from '@/components/normas-de-uso'
import { VERSION_NORMAS } from '@/lib/normas'
import { NotificacionesNativas } from '@/components/canal/notificaciones-nativas'
import { destinoInicial, obtenerSesion, puede } from '@/lib/auth'
import { iniciales, requerirEmpleado, seccionesActivas, tienePlataforma } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: { default: 'Iberia', template: '%s · Iberia' },
  description: 'El canal de comunicación interna de Industrias Iberia.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: '#D4332C',
  width: 'device-width',
  initialScale: 1,
  // Hasta el borde de la pantalla: las zonas seguras las respetan la cabecera
  // y la navegación (variables `--seguro-*`). Sin tope de zoom: iOS ya no
  // acerca solo al enfocar un campo porque todos miden 16 px en el teléfono
  // (`.campo` y la regla de `.canal` en globals.css), y quien necesite
  // agrandar algo puede hacerlo con los dedos.
  viewportFit: 'cover',
}

export default async function CanalLayout({ children }: LayoutProps<'/canal'>) {
  const empleado = await requerirEmpleado()

  // Estar en el padrón no basta: el rol tiene que tener el canal. Sin él, a su
  // destino inicial. `destinoInicial` solo devuelve '/canal' cuando el canal está
  // permitido, así que esto no se cierra sobre sí mismo.
  const sesion = await obtenerSesion()
  if (!puede(sesion, 'modulo:canal')) {
    const destino = sesion ? destinoInicial(sesion) : '/canal/entrar'
    redirect(destino === '/canal' ? '/sin-acceso' : destino)
  }
  // Las normas de uso se aceptan una vez antes de entrar (guía 1.2 de la App
  // Store). Sin aceptarlas, en lugar del canal sale la pantalla que las pide; la
  // acción que las acepta no pasa por aquí, y `/normas` es pública aparte.
  if ((sesion?.normasAceptadas ?? 0) < VERSION_NORMAS) {
    return <PantallaNormas />
  }

  // La puerta a la plataforma (`/sistema`) para quien tiene algo que abrir allá.
  // Antes era «Panel» y llevaba al dashboard; todo lo de administrar se mudó.
  const plataforma = tienePlataforma(sesion)
  const supabase = await createClient()

  // Los contadores de la cabecera y del pie. Se preguntan aquí una vez y no en
  // cada pantalla. La campana suma las solicitudes de conexión y los avisos de
  // la plataforma sin leer (`nucleo.notificacion`: la misma campana de /sistema).
  const [{ data: sinLeer }, { count: solicitudes }, { data: avisos }, activas] = await Promise.all([
    supabase.rpc('mensajes_sin_leer'),
    supabase
      .from('conexiones')
      .select('id', { count: 'exact', head: true })
      .eq('recibe_id', empleado.id)
      .eq('estado', 'pendiente'),
    supabase.schema('nucleo').rpc('no_leidas'),
    seccionesActivas(),
  ])
  const enCampana = (solicitudes ?? 0) + (avisos ?? 0)

  return (
    <div className="canal flex min-h-full flex-1 flex-col">
      {/* Cabecera. Discreta a propósito: lo que importa es el contenido. */}
      {/* El fondo llena también la franja del notch: el relleno de arriba es de
          la propia cabecera, no un margen. */}
      <header className="sticky top-0 z-30 border-b border-marca-200/60 bg-white/95 pt-[var(--seguro-arriba)] pr-[var(--seguro-der)] pl-[var(--seguro-izq)] backdrop-blur">
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
            {/* La puerta al panel, para quien tiene algún módulo de allá: sin esto
                se entraba al canal y no había cómo llegar a ellos. Lleva a la
                primera pantalla que su rol abre, que no siempre es la portada. */}
            {plataforma && (
              <Link
                href="/sistema"
                className="toque gap-1.5 rounded-full px-3 text-[13px] font-semibold text-marca-600 active:bg-marca-100"
              >
                <IconoPanel className="h-5 w-5" />
                Admin
              </Link>
            )}
            {activas.has('avisos') && (
            <Link
              href="/canal/avisos"
              aria-label={enCampana > 0 ? `Avisos, ${enCampana} sin ver` : 'Avisos'}
              className="toque relative w-11 rounded-full text-marca-500 active:bg-marca-100"
            >
              <IconoCampana className="h-6 w-6" />
              {enCampana > 0 && (
                <span
                  aria-hidden
                  className="absolute top-1 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-acento-600 px-1 text-[10px] font-bold text-white ring-2 ring-white tabular-nums"
                >
                  {enCampana > 9 ? '9+' : enCampana}
                </span>
              )}
            </Link>
            )}

            <Link href="/canal/yo" aria-label={`${iniciales(empleado.nombre_completo)}, mi perfil`} className="toque w-11">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-oro-300 text-[13px] font-bold text-marca-900">
                {iniciales(empleado.nombre_completo)}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* `canal-principal` deja sitio a la navegación fija del pie y a su zona
          segura. Los lados respetan el notch en horizontal. */}
      <main className="canal-principal mx-auto w-full max-w-lg flex-1 pt-4 pr-[max(1rem,var(--seguro-der))] pl-[max(1rem,var(--seguro-izq))]">
        {children}
      </main>

      <NavInferior mensajesSinLeer={sinLeer ?? 0} activas={[...activas]} />

      {/* Dentro de la app de iOS: el permiso de avisos y el registro del
          teléfono, ya con sesión. En el navegador no hace nada. */}
      <NotificacionesNativas />
    </div>
  )
}

/** Las normas con su botón de aceptar, sin la navegación del canal. */
function PantallaNormas() {
  return (
    <div className="canal flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 pt-[max(1.5rem,var(--seguro-arriba))] pr-[max(1rem,var(--seguro-der))] pb-[max(1.5rem,var(--seguro-abajo))] pl-[max(1rem,var(--seguro-izq))]">
        <Image
          src="/marca/iberia.png"
          alt="Industrias Iberia"
          width={1400}
          height={362}
          priority
          style={{ height: 28, width: 'auto' }}
        />
        <p className="rotulo mt-8">Antes de entrar</p>
        <h1 className="mt-2 text-[24px] leading-tight font-bold tracking-tight text-balance text-marca-900">
          Normas de uso del canal
        </h1>

        <article className="tarjeta-canal mt-5 px-5 py-6">
          <NormasDeUso />
        </article>

        <div className="mt-5">
          <AceptarNormas />
        </div>
      </main>
    </div>
  )
}
