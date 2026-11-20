'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { cargarFicha } from '@/components/sistema/shell/acciones'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { IconoFlechaAfuera } from '@/components/sistema/shell/iconos'
import { IconoCerrar } from '@/components/iconos'
import { LineaTiempoCliente } from '@/components/sistema/colaboracion/linea-tiempo-cliente'
import { BloquesFicha, FilaAcciones, FilaDato } from '@/components/sistema/ui/ficha-edicion'
import { PestanaIa } from '@/components/sistema/ia/pestana-ia'
import { TONO_CHIP, type Ficha } from '@/lib/plataforma/ficha-tipos'
import { fechaLarga } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * La ficha del objeto (Anexo E §2.1): las mismas pestañas para todo —Datos ·
 * Relaciones · Línea de tiempo · Documentos · Aprobaciones · IA—. Cada pestaña
 * es un hueco: quien la pinta puede pasar el suyo (`ranuras`), y si no, se llena
 * con lo que trae la ficha. En un perímetro no hay pestaña de IA.
 */

type ClavePestana = 'datos' | 'relaciones' | 'linea' | 'documentos' | 'aprobaciones' | 'ia' | `s:${string}`

export function FichaObjeto({
  ficha,
  variante = 'panel',
  alCerrar,
  alCambiar,
  ranuras,
}: {
  ficha: Ficha
  variante?: 'panel' | 'pagina'
  alCerrar?: () => void
  /** Después de una edición o una acción: vuelve a cargar la ficha. */
  alCambiar?: () => void
  ranuras?: Partial<Record<ClavePestana, ReactNode>>
}) {
  const [elegida, setPestana] = useState<ClavePestana>('datos')
  const { fijar } = useContextoUrl()
  const titulo = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (variante === 'panel') titulo.current?.focus()
  }, [ficha.id, variante])

  const pestanas: { clave: ClavePestana; etiqueta: string; n?: number }[] = [
    { clave: 'datos', etiqueta: 'Datos' },
    ...(ficha.secciones ?? []).map((s) => ({ clave: `s:${s.clave}` as ClavePestana, etiqueta: s.candado ? `${s.etiqueta} 🔒` : s.etiqueta, n: s.n })),
    { clave: 'relaciones', etiqueta: 'Relaciones', n: ficha.relaciones.length },
    { clave: 'linea', etiqueta: 'Línea de tiempo' },
    { clave: 'documentos', etiqueta: 'Documentos', n: ficha.documentos.length },
    { clave: 'aprobaciones', etiqueta: 'Aprobaciones', n: ficha.aprobaciones.length },
    ...(ficha.perimetro ? [] : [{ clave: 'ia' as const, etiqueta: 'IA' }]),
  ]

  const abrirOtra = (valor: string) => (variante === 'panel' ? fijar({ ficha: valor }) : undefined)
  const hrefOtra = (valor: string) => `/sistema/ficha/${valor.replace(':', '/')}`
  const valorFicha = `${ficha.tipo}:${ficha.id}`
  // Si la ficha nueva no tiene la pestaña que estaba abierta, se vuelve a «Datos».
  const pestana: ClavePestana = pestanas.some((p) => p.clave === elegida) ? elegida : 'datos'
  const seccion = pestana.startsWith('s:') ? ficha.secciones?.find((s) => `s:${s.clave}` === pestana) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--borde)] px-4 pt-3 pb-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-marca-400 uppercase">
              {ficha.tipoEtiqueta}
              {ficha.codigo && <span className="ml-2 font-mono tracking-normal normal-case">{ficha.codigo}</span>}
            </p>
            <h2 ref={titulo} tabIndex={-1} className={cn('mt-0.5 font-bold text-marca-900 outline-none', variante === 'pagina' ? 'text-xl' : 'text-base leading-snug')}>
              {ficha.titulo}
            </h2>
            {ficha.subtitulo && <p className="mt-0.5 text-xs text-marca-500">{ficha.subtitulo}</p>}
          </div>
          {alCerrar && (
            <button type="button" onClick={alCerrar} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-marca-500 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500" aria-label="Cerrar la ficha (Esc)">
              <IconoCerrar className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ficha.estado && <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', TONO_CHIP[ficha.estado.tono])}>{ficha.estado.etiqueta}</span>}
          {ficha.perimetro && <span className="rounded-full bg-[#eef0f3] px-2 py-0.5 text-[11px] font-semibold text-marca-600">🔒 Perímetro · sin IA</span>}
          <span className="flex-1" />
          {variante === 'panel' && (
            <Link href={hrefOtra(`${ficha.tipo}:${ficha.id}`)} className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--borde)] px-2 text-xs text-marca-700 hover:bg-marca-50">
              Página completa
            </Link>
          )}
          {ficha.hrefModulo && (
            <Link href={ficha.hrefModulo} className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--borde)] px-2 text-xs text-marca-700 hover:bg-marca-50">
              Abrir en el módulo <IconoFlechaAfuera className="h-3 w-3" />
            </Link>
          )}
        </div>
        {ficha.acciones?.length ? (
          <div className="mt-2">
            <FilaAcciones acciones={ficha.acciones} fichaValor={valorFicha} alCambiar={alCambiar} />
          </div>
        ) : null}
      </div>

      <div role="tablist" aria-label="Secciones de la ficha" className="flex flex-wrap gap-x-0.5 border-b border-[var(--borde)] px-2">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            role="tab"
            type="button"
            aria-selected={pestana === p.clave}
            onClick={() => setPestana(p.clave)}
            className={cn(
              'min-h-9 border-b-2 px-2.5 text-[12.5px] whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acento-500',
              pestana === p.clave ? 'border-[#D4332C] font-semibold text-marca-900' : 'border-transparent text-marca-500 hover:text-marca-800'
            )}
          >
            {p.etiqueta}
            {p.n !== undefined && p.n > 0 && <span className="ml-1 rounded-lg bg-[#eef0f3] px-1.5 text-[10px] text-marca-600">{p.n}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto px-4 py-3 text-[13px]">
        {ranuras?.[pestana] ?? (
          <>
            {pestana === 'datos' && (
              <dl className="grid grid-cols-[minmax(7rem,35%)_1fr] gap-x-3 gap-y-1.5">
                {ficha.datos.map((d) => (
                  <FilaDato key={d.etiqueta} d={d} fichaValor={valorFicha} alCambiar={alCambiar} />
                ))}
              </dl>
            )}

            {seccion && (
              <BloquesFicha bloques={seccion.bloques} fichaValor={valorFicha} alCambiar={alCambiar} abrirFicha={variante === 'panel' ? abrirOtra : undefined} hrefFicha={hrefOtra} />
            )}

            {pestana === 'relaciones' &&
              (ficha.relaciones.length ? (
                <ul className="flex flex-col gap-1.5">
                  {ficha.relaciones.map((r, i) => {
                    const cuerpo = (
                      <>
                        <span className="w-24 shrink-0 text-[10px] tracking-[0.06em] text-marca-400 uppercase">{r.tipo}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-marca-900">{r.titulo}</span>
                          {r.detalle && <span className="block truncate text-[11.5px] text-marca-500">{r.detalle}</span>}
                        </span>
                      </>
                    )
                    const clase = 'flex w-full items-center gap-2 rounded-lg border border-[var(--borde)] px-2.5 py-1.5 text-left hover:bg-marca-50'
                    return (
                      <li key={i}>
                        {r.ficha && variante === 'panel' ? (
                          <button type="button" className={clase} onClick={() => abrirOtra(r.ficha!)}>
                            {cuerpo}
                          </button>
                        ) : r.ficha ? (
                          <Link className={clase} href={hrefOtra(r.ficha)}>
                            {cuerpo}
                          </Link>
                        ) : r.href ? (
                          <Link className={clase} href={r.href}>
                            {cuerpo}
                          </Link>
                        ) : (
                          <div className={clase}>{cuerpo}</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <Vacio>Sin relaciones registradas.</Vacio>
              ))}

            {/* R3: comentarios, @menciones, seguir, decisiones, cambios e IA (`components/sistema/colaboracion`). */}
            {pestana === 'linea' && <LineaTiempoCliente tipo={ficha.tipo} id={ficha.id} />}

            {pestana === 'documentos' &&
              (ficha.documentos.length ? (
                <ul className="divide-y divide-[var(--borde)] rounded-lg border border-[var(--borde)]">
                  {ficha.documentos.map((d) => (
                    <li key={d.href}>
                      <Link href={d.href} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-marca-50">
                        <span className="w-28 shrink-0 font-mono text-[11px] text-marca-500">{d.codigo}</span>
                        <span className="min-w-0 flex-1 truncate">{d.titulo}</span>
                        <span className="text-[11px] text-marca-400">{d.estado}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vacio>Sin documentos vinculados.</Vacio>
              ))}

            {pestana === 'aprobaciones' &&
              (ficha.aprobaciones.length ? (
                <ul className="flex flex-col gap-2">
                  {ficha.aprobaciones.map((a, i) => (
                    <li key={i} className="rounded-lg border border-[var(--borde)] p-2.5">
                      <p className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 font-medium text-marca-900">{a.titulo}</span>
                        <span className="text-[11px] text-marca-500">{a.estado}</span>
                      </p>
                      <p className="text-[11.5px] text-marca-400">Pedida el {fechaLarga(a.creado_en)}</p>
                      <ol className="mt-1.5 flex flex-col gap-0.5">
                        {a.pasos.map((p) => (
                          <li key={p.orden} className="flex gap-2 text-[12px]">
                            <span className="w-4 text-marca-400">{p.orden}</span>
                            <span className="min-w-0 flex-1 text-marca-700">{p.nombre}</span>
                            <span className="text-marca-500">{p.decision}</span>
                          </li>
                        ))}
                      </ol>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vacio>Este objeto no ha pasado por una ruta de aprobación.</Vacio>
              ))}

            {/* R4: propuestas de la IA sobre este objeto y las capacidades que aplican (`components/sistema/ia`). */}
            {pestana === 'ia' && <PestanaIa tipo={ficha.tipo} id={ficha.id} titulo={ficha.titulo} />}
          </>
        )}
      </div>
    </div>
  )
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-marca-400">{children}</p>
}

/**
 * El panel lateral del armazón: oye `?ficha=tipo:id` en cualquier página de
 * `/sistema` (la abre la tabla, la búsqueda, el lienzo) y la carga con la
 * sesión de quien mira. Cierra con Esc o con la ✕; en teléfono va a pantalla
 * completa.
 */
export function PanelFicha() {
  const { sp, fijar } = useContextoUrl()
  const valor = sp.get('ficha')
  // Lo cargado va con su llave: al cambiar de ficha, la anterior se ve atenuada
  // hasta que llega la nueva, y nunca se confunde con ella.
  const [cargada, setCargada] = useState<{ valor: string; ficha: Ficha | null } | null>(null)
  const [cargando, iniciar] = useTransition()
  // Sube con cada edición o acción: vuelve a pedir la ficha sin cambiar de objeto.
  const [vuelta, setVuelta] = useState(0)

  useEffect(() => {
    if (!valor) return
    iniciar(async () => {
      const r = await cargarFicha(valor).catch(() => ({ ficha: null }))
      setCargada({ valor, ficha: r.ficha })
    })
  }, [valor, vuelta])

  const ficha = cargada?.ficha ?? null
  const error = cargada?.valor === valor && !cargada.ficha

  // El foco (R6 · WCAG 2.4.3): al cerrar vuelve a donde estaba (la fila, la caja,
  // el aviso); en teléfono la ficha tapa la página, así que al abrir entra en ella.
  const panel = useRef<HTMLElement>(null)
  const origen = useRef<HTMLElement | null>(null)
  const abiertaAntes = useRef(false)
  useEffect(() => {
    if (valor && !abiertaAntes.current) {
      const activo = document.activeElement
      origen.current = activo instanceof HTMLElement && activo !== document.body ? activo : null
      if (window.matchMedia('(max-width: 900px)').matches) panel.current?.focus()
    }
    if (!valor && abiertaAntes.current && origen.current?.isConnected) origen.current.focus()
    abiertaAntes.current = Boolean(valor)
  }, [valor])

  useEffect(() => {
    if (!valor) return
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[data-paleta-abierta]')) fijar({ ficha: null }, 'replace')
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [valor, fijar])

  if (!valor) return null
  const cerrar = () => fijar({ ficha: null }, 'replace')

  return (
    <aside
      ref={panel}
      tabIndex={-1}
      aria-label="Ficha del objeto"
      data-ficha-objeto
      className="fixed inset-x-0 top-12 bottom-0 z-30 flex flex-col outline-none border-l border-[var(--borde)] bg-white shadow-[-12px_0_30px_rgba(0,0,0,0.06)] min-[901px]:sticky min-[901px]:inset-auto min-[901px]:top-12 min-[901px]:h-[calc(100dvh-3rem)] min-[901px]:w-[420px] min-[901px]:shrink-0 min-[901px]:shadow-none"
    >
      {cargando && !ficha && <p className="p-6 text-center text-sm text-marca-400">Cargando la ficha…</p>}
      {error && !cargando && (
        <div className="p-6 text-center text-sm text-marca-500">
          <p>Esta ficha no está a tu alcance o ya no existe.</p>
          <button type="button" onClick={cerrar} className="btn-neutro mt-3 h-9">
            Cerrar
          </button>
        </div>
      )}
      {ficha && (
        <div className={cn('min-h-0 flex-1 transition-opacity', cargando && 'opacity-60')}>
          <FichaObjeto ficha={ficha} alCerrar={cerrar} alCambiar={() => setVuelta((n) => n + 1)} />
        </div>
      )}
    </aside>
  )
}
