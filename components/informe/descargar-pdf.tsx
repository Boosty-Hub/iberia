'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ANCHO_PDF, ATRIBUTO_OMITIR, generarPdfSeccion, type MensajePdf } from '@/lib/informe-pdf'

/**
 * «Descargar PDF», arriba de la sección. Carga la misma sección en un iframe de
 * ancho fijo con `?pdf=1` (ahí corre `GeneradorPdf`), espera el PDF que le manda
 * y lo descarga. El iframe va fuera de la vista; mientras arma, el botón cuenta
 * las hojas.
 */
export function DescargarPdf({ nombreArchivo }: { nombreArchivo: string }) {
  const ruta = usePathname()
  const [estado, setEstado] = useState<{ fase: 'quieto' | 'armando' | 'error'; hechas?: number; total?: number }>({
    fase: 'quieto',
  })
  const marco = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => () => marco.current?.remove(), [])

  const descargar = () => {
    if (estado.fase === 'armando') return
    setEstado({ fase: 'armando' })
    marco.current?.remove()

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.tabIndex = -1
    iframe.style.cssText = `position:fixed;left:-20000px;top:0;width:${ANCHO_PDF}px;height:1400px;border:0;`
    iframe.src = `${ruta}?pdf=1`
    marco.current = iframe

    const terminar = () => {
      window.removeEventListener('message', alMensaje)
      clearTimeout(tope)
      iframe.remove()
      if (marco.current === iframe) marco.current = null
    }
    const alMensaje = (e: MessageEvent<MensajePdf>) => {
      if (e.origin !== window.location.origin || e.source !== iframe.contentWindow) return
      const m = e.data
      if (m?.tipo === 'informe-pdf:progreso') setEstado({ fase: 'armando', hechas: m.hechas, total: m.total })
      if (m?.tipo === 'informe-pdf:listo') {
        terminar()
        const url = URL.createObjectURL(m.pdf)
        const a = document.createElement('a')
        a.href = url
        a.download = `${nombreArchivo}.pdf`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        setEstado({ fase: 'quieto' })
      }
      if (m?.tipo === 'informe-pdf:error') {
        terminar()
        console.error('PDF del informe:', m.mensaje)
        setEstado({ fase: 'error' })
      }
    }
    // Una sección larga en un teléfono lento tarda; dos minutos es el tope.
    const tope = setTimeout(() => {
      terminar()
      setEstado({ fase: 'error' })
    }, 120_000)
    window.addEventListener('message', alMensaje)
    document.body.appendChild(iframe)
  }

  const texto =
    estado.fase === 'armando'
      ? estado.total
        ? `Armando el PDF… ${estado.hechas} de ${estado.total}`
        : 'Armando el PDF…'
      : estado.fase === 'error'
        ? 'No se pudo armar · Reintentar'
        : 'Descargar PDF'

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={estado.fase === 'armando'}
      aria-busy={estado.fase === 'armando'}
      className="btn-neutro h-10 shrink-0"
      {...{ [ATRIBUTO_OMITIR]: '' }}
    >
      {estado.fase === 'armando' ? (
        <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-marca-300 border-t-acento-600" />
      ) : (
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 14.5V16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {texto}
    </button>
  )
}

/**
 * Corre dentro del iframe (`?pdf=1`): arma el PDF de la sección y se lo manda a
 * la página que lo pidió. Fuera de un iframe no hace nada.
 */
export function GeneradorPdf({ titulo, numero }: { titulo: string; numero: string | null }) {
  const corrio = useRef(false)
  useEffect(() => {
    if (corrio.current || window.parent === window) return
    corrio.current = true
    const enviar = (m: MensajePdf) => window.parent.postMessage(m, window.location.origin)
    const articulo = document.querySelector<HTMLElement>('article.hoja-informe')
    if (!articulo) {
      enviar({ tipo: 'informe-pdf:error', mensaje: 'No se encontró la sección' })
      return
    }
    generarPdfSeccion(articulo, { titulo, numero }, (hechas, total) =>
      enviar({ tipo: 'informe-pdf:progreso', hechas, total })
    )
      .then((pdf) => enviar({ tipo: 'informe-pdf:listo', pdf }))
      .catch((e: unknown) => enviar({ tipo: 'informe-pdf:error', mensaje: e instanceof Error ? e.message : String(e) }))
  }, [titulo, numero])
  return null
}
