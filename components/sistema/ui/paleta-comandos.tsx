'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { buscar, type ResultadoBusqueda } from '@/components/sistema/shell/acciones'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { IconoLupa } from '@/components/sistema/shell/iconos'
import { plano } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * La paleta (Ctrl K, Anexo E §2.6): objetos de toda la plataforma —unidades,
 * cargos, plazas, procesos, documentos, requisiciones, módulos— y acciones, en
 * secciones separadas. Sin tildes. La búsqueda la hace la base (`ui.buscar`)
 * con la RLS de quien busca: lo que no puedes leer no sale.
 *
 * Enter abre la ficha en el panel lateral (sin perder la página); los módulos y
 * las acciones navegan. «?» muestra los atajos.
 */

export type AccionPaleta = { etiqueta: string; href: string; detalle?: string; clave?: string }

const SECCION: Record<string, string> = {
  modulo: 'Módulos',
  unidad: 'Unidades',
  cargo: 'Cargos',
  plaza: 'Plazas',
  proceso: 'Procesos',
  documento: 'Documentos',
  requisicion: 'Requisiciones',
}
const CON_FICHA = new Set(['unidad', 'cargo', 'plaza', 'proceso', 'documento', 'requisicion'])

type Item = { clave: string; seccion: string; titulo: string; codigo?: string | null; detalle?: string | null; ir: () => void }

const ATAJOS: [string, string][] = [
  ['Ctrl K', 'Abrir o cerrar la búsqueda'],
  ['↑ ↓', 'Moverte entre resultados'],
  ['Enter', 'Abrir: la ficha en el panel, o el módulo'],
  ['Mayús + Enter', 'Abrir la página del objeto'],
  ['Esc', 'Cerrar la búsqueda o la ficha'],
  ['?', 'Ver estos atajos'],
]

export function PaletaComandos({ acciones }: { acciones: AccionPaleta[] }) {
  const [abierta, setAbierta] = useState(false)
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [sel, setSel] = useState(0)
  const [buscando, iniciar] = useTransition()
  const entrada = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { fijar, conContexto } = useContextoUrl()
  const ultimo = useRef('')

  // Ctrl K / Cmd K desde cualquier parte, y el botón de la barra. Cada vez que
  // se abre o se cierra, arranca limpia.
  useEffect(() => {
    const limpiar = () => {
      setQ('')
      setResultados([])
      setSel(0)
    }
    const tecla = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        limpiar()
        setAbierta((v) => !v)
      }
    }
    const abrir = () => {
      limpiar()
      setAbierta(true)
    }
    window.addEventListener('keydown', tecla)
    window.addEventListener('abrir-paleta', abrir)
    return () => {
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('abrir-paleta', abrir)
    }
  }, [])

  useEffect(() => {
    if (abierta) setTimeout(() => entrada.current?.focus(), 0)
  }, [abierta])

  // La búsqueda en la base, con una pausa de 180 ms al teclear.
  useEffect(() => {
    const texto = q.trim()
    if (texto === '?' || texto.length < 2) return
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
  // Con menos de dos letras no se muestran resultados viejos.
  const vigentes = q.trim().length >= 2 && q.trim() !== '?' ? resultados : []

  const items: Item[] = useMemo(() => {
    const texto = plano(q.trim())
    const acc = acciones
      .filter((a) => !texto || plano(`${a.etiqueta} ${a.detalle ?? ''}`).includes(texto))
      .slice(0, texto ? 4 : 8)
      .map<Item>((a, i) => ({
        clave: `accion-${i}`,
        seccion: 'Acciones',
        titulo: a.etiqueta,
        detalle: a.detalle,
        ir: () => {
          cerrar()
          router.push(conContexto(a.href))
        },
      }))
    const obj = vigentes.map<Item>((r) => ({
      clave: `${r.tipo}-${r.id}`,
      seccion: SECCION[r.tipo] ?? r.tipo,
      titulo: r.titulo,
      codigo: r.codigo,
      detalle: r.detalle,
      ir: () => {
        cerrar()
        if (CON_FICHA.has(r.tipo)) fijar({ ficha: `${r.tipo}:${r.id}` })
        else router.push(conContexto(r.href))
      },
    }))
    // Los objetos primero cuando hay texto: es lo que se buscaba.
    return texto ? [...obj, ...acc] : acc
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, vigentes, acciones])

  const irPagina = (i: number) => {
    const r = vigentes.find((x) => `${x.tipo}-${x.id}` === items[i]?.clave)
    if (r) {
      cerrar()
      router.push(conContexto(r.href))
    } else items[i]?.ir()
  }

  if (!abierta) return null
  const verAtajos = q.trim() === '?'
  let seccionAnterior = ''

  return (
    <div
      data-paleta-abierta
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/35 px-3 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cerrar()
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Buscar en la plataforma" className="w-full max-w-[640px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[var(--borde)] px-4">
          <IconoLupa className="h-5 w-5 shrink-0 text-marca-400" />
          <input
            ref={entrada}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                cerrar()
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSel((s) => Math.min(s + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSel((s) => Math.max(s - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                if (e.shiftKey) irPagina(sel)
                else items[sel]?.ir()
              }
            }}
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

        <div className="max-h-[60vh] overflow-y-auto p-2" id="paleta-resultados" role="listbox" aria-label="Resultados">
          {verAtajos ? (
            <dl className="grid grid-cols-[8rem_1fr] gap-y-2 p-3 text-sm">
              {ATAJOS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>
                    <kbd className="rounded border border-[var(--borde)] px-1.5 py-0.5 text-xs">{k}</kbd>
                  </dt>
                  <dd className="text-marca-600">{v}</dd>
                </div>
              ))}
            </dl>
          ) : !items.length ? (
            <p className="px-3 py-6 text-center text-sm text-marca-400">
              {q.trim().length < 2 ? 'Escribe al menos dos letras. Con «?» ves los atajos.' : buscando ? 'Buscando…' : 'Nada con ese texto a tu alcance.'}
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
                    className={cn('flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-sm', i === sel ? 'bg-[#f4f5f7]' : '')}
                  >
                    {it.codigo && <span className="w-24 shrink-0 truncate font-mono text-[11px] text-marca-500">{it.codigo}</span>}
                    <span className="min-w-0 flex-1 truncate text-marca-900">{it.titulo}</span>
                    {it.detalle && <span className="max-w-[40%] shrink-0 truncate text-xs text-marca-400">{it.detalle}</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <p className="border-t border-[var(--borde)] px-4 py-2 text-[11px] text-marca-400">
          Enter abre la ficha · Mayús + Enter abre su página · «?» atajos · Solo ves lo que tu rol puede leer.
        </p>
      </div>
    </div>
  )
}
