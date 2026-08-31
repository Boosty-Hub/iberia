'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import { reiniciarMiCurso } from '@/app/canal/(dentro)/adiestramiento/acciones'

/**
 * Reiniciar el curso, para volver a recorrerlo.
 *
 * Solo lo dibuja el índice del curso cuando quien mira es editor de Boosty: es
 * herramienta de trabajo, no una opción del alumno.
 *
 * **Pide confirmación en dos toques y no con un `confirm()` del navegador.** En
 * un teléfono, el diálogo del sistema aparece pegado arriba y se acepta sin
 * leerlo; aquí la confirmación sale donde estaba el botón, dice exactamente qué
 * se va a borrar, y el que confirma es un botón distinto del que se tocó.
 */
export function ReiniciarCurso() {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  function reiniciar() {
    empezar(async () => {
      const r = await reiniciarMiCurso()
      setConfirmando(false)
      setAviso(r.error ?? r.ok ?? null)
      router.refresh()
    })
  }

  if (aviso) {
    return (
      <p className="mt-3 rounded-xl bg-marca-50 px-4 py-3 text-[13px] leading-relaxed text-marca-600">
        {aviso}
      </p>
    )
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        // `min-h-11` son los 44 px de objetivo táctil del canal. Con `py-2.5`
        // salía en 40 y `capturar:adiestramiento` lo cazó — que es exactamente
        // para lo que mide los objetivos.
        onClick={() => setConfirmando(true)}
        className="mt-3 min-h-11 w-full rounded-xl px-4 py-2.5 text-[13px] font-medium text-marca-500 transition-colors hover:bg-marca-50 hover:text-marca-800"
      >
        Reiniciar el curso
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-acento-200 bg-acento-50/50 p-4">
      <p className="text-[13px] leading-relaxed text-marca-700">
        Se borra <strong>todo tu avance</strong>: las nueve lecciones, tus respuestas con sus
        fotos y notas de voz, lo que Ajito te contestó y el certificado si ya lo tenías. No se
        puede deshacer.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={reiniciar}
          disabled={pendiente}
          className="btn-canal btn-canal-rojo flex-1"
        >
          {pendiente ? 'Borrando…' : 'Sí, reiniciar'}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          disabled={pendiente}
          className="btn-canal btn-canal-suave flex-1"
        >
          Dejarlo así
        </button>
      </div>
    </div>
  )
}
