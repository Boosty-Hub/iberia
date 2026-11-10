import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { NormasDeUso } from '@/components/normas-de-uso'

export const metadata: Metadata = {
  title: { absolute: 'Normas de uso del canal · Iberia' },
  description:
    'Las normas de convivencia del canal de Industrias Iberia: qué no se permite, cómo reportar y bloquear, y qué hace el equipo.',
}

/**
 * Las normas de uso del canal, públicas (`RUTAS_PUBLICAS` en
 * `lib/supabase/sesion.ts`): Apple pide que se puedan leer sin cuenta. El texto
 * es el mismo que se acepta al entrar al canal (`NormasDeUso`).
 */
export default function NormasPage() {
  return (
    <main className="canal flex min-h-full flex-1 flex-col pt-[max(2.5rem,var(--seguro-arriba))] pr-[max(1rem,var(--seguro-der))] pb-[max(2.5rem,var(--seguro-abajo))] pl-[max(1rem,var(--seguro-izq))] sm:pt-[max(3.5rem,var(--seguro-arriba))] sm:pb-[max(3.5rem,var(--seguro-abajo))]">
      <div className="mx-auto w-full max-w-2xl">
        <Image
          src="/marca/iberia.png"
          alt="Industrias Iberia"
          width={1400}
          height={362}
          priority
          style={{ height: 34, width: 'auto' }}
        />

        <p className="rotulo mt-10">Normas de uso</p>
        <h1 className="mt-3 text-[26px] leading-tight font-bold tracking-tight text-balance text-marca-900 sm:text-3xl">
          Normas de uso del canal
        </h1>
        <p className="mt-3 text-sm text-marca-500">Vigentes desde el 10 de noviembre de 2026</p>

        <article className="tarjeta-canal mt-8 px-5 py-6 sm:px-8 sm:py-8">
          <NormasDeUso />
        </article>

        <nav className="mt-8 flex flex-wrap justify-center gap-x-2 text-sm">
          <Link href="/soporte" className="toque px-2 font-medium text-acento-600">
            Soporte
          </Link>
          <Link href="/privacidad" className="toque px-2 font-medium text-acento-600">
            Política de privacidad
          </Link>
        </nav>

        <p className="mt-4 text-center text-xs leading-relaxed text-marca-400">
          Industrias Iberia · App operada por Boosty Digital
        </p>
      </div>
    </main>
  )
}
