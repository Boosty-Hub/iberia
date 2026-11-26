'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { cerrarSesion } from '@/app/login/actions'
import { Desplegable } from '@/components/sistema/ui/desplegable'
import { fijarMoneda, fijarVerComo } from '@/components/sistema/shell/acciones'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { IconoCalendarito, IconoFlechita, IconoLupa, IconoOjo, IconoRombo } from '@/components/sistema/shell/iconos'
import { fechaLarga, hoyCaracas, tasa } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * Las piezas de la barra superior que necesitan el navegador. La barra es carbón
 * (el modelo aprobado, Anexo E §3): controles en #3a3936, texto claro, foco
 * visible en blanco.
 */

export const CTL =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#4a4845] bg-[#3a3936] px-2.5 text-xs whitespace-nowrap text-[#e8e5df] transition-colors hover:bg-[#45433f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

/** Abre la paleta: el botón de la barra y Ctrl K hablan por el mismo evento. */
export function abrirPaleta() {
  window.dispatchEvent(new CustomEvent('abrir-paleta'))
}

export function BotonBuscar({ compacto = false }: { compacto?: boolean }) {
  if (compacto)
    return (
      <button type="button" onClick={abrirPaleta} className={cn(CTL, 'w-9 justify-center px-0')} aria-label="Buscar (Ctrl K)">
        <IconoLupa className="h-4 w-4" />
      </button>
    )
  return (
    <button
      type="button"
      onClick={abrirPaleta}
      className={cn(CTL, 'w-full max-w-[420px] min-w-[150px] flex-1 justify-start text-[#c9c6c0]')}
    >
      <IconoLupa className="h-4 w-4 shrink-0" />
      <span className="truncate">Buscar…</span>
      <span className="sr-only"> en la plataforma</span>
      <kbd className="ml-auto rounded border border-[#5a5853] px-1.5 font-sans text-[10px] text-[#aaa]">Ctrl K</kbd>
    </button>
  )
}

export type EscenarioBarra = { id: string; nombre: string; alcance: string }

/** «Datos al» y Realidad / Escenario: viven en la URL (`al`, `esc`). */
export function ControlesContexto({
  escenarios,
  puedeEscenarios,
  claro = false,
  conFecha = true,
}: {
  escenarios: EscenarioBarra[]
  puedeEscenarios: boolean
  claro?: boolean
  /** «Datos al» solo para quien tiene módulos con historia por fecha (26-nov-2026). */
  conFecha?: boolean
}) {
  const { sp, fijar } = useContextoUrl()
  const hoy = hoyCaracas()
  const al = sp.get('al') ?? hoy
  const esc = sp.get('esc')
  const otroDia = al !== hoy
  const base = claro
    ? 'inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-sm text-marca-800'
    : CTL

  return (
    <>
      {conFecha && (
      <label className={cn(base, 'cursor-text', otroDia && (claro ? 'border-amber-400 bg-amber-50' : 'border-amber-400/80 bg-amber-900/40'))} title="La fecha de los datos que ves">
        <IconoCalendarito className="h-4 w-4 shrink-0 opacity-80" />
        <span className={cn(claro ? '' : 'hidden 2xl:inline')}>Datos al</span>
        <input
          type="date"
          value={al}
          max="2099-12-31"
          onChange={(e) => fijar({ al: e.target.value && e.target.value !== hoy ? e.target.value : null })}
          className={cn('w-[7.4rem] bg-transparent outline-none', claro ? '' : '[color-scheme:dark]')}
          aria-label="Datos al"
        />
        {otroDia && <span className="sr-only">(no es hoy)</span>}
      </label>
      )}

      {/* Realidad o escenario, solo con la casilla de escenarios (26-nov-2026): sin ella no hay escenario que elegir. */}
      {puedeEscenarios && (
      <div className={cn('flex shrink-0 overflow-hidden rounded-lg border', claro ? 'border-[var(--borde)]' : 'border-[#4a4845]')} role="group" aria-label="Realidad o escenario">
        <button
          type="button"
          onClick={() => fijar({ esc: null })}
          aria-pressed={!esc}
          className={cn(
            'h-8 px-2.5 text-xs whitespace-nowrap',
            claro && 'h-10 text-sm',
            !esc ? (claro ? 'bg-[#2b2a28] font-semibold text-white' : 'bg-white font-semibold text-[#2b2a28]') : claro ? 'bg-white text-marca-600' : 'bg-[#3a3936] text-[#cfccc6] hover:bg-[#45433f]'
          )}
        >
          Realidad
        </button>
        <Desplegable
          etiqueta="Elegir un escenario"
          ancho="w-72"
          oscuro={!claro}
          alinear={claro ? 'izq' : 'der'}
          claseBoton={cn(
            'inline-flex h-8 items-center gap-1 px-2.5 text-xs whitespace-nowrap',
            claro && 'h-10 text-sm',
            esc ? 'bg-[#6b4fb3] font-semibold text-white' : claro ? 'bg-white text-marca-600' : 'bg-[#3a3936] text-[#cfccc6] hover:bg-[#45433f]'
          )}
          boton={
            <>
              <IconoRombo className="h-3 w-3" />
              Escenario
              <IconoFlechita className="h-3 w-3" />
            </>
          }
        >
          {(cerrar) => (
            <div className="p-1.5 text-sm">
              <p className={cn('px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider uppercase', claro ? 'text-marca-400' : 'text-[#a9a59f]')}>
                Escenarios abiertos
              </p>
              {!puedeEscenarios && <p className="px-2 py-2 text-xs opacity-80">Tu rol no abre escenarios.</p>}
              {puedeEscenarios && !escenarios.length && <p className="px-2 py-2 text-xs opacity-80">No hay escenarios en borrador ni en aprobación.</p>}
              {escenarios.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    fijar({ esc: e.id })
                    cerrar()
                  }}
                  aria-current={esc === e.id}
                  className={cn('flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left', claro ? 'hover:bg-marca-50' : 'hover:bg-white/10', esc === e.id && 'font-semibold')}
                >
                  <IconoRombo className="mt-1 h-3 w-3 shrink-0 text-[#a48be0]" />
                  <span className="min-w-0">
                    <span className="block truncate">{e.nombre}</span>
                    <span className="block text-[11px] opacity-70">{e.alcance === 'procesos' ? 'Procesos' : 'Estructura'}</span>
                  </span>
                </button>
              ))}
              {puedeEscenarios && (
                <Link href="/sistema/nucleo/escenarios" onClick={cerrar} className={cn('mt-1 block rounded-lg px-2 py-2 text-xs underline-offset-2 hover:underline', claro ? 'text-acento-700' : 'text-[#ffb3ad]')}>
                  Abrir o crear un escenario…
                </Link>
              )}
            </div>
          )}
        </Desplegable>
      </div>
      )}
    </>
  )
}

/** Bs / USD: cookie `moneda`. La conversión dice siempre con qué tasa y de qué fecha. */
export function InterruptorMoneda({ inicial, tasaUsd, fechaValor, claro = false }: { inicial: 'VES' | 'USD'; tasaUsd: number | null; fechaValor: string | null; claro?: boolean }) {
  const [moneda, setMoneda] = useState(inicial)
  const [, iniciar] = useTransition()
  const router = useRouter()
  const titulo = tasaUsd ? `Montos convertidos a la tasa BCV ${tasa(tasaUsd)} Bs/USD · fecha valor ${fechaLarga(fechaValor)}` : 'Sin tasa BCV cargada'
  const cambiar = (m: 'VES' | 'USD') => {
    setMoneda(m)
    iniciar(async () => {
      await fijarMoneda(m)
      router.refresh()
    })
  }
  return (
    <div className={cn('flex shrink-0 overflow-hidden rounded-lg border', claro ? 'border-[var(--borde)]' : 'border-[#4a4845]')} role="group" aria-label="Moneda" title={titulo}>
      {(['VES', 'USD'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={moneda === m}
          onClick={() => cambiar(m)}
          className={cn(
            'h-8 px-2.5 text-xs',
            claro && 'h-10 px-3 text-sm',
            moneda === m ? (claro ? 'bg-[#2b2a28] font-semibold text-white' : 'bg-white font-semibold text-[#2b2a28]') : claro ? 'bg-white text-marca-500' : 'bg-[#3a3936] text-[#cfccc6] hover:bg-[#45433f]'
          )}
        >
          {m === 'VES' ? 'Bs' : 'USD'}
        </button>
      ))}
    </div>
  )
}

/** «Ver como»: solo para quien es administrador de verdad. No da permisos. */
export function VerComo({ roles, activo, rolReal }: { roles: { id: string; nombre: string }[]; activo: string | null; rolReal: string }) {
  const [, iniciar] = useTransition()
  const router = useRouter()
  return (
    <label className={cn(CTL, 'pr-1')} title="Ver la plataforma como otro rol: solo cambia lo que ves, no da permisos">
      <IconoOjo className="h-4 w-4 shrink-0" />
      <span className="sr-only">Ver como</span>
      <select
        value={activo ?? rolReal}
        onChange={(e) =>
          iniciar(async () => {
            await fijarVerComo(e.target.value === rolReal ? null : e.target.value)
            router.refresh()
          })
        }
        className="max-w-[7.5rem] cursor-pointer bg-transparent text-xs outline-none [&>option]:text-black"
      >
        {roles.map((r) => (
          <option key={r.id} value={r.id}>
            {r.id === rolReal ? 'Ver como: yo' : r.nombre}
          </option>
        ))}
      </select>
    </label>
  )
}

/** La campana vive en la colaboración (R3): menciones, aprobaciones, lo que sigo y tareas. */
export { Campana } from '@/components/sistema/colaboracion/campana'

/** La persona: nombre, rol, accesos y salir. */
export function MenuPersona({
  nombre,
  email,
  rol,
  iniciales,
  verComo,
  conCanal,
  conPanel,
}: {
  nombre: string
  email: string
  rol: string
  iniciales: string
  verComo: string | null
  conCanal: boolean
  conPanel: boolean
}) {
  return (
    <Desplegable
      etiqueta={`${iniciales} · tu cuenta: ${nombre}`}
      soloIcono
      alinear="der"
      ancho="w-64"
      claseBoton="grid h-8 w-8 place-items-center rounded-full bg-[#5a5853] text-xs font-bold text-white hover:bg-[#6a6863] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      boton={<span aria-hidden>{iniciales}</span>}
    >
      <div className="text-sm">
        <div className="border-b border-[var(--borde)] px-4 py-3">
          <p className="truncate font-semibold text-marca-900">{nombre}</p>
          <p className="truncate text-xs text-marca-500">{email}</p>
          <p className="mt-1 text-xs text-marca-600">
            {rol}
            {verComo ? ` · viendo como ${verComo}` : ''}
          </p>
        </div>
        <div className="p-1.5">
          {conPanel && (
            <Link href="/sistema/programa" className="block rounded-lg px-3 py-2 hover:bg-marca-50">
              El programa
            </Link>
          )}
          {conCanal && (
            <Link href="/canal" className="block rounded-lg px-3 py-2 hover:bg-marca-50">
              Portal planta
            </Link>
          )}
          <form action={cerrarSesion}>
            <button type="submit" className="block w-full rounded-lg px-3 py-2 text-left text-acento-700 hover:bg-acento-50">
              Salir
            </button>
          </form>
        </div>
      </div>
    </Desplegable>
  )
}
