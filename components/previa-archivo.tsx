'use client'

import { useEffect, useRef, useState } from 'react'
import { IconoDescargar } from '@/components/iconos'
import { Markdown } from '@/components/markdown'

/**
 * Ver qué hay dentro de un archivo sin descargarlo.
 *
 * El expediente tiene el contrato, la propuesta, los organigramas, los correos y
 * el listado de personal. Antes, saber cuál de los siete PDF era el que hacía
 * falta obligaba a bajárselos: material bajo NDA, en la carpeta de descargas de
 * quien fuera. Esto lo abre en su sitio y no deja copia.
 *
 * Va sobre `<dialog>` del navegador y no sobre un `div` con posición fija: el
 * elemento nativo trae el foco atrapado, el cierre con Escape y el fondo
 * inerte. Escribir eso a mano se hace mal casi siempre.
 *
 * Lo que se puede previsualizar y lo que no está decidido por el tipo del
 * archivo, y **lo que no se puede se dice**: un xlsx no se abre en el navegador,
 * y enseñar un cuadro en blanco es peor que decirlo.
 */
export function PreviaArchivo({
  id,
  nombre,
  mime,
  descripcion,
}: {
  id: string
  nombre: string
  mime: string | null
  descripcion?: string | null
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [abierto, setAbierto] = useState(false)

  const url = `/dashboard/archivos/${id}/ver`
  const tipo = claseDe(mime, nombre)

  function abrir() {
    setAbierto(true)
    dialogo.current?.showModal()
  }

  function cerrar() {
    dialogo.current?.close()
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="block max-w-full truncate text-left font-medium text-marca-800 hover:text-acento-700 hover:underline"
        title={`Ver ${nombre}`}
      >
        {nombre}
      </button>

      <dialog
        ref={dialogo}
        onClose={() => setAbierto(false)}
        // El `<dialog>` nativo trae margen y borde propios; se le quitan y se
        // centra a mano. `backdrop:` es el fondo del propio elemento.
        className="m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-marca-900/50 sm:h-[calc(100%-4rem)] sm:w-[calc(100%-4rem)] sm:m-8"
      >
        <div className="tarjeta flex h-full flex-col overflow-hidden">
          <div className="flex items-start gap-4 border-b border-marca-200 px-5 py-4">
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-semibold text-marca-900">{nombre}</h2>
              {descripcion && (
                <p className="mt-0.5 line-clamp-2 text-sm text-marca-600">{descripcion}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <a
                href={`/dashboard/archivos/${id}/descargar`}
                className="btn-neutro px-2.5"
                title={`Descargar ${nombre}`}
              >
                <IconoDescargar className="h-4 w-4" />
                <span className="sr-only">Descargar</span>
              </a>
              <button type="button" onClick={cerrar} className="btn-neutro">
                Cerrar
              </button>
            </div>
          </div>

          {/* El contenido se monta solo cuando el diálogo está abierto: si no, los
              nueve archivos se pedirían al cargar la página. */}
          <div className="min-h-0 flex-1 overflow-auto bg-marca-50">
            {abierto && <Contenido tipo={tipo} url={url} nombre={nombre} id={id} />}
          </div>
        </div>
      </dialog>
    </>
  )
}

type Clase = 'pdf' | 'imagen' | 'markdown' | 'texto' | 'ninguna'

/**
 * De qué se puede fiar el visor. El mime manda; la extensión es el respaldo,
 * porque en el expediente hay archivos subidos desde el escritorio y algunos
 * llegan con `application/octet-stream`.
 */
function claseDe(mime: string | null, nombre: string): Clase {
  const m = (mime ?? '').toLowerCase()
  const ext = nombre.slice(nombre.lastIndexOf('.') + 1).toLowerCase()

  if (m === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (m.startsWith('image/')) return 'imagen'
  if (m === 'text/markdown' || ext === 'md') return 'markdown'
  if (m.startsWith('text/') || m === 'application/json' || ['txt', 'csv', 'json'].includes(ext)) {
    return 'texto'
  }
  return 'ninguna'
}

function Contenido({
  tipo,
  url,
  nombre,
  id,
}: {
  tipo: Clase
  url: string
  nombre: string
  id: string
}) {
  if (tipo === 'pdf') {
    return <iframe src={url} title={nombre} className="h-full w-full border-0 bg-white" />
  }

  if (tipo === 'imagen') {
    return (
      <div className="grid h-full place-items-center p-4">
        {/* `next/image` no vale aquí: la ruta exige sesión y el optimizador la
            pediría desde el servidor sin cookies. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={nombre} className="max-h-full max-w-full object-contain" />
      </div>
    )
  }

  if (tipo === 'markdown' || tipo === 'texto') {
    return <Texto url={url} comoMarkdown={tipo === 'markdown'} />
  }

  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <p className="font-medium text-marca-800">Este tipo de archivo no se ve aquí</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-marca-600">
          Las hojas de cálculo y los documentos de Office no los abre el navegador. Descárgalo
          para verlo — y bórralo cuando termines, que es material bajo NDA.
        </p>
        <a href={`/dashboard/archivos/${id}/descargar`} className="btn-acento mt-4 inline-flex">
          Descargar {nombre}
        </a>
      </div>
    </div>
  )
}

/** Texto plano o markdown. Se trae por `fetch` para poder maquetarlo. */
function Texto({ url, comoMarkdown }: { url: string; comoMarkdown: boolean }) {
  const [estado, setEstado] = useState<{ texto?: string; error?: string }>({})

  useEffect(() => {
    let vivo = true
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then((texto) => vivo && setEstado({ texto }))
      .catch(() => vivo && setEstado({ error: 'No se pudo leer el archivo.' }))
    return () => {
      vivo = false
    }
  }, [url])

  if (estado.error) {
    return <p className="p-8 text-center text-sm text-marca-600">{estado.error}</p>
  }
  if (estado.texto === undefined) {
    return <p className="p-8 text-center text-sm text-marca-500">Abriendo…</p>
  }

  return (
    <div className="bg-white p-6">
      {comoMarkdown ? (
        <Markdown contenido={estado.texto} />
      ) : (
        <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-marca-800">
          {estado.texto}
        </pre>
      )}
    </div>
  )
}
