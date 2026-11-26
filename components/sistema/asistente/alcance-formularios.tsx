'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarAlcanceRol, guardarAlcanceUsuario, guardarFuente, verComo } from './alcance-acciones'
import { cn } from '@/lib/utils'

type Fuente = { clave: string; titulo: string; modulo: string; encendida: boolean; sensible: boolean }
type Rol = { id: string; nombre: string; habilitado: boolean }

/** La matriz: cada fuente con su interruptor, su marca de sensible y una casilla por rol. */
export function MatrizAlcance({ fuentes, roles, marcadas, editable }: { fuentes: Fuente[]; roles: Rol[]; marcadas: string[]; editable: boolean }) {
  const [enc, setEnc] = useState(() => new Map(fuentes.map((f) => [f.clave, f.encendida])))
  const [sen, setSen] = useState(() => new Map(fuentes.map((f) => [f.clave, f.sensible])))
  const [marca, setMarca] = useState(() => new Set(marcadas))
  const [error, setError] = useState<string | null>(null)
  const [, iniciar] = useTransition()
  const router = useRouter()
  const correr = (f: () => Promise<{ ok: true } | { ok: false; error: string }>, deshacer: () => void) =>
    iniciar(async () => {
      const r = await f()
      if (!r.ok) {
        deshacer()
        setError(r.error)
      } else router.refresh()
    })
  return (
    <div className="relative overflow-x-auto">
      {error && <p className="px-4 py-2 text-[12.5px] text-acento-700">{error}</p>}
      <table className="w-full min-w-[820px] text-[12.5px]">
        <thead className="bg-marca-50 text-left text-[11.5px] text-marca-600">
          <tr>
            <th className="px-4 py-2 font-semibold">Fuente</th>
            <th className="px-2 py-2 text-center font-semibold">Encendida</th>
            <th className="px-2 py-2 text-center font-semibold">Sensible</th>
            {roles.map((r) => (
              <th key={r.id} className="px-2 py-2 text-center font-semibold" title={r.habilitado ? 'Tiene el asistente' : 'Este rol no tiene el asistente: su alcance no se usa hasta que lo tenga'}>
                <span className={cn(!r.habilitado && 'text-marca-400')}>{r.nombre}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fuentes.map((f, i) => {
            const cabecera = i === 0 || fuentes[i - 1].modulo !== f.modulo
            const encendida = enc.get(f.clave) ?? false
            return [
              cabecera && (
                <tr key={`m-${f.modulo}`} className="border-t border-[var(--borde)] bg-marca-50/40">
                  <td colSpan={3 + roles.length} className="px-4 py-1.5 font-mono text-[11px] text-marca-500">
                    {f.modulo}
                  </td>
                </tr>
              ),
              <tr key={f.clave} className="border-t border-[var(--borde)]">
                <td className={cn('px-4 py-1.5', encendida ? 'text-marca-900' : 'text-marca-400')}>{f.titulo}</td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    aria-label={`Encender ${f.titulo}`}
                    disabled={!editable}
                    checked={encendida}
                    onChange={(e) => {
                      const v = e.target.checked
                      setEnc((m) => new Map(m).set(f.clave, v))
                      correr(() => guardarFuente(f.clave, { encendida: v }), () => setEnc((m) => new Map(m).set(f.clave, !v)))
                    }}
                  />
                </td>
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    aria-label={`Marcar ${f.titulo} como sensible`}
                    disabled={!editable}
                    checked={sen.get(f.clave) ?? false}
                    onChange={(e) => {
                      const v = e.target.checked
                      setSen((m) => new Map(m).set(f.clave, v))
                      correr(() => guardarFuente(f.clave, { sensible: v }), () => setSen((m) => new Map(m).set(f.clave, !v)))
                    }}
                  />
                </td>
                {roles.map((r) => {
                  const k = `${r.id}|${f.clave}`
                  return (
                    <td key={k} className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`${r.nombre}: ${f.titulo}`}
                        disabled={!editable}
                        checked={marca.has(k)}
                        onChange={(e) => {
                          const v = e.target.checked
                          const cambiar = (x: boolean) =>
                            setMarca((s) => {
                              const n = new Set(s)
                              if (x) n.add(k)
                              else n.delete(k)
                              return n
                            })
                          cambiar(v)
                          correr(() => guardarAlcanceRol(r.id, f.clave, v), () => cambiar(!v))
                        }}
                      />
                    </td>
                  )
                })}
              </tr>,
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ExcepcionesAlcance({
  personas,
  fuentes,
  excepciones,
  editable,
}: {
  personas: { id: string; nombre: string }[]
  fuentes: { clave: string; titulo: string }[]
  excepciones: { perfil_id: string; fuente: string; permitido: boolean }[]
  editable: boolean
}) {
  const [persona, setPersona] = useState('')
  const [fuente, setFuente] = useState('')
  const [permitido, setPermitido] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, iniciar] = useTransition()
  const router = useRouter()
  const nombre = new Map(personas.map((p) => [p.id, p.nombre]))
  const titulo = new Map(fuentes.map((f) => [f.clave, f.titulo]))
  const guardar = (p: string, f: string, v: boolean | null) =>
    iniciar(async () => {
      const r = await guardarAlcanceUsuario(p, f, v)
      if (!r.ok) setError(r.error)
      else router.refresh()
    })
  return (
    <div className="px-4 py-3">
      {excepciones.length > 0 && (
        <ul className="mb-3 divide-y divide-[var(--borde)] rounded-lg border border-[var(--borde)] text-[12.5px]">
          {excepciones.map((x) => (
            <li key={`${x.perfil_id}|${x.fuente}`} className="flex items-center gap-2 px-3 py-1.5">
              <span className="font-medium text-marca-900">{nombre.get(x.perfil_id) ?? 'Persona'}</span>
              <span className="text-marca-500">·</span>
              <span className="text-marca-700">{titulo.get(x.fuente) ?? x.fuente}</span>
              <span className={cn('insignia', x.permitido ? 'bg-emerald-50 text-emerald-800' : 'bg-acento-50 text-acento-700')}>{x.permitido ? 'Permitida' : 'Negada'}</span>
              <span className="flex-1" />
              {editable && (
                <button type="button" className="btn-neutro h-7 px-2.5 text-[12px]" disabled={pendiente} onClick={() => guardar(x.perfil_id, x.fuente, null)}>
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <select className="h-9 w-56 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px]" value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Persona">
            <option value="">Persona…</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
          <select className="h-9 w-72 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px]" value={fuente} onChange={(e) => setFuente(e.target.value)} aria-label="Fuente">
            <option value="">Fuente…</option>
            {fuentes.map((f) => (
              <option key={f.clave} value={f.clave}>
                {f.titulo}
              </option>
            ))}
          </select>
          <select className="h-9 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px]" value={permitido ? 'si' : 'no'} onChange={(e) => setPermitido(e.target.value === 'si')} aria-label="Permitir o negar">
            <option value="si">Permitir</option>
            <option value="no">Negar</option>
          </select>
          <button type="button" className="btn-neutro h-9 px-3 text-[12.5px]" disabled={pendiente || !persona || !fuente} onClick={() => guardar(persona, fuente, permitido)}>
            Agregar excepción
          </button>
          {error && <span className="text-[12px] text-acento-700">{error}</span>}
        </div>
      )}
    </div>
  )
}

const ESTADO = {
  si: { texto: 'La consulta', clase: 'bg-emerald-50 text-emerald-800' },
  sin_permiso: { texto: 'Sin permiso de la pantalla', clase: 'bg-marca-100 text-marca-600' },
  fuera_de_alcance: { texto: 'Fuera de su alcance', clase: 'bg-marca-100 text-marca-600' },
  apagada: { texto: 'Fuente apagada', clase: 'bg-marca-100 text-marca-500' },
} as const

/** «Ver como»: qué fuentes tendría el asistente de una persona, sin entrar con su cuenta. */
export function VerComo({ personas }: { personas: { id: string; nombre: string }[] }) {
  const [persona, setPersona] = useState('')
  const [filas, setFilas] = useState<{ clave: string; titulo: string; estado: keyof typeof ESTADO }[] | null>(null)
  const [pendiente, iniciar] = useTransition()
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-9 w-64 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px]" value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Persona para ver como">
          <option value="">Elige una persona…</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-neutro h-9 px-3 text-[12.5px]"
          disabled={!persona || pendiente}
          onClick={() =>
            iniciar(async () => {
              const r = await verComo(persona)
              setFilas(r.ok ? r.filas : null)
            })
          }
        >
          {pendiente ? 'Calculando…' : 'Ver como'}
        </button>
      </div>
      {filas && (
        <ul className="mt-3 grid gap-1 text-[12.5px] sm:grid-cols-2">
          {filas.map((f) => (
            <li key={f.clave} className="flex items-start gap-2">
              <span className={cn('insignia shrink-0', ESTADO[f.estado].clase)}>{ESTADO[f.estado].texto}</span>
              <span className={cn('min-w-0 leading-snug', f.estado === 'si' ? 'text-marca-900' : 'text-marca-500')}>{f.titulo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
