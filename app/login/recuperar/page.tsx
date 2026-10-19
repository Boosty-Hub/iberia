import type { Metadata } from 'next'
import Link from 'next/link'
import { Marca } from '@/components/marca'
import { FormularioRecuperar } from './formulario-recuperar'

export const metadata: Metadata = { title: 'Recuperar la contraseña' }

/**
 * Primer paso de «olvidé mi contraseña»: se pide el correo y Supabase manda el
 * enlace. `?aviso=vencido` llega desde `/auth/confirmar` cuando el enlace del
 * correo ya no sirve.
 */
export default async function RecuperarPage({ searchParams }: PageProps<'/login/recuperar'>) {
  const params = await searchParams
  const vencido = params.aviso === 'vencido'

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Marca alto={42} />
        </div>

        <div className="tarjeta p-6">
          <p className="rotulo mb-3">Acceso restringido</p>
          <h1 className="mb-1 text-xl font-bold text-marca-900">Recupera tu contraseña</h1>
          <p className="mb-6 text-sm text-marca-600">
            Escribe el correo de tu cuenta y te mandamos un enlace para crear una contraseña nueva.
          </p>

          {vencido && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
            >
              Ese enlace ya no sirve: venció o ya se usó. Pide uno nuevo aquí abajo.
            </p>
          )}

          <FormularioRecuperar />
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="font-medium text-marca-600 underline-offset-2 hover:underline">
            Volver a entrar
          </Link>
        </p>
      </div>
    </main>
  )
}
