'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ETIQUETA_CANAL, describirFrecuencia, type CanalTarea, type Frecuencia } from '@/lib/asistente/tipos'
import { borrarTarea, correrAhora, guardarTarea, pausarTarea, type EntradaTarea } from './acciones-f5'
import { cn } from '@/lib/utils'

/** Iconos de trazo (24×24), como los del resto de la plataforma. */
function Ico({ d, className }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={d} />
    </svg>
  )
}
const CalendarClock = (p: { className?: string }) => <Ico {...p} d="M8 2v4M16 2v4M3 10h8M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M17.5 14v2l1.5 1M22 16a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
const LayoutDashboard = (p: { className?: string }) => <Ico {...p} d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />
const Pause = (p: { className?: string }) => <Ico {...p} d="M6 4h4v16H6zM14 4h4v16h-4z" />
const Play = (p: { className?: string }) => <Ico {...p} d="M6 3l14 9-14 9V3z" />
const Trash2 = (p: { className?: string }) => <Ico {...p} d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
const Zap = (p: { className?: string }) => <Ico {...p} d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
const Check = (p: { className?: string }) => <Ico {...p} d="M20 6 9 17l-5-5" />

const campo = 'rounded-lg border border-[var(--borde)] bg-white px-2.5 text-[13px] text-marca-900 outline-none focus:border-marca-400'
const rotulo = 'mb-1 block text-[12px] font-semibold text-marca-600'
const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export const FRECUENCIA_INICIAL: Frecuencia = { frecuencia: 'semanal', hora: '08:00', dias: [1], dia_mes: 1, cada_horas: 6 }

/** Cuándo corre: diaria, semanal (con sus días), mensual (con su día) o cada N horas, en hora de Caracas. */
export function EditorFrecuencia({ valor, cambiar, prefijo = 'f' }: { valor: Frecuencia; cambiar: (f: Frecuencia) => void; prefijo?: string }) {
  const set = (p: Partial<Frecuencia>) => cambiar({ ...valor, ...p })
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className={rotulo} htmlFor={`${prefijo}-frec`}>
          Frecuencia
        </label>
        <select id={`${prefijo}-frec`} className={cn(campo, 'h-9')} value={valor.frecuencia} onChange={(e) => set({ frecuencia: e.target.value as Frecuencia['frecuencia'] })}>
          <option value="diaria">Todos los días</option>
          <option value="semanal">Algunos días de la semana</option>
          <option value="mensual">Una vez al mes</option>
          <option value="horas">Cada cierto número de horas</option>
        </select>
      </div>
      {valor.frecuencia === 'semanal' && (
        <fieldset>
          <legend className={rotulo}>Días</legend>
          <div className="flex gap-1">
            {DIAS_CORTOS.map((d, i) => {
              const n = i + 1
              const activo = valor.dias.includes(n)
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={activo}
                  aria-label={DIAS_LARGOS[i]}
                  title={DIAS_LARGOS[i]}
                  onClick={() => set({ dias: activo ? valor.dias.filter((x) => x !== n) : [...valor.dias, n].sort() })}
                  className={cn('h-9 w-9 rounded-lg border text-[13px] font-semibold', activo ? 'border-acento-500 bg-acento-500 text-white' : 'border-[var(--borde)] bg-white text-marca-700 hover:border-marca-400')}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </fieldset>
      )}
      {valor.frecuencia === 'mensual' && (
        <div>
          <label className={rotulo} htmlFor={`${prefijo}-dia`}>
            Día del mes
          </label>
          <select id={`${prefijo}-dia`} className={cn(campo, 'h-9')} value={valor.dia_mes ?? 1} onChange={(e) => set({ dia_mes: Number(e.target.value) })}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}
      {valor.frecuencia === 'horas' && (
        <div>
          <label className={rotulo} htmlFor={`${prefijo}-cada`}>
            Cada
          </label>
          <select id={`${prefijo}-cada`} className={cn(campo, 'h-9')} value={valor.cada_horas ?? 6} onChange={(e) => set({ cada_horas: Number(e.target.value) })}>
            {[1, 2, 3, 4, 6, 8, 12].map((h) => (
              <option key={h} value={h}>
                {h} {h === 1 ? 'hora' : 'horas'}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className={rotulo} htmlFor={`${prefijo}-hora`}>
          {valor.frecuencia === 'horas' ? 'Desde las' : 'Hora (Caracas)'}
        </label>
        <input id={`${prefijo}-hora`} type="time" className={cn(campo, 'h-9')} value={valor.hora} onChange={(e) => set({ hora: e.target.value || '08:00' })} />
      </div>
    </div>
  )
}

export type TareaVista = EntradaTarea & {
  id: string
  tipo: 'tarea' | 'tablero'
  estado: 'activa' | 'pausada'
  pausadaMotivo: string | null
  /** Las fechas van ya escritas desde el servidor: `Intl` no escribe igual en Node que en el navegador (hidratación). */
  proximaTexto: string
  ultimaEn: string | null
  fallas: number
  corridas: CorridaVista[]
}

export type CorridaVista = {
  id: string
  estado: 'en_cola' | 'corriendo' | 'lista' | 'fallida' | 'saltada'
  cuando: string
  cuandoTexto: string
  manual: boolean
  intento: number
  chatId: string | null
  error: string | null
  entregas: { canal: CanalTarea; a: string; estado: string; detalle?: string }[]
}

type Opciones = { proyectos: { id: string; nombre: string }[]; modelos: { id: string; nombre: string }[]; personas: { id: string; nombre: string }[]; correoListo: boolean; whatsappListo: boolean }

const ESTADO_CORRIDA: Record<CorridaVista['estado'], { texto: string; clase: string }> = {
  en_cola: { texto: 'Reintento en cola', clase: 'bg-amber-50 text-amber-800' },
  corriendo: { texto: 'Corriendo', clase: 'bg-sky-50 text-sky-800' },
  lista: { texto: 'Lista', clase: 'bg-emerald-50 text-emerald-800' },
  fallida: { texto: 'Falló', clase: 'bg-acento-50 text-acento-800' },
  saltada: { texto: 'Saltada', clase: 'bg-marca-100 text-marca-700' },
}

/** El formulario de una tarea (nueva, editar o venida de una propuesta del chat). */
export function FormTarea({ inicial, opciones, alTerminar }: { inicial?: Partial<EntradaTarea>; opciones: Opciones; alTerminar?: () => void }) {
  const router = useRouter()
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [instruccion, setInstruccion] = useState(inicial?.instruccion ?? '')
  const [proyectoId, setProyectoId] = useState(inicial?.proyectoId ?? '')
  const [modelo, setModelo] = useState(inicial?.modelo ?? '')
  const [frec, setFrec] = useState<Frecuencia>({
    frecuencia: inicial?.frecuencia ?? FRECUENCIA_INICIAL.frecuencia,
    hora: inicial?.hora ?? FRECUENCIA_INICIAL.hora,
    dias: inicial?.dias?.length ? inicial.dias : FRECUENCIA_INICIAL.dias,
    dia_mes: inicial?.dia_mes ?? FRECUENCIA_INICIAL.dia_mes,
    cada_horas: inicial?.cada_horas ?? FRECUENCIA_INICIAL.cada_horas,
  })
  const [canales, setCanales] = useState<CanalTarea[]>(inicial?.canales ?? ['plataforma'])
  const [destinatarios, setDestinatarios] = useState<string[]>(inicial?.destinatarios ?? [])
  const [enMiDia, setEnMiDia] = useState(inicial?.enMiDia ?? false)
  const [pendiente, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const id = inicial?.id
  const pre = id ? `t-${id.slice(0, 6)}` : 't-nueva'

  const guardar = () =>
    iniciar(async () => {
      setError(null)
      const r = await guardarTarea({
        id,
        nombre,
        instruccion,
        proyectoId: proyectoId || null,
        modelo: modelo || null,
        ...frec,
        canales,
        destinatarios,
        enMiDia,
        origenChat: inicial?.origenChat ?? null,
        origenMensaje: inicial?.origenMensaje ?? null,
      })
      if (!r.ok) return setError(r.error)
      alTerminar?.()
      router.refresh()
    })

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
        <div>
          <label className={rotulo} htmlFor={`${pre}-nombre`}>
            Nombre
          </label>
          <input id={`${pre}-nombre`} className={cn(campo, 'h-9 w-full')} maxLength={120} value={nombre} placeholder="Resumen semanal de requisiciones" onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className={rotulo} htmlFor={`${pre}-proy`}>
            Proyecto (opcional)
          </label>
          <select id={`${pre}-proy`} className={cn(campo, 'h-9 w-full')} value={proyectoId ?? ''} onChange={(e) => setProyectoId(e.target.value)}>
            <option value="">Sin proyecto</option>
            {opciones.proyectos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={rotulo} htmlFor={`${pre}-modelo`}>
            Modelo
          </label>
          <select id={`${pre}-modelo`} className={cn(campo, 'h-9 w-full')} value={modelo ?? ''} onChange={(e) => setModelo(e.target.value)}>
            <option value="">El de siempre</option>
            {opciones.modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={rotulo} htmlFor={`${pre}-instr`}>
          Qué hace en cada corrida
        </label>
        <textarea
          id={`${pre}-instr`}
          className={cn(campo, 'block min-h-[110px] w-full py-2 leading-relaxed')}
          maxLength={8000}
          value={instruccion}
          placeholder="Consulta las requisiciones abiertas, agrúpalas por unidad y por antigüedad, y hazme un resumen de una página con lo que lleva más de 15 días."
          onChange={(e) => setInstruccion(e.target.value)}
        />
        <p className="mt-1 text-[12px] text-marca-500">Corre con tus permisos de ese día. Si un día ya no puedes ver una fuente, el resultado lo dice.</p>
      </div>
      <EditorFrecuencia valor={frec} cambiar={setFrec} prefijo={pre} />
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset>
          <legend className={rotulo}>Por dónde te llega</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-marca-800">
            <label className="inline-flex items-center gap-1.5">
              <input type="checkbox" checked disabled /> Plataforma (siempre)
            </label>
            {(['correo', 'whatsapp'] as const).map((c) => (
              <label key={c} className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={canales.includes(c)} onChange={(e) => setCanales(e.target.checked ? [...canales, c] : canales.filter((x) => x !== c))} />
                {ETIQUETA_CANAL[c]}
                {c === 'correo' && !opciones.correoListo && <span className="text-[11px] text-amber-700">(pendiente de configurar)</span>}
                {c === 'whatsapp' && !opciones.whatsappListo && <span className="text-[11px] text-amber-700">(cuenta en trámite)</span>}
              </label>
            ))}
          </div>
          <p className="mt-1 text-[12px] text-marca-500">Correo y WhatsApp llevan un resumen y el enlace; el detalle se abre con sesión.</p>
        </fieldset>
        <fieldset>
          <legend className={rotulo}>También se lo mando a</legend>
          <div className="flex flex-wrap gap-1.5">
            {destinatarios.map((d) => (
              <button key={d} type="button" className="insignia gap-1" onClick={() => setDestinatarios(destinatarios.filter((x) => x !== d))} aria-label={`Quitar a ${opciones.personas.find((p) => p.id === d)?.nombre ?? 'persona'}`}>
                {opciones.personas.find((p) => p.id === d)?.nombre ?? 'Persona'} ×
              </button>
            ))}
            <select
              aria-label="Agregar destinatario"
              className={cn(campo, 'h-8')}
              value=""
              onChange={(e) => e.target.value && setDestinatarios([...destinatarios, e.target.value])}
            >
              <option value="">Agregar persona…</option>
              {opciones.personas
                .filter((p) => !destinatarios.includes(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
            </select>
          </div>
          <p className="mt-1 text-[12px] text-marca-500">Si el resultado trae datos que esa persona no puede ver, no se le manda y te aviso.</p>
        </fieldset>
      </div>
      <label className="inline-flex items-center gap-2 text-[13px] text-marca-800">
        <input type="checkbox" checked={enMiDia} onChange={(e) => setEnMiDia(e.target.checked)} /> Mostrar el último resultado en Mi día
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-acento h-9 px-4 text-[13px]" disabled={pendiente || nombre.trim().length < 2 || instruccion.trim().length < 5} onClick={guardar}>
          {pendiente ? 'Guardando…' : id ? 'Guardar cambios' : 'Programar'}
        </button>
        <span className="text-[12px] text-marca-600">{describirFrecuencia(frec)}</span>
        {error && <span className="text-[12px] text-acento-700">{error}</span>}
      </div>
    </div>
  )
}

export function NuevaTarea({ opciones, inicial }: { opciones: Opciones; inicial?: Partial<EntradaTarea> }) {
  const [abierta, setAbierta] = useState(!!inicial)
  return (
    <section className="mb-4 rounded-xl border border-[var(--borde)] bg-white">
      <header className="flex items-center justify-between gap-2 px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-marca-900">{inicial ? 'Revisa la tarea que te propuso el asistente' : 'Nueva tarea programada'}</h2>
        {!inicial && (
          <button type="button" className={abierta ? 'btn-neutro h-8 px-3 text-[12px]' : 'btn-acento h-8 px-3 text-[12px]'} onClick={() => setAbierta(!abierta)}>
            {abierta ? 'Cerrar' : 'Nueva tarea'}
          </button>
        )}
      </header>
      {abierta && (
        <div className="border-t border-[var(--borde)]">
          <FormTarea inicial={inicial} opciones={opciones} alTerminar={() => setAbierta(false)} />
        </div>
      )}
    </section>
  )
}

function TarjetaTarea({ t, opciones }: { t: TareaVista; opciones: Opciones }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [historial, setHistorial] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)
  const [seguro, setSeguro] = useState(false)
  const accion = (f: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    iniciar(async () => {
      const r = await f()
      setMsg(r.ok ? { ok: true, texto: ok } : { ok: false, texto: r.error ?? 'No se pudo.' })
      router.refresh()
    })
  const ultima = t.corridas[0]
  return (
    <li className="border-b border-[var(--borde)] last:border-0" data-tarea={t.id}>
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <span className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', t.tipo === 'tablero' ? 'bg-sky-50 text-sky-700' : 'bg-acento-50 text-acento-700')} aria-hidden>
          {t.tipo === 'tablero' ? <LayoutDashboard className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-semibold text-marca-900">{t.nombre}</h3>
            {t.tipo === 'tablero' && <span className="insignia">Tablero vivo</span>}
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', t.estado === 'activa' ? 'bg-emerald-50 text-emerald-800' : 'bg-marca-100 text-marca-700')}>{t.estado === 'activa' ? 'Activa' : 'Pausada'}</span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-marca-600">
            {describirFrecuencia(t)} · {t.canales.map((c) => ETIQUETA_CANAL[c]).join(', ')}
            {t.destinatarios.length > 0 && ` · y ${t.destinatarios.length} ${t.destinatarios.length === 1 ? 'persona' : 'personas'} más`}
          </p>
          <p className="mt-0.5 text-[12px] text-marca-500">
            {t.estado === 'activa' ? <>Próxima: {t.proximaTexto}</> : <>{t.pausadaMotivo ?? 'Pausada.'}</>}
            {ultima && (
              <>
                {' · '}Última: {ultima.cuandoTexto}{' '}
                <span className={cn('ml-1 rounded px-1.5 py-px text-[11px] font-semibold', ESTADO_CORRIDA[ultima.estado].clase)}>{ESTADO_CORRIDA[ultima.estado].texto}</span>
              </>
            )}
            {t.fallas > 0 && t.estado === 'activa' && <span className="ml-1 text-amber-700">· {t.fallas} {t.fallas === 1 ? 'falla seguida' : 'fallas seguidas'}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className="btn-neutro h-8 gap-1 px-2.5 text-[12px]" disabled={pendiente} onClick={() => accion(() => correrAhora(t.id), 'Corriendo; te aviso al terminar.')}>
            <Zap className="h-3.5 w-3.5" aria-hidden /> Correr ahora
          </button>
          <button
            type="button"
            className="btn-neutro h-8 gap-1 px-2.5 text-[12px]"
            disabled={pendiente}
            onClick={() => accion(() => pausarTarea(t.id, t.estado === 'activa'), t.estado === 'activa' ? 'Pausada.' : 'Reanudada.')}
          >
            {t.estado === 'activa' ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            {t.estado === 'activa' ? 'Pausar' : 'Reanudar'}
          </button>
          <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => setEditando(!editando)}>
            {editando ? 'Cerrar' : 'Editar'}
          </button>
          <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => setHistorial(!historial)} aria-expanded={historial}>
            Historial ({t.corridas.length})
          </button>
          {seguro ? (
            <button type="button" className="btn-peligro h-8 gap-1 px-2.5 text-[12px]" disabled={pendiente} onClick={() => accion(() => borrarTarea(t.id), 'Borrada.')}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Confirmar
            </button>
          ) : (
            <button type="button" className="btn-neutro h-8 px-2 text-[12px]" aria-label={`Borrar «${t.nombre}»`} onClick={() => setSeguro(true)}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        {msg && <p className={cn('w-full text-[12px]', msg.ok ? 'text-emerald-700' : 'text-acento-700')}>{msg.texto}</p>}
      </div>
      {editando && (
        <div className="border-t border-[var(--borde)] bg-[#fafafa]">
          <FormTarea inicial={t} opciones={opciones} alTerminar={() => setEditando(false)} />
        </div>
      )}
      {historial && (
        <div className="border-t border-[var(--borde)] bg-[#fafafa] px-4 py-2">
          {t.corridas.length === 0 && <p className="py-2 text-[12px] text-marca-500">Todavía no ha corrido.</p>}
          <ul className="divide-y divide-[var(--borde)]">
            {t.corridas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
                <span className={cn('rounded px-1.5 py-px text-[11px] font-semibold', ESTADO_CORRIDA[c.estado].clase)}>{ESTADO_CORRIDA[c.estado].texto}</span>
                <span className="text-marca-700">{c.cuandoTexto}</span>
                {c.manual && <span className="text-[11px] text-marca-500">· a mano</span>}
                {c.intento > 1 && <span className="text-[11px] text-marca-500">· reintento</span>}
                {c.entregas.length > 0 && (
                  <span className="text-[11.5px] text-marca-500">
                    ·{' '}
                    {c.entregas
                      .map((e) => `${ETIQUETA_CANAL[e.canal]} ${e.a === 'todos' ? '' : `a ${e.a} `}${e.estado === 'enviada' ? '✓' : `(${e.estado})`}`)
                      .join(' · ')}
                  </span>
                )}
                {c.error && <span className="w-full text-[12px] text-acento-700">{c.error}</span>}
                {c.chatId && (
                  <Link href={`/sistema/asistente/c/${c.chatId}`} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-acento-700 hover:underline">
                    <Check className="h-3.5 w-3.5" aria-hidden /> Ver resultado
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  )
}

export function ListaTareas({ tareas, opciones }: { tareas: TareaVista[]; opciones: Opciones }) {
  if (!tareas.length)
    return (
      <section className="rounded-xl border border-dashed border-[var(--borde)] bg-white px-4 py-8 text-center text-[13px] text-marca-600">
        No tienes tareas programadas. Créalas aquí o pídeselo al asistente en el chat: «cada lunes a las 8 mándame el resumen de…».
      </section>
    )
  return (
    <section className="rounded-xl border border-[var(--borde)] bg-white">
      <ul>
        {tareas.map((t) => (
          <TarjetaTarea key={t.id} t={t} opciones={opciones} />
        ))}
      </ul>
    </section>
  )
}
