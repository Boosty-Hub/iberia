import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Marca } from '@/components/marca'
import { usarEnlace } from './acciones'
import { TIPOS_ENLACE } from './tipos'
import { BotonContinuar } from './boton-continuar'

export const metadata: Metadata = { title: 'Continuar', robots: { index: false, follow: false } }

const TEXTOS: Record<string, { titulo: string; texto: string; boton: string }> = {
  recovery: { titulo: 'Crea tu contraseña nueva', texto: 'Toca «Continuar» para crear tu contraseña nueva.', boton: 'Continuar' },
  invite: { titulo: 'Activa tu cuenta', texto: 'Toca «Continuar» para crear tu contraseña y entrar por primera vez.', boton: 'Continuar' },
  magiclink: { titulo: 'Entra a la plataforma', texto: 'Toca «Entrar» para abrir tu sesión.', boton: 'Entrar' },
  email: { titulo: 'Confirma tu correo', texto: 'Toca «Confirmar» para terminar de activar tu cuenta.', boton: 'Confirmar' },
  signup: { titulo: 'Confirma tu correo', texto: 'Toca «Confirmar» para terminar de activar tu cuenta.', boton: 'Confirmar' },
  email_change: { titulo: 'Confirma el cambio de correo', texto: 'Toca «Confirmar» para cambiar el correo de tu cuenta.', boton: 'Confirmar' },
}

/**
 * La puerta de los enlaces de los correos de Supabase (`lib/correo/plantillas-auth.ts`).
 *
 * 🔴 **Abrirla no usa el enlace: lo usa el botón.** Microsoft 365 (Safe Links,
 * Defender) y otros filtros abren cada enlace de un correo antes que la persona, para
 * revisarlo. Si el enlace se consumiera con ese GET —como `/auth/confirmar`—, a la
 * persona le llegaría gastado. Un filtro abre la página, pero no manda el formulario.
 */
export default async function ContinuarPage({ searchParams }: PageProps<'/auth/continuar'>) {
  const params = await searchParams
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const tokenHash = uno(params.token_hash)
  const tipo = uno(params.type)
  const siguiente = uno(params.siguiente)
  if (!tokenHash || !(TIPOS_ENLACE as readonly string[]).includes(tipo)) redirect('/login/recuperar?aviso=vencido')
  const t = TEXTOS[tipo]

  return (
    <main className="flex flex-1 items-center justify-center pt-[max(3rem,var(--seguro-arriba))] pr-[max(1rem,var(--seguro-der))] pb-[max(3rem,var(--seguro-abajo))] pl-[max(1rem,var(--seguro-izq))]">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Marca alto={42} />
        </div>

        <div className="tarjeta p-6">
          <p className="rotulo mb-3">Acceso restringido</p>
          <h1 className="mb-1 text-xl font-bold text-marca-900">{t.titulo}</h1>
          <p className="mb-6 text-sm text-marca-600">{t.texto}</p>
          <form action={usarEnlace}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={tipo} />
            <input type="hidden" name="siguiente" value={siguiente} />
            <BotonContinuar texto={t.boton} />
          </form>
        </div>
      </div>
    </main>
  )
}
