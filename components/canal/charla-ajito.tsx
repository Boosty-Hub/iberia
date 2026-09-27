'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { mandarAAjito } from '@/app/canal/(dentro)/adiestramiento/ajito/acciones'
import { ResponderHablando } from '@/components/canal/responder-hablando'
import { IconoAtras, IconoEnviar, IconoLista, IconoMas } from '@/components/iconos'
import { cn } from '@/lib/utils'

const BASE = '/canal/adiestramiento/ajito'

export type MensajeVista = {
  id: string
  de: 'persona' | 'ajito'
  texto: string | null
  entrada: 'texto' | 'voz' | 'foto'
  /** La foto de la persona o el dibujo de Ajito. */
  imagen: boolean
  audio: boolean
  /** Se le pidió respuesta a Ajito y no salió. */
  fallo: boolean
  /** La foto recién tomada, en memoria del teléfono, mientras sube. */
  vistaPrevia?: string
}

type Fase = null | 'pensando' | 'dibujando'

/** Para empezar sin página en blanco: una por cosa que Ajito sabe hacer. */
const SUGERENCIAS = [
  '¿Cómo va a estar el clima hoy en Maracay?',
  'Dibújate jugando béisbol en el estadio',
  'Ayúdame a escribir un mensaje de cumpleaños para mi mamá',
]

/**
 * La conversación con Ajito, como un chat de inteligencia artificial.
 *
 * Lo que la persona manda se guarda primero (`mandarAAjito`) y la respuesta se
 * pide después (`contestar`): si el modelo se cae, lo que dijo no se pierde y
 * queda con su «intentar otra vez». Si pidió un dibujo, en medio va `dibujar`.
 * La voz se pide al final, aparte, para que el texto salga en cuanto está.
 *
 * Al abrir una conversación cuyo último mensaje se quedó sin respuesta —se cerró
 * la página mientras Ajito pensaba—, la pide sola.
 */
export function CharlaAjito({
  charla: inicial,
  mensajes: iniciales,
  charlas,
  soloEditores,
}: {
  charla: string | null
  mensajes: MensajeVista[]
  charlas: { id: string; titulo: string; cuando: string }[]
  /** El interruptor está apagado: solo la ve el equipo, y se le dice. */
  soloEditores: boolean
}) {
  const [charla, setCharla] = useState(inicial)
  const [mensajes, setMensajes] = useState(iniciales)
  const [fase, setFase] = useState<Fase>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [hablando, setHablando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const caja = useRef<HTMLTextAreaElement | null>(null)
  const ocupado = fase !== null || subiendo

  const cambiar = useCallback((id: string, cambio: Partial<MensajeVista>) => {
    setMensajes((todos) => todos.map((m) => (m.id === id ? { ...m, ...cambio } : m)))
  }, [])

  const ponerVoz = useCallback(
    async (id: string) => {
      const r = await fetch(`${BASE}/voz`, { method: 'POST', body: JSON.stringify({ mensaje: id }) }).catch(() => null)
      if (r?.ok) cambiar(id, { audio: true })
    },
    [cambiar]
  )

  /** Pide la respuesta de Ajito a un mensaje ya guardado, con el dibujo en medio si hace falta. */
  const pedirRespuesta = useCallback(
    async (id: string) => {
      setFase('pensando')
      cambiar(id, { fallo: false })
      try {
        for (let vuelta = 0; vuelta < 3; vuelta++) {
          const r = await fetch(`${BASE}/contestar`, { method: 'POST', body: JSON.stringify({ mensaje: id }) })
          if (!r.ok) throw new Error(String(r.status))
          const datos = (await r.json()) as { falta?: 'dibujo'; id: string; texto: string; dibujo: boolean; audio: boolean }
          if (datos.falta === 'dibujo') {
            setFase('dibujando')
            const d = await fetch(`${BASE}/dibujar`, { method: 'POST', body: JSON.stringify({ mensaje: id }) })
            if (!d.ok) throw new Error('dibujo')
            setFase('pensando')
            continue
          }
          setMensajes((todos) => {
            const sin = todos.filter((m) => m.id !== datos.id)
            return [
              ...sin,
              { id: datos.id, de: 'ajito', texto: datos.texto, entrada: 'texto', imagen: datos.dibujo, audio: datos.audio, fallo: false },
            ]
          })
          setFase(null)
          if (!datos.audio) void ponerVoz(datos.id)
          return
        }
        throw new Error('vueltas')
      } catch {
        cambiar(id, { fallo: true })
        setFase(null)
      }
    },
    [cambiar, ponerVoz]
  )

  // Una respuesta que se quedó a medias al cerrar la página: se pide sola. Y la
  // voz de la última de Ajito, si no llegó a ponerse.
  // Va en un temporizador que se cancela al desmontar: en desarrollo el efecto
  // corre dos veces, y así el primero se cancela y pide una sola vez.
  useEffect(() => {
    const t = setTimeout(() => {
      const ultimo = iniciales[iniciales.length - 1]
      if (ultimo?.de === 'persona' && !ultimo.fallo) void pedirRespuesta(ultimo.id)
      if (ultimo?.de === 'ajito' && ultimo.texto && !ultimo.audio) void ponerVoz(ultimo.id)
    }, 0)
    return () => clearTimeout(t)
  }, [iniciales, pedirRespuesta, ponerVoz])

  // Para los mensajes que todavía no tienen id de la base.
  const provisionales = useRef(0)

  // Lo nuevo, a la vista: el chat baja solo.
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }, [mensajes.length, fase])

  async function enviar(dicho: string, entrada: MensajeVista['entrada'], ruta: string | null, vistaPrevia?: string) {
    setAviso(null)
    const provisional = `nuevo-${++provisionales.current}`
    setMensajes((todos) => [
      ...todos,
      { id: provisional, de: 'persona', texto: dicho || null, entrada, imagen: entrada === 'foto', audio: false, fallo: false, vistaPrevia },
    ])
    setFase('pensando')

    const datos = new FormData()
    datos.set('charla', charla ?? '')
    datos.set('texto', dicho)
    datos.set('entrada', entrada)
    datos.set('media_url', ruta ?? '')
    const r = await mandarAAjito(datos).catch(() => ({ ok: false as const, tope: false }))

    if (!r.ok) {
      setMensajes((todos) => todos.filter((m) => m.id !== provisional))
      setFase(null)
      if (entrada !== 'foto') setTexto(dicho)
      setAviso(
        r.tope
          ? 'Por hoy ya van cuarenta mensajes, que es el tope del día. Mañana seguimos.'
          : 'No se pudo mandar. Intenta otra vez.'
      )
      return
    }

    cambiar(provisional, { id: r.mensaje })
    if (!charla) {
      setCharla(r.charla)
      // La dirección cambia sin volver a cargar: recargar tiene que abrir esta.
      window.history.replaceState(null, '', `${BASE}?c=${r.charla}`)
    }
    await pedirRespuesta(r.mensaje)
  }

  function mandarTexto() {
    const dicho = texto.trim()
    if (!dicho || ocupado) return
    setTexto('')
    if (caja.current) caja.current.style.height = ''
    void enviar(dicho, 'texto', null)
  }

  async function mandarFoto(archivo: File) {
    setSubiendo(true)
    setAviso(null)
    const vista = URL.createObjectURL(archivo)
    const cuerpo = new FormData()
    cuerpo.append('audio', archivo)
    try {
      const r = await fetch(`${BASE}/adjuntar`, { method: 'POST', body: cuerpo })
      if (!r.ok) throw new Error()
      const { ruta } = (await r.json()) as { ruta: string }
      setSubiendo(false)
      // Lo que tenía escrito va como nota de la foto.
      const nota = texto.trim()
      setTexto('')
      await enviar(nota, 'foto', ruta, vista)
    } catch {
      setSubiendo(false)
      setAviso('No se pudo subir la foto. Intenta otra vez.')
    }
  }

  const vacia = mensajes.length === 0

  return (
    <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col" data-charla={charla ?? 'nueva'}>
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/canal/adiestramiento"
          aria-label="Volver al curso"
          className="-ml-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-marca-500 active:bg-marca-100"
        >
          <IconoAtras className="h-5 w-5" />
        </Link>
        <Image src="/marca/ajito.png" alt="" width={200} height={200} className="h-10 w-10 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-tight font-semibold text-marca-900">Ajito</p>
          <p className="truncate text-[12px] text-marca-500">Pregúntale lo que quieras</p>
        </div>
        {charlas.length > 0 && (
          <details className="relative">
            <summary
              aria-label="Conversaciones anteriores"
              className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full text-marca-500 active:bg-marca-100 [&::-webkit-details-marker]:hidden"
            >
              <IconoLista className="h-5 w-5" />
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-2xl bg-white shadow-[var(--sombra-tarjeta)] ring-1 ring-marca-200/70">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold tracking-[0.12em] text-marca-400 uppercase">
                Tus conversaciones
              </p>
              <ul className="max-h-80 overflow-y-auto pb-2">
                {charlas.map((x) => (
                  <li key={x.id}>
                    <Link
                      href={`${BASE}?c=${x.id}`}
                      className={cn(
                        'block px-4 py-2.5 active:bg-marca-50',
                        x.id === charla && 'bg-oro-300/25'
                      )}
                    >
                      <span className="block truncate text-[14px] text-marca-800">{x.titulo}</span>
                      <span className="block text-[12px] text-marca-400">{cuando(x.cuando)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
        <Link
          href={`${BASE}?nueva=1`}
          aria-label="Conversación nueva"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-marca-500 active:bg-marca-100"
        >
          <IconoMas className="h-5 w-5" />
        </Link>
      </header>

      {soloEditores && (
        <p className="mb-3 rounded-xl bg-oro-300/25 px-3 py-2 text-[13px] leading-relaxed text-marca-700">
          Solo lo ve el equipo: el asistente libre está apagado para el resto. Se prende en el
          panel, en Adiestramiento.
        </p>
      )}

      <div className="flex-1 space-y-3 pb-4">
        {vacia ? (
          <div className="px-2 pt-6 text-center">
            <Image src="/marca/ajito.png" alt="" width={200} height={200} className="mx-auto h-24 w-24 object-contain" />
            <p className="mt-3 text-lg font-bold text-marca-900">Aquí estoy. ¿Qué quieres saber?</p>
            <p className="mx-auto mt-1 max-w-xs text-[14px] leading-relaxed text-marca-500">
              Escríbeme, mándame una nota de voz o una foto. Y si me pides un dibujo, te lo hago.
            </p>
            <div className="mt-5 space-y-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={ocupado}
                  onClick={() => void enviar(s, 'texto', null)}
                  className="toque w-full rounded-2xl bg-white px-4 text-left text-[14px] text-marca-700 ring-1 ring-marca-200/70 active:bg-marca-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          mensajes.map((m) =>
            m.de === 'persona' ? (
              <div key={m.id} className="flex flex-col items-end" data-mensaje="persona">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-acento-600 px-3.5 py-2.5 text-white">
                  {m.imagen && (
                    // eslint-disable-next-line @next/next/no-img-element -- la sirve una ruta con sesión que redirige a un enlace firmado
                    <img
                      src={m.vistaPrevia ?? `${BASE}/media/${m.id}`}
                      alt="La foto que mandaste"
                      className="mb-1.5 max-h-64 w-auto rounded-xl object-contain"
                    />
                  )}
                  {m.entrada === 'voz' && (
                    <p className="mb-0.5 text-[11px] font-semibold text-white/75">Nota de voz</p>
                  )}
                  {m.texto && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.texto}</p>}
                </div>
                {m.fallo && (
                  <p className="mt-1 text-[13px] text-marca-500">
                    Ajito no pudo contestar.{' '}
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => void pedirRespuesta(m.id)}
                      className="font-semibold text-acento-700 underline underline-offset-4"
                    >
                      Intentar otra vez
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <div key={m.id} className="flex items-end gap-2" data-mensaje="ajito">
                <Image src="/marca/ajito.png" alt="" width={200} height={200} className="h-7 w-7 shrink-0 object-contain" />
                <div className="max-w-[85%] min-w-0 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-marca-900 ring-1 ring-marca-200/70">
                  {m.imagen && (
                    // eslint-disable-next-line @next/next/no-img-element -- la sirve una ruta con sesión que redirige a un enlace firmado
                    <img
                      data-dibujo
                      src={`${BASE}/media/${m.id}`}
                      alt="El dibujo que hizo Ajito"
                      className="mb-2 w-full rounded-xl"
                    />
                  )}
                  {m.texto && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.texto}</p>}
                  {m.texto && <OirAjito id={m.id} listo={m.audio} />}
                </div>
              </div>
            )
          )
        )}

        {fase && (
          <div className="flex items-end gap-2" data-pensando={fase}>
            <Image src="/marca/ajito.png" alt="" width={200} height={200} className="h-7 w-7 shrink-0 object-contain" />
            <p className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[14px] text-marca-500 ring-1 ring-marca-200/70">
              <span className="h-2 w-2 animate-pulse rounded-full bg-acento-600" />
              {fase === 'dibujando' ? 'Ajito está dibujando… tarda unos segundos' : 'Ajito está pensando…'}
            </p>
          </div>
        )}
      </div>

      {/* Pegado al pie, justo encima de la navegación: el pulgar llega ahí. */}
      <div className="sticky bottom-16 -mx-4 border-t border-marca-200/70 bg-white/95 px-3 py-2.5 backdrop-blur">
        {aviso && (
          <p className="mb-2 rounded-xl bg-oro-300/25 px-3 py-2 text-[13px] leading-relaxed text-marca-700">{aviso}</p>
        )}

        {hablando ? (
          <div className="-mt-3">
            <ResponderHablando
              numero={0}
              clavePaso="charla"
              destino={`${BASE}/adjuntar`}
              onListo={(dicho, ruta) => {
                setHablando(false)
                void enviar(dicho, 'voz', ruta)
              }}
              onEscribir={() => setHablando(false)}
            />
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <label
              aria-label="Mandar una foto"
              className={cn(
                'grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-full text-marca-500 active:bg-marca-100',
                ocupado && 'pointer-events-none opacity-40'
              )}
            >
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                disabled={ocupado}
                onChange={(evento) => {
                  const archivo = evento.target.files?.[0]
                  evento.target.value = ''
                  if (archivo) void mandarFoto(archivo)
                }}
              />
              <IconoCamara />
            </label>
            <textarea
              ref={caja}
              value={texto}
              rows={1}
              maxLength={4000}
              placeholder={subiendo ? 'Subiendo la foto…' : 'Escríbele a Ajito…'}
              aria-label="Mensaje para Ajito"
              onChange={(evento) => {
                setTexto(evento.target.value)
                const el = evento.target
                el.style.height = 'auto'
                el.style.height = `${Math.min(el.scrollHeight, 132)}px`
              }}
              onKeyDown={(evento) => {
                // En la computadora, Enter manda; en el teléfono, Enter es renglón.
                if (evento.key === 'Enter' && !evento.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                  evento.preventDefault()
                  mandarTexto()
                }
              }}
              className="max-h-[132px] min-h-11 min-w-0 flex-1 resize-none rounded-3xl border border-marca-200 bg-marca-50 px-4 py-2.5 text-[15px] leading-snug text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:bg-white focus:ring-2 focus:ring-acento-100 focus:outline-none"
            />
            {texto.trim() ? (
              <button
                type="button"
                aria-label="Mandar"
                disabled={ocupado}
                onClick={mandarTexto}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-acento-600 text-white active:bg-acento-700 disabled:opacity-50"
              >
                <IconoEnviar className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                aria-label="Mandar una nota de voz"
                disabled={ocupado}
                onClick={() => setHablando(true)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-acento-600 text-white active:bg-acento-700 disabled:opacity-50"
              >
                <IconoMicro />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Oír lo que Ajito contestó. Todo lo que dice se oye —la clase es un audio, y
 * esto es la misma voz—, pero no suena solo: el teléfono no deja, y en el
 * comedor tampoco se quiere.
 */
function OirAjito({ id, listo }: { id: string; listo: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [estado, setEstado] = useState<'quieto' | 'cargando' | 'sonando'>('quieto')

  useEffect(() => () => audio.current?.pause(), [])

  function tocar() {
    if (!audio.current) {
      const a = new Audio(`${BASE}/media/${id}?que=audio`)
      a.addEventListener('waiting', () => setEstado('cargando'))
      a.addEventListener('playing', () => setEstado('sonando'))
      a.addEventListener('pause', () => setEstado('quieto'))
      a.addEventListener('ended', () => setEstado('quieto'))
      audio.current = a
    }
    if (estado === 'sonando') {
      audio.current.pause()
      return
    }
    setEstado('cargando')
    audio.current.play().catch(() => setEstado('quieto'))
  }

  if (!listo) {
    return (
      <p className="mt-2 flex items-center gap-2 text-[12px] text-marca-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-marca-300" />
        Poniéndole la voz…
      </p>
    )
  }

  return (
    <button
      type="button"
      onClick={tocar}
      data-oir={estado}
      className={cn(
        '-mb-1 mt-2 -ml-1 inline-flex min-h-11 items-center gap-2 rounded-full pr-3 pl-1 text-[13px] font-semibold',
        estado === 'sonando' ? 'bg-oro-300 text-marca-900' : 'text-acento-700 active:bg-acento-50'
      )}
    >
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-full',
          estado === 'sonando' ? 'bg-marca-900 text-oro-300' : 'bg-acento-600 text-white'
        )}
      >
        {estado === 'cargando' ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : estado === 'sonando' ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
      </span>
      {estado === 'sonando' ? 'Pausar' : 'Oír a Ajito'}
    </button>
  )
}

/** «hoy, 3:40 p. m.», «ayer», «12 sep». */
function cuando(iso: string): string {
  const fecha = new Date(iso)
  const hoy = new Date()
  const dias = Math.floor((hoy.setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86_400_000)
  if (dias === 0) return `hoy, ${fecha.toLocaleTimeString('es-VE', { hour: 'numeric', minute: '2-digit' })}`
  if (dias === 1) return 'ayer'
  return fecha.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })
}

function IconoMicro() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 1 0-7 0v6A3.5 3.5 0 0 0 12 15Z" />
      <path d="M18.5 11.5a.9.9 0 0 0-1.8 0 4.7 4.7 0 0 1-9.4 0 .9.9 0 0 0-1.8 0 6.5 6.5 0 0 0 5.6 6.4V21a.9.9 0 0 0 1.8 0v-3.1a6.5 6.5 0 0 0 5.6-6.4Z" />
    </svg>
  )
}

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <path d="M9.4 3.5a1 1 0 0 0-.83.44L7.46 5.6H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-2.46l-1.11-1.66a1 1 0 0 0-.83-.44Zm2.6 5.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8Zm0 2a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z" />
    </svg>
  )
}
