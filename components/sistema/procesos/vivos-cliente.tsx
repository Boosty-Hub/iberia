'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'
import { confirmarEnlace, confirmarEnlacesProceso, descartarBorrador, descartarCaracterizacion, descartarEnlace, enviarCaracterizacion, enviarDocumento, guardarCampoProceso, guardarSeccion, crearSubproceso, moverProceso, renombrarProceso } from '@/app/sistema/nucleo/procesos/acciones-vivos'
import type { Bloque, IndiceBusqueda, Seccion } from '@/lib/plataforma/procesos-vivos'

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** La búsqueda de arriba del mapa: procesos y documentos al escribir; Enter abre el primero. No es una sección aparte. */
export function BuscadorProcesos({ indice }: { indice: IndiceBusqueda }) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const router = useRouter()
  const caja = useRef<HTMLDivElement>(null)
  const res = useMemo(() => {
    const t = sinTildes(q.trim())
    if (t.length < 2) return null
    const ps = indice.procesos.filter((p) => sinTildes(`${p.c} ${p.n}`).includes(t)).slice(0, 4)
    const todos = indice.docs.filter((d) => sinTildes(`${d.c} ${d.t}`).includes(t))
    return { ps, ds: todos.slice(0, 8), total: todos.length }
  }, [q, indice])
  const primero = res?.ps[0] ? `/sistema/nucleo/procesos/${res.ps[0].r}` : res?.ds[0] ? `/sistema/nucleo/documentos/${res.ds[0].i}` : null
  return (
    <div
      ref={caja}
      className="relative"
      onBlur={(e) => { if (!caja.current?.contains(e.relatedTarget as Node)) setAbierto(false) }}
    >
      <label className="sr-only" htmlFor="buscar-procesos">Buscar documentos o procesos</label>
      <span aria-hidden className="pointer-events-none absolute left-3.5 top-2.5 text-marca-400">⌕</span>
      <input
        id="buscar-procesos"
        data-buscar-procesos
        type="search"
        autoComplete="off"
        value={q}
        onChange={(e) => { setQ(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && primero) router.push(primero)
          if (e.key === 'Escape') setAbierto(false)
        }}
        placeholder="Buscar documentos o procesos por código o nombre (ej. II-64-20-002, compras, fumigación)"
        className="h-11 w-full rounded-xl border border-[var(--borde)] bg-white pl-10 pr-4 text-sm shadow-[var(--sombra-tarjeta)] outline-none focus:border-acento-200 focus:ring-2 focus:ring-acento-50"
      />
      {abierto && res && (
        <div data-resultados-busqueda className="absolute left-0 right-0 top-12 z-30 max-h-[440px] overflow-auto rounded-xl border border-[var(--borde)] bg-white p-1.5 shadow-lg">
          {res.ps.length > 0 && <p className="px-2.5 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-wider text-marca-500">Procesos</p>}
          {res.ps.map((p) => (
            <Link key={p.r} href={`/sistema/nucleo/procesos/${p.r}`} className="grid grid-cols-[90px_minmax(0,1fr)] gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-marca-50 sm:grid-cols-[110px_minmax(0,1fr)_auto]">
              <span className="font-mono text-[11.5px] text-acento-700">{p.c}</span>
              <span>{p.n}</span>
              <span className="hidden text-[11.5px] text-marca-500 sm:block">{p.m}</span>
            </Link>
          ))}
          {res.ds.length > 0 && (
            <p className="px-2.5 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-wider text-marca-500">
              Documentos{res.total > res.ds.length ? ` · ${res.total} coincidencias` : ''}
            </p>
          )}
          {res.ds.map((d) => (
            <Link key={d.i} href={`/sistema/nucleo/documentos/${d.i}`} className="grid grid-cols-[110px_minmax(0,1fr)] gap-2 rounded-lg px-2.5 py-2 text-[13px] hover:bg-marca-50 sm:grid-cols-[120px_minmax(0,1fr)_auto]">
              <span className="font-mono text-[11.5px] text-acento-700">{d.c}</span>
              <span>{d.t}</span>
              <span className="hidden whitespace-nowrap text-[11.5px] text-marca-500 sm:block">{d.y} · {d.p}{d.s ? ' · sugerido' : ''}</span>
            </Link>
          ))}
          {!res.ps.length && !res.ds.length && <p className="p-3 text-[13px] text-marca-500">Sin resultados.</p>}
        </div>
      )}
    </div>
  )
}

/** Confirmar o descartar un enlace sugerido (en la fila del documento dentro del proceso). */
export function BotonesEnlace({ id }: { id: string }) {
  const [pendiente, empezar] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  const correr = (f: () => Promise<{ error?: string; ok?: string }>) =>
    empezar(async () => {
      const r = await f()
      setMsg(r.error ?? null)
      if (!r.error) router.refresh()
    })
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" disabled={pendiente} onClick={() => correr(() => confirmarEnlace(id))} className="rounded-md border border-[var(--borde)] bg-white px-2 py-0.5 text-[11.5px] font-medium hover:bg-marca-50 disabled:opacity-50">
        Confirmar
      </button>
      <button type="button" disabled={pendiente} onClick={() => correr(() => descartarEnlace(id))} className="rounded-md px-1.5 py-0.5 text-[11.5px] text-marca-500 hover:text-acento-700 disabled:opacity-50" title="No va con este proceso">
        No va aquí
      </button>
      {msg && <span className="text-[11.5px] text-acento-700">{msg}</span>}
    </span>
  )
}

export function BotonConfirmarTodos({ proceso, n }: { proceso: string; n: number }) {
  const [pendiente, empezar] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => empezar(async () => { const r = await confirmarEnlacesProceso(proceso); setMsg(r.error ?? r.ok ?? null); if (!r.error) router.refresh() })}
        className="inline-flex h-7 items-center rounded-lg border border-oro-500/50 bg-white px-2.5 text-xs font-semibold text-oro-800 hover:bg-oro-50 disabled:opacity-50"
      >
        {pendiente ? 'Confirmando…' : `Confirmar los ${n}`}
      </button>
      {msg && <span className="text-xs">{msg}</span>}
    </span>
  )
}

// ── El editor de secciones ───────────────────────────────────────────────────
// Una sección se edita como texto con una marca mínima, para que cualquiera la entienda:
//   párrafo                → una línea (o varias) separada por renglón en blanco
//   - viñeta               → lista
//   | a | b |              → tabla (una fila por línea)
//   > Responsable: acción  → paso del procedimiento
//   ? Pregunta | si: … | no: …  → decisión
//   @ II-64-20-001 Título  → referencia a otro documento

export function aTexto(bloques: Bloque[]): string {
  return bloques.map((b) => {
    switch (b.tipo) {
      case 'parrafo': return b.texto
      case 'lista': return b.items.map((i) => `- ${i}`).join('\n')
      case 'tabla': return b.filas.map((f) => `| ${f.join(' | ')} |`).join('\n')
      case 'paso': return `> ${b.responsable ? `${b.responsable}: ` : ''}${b.actividad}`
      case 'decision': return `? ${b.pregunta}${b.si ? ` | si: ${b.si}` : ''}${b.no ? ` | no: ${b.no}` : ''}`
      case 'referencia': return `@ ${b.codigo}${b.titulo ? ` ${b.titulo}` : ''}`
    }
  }).join('\n\n')
}

export function aBloques(texto: string): Bloque[] {
  const out: Bloque[] = []
  for (const trozo of texto.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lineas = trozo.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lineas.length) continue
    if (lineas.every((l) => l.startsWith('- '))) { out.push({ tipo: 'lista', items: lineas.map((l) => l.slice(2).trim()) }); continue }
    if (lineas.every((l) => l.startsWith('|'))) {
      out.push({ tipo: 'tabla', filas: lineas.map((l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())) })
      continue
    }
    for (const l of lineas) {
      if (l.startsWith('> ')) {
        const m = /^>\s*([^:]{2,80}):\s*(.+)$/.exec(l)
        out.push(m ? { tipo: 'paso', responsable: m[1].trim(), actividad: m[2].trim() } : { tipo: 'paso', actividad: l.slice(2).trim() })
      } else if (l.startsWith('? ')) {
        const [p, ...resto] = l.slice(2).split('|').map((x) => x.trim())
        const si = resto.find((r) => /^si:/i.test(r))?.replace(/^si:\s*/i, '')
        const no = resto.find((r) => /^no:/i.test(r))?.replace(/^no:\s*/i, '')
        out.push({ tipo: 'decision', pregunta: p, si, no })
      } else if (/^@\s*II-\d{2}/.test(l)) {
        const m = /^@\s*(II-[\d-]+)\s*(.*)$/.exec(l)
        out.push({ tipo: 'referencia', codigo: m?.[1] ?? l.slice(1).trim(), titulo: m?.[2] || undefined })
      } else {
        const ultimo = out[out.length - 1]
        if (ultimo?.tipo === 'parrafo' && lineas.length > 1 && lineas.indexOf(l) > 0) ultimo.texto += ` ${l}`
        else out.push({ tipo: 'parrafo', texto: l })
      }
    }
  }
  return out
}

/** Botón «Editar sección» y su editor en el sitio. Al guardar, el cambio va al borrador de quien edita. */
export function EditorSeccion({ documento, indice, seccion, children }: { documento: string; indice: number; seccion: Seccion; children: React.ReactNode }) {
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(seccion.titulo)
  const [texto, setTexto] = useState(() => aTexto(seccion.bloques))
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  if (!editando) {
    return (
      <div className="group relative">
        {children}
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="absolute right-0 top-0 rounded-md border border-[var(--borde)] bg-white px-2 py-0.5 text-[11.5px] font-medium text-marca-600 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
        >
          ✎ Editar sección
        </button>
      </div>
    )
  }
  return (
    <div className="grid gap-2 rounded-xl p-3 ring-2 ring-acento-200" data-editor-seccion>
      <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="campo h-9 text-[15px] font-semibold" aria-label="Título de la sección" />
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(24, Math.max(6, texto.split('\n').length + 2))} className="campo min-h-36 py-2 font-[inherit] text-sm leading-relaxed" aria-label="Contenido de la sección" />
      <p className="text-[11.5px] text-marca-500">
        Renglón en blanco = párrafo nuevo · <code>- </code> viñeta · <code>| a | b |</code> tabla · <code>&gt; Responsable: actividad</code> paso · <code>? Pregunta | si: … | no: …</code> decisión · <code>@ II-64-20-001</code> referencia
      </p>
      {error && <p className="text-xs text-acento-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setEditando(false); setError(null) }} className="btn-neutro h-8 px-3 text-xs">Cancelar</button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              const r = await guardarSeccion(documento, indice, titulo, aBloques(texto))
              if (r.error) setError(r.error)
              else { setEditando(false); router.refresh() }
            })
          }
          className="btn-acento h-8 px-3 text-xs"
        >
          {pendiente ? 'Guardando…' : 'Guardar en mi borrador'}
        </button>
        <span className="text-[11.5px] text-marca-500">La versión vigente no cambia hasta que se apruebe.</span>
      </div>
    </div>
  )
}

/** La banda del borrador propio (o de la transcripción por validar): enviar a revisión con motivo, o descartar. */
export function BandaEnvio({ documento, version, tipo }: { documento: string; version: string; tipo: 'borrador' | 'transcripcion' }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState(tipo === 'transcripcion' ? 'Transcripción del documento original a la plataforma, validada contra el archivo de origen.' : '')
  const [pendiente, empezar] = useTransition()
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null)
  const router = useRouter()
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 text-[13px] ${tipo === 'borrador' ? 'bg-oro-50 text-oro-900' : 'bg-[#e8f0fa] text-[#2c5d9c]'}`} data-banda-envio={tipo}>
      <span>
        {tipo === 'borrador'
          ? <><b>Tienes un borrador.</b> Nadie más lo ve hasta que lo envíes.</>
          : <><b>Transcripción por validar.</b> Compárala con el archivo de origen; al enviarla, la revisa el dueño del proceso y la aprueba Gestión de la Calidad.</>}
      </span>
      {!abierto ? (
        <span className="flex gap-2">
          {tipo === 'borrador' && (
            <button type="button" disabled={pendiente} onClick={() => empezar(async () => { const r = await descartarBorrador(documento, version); setMsg(r); if (!r.error) router.refresh() })} className="btn-neutro h-8 px-3 text-xs">
              Descartar
            </button>
          )}
          <button type="button" onClick={() => setAbierto(true)} className="btn-acento h-8 px-3 text-xs">Enviar a revisión</button>
        </span>
      ) : (
        <div className="grid w-full gap-2">
          <label className="text-xs font-medium" htmlFor="motivo-cambio">Motivo del cambio</label>
          <textarea id="motivo-cambio" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="campo py-2 text-sm text-marca-800" />
          <p className="text-[11.5px] opacity-80">Ruta: 1 · Dueño del proceso (revisa) → 2 · Gestión de la Calidad (aprueba y publica). Quien hizo el cambio no lo aprueba.</p>
          <span className="flex gap-2">
            <button type="button" onClick={() => setAbierto(false)} className="btn-neutro h-8 px-3 text-xs">Cancelar</button>
            <button
              type="button"
              disabled={pendiente}
              onClick={() => empezar(async () => { const r = await enviarDocumento(documento, version, motivo); setMsg(r); if (!r.error) { setAbierto(false); router.refresh() } })}
              className="btn-acento h-8 px-3 text-xs"
            >
              {pendiente ? 'Enviando…' : 'Enviar'}
            </button>
          </span>
        </div>
      )}
      {msg?.error && <p className="w-full text-xs text-acento-700">{msg.error}</p>}
      {msg?.ok && <p className="w-full text-xs">{msg.ok}</p>}
    </div>
  )
}

// ── La caracterización del proceso, editada campo por campo ─────────────────

/** Un campo de la caracterización con su lápiz: al guardar va al borrador del proceso (se abre solo). */
export function EditorCampo({ refProceso, clave, titulo, inicial, ayuda, children }: { refProceso: string; clave: string; titulo: string; inicial: string; ayuda?: string; children: React.ReactNode }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(inicial)
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  if (!editando) {
    return (
      <div className="group relative" data-campo={clave}>
        {children}
        <button type="button" onClick={() => setEditando(true)} className="absolute right-2 top-1.5 z-10 rounded-md border border-[var(--borde)] bg-white px-2 py-0.5 text-[11.5px] font-medium text-marca-700 hover:border-acento-200 hover:text-acento-700">
          ✎ Editar
        </button>
      </div>
    )
  }
  return (
    <div className="grid gap-2 rounded-xl p-3 ring-2 ring-acento-200" data-editor-campo={clave}>
      <span className="font-mono text-[11px] uppercase tracking-wider text-marca-500">{titulo}</span>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={Math.min(16, Math.max(3, texto.split('\n').length + 1))} className="campo py-2 text-sm leading-relaxed" aria-label={titulo} />
      {ayuda && <p className="text-[11.5px] text-marca-500">{ayuda}</p>}
      {error && <p className="text-xs text-acento-700">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { setEditando(false); setError(null); setTexto(inicial) }} className="btn-neutro h-8 px-3 text-xs">Cancelar</button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => empezar(async () => { const r = await guardarCampoProceso(refProceso, clave, texto); if (r.error) setError(r.error); else { setEditando(false); router.refresh() } })}
          className="btn-acento h-8 px-3 text-xs"
        >
          {pendiente ? 'Guardando…' : 'Guardar en el borrador'}
        </button>
        <span className="text-[11.5px] text-marca-500">La caracterización vigente no cambia hasta que se apruebe.</span>
      </div>
    </div>
  )
}

/** El borrador de la caracterización: enviarlo a revisión (con motivo) o descartarlo. */
export function BandaCaracterizacion({ refProceso, version, nota, puedeDescartar }: { refProceso: string; version: number; nota: string | null; puedeDescartar: boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState(nota ?? '')
  const [pendiente, empezar] = useTransition()
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null)
  const router = useRouter()
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-oro-50 px-4 py-3 text-[13px] text-oro-900" data-propuesta-caracterizacion>
      <span><b>Borrador de la caracterización (v{version}).</b> {nota ?? ''} Toca «Editar» en cualquier campo. La versión vigente sigue rigiendo hasta que esta se apruebe.</span>
      {!abierto ? (
        <span className="flex gap-2">
          {puedeDescartar && (
            <button type="button" disabled={pendiente} onClick={() => empezar(async () => { const r = await descartarCaracterizacion(refProceso); setMsg(r); if (!r.error) router.refresh() })} className="btn-neutro h-8 px-3 text-xs">Descartar</button>
          )}
          <button type="button" onClick={() => setAbierto(true)} className="btn-acento h-8 px-3 text-xs">Enviar a revisión</button>
        </span>
      ) : (
        <div className="grid w-full gap-2">
          <label className="text-xs font-medium" htmlFor="motivo-caracterizacion">Motivo del cambio</label>
          <textarea id="motivo-caracterizacion" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} className="campo py-2 text-sm text-marca-800" />
          <span className="flex gap-2">
            <button type="button" onClick={() => setAbierto(false)} className="btn-neutro h-8 px-3 text-xs">Cancelar</button>
            <button type="button" disabled={pendiente} onClick={() => empezar(async () => { const r = await enviarCaracterizacion(refProceso, motivo); setMsg(r); if (!r.error) { setAbierto(false); router.refresh() } })} className="btn-acento h-8 px-3 text-xs">
              {pendiente ? 'Enviando…' : 'Enviar'}
            </button>
          </span>
        </div>
      )}
      {msg?.error && <p className="w-full text-xs text-acento-700">{msg.error}</p>}
      {msg?.ok && <p className="w-full text-xs">{msg.ok}</p>}
    </div>
  )
}


/** Despliega o pliega todas las secciones de la caracterización. */
export function DesplegarTodo() {
  const [abiertas, setAbiertas] = useState(false)
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={(e) => {
          const raiz = (e.currentTarget as HTMLElement).closest('[data-caracterizacion]')
          raiz?.querySelectorAll('details[data-seccion-caracterizacion]').forEach((d) => { (d as HTMLDetailsElement).open = !abiertas })
          setAbiertas(!abiertas)
        }}
        className="rounded-md px-2 py-1 text-[12px] font-medium text-marca-600 hover:bg-marca-50"
      >
        {abiertas ? 'Plegar todo' : 'Desplegar todo'}
      </button>
    </div>
  )
}

/** Renombrar, cambiar de dónde cuelga o crear un subproceso: en un cuadro de la página. Va al borrador, con aprobación. */
export function AccionesEstructura({ refProceso, nombre, padre, opciones, puedeCrear }: { refProceso: string; nombre: string; padre: string | null; opciones: { ref: string; etiqueta: string }[]; puedeCrear: boolean }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [nuevoNombre, setNuevoNombre] = useState(nombre)
  const [nuevoPadre, setNuevoPadre] = useState(padre ?? '')
  const [hijo, setHijo] = useState('')
  const [pendiente, empezar] = useTransition()
  const [msg, setMsg] = useState<{ error?: string; ok?: string } | null>(null)
  const router = useRouter()
  const correr = (f: () => Promise<{ error?: string; ok?: string }>) =>
    empezar(async () => { const r = await f(); setMsg(r); if (!r.error) router.refresh() })
  return (
    <>
      <button type="button" onClick={() => { setMsg(null); dialogo.current?.showModal() }} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50">
        Mover o renombrar
      </button>
      <dialog ref={dialogo} className="w-[min(520px,calc(100vw-32px))] rounded-2xl border border-[var(--borde)] p-0 backdrop:bg-black/30" data-acciones-estructura>
        <div className="grid gap-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Mover o renombrar</h2>
            <button type="button" onClick={() => dialogo.current?.close()} className="rounded-md px-2 text-marca-500 hover:bg-marca-50" aria-label="Cerrar">✕</button>
          </div>
          <p className="text-[12.5px] text-marca-500">Cada cambio va a una versión nueva del proceso (borrador) y entra cuando se aprueba. La versión vigente no se toca.</p>
          <label className="grid gap-1 text-[13px]">
            <span className="font-medium">Nombre</span>
            <span className="flex gap-2">
              <input value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="campo h-9 flex-1" />
              <button type="button" disabled={pendiente || nuevoNombre.trim() === nombre} onClick={() => correr(() => renombrarProceso(refProceso, nuevoNombre))} className="btn-acento h-9 px-3 text-xs">Renombrar</button>
            </span>
          </label>
          {opciones.length > 0 && (
            <label className="grid gap-1 text-[13px]">
              <span className="font-medium">Cuelga de</span>
              <span className="flex gap-2">
                <select value={nuevoPadre} onChange={(e) => setNuevoPadre(e.target.value)} className="campo h-9 min-w-0 flex-1">
                  {opciones.map((o) => <option key={o.ref} value={o.ref}>{o.etiqueta}</option>)}
                </select>
                <button type="button" disabled={pendiente || nuevoPadre === (padre ?? '')} onClick={() => correr(() => moverProceso(refProceso, nuevoPadre))} className="btn-acento h-9 px-3 text-xs">Mover</button>
              </span>
            </label>
          )}
          {puedeCrear && (
            <label className="grid gap-1 text-[13px]">
              <span className="font-medium">Nuevo subproceso</span>
              <span className="flex gap-2">
                <input value={hijo} onChange={(e) => setHijo(e.target.value)} placeholder="Nombre del subproceso" className="campo h-9 flex-1" />
                <button type="button" disabled={pendiente || hijo.trim().length < 3} onClick={() => correr(() => crearSubproceso(refProceso, hijo))} className="btn-acento h-9 px-3 text-xs">Crear</button>
              </span>
            </label>
          )}
          {msg?.error && <p className="text-xs text-acento-700">{msg.error}</p>}
          {msg?.ok && <p className="text-xs text-[#1f7a4d]">{msg.ok}</p>}
        </div>
      </dialog>
    </>
  )
}
