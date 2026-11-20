'use client'

import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Fragment, useEffect, useMemo, useState, useTransition } from 'react'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { IconoBajar, IconoCandadito, IconoEstrella, IconoFlechita, IconoGente, IconoLupa } from '@/components/sistema/shell/iconos'
import { Desplegable } from '@/components/sistema/ui/desplegable'
import { borrarVista, exportarCsv, guardarVista } from '@/components/sistema/ui/tabla-acciones'
import { fechaCorta, fechaHora, numero, porcentaje, tasa } from '@/lib/plataforma/formato'
import { MarcaIa } from '@/components/sistema/ia/nivel-ia'
import type { MarcaCelda } from '@/lib/ia/niveles'
import { PREFIJO_FILTRO, TAMANOS, consultaDeEstado, type AccionFila, type Columna, type EstadoTabla, type TonoCelda } from '@/lib/plataforma/tabla'
import { cn } from '@/lib/utils'

/**
 * `TablaDatos` (Anexo E §4): la tabla densa que es la pantalla principal. Todo
 * lo hace el servidor —filtrar, ordenar, contar, paginar, totalizar— y aquí solo
 * se pinta y se cambia la URL. TanStack Table lleva el modelo de columnas
 * (visibilidad, orden, encabezados); sin virtualizar, porque la página trae a lo
 * sumo 200 filas.
 *
 * Teclado: cada fila se enfoca con Tab y se abre con Enter; los encabezados
 * ordenan con Enter o Espacio y dicen su orden (`aria-sort`).
 */

export type Fila = Record<string, unknown>
export type VistaTabla = { id: string; nombre: string; alcance: 'personal' | 'compartida' | 'bloqueada'; consulta: string; borrable: boolean }

const TONO: Record<TonoCelda, string> = {
  neutro: 'bg-[#eef0f3] text-marca-600',
  verde: 'bg-[#e7f5ee] text-[#1f6f4b]',
  ambar: 'bg-[#fdf4e3] text-[#8a5a12]',
  rojo: 'bg-[#fbeceb] text-[#a3241f]',
  azul: 'bg-[#eaf2fb] text-[#2f5f9a]',
  morado: 'bg-[#f1edfa] text-[#5a3f9e]',
}
const NUMERICAS = new Set(['entero', 'decimal', 'tasa', 'porcentaje'])
const CTL = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs text-marca-700 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500'
const ICONO_VISTA = { personal: IconoEstrella, compartida: IconoGente, bloqueada: IconoCandadito } as const

function texto(v: unknown, c: Columna, fila: Fila): string {
  if (v === null || v === undefined || v === '') return '—'
  if (c.etiquetaDe && fila[c.etiquetaDe] !== null && fila[c.etiquetaDe] !== undefined) return String(fila[c.etiquetaDe])
  if (c.etiquetas && typeof v === 'string') return c.etiquetas[v] ?? v
  if (typeof v === 'boolean') return c.etiquetas?.[String(v)] ?? (v ? 'Sí' : 'No')
  switch (c.tipo) {
    case 'entero':
      return numero(Number(v))
    case 'decimal':
      return numero(Number(v), 2)
    case 'tasa':
      return tasa(Number(v))
    case 'porcentaje':
      return porcentaje(Number(v))
    case 'fecha':
      return fechaCorta(String(v))
    case 'fechaHora':
      return fechaHora(String(v))
    default:
      return String(v)
  }
}

function Celda({ v, c, fila }: { v: unknown; c: Columna; fila: Fila }) {
  const t = texto(v, c, fila)
  if (c.tipo === 'insignia' && t !== '—') {
    const tono = ((typeof v === 'string' || typeof v === 'boolean') && c.tonos?.[String(v)]) || 'neutro'
    return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', TONO[tono])}>{t}</span>
  }
  if (c.tipo === 'codigo') return <span className="font-mono text-[11.5px] text-marca-600">{t}</span>
  return <>{t}</>
}

function CeldaEditable({ v, c, fila, guardar }: { v: unknown; c: Columna; fila: Fila; guardar: (valor: string) => Promise<{ error?: string } | void> }) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(v === null || v === undefined ? '' : String(v))
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  if (!editando)
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setEditando(true)
        }}
        className="border-b border-dashed border-[#c8ccd2] text-left hover:border-marca-500"
        aria-label={`Editar ${c.etiqueta}`}
        title={c.ayudaEdicion ?? 'Editar'}
      >
        <Celda v={v} c={c} fila={fila} />
      </button>
    )
  // Con etiquetas, el valor es uno de una lista: se elige, no se teclea.
  if (c.etiquetas)
    return (
      <span onClick={(e) => e.stopPropagation()} className="inline-flex flex-col">
        <select
          autoFocus
          value={valor}
          disabled={pendiente}
          onChange={(e) => {
            const nuevo = e.target.value
            setValor(nuevo)
            iniciar(async () => {
              const r = await guardar(nuevo)
              if (r && r.error) setError(r.error)
              else setEditando(false)
            })
          }}
          onBlur={() => !pendiente && setEditando(false)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') setEditando(false)
          }}
          className="h-7 rounded border border-acento-300 bg-white px-1 text-[13px] outline-none focus:ring-2 focus:ring-acento-100"
          aria-label={`Nuevo valor de ${c.etiqueta}`}
        >
          {Object.entries(c.etiquetas).map(([k, et]) => (
            <option key={k} value={k}>
              {et}
            </option>
          ))}
        </select>
        {error && <span className="text-[11px] text-acento-700">{error}</span>}
      </span>
    )
  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex flex-col">
      {c.opciones ? (
        <select
          autoFocus
          value={valor}
          disabled={pendiente}
          onChange={(e) => {
            const nuevo = e.target.value
            setValor(nuevo)
            iniciar(async () => {
              const r = await guardar(nuevo)
              if (r && r.error) setError(r.error)
              else setEditando(false)
            })
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') setEditando(false)
          }}
          onBlur={() => !pendiente && setEditando(false)}
          className="h-7 w-full min-w-24 rounded border border-acento-300 px-1 text-[13px] outline-none focus:ring-2 focus:ring-acento-100"
          aria-label={`Nuevo valor de ${c.etiqueta} (Esc cancela)`}
        >
          {!c.opciones.some((o) => o.valor === valor) && <option value={valor}>—</option>}
          {c.opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      ) : (
      <input
        autoFocus
        value={valor}
        disabled={pendiente}
        onChange={(e) => setValor(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') setEditando(false)
          if (e.key === 'Enter')
            iniciar(async () => {
              const r = await guardar(valor)
              if (r && r.error) setError(r.error)
              else setEditando(false)
            })
        }}
        className="h-7 w-full min-w-24 rounded border border-acento-300 px-1.5 text-[13px] outline-none focus:ring-2 focus:ring-acento-100"
        aria-label={`Nuevo valor de ${c.etiqueta} (Enter guarda, Esc cancela)`}
      />
      )}
      {error && <span className="text-[11px] text-acento-700">{error}</span>}
    </span>
  )
}

export function TablaDatos({
  id,
  columnas,
  filas,
  claveFila,
  ficha,
  total,
  totales,
  grupos,
  opciones,
  estado,
  conBusqueda,
  vistas,
  puedeCompartir,
  puedeBloquear,
  error,
  alEditar,
  alAccion,
  marcas,
  vacio = 'No hay filas con estos filtros.',
}: {
  id: string
  columnas: Columna[]
  filas: Fila[]
  claveFila: string
  ficha?: { tipo: string; columna: string }
  total: number
  totales: Record<string, number>
  grupos: Record<string, { n: number; sumas: Record<string, number> }>
  opciones: Record<string, { valor: string; etiqueta: string; n: number }[]>
  estado: EstadoTabla
  conBusqueda: boolean
  vistas: VistaTabla[]
  puedeCompartir: boolean
  puedeBloquear: boolean
  error?: string | null
  /** Edición en la celda: guarda y devuelve el error si lo hay. La fila se identifica por `claveFila`. */
  alEditar?: (clave: string, columna: string, valor: string) => Promise<{ error?: string } | void>
  /** Las acciones de fila que piden un texto (columna `acciones`). Puede devolver la ficha que hay que abrir. */
  alAccion?: (clave: string, accion: string, texto: string) => Promise<{ error?: string; ficha?: string | null } | void>
  /** R4 · marcas ⚑ de la IA por fila (`claveFila`) y columna, con su razón. */
  marcas?: Record<string, Record<string, MarcaCelda>>
  vacio?: string
}) {
  const { sp, fijar, pendiente, ruta } = useContextoUrl()
  const router = useRouter()
  const [busqueda, setBusqueda] = useState(estado.q)
  const [exportando, iniciarExportar] = useTransition()
  const [aviso, setAviso] = useState<string | null>(null)
  const fichaActiva = sp.get('ficha')

  // La búsqueda va a la URL con una pausa de 300 ms.
  useEffect(() => {
    if (busqueda === estado.q) return
    const t = setTimeout(() => fijar({ q: busqueda || null, pag: null }, 'replace'), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda])

  const porClave = useMemo(() => new Map(columnas.map((c) => [c.clave, c])), [columnas])
  const visibles = estado.columnas.map((k) => porClave.get(k)).filter((c): c is Columna => Boolean(c))

  const defs = useMemo<ColumnDef<Fila>[]>(
    () =>
      columnas.map((c) => ({
        id: c.clave,
        accessorFn: (f: Fila) => f[c.clave],
        header: c.etiqueta,
        cell: (ctx) =>
          c.tipo === 'acciones' ? (
            <AccionesFila
              claves={String(ctx.getValue() ?? '')}
              acciones={c.acciones ?? []}
              fila={ctx.row.original}
              clave={String(ctx.row.original[claveFila])}
              ficha={ficha ? `${ficha.tipo}:${ctx.row.original[ficha.columna]}` : null}
              alAccion={alAccion}
            />
          ) : c.editable && alEditar ? (
            <CeldaEditable v={ctx.getValue()} c={c} fila={ctx.row.original} guardar={(valor) => alEditar(String(ctx.row.original[claveFila]), c.clave, valor)} />
          ) : (
            <Celda v={ctx.getValue()} c={c} fila={ctx.row.original} />
          ),
      })),
    [columnas, alEditar, alAccion, claveFila, ficha]
  )

  // TanStack devuelve funciones que el compilador de React no memoiza: este
  // componente no se compila con él, y está bien (la tabla es de servidor).
  // eslint-disable-next-line react-hooks/incompatible-library
  const tabla = useReactTable({
    data: filas,
    columns: defs,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    manualFiltering: true,
    getRowId: (f) => String(f[claveFila]),
    state: {
      columnVisibility: Object.fromEntries(columnas.map((c) => [c.clave, estado.columnas.includes(c.clave)])),
      columnOrder: [...estado.columnas, ...columnas.map((c) => c.clave).filter((k) => !estado.columnas.includes(k))],
      sorting: estado.orden ? [{ id: estado.orden, desc: estado.dir === 'desc' }] : [],
    },
  })

  // ── Cambios de estado: todos van a la URL ───────────────────────────────────
  const ordenarPor = (c: Columna) => {
    if (c.ordenable === false) return
    const dir = estado.orden === c.clave && estado.dir === 'asc' ? 'desc' : 'asc'
    fijar({ orden: c.clave, dir, pag: null })
  }
  const alternarFiltro = (col: string, valor: string) => {
    const nuevo = new URLSearchParams(sp.toString())
    const k = PREFIJO_FILTRO + col
    const actuales = nuevo.getAll(k)
    nuevo.delete(k)
    for (const v of actuales.includes(valor) ? actuales.filter((x) => x !== valor) : [...actuales, valor]) nuevo.append(k, v)
    nuevo.delete('pag')
    nuevo.delete('vista')
    router.push(`${ruta}?${nuevo}`, { scroll: false })
  }
  const quitarFiltro = (col: string) => fijar({ [PREFIJO_FILTRO + col]: null, pag: null, vista: null })
  const fijarColumnas = (cols: string[]) => fijar({ cols: cols.join(',') || null, vista: null })
  const restablecer = () => {
    const nuevo = new URLSearchParams()
    for (const k of ['al', 'esc']) if (sp.get(k)) nuevo.set(k, sp.get(k)!)
    router.push(nuevo.toString() ? `${ruta}?${nuevo}` : ruta, { scroll: false })
  }

  const exportar = () =>
    iniciarExportar(async () => {
      setAviso(null)
      const r = await exportarCsv(id, sp.toString())
      if ('error' in r) return setAviso(r.error)
      const url = URL.createObjectURL(new Blob([r.contenido], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = r.nombre
      a.click()
      URL.revokeObjectURL(url)
      setAviso(`Se exportaron ${numero(r.filas)} filas${r.cortado ? ' (tope alcanzado: filtra para bajar el resto)' : ''}.`)
    })

  const desde = total ? (estado.pagina - 1) * estado.tamano + 1 : 0
  const hasta = Math.min(total, estado.pagina * estado.tamano)
  const paginas = Math.max(1, Math.ceil(total / estado.tamano))
  const filtrables = columnas.filter((c) => c.filtrable)
  const agrupables = columnas.filter((c) => c.agrupable)
  const activos = Object.keys(estado.filtros)
  const vistaActiva = vistas.find((v) => v.id === estado.vista)
  const colAgrupar = estado.agrupar ? porClave.get(estado.agrupar) : null
  const hayTotales = visibles.some((c) => c.total)

  const abrir = (f: Fila) => {
    if (!ficha) return
    fijar({ ficha: `${ficha.tipo}:${f[ficha.columna]}` })
  }

  let grupoAnterior: string | null = null

  return (
    <div className={cn('transition-opacity', pendiente && 'opacity-60')} aria-busy={pendiente}>
      {/* ── Barra de datos: filtros en chips a la izquierda, vista a la derecha ── */}
      <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
        {conBusqueda && (
          <label className="inline-flex h-8 min-w-[12rem] flex-1 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs sm:max-w-[18rem] sm:flex-none">
            <IconoLupa className="h-3.5 w-3.5 shrink-0 text-marca-400" />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en la tabla…  ( / )" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Buscar en la tabla" data-busqueda-tabla />
          </label>
        )}

        {activos.map((col) => {
          const c = porClave.get(col)
          if (!c) return null
          const vals = estado.filtros[col]
          const nombres = vals.map((v) => opciones[col]?.find((o) => o.valor === v)?.etiqueta ?? (v === '∅' ? 'Sin dato' : (c.etiquetas?.[v] ?? v)))
          return (
            <span key={col} className="inline-flex h-8 items-center rounded-lg border border-[#d9cfc0] bg-[#fffaf0] text-xs">
              <Desplegable
                etiqueta={`Filtro ${c.etiqueta}: ${nombres.join(', ')}. Cambiar`}
                claseBoton="inline-flex h-8 items-center gap-1 pl-2.5 pr-1.5"
                boton={
                  <>
                    <span className="text-marca-500">{c.etiqueta}:</span>
                    <b className="max-w-[10rem] truncate font-semibold">{nombres[0]}</b>
                    {nombres.length > 1 && <span className="text-marca-500">+{nombres.length - 1}</span>}
                  </>
                }
              >
                <ListaOpciones col={col} opciones={opciones[col] ?? []} marcadas={vals} alternar={alternarFiltro} />
              </Desplegable>
              <button type="button" onClick={() => quitarFiltro(col)} className="grid h-8 w-7 place-items-center rounded-r-lg text-marca-500 hover:bg-[#f6eedd] hover:text-marca-900" aria-label={`Quitar el filtro ${c.etiqueta}`}>
                ✕
              </button>
            </span>
          )
        })}

        {filtrables.length > 0 && (
          <Desplegable etiqueta="Añadir un filtro" claseBoton={cn(CTL, 'border-dashed text-marca-500')} boton={<>＋ Filtro</>} ancho="w-72">
            <div className="p-1.5">
              {filtrables.map((c) => (
                <details key={c.clave} className="group" open={filtrables.length === 1}>
                  <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between rounded-lg px-2 text-[13px] hover:bg-marca-50">
                    {c.etiqueta}
                    <IconoFlechita className="h-3.5 w-3.5 text-marca-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <ListaOpciones col={c.clave} opciones={opciones[c.clave] ?? []} marcadas={estado.filtros[c.clave] ?? []} alternar={alternarFiltro} />
                </details>
              ))}
            </div>
          </Desplegable>
        )}

        <span className="flex-1" />

        {agrupables.length > 0 && (
          <Desplegable
            etiqueta="Agrupar"
            alinear="der"
            claseBoton={CTL}
            ancho="w-56"
            boton={
              <>
                Agrupar: <b className="font-semibold">{colAgrupar?.etiqueta ?? 'no'}</b>
              </>
            }
          >
            {(cerrar) => (
              <div className="p-1.5 text-[13px]">
                {[null, ...agrupables].map((c) => (
                  <button
                    key={c?.clave ?? 'nada'}
                    type="button"
                    aria-pressed={(c?.clave ?? null) === estado.agrupar}
                    onClick={() => {
                      fijar({ agrupar: c?.clave ?? null, pag: null, vista: null })
                      cerrar()
                    }}
                    className={cn('flex min-h-8 w-full items-center rounded-lg px-2 text-left hover:bg-marca-50', (c?.clave ?? null) === estado.agrupar && 'font-semibold')}
                  >
                    {(c?.clave ?? null) === estado.agrupar ? '● ' : '○ '}
                    {c?.etiqueta ?? 'Sin agrupar'}
                  </button>
                ))}
              </div>
            )}
          </Desplegable>
        )}

        <Desplegable
          etiqueta="Elegir columnas"
          alinear="der"
          claseBoton={CTL}
          ancho="w-60"
          boton={
            <>
              Columnas: <b className="font-semibold">{visibles.length}</b>
            </>
          }
        >
          <div className="p-1.5 text-[13px]">
            {columnas.map((c) => {
              const on = estado.columnas.includes(c.clave)
              return (
                <label key={c.clave} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-marca-50">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={on && visibles.length === 1}
                    onChange={() => fijarColumnas(on ? estado.columnas.filter((k) => k !== c.clave) : [...estado.columnas, c.clave])}
                    className="h-4 w-4 accent-[#2b2a28]"
                  />
                  {c.etiqueta}
                </label>
              )
            })}
            <button type="button" onClick={() => fijar({ cols: null, vista: null })} className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-acento-700 hover:bg-marca-50">
              Volver a las de siempre
            </button>
          </div>
        </Desplegable>

        <Desplegable
          etiqueta="Vistas guardadas"
          alinear="der"
          claseBoton={CTL}
          ancho="w-72"
          boton={
            <>
              Vista: <b className="max-w-[9rem] truncate font-semibold">{vistaActiva?.nombre ?? 'Predeterminada'}</b> <IconoFlechita className="h-3 w-3" />
            </>
          }
        >
          {(cerrar) => (
            <PanelVistas
              tabla={id}
              vistas={vistas}
              activa={estado.vista}
              puedeCompartir={puedeCompartir}
              puedeBloquear={puedeBloquear}
              consulta={consultaDeEstado(sp)}
              aplicar={(v) => {
                const nuevo = new URLSearchParams(v ? v.consulta : '')
                for (const k of ['al', 'esc']) if (sp.get(k)) nuevo.set(k, sp.get(k)!)
                if (v) nuevo.set('vista', v.id)
                router.push(`${ruta}?${nuevo}`, { scroll: false })
                cerrar()
              }}
              restablecer={() => {
                restablecer()
                cerrar()
              }}
            />
          )}
        </Desplegable>

        <button type="button" onClick={exportar} disabled={exportando} className={CTL} title="Baja lo filtrado, en el orden actual y con tus permisos">
          <IconoBajar className="h-3.5 w-3.5" />
          {exportando ? 'Exportando…' : 'CSV'}
        </button>
      </div>

      {(aviso || error) && (
        <p role="status" className={cn('mb-2 text-xs', error ? 'text-acento-700' : 'text-marca-500')}>
          {error ? `No se pudo leer la tabla: ${error}` : aviso}
        </p>
      )}

      {/* ── La tabla ── */}
      <div className="overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              {tabla.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => {
                    const c = porClave.get(h.column.id)!
                    const num = NUMERICAS.has(c.tipo ?? '')
                    const ordenada = estado.orden === c.clave
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        aria-sort={ordenada ? (estado.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        style={c.ancho ? { minWidth: c.ancho } : undefined}
                        className={cn('sticky top-0 border-b border-[var(--borde)] bg-[#fafbfc] px-2.5 py-0 text-[11px] font-semibold whitespace-nowrap text-marca-500', num ? 'text-right' : 'text-left')}
                      >
                        {c.ordenable === false ? (
                          <span className="inline-flex min-h-8 items-center" title={c.ayuda}>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                          </span>
                        ) : (
                          <button type="button" onClick={() => ordenarPor(c)} title={c.ayuda} className={cn('inline-flex min-h-8 items-center gap-1 hover:text-marca-900 focus-visible:outline-2 focus-visible:outline-acento-500', ordenada && 'text-marca-900')}>
                            {c.candado && <IconoCandadito className="h-3 w-3" />}
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <span aria-hidden className={cn('text-[9px]', !ordenada && 'opacity-30')}>
                              {ordenada ? (estado.dir === 'asc' ? '▲' : '▼') : '▲'}
                            </span>
                          </button>
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {!filas.length && (
                <tr>
                  <td colSpan={visibles.length} className="px-3 py-10 text-center text-marca-400">
                    {vacio}
                  </td>
                </tr>
              )}
              {tabla.getRowModel().rows.map((r) => {
                const f = r.original
                const valorGrupo = estado.agrupar ? (f[estado.agrupar] === null || f[estado.agrupar] === undefined ? '∅' : String(f[estado.agrupar])) : null
                const nuevoGrupo = valorGrupo !== null && valorGrupo !== grupoAnterior
                grupoAnterior = valorGrupo
                const g = valorGrupo !== null ? grupos[valorGrupo] : null
                const fichaFila = ficha ? `${ficha.tipo}:${f[ficha.columna]}` : null
                const seleccionada = fichaFila !== null && fichaFila === fichaActiva
                return (
                  <Fragment key={r.id}>
                    {nuevoGrupo && colAgrupar && (
                      <tr className="bg-[#f4f5f7]">
                        {r.getVisibleCells().map((cell, i) => {
                          const c = porClave.get(cell.column.id)!
                          return (
                            <td key={cell.id} className={cn('border-b border-[var(--borde)] px-2.5 py-1.5 text-[12px] font-semibold text-marca-800', NUMERICAS.has(c.tipo ?? '') && 'text-right tabular-nums')}>
                              {i === 0 ? (
                                <>
                                  {texto(f[colAgrupar.clave], colAgrupar, f)} <span className="font-normal text-marca-500">· {numero(g?.n ?? 0)}</span>
                                </>
                              ) : c.total && g ? (
                                numero(g.sumas[c.clave] ?? 0)
                              ) : null}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                    <tr
                      tabIndex={ficha ? 0 : undefined}
                      aria-selected={ficha ? seleccionada : undefined}
                      onClick={() => abrir(f)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) abrir(f)
                      }}
                      className={cn(
                        'group',
                        ficha && 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acento-500',
                        seleccionada ? 'bg-acento-50/60' : 'hover:bg-[#f8f9fb]'
                      )}
                    >
                      {r.getVisibleCells().map((cell) => {
                        const c = porClave.get(cell.column.id)!
                        return (
                          <td key={cell.id} className={cn('h-8 border-b border-[#eef0f3] px-2.5 py-1 whitespace-nowrap text-marca-800', NUMERICAS.has(c.tipo ?? '') && 'text-right tabular-nums')}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            {marcas?.[String(f[claveFila])]?.[c.clave] && <MarcaIa marca={marcas[String(f[claveFila])][c.clave]} />}
                          </td>
                        )
                      })}
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
            {hayTotales && filas.length > 0 && (
              <tfoot>
                <tr className="bg-[#fafbfc]">
                  {visibles.map((c, i) => (
                    <td key={c.clave} className={cn('border-t border-[var(--borde)] px-2.5 py-2 text-[12.5px] font-bold text-marca-900', NUMERICAS.has(c.tipo ?? '') && 'text-right tabular-nums')}>
                      {i === 0 ? `Total · ${numero(total)} filas` : c.total ? numero(totales[c.clave] ?? 0) : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Pie: rango, páginas y tamaño ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--borde)] bg-[#fafbfc] px-3 py-1.5 text-[11.5px] text-marca-500">
          <span className="tabular-nums">
            {total ? `${numero(desde)}–${numero(hasta)} de ${numero(total)}` : '0 filas'}
            {hayTotales ? ' · los totales cuentan todo lo filtrado, no solo esta página' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <label className="flex items-center gap-1">
              Filas
              <select value={estado.tamano} onChange={(e) => fijar({ tam: e.target.value, pag: null })} className="h-7 rounded-md border border-[var(--borde)] bg-white px-1 text-xs">
                {TAMANOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" disabled={estado.pagina <= 1} onClick={() => fijar({ pag: estado.pagina - 1 > 1 ? String(estado.pagina - 1) : null })} className="h-7 min-w-7 rounded-md border border-[var(--borde)] bg-white px-2 disabled:opacity-40" aria-label="Página anterior">
              ‹
            </button>
            <span className="tabular-nums">
              {numero(estado.pagina)} / {numero(paginas)}
            </span>
            <button type="button" disabled={estado.pagina >= paginas} onClick={() => fijar({ pag: String(estado.pagina + 1) })} className="h-7 min-w-7 rounded-md border border-[var(--borde)] bg-white px-2 disabled:opacity-40" aria-label="Página siguiente">
              ›
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

/** Los botones de una fila: la base manda qué claves caben; aquí se pintan. */
function AccionesFila({
  claves,
  acciones,
  fila,
  clave,
  ficha,
  alAccion,
}: {
  claves: string
  acciones: AccionFila[]
  fila: Fila
  clave: string
  ficha: string | null
  alAccion?: (clave: string, accion: string, texto: string) => Promise<{ error?: string; ficha?: string | null } | void>
}) {
  const { fijar } = useContextoUrl()
  const [pidiendo, setPidiendo] = useState<AccionFila | null>(null)
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const caben = new Set(claves.split(',').filter(Boolean))
  const lista = acciones.filter((a) => caben.has(a.clave))
  const BOTON = 'inline-flex h-6 items-center rounded-md border border-[var(--borde)] bg-white px-1.5 text-[11.5px] text-marca-700 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500'
  if (pidiendo)
    return (
      <span onClick={(e) => e.stopPropagation()} className="inline-flex flex-col gap-0.5">
        <span className="inline-flex items-center gap-1">
          <input
            autoFocus
            value={texto}
            disabled={pendiente}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={pidiendo.pide}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape') setPidiendo(null)
              if (e.key === 'Enter' && alAccion)
                iniciar(async () => {
                  const r = await alAccion(clave, pidiendo.clave, texto)
                  if (r && r.error) return setError(r.error)
                  setPidiendo(null)
                  setTexto('')
                  if (r && r.ficha) fijar({ ficha: r.ficha })
                })
            }}
            className="h-7 w-52 rounded border border-acento-300 px-1.5 text-[12.5px] outline-none focus:ring-2 focus:ring-acento-100"
            aria-label={`${pidiendo.pide} (Enter guarda, Esc cancela)`}
          />
          <button type="button" className={BOTON} onClick={() => setPidiendo(null)} aria-label="Cancelar">
            ✕
          </button>
        </span>
        {error && <span className="text-[11px] whitespace-normal text-acento-700">{error}</span>}
      </span>
    )
  return (
    <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
      {lista.map((a) =>
        a.href ? (
          <Link key={a.clave} href={a.href.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(String(fila[k] ?? '')))} className={BOTON} title={a.titulo}>
            {a.etiqueta}
          </Link>
        ) : (
          <button
            key={a.clave}
            type="button"
            title={a.titulo}
            className={BOTON}
            onClick={() => {
              setError(null)
              if (a.pide && alAccion) setPidiendo(a)
              else if (ficha) fijar({ ficha })
            }}
          >
            {a.etiqueta}
          </button>
        )
      )}
    </span>
  )
}

function ListaOpciones({ col, opciones, marcadas, alternar }: { col: string; opciones: { valor: string; etiqueta: string; n: number }[]; marcadas: string[]; alternar: (col: string, v: string) => void }) {
  if (!opciones.length) return <p className="px-2 py-2 text-xs text-marca-400">Sin valores.</p>
  return (
    <div className="max-h-64 overflow-y-auto p-1 text-[13px]">
      {opciones.map((o) => (
        <label key={o.valor} className="flex min-h-8 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-marca-50">
          <input type="checkbox" checked={marcadas.includes(o.valor)} onChange={() => alternar(col, o.valor)} className="h-4 w-4 accent-[#2b2a28]" />
          <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
          <span className="text-[11px] text-marca-400 tabular-nums">{numero(o.n)}</span>
        </label>
      ))}
    </div>
  )
}

function PanelVistas({
  tabla,
  vistas,
  activa,
  puedeCompartir,
  puedeBloquear,
  consulta,
  aplicar,
  restablecer,
}: {
  tabla: string
  vistas: VistaTabla[]
  activa: string | null
  puedeCompartir: boolean
  puedeBloquear: boolean
  consulta: string
  aplicar: (v: VistaTabla | null) => void
  restablecer: () => void
}) {
  const [nombre, setNombre] = useState('')
  const [alcance, setAlcance] = useState<VistaTabla['alcance']>('personal')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()
  return (
    <div className="text-[13px]">
      <div className="p-1.5">
        <button type="button" onClick={restablecer} className={cn('flex min-h-8 w-full items-center rounded-lg px-2 text-left hover:bg-marca-50', !activa && 'font-semibold')}>
          Predeterminada
        </button>
        {vistas.map((v) => {
          const Icono = ICONO_VISTA[v.alcance]
          return (
            <div key={v.id} className="flex items-center gap-1">
              <button type="button" onClick={() => aplicar(v)} className={cn('flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left hover:bg-marca-50', activa === v.id && 'font-semibold')}>
                <Icono className="h-3.5 w-3.5 shrink-0 text-marca-400" />
                <span className="truncate">{v.nombre}</span>
                <span className="sr-only">({v.alcance})</span>
              </button>
              {v.borrable && (
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md text-marca-400 hover:bg-acento-50 hover:text-acento-700"
                  aria-label={`Borrar la vista ${v.nombre}`}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await borrarVista(v.id)
                      setMensaje('error' in r && r.error ? r.error : 'Vista borrada.')
                      router.refresh()
                    })
                  }
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
      <form
        className="border-t border-[var(--borde)] p-3"
        onSubmit={(e) => {
          e.preventDefault()
          iniciar(async () => {
            const r = await guardarVista({ tabla, nombre, alcance, consulta })
            if ('error' in r && r.error) setMensaje(r.error)
            else {
              setMensaje('Vista guardada.')
              setNombre('')
              router.refresh()
            }
          })
        }}
      >
        <p className="mb-1.5 text-xs font-semibold text-marca-700">Guardar la vista actual</p>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la vista" required minLength={2} maxLength={80} className="h-8 w-full rounded-lg border border-[var(--borde)] px-2 text-[13px] outline-none focus:border-acento-400" aria-label="Nombre de la vista" />
        <fieldset className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-marca-600">
          <legend className="sr-only">Quién la ve</legend>
          <label className="flex items-center gap-1">
            <input type="radio" name="alcance" checked={alcance === 'personal'} onChange={() => setAlcance('personal')} /> Solo yo
          </label>
          {puedeCompartir && (
            <label className="flex items-center gap-1">
              <input type="radio" name="alcance" checked={alcance === 'compartida'} onChange={() => setAlcance('compartida')} /> Compartida
            </label>
          )}
          {puedeBloquear && (
            <label className="flex items-center gap-1">
              <input type="radio" name="alcance" checked={alcance === 'bloqueada'} onChange={() => setAlcance('bloqueada')} /> Bloqueada
            </label>
          )}
        </fieldset>
        <button type="submit" disabled={pendiente} className="mt-2 inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700 disabled:opacity-60">
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        {mensaje && (
          <p role="status" className="mt-1.5 text-xs text-marca-500">
            {mensaje}
          </p>
        )}
      </form>
    </div>
  )
}
