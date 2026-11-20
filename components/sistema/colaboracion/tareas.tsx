'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useState, useTransition } from 'react'
import { buscarPersonas, cambiarTarea, crearTarea, type Mencionable } from '@/components/sistema/colaboracion/acciones'
import { abrirFicha } from '@/components/sistema/colaboracion/abrir'
import { ETIQUETA_OBJETO, ESTADO_TAREA, tieneLinea, vencida, venceHoy, type Tarea } from '@/lib/plataforma/colaboracion'
import { fechaLarga, hoyCaracas } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * Tareas con vencimiento (Anexo E §8): una cosa por hacer, para alguien, con
 * fecha, y si se quiere, sobre un objeto. Las vencidas se marcan con texto y
 * borde, no solo con color.
 */

export function TareaRapida({
  objeto,
  yo,
  alCrear,
  alCancelar,
}: {
  objeto?: { tipo: string; id: string } | null
  yo: { id: string; nombre: string }
  alCrear?: () => void
  alCancelar?: () => void
}) {
  const uid = useId()
  const [titulo, setTitulo] = useState('')
  const [vence, setVence] = useState('')
  const [para, setPara] = useState<Mencionable>({ id: yo.id, nombre: yo.nombre, cargo: null })
  const [busca, setBusca] = useState('')
  const [opciones, setOpciones] = useState<Mencionable[]>([])
  const [mensaje, setMensaje] = useState<{ error?: string; ok?: string }>({})
  const [enviando, iniciar] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (!busca.trim()) return
    let vigente = true
    const t = setTimeout(() => buscarPersonas(busca).then((r) => vigente && setOpciones(r)), 200)
    return () => {
      vigente = false
      clearTimeout(t)
    }
  }, [busca])

  function mandar(e: React.FormEvent) {
    e.preventDefault()
    setMensaje({})
    iniciar(async () => {
      const r = await crearTarea({ titulo, asignadaA: para.id, vence: vence || null, objetoTipo: objeto?.tipo ?? null, objetoId: objeto?.id ?? null })
      if (r.error) return setMensaje({ error: r.error })
      setTitulo('')
      setVence('')
      setMensaje({ ok: para.id === yo.id ? 'Tarea creada.' : `Tarea creada y avisada a ${para.nombre}.` })
      alCrear?.()
      router.refresh()
    })
  }

  return (
    <form onSubmit={mandar} className="rounded-lg border border-[var(--borde)] bg-[#fafbfc] p-2.5" aria-label="Nueva tarea">
      <label htmlFor={`${uid}-t`} className="text-[11.5px] font-semibold text-marca-700">
        Tarea {objeto && tieneLinea(objeto.tipo) ? `sobre esta ${ETIQUETA_OBJETO[objeto.tipo].toLowerCase()}` : ''}
      </label>
      <input
        id={`${uid}-t`}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={200}
        required
        placeholder="Qué hay que hacer"
        className="mt-1 block h-9 w-full rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[13px] focus:outline-2 focus:outline-acento-500"
      />
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="relative min-w-0">
          <label htmlFor={`${uid}-p`} className="text-[11.5px] text-marca-600">
            Para
          </label>
          <input
            id={`${uid}-p`}
            value={busca || para.nombre}
            onChange={(e) => setBusca(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => setTimeout(() => setBusca(''), 150)}
            role="combobox"
            aria-expanded={Boolean(busca && opciones.length)}
            aria-controls={`${uid}-ops`}
            aria-autocomplete="list"
            className="mt-1 block h-9 w-full rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[13px] focus:outline-2 focus:outline-acento-500"
          />
          {busca && opciones.length > 0 && (
            <ul id={`${uid}-ops`} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-[var(--borde)] bg-white py-1 shadow-lg">
              {opciones.map((p) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={p.id === para.id}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setPara(p)
                    setBusca('')
                  }}
                  className="cursor-pointer px-3 py-1.5 text-[13px] hover:bg-marca-50"
                >
                  {p.id === yo.id ? `${p.nombre} (yo)` : p.nombre}
                  {p.cargo && <span className="ml-2 text-[11.5px] text-marca-500">{p.cargo}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label htmlFor={`${uid}-v`} className="text-[11.5px] text-marca-600">
            Vence
          </label>
          <input
            id={`${uid}-v`}
            type="date"
            value={vence}
            min={hoyCaracas()}
            onChange={(e) => setVence(e.target.value)}
            className="mt-1 block h-9 w-full rounded-lg border border-[var(--borde)] bg-white px-2 text-[13px] focus:outline-2 focus:outline-acento-500"
          />
        </div>
      </div>
      {mensaje.error && (
        <p role="alert" className="mt-2 text-[12px] text-acento-700">
          {mensaje.error}
        </p>
      )}
      {mensaje.ok && (
        <p role="status" className="mt-2 text-[12px] text-[#1f6f4b]">
          ✓ {mensaje.ok}
        </p>
      )}
      <div className="mt-2 flex justify-end gap-2">
        {alCancelar && (
          <button type="button" onClick={alCancelar} className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs text-marca-600 hover:bg-marca-50">
            Cerrar
          </button>
        )}
        <button type="submit" disabled={enviando} className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-black disabled:opacity-50">
          {enviando ? 'Creando…' : 'Crear tarea'}
        </button>
      </div>
    </form>
  )
}

/** La marca de vencimiento: texto + borde, nunca solo color. */
export function MarcaVence({ t }: { t: Pick<Tarea, 'estado' | 'vence'> }) {
  if (!t.vence) return <span className="text-[11.5px] text-marca-400">Sin fecha</span>
  if (vencida(t))
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-[#e9b7b4] bg-[#fbeceb] px-1.5 text-[11px] font-semibold text-[#a3241f]">
        ⚠ Vencida · {fechaLarga(t.vence)}
      </span>
    )
  if (venceHoy(t))
    return <span className="inline-flex items-center gap-1 rounded-md border border-[#f0d49c] bg-[#fdf4e3] px-1.5 text-[11px] font-semibold text-[#8a5a12]">Vence hoy</span>
  return <span className="text-[11.5px] text-marca-500">Vence {fechaLarga(t.vence)}</span>
}

export function ListaTareas({ tareas, vacio = 'No tienes tareas abiertas.', compacta = false }: { tareas: Tarea[]; vacio?: string; compacta?: boolean }) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function cambiar(t: Tarea, estado: Tarea['estado']) {
    setError(null)
    iniciar(async () => {
      const r = await cambiarTarea(t.id, estado)
      if (r.error) setError(r.error)
      router.refresh()
    })
  }

  if (!tareas.length) return <p className="px-4 py-6 text-center text-[12.5px] text-marca-400">{vacio}</p>
  return (
    <>
      {error && (
        <p role="alert" className="mx-4 mt-2 text-[12px] text-acento-700">
          {error}
        </p>
      )}
      <ul className={cn(pendiente && 'opacity-60')}>
        {tareas.map((t) => {
          const hecha = t.estado !== 'abierta'
          const venc = vencida(t)
          return (
            <li key={t.id} className={cn('flex items-start gap-3 border-t border-[#eef0f3] px-4 py-2.5 first:border-0', venc && 'border-l-[3px] border-l-[#D4332C] bg-[#fffafa]')}>
              <button
                type="button"
                onClick={() => cambiar(t, hecha ? 'abierta' : 'hecha')}
                aria-pressed={hecha}
                aria-label={hecha ? `Reabrir «${t.titulo}»` : `Marcar hecha «${t.titulo}»`}
                className={cn(
                  'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border text-[11px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-500',
                  hecha ? 'border-[#1f6f4b] bg-[#1f6f4b] text-white' : 'border-marca-300 bg-white hover:border-marca-500'
                )}
              >
                {hecha ? '✓' : ''}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('text-[13px] break-words text-marca-900', hecha && 'text-marca-400 line-through')}>{t.titulo}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-marca-500">
                  {t.estado === 'abierta' ? <MarcaVence t={t} /> : <span>{ESTADO_TAREA[t.estado]}</span>}
                  {!compacta && <span>{t.mia ? (t.creadaPor.id === t.asignadaA.id ? 'Tuya' : `De ${t.creadaPor.nombre}`) : `Para ${t.asignadaA.nombre}`}</span>}
                  {t.objetoTipo && t.objetoId && (
                    <button type="button" onClick={() => abrirFicha(router, t.objetoTipo as string, t.objetoId as string)} className="max-w-full truncate text-acento-700 hover:underline">
                      {t.objetoTitulo ?? (tieneLinea(t.objetoTipo) ? ETIQUETA_OBJETO[t.objetoTipo] : 'Objeto')}
                    </button>
                  )}
                </p>
              </div>
              {!compacta && t.estado === 'abierta' && !t.mia && (
                <button type="button" onClick={() => cambiar(t, 'cancelada')} className="shrink-0 rounded-md px-2 py-1 text-[11.5px] text-marca-500 hover:bg-marca-50 hover:text-marca-800">
                  Cancelar
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
