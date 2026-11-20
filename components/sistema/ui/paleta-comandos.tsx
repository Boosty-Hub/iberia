'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { buscar, misRecientes, type Reciente, type ResultadoBusqueda } from '@/components/sistema/shell/acciones'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { IconoLupa } from '@/components/sistema/shell/iconos'
import { esFecha, fechaLarga, hoyCaracas, plano } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * La paleta (Ctrl K, Anexo E §2.6 y §10 R5), en secciones separadas:
 *
 * - **Objetos**: unidades, plazas, cargos, personas (solo el nombre), procesos
 *   (código o nombre), documentos (código, alias o título), requisiciones (por
 *   número) y escenarios. La búsqueda la hace la base (`ui.buscar`), sin tildes y
 *   con la RLS de quien busca: lo que no puedes leer no sale. Cada sección trae
 *   su total y «Ver más» pide la página siguiente.
 * - **Módulos** del plan (`control.modulo`).
 * - **Acciones**: nueva requisición, nuevo escenario, cargar una tasa (con
 *   permiso), «Ir a Datos al…»; una fecha escrita («al 1/10/2026») también.
 * - **Preguntar a la IA**, solo si el panel de la IA está en la plataforma.
 * - **Recientes**: los últimos 8 objetos que abriste (sin texto).
 *
 * Enter abre la ficha en el panel lateral (sin perder la página); Mayús + Enter,
 * su página. Los atajos globales (g o, g p, g d, g b, /, ?) viven aquí también.
 */

export type AccionPaleta = { etiqueta: string; href: string; detalle?: string; clave?: string }

const SECCION: Record<string, string> = {
  unidad: 'Unidades',
  plaza: 'Plazas',
  cargo: 'Cargos',
  persona: 'Personas',
  proceso: 'Procesos',
  documento: 'Documentos',
  requisicion: 'Requisiciones',
  escenario: 'Escenarios',
  modulo: 'Módulos',
}
const ORDEN_OBJETOS = ['unidad', 'plaza', 'cargo', 'persona', 'proceso', 'documento', 'requisicion', 'escenario']
const CON_FICHA = new Set(['unidad', 'cargo', 'plaza', 'persona', 'proceso', 'documento', 'requisicion', 'escenario'])
const SINGULAR: Record<string, string> = {
  unidad: 'Unidad',
  plaza: 'Plaza',
  cargo: 'Cargo',
  persona: 'Persona',
  proceso: 'Proceso',
  documento: 'Documento',
  requisicion: 'Requisición',
  escenario: 'Escenario',
}

/** Los atajos de «g + letra»: a dónde lleva cada uno. */
const IR_A: Record<string, { href: string; nombre: string }> = {
  o: { href: '/sistema/nucleo/organizacion/resumen', nombre: 'Organización' },
  p: { href: '/sistema/nucleo/procesos/resumen', nombre: 'Procesos' },
  d: { href: '/sistema/nucleo/documentos', nombre: 'Documentos' },
  b: { href: '/sistema/bandeja', nombre: 'Bandeja' },
  m: { href: '/sistema', nombre: 'Mi día' },
}

const ATAJOS: [string, string][] = [
  ['Ctrl K', 'Abrir o cerrar la búsqueda'],
  ['↑ ↓', 'Moverte entre resultados'],
  ['Enter', 'Abrir: la ficha en el panel, el módulo o la acción'],
  ['Mayús + Enter', 'Abrir la página del objeto'],
  ['Esc', 'Cerrar la búsqueda o la ficha'],
  ['g  o', 'Ir a Organización'],
  ['g  p', 'Ir a Procesos'],
  ['g  d', 'Ir a Documentos'],
  ['g  b', 'Ir a la bandeja'],
  ['g  m', 'Ir a Mi día'],
  ['/', 'Buscar en la tabla de la página (si hay una)'],
  ['?', 'Ver estos atajos'],
]

type Item = { clave: string; seccion: string; titulo: string; codigo?: string | null; detalle?: string | null; ir: () => void; pagina?: () => void; mas?: boolean }

/** «al 1/10/2026», «01-10-2026», «2026-10-01» → 2026-10-01. */
function fechaEscrita(q: string): string | null {
  const t = q.trim().toLowerCase().replace(/^(datos\s+)?al\s+/, '')
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return normal(m[1], m[2], m[3])
  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) return normal(m[3], m[2], m[1])
  return null
}
function normal(a: string, m: string, d: string): string | null {
  const f = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const x = new Date(`${f}T12:00:00Z`)
  return esFecha(f) && !Number.isNaN(x.getTime()) && x.toISOString().slice(0, 10) === f ? f : null
}

const esEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return Boolean(el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)))
}

export function PaletaComandos({ acciones, conIa = false }: { acciones: AccionPaleta[]; conIa?: boolean }) {
  const [abierta, setAbierta] = useState(false)
  const [q, setQ] = useState('')
  const [modo, setModo] = useState<'buscar' | 'fecha'>('buscar')
  const [fecha, setFecha] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [recientes, setRecientes] = useState<Reciente[]>([])
  const [sel, setSel] = useState(0)
  const [buscando, iniciar] = useTransition()
  const entrada = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { fijar, conContexto, sp } = useContextoUrl()
  const ultimo = useRef('')
  const g = useRef(0)

  // Abrir (Ctrl K, el botón de la barra, «?») y los atajos globales.
  useEffect(() => {
    const abrir = (texto = '') => {
      setQ(texto)
      setResultados([])
      setSel(0)
      setModo('buscar')
      setAbierta(true)
      misRecientes()
        .then(setRecientes)
        .catch(() => setRecientes([]))
    }
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (document.querySelector('[data-paleta-abierta]')) setAbierta(false)
        else abrir()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || esEditable(e.target) || document.querySelector('[data-paleta-abierta]')) return
      if (e.key === '?') {
        e.preventDefault()
        abrir('?')
      } else if (e.key === '/') {
        const tabla = document.querySelector<HTMLInputElement>('[data-busqueda-tabla]')
        e.preventDefault()
        if (tabla) tabla.focus()
        else abrir()
      } else if (e.key === 'g') {
        g.current = Date.now()
      } else if (g.current && Date.now() - g.current < 1200 && IR_A[e.key]) {
        e.preventDefault()
        g.current = 0
        router.push(conContexto(IR_A[e.key].href))
      } else {
        g.current = 0
      }
    }
    const desdeBoton = () => abrir()
    window.addEventListener('keydown', tecla)
    window.addEventListener('abrir-paleta', desdeBoton)
    return () => {
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('abrir-paleta', desdeBoton)
    }
  }, [router, conContexto])

  useEffect(() => {
    if (abierta) setTimeout(() => entrada.current?.focus(), 0)
  }, [abierta, modo])

  // La búsqueda en la base, con una pausa de 180 ms al teclear.
  useEffect(() => {
    const texto = q.trim()
    if (texto === '?' || (texto.length < 2 && !/^\d+$/.test(texto)) || fechaEscrita(texto)) return
    const t = setTimeout(() => {
      ultimo.current = texto
      iniciar(async () => {
        const r = await buscar(texto).catch(() => [])
        if (ultimo.current === texto) {
          setResultados(r)
          setSel(0)
        }
      })
    }, 180)
    return () => clearTimeout(t)
  }, [q])

  const cerrar = () => setAbierta(false)
  const texto = q.trim()
  const conTexto = (texto.length >= 2 || /^\d+$/.test(texto)) && texto !== '?'
  const vigentes = conTexto ? resultados : []

  const verMas = (tipo: string) => {
    const ya = vigentes.filter((r) => r.tipo === tipo).length
    iniciar(async () => {
      const mas = await buscar(texto, tipo, ya).catch(() => [])
      setResultados((r) => {
        const vistos = new Set(r.map((x) => `${x.tipo}-${x.id}`))
        return [...r, ...mas.filter((x) => !vistos.has(`${x.tipo}-${x.id}`))]
      })
    })
  }

  const abrirObjeto = (tipo: string, id: string, href: string, pagina = false) => {
    cerrar()
    if (!pagina && CON_FICHA.has(tipo)) fijar({ ficha: `${tipo}:${id}` })
    else router.push(conContexto(href))
  }

  const items: Item[] = useMemo(() => {
    const t = plano(texto)
    const salida: Item[] = []
    // Objetos, por sección, con su «Ver más».
    if (conTexto) {
      for (const tipo of ORDEN_OBJETOS) {
        const deTipo = vigentes.filter((r) => r.tipo === tipo)
        if (!deTipo.length) continue
        const seccion = SECCION[tipo]
        for (const r of deTipo)
          salida.push({
            clave: `${r.tipo}-${r.id}`,
            seccion,
            titulo: r.titulo,
            codigo: r.codigo,
            detalle: r.detalle,
            ir: () => abrirObjeto(r.tipo, r.id, r.href),
            pagina: () => abrirObjeto(r.tipo, r.id, r.href, true),
          })
        const total = deTipo[0].total ?? deTipo.length
        if (total > deTipo.length)
          salida.push({ clave: `mas-${tipo}`, seccion, titulo: `Ver más ${seccion.toLowerCase()} (${total - deTipo.length} más)`, mas: true, ir: () => verMas(tipo) })
      }
      for (const r of vigentes.filter((x) => x.tipo === 'modulo'))
        salida.push({
          clave: `modulo-${r.id}`,
          seccion: 'Módulos',
          titulo: r.titulo,
          codigo: r.codigo,
          detalle: r.detalle,
          ir: () => {
            cerrar()
            router.push(conContexto(r.href))
          },
        })
    }
    // Acciones: una fecha escrita va primero.
    const f = fechaEscrita(texto)
    if (f)
      salida.unshift({
        clave: 'accion-fecha-escrita',
        seccion: 'Acciones',
        titulo: `Ver los datos al ${fechaLarga(f)}`,
        detalle: f === hoyCaracas() ? 'hoy' : 'cambia «Datos al» en esta página',
        ir: () => {
          cerrar()
          fijar({ al: f === hoyCaracas() ? null : f })
        },
      })
    acciones
      .filter((a) => !t || plano(`${a.etiqueta} ${a.detalle ?? ''}`).includes(t))
      .slice(0, t ? 5 : 8)
      .forEach((a, i) =>
        salida.push({
          clave: `accion-${i}`,
          seccion: 'Acciones',
          titulo: a.etiqueta,
          detalle: a.detalle,
          ir: () => {
            if (a.clave === 'fecha') {
              setFecha(sp.get('al') ?? hoyCaracas())
              setModo('fecha')
              return
            }
            cerrar()
            router.push(a.href.startsWith('/sistema') ? conContexto(a.href) : a.href)
          },
        })
      )
    if (conIa && conTexto)
      salida.push({
        clave: 'ia',
        seccion: 'Preguntar a la IA',
        titulo: `«${texto}»`,
        detalle: 'Responde con citas, con tu acceso',
        ir: () => {
          cerrar()
          window.dispatchEvent(new CustomEvent('preguntar-ia', { detail: { pregunta: texto } }))
        },
      })
    if (!conTexto && !f)
      for (const r of recientes)
        salida.push({
          clave: `reciente-${r.tipo}-${r.id}`,
          seccion: 'Recientes',
          titulo: r.titulo,
          detalle: r.detalle ?? SINGULAR[r.tipo],
          ir: () => abrirObjeto(r.tipo, r.id, `/sistema/ficha/${r.tipo}/${r.id}`),
          pagina: () => abrirObjeto(r.tipo, r.id, `/sistema/ficha/${r.tipo}/${r.id}`, true),
        })
    return salida
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, vigentes, acciones, recientes, conIa])

  // La selección siempre a la vista.
  useEffect(() => {
    lista.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  if (!abierta) return null
  const verAtajos = texto === '?'
  let seccionAnterior = ''

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (modo === 'fecha') setModo('buscar')
      else cerrar()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(s + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(s - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const it = items[sel]
      if (!it) return
      if (e.shiftKey && it.pagina) it.pagina()
      else it.ir()
    }
  }

  return (
    <div
      data-paleta-abierta
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/35 px-3 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Buscar en la plataforma" className="w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        {modo === 'fecha' ? (
          <form
            className="flex flex-wrap items-center gap-2 border-b border-[var(--borde)] px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!esFecha(fecha)) return
              cerrar()
              fijar({ al: fecha === hoyCaracas() ? null : fecha })
            }}
          >
            <label htmlFor="paleta-fecha" className="text-[13px] font-semibold text-marca-900">
              Ver los datos al
            </label>
            <input
              id="paleta-fecha"
              ref={entrada}
              type="date"
              value={fecha}
              max="2100-12-31"
              onChange={(e) => setFecha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setModo('buscar')
                }
              }}
              className="h-9 rounded-lg border border-[var(--borde)] px-2 text-[14px]"
            />
            <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-[#2b2a28] px-3 text-[13px] font-semibold text-white">
              Aplicar
            </button>
            <button type="button" onClick={() => setModo('buscar')} className="inline-flex h-9 items-center rounded-lg border border-[var(--borde)] px-3 text-[13px] text-marca-600">
              Volver
            </button>
            <p className="w-full text-[11.5px] text-marca-500">Cambia «Datos al» en la página donde estás: las cifras y las tablas se recalculan a esa fecha.</p>
          </form>
        ) : (
          <div className="flex items-center gap-2 border-b border-[var(--borde)] px-4">
            <IconoLupa className="h-5 w-5 shrink-0 text-marca-400" />
            <input
              ref={entrada}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setSel(0)
              }}
              onKeyDown={teclas}
              placeholder="Escribe: «almacenista», «II-26», «compras», «nueva requisición»…"
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-marca-400"
              role="combobox"
              aria-label="Buscar en la plataforma"
              aria-expanded={items.length > 0}
              aria-controls="paleta-resultados"
              aria-activedescendant={items[sel] ? `paleta-${items[sel].clave}` : undefined}
              aria-autocomplete="list"
            />
            {buscando && <span className="text-xs text-marca-400">Buscando…</span>}
            <kbd className="rounded border border-[var(--borde)] px-1.5 text-[10px] text-marca-400">Esc</kbd>
          </div>
        )}

        {modo === 'buscar' && (
          <div ref={lista} className="max-h-[60vh] overflow-y-auto p-2" id="paleta-resultados" role="listbox" aria-label="Resultados">
            {verAtajos ? (
              <div data-atajos>
                <p className="px-3 pt-2 text-[10.5px] font-semibold tracking-[0.1em] text-marca-400 uppercase">Atajos de teclado</p>
                <dl className="grid grid-cols-[7rem_1fr] gap-y-2 p-3 text-sm">
                  {ATAJOS.map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt>
                        <kbd className="rounded border border-[var(--borde)] px-1.5 py-0.5 text-xs whitespace-pre">{k}</kbd>
                      </dt>
                      <dd className="text-marca-600">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : !items.length ? (
              <p className="px-3 py-6 text-center text-sm text-marca-400">
                {!conTexto ? 'Escribe al menos dos letras. Con «?» ves los atajos.' : buscando ? 'Buscando…' : 'Nada con ese texto a tu alcance.'}
              </p>
            ) : (
              items.map((it, i) => {
                const cabecera = it.seccion !== seccionAnterior ? it.seccion : null
                seccionAnterior = it.seccion
                return (
                  <div key={it.clave}>
                    {cabecera && <p className="px-2 pt-2 pb-1 text-[10.5px] font-semibold tracking-[0.1em] text-marca-400 uppercase">{cabecera}</p>}
                    <div
                      id={`paleta-${it.clave}`}
                      role="option"
                      aria-selected={i === sel}
                      onMouseEnter={() => setSel(i)}
                      onClick={() => it.ir()}
                      className={cn('flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm', i === sel ? 'bg-[#f4f5f7]' : '', it.mas && 'text-[12.5px] font-semibold text-acento-700')}
                    >
                      {it.codigo && <span className="w-24 shrink-0 truncate font-mono text-[11px] text-marca-500">{it.codigo}</span>}
                      <span className={cn('min-w-0 flex-1 truncate', !it.mas && 'text-marca-900')}>{it.titulo}</span>
                      {it.detalle && <span className="max-w-[40%] shrink-0 truncate text-xs text-marca-400">{it.detalle}</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
        <p className="border-t border-[var(--borde)] px-4 py-2 text-[11px] text-marca-400">
          Enter abre la ficha · Mayús + Enter abre su página · «?» atajos · Sin tildes · Solo ves lo que tu rol puede leer.
        </p>
      </div>
    </div>
  )
}
