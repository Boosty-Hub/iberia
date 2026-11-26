'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { compartirObjeto, invitarAlChat, sacarDelChat } from './acciones-f4'
import { cn } from '@/lib/utils'

type Persona = { perfil_id: string; nombre: string }

function usePersonas(abierto: boolean) {
  const [personas, setPersonas] = useState<Persona[] | null>(null)
  useEffect(() => {
    if (!abierto || personas) return
    void createClient()
      .schema('asistente')
      .rpc('personas_con_asistente')
      .then(({ data }) => setPersonas((data ?? []) as Persona[]))
  }, [abierto, personas])
  return personas
}

/**
 * Compartir un chat (fase 4): el dueño invita a otros con el asistente. Al
 * invitar se ven las fuentes de la plataforma que ya aparecen en el chat: quien
 * entra lo va a ver todo (decisión P1), así que se decide sabiendo.
 */
export function PanelCompartirChat({
  chatId,
  esDueno,
  yo,
  participantes,
  fuentes,
  onCambio,
  onCerrar,
}: {
  chatId: string
  esDueno: boolean
  yo: string
  participantes: { perfil_id: string; nombre: string; rol: string }[]
  fuentes: string[]
  onCambio: () => void
  onCerrar: () => void
}) {
  const personas = usePersonas(esDueno)
  const [elegida, setElegida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const ya = new Set(participantes.map((p) => p.perfil_id))
  const correr = (f: () => Promise<{ ok: boolean; error?: string }>) =>
    iniciar(async () => {
      const r = await f()
      if (!r.ok) setError(r.error ?? 'No se pudo.')
      else {
        setError(null)
        onCambio()
      }
    })
  return (
    <div role="dialog" aria-label="Compartir el chat" className="absolute top-12 right-3 z-30 w-[340px] rounded-xl border border-[var(--borde)] bg-white p-3 shadow-xl">
      <div className="mb-2 flex items-center">
        <p className="flex-1 text-[13.5px] font-semibold text-marca-900">Personas en este chat</p>
        <button type="button" className="text-marca-400 hover:text-marca-800" onClick={onCerrar} aria-label="Cerrar">
          ✕
        </button>
      </div>
      <ul className="mb-3 space-y-1 text-[13px]">
        {participantes.map((p) => (
          <li key={p.perfil_id} className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-marca-200 text-[11px] font-semibold text-marca-800">{p.nombre.slice(0, 1)}</span>
            <span className="flex-1 truncate text-marca-800">
              {p.nombre}
              {p.perfil_id === yo ? ' (tú)' : ''}
            </span>
            {p.rol === 'dueno' ? (
              <span className="text-[11px] text-marca-400">Dueño</span>
            ) : (esDueno || p.perfil_id === yo) && (
              <button type="button" className="text-[12px] text-acento-700 hover:underline" disabled={pendiente} onClick={() => correr(() => sacarDelChat(chatId, p.perfil_id))}>
                {p.perfil_id === yo ? 'Salir' : 'Sacar'}
              </button>
            )}
          </li>
        ))}
      </ul>
      {esDueno && (
        <>
          {fuentes.length > 0 && (
            <p className="mb-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] text-amber-900">
              Este chat ya trae datos de: {fuentes.join(', ')}. Quien entre los va a ver; lo que pregunte después, lo consulta con sus propios permisos.
            </p>
          )}
          <div className="flex gap-1.5">
            <select className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px]" value={elegida} onChange={(e) => setElegida(e.target.value)} aria-label="Persona a invitar">
              <option value="">{personas ? 'Invitar a…' : 'Cargando…'}</option>
              {(personas ?? [])
                .filter((p) => !ya.has(p.perfil_id))
                .map((p) => (
                  <option key={p.perfil_id} value={p.perfil_id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
            <button type="button" className="btn-acento h-9 px-3 text-[12.5px]" disabled={!elegida || pendiente} onClick={() => correr(() => invitarAlChat(chatId, elegida))}>
              Invitar
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-[12px] text-acento-700">{error}</p>}
    </div>
  )
}

/** Compartir un archivo o un artefacto con otra persona (revisa el linaje en el servidor). */
export function CompartirObjeto({ tipo, id }: { tipo: 'archivo' | 'html'; id: string }) {
  const [abierto, setAbierto] = useState(false)
  const personas = usePersonas(abierto)
  const [elegida, setElegida] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const compartir = (confirmado: boolean) =>
    iniciar(async () => {
      const r = await compartirObjeto(tipo, id, elegida, confirmado)
      setConfirmar(!r.ok && 'confirmar' in r && !!r.confirmar)
      setMsg(r.ok ? { ok: true, texto: 'Compartido.' } : { ok: false, texto: r.error })
    })
  return (
    <span className="relative inline-flex">
      <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => setAbierto((x) => !x)} aria-expanded={abierto}>
        Compartir
      </button>
      {abierto && (
        <span className="absolute top-9 right-0 z-30 flex w-[300px] flex-col gap-2 rounded-xl border border-[var(--borde)] bg-white p-3 text-left shadow-xl">
          <span className="text-[12.5px] text-marca-600">Lo verá con sus propios permisos: si el archivo trae datos de una fuente que esa persona no tiene, no se comparte.</span>
          <select
            className="h-9 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px]"
            value={elegida}
            onChange={(e) => {
              setElegida(e.target.value)
              setConfirmar(false)
              setMsg(null)
            }}
            aria-label="Compartir con"
          >
            <option value="">{personas ? 'Con…' : 'Cargando…'}</option>
            {(personas ?? []).map((p) => (
              <option key={p.perfil_id} value={p.perfil_id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-acento h-9 px-3 text-[12.5px]"
            disabled={!elegida || pendiente}
            onClick={() => compartir(false)}
          >
            {pendiente ? 'Revisando…' : 'Compartir'}
          </button>
          {msg && <span className={cn('text-[12px]', msg.ok ? 'text-emerald-700' : 'text-acento-700')}>{msg.texto}</span>}
          {confirmar && (
            <button type="button" className="btn-peligro h-9 px-3 text-[12.5px]" disabled={pendiente} onClick={() => compartir(true)}>
              Compartir igual
            </button>
          )}
        </span>
      )}
    </span>
  )
}
