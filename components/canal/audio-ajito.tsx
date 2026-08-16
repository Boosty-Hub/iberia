'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * La clase de Ajito: una nota de voz.
 *
 * Se parece a propósito a una nota de voz de WhatsApp, porque ese es el modelo
 * mental de quien la va a oír — nadie en esa planta ha usado un reproductor de
 * podcast, pero todo el mundo manda audios todos los días.
 *
 * Tres cosas que no son adorno:
 *
 *  · **Toda la fila se toca**, no solo el botón. Con guantes, un objetivo de
 *    56 px falla; uno de ancho completo, no.
 *  · **Se marca lo ya oído.** El curso se hace a ratos, de pie, en el comedor;
 *    hay que poder volver y ver por dónde iba uno.
 *  · **`preload="none"`.** Nueve lecciones abriéndose solas serían megabytes
 *    del plan de datos del trabajador gastados sin que él le diera a nada.
 */
export function AudioAjito({
  src,
  etiqueta,
  segundos,
}: {
  src: string
  etiqueta: string
  /** Lo que dice el guion. Sirve de rótulo antes de que el archivo cargue. */
  segundos: number | null
}) {
  const ref = useRef<HTMLAudioElement>(null)
  const [sonando, setSonando] = useState(false)
  const [oido, setOido] = useState(false)
  const [posicion, setPosicion] = useState(0)
  const [duracion, setDuracion] = useState<number | null>(segundos)
  const [error, setError] = useState(false)

  useEffect(() => {
    const audio = ref.current
    if (!audio) return

    const alTiempo = () => setPosicion(audio.currentTime)
    const alCargar = () => {
      if (Number.isFinite(audio.duration)) setDuracion(audio.duration)
    }
    const alTerminar = () => {
      setSonando(false)
      setOido(true)
      setPosicion(0)
    }

    audio.addEventListener('timeupdate', alTiempo)
    audio.addEventListener('loadedmetadata', alCargar)
    audio.addEventListener('ended', alTerminar)
    audio.addEventListener('error', () => setError(true))

    return () => {
      audio.removeEventListener('timeupdate', alTiempo)
      audio.removeEventListener('loadedmetadata', alCargar)
      audio.removeEventListener('ended', alTerminar)
    }
  }, [])

  async function alternar() {
    const audio = ref.current
    if (!audio) return

    if (sonando) {
      audio.pause()
      setSonando(false)
      return
    }

    // Solo puede sonar uno a la vez: si no, quien toque dos seguidos oye a dos
    // Ajitos encima.
    for (const otro of document.querySelectorAll('audio')) {
      if (otro !== audio) otro.pause()
    }

    try {
      await audio.play()
      setSonando(true)
    } catch {
      setError(true)
    }
  }

  const total = duracion ?? 0
  const avance = total ? Math.min(100, (posicion / total) * 100) : 0

  return (
    <div
      className={cn(
        'tarjeta-canal flex items-center gap-3 px-3 py-3 transition-colors',
        sonando && 'ring-2 ring-acento-500/30'
      )}
    >
      <audio ref={ref} src={src} preload="none" />

      <button
        type="button"
        onClick={alternar}
        disabled={error}
        aria-label={sonando ? `Pausar ${etiqueta}` : `Escuchar ${etiqueta}`}
        className={cn(
          'grid h-14 w-14 shrink-0 place-items-center rounded-full transition-colors',
          'focus-visible:ring-2 focus-visible:ring-acento-500/40 focus-visible:outline-none',
          error
            ? 'bg-marca-100 text-marca-400'
            : oido && !sonando
              ? 'bg-marca-100 text-marca-700 active:bg-marca-200'
              : 'bg-acento-600 text-white active:bg-acento-700'
        )}
      >
        {sonando ? <IconoPausa /> : <IconoPlay />}
      </button>

      <button
        type="button"
        onClick={alternar}
        disabled={error}
        className="min-w-0 flex-1 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <Image
            src="/marca/ajito.png"
            alt=""
            width={80}
            height={80}
            className="h-5 w-5 shrink-0 object-contain"
          />
          <span className="truncate text-[14px] font-semibold text-marca-800">
            {error ? 'No se pudo cargar el audio' : oido && !sonando ? 'Ya lo oíste' : etiqueta}
          </span>
        </span>

        <span className="mt-2 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-marca-100">
            <span
              className="block h-full rounded-full bg-acento-600 transition-[width] duration-150"
              style={{ width: `${avance}%` }}
            />
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-marca-500">
            {reloj(sonando || posicion > 0 ? total - posicion : total)}
          </span>
        </span>
      </button>
    </div>
  )
}

function reloj(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '—'
  const s = Math.round(segundos)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function IconoPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-6 w-6" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11.14-6.86a1 1 0 0 0 0-1.72L9.5 4.28A1 1 0 0 0 8 5.14Z" />
    </svg>
  )
}

function IconoPausa() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />
    </svg>
  )
}
