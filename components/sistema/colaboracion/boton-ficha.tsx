'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { abrirFicha } from '@/components/sistema/colaboracion/abrir'
import { cn } from '@/lib/utils'

/** Un texto que abre un objeto en el panel lateral, desde una página de servidor. */
export function BotonFicha({ tipo, id, children, className }: { tipo: string; id: string; children: ReactNode; className?: string }) {
  const router = useRouter()
  return (
    <button type="button" onClick={() => abrirFicha(router, tipo, id)} className={cn('max-w-full text-left hover:underline', className)}>
      {children}
    </button>
  )
}
