'use client'

import { useEffect } from 'react'

/**
 * La pantalla de error de toda la aplicación, en lugar de la de Next. Dice qué
 * falló —el mensaje técnico va pequeño, abajo— porque dentro de la app del
 * iPhone no hay consola que mirar sin un Mac: una captura de esta pantalla es
 * todo el diagnóstico que llega. Un error del servidor solo trae su `digest`;
 * el detalle no sale al navegador.
 */
export default function ErrorDeLaApp({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return <PantallaDeError error={error} retry={retry} />
}

export function PantallaDeError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  const detalle = [error.name, error.message, error.digest && `digest ${error.digest}`]
    .filter(Boolean)
    .join(' · ')
  const donde = (error.stack ?? '').split('\n').slice(0, 3).join('\n')

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center bg-[#f6f7f9] px-6 text-center"
      style={{
        paddingTop: 'max(3rem, env(safe-area-inset-top))',
        paddingBottom: 'max(3rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-black/5 bg-white px-6 py-8 shadow-sm">
        <h1 className="text-xl font-bold text-[#2a2522]">No se pudo cargar esta pantalla</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-[#5c5550]">
          Intenta otra vez. Si se repite, toma una captura de esta pantalla y mándasela al equipo.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="min-h-11 rounded-xl bg-[#D4332C] px-4 font-semibold text-white"
          >
            Intentar otra vez
          </button>
          <a
            href="/canal"
            className="flex min-h-11 items-center justify-center rounded-xl border border-black/10 px-4 font-semibold text-[#2a2522]"
          >
            Volver al inicio
          </a>
        </div>
        <p className="mt-6 break-words text-left font-mono text-[11px] leading-snug text-[#8a827c]">
          {detalle}
        </p>
        {donde && (
          <pre className="mt-2 whitespace-pre-wrap break-words text-left font-mono text-[10px] leading-snug text-[#a39b95]">
            {donde}
          </pre>
        )}
      </div>
    </main>
  )
}
