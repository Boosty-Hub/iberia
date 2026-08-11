import type { Metadata, Viewport } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { obtenerSesion } from '@/lib/auth'
import { empleadoActual } from '@/lib/canal'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Entrar' }
export const viewport: Viewport = { themeColor: '#D4332C', width: 'device-width', initialScale: 1 }

/**
 * Fuera del layout del canal a propósito: si heredara el que exige empleado,
 * el redirect se cerraría sobre sí mismo.
 */
export default async function EntrarCanalPage() {
  const empleado = await empleadoActual()
  if (empleado) redirect('/canal')

  const sesion = await obtenerSesion()

  return (
    <main className="canal flex min-h-full flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <Image
          src="/marca/iberia.png"
          alt="Industrias Iberia"
          width={1400}
          height={362}
          priority
          style={{ height: 34, width: 'auto' }}
        />

        <h1 className="mt-8 text-[26px] leading-tight font-bold tracking-tight text-marca-900">
          El canal de nuestra gente
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-marca-600">
          Comunicados, noticias y las historias de quienes hacemos Iberia.
        </p>

        <div className="tarjeta-canal mt-8 p-5">
          {sesion ? (
            <>
              <p className="text-[15px] leading-relaxed text-marca-700">
                Entraste como <strong>{sesion.email}</strong>, pero esa cuenta todavía
                no está asociada a una ficha del padrón.
              </p>
              <p className="mt-3 text-sm text-marca-500">
                Capital Humano es quien incorpora al personal al canal.
              </p>
              <Link href="/dashboard" className="btn-canal btn-canal-suave mt-5 w-full">
                Ir al panel del programa
              </Link>
            </>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-marca-700">
                Para entrar, toca el enlace que te llega por WhatsApp cuando la
                empresa publica un comunicado. No hace falta contraseña.
              </p>
              <p className="mt-3 text-sm text-marca-500">
                El enlace es personal: te reconoce y te deja adentro.
              </p>
              <Link href="/login" className="btn-canal btn-canal-suave mt-5 w-full">
                Tengo usuario y contraseña
              </Link>
            </>
          )}
        </div>

        <p className="mt-8 text-center text-xs leading-relaxed text-marca-400">
          Industrias Iberia · Uso interno
        </p>
      </div>
    </main>
  )
}
