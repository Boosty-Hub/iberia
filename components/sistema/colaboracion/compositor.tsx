'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { buscarMencionables, type Mencionable } from '@/components/sistema/colaboracion/acciones'
import { cn } from '@/lib/utils'

/**
 * La caja para comentar: `@` abre la lista de quienes pueden ver el objeto
 * (flechas, Intro o Tab para elegir, Esc para cerrar) y Ctrl + Intro manda.
 * Las menciones viajan como ids aparte del texto: solo cuentan las que siguen
 * escritas al mandar.
 */

// «@» al inicio o tras un espacio, y hasta dos palabras de nombre.
const TOKEN = /(?:^|\s)@([^\s@]{0,30}(?: [^\s@]{0,30})?)$/u

export function Compositor({
  tipo,
  id,
  alMandar,
  placeholder = 'Comenta o menciona con @…',
  etiqueta = 'Comentar',
  inicial = '',
  autoFoco = false,
  alCancelar,
  compacto = false,
}: {
  tipo: string
  id: string
  alMandar: (texto: string, menciones: string[]) => Promise<string | null | void>
  placeholder?: string
  etiqueta?: string
  inicial?: string
  autoFoco?: boolean
  alCancelar?: () => void
  compacto?: boolean
}) {
  const uid = useId()
  const caja = useRef<HTMLTextAreaElement>(null)
  const [texto, setTexto] = useState(inicial)
  const [consulta, setConsulta] = useState<string | null>(null)
  const [opciones, setOpciones] = useState<Mencionable[]>([])
  const [activa, setActiva] = useState(0)
  const [elegidas, setElegidas] = useState<Map<string, string>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [enviando, iniciar] = useTransition()

  useEffect(() => {
    if (autoFoco) caja.current?.focus()
  }, [autoFoco])

  // Busca con una pausa corta: no una consulta por tecla.
  useEffect(() => {
    if (consulta === null) return
    let vigente = true
    const t = setTimeout(() => {
      buscarMencionables(tipo, id, consulta)
        .then((r) => {
          if (!vigente) return
          setOpciones(r)
          setActiva(0)
        })
        .catch(() => vigente && setOpciones([]))
    }, 150)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [consulta, tipo, id])

  const abierta = consulta !== null && opciones.length > 0

  function leerToken(valor: string, cursor: number) {
    const m = TOKEN.exec(valor.slice(0, cursor))
    setConsulta(m ? m[1] : null)
    if (!m) setOpciones([])
  }

  function elegir(p: Mencionable) {
    const el = caja.current
    if (!el) return
    const cursor = el.selectionStart ?? texto.length
    const antes = texto.slice(0, cursor)
    const m = TOKEN.exec(antes)
    if (!m) return
    const inicio = cursor - m[1].length - 1
    const nuevo = `${texto.slice(0, inicio)}@${p.nombre} ${texto.slice(cursor)}`
    setTexto(nuevo)
    setElegidas((prev) => new Map(prev).set(p.nombre, p.id))
    setConsulta(null)
    setOpciones([])
    requestAnimationFrame(() => {
      const pos = inicio + p.nombre.length + 2
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  function mandar() {
    const limpio = texto.trim()
    if (!limpio || enviando) return
    const menciones = [...elegidas].filter(([nombre]) => limpio.includes(`@${nombre}`)).map(([, pid]) => pid)
    setError(null)
    iniciar(async () => {
      const r = await alMandar(limpio, [...new Set(menciones)])
      if (typeof r === 'string') {
        setError(r)
        return
      }
      setTexto('')
      setElegidas(new Map())
    })
  }

  const idLista = `${uid}-lista`
  return (
    <div className="relative">
      <label htmlFor={`${uid}-caja`} className="sr-only">
        {placeholder}
      </label>
      <textarea
        ref={caja}
        id={`${uid}-caja`}
        value={texto}
        rows={compacto ? 2 : 3}
        maxLength={4000}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={abierta}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-activedescendant={abierta ? `${uid}-op-${activa}` : undefined}
        onChange={(e) => {
          setTexto(e.target.value)
          leerToken(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onClick={(e) => leerToken(texto, e.currentTarget.selectionStart ?? texto.length)}
        onKeyDown={(e) => {
          if (abierta) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiva((a) => (a + 1) % opciones.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiva((a) => (a - 1 + opciones.length) % opciones.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              elegir(opciones[activa])
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setConsulta(null)
              setOpciones([])
              return
            }
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            mandar()
          }
          if (e.key === 'Escape' && alCancelar) {
            e.stopPropagation()
            alCancelar()
          }
        }}
        className="block w-full resize-y rounded-lg border border-[var(--borde)] bg-white px-2.5 py-2 text-[13px] text-marca-900 placeholder:text-marca-400 focus:border-marca-400 focus:outline-2 focus:outline-offset-1 focus:outline-acento-500"
      />
      {abierta && (
        <ul id={idLista} role="listbox" aria-label="Personas que puedes mencionar" className="absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-[var(--borde)] bg-white py-1 shadow-lg">
          {opciones.map((p, i) => (
            <li
              key={p.id}
              id={`${uid}-op-${i}`}
              role="option"
              aria-selected={i === activa}
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(p)
              }}
              onMouseEnter={() => setActiva(i)}
              className={cn('flex cursor-pointer items-baseline gap-2 px-3 py-1.5 text-[13px]', i === activa ? 'bg-marca-50' : '')}
            >
              <span className="font-medium text-marca-900">{p.nombre}</span>
              {p.cargo && <span className="truncate text-[11.5px] text-marca-500">{p.cargo}</span>}
            </li>
          ))}
        </ul>
      )}
      {consulta !== null && !opciones.length && consulta.length > 1 && (
        <p className="mt-1 text-[11.5px] text-marca-500" role="status">
          Nadie con ese nombre puede ver este objeto: la mención solo llega a quien tiene acceso.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] text-acento-700">
          {error}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto hidden text-[11px] text-marca-400 sm:inline">@ para mencionar · Ctrl + Intro para mandar</span>
        {alCancelar && (
          <button type="button" onClick={alCancelar} className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs text-marca-600 hover:bg-marca-50">
            Cancelar
          </button>
        )}
        <button
          type="button"
          onClick={mandar}
          disabled={enviando || !texto.trim()}
          className="inline-flex h-8 items-center rounded-lg bg-[#D4332C] px-3 text-xs font-semibold text-white hover:bg-[#b92b25] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-500"
        >
          {enviando ? 'Mandando…' : etiqueta}
        </button>
      </div>
    </div>
  )
}
