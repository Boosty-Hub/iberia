'use client'

import { useFormStatus } from 'react-dom'

export function BotonContinuar({ texto }: { texto: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento min-h-11 w-full" disabled={pending} autoFocus>
      {pending ? 'Un momento…' : texto}
    </button>
  )
}
