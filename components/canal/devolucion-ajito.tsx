'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AudioAjito } from '@/components/canal/audio-ajito'

/**
 * Lo que Ajito contesta.
 *
 * Es la mitad del curso que no se puede grabar por adelantado: hasta aquí Ajito
 * decía lo mismo a las doscientas personas, y de aquí en adelante contesta lo
 * que esta persona mandó. Sin esto, el curso es un video largo.
 *
 * **Se pide desde el navegador y no al guardar la respuesta.** Guardar lo que la
 * persona dijo es lo que no se puede perder, y eso ya pasó antes de que esto se
 * monte. Si el modelo tarda, se cae o Azure no llega, la respuesta está a salvo
 * y aquí sale un botón para volver a intentarlo — no un formulario perdido.
 *
 * Y si vuelve mañana y quedó sin contestar, se pide sola al abrir la lección:
 * la persona no tiene que saber que algo falló la vez pasada.
 */
export function DevolucionAjito({
  numero,
  clave,
  texto,
  tieneAudio,
  autoPedir,
  intentada,
}: {
  numero: number
  clave: string
  /** Lo ya generado. Nulo mientras no exista: entonces hay que pedirlo. */
  texto: string | null
  tieneAudio: boolean
  /**
   * Si le toca a este pedir la suya ahora.
   *
   * Solo es cierto para el primer ejercicio de la lección al que le falte
   * devolución. Los demás esperan su turno y no dibujan nada mientras tanto.
   * Sin esto, abrir una lección con cuatro respuestas viejas dispara cuatro
   * llamadas al modelo a la vez —con sus cuatro fotos— y en una conexión de
   * planta se caen las cuatro juntas. Se llenan de una en una, de arriba abajo,
   * que además es como se leen.
   */
  autoPedir: boolean
  /**
   * Si ya se le pidió alguna vez.
   *
   * Con esto puesto y sin texto, el intento anterior falló. Entonces este
   * ejercicio sale de la cola —para no congelar detrás de sí el resto de la
   * lección— y enseña su botón, sin pedir nada por su cuenta.
   */
  intentada: boolean
}) {
  const router = useRouter()
  const [estado, setEstado] = useState<'pensando' | 'fallo' | 'quieto'>(
    texto ? 'quieto' : autoPedir ? 'pensando' : 'fallo'
  )
  // React monta dos veces en desarrollo. Sin esto, dos llamadas al modelo por
  // cada ejercicio — y las dos se cobran.
  const pedida = useRef(false)

  useEffect(() => {
    if (texto || !autoPedir || pedida.current) return
    pedida.current = true
    void pedir()
    // Se pide una vez por montaje. `pedir` no cambia entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, autoPedir])

  async function pedir() {
    setEstado('pensando')
    try {
      const respuesta = await fetch(`/canal/adiestramiento/${numero}/devolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave_paso: clave }),
      })
      if (!respuesta.ok) throw new Error()
      router.refresh()
    } catch {
      setEstado('fallo')
    }
  }

  if (!texto) {
    // Ni le toca ni se ha intentado: está en la cola. No dibuja nada — un
    // cargando eterno debajo de una respuesta ya contestada se lee como que
    // algo se trabó.
    if (!autoPedir && !intentada) return null

    if (estado === 'fallo') {
      return (
        <div className="mt-3 space-y-2">
          <p className="rounded-xl bg-oro-300/25 px-3 py-2 text-[14px] leading-relaxed text-marca-700">
            No pude contestarte ahorita. Tu respuesta quedó guardada.
          </p>
          <button
            type="button"
            onClick={() => {
              pedida.current = true
              void pedir()
            }}
            className="btn-canal btn-canal-suave w-full"
          >
            Intentar otra vez
          </button>
        </div>
      )
    }

    return (
      <p className="mt-3 flex min-h-11 items-center gap-2 text-[15px] text-marca-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-acento-600" />
        Ajito está viendo lo que le mandaste…
      </p>
    )
  }

  return (
    // `data-devolucion` no pinta nada: lo lee `capturar:devoluciones` para
    // comprobar que Ajito contestó y qué dijo.
    <div className="mt-3 space-y-2" data-devolucion={clave}>
      {tieneAudio ? (
        <AudioAjito
          src={`/canal/adiestramiento/${numero}/devolucion/${clave}`}
          etiqueta="Ajito te contesta"
          segundos={null}
        />
      ) : null}

      {/* El texto va siempre, con audio o sin él. Con audio es la letra de lo
          que se está oyendo —vale para quien tiene el teléfono en silencio o
          está en el comedor con ruido—; sin audio, es la devolución entera. */}
      <p
        data-devolucion-texto
        className="rounded-xl bg-marca-50 px-4 py-3 text-[15px] leading-relaxed whitespace-pre-line text-marca-700"
      >
        {texto}
      </p>
    </div>
  )
}
