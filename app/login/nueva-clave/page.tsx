import type { Metadata } from 'next'
import Link from 'next/link'
import { Marca } from '@/components/marca'
import { createClient } from '@/lib/supabase/server'
import { FormularioNuevaClave } from './formulario-nueva-clave'

export const metadata: Metadata = { title: 'Contraseña nueva' }

/**
 * Último paso de «olvidé mi contraseña». Se llega desde `/auth/confirmar` con la
 * sesión de recuperación abierta; sin sesión, el enlace venció y se pide otro.
 */
export default async function NuevaClavePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="flex flex-1 items-center justify-center pt-[max(3rem,var(--seguro-arriba))] pr-[max(1rem,var(--seguro-der))] pb-[max(3rem,var(--seguro-abajo))] pl-[max(1rem,var(--seguro-izq))]">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Marca alto={42} />
        </div>

        <div className="tarjeta p-6">
          <p className="rotulo mb-3">Acceso restringido</p>
          <h1 className="mb-1 text-xl font-bold text-marca-900">Crea tu contraseña nueva</h1>

          {user ? (
            <>
              <p className="mb-6 text-sm text-marca-600">
                Para <span className="font-medium text-marca-800">{user.email}</span>. Al guardarla entras
                directo al programa.
              </p>
              <FormularioNuevaClave />
            </>
          ) : (
            <>
              <p className="mb-6 text-sm text-marca-600">
                El enlace ya venció o ya se usó. Pide uno nuevo y ábrelo apenas te llegue.
              </p>
              <Link href="/login/recuperar" className="btn-acento min-h-11 w-full">
                Pedir otro enlace
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
