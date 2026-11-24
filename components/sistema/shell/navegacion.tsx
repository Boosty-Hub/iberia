'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { IndicadorEnlace } from '@/components/indicador-enlace'
import { fijarColumna, fijarRiel } from '@/components/sistema/shell/acciones'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { useRutaDeFicha } from '@/components/sistema/shell/ruta-de-ficha'
import { IconoCandadito, IconoDesplegar, IconoDominio, IconoEstrella, IconoFlechaAfuera, IconoGente, IconoPlegar } from '@/components/sistema/shell/iconos'
import {
  DOMINIOS,
  ESTADO_MODULO,
  esExterno,
  grupoDe,
  hrefModulo,
  moduloDeRuta,
  pestanaDeRuta,
  type ClaveDominio,
  type ModuloPlan,
  type Pestana,
} from '@/lib/plataforma/dominios'
import { cn } from '@/lib/utils'

export type ModuloMenu = ModuloPlan & { dominioClave: ClaveDominio }
export type VistaMenu = { id: string; nombre: string; alcance: 'personal' | 'compartida' | 'bloqueada'; href: string; modulo: string | null }

/** El dominio activo: el del módulo de la ruta (en una ficha a página completa, el de su objeto), o «Mi día». */
function useActivo(modulos: ModuloMenu[]) {
  const { ruta: deUrl } = useContextoUrl()
  const deFicha = useRutaDeFicha()
  const ruta = deFicha && deUrl.startsWith('/sistema/ficha/') ? deFicha : deUrl
  const modulo = moduloDeRuta(ruta, modulos) as ModuloMenu | null
  return { ruta, modulo, dominio: modulo?.dominioClave ?? ('inicio' as ClaveDominio) }
}

/** El primer destino de un dominio: su primer módulo con pantalla, si no el primero. */
function destinoDominio(clave: ClaveDominio, modulos: ModuloMenu[]): string | null {
  const del = modulos.filter((m) => m.dominioClave === clave)
  const conPantalla = del.find((m) => m.estado !== 'planificado' && m.ruta?.startsWith('/sistema'))
  const m = conPantalla ?? del[0]
  return m ? hrefModulo(m) : null
}

const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acento-500'

/** El riel de dominios: con nombres por defecto, plegable a solo iconos (cookie `riel`). */
export function Riel({ modulos, modo: inicial }: { modulos: ModuloMenu[]; modo: 'nombres' | 'iconos' }) {
  const { dominio } = useActivo(modulos)
  const { conContexto } = useContextoUrl()
  const [modo, setModo] = useState(inicial)
  const [, iniciar] = useTransition()
  const conNombres = modo === 'nombres'
  const alternar = () => {
    const nuevo = conNombres ? 'iconos' : 'nombres'
    setModo(nuevo)
    iniciar(() => fijarRiel(nuevo))
  }

  return (
    <nav
      aria-label="Dominios"
      className={cn(
        'sticky top-12 hidden h-[calc(100dvh-3rem)] shrink-0 flex-col border-r border-[var(--borde)] bg-white py-2 min-[901px]:flex',
        conNombres ? 'w-[184px]' : 'w-14'
      )}
    >
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
        {DOMINIOS.map((d) => {
          const href = destinoDominio(d.clave, modulos)
          if (!href) return null
          const activo = d.clave === dominio
          return (
            <li key={d.clave}>
              {d.separadoAntes && <div className="mx-2 my-2 h-px bg-[var(--borde)]" aria-hidden />}
              <Link
                href={conContexto(href)}
                aria-current={activo ? 'true' : undefined}
                title={conNombres ? undefined : d.nombre}
                className={cn(
                  'group relative flex min-h-9 items-center gap-2.5 rounded-lg text-[13px] transition-colors',
                  FOCO,
                  conNombres ? 'px-2.5 py-1.5' : 'justify-center px-0 py-1.5',
                  activo ? 'bg-acento-50 font-semibold text-acento-700' : 'text-marca-600 hover:bg-marca-50 hover:text-marca-900'
                )}
              >
                <IconoDominio clave={d.clave} className="h-[18px] w-[18px] shrink-0" />
                {conNombres ? <span className="leading-tight">{d.nombre}</span> : <span className="sr-only">{d.nombre}</span>}
                {!conNombres && (
                  <span className="pointer-events-none absolute left-full z-50 ml-2 hidden rounded-md bg-[#2b2a28] px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block">
                    {d.nombre}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={alternar}
          className={cn('flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-xs text-marca-500 hover:bg-marca-50 hover:text-marca-800', FOCO, !conNombres && 'justify-center px-0')}
          aria-label={conNombres ? 'Plegar el menú a solo iconos' : 'Mostrar los nombres del menú'}
          aria-pressed={!conNombres}
        >
          {conNombres ? <IconoPlegar className="h-4 w-4" /> : <IconoDesplegar className="h-4 w-4" />}
          {conNombres && <span>Plegar</span>}
        </button>
      </div>
    </nav>
  )
}

function PuntoEstado({ estado }: { estado: ModuloPlan['estado'] }) {
  const e = ESTADO_MODULO[estado]
  return (
    <span className="ml-auto flex shrink-0 items-center" title={e.etiqueta}>
      <span className="h-[7px] w-[7px] rounded-full" style={{ background: e.color }} aria-hidden />
      <span className="sr-only">({e.etiqueta})</span>
    </span>
  )
}

const ICONO_VISTA = { personal: IconoEstrella, compartida: IconoGente, bloqueada: IconoCandadito } as const
const ETIQUETA_VISTA = { personal: 'Personal', compartida: 'Compartida', bloqueada: 'Bloqueada' } as const

/** La lista de módulos de un dominio, con sus pestañas y sus vistas. La usan la columna y el menú del teléfono. */
export function ListaModulos({
  dominio,
  modulos,
  pestanas,
  vistas,
  ruta,
  activo,
  conContexto,
}: {
  dominio: ClaveDominio
  modulos: ModuloMenu[]
  pestanas: Record<string, Pestana[]>
  vistas: VistaMenu[]
  ruta: string
  activo: ModuloMenu | null
  conContexto: (h: string) => string
}) {
  const del = modulos.filter((m) => m.dominioClave === dominio)
  const grupos = [...new Set(del.map((m) => grupoDe(m)))]
  const conGrupos = grupos.length > 1
  const codigos = new Set(del.map((m) => m.codigo))
  const susVistas = vistas.filter((v) => (v.modulo ? codigos.has(v.modulo) : false))

  return (
    <>
      {grupos.map((g) => (
        <div key={g} className={conGrupos ? 'mb-2' : ''}>
          {conGrupos && <p className="px-2 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.1em] text-marca-400 uppercase">{g}</p>}
          <ul className="flex flex-col gap-0.5">
            {del
              .filter((m) => grupoDe(m) === g)
              .map((m) => {
                const href = hrefModulo(m)
                const esActivo = activo?.codigo === m.codigo
                // En «Mi día» las pestañas repiten los módulos: no se anidan.
                const pes = esActivo && !m.codigo.startsWith('MI-') ? (pestanas[m.codigo] ?? []) : []
                const pesActiva = pestanaDeRuta(ruta, pes)
                return (
                  <li key={m.codigo}>
                    <Link
                      href={conContexto(href)}
                      aria-current={esActivo && !pes.length ? 'page' : undefined}
                      className={cn(
                        'flex min-h-8 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] leading-tight',
                        FOCO,
                        esActivo ? 'bg-white font-semibold text-marca-900 shadow-[0_0_0_1px_var(--borde)]' : 'text-marca-700 hover:bg-[#f0f1f4]'
                      )}
                    >
                      {!m.codigo.startsWith('MI-') && <span className="w-[54px] shrink-0 font-mono text-[10px] font-normal text-marca-400">{m.codigo}</span>}
                      <span className="min-w-0 flex-1">{m.nombre}</span>
                      {esExterno(href) && <IconoFlechaAfuera className="h-3 w-3 shrink-0 text-marca-400" aria-label="(sale de la plataforma)" />}
                      <IndicadorEnlace />
                      <PuntoEstado estado={m.estado} />
                    </Link>
                    {pes.length > 1 && (
                      <ul className="mt-0.5 mb-1 ml-[22px] flex flex-col border-l border-[var(--borde)] pl-2">
                        {pes.map((p) => {
                          const on = pesActiva?.href === p.href
                          return (
                            <li key={p.href}>
                              <Link
                                href={conContexto(p.href)}
                                aria-current={on ? 'page' : undefined}
                                className={cn('flex min-h-7 items-center rounded-md px-2 py-1 text-[12.5px]', FOCO, on ? 'font-semibold text-acento-700' : 'text-marca-600 hover:bg-[#f0f1f4] hover:text-marca-900')}
                              >
                                {p.etiqueta}
                                <IndicadorEnlace />
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
          </ul>
        </div>
      ))}

      <div className="mt-5">
        <p className="px-2 pb-1 text-[10.5px] font-semibold tracking-[0.1em] text-marca-400 uppercase">Vistas guardadas</p>
        {susVistas.length ? (
          <ul className="flex flex-col gap-0.5">
            {susVistas.map((v) => {
              const Icono = ICONO_VISTA[v.alcance]
              return (
                <li key={v.id}>
                  <Link href={conContexto(v.href)} className={cn('flex min-h-7 items-center gap-2 rounded-md px-2 py-1 text-[12.5px] text-marca-600 hover:bg-[#f0f1f4] hover:text-marca-900', FOCO)}>
                    <Icono className="h-3.5 w-3.5 shrink-0 text-marca-400" aria-label={ETIQUETA_VISTA[v.alcance]} />
                    <span className="truncate">{v.nombre}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-2 text-[11.5px] leading-snug text-marca-400">Guarda una desde cualquier tabla con «Vista».</p>
        )}
      </div>
    </>
  )
}

/** La segunda columna: los módulos del dominio activo. Plegable (cookie `columna`). */
export function ColumnaModulos({
  modulos,
  pestanas,
  vistas,
  modo: inicial,
}: {
  modulos: ModuloMenu[]
  pestanas: Record<string, Pestana[]>
  vistas: VistaMenu[]
  modo: 'abierta' | 'plegada'
}) {
  const { ruta, modulo, dominio } = useActivo(modulos)
  const { conContexto } = useContextoUrl()
  const [modo, setModo] = useState(inicial)
  const [, iniciar] = useTransition()
  const nombre = DOMINIOS.find((d) => d.clave === dominio)?.nombre ?? ''
  const cambiar = (nuevo: 'abierta' | 'plegada') => {
    setModo(nuevo)
    iniciar(() => fijarColumna(nuevo))
  }

  if (modo === 'plegada')
    return (
      <div className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-9 shrink-0 flex-col items-center border-r border-[var(--borde)] bg-[#fbfbfc] pt-2 min-[901px]:flex">
        <button type="button" onClick={() => cambiar('abierta')} className={cn('grid h-8 w-8 place-items-center rounded-lg text-marca-500 hover:bg-[#f0f1f4]', FOCO)} aria-label={`Mostrar los módulos de ${nombre}`}>
          <IconoDesplegar className="h-4 w-4" />
        </button>
      </div>
    )

  return (
    <aside aria-label={`Módulos de ${nombre}`} className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-[236px] shrink-0 flex-col border-r border-[var(--borde)] bg-[#fbfbfc] min-[901px]:flex">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="text-[11px] leading-snug font-semibold tracking-[0.12em] text-marca-400 uppercase">{nombre}</h2>
        <button type="button" onClick={() => cambiar('plegada')} className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-md text-marca-400 hover:bg-[#f0f1f4] hover:text-marca-700', FOCO)} aria-label="Plegar la columna de módulos">
          <IconoPlegar className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <ListaModulos dominio={dominio} modulos={modulos} pestanas={pestanas} vistas={vistas} ruta={ruta} activo={modulo} conContexto={conContexto} />
        <div className="mt-5 px-2">
          <p className="pb-1 text-[10.5px] font-semibold tracking-[0.1em] text-marca-400 uppercase">Leyenda</p>
          {(['operando', 'en_construccion', 'planificado'] as const).map((e) => (
            <p key={e} className="flex items-center gap-2 py-0.5 text-[12px] text-marca-500">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: ESTADO_MODULO[e].color }} aria-hidden />
              {ESTADO_MODULO[e].etiqueta}
            </p>
          ))}
        </div>
      </div>
    </aside>
  )
}

/** En el teléfono: los dominios plegables, con sus módulos adentro. */
export function NavegacionTelefono({ modulos, pestanas, vistas }: { modulos: ModuloMenu[]; pestanas: Record<string, Pestana[]>; vistas: VistaMenu[] }) {
  const { ruta, modulo, dominio } = useActivo(modulos)
  const { conContexto } = useContextoUrl()
  return (
    <nav aria-label="Dominios y módulos" className="flex flex-col gap-1 p-2">
      {DOMINIOS.map((d) => {
        if (!modulos.some((m) => m.dominioClave === d.clave)) return null
        return (
          <details key={d.clave} open={d.clave === dominio} className="group rounded-xl">
            <summary className={cn('flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm', d.clave === dominio ? 'bg-acento-50 font-semibold text-acento-700' : 'text-marca-700')}>
              <IconoDominio clave={d.clave} className="h-5 w-5 shrink-0" />
              {d.nombre}
              <span className="ml-auto text-marca-400 transition-transform group-open:rotate-90" aria-hidden>
                ›
              </span>
            </summary>
            <div className="px-1 pt-1 pb-2">
              <ListaModulos dominio={d.clave} modulos={modulos} pestanas={pestanas} vistas={vistas} ruta={ruta} activo={modulo} conContexto={conContexto} />
            </div>
          </details>
        )
      })}
    </nav>
  )
}
