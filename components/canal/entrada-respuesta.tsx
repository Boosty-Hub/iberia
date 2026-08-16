'use client'

import { useRef, useState } from 'react'
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
  const formulario = useRef<HTMLFormElement>(null)
  const campoTexto = useRef<HTMLTextAreaElement>(null)
  const campoMedia = useRef<HTMLInputElement>(null)
  const campoEntrada = useRef<HTMLInputElement>(null)

  /** Rellena el formulario oculto y lo manda. */
  function guardar(texto: string, ruta: string | null, tipo: TipoEntrada) {
    if (campoTexto.current) campoTexto.current.value = texto
    if (campoMedia.current) campoMedia.current.value = ruta ?? ''
    if (campoEntrada.current) campoEntrada.current.value = tipo
    formulario.current?.requestSubmit()
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
      {/* Único camino a la base, sea cual sea la forma de contestar. */}
      <form ref={formulario} action={responder} className="hidden">
        <input type="hidden" name="numero" value={numero} />
        <input type="hidden" name="clave_paso" value={clave} />
        <input type="hidden" name="es_campo" value={esCampo ? 'si' : 'no'} />
        <input type="hidden" name="entrada" ref={campoEntrada} defaultValue="texto" />
        <input type="hidden" name="media_url" ref={campoMedia} defaultValue="" />
        <textarea name="texto" ref={campoTexto} defaultValue="" />
      </form>

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
          <CajaTexto etiqueta="Mandárselo a Ajito" onEnviar={(texto) => guardar(texto, null, 'texto')} />
          {entrada !== 'texto' && (
            <button
              type="button"
              onClick={() => setModo(entrada)}
              className="toque w-full text-[14px] font-medium text-marca-500 underline underline-offset-4 active:text-marca-800"
            >
              {entrada === 'voz' ? 'Mejor te lo digo hablando' : 'Mejor te mando la foto'}
            </button>
          )}
        </div>
      )}
    </>
  )
}

function CajaTexto({
  etiqueta,
  onEnviar,
}: {
  etiqueta: string
  onEnviar: (texto: string) => void
}) {
  const [texto, setTexto] = useState('')

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

function IconoCamara() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
      <path d="M9.4 3.5a1 1 0 0 0-.83.44L7.46 5.6H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-2.46l-1.11-1.66a1 1 0 0 0-.83-.44Zm2.6 5.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8Zm0 2a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z" />
    </svg>
  )
}
