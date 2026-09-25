'use client'

import { useLinkStatus } from 'next/link'
import { cn } from '@/lib/utils'

/**
 * El giro pequeño al lado del enlace que se acaba de pulsar, mientras la página
 * nueva todavía no llegó.
 *
 * Complementa al esqueleto de `loading.tsx`: cuando la ruta no alcanzó a
 * precargarse —en desarrollo nunca se precarga—, entre el clic y el esqueleto hay
 * un instante en que nada cambiaba y el clic parecía perdido. Va dentro del
 * `<Link>` (así lo exige `useLinkStatus`), ocupa siempre su sitio y solo cambia de
 * opacidad, para que el menú no salte.
 */
export function IndicadorEnlace({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return <span aria-hidden className={cn('enlace-pendiente', pending && 'activo', className)} />
}
