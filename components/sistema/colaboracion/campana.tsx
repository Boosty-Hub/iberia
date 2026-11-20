'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { marcarLeidas, resumenNotificaciones } from '@/components/sistema/colaboracion/acciones'
import { abrirFicha, tieneFicha } from '@/components/sistema/colaboracion/abrir'
import { IconoCampanita } from '@/components/sistema/shell/iconos'
import { Desplegable } from '@/components/sistema/ui/desplegable'
import { TIPO_NOTIFICACION, type Notificacion, type ResumenNotificaciones } from '@/lib/plataforma/colaboracion'
import { hace } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * La campana (Anexo E §3, «un solo buzón»): menciones, aprobaciones, lo que
 * sigo y tareas. El número es lo no leído. Se refresca cada minuto con la
 * pestaña a la vista, al volver a ella y al abrirla. Tocar un aviso lo marca
 * leído y abre el objeto en el panel lateral, sin salir de la página.
 */
export function Campana({ inicial }: { inicial: ResumenNotificaciones }) {
  const router = useRouter()
  const [r, setR] = useState(inicial)

  const refrescar = useCallback(() => {
    resumenNotificaciones()
      .then(setR)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') refrescar()
    }, 60_000)
    const alVolver = () => document.visibilityState === 'visible' && refrescar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('notificaciones-cambiaron', refrescar)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('notificaciones-cambiaron', refrescar)
    }
  }, [refrescar])

  const n = r.noLeidas
  const etiqueta = `Notificaciones: ${n ? `${n} sin leer` : 'nada sin leer'}${r.porDecidir ? ` · ${r.porDecidir} por decidir` : ''}`

  return (
    <Desplegable
      etiqueta={etiqueta}
      soloIcono
      alinear="der"
      ancho="w-[min(24rem,calc(100vw-1.5rem))]"
      claseBoton="relative grid h-8 w-8 place-items-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
      boton={
        <>
          <IconoCampanita className="h-5 w-5" />
          {n > 0 && (
            <span data-campana-cuenta className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-[#D4332C] px-1 text-center text-[10px] leading-4 font-bold text-white ring-2 ring-[#2b2a28]" aria-hidden>
              {n > 99 ? '99+' : n}
            </span>
          )}
        </>
      }
    >
      {(cerrar) => (
        <div className="text-sm" data-campana-abierta>
          <div className="flex items-center gap-2 border-b border-[var(--borde)] px-4 py-3">
            <p className="font-semibold">Notificaciones</p>
            <span className="flex-1" />
            {n > 0 && (
              <button
                type="button"
                className="text-xs text-marca-600 hover:text-marca-900 hover:underline"
                onClick={async () => {
                  await marcarLeidas(null)
                  refrescar()
                }}
              >
                Marcar todo leído
              </button>
            )}
          </div>
          {r.porDecidir > 0 && (
            <Link
              href="/sistema/bandeja"
              onClick={cerrar}
              className="flex items-center gap-2 border-b border-[var(--borde)] bg-[#fffaf2] px-4 py-2 text-[12.5px] font-semibold text-[#8a5a12] hover:bg-[#fdf4e3]"
            >
              <span aria-hidden>✓</span> Te toca decidir {r.porDecidir} {r.porDecidir === 1 ? 'cosa' : 'cosas'}
              <span className="ml-auto font-normal underline">Ir a la bandeja</span>
            </Link>
          )}
          {!r.ultimas.length ? (
            <p className="px-4 py-6 text-center text-marca-500">No tienes notificaciones. Cuando te mencionen, te asignen algo o te toque aprobar, llega aquí.</p>
          ) : (
            <ul>
              {r.ultimas.map((x) => (
                <li key={x.id} className="border-b border-[var(--borde)] last:border-0">
                  <FilaNotificacion
                    n={x}
                    alAbrir={() => {
                      cerrar()
                      if (!x.leida) marcarLeidas([x.id]).then(refrescar)
                      if (tieneFicha(x.objetoTipo) && x.objetoId) abrirFicha(router, x.objetoTipo, x.objetoId)
                      else router.push(x.enlace ?? '/sistema/notificaciones')
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          <Link href="/sistema/notificaciones" onClick={cerrar} className="block border-t border-[var(--borde)] px-4 py-2.5 text-center text-xs font-semibold text-acento-700 hover:bg-marca-50">
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </Desplegable>
  )
}

/** Una notificación: marca por tipo (forma + texto), punto de no leída y hace cuánto. */
export function FilaNotificacion({ n, alAbrir, ancha = false }: { n: Notificacion; alAbrir: () => void; ancha?: boolean }) {
  const t = TIPO_NOTIFICACION[n.tipo] ?? TIPO_NOTIFICACION.sistema
  return (
    <button type="button" onClick={alAbrir} className={cn('flex w-full gap-3 px-4 py-2.5 text-left hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acento-500', !n.leida && 'bg-[#f7faff]')}>
      <span className={cn('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-bold', t.clase)} aria-hidden>
        {t.marca}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] text-marca-900', ancha ? 'break-words' : 'line-clamp-2', !n.leida && 'font-semibold')}>{n.texto}</span>
        {n.detalle && <span className={cn('block text-xs text-marca-600', ancha ? 'break-words' : 'truncate')}>{n.detalle}</span>}
        <span className="mt-0.5 block text-[11px] text-marca-400" suppressHydrationWarning>
          {t.etiqueta} · {hace(n.creadoEn)}
          {!n.leida && <span className="sr-only"> · sin leer</span>}
        </span>
      </span>
      {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#2f5f9a]" aria-hidden />}
    </button>
  )
}
