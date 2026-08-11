import Image from 'next/image'
import { cn } from '@/lib/utils'

// Dimensiones reales del PNG generado por scripts/generar-marca.ps1.
// Deben ser las intrínsecas, no las de display: si se pasa el tamaño mostrado,
// la proporción del atributo no coincide con la del archivo y next/image avisa
// de que una dimensión se modificó sin la otra.
const ANCHO_INTRINSECO = 1400
const ALTO_INTRINSECO = 362

/**
 * Lockup del programa: el logo de Iberia con el nombre del programa debajo.
 * `tono` elige la versión blanca del logo para fondos oscuros.
 */
export function Marca({
  tono = 'claro',
  alto = 30,
  className,
}: {
  tono?: 'claro' | 'oscuro'
  /** Alto mostrado en píxeles. El ancho lo deriva el navegador. */
  alto?: number
  className?: string
}) {
  const oscuro = tono === 'oscuro'

  return (
    // `items-start` es imprescindible: en un contenedor flex-column los hijos
    // se estiran a lo ancho por defecto, y eso deformaba el logo (384x26 en
    // lugar de 100x26). `width: auto` no basta para evitarlo.
    <div className={cn('flex flex-col items-start gap-1.5', className)}>
      <Image
        src={oscuro ? '/marca/iberia-blanco.png' : '/marca/iberia.png'}
        alt="Industrias Iberia"
        width={ANCHO_INTRINSECO}
        height={ALTO_INTRINSECO}
        priority
        // El PNG viene recortado al trazo, sin margen. `width: auto` mantiene la
        // proporción a partir del archivo.
        style={{ height: `${alto}px`, width: 'auto' }}
      />
      <span
        className={cn(
          'text-[10px] leading-none font-medium tracking-[0.11em] uppercase',
          oscuro ? 'text-white/55' : 'text-marca-500'
        )}
      >
        Programa de Adopción de IA
      </span>
    </div>
  )
}
