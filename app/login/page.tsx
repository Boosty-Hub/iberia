import type { Metadata } from 'next'
import { Marca } from '@/components/marca'
import { FormularioLogin } from './formulario-login'

export const metadata: Metadata = { title: 'Acceso' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const destinoParam = Array.isArray(params.destino) ? params.destino[0] : params.destino
  const destino =
    destinoParam && destinoParam.startsWith('/') && !destinoParam.startsWith('//')
      ? destinoParam
      : '/dashboard'

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* En la portada el logo lleva más peso que en la navegación. */}
        <div className="mb-8">
          <Marca alto={42} />
        </div>

        <div className="tarjeta p-6">
          <p className="rotulo mb-3">Acceso restringido</p>
          <h1 className="mb-1 text-xl font-bold text-marca-900">Entra al programa</h1>
          <p className="mb-6 text-sm text-marca-600">
            Las cuentas las provisiona el equipo de Boosty. No hay registro abierto.
          </p>

          <FormularioLogin destino={destino} />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-marca-400">
          Información confidencial de Industrias Iberia bajo acuerdo de confidencialidad.
          <br />
          Boosty International LLC · Anthropic Partner
        </p>
      </div>
    </main>
  )
}
