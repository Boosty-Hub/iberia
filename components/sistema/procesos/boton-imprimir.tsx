'use client'

/** Abre el diálogo de impresión del navegador (de ahí sale el PDF de la ficha). */
export function BotonImprimir({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Imprimir o guardar en PDF
    </button>
  )
}
