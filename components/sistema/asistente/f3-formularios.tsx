'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ESFUERZOS, ETIQUETA_ESFUERZO, bytesLegibles, type Esfuerzo } from '@/lib/asistente/tipos'
import { borrarAtajo, borrarMemoria, borrarProyecto, cambiarMemoria, guardarAtajo, guardarMemoria, guardarProyecto } from './acciones-f3'
import { confirmarSubida, prepararSubida } from './acciones'
import { cn } from '@/lib/utils'

const campo = 'rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[13px] text-marca-900 outline-none focus:border-marca-400'
const rotulo = 'mb-1 block text-[12px] font-semibold text-marca-600'

function useAccion() {
  const [pendiente, iniciar] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const router = useRouter()
  const correr = <T extends { ok: boolean; error?: string }>(f: () => Promise<T>, alTerminar?: (r: T) => void) =>
    iniciar(async () => {
      const r = await f()
      setMsg(r.ok ? { ok: true, texto: 'Guardado.' } : { ok: false, texto: r.error ?? 'No se pudo.' })
      if (r.ok) {
        alTerminar?.(r)
        router.refresh()
      }
    })
  return { pendiente, msg, correr }
}

function Estado({ pendiente, msg }: { pendiente: boolean; msg: { ok: boolean; texto: string } | null }) {
  if (pendiente) return <span className="text-[12px] text-marca-500">Guardando…</span>
  return msg ? <span className={cn('text-[12px]', msg.ok ? 'text-emerald-700' : 'text-acento-700')}>{msg.texto}</span> : null
}

// ── Proyectos ────────────────────────────────────────────────────────────────

export function NuevoProyecto() {
  const [nombre, setNombre] = useState('')
  const { pendiente, msg, correr } = useAccion()
  const router = useRouter()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input className={cn(campo, 'h-9 w-72')} placeholder="Nombre del proyecto (por ejemplo: Compras 2027)" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-label="Nombre del proyecto" />
      <button
        type="button"
        className="btn-acento h-9 px-4 text-[13px]"
        disabled={pendiente || !nombre.trim()}
        onClick={() => correr(() => guardarProyecto({ nombre, instrucciones: '' }), (r) => 'id' in r && router.push(`/sistema/asistente/proyectos/${(r as { id: string }).id}`))}
      >
        Crear proyecto
      </button>
      <Estado pendiente={pendiente} msg={msg} />
    </div>
  )
}

export function EditarProyecto({ id, nombre: n0, instrucciones: i0 }: { id: string; nombre: string; instrucciones: string }) {
  const [nombre, setNombre] = useState(n0)
  const [instrucciones, setInstrucciones] = useState(i0)
  const [seguro, setSeguro] = useState(false)
  const { pendiente, msg, correr } = useAccion()
  const router = useRouter()
  return (
    <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
      <label className={rotulo} htmlFor="p-nombre">Nombre</label>
      <input id="p-nombre" className={cn(campo, 'h-9 w-full max-w-md')} value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} />
      <label className={cn(rotulo, 'mt-4')} htmlFor="p-instr">
        Instrucciones del proyecto
      </label>
      <p className="mb-1.5 text-[12px] text-marca-500">Todo chat de este proyecto las recibe. Por ejemplo: «Responde como analista de compras; los montos en USD y en Bs a tasa BCV; los informes en una página».</p>
      <textarea id="p-instr" className={cn(campo, 'block min-h-[180px] w-full py-2 leading-relaxed')} maxLength={10000} value={instrucciones} onChange={(e) => setInstrucciones(e.target.value)} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-acento h-9 px-4 text-[13px]" disabled={pendiente} onClick={() => correr(() => guardarProyecto({ id, nombre, instrucciones }))}>
          Guardar
        </button>
        <Link href={`/sistema/asistente?proyecto=${id}`} className="btn-neutro h-9 px-4 text-[13px]">
          Nuevo chat en este proyecto
        </Link>
        <Estado pendiente={pendiente} msg={msg} />
        <span className="flex-1" />
        <button
          type="button"
          className={seguro ? 'btn-peligro h-9 px-3 text-[12.5px]' : 'btn-neutro h-9 px-3 text-[12.5px]'}
          disabled={pendiente}
          onClick={() => {
            if (!seguro) {
              setSeguro(true)
              setTimeout(() => setSeguro(false), 4000)
              return
            }
            correr(() => borrarProyecto(id), () => router.push('/sistema/asistente/proyectos'))
          }}
        >
          {seguro ? '¿Seguro? Los chats quedan sueltos' : 'Borrar proyecto'}
        </button>
      </div>
    </section>
  )
}

export function ArchivosProyecto({ proyectoId, archivos }: { proyectoId: string; archivos: { id: string; nombre: string; bytes: number }[] }) {
  const [subiendo, setSubiendo] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const subir = async (files: FileList) => {
    const supabase = createClient()
    for (const f of Array.from(files)) {
      setSubiendo((s) => [...s, f.name])
      const p = await prepararSubida({ nombre: f.name, mime: f.type || 'application/octet-stream', bytes: f.size, chatId: null, proyectoId })
      if (!p.ok) setError(p.error)
      else {
        const { error: e } = await supabase.storage.from('asistente').upload(p.ruta, f, { contentType: f.type || 'application/octet-stream' })
        if (e) setError('No se pudo subir.')
        else await confirmarSubida(p.archivoId)
      }
      setSubiendo((s) => s.filter((x) => x !== f.name))
    }
    router.refresh()
  }
  return (
    <section className="rounded-xl border border-[var(--borde)] bg-white">
      <header className="flex items-center gap-2 border-b border-[var(--borde)] px-4 py-2.5">
        <h2 className="flex-1 text-[13px] font-semibold text-marca-900">Archivos de referencia</h2>
        <label className="btn-neutro h-8 cursor-pointer px-3 text-[12.5px]">
          Subir
          <input type="file" multiple className="sr-only" onChange={(e) => e.target.files && void subir(e.target.files)} />
        </label>
      </header>
      <p className="px-4 pt-2 text-[12px] text-marca-500">Un manual, una plantilla, el formato de informe del área: están a mano en cada chat del proyecto, sin volver a subirlos.</p>
      {error && <p className="px-4 pt-1 text-[12px] text-acento-700">{error}</p>}
      <ul className="px-4 py-2 text-[13px]">
        {archivos.map((a) => (
          <li key={a.id} className="flex items-center gap-2 border-b border-[var(--borde)] py-1.5 last:border-0">
            <a href={`/sistema/asistente/archivo/${a.id}`} className="min-w-0 flex-1 truncate text-marca-800 hover:underline">
              {a.nombre}
            </a>
            <span className="text-[12px] text-marca-500">{bytesLegibles(a.bytes)}</span>
          </li>
        ))}
        {subiendo.map((n) => (
          <li key={n} className="py-1.5 text-[12.5px] text-marca-500">
            Subiendo {n}…
          </li>
        ))}
        {!archivos.length && !subiendo.length && <li className="py-2 text-[12.5px] text-marca-400">Sin archivos todavía.</li>}
      </ul>
    </section>
  )
}

// ── Memoria ──────────────────────────────────────────────────────────────────

export function InterruptorMemoria({ encendida }: { encendida: boolean }) {
  const [v, setV] = useState(encendida)
  const { pendiente, correr } = useAccion()
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-marca-800">
      <input
        type="checkbox"
        checked={v}
        disabled={pendiente}
        onChange={(e) => {
          setV(e.target.checked)
          correr(() => cambiarMemoria(e.target.checked))
        }}
      />
      Memoria {v ? 'encendida' : 'apagada'}: {v ? 'el asistente recuerda cómo trabajas entre chats' : 'no recuerda nada entre chats'}
    </label>
  )
}

export function FilaMemoria({ id, texto: t0, origen }: { id: string; texto: string; origen: { id: string; titulo: string } | null }) {
  const [texto, setTexto] = useState(t0)
  const [editando, setEditando] = useState(false)
  const { pendiente, correr } = useAccion()
  return (
    <li className="flex flex-wrap items-start gap-2 border-b border-[var(--borde)] px-4 py-2.5 last:border-0">
      {editando ? (
        <input className={cn(campo, 'h-9 min-w-0 flex-1')} value={texto} maxLength={500} onChange={(e) => setTexto(e.target.value)} aria-label="Editar el recuerdo" />
      ) : (
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-marca-900">{texto}</p>
          {origen && (
            <Link href={`/sistema/asistente/c/${origen.id}`} className="text-[11.5px] text-marca-500 hover:underline">
              De: {origen.titulo}
            </Link>
          )}
        </div>
      )}
      {editando ? (
        <button type="button" className="btn-neutro h-8 px-3 text-[12px]" disabled={pendiente} onClick={() => correr(() => guardarMemoria({ id, texto }), () => setEditando(false))}>
          Guardar
        </button>
      ) : (
        <button type="button" className="btn-neutro h-8 px-3 text-[12px]" onClick={() => setEditando(true)}>
          Editar
        </button>
      )}
      <button type="button" className="btn-peligro h-8 px-3 text-[12px]" disabled={pendiente} onClick={() => correr(() => borrarMemoria(id))}>
        Olvidar
      </button>
    </li>
  )
}

export function NuevaMemoria() {
  const [texto, setTexto] = useState('')
  const { pendiente, msg, correr } = useAccion()
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3">
      <input className={cn(campo, 'h-9 min-w-0 flex-1')} placeholder="Agrega algo que el asistente deba recordar (por ejemplo: trabajo en Compras de Cagua)" maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Nuevo recuerdo" />
      <button type="button" className="btn-neutro h-9 px-3 text-[12.5px]" disabled={pendiente || texto.trim().length < 3} onClick={() => correr(() => guardarMemoria({ texto }), () => setTexto(''))}>
        Agregar
      </button>
      <Estado pendiente={pendiente} msg={msg} />
    </div>
  )
}

// ── Atajos ───────────────────────────────────────────────────────────────────

export type AtajoVista = { id: string; empresa: boolean; comando: string; titulo: string; instruccion: string; modelo: string | null; esfuerzo: Esfuerzo | null }

export function FormAtajo({ inicial, empresa, modelos, editable }: { inicial?: AtajoVista; empresa: boolean; modelos: { id: string; nombre: string }[]; editable: boolean }) {
  const [a, setA] = useState<AtajoVista>(inicial ?? { id: '', empresa, comando: '', titulo: '', instruccion: '', modelo: null, esfuerzo: null })
  const [seguro, setSeguro] = useState(false)
  const { pendiente, msg, correr } = useAccion()
  return (
    <div className="border-b border-[var(--borde)] px-4 py-3 last:border-0">
      <div className="grid gap-2 sm:grid-cols-[160px_1fr_180px_150px]">
        <div>
          <label className={rotulo}>Comando</label>
          <div className="flex items-center">
            <span className="mr-1 text-marca-500">/</span>
            <input className={cn(campo, 'h-9 w-full font-mono')} disabled={!editable} value={a.comando} onChange={(e) => setA({ ...a, comando: e.target.value })} placeholder="informe-semanal" />
          </div>
        </div>
        <div>
          <label className={rotulo}>Título</label>
          <input className={cn(campo, 'h-9 w-full')} disabled={!editable} value={a.titulo} onChange={(e) => setA({ ...a, titulo: e.target.value })} />
        </div>
        <div>
          <label className={rotulo}>Modelo</label>
          <select className={cn(campo, 'h-9 w-full')} disabled={!editable} value={a.modelo ?? ''} onChange={(e) => setA({ ...a, modelo: e.target.value || null })}>
            <option value="">El que elija la persona</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo}>Esfuerzo</label>
          <select className={cn(campo, 'h-9 w-full')} disabled={!editable} value={a.esfuerzo ?? ''} onChange={(e) => setA({ ...a, esfuerzo: (e.target.value || null) as Esfuerzo | null })}>
            <option value="">El que elija</option>
            {ESFUERZOS.map((e) => (
              <option key={e} value={e}>
                {ETIQUETA_ESFUERZO[e]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <label className={cn(rotulo, 'mt-2')}>Instrucción · usa {'{llaves}'} para lo que la persona completa, por ejemplo {'{mes}'}</label>
      <textarea className={cn(campo, 'block min-h-[72px] w-full py-2')} disabled={!editable} maxLength={4000} value={a.instruccion} onChange={(e) => setA({ ...a, instruccion: e.target.value })} />
      {editable && (
        <div className="mt-2 flex items-center gap-2">
          <button type="button" className="btn-neutro h-8 px-3 text-[12.5px]" disabled={pendiente} onClick={() => correr(() => guardarAtajo({ id: a.id || null, empresa, comando: a.comando, titulo: a.titulo, instruccion: a.instruccion, modelo: a.modelo, esfuerzo: a.esfuerzo }), () => !inicial && setA({ ...a, comando: '', titulo: '', instruccion: '' }))}>
            {inicial ? 'Guardar' : 'Crear atajo'}
          </button>
          {inicial && (
            <button
              type="button"
              className={seguro ? 'btn-peligro h-8 px-3 text-[12.5px]' : 'btn-neutro h-8 px-3 text-[12.5px]'}
              disabled={pendiente}
              onClick={() => {
                if (!seguro) {
                  setSeguro(true)
                  setTimeout(() => setSeguro(false), 4000)
                  return
                }
                correr(() => borrarAtajo(a.id))
              }}
            >
              {seguro ? '¿Seguro?' : 'Borrar'}
            </button>
          )}
          <Estado pendiente={pendiente} msg={msg} />
        </div>
      )}
    </div>
  )
}
