import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { CORREO_SOPORTE } from '@/lib/normas'

export const metadata: Metadata = {
  title: { absolute: 'Soporte · Iberia' },
  description: 'Cómo pedir ayuda con la app de Industrias Iberia: acceso, reportes, bloqueos y borrado de la cuenta.',
}

/**
 * La página de soporte de la app de iOS. Pública (`RUTAS_PUBLICAS` en
 * `lib/supabase/sesion.ts`): es la «URL de soporte» de la ficha de App Store
 * Connect, y Apple la abre sin cuenta.
 */
export default function SoportePage() {
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

        <p className="rotulo mt-10">Soporte</p>
        <h1 className="mt-3 text-[26px] leading-tight font-bold tracking-tight text-balance text-marca-900 sm:text-3xl">
          ¿Necesitas ayuda con la app de Iberia?
        </h1>

        <p className="mt-6 text-[15px] leading-relaxed text-marca-700 sm:text-base">
          La app de Iberia es el canal de comunicación interna de Industrias Iberia y el curso de
          inteligencia artificial que dicta Ajito. Es solo para el personal de la empresa.
        </p>

        <section className="tarjeta-canal mt-8 px-5 py-6 sm:px-8" aria-labelledby="escribenos">
          <h2 id="escribenos" className="text-lg font-bold text-marca-900">
            Escríbenos
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-marca-700">
            Para cualquier duda o problema con la app, escribe a este correo. Te contestamos en
            menos de 24 horas.
          </p>
          <a
            href={`mailto:${CORREO_SOPORTE}`}
            className="btn-canal btn-canal-rojo mt-4 w-full break-all sm:w-auto"
          >
            {CORREO_SOPORTE}
          </a>
        </section>

        <article className="tarjeta-canal prosa mt-4 px-5 py-6 sm:px-8 sm:py-8">
          <h2>No puedo entrar</h2>
          <p>
            Si tu enlace personal de WhatsApp ya no funciona, o no recuerdas tu contraseña,
            escríbenos al correo de arriba con tu nombre y tu número de ficha y te mandamos un
            acceso nuevo. También puedes pedírselo a Capital Humano.
          </p>

          <h2>Reportar algo que te incomoda</h2>
          <p>
            Toca los tres puntos (⋯) al lado de la publicación, el comentario o el mensaje, y
            escoge «Reportar». El equipo lo revisa en menos de 24 horas. La otra persona no sabe
            quién la reportó.
          </p>

          <h2>Bloquear a una persona</h2>
          <p>
            Desde los tres puntos de un mensaje o una publicación, desde la conversación o desde
            el directorio, toca «Bloquear». Dejas de ver lo que escribe y no puede escribirte. Lo
            deshaces en Mi perfil › Personas bloqueadas.
          </p>

          <h2>Borrar tu cuenta o tus datos</h2>
          <p>
            Escríbenos al correo de arriba desde tu correo, o pídeselo a Capital Humano, y
            dinos qué quieres borrar: tu cuenta completa o lo que dejaste en el canal o en el
            curso. Te confirmamos por la misma vía cuando esté hecho.
          </p>
        </article>

        <nav className="mt-8 flex flex-wrap justify-center gap-x-2 text-sm">
          <Link href="/normas" className="toque px-2 font-medium text-acento-600">
            Normas de uso
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
