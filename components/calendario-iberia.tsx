'use client'

import { useActionState, useMemo, useState, type ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { actualizarActividad, type EstadoActualizacion } from '@/app/dashboard/calendario/acciones'
import {
  ESTADOS_ACTIVIDAD,
  FRENTE,
  FRENTES,
  MESES,
  MESES_CORTOS,
  TIPOS_ACTIVIDAD,
  VENTANA,
  dia,
  esHito,
  fechaCorta,
  rango,
  responsables,
  type Actividad,
  type EstadoActividad,
  type Frente,
} from '@/lib/calendario'
import { cn } from '@/lib/utils'

/**
 * La vista del calendario (`/dashboard/calendario`), adaptada del HTML que armó
 * Gabriel el 28 de octubre de 2026: lo de los próximos 14 días, los frentes en la
 * línea de tiempo y la agenda mes a mes, que se filtra por frente y por
 * responsable. Quien puede editar actualiza cada fila ahí mismo.
 */

const DESDE = dia(VENTANA.desde)
const LARGO = dia(VENTANA.hasta) - DESDE

/** Posición en la línea de tiempo, en porcentaje del ancho. */
function posicion(dias: number): number {
  return Math.max(0, Math.min(100, ((dias - DESDE) / LARGO) * 100))
}

/** El primero de cada mes de la ventana, de octubre de 2026 a octubre de 2027. */
const MESES_VENTANA = Array.from({ length: 13 }, (_, i) => {
  const anio = 2026 + Math.floor((9 + i) / 12)
  const mes = (9 + i) % 12
  return { anio, mes, iso: `${anio}-${String(mes + 1).padStart(2, '0')}-01` }
})

function EtiquetaEstado({ estado }: { estado: EstadoActividad }) {
  const e = ESTADOS_ACTIVIDAD[estado]
  return (
    <span className="insignia shrink-0 gap-1.5 bg-marca-50 text-marca-700">
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} />
      {e.nombre}
    </span>
  )
}

function Punto({ frente }: { frente: Frente }) {
  return (
    <span
      aria-hidden="true"
      className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
      style={{ background: FRENTE[frente]?.color }}
    />
  )
}

export function CalendarioIberia({
  actividades,
  hoy,
  puedeEditar,
}: {
  actividades: Actividad[]
  hoy: string
  puedeEditar: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <Proximos actividades={actividades} hoy={hoy} />
      <LineaDeTiempo actividades={actividades} hoy={hoy} />
      <Agenda actividades={actividades} puedeEditar={puedeEditar} />
    </div>
  )
}

// --- Próximos 14 días --------------------------------------------------------------

function Proximos({ actividades, hoy }: { actividades: Actividad[]; hoy: string }) {
  const t0 = dia(hoy)
  const t1 = t0 + 14
  const lista = actividades.filter(
    (a) => a.estado !== 'hecho' && dia(a.inicio) <= t1 && dia(a.fin ?? a.inicio) >= t0
  )

  return (
    <section className="tarjeta p-5" aria-labelledby="cal-proximos">
      <h2 id="cal-proximos" className="rotulo mb-3">
        Próximos 14 días
      </h2>
      {lista.length === 0 ? (
        <p className="text-sm text-marca-500">Nada pendiente en los próximos 14 días.</p>
      ) : (
        <ul className="divide-y divide-[var(--borde)]">
          {lista.map((a) => (
            <li key={a.id} className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[120px_1fr_auto] sm:items-start">
              <p className="text-xs font-medium text-marca-500 tabular-nums sm:pt-0.5">{rango(a)}</p>
              <div className="flex min-w-0 gap-2">
                <Punto frente={a.frente} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-marca-900">{a.titulo}</p>
                  <p className="text-xs text-marca-500">
                    {a.responsable}
                    {a.participantes ? ` · con ${a.participantes}` : ''}
                  </p>
                </div>
              </div>
              <div>
                <EtiquetaEstado estado={a.estado} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// --- La línea de tiempo --------------------------------------------------------------

/**
 * Las marcas de una actividad sobre su pista: una barra de inicio a fin, o un rombo
 * en la fecha de cierre si es entregable o hito. La usan la fila del frente —todas
 * sus actividades en una pista— y el detalle, una pista por actividad.
 */
function Marca({ actividad: a, color }: { actividad: Actividad; color: string }) {
  const desde = dia(a.inicio)
  const hasta = dia(a.fin ?? a.inicio)
  const titulo = `${a.titulo} · ${rango(a)}`
  if (esHito(a.tipo)) {
    return (
      <span
        title={titulo}
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] ring-2 ring-white"
        style={{ left: `${posicion(hasta)}%`, background: color }}
      />
    )
  }
  return (
    <span
      title={titulo}
      className="absolute top-1/2 h-3 -translate-y-1/2 rounded-full opacity-80"
      style={{
        left: `${posicion(desde)}%`,
        width: `${Math.max(0.8, posicion(hasta + 1) - posicion(desde))}%`,
        background: color,
      }}
    />
  )
}

/** El fondo de una pista: la división de los meses y la raya de hoy. */
function Pista({ alto, tHoy, children }: { alto: string; tHoy: number | null; children: ReactNode }) {
  return (
    <div className={cn('relative rounded-md bg-marca-50', alto)}>
      {MESES_VENTANA.slice(1).map((m) => (
        <span
          key={m.iso}
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-white"
          style={{ left: `${posicion(dia(m.iso))}%` }}
        />
      ))}
      {children}
      {tHoy !== null && (
        <span
          aria-hidden="true"
          className="absolute -inset-y-1 border-l-2 border-dashed border-acento-500"
          style={{ left: `${posicion(tHoy)}%` }}
        />
      )}
    </div>
  )
}

function LineaDeTiempo({ actividades, hoy }: { actividades: Actividad[]; hoy: string }) {
  const tHoy = dia(hoy)
  const hoyEnVentana = tHoy >= DESDE && tHoy < DESDE + LARGO ? tHoy : null
  // Los frentes abiertos: tocar uno lo despliega en una pista por actividad. Pueden
  // ir varios abiertos a la vez, para comparar dos frentes en el mismo mes.
  const [abiertos, setAbiertos] = useState<Set<Frente>>(new Set())
  const conActividades = FRENTES.filter((f) => actividades.some((a) => a.frente === f.clave))
  const todosAbiertos = conActividades.every((f) => abiertos.has(f.clave))

  const alternar = (f: Frente) =>
    setAbiertos((antes) => {
      const nuevo = new Set(antes)
      if (nuevo.has(f)) nuevo.delete(f)
      else nuevo.add(f)
      return nuevo
    })

  return (
    <section className="tarjeta p-5" aria-labelledby="cal-linea">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="cal-linea" className="rotulo">
          Los frentes en el tiempo
        </h2>
        <button
          type="button"
          className="text-xs font-medium text-acento-700 hover:underline"
          onClick={() => setAbiertos(todosAbiertos ? new Set() : new Set(conActividades.map((f) => f.clave)))}
        >
          {todosAbiertos ? 'Contraer todos' : 'Ver todos en detalle'}
        </button>
      </div>
      {/* En teléfono la línea se desliza de lado: a 360 px, trece meses no se leen. */}
      <div className="-mx-5 overflow-x-auto px-5">
        <div className="min-w-[820px]">
          <div className="grid grid-cols-[230px_1fr] items-end gap-3">
            <span />
            <div className="relative h-6 border-b border-[var(--borde)]">
              {MESES_VENTANA.map((m, i) => (
                <span
                  key={m.iso}
                  className="absolute bottom-1 text-[11px] text-marca-500"
                  style={{ left: `${posicion(dia(m.iso))}%` }}
                >
                  {MESES_CORTOS[m.mes]}
                  {i === 0 || m.mes === 0 ? ` ${String(m.anio).slice(2)}` : ''}
                </span>
              ))}
            </div>
          </div>

          {conActividades.map((f) => {
            const filas = actividades.filter((a) => a.frente === f.clave)
            const abierto = abiertos.has(f.clave)
            const idDetalle = `cal-frente-${f.clave}`
            return (
              <div key={f.clave} className={cn('rounded-lg', abierto && 'my-1 bg-marca-50/40 pb-2')}>
                <div className="grid grid-cols-[230px_1fr] items-center gap-3 py-1">
                  <button
                    type="button"
                    aria-expanded={abierto}
                    aria-controls={idDetalle}
                    onClick={() => alternar(f.clave)}
                    className="flex min-h-9 items-center gap-2 rounded-md px-1 text-left text-xs font-medium text-marca-700 hover:bg-marca-50"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 16 16"
                      className={cn('h-3.5 w-3.5 shrink-0 text-marca-400 transition-transform', abierto && 'rotate-90')}
                    >
                      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: f.color }} />
                    <span className={cn(abierto && 'font-semibold text-marca-900')}>{f.nombre}</span>
                    <span className="text-marca-400 tabular-nums">{filas.length}</span>
                  </button>
                  <Pista alto="h-7" tHoy={hoyEnVentana}>
                    {filas.map((a) => (
                      <Marca key={a.id} actividad={a} color={f.color} />
                    ))}
                  </Pista>
                </div>

                {abierto && (
                  <ul id={idDetalle} aria-label={`Actividades de ${f.nombre}`}>
                    {filas.map((a) => (
                      <li key={a.id} className="grid grid-cols-[230px_1fr] items-center gap-3 py-0.5">
                        <div className="min-w-0 pl-6">
                          <p className="truncate text-[11px] font-medium leading-tight text-marca-800" title={a.titulo}>
                            {a.titulo}
                          </p>
                          <p className="flex items-center gap-1.5 text-[10px] leading-tight text-marca-500 tabular-nums">
                            <span
                              aria-hidden="true"
                              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: ESTADOS_ACTIVIDAD[a.estado].color }}
                            />
                            {rango(a)} · {ESTADOS_ACTIVIDAD[a.estado].nombre}
                            {a.responsable ? ` · ${a.responsable}` : ''}
                          </p>
                        </div>
                        <Pista alto="h-5" tHoy={hoyEnVentana}>
                          <Marca actividad={a} color={f.color} />
                        </Pista>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-marca-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 border-l-2 border-dashed border-acento-500" /> Hoy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-marca-400" /> Entregable o hito
        </span>
        <span>Toca un frente para verlo actividad por actividad.</span>
      </p>
    </section>
  )
}

// --- La agenda mes a mes ---------------------------------------------------------------

function Agenda({ actividades, puedeEditar }: { actividades: Actividad[]; puedeEditar: boolean }) {
  const [frentes, setFrentes] = useState<Set<Frente>>(new Set())
  const [responsable, setResponsable] = useState('')
  const [ocultarHecho, setOcultarHecho] = useState(false)
  const nombres = useMemo(() => responsables(actividades), [actividades])

  const lista = actividades.filter(
    (a) =>
      (!frentes.size || frentes.has(a.frente)) &&
      (!responsable || a.responsable.includes(responsable) || a.participantes.includes(responsable)) &&
      (!ocultarHecho || a.estado !== 'hecho')
  )

  const meses = new Map<string, Actividad[]>()
  for (const a of lista) {
    const clave = a.inicio.slice(0, 7)
    meses.set(clave, [...(meses.get(clave) ?? []), a])
  }

  const alternar = (f: Frente) =>
    setFrentes((antes) => {
      const nuevo = new Set(antes)
      if (nuevo.has(f)) nuevo.delete(f)
      else nuevo.add(f)
      return nuevo
    })

  return (
    <section className="tarjeta p-5" aria-labelledby="cal-agenda">
      <h2 id="cal-agenda" className="rotulo mb-3">
        Agenda mes a mes
      </h2>

      <div className="flex flex-wrap gap-2">
        {FRENTES.map((f) => {
          const activo = frentes.has(f.clave)
          return (
            <button
              key={f.clave}
              type="button"
              aria-pressed={activo}
              onClick={() => alternar(f.clave)}
              className={cn(
                'flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors',
                activo
                  ? 'border-marca-800 bg-marca-800 text-white'
                  : 'border-[var(--borde)] bg-white text-marca-700 hover:bg-marca-50'
              )}
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: f.color }} />
              {f.nombre}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-marca-700">
        <label className="flex items-center gap-2">
          Responsable
          <select className="campo h-9 w-auto py-1" value={responsable} onChange={(e) => setResponsable(e.target.value)}>
            <option value="">Todos</option>
            {nombres.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={ocultarHecho} onChange={(e) => setOcultarHecho(e.target.checked)} />
          Ocultar lo hecho
        </label>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-marca-500">
          {Object.values(ESTADOS_ACTIVIDAD).map((e) => (
            <span key={e.nombre} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.nombre}
            </span>
          ))}
        </span>
      </div>

      {lista.length === 0 ? (
        <p className="mt-6 text-sm text-marca-500">Ninguna actividad coincide con los filtros.</p>
      ) : (
        [...meses].map(([clave, filas]) => (
          <div key={clave} className="mt-6">
            <div className="flex items-baseline justify-between border-b border-[var(--borde)] pb-2">
              <h3 className="text-base font-semibold text-marca-900 first-letter:uppercase">
                {MESES[+clave.slice(5, 7) - 1]} {clave.slice(0, 4)}
              </h3>
              <span className="text-xs text-marca-500">
                {filas.length} {filas.length === 1 ? 'actividad' : 'actividades'}
              </span>
            </div>
            <ul className="divide-y divide-[var(--borde)]">
              {filas.map((a) => (
                <FilaAgenda key={a.id} actividad={a} puedeEditar={puedeEditar} />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

function FilaAgenda({ actividad: a, puedeEditar }: { actividad: Actividad; puedeEditar: boolean }) {
  const [editando, setEditando] = useState(false)

  return (
    <li className="py-3">
      <div className="grid gap-x-4 gap-y-2 md:grid-cols-[120px_1fr_190px_150px]">
        <div className="text-xs text-marca-500 tabular-nums">
          <p className="font-medium">{rango(a)}</p>
          {a.fecha_confirmada && (
            <p className="mt-0.5 font-medium text-emerald-700">Confirmada: {fechaCorta(a.fecha_confirmada)}</p>
          )}
        </div>
        <div className="flex min-w-0 gap-2">
          <Punto frente={a.frente} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-marca-900">
              {a.titulo}
              {a.tipo !== 'actividad' && (
                <span
                  className={cn(
                    'insignia ml-2 align-middle',
                    esHito(a.tipo) ? 'bg-acento-50 text-acento-800' : 'bg-marca-100 text-marca-700'
                  )}
                >
                  {TIPOS_ACTIVIDAD[a.tipo]}
                </span>
              )}
            </p>
            {a.detalle && <p className="mt-1 text-sm text-marca-600">{a.detalle}</p>}
          </div>
        </div>
        <div className="text-sm">
          <p className="font-medium text-marca-800">{a.responsable || '—'}</p>
          {a.participantes && <p className="text-xs text-marca-500">{a.participantes}</p>}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <EtiquetaEstado estado={a.estado} />
          {a.nota && <p className="text-xs text-marca-500">{a.nota}</p>}
          {puedeEditar && !editando && (
            <button type="button" className="text-xs font-medium text-acento-700 hover:underline" onClick={() => setEditando(true)}>
              Actualizar
            </button>
          )}
        </div>
      </div>
      {puedeEditar && editando && <FormularioActividad actividad={a} alCerrar={() => setEditando(false)} />}
    </li>
  )
}

const INICIAL: EstadoActualizacion = {}

function BotonGuardar() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" className="btn-acento h-9 px-4" disabled={pending}>
      {pending ? 'Guardando…' : 'Guardar'}
    </button>
  )
}

function FormularioActividad({ actividad: a, alCerrar }: { actividad: Actividad; alCerrar: () => void }) {
  // Al guardar se cierra: la fila ya se pinta con lo nuevo, y el formulario abierto
  // seguiría mostrando los valores con los que se abrió.
  const [estado, accion] = useActionState(async (anterior: EstadoActualizacion, fd: FormData) => {
    const resultado = await actualizarActividad(anterior, fd)
    if (resultado.ok) alCerrar()
    return resultado
  }, INICIAL)

  return (
    <form action={accion} className="mt-3 grid gap-3 rounded-xl border border-[var(--borde)] bg-marca-50/50 p-3 md:ml-[136px] md:grid-cols-[170px_170px_1fr]">
      <input type="hidden" name="id" value={a.id} />
      <label className="text-xs font-medium text-marca-600">
        Estado
        <select name="estado" defaultValue={a.estado} className="campo mt-1 h-9 py-1">
          {Object.entries(ESTADOS_ACTIVIDAD).map(([clave, e]) => (
            <option key={clave} value={clave}>
              {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-marca-600">
        Fecha confirmada
        <input type="date" name="fecha_confirmada" defaultValue={a.fecha_confirmada ?? ''} className="campo mt-1 h-9 py-1" />
      </label>
      <label className="text-xs font-medium text-marca-600">
        Nota
        <input name="nota" defaultValue={a.nota} maxLength={500} placeholder="Ej.: Amanda lo confirmó con Martha" className="campo mt-1 h-9 py-1" />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <BotonGuardar />
        <button type="button" className="btn-neutro h-9 px-4" onClick={alCerrar}>
          Cerrar
        </button>
        {estado.error && <p className="text-xs font-medium text-acento-700">{estado.error}</p>}
      </div>
    </form>
  )
}
