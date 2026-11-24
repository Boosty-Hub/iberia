'use client'

import { useEffect, useRef, useState } from 'react'
import type { ArchivoFicha } from '@/lib/plataforma/ficha-tipos'
import { cn } from '@/lib/utils'
import { VisorPdf } from '@/components/sistema/ui/visor-pdf'

/**
 * Los archivos de origen de un documento: tocar uno disponible abre su vista previa (el PDF optimizado en un visor a
 * pantalla casi completa, dibujado con pdf.js), con «Descargar PDF», «Abrir en otra pestaña» y, cuando exista, el original. Los que no
 * están cargados dicen por qué.
 */
export function ArchivosFicha({ archivos, vacio }: { archivos: ArchivoFicha[]; vacio?: string }) {
  const [abierto, setAbierto] = useState<ArchivoFicha | null>(null)
  if (!archivos.length) return <p className="py-2 text-center text-marca-400">{vacio ?? 'Sin archivos.'}</p>
  return (
    <>
      <ul className="flex flex-col gap-1">
        {archivos.map((a) => {
          const disponible = a.estado === 'disponible' && !!a.ver
          return (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-[var(--borde)] px-2.5 py-1.5">
              <span
                className={cn(
                  'w-12 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-semibold tracking-[0.04em] uppercase',
                  disponible ? 'bg-acento-50 text-acento-700' : 'bg-[#f0f1f4] text-marca-500'
                )}
              >
                {a.formato}
              </span>
              {disponible ? (
                <button type="button" onClick={() => setAbierto(a)} className="min-w-0 flex-1 text-left" title="Ver el documento">
                  <span className="block truncate text-marca-900 underline-offset-2 hover:underline">{a.nombre}</span>
                  {a.detalle && <span className="block truncate text-[11.5px] text-marca-500">{a.detalle}</span>}
                </button>
              ) : (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-marca-700">{a.nombre}</span>
                  {a.detalle && <span className="block text-[11.5px] text-marca-500">{a.detalle}</span>}
                </span>
              )}
              {disponible && (
                <span className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => setAbierto(a)} className="h-7 rounded-md border border-[var(--borde)] px-2 text-[11.5px] hover:bg-marca-50">
                    Ver
                  </button>
                  <a href={a.descargar ?? undefined} className="h-7 rounded-md border border-[var(--borde)] px-2 text-[11.5px] leading-7 hover:bg-marca-50" aria-label={`Descargar ${a.nombre} en PDF`}>
                    PDF ↓
                  </a>
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {abierto && <VistaPrevia archivo={abierto} alCerrar={() => setAbierto(null)} />}
    </>
  )
}

function VistaPrevia({ archivo, alCerrar }: { archivo: ArchivoFicha; alCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (!d.open) d.showModal()
    const cerrar = () => alCerrar()
    d.addEventListener('close', cerrar)
    return () => d.removeEventListener('close', cerrar)
  }, [alCerrar])

  return (
    <dialog
      ref={ref}
      aria-label={`Vista previa: ${archivo.nombre}`}
      className="m-auto h-[92dvh] w-[min(1100px,96vw)] max-w-none overflow-hidden rounded-2xl border border-[var(--borde)] bg-white p-0 shadow-xl backdrop:bg-black/40"
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close()
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--borde)] px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-marca-900" title={archivo.nombre}>
            {archivo.nombre}
          </p>
          {archivo.ver && (
            <a href={archivo.ver} target="_blank" rel="noopener" className="hidden h-8 rounded-lg border sm:inline-block border-[var(--borde)] px-2.5 text-[12px] leading-8 hover:bg-marca-50">
              Abrir en otra pestaña
            </a>
          )}
          {archivo.descargar && (
            <a href={archivo.descargar} className="h-8 rounded-lg border border-[var(--borde)] px-2.5 text-[12px] leading-8 hover:bg-marca-50">
              Descargar PDF
            </a>
          )}
          {archivo.original && (
            <a href={archivo.original} className="h-8 rounded-lg border border-[var(--borde)] px-2.5 text-[12px] leading-8 hover:bg-marca-50">
              Original ({archivo.formato})
            </a>
          )}
          <button type="button" onClick={() => ref.current?.close()} className="h-8 w-8 rounded-lg border border-[var(--borde)] text-[14px] hover:bg-marca-50" aria-label="Cerrar la vista previa">
            ✕
          </button>
        </div>
        {archivo.ver && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#eef0f3]">
            <VisorPdf url={archivo.ver} />
          </div>
        )}
      </div>
    </dialog>
  )
}
