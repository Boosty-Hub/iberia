'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * La clase de Ajito: una nota de voz.
 *
 * Se parece a propósito a una nota de voz de WhatsApp, porque ese es el modelo
 * mental de quien la va a oír — nadie en esa planta ha usado un reproductor de
 * podcast, pero todo el mundo manda audios todos los días.
 *
 * ── Los cuatro estados, y por qué se ven distintos ──────────────────────────
 *
 * Quien oye esto está de pie en un comedor con ruido, mirando un teléfono a un
 * brazo de distancia y con dos minutos libres. **El estado tiene que leerse de
 * un vistazo, sin fijarse.** Así que cada uno cambia el color de la tarjeta
 * completa, no solo un detalle:
 *
 *   sin oír    tarjeta blanca · botón rojo con ▶     «toca aquí»
 *   cargando   tarjeta blanca · botón rojo girando   «ya va, está bajando»
 *   sonando    tarjeta DORADA · botón dorado con ⏸   «esto es lo que suena»
 *   ya oído    tarjeta blanca · botón gris con ✓     «esta ya la pasaste»
 *
 * El dorado es el destacado del canal —`oro-300`, el mismo de lo oficial— y es
 * lo más brillante que hay en la paleta: en una lista de ocho audios, el que
 * suena se encuentra sin buscarlo. **No se metió un verde para «ya oído».** La
 * paleta del canal son tres familias a propósito, y una cuarta rompería el
 * lenguaje visual del producto entero; lo que separa «ya oído» de «apagado» es
 * el **✓**, que es forma y no tono — la misma regla que separa la acción del
 * peligro en el resto del aplicativo.
 *
 * ── Lo demás que no es adorno ───────────────────────────────────────────────
 *
 *  · **Toda la fila se toca**, no solo el botón. Con guantes, un objetivo de
 *    56 px falla; uno de ancho completo, no.
 *  · **`preload="none"`.** Nueve lecciones abriéndose solas serían megabytes
 *    del plan de datos del trabajador gastados sin que él le diera a nada. El
 *    precio de eso es que el primer toque **siempre** espera: de ahí que el
 *    estado de carga no sea un lujo.
 *  · **El estado sale de los eventos del `<audio>`, no de la promesa de
 *    `play()`.** Esa promesa resuelve cuando el sonido arranca, así que entre el
 *    toque y ella hay un hueco de segundos en una conexión de planta — y el
 *    hueco era justamente lo que no se veía. `waiting` vuelve a poner el
 *    cargando si el buffer se queda corto a mitad, que en el piso pasa.
 *  · **La barra se arrastra**, como la de WhatsApp: para volver a oír una
 *    frase o saltarse lo que ya se oyó. Es un `<input type="range">` de 44 px
 *    de alto y va **fuera** del botón —un control dentro de otro no se puede
 *    tocar—. Con `preload="none"` el archivo no existe hasta el primer toque,
 *    así que un arrastre anterior se guarda y se aplica cuando llega.
 *  · **Cada audio de la lección dice cuál es** —«3 de 8»—, para saber por
 *    dónde se va sin contar tarjetas.
 */

type Estado = 'quieto' | 'cargando' | 'sonando' | 'oido' | 'error'

export function AudioAjito({
  src,
  etiqueta,
  segundos,
  orden,
}: {
  src: string
  etiqueta: string
  /** Lo que dice el guion. Sirve de rótulo antes de que el archivo cargue. */
  segundos: number | null
  /** Cuál es dentro de la lección. Las devoluciones no llevan: no son de la clase. */
  orden?: { numero: number; total: number }
}) {
  const ref = useRef<HTMLAudioElement>(null)
  // Un arrastre antes de que el archivo cargue: se aplica en `loadedmetadata`.
  const saltoPendiente = useRef<number | null>(null)
  const [estado, setEstado] = useState<Estado>('quieto')
  const [yaOido, setYaOido] = useState(false)
  const [posicion, setPosicion] = useState(0)
  const [duracion, setDuracion] = useState<number | null>(segundos)

  useEffect(() => {
    const audio = ref.current
    if (!audio) return

    const alTiempo = () => setPosicion(audio.currentTime)
    const alCargar = () => {
      if (Number.isFinite(audio.duration)) setDuracion(audio.duration)
      if (saltoPendiente.current !== null) {
        audio.currentTime = Math.min(saltoPendiente.current, audio.duration || Infinity)
        saltoPendiente.current = null
      }
    }
    // `playing` es el que dice que **de verdad** está saliendo sonido. `play()`
    // se dispara antes, con el archivo todavía bajando.
    const alSonar = () => setEstado('sonando')
    const alEsperar = () => setEstado((e) => (e === 'sonando' ? 'cargando' : e))
    const alPausar = () => setEstado((e) => (e === 'error' ? e : yaOido ? 'oido' : 'quieto'))
    const alTerminar = () => {
      setYaOido(true)
      setEstado('oido')
      setPosicion(0)
    }
    const alFallar = () => setEstado('error')

    audio.addEventListener('timeupdate', alTiempo)
    audio.addEventListener('loadedmetadata', alCargar)
    audio.addEventListener('playing', alSonar)
    audio.addEventListener('waiting', alEsperar)
    audio.addEventListener('pause', alPausar)
    audio.addEventListener('ended', alTerminar)
    audio.addEventListener('error', alFallar)

    return () => {
      audio.removeEventListener('timeupdate', alTiempo)
      audio.removeEventListener('loadedmetadata', alCargar)
      audio.removeEventListener('playing', alSonar)
      audio.removeEventListener('waiting', alEsperar)
      audio.removeEventListener('pause', alPausar)
      audio.removeEventListener('ended', alTerminar)
      audio.removeEventListener('error', alFallar)
    }
  }, [yaOido])

  async function alternar() {
    const audio = ref.current
    if (!audio || estado === 'error') return

    // Sonando o cargando, el toque para. Que cargando también pare importa: el
    // primer toque tarda, y quien se arrepiente tiene que poder salirse sin
    // esperar a que arranque un audio que ya no quiere oír.
    if (estado === 'sonando' || estado === 'cargando') {
      audio.pause()
      setEstado(yaOido ? 'oido' : 'quieto')
      return
    }

    // Solo puede sonar uno a la vez: si no, quien toque dos seguidos oye a dos
    // Ajitos encima.
    for (const otro of document.querySelectorAll('audio')) {
      if (otro !== audio) otro.pause()
    }

    // El cargando se pone **antes** de pedir el audio, que es el punto: en el
    // piso, entre el toque y el primer sonido pueden pasar segundos.
    setEstado('cargando')
    try {
      await audio.play()
    } catch {
      setEstado('error')
    }
  }

  function saltar(segundo: number) {
    const audio = ref.current
    setPosicion(segundo)
    if (!audio) return
    // Sin metadatos, mover `currentTime` no hace nada en Safari: se guarda.
    if (audio.readyState >= 1) audio.currentTime = segundo
    else saltoPendiente.current = segundo
  }

  const total = duracion ?? 0
  const avance = total ? Math.min(100, (posicion / total) * 100) : 0
  const activo = estado === 'sonando' || estado === 'cargando'

  const rotulo =
    estado === 'error'
      ? 'No se pudo cargar el audio'
      : estado === 'cargando'
        ? 'Cargando…'
        : estado === 'oido'
          ? 'Ya lo oíste'
          : etiqueta

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-3 py-3 transition-colors',
        estado === 'sonando'
          ? 'border-oro-300 bg-oro-50 shadow-none'
          : estado === 'cargando'
            ? 'border-acento-200 bg-white'
            : 'tarjeta-canal border-transparent'
      )}
    >
      <audio ref={ref} src={src} preload="none" />

      <button
        type="button"
        onClick={alternar}
        disabled={estado === 'error'}
        aria-label={activo ? `Pausar ${etiqueta}` : `Escuchar ${etiqueta}`}
        className={cn(
          'grid h-14 w-14 shrink-0 place-items-center rounded-full transition-colors',
          'focus-visible:ring-2 focus-visible:ring-acento-500/40 focus-visible:outline-none',
          estado === 'error'
            ? 'bg-marca-100 text-marca-400'
            : estado === 'sonando'
              ? 'bg-oro-300 text-marca-900 active:bg-oro-400'
              : estado === 'oido'
                ? 'bg-marca-100 text-marca-600 active:bg-marca-200'
                : 'bg-acento-600 text-white active:bg-acento-700'
        )}
      >
        {estado === 'cargando' ? (
          <IconoCargando />
        ) : estado === 'sonando' ? (
          <IconoPausa />
        ) : estado === 'oido' ? (
          <IconoOido />
        ) : (
          <IconoPlay />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={alternar}
          disabled={estado === 'error'}
          className="flex min-h-11 w-full items-center gap-2 pt-1 text-left"
        >
          <Image
            src="/marca/ajito.png"
            alt=""
            width={80}
            height={80}
            className={cn(
              'h-5 w-5 shrink-0 object-contain transition-opacity',
              estado === 'oido' && 'opacity-50'
            )}
          />
          {/* `aria-live`: quien navega con lector de pantalla también tiene que
              enterarse de que está cargando, no solo quien ve el color. */}
          <span
            aria-live="polite"
            className={cn(
              'min-w-0 flex-1 truncate text-[14px] font-semibold',
              estado === 'sonando'
                ? 'text-marca-900'
                : estado === 'oido'
                  ? 'text-marca-500'
                  : 'text-marca-800'
            )}
          >
            {rotulo}
          </span>
          {orden && (
            <span
              data-orden-audio
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums',
                estado === 'sonando' ? 'bg-oro-200 text-marca-900' : 'bg-marca-100 text-marca-600'
              )}
            >
              {orden.numero} de {orden.total}
            </span>
          )}
        </button>

        <div className="-mt-1 flex items-center gap-2">
          {/* La barra pinta solo la posición de verdad: cargando no se inventa
              avance. La primera versión ponía un trozo latiendo a un tercio del
              ancho y se leía como «va por el 33%», que era un número inventado.
              Lo que dice que hay que esperar es el anillo girando y el rótulo.
              Sonando, el avance va en carbón sobre el dorado: `oro-500` encima
              de `oro-200` no se distinguía a un brazo de distancia. */}
          <input
            type="range"
            min={0}
            max={total || 1}
            step={0.1}
            value={total ? Math.min(posicion, total) : 0}
            disabled={!total || estado === 'error'}
            onChange={(e) => saltar(Number(e.target.value))}
            aria-label={`Mover el audio · ${etiqueta}`}
            aria-valuetext={`${reloj(posicion)} de ${reloj(total)}`}
            className={cn('barra-audio min-w-0 flex-1', estado === 'sonando' && 'sonando')}
            style={{ '--avance': `${avance}%` } as CSSProperties}
          />
          <span
            className={cn(
              'shrink-0 text-[12px] tabular-nums',
              estado === 'sonando' ? 'text-oro-800' : 'text-marca-500'
            )}
          >
            {/* Sin duración todavía —la devolución no trae la del guion— va una
                raya: «0:00» se leía como un audio vacío. */}
            {total ? reloj(activo || posicion > 0 ? total - posicion : total) : '—'}
          </span>
        </div>
      </div>
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

/** El ✓ de «esta ya la pasaste». Es lo que separa el gris de un botón apagado. */
function IconoOido() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d="M4 12.5 9 17.5 20 6.5" />
    </svg>
  )
}

/** Anillo girando. `animate-spin` de Tailwind, sin dependencias. */
function IconoCargando() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 animate-spin" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
