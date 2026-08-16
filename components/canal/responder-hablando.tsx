'use client'

import { useEffect, useRef, useState } from 'react'
import { aWavDe16k, formatoDeGrabacion } from '@/lib/wav'
import { cn } from '@/lib/utils'

/** El endpoint de audio corto de Azure no pasa de aquí. */
const TOPE_SEGUNDOS = 60

type Estado =
  | { fase: 'listo' }
  | { fase: 'grabando'; segundos: number }
  | { fase: 'oyendo' }
  | { fase: 'confirmar'; texto: string; ruta: string }
  | { fase: 'no-se-entendio' }
  | { fase: 'fallo'; detalle: string }

/**
 * Contestar hablando.
 *
 * Es la puerta del curso, no un accesorio: media planta escribe poco, y si esto
 * no funciona el adiestramiento no llega al último eslabón. De ahí tres cosas
 * que no son adorno:
 *
 *  · **Se muestra lo que se entendió antes de darlo por bueno.** Es lo que MAIA
 *    resuelve bien y hay que copiar: una mala transcripción sin confirmar se
 *    convierte en una mala respuesta guardada para siempre. Y el texto se puede
 *    corregir a mano ahí mismo.
 *  · **Siempre se puede escribir en vez de hablar**, y al revés. No hay una vía
 *    de primera y otra de segunda.
 *  · **Cuando no se entiende no se dice que algo falló.** Ruido de máquina o
 *    silencio no son errores del sistema: se dice que no se oyó bien y se
 *    repite.
 */
export function ResponderHablando({
  numero,
  clavePaso,
  onListo,
  onEscribir,
}: {
  numero: number
  clavePaso: string
  /** Texto confirmado y ruta del audio guardado. */
  onListo: (texto: string, ruta: string) => void
  onEscribir: () => void
}) {
  const [estado, setEstado] = useState<Estado>({ fase: 'listo' })
  const [texto, setTexto] = useState('')
  const grabadora = useRef<MediaRecorder | null>(null)
  const trozos = useRef<Blob[]>([])
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (reloj.current) clearInterval(reloj.current)
      grabadora.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function empezar() {
    const formato = formatoDeGrabacion()
    if (!formato) {
      setEstado({ fase: 'fallo', detalle: 'Este teléfono no deja grabar desde el navegador.' })
      return
    }

    let micro: MediaStream
    try {
      micro = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setEstado({
        fase: 'fallo',
        detalle: 'No se pudo usar el micrófono. Búscalo en los permisos del navegador.',
      })
      return
    }

    trozos.current = []
    const rec = new MediaRecorder(micro, { mimeType: formato })
    grabadora.current = rec

    rec.ondataavailable = (evento) => {
      if (evento.data.size) trozos.current.push(evento.data)
    }
    rec.onstop = () => {
      micro.getTracks().forEach((t) => t.stop())
      void procesar(new Blob(trozos.current, { type: formato }))
    }

    rec.start()
    setEstado({ fase: 'grabando', segundos: 0 })

    reloj.current = setInterval(() => {
      setEstado((previo) => {
        if (previo.fase !== 'grabando') return previo
        const segundos = previo.segundos + 1
        // Se corta solo en el tope: más vale una nota completa de 60 s que una
        // de 90 que el servicio rechaza después de haberla subido.
        if (segundos >= TOPE_SEGUNDOS) detener()
        return { fase: 'grabando', segundos }
      })
    }, 1000)
  }

  function detener() {
    if (reloj.current) clearInterval(reloj.current)
    reloj.current = null
    if (grabadora.current?.state === 'recording') grabadora.current.stop()
  }

  async function procesar(grabado: Blob) {
    setEstado({ fase: 'oyendo' })

    try {
      const wav = await aWavDe16k(grabado)
      const cuerpo = new FormData()
      cuerpo.append('audio', new Blob([wav], { type: 'audio/wav' }), 'nota.wav')
      cuerpo.append('clave_paso', clavePaso)

      const respuesta = await fetch(`/canal/adiestramiento/${numero}/adjuntar`, {
        method: 'POST',
        body: cuerpo,
      })

      if (!respuesta.ok) {
        setEstado({ fase: 'fallo', detalle: 'No se pudo mandar la nota. Intenta otra vez.' })
        return
      }

      const datos = (await respuesta.json()) as { texto?: string; ruta: string; motivo?: string }

      if (!datos.texto) {
        setEstado({ fase: 'no-se-entendio' })
        return
      }

      setTexto(datos.texto)
      setEstado({ fase: 'confirmar', texto: datos.texto, ruta: datos.ruta })
    } catch {
      setEstado({ fase: 'fallo', detalle: 'No se pudo preparar el audio. Intenta otra vez.' })
    }
  }

  // ---------------------------------------------------------------------------

  if (estado.fase === 'confirmar') {
    return (
      <div className="mt-3 space-y-3">
        <p className="text-[13px] font-semibold text-marca-600">Esto fue lo que te entendí:</p>

        <textarea
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          rows={4}
          className="campo w-full resize-y text-[15px]"
          aria-label="Lo que Ajito entendió. Puedes corregirlo."
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onListo(texto.trim(), estado.ruta)}
            disabled={!texto.trim()}
            className="btn-canal btn-canal-rojo min-w-[45%] flex-1"
          >
            Así fue
          </button>
          <button
            type="button"
            onClick={() => setEstado({ fase: 'listo' })}
            className="btn-canal btn-canal-suave min-w-[45%] flex-1"
          >
            Grabar otra vez
          </button>
        </div>

        <p className="text-[13px] leading-relaxed text-marca-400">
          Si cambió alguna palabra, corrígela ahí arriba antes de mandarla.
        </p>
      </div>
    )
  }

  if (estado.fase === 'oyendo') {
    return (
      <p className="mt-3 flex min-h-14 items-center gap-2 text-[15px] text-marca-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-acento-600" />
        Ajito está oyendo lo que dijiste…
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-3">
      {estado.fase === 'no-se-entendio' && (
        <p className="rounded-xl bg-oro-300/25 px-3 py-2 text-[14px] leading-relaxed text-marca-700">
          No te oí bien. Búscate un rincón con menos ruido y repítelo, que aquí te espero.
        </p>
      )}

      {estado.fase === 'fallo' && (
        <p className="rounded-xl bg-acento-50 px-3 py-2 text-[14px] leading-relaxed text-acento-700">
          {estado.detalle}
        </p>
      )}

      <button
        type="button"
        onClick={estado.fase === 'grabando' ? detener : empezar}
        className={cn(
          'flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-5 text-[15px] font-semibold transition-colors',
          estado.fase === 'grabando'
            ? 'bg-marca-800 text-white active:bg-marca-900'
            : 'bg-acento-600 text-white active:bg-acento-700'
        )}
      >
        {estado.fase === 'grabando' ? (
          <>
            <span className="h-3 w-3 animate-pulse rounded-sm bg-white" />
            Listo · {reloj_(estado.segundos)}
          </>
        ) : (
          <>
            <IconoMicro />
            {estado.fase === 'listo' ? 'Grabar una nota de voz' : 'Grabar otra vez'}
          </>
        )}
      </button>

      {estado.fase === 'grabando' ? (
        <p className="text-center text-[13px] text-marca-400">
          Habla tranquilo. Toca arriba cuando termines — máximo un minuto.
        </p>
      ) : (
        <button
          type="button"
          onClick={onEscribir}
          className="toque w-full text-[14px] font-medium text-marca-500 underline underline-offset-4 active:text-marca-800"
        >
          Prefiero escribirlo
        </button>
      )}
    </div>
  )
}

function reloj_(segundos: number): string {
  return `0:${String(segundos).padStart(2, '0')}`
}

function IconoMicro() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Z" />
      <path d="M18.5 11.5a.9.9 0 0 0-1.8 0 4.7 4.7 0 0 1-9.4 0 .9.9 0 0 0-1.8 0 6.5 6.5 0 0 0 5.6 6.4V21a.9.9 0 0 0 1.8 0v-3.1a6.5 6.5 0 0 0 5.6-6.4Z" />
    </svg>
  )
}
