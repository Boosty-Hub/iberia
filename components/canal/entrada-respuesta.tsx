'use client'

import { useState, useTransition } from 'react'
import { responder } from '@/app/canal/(dentro)/adiestramiento/acciones'
import { ResponderHablando } from '@/components/canal/responder-hablando'
import type { TipoEntrada } from '@/lib/adiestramiento'

/**
 * Cómo se contesta un ejercicio.
 *
 * El guion dice de qué forma se espera cada respuesta —hablando, con una foto,
 * escrita—, pero **ninguna vía está cerrada**: la regla de la casa es que
 * hablar vale tanto como escribir, y quien prefiera lo otro lo tiene a un
 * toque. El modo que propone el guion es solo el que sale por defecto.
 *
 * Guardar siempre pasa por el mismo sitio: la acción `responder`. Lo que cambia
 * es de dónde sale el texto — del teclado, de la transcripción confirmada, o de
 * la nota que la persona le pone a su foto.
 *
 * **Al tocar «Mandárselo a Ajito», Ajito sale pensando en el acto.** La acción
 * va al servidor y vuelve, y ese segundo o dos con la caja quieta hacía creer
 * que el botón no servía. Se pinta lo mismo que se va a ver cuando vuelva —lo
 * que dijo, citado, y Ajito «viendo lo que le mandaste»—, así que el cambio no
 * se nota. Si no se guardó, le devuelve la caja con un aviso.
 */
export function EntradaRespuesta({
  numero,
  clave,
  entrada,
  esCampo,
}: {
  numero: number
  clave: string
  entrada: TipoEntrada
  esCampo: boolean
}) {
  const [modo, setModo] = useState<TipoEntrada>(entrada === 'boton' ? 'texto' : entrada)
  const [media, setMedia] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const [mandado, setMandado] = useState<string | null>(null)
  // Lo que había escrito, si el envío no se guardó: se le devuelve en la caja.
  const [borrador, setBorrador] = useState('')
  const [mandando, iniciar] = useTransition()

  /** Único camino a la base, sea cual sea la forma de contestar. */
  function guardar(texto: string, ruta: string | null, tipo: TipoEntrada) {
    const datos = new FormData()
    datos.set('numero', String(numero))
    datos.set('clave_paso', clave)
    datos.set('es_campo', esCampo ? 'si' : 'no')
    datos.set('entrada', tipo)
    datos.set('media_url', ruta ?? '')
    datos.set('texto', texto)
    setMandado(texto)
    setFallo(null)
    iniciar(async () => {
      const { ok } = await responder(datos)
      if (!ok) {
        setMandado(null)
        setBorrador(texto)
        // Una nota de voz ya transcrita vuelve como texto, para no perderla.
        if (tipo === 'voz') setModo('texto')
        setFallo('No se pudo mandar. Tu texto sigue aquí: intenta otra vez.')
      }
    })
  }

  if (mandando && mandado) {
    return (
      <>
        <p className="mt-3 border-l-2 border-marca-200 pl-3 text-[14px] leading-relaxed text-marca-500">
          {mandado}
        </p>
        <p className="mt-3 flex min-h-11 items-center gap-2 text-[15px] text-marca-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-acento-600" />
          Ajito está viendo lo que le mandaste…
        </p>
      </>
    )
  }

  async function subirFoto(archivo: File) {
    setSubiendo(true)
    setFallo(null)

    const cuerpo = new FormData()
    cuerpo.append('audio', archivo)
    cuerpo.append('clave_paso', clave)

    try {
      const respuesta = await fetch(`/canal/adiestramiento/${numero}/adjuntar`, {
        method: 'POST',
        body: cuerpo,
      })
      if (!respuesta.ok) throw new Error()
      const datos = (await respuesta.json()) as { ruta: string }
      setMedia(datos.ruta)
    } catch {
      setFallo('No se pudo subir la foto. Intenta otra vez.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <>
      {modo === 'voz' && (
        <ResponderHablando
          numero={numero}
          clavePaso={clave}
          onListo={(texto, ruta) => guardar(texto, ruta, 'voz')}
          onEscribir={() => setModo('texto')}
        />
      )}

      {modo === 'foto' && (
        <div className="mt-3 space-y-3">
          {fallo && (
            <p className="rounded-xl bg-acento-50 px-3 py-2 text-[14px] text-acento-700">
              {fallo}
            </p>
          )}

          {media ? (
            <>
              <p className="rounded-xl bg-marca-50 px-3 py-2 text-[14px] leading-relaxed text-marca-600">
                Foto recibida. Cuéntame en una línea qué le tomaste y la mando.
              </p>
              <CajaTexto
                etiqueta="Mandárselo a Ajito"
                inicial={borrador}
                onEnviar={(texto) => guardar(texto, media, 'foto')}
              />
            </>
          ) : (
            <>
              <label
                className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3
                           rounded-xl bg-acento-600 px-5 text-[15px] font-semibold text-white
                           active:bg-acento-700"
              >
                {/* `capture` abre la cámara de una en el teléfono en vez del
                    explorador de archivos, que es un laberinto con guantes. */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(evento) => {
                    const archivo = evento.target.files?.[0]
                    if (archivo) void subirFoto(archivo)
                  }}
                />
                <IconoCamara />
                {subiendo ? 'Subiendo…' : 'Tomar la foto'}
              </label>

              {/* Cambia de vía, no envía. Antes este texto rotulaba el botón de
                  enviar y salía deshabilitado: parecía roto. */}
              <button
                type="button"
                onClick={() => setModo('texto')}
                className="toque w-full text-[14px] font-medium text-marca-500 underline underline-offset-4 active:text-marca-800"
              >
                Prefiero contárselo escrito
              </button>
            </>
          )}
        </div>
      )}

      {modo === 'texto' && (
        <div className="mt-3 space-y-2">
          {fallo && (
            <p className="rounded-xl bg-acento-50 px-3 py-2 text-[14px] text-acento-700">
              {fallo}
            </p>
          )}
          <CajaTexto
            etiqueta="Mandárselo a Ajito"
            inicial={borrador}
            onEnviar={(texto) => guardar(texto, null, 'texto')}
          />
          {/* La nota de voz está a un toque aunque el ejercicio se proponga
              escrito: quien escribe poco no puede quedarse sin forma de
              contestar. Se graba, se transcribe, se confirma y se manda. */}
          <button
            type="button"
            onClick={() => setModo('voz')}
            className="toque w-full gap-2 text-[14px] font-medium text-marca-500 underline underline-offset-4 active:text-marca-800"
          >
            <IconoMicro />
            Mejor te lo digo en una nota de voz
          </button>
          {entrada === 'foto' && (
            <button
              type="button"
              onClick={() => setModo('foto')}
              className="toque w-full text-[14px] font-medium text-marca-500 underline underline-offset-4 active:text-marca-800"
            >
              Mejor te mando la foto
            </button>
          )}
        </div>
      )}
    </>
  )
}

function CajaTexto({
  etiqueta,
  inicial = '',
  onEnviar,
}: {
  etiqueta: string
  /** Lo que ya había escrito, si el envío anterior no se guardó. */
  inicial?: string
  onEnviar: (texto: string) => void
}) {
  const [texto, setTexto] = useState(inicial)

  return (
    <div className="space-y-2">
      <textarea
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        rows={3}
        placeholder="Escríbelo aquí…"
        className="campo w-full resize-y text-[15px]"
      />
      <button
        type="button"
        disabled={!texto.trim()}
        onClick={() => onEnviar(texto.trim())}
        className="btn-canal btn-canal-suave w-full"
      >
        {etiqueta}
      </button>
    </div>
  )
}

function IconoMicro() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
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
