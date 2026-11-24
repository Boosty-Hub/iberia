'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

/**
 * Dibuja un PDF con pdf.js, página por página y a medida que se desplaza. No se usa el visor del navegador (un
 * `iframe`): Chrome en Android no muestra PDF dentro de una página y Safari en el iPhone solo pinta la primera hoja.
 * El PDF llega del mismo origen (la ruta `ver`, con la sesión en la cookie).
 */
export function VisorPdf({ url }: { url: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [primera, setPrimera] = useState<{ w: number; h: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    let tareaCarga: { destroy: () => Promise<void> } | null = null
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        const t = pdfjs.getDocument({ url })
        tareaCarga = t
        const cargado = await t.promise
        // Solo la primera página se mide de entrada: cada otra corrige su proporción al dibujarse. Medirlas todas
        // antes de mostrar nada tardaba con los manuales de cientos de páginas (y hay una hoja de cálculo de 12.743).
        const v = (await cargado.getPage(1)).getViewport({ scale: 1 })
        if (!vivo) return
        setPrimera({ w: v.width, h: v.height })
        setDoc(cargado)
      } catch {
        if (vivo) setError('No se pudo abrir el PDF.')
      }
    })()
    return () => {
      vivo = false
      void tareaCarga?.destroy()
    }
  }, [url])

  if (error) return <p className="p-6 text-center text-[13px] text-marca-500">{error}</p>
  if (!doc || !primera) return <p className="p-6 text-center text-[13px] text-marca-500" role="status">Abriendo el documento…</p>
  return (
    <div className="flex flex-col items-center gap-3 p-3 sm:p-4" data-paginas={doc.numPages}>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <Pagina key={i} doc={doc} numero={i + 1} proporcionInicial={primera.h / primera.w} />
      ))}
    </div>
  )
}

function Pagina({ doc, numero, proporcionInicial }: { doc: PDFDocumentProxy; numero: number; proporcionInicial: number }) {
  const [proporcion, setProporcion] = useState(proporcionInicial)
  const caja = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(numero <= 2)

  useEffect(() => {
    const el = caja.current
    if (!el || visible) return
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || !caja.current || !lienzo.current) return
    let tarea: { cancel: () => void } | null = null
    ;(async () => {
      const pagina = await doc.getPage(numero)
      const base = pagina.getViewport({ scale: 1 })
      const anchoPdf = base.width
      setProporcion(base.height / base.width)
      const ancho = caja.current?.clientWidth ?? anchoPdf
      const escala = (ancho / anchoPdf) * Math.min(window.devicePixelRatio || 1, 2)
      const vista = pagina.getViewport({ scale: escala })
      const c = lienzo.current
      if (!c) return
      c.width = Math.floor(vista.width)
      c.height = Math.floor(vista.height)
      const r = pagina.render({ canvas: c, viewport: vista })
      tarea = r
      await r.promise.catch(() => {})
    })()
    return () => tarea?.cancel()
  }, [visible, doc, numero])

  return (
    <div ref={caja} className="relative w-full max-w-[900px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)]" style={{ aspectRatio: `1 / ${proporcion}` }}>
      <canvas ref={lienzo} className="block h-full w-full" aria-label={`Página ${numero}`} />
    </div>
  )
}
