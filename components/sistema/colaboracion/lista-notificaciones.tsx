'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { marcarLeidas } from '@/components/sistema/colaboracion/acciones'
import { abrirFicha } from '@/components/sistema/colaboracion/abrir'
import { FilaNotificacion } from '@/components/sistema/colaboracion/campana'
import type { Notificacion } from '@/lib/plataforma/colaboracion'

/** Avisa a la campana que lo leído cambió (para que baje su número sin esperar). */
function avisarCampana() {
  window.dispatchEvent(new Event('notificaciones-cambiaron'))
}

export function ListaNotificaciones({ lista }: { lista: Notificacion[] }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  return (
    <ul className={pendiente ? 'opacity-70' : ''}>
      {lista.map((n) => (
        <li key={n.id} className="border-t border-[#eef0f3] first:border-0">
          <FilaNotificacion
            n={n}
            ancha
            alAbrir={() =>
              iniciar(async () => {
                if (!n.leida) {
                  await marcarLeidas([n.id])
                  avisarCampana()
                }
                if (n.objetoTipo && n.objetoId) abrirFicha(router, n.objetoTipo, n.objetoId)
                else if (n.enlace) router.push(n.enlace)
                router.refresh()
              })
            }
          />
        </li>
      ))}
    </ul>
  )
}

export function MarcarTodoLeido({ hay }: { hay: boolean }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  if (!hay) return null
  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() =>
        iniciar(async () => {
          await marcarLeidas(null)
          avisarCampana()
          router.refresh()
        })
      }
      className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-3 text-xs font-medium text-marca-800 hover:bg-marca-50 disabled:opacity-50"
    >
      {pendiente ? 'Marcando…' : 'Marcar todo leído'}
    </button>
  )
}
