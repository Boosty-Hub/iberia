import { NIVELES_IA, type MarcaCelda, type NivelIa } from '@/lib/ia/niveles'
import { cn } from '@/lib/utils'

/**
 * `<NivelIA nivel="N2" />`: la insignia del nivel de la IA (Anexo E §7). Lleva
 * siempre el ✦ y su texto —el icono nunca va solo— y un borde que las
 * pastillas de estado no tienen, así que no se confunde con un estado aunque
 * el tono se parezca. Sirve en el servidor y en el navegador.
 */
export function NivelIA({ nivel, corto = false, className }: { nivel: NivelIa; corto?: boolean; className?: string }) {
  const n = NIVELES_IA[nivel] ?? NIVELES_IA.N0
  return (
    <span
      className={cn('inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-px text-[10.5px] leading-4 font-bold whitespace-nowrap', n.clase, className)}
      title={`${nivel === 'N0' ? 'N0 · Apagada' : n.corto}: ${n.como}`}
    >
      <span aria-hidden>{nivel === 'N0' ? '○' : '✦'}</span>
      {corto ? nivel : nivel === 'N0' ? 'N0 · Apagada' : n.corto}
    </span>
  )
}

/** El rótulo de lo que redactó el modelo (N1): «Generado con IA · verifícalo». */
export function GeneradoConIa({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded border border-dashed border-[#9d93bd] px-1.5 text-[10.5px] font-semibold text-[#4f4577]', className)}>
      <span aria-hidden>✦</span> Generado con IA · verifícalo
    </span>
  )
}

/**
 * La marca ⚑ de la tabla (N2): la razón va en el título (al pasar el mouse) y
 * en el texto para lectores de pantalla; el ⚑ nunca va solo.
 */
export function MarcaIa({ marca }: { marca: MarcaCelda }) {
  const texto = `${NIVELES_IA[marca.nivel]?.corto ?? marca.nivel} · ${marca.texto}${marca.n && marca.n > 1 ? ` (+${marca.n - 1})` : ''}`
  return (
    <span
      data-marca-ia
      title={`${texto}. Abre la ficha para ver la propuesta y decidir.`}
      className="relative ml-1 inline-flex cursor-help items-center gap-0.5 rounded border border-[#a9c4ec] bg-[#e3edfc] px-1 text-[10px] leading-4 font-bold text-[#1d4f8f]"
    >
      <span aria-hidden>⚑ IA</span>
      <span className="sr-only">{texto}</span>
    </span>
  )
}
