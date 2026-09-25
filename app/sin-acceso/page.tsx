import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cerrarSesion } from '@/app/login/actions'
import { IconoCandado } from '@/components/iconos'
import { Marca } from '@/components/marca'
import { destinoInicial, requerirSesion } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sin acceso' }

/**
 * A donde cae una cuenta cuyo rol no le abre nada: ni panel, ni canal, ni una
 * sola sección del informe. Sin esta página, `destinoInicial` no tendría a
 * dónde mandarla y el panel la devolvería a sí mismo en bucle.
 */
export default async function SinAccesoPage() {
  const sesion = await requerirSesion()
  // Si el rol ya le abre algo —le cambiaron los permisos—, no se queda aquí.
  const destino = destinoInicial(sesion)
  if (destino !== '/sin-acceso') redirect(destino)

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="tarjeta w-full max-w-md px-6 py-10 text-center">
        <div className="flex justify-center">
          <Marca />
        </div>
        <div className="mx-auto mt-8 flex h-12 w-12 items-center justify-center rounded-full bg-acento-50 text-acento-600">
          <IconoCandado className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-marca-900">Tu cuenta todavía no tiene acceso</h1>
        <p className="mt-2 text-sm text-pretty text-marca-600">
          Entraste como <span className="font-medium text-marca-800">{sesion.email}</span>, con el rol{' '}
          <span className="font-medium text-marca-800">{sesion.rol.nombre}</span>, y ese rol no tiene
          ningún módulo habilitado. Pídele al equipo del programa que te asigne los permisos.
        </p>
        <form action={cerrarSesion} className="mt-6">
          <button type="submit" className="btn-neutro">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  )
}
