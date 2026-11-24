'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type ReactNode } from 'react'
import { ejecutarAccionFicha } from '@/components/sistema/ui/ficha-acciones'
import { ArchivosFicha } from '@/components/sistema/ui/archivos-ficha'
import { useContextoUrl } from '@/components/sistema/shell/contexto-url'
import { TONO_CHIP, type AccionFicha, type BloqueFicha, type DatoFicha, type ResultadoAccionFicha } from '@/lib/plataforma/ficha-tipos'
import { fechaHora, hoyCaracas } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'
import { avisarPropuesto } from '@/components/sistema/shell/mis-cambios'

/** El comienzo del mensaje de `proponer` (lib/plataforma/cambios.ts, que es solo de servidor). */
const AVISO_PROPUESTO = 'Quedó en tus cambios por aprobar'

/**
 * Lo editable de `FichaObjeto`: los campos que se cambian en la ficha (con su
 * «rige desde»), los botones de acción (con motivo, fecha o confirmación) y los
 * bloques de las pestañas propias de cada tipo. Todo pasa por
 * `ejecutarAccionFicha`: el servidor pide el permiso y la base decide.
 */

type AlTerminar = (r: ResultadoAccionFicha) => void

const CTL = 'h-8 w-full rounded-md border border-[var(--borde)] bg-white px-2 text-[13px] text-marca-900 outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-100'
const BTN = 'inline-flex h-8 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-acento-500 disabled:opacity-60'
const TONO_BTN = {
  principal: 'bg-[#2b2a28] text-white hover:bg-marca-700',
  neutro: 'border border-[var(--borde)] bg-white text-marca-800 hover:bg-marca-50',
  peligro: 'border border-acento-300 bg-white text-acento-700 hover:bg-acento-50',
} as const

/** Lo que hacen todos al terminar: refrescar la página, avisar a la ficha y, si toca, ir a otra. */
export function useTerminar(fichaValor: string, alCambiar?: () => void): AlTerminar {
  const router = useRouter()
  const { fijar } = useContextoUrl()
  return (r) => {
    if (r.error) return
    if (r.ok?.startsWith(AVISO_PROPUESTO)) avisarPropuesto(r.ok)
    if (r.href) {
      router.push(r.href)
      return
    }
    if (r.ficha !== undefined && r.ficha !== fichaValor) fijar({ ficha: r.ficha })
    router.refresh()
    alCambiar?.()
  }
}

function Mensaje({ r }: { r: ResultadoAccionFicha | null }) {
  if (!r) return null
  if (r.error)
    return (
      <p role="alert" className="mt-1.5 rounded-md bg-[#fbeceb] px-2 py-1 text-[12px] text-[#a3241f]">
        {r.error}
      </p>
    )
  return (
    <p role="status" className="mt-1.5 rounded-md bg-[#e7f5ee] px-2 py-1 text-[12px] text-[#1f6f4b]">
      ✓ {r.ok}
      {r.aviso && <span className="mt-0.5 block text-[#8a5a12]">⚠ {r.aviso}</span>}
    </p>
  )
}

/** Una fila de «Datos»: el valor y, si se edita, el lápiz que abre el campo. */
export function FilaDato({ d, fichaValor, alCambiar }: { d: DatoFicha; fichaValor: string; alCambiar?: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const e = d.editar
  return (
    <div className="contents">
      <dt className="pt-0.5 text-marca-400">{d.etiqueta}</dt>
      <dd className={cn('min-w-0 break-words text-marca-800', d.mono && 'font-mono text-[12px]')}>
        {!abierto ? (
          <span className="flex items-start gap-1.5">
            <span className="min-w-0 flex-1 whitespace-pre-line">{d.valor}</span>
            {e && (
              <button
                type="button"
                onClick={() => setAbierto(true)}
                className="shrink-0 rounded px-1.5 text-[11px] font-semibold text-marca-500 underline decoration-dotted underline-offset-2 hover:text-marca-900 focus-visible:outline-2 focus-visible:outline-acento-500"
                aria-label={`Editar ${d.etiqueta}`}
              >
                Editar
              </button>
            )}
          </span>
        ) : (
          e && <EditorCampo etiqueta={d.etiqueta} e={e} fichaValor={fichaValor} alCerrar={() => setAbierto(false)} alCambiar={alCambiar} />
        )}
      </dd>
    </div>
  )
}

function EditorCampo({
  etiqueta,
  e,
  fichaValor,
  alCerrar,
  alCambiar,
}: {
  etiqueta: string
  e: NonNullable<DatoFicha['editar']>
  fichaValor: string
  alCerrar: () => void
  alCambiar?: () => void
}) {
  const hoy = hoyCaracas()
  const [valor, setValor] = useState(e.valor)
  const [fecha, setFecha] = useState(hoy)
  const [r, setR] = useState<ResultadoAccionFicha | null>(null)
  const [pendiente, iniciar] = useTransition()
  const terminar = useTerminar(fichaValor, alCambiar)
  const guardar = () =>
    iniciar(async () => {
      const res = await ejecutarAccionFicha(fichaValor, e.accion, { valor, fecha: e.conFecha ? fecha : undefined }).catch(() => ({ error: 'No se pudo guardar.' }))
      setR(res)
      if (!res.error) {
        terminar(res)
        alCerrar()
      }
    })
  const id = `campo-${e.accion}`
  return (
    <form
      className="flex flex-col gap-1.5 rounded-lg border border-[var(--borde)] bg-[#fafafa] p-2"
      onSubmit={(ev) => {
        ev.preventDefault()
        guardar()
      }}
    >
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      {e.control === 'opciones' ? (
        <select id={id} className={CTL} value={valor} onChange={(x) => setValor(x.target.value)} autoFocus>
          {(e.opciones ?? []).map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      ) : e.control === 'textoLargo' ? (
        <textarea id={id} className={cn(CTL, 'h-20 py-1')} value={valor} onChange={(x) => setValor(x.target.value)} autoFocus />
      ) : (
        <input
          id={id}
          className={CTL}
          value={valor}
          onChange={(x) => setValor(x.target.value)}
          autoFocus
          type={e.control === 'fecha' ? 'date' : 'text'}
          inputMode={e.control === 'entero' ? 'numeric' : e.control === 'numero' ? 'decimal' : undefined}
        />
      )}
      {e.conFecha && (
        <label className="flex items-center gap-2 text-[12px] text-marca-600">
          Rige desde
          <input type="date" min={hoy} value={fecha} onChange={(x) => setFecha(x.target.value)} className={cn(CTL, 'w-auto')} />
        </label>
      )}
      {e.ayuda && <p className="text-[11.5px] text-marca-500">{e.ayuda}</p>}
      <span className="flex gap-1.5">
        <button type="submit" disabled={pendiente} className={cn(BTN, TONO_BTN.principal)}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={alCerrar} className={cn(BTN, TONO_BTN.neutro)}>
          Cancelar
        </button>
      </span>
      <Mensaje r={r} />
    </form>
  )
}

/** Un botón de la ficha. Si pide motivo, fecha o confirmación, se abre un formulario corto. */
export function BotonAccion({ a, fichaValor, alCambiar }: { a: AccionFicha; fichaValor: string; alCambiar?: () => void }) {
  const hoy = hoyCaracas()
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [r, setR] = useState<ResultadoAccionFicha | null>(null)
  const [pendiente, iniciar] = useTransition()
  const terminar = useTerminar(fichaValor, alCambiar)
  const tono = TONO_BTN[a.tono ?? 'neutro']

  if (a.href)
    return (
      <Link href={a.href} className={cn(BTN, tono)}>
        {a.etiqueta}
      </Link>
    )
  const pide = Boolean(a.motivo || a.conFecha || a.confirmar)
  const ejecutar = () =>
    iniciar(async () => {
      if (a.motivo === 'obligatorio' && motivo.trim().length < 3) {
        setR({ error: `Escribe ${(a.rotuloMotivo ?? 'el motivo').toLowerCase()}.` })
        return
      }
      const res = await ejecutarAccionFicha(fichaValor, a.accion ?? '', { motivo, fecha: a.conFecha ? fecha : undefined, param: a.param }).catch(() => ({
        error: 'No se pudo completar la acción.',
      }))
      setR(res)
      if (!res.error) {
        setAbierto(false)
        terminar(res)
      }
    })

  return (
    <span className={cn('inline-flex flex-col', abierto && 'w-full')}>
      {!abierto ? (
        <button type="button" disabled={pendiente} onClick={() => (pide ? setAbierto(true) : ejecutar())} className={cn(BTN, tono)}>
          {pendiente ? 'Un momento…' : a.etiqueta}
        </button>
      ) : (
        <span className="flex w-full flex-col gap-1.5 rounded-lg border border-[var(--borde)] bg-[#fafafa] p-2">
          <span className="text-[12px] font-semibold text-marca-800">{a.etiqueta}</span>
          {a.confirmar && <span className="text-[12px] text-marca-600">{a.confirmar}</span>}
          {a.motivo && (
            <label className="flex flex-col gap-0.5 text-[12px] text-marca-600">
              {a.rotuloMotivo ?? 'Motivo'}
              {a.motivo === 'opcional' ? ' (opcional)' : ''}
              <textarea value={motivo} onChange={(x) => setMotivo(x.target.value)} className={cn(CTL, 'h-16 py-1')} autoFocus />
            </label>
          )}
          {a.conFecha && (
            <label className="flex items-center gap-2 text-[12px] text-marca-600">
              {a.rotuloFecha ?? 'Rige desde'}
              <input type="date" min={hoy} value={fecha} onChange={(x) => setFecha(x.target.value)} className={cn(CTL, 'w-auto')} />
            </label>
          )}
          <span className="flex gap-1.5">
            <button type="button" disabled={pendiente} onClick={ejecutar} className={cn(BTN, tono)}>
              {pendiente ? 'Un momento…' : 'Confirmar'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className={cn(BTN, TONO_BTN.neutro)}>
              Cancelar
            </button>
          </span>
        </span>
      )}
      <Mensaje r={r} />
    </span>
  )
}

export function FilaAcciones({ acciones, fichaValor, alCambiar }: { acciones: AccionFicha[]; fichaValor: string; alCambiar?: () => void }) {
  if (!acciones.length) return null
  return (
    <div className="flex flex-wrap items-start gap-1.5">
      {acciones.map((a, i) => (
        <BotonAccion key={`${a.accion ?? a.href}-${a.param ?? ''}-${i}`} a={a} fichaValor={fichaValor} alCambiar={alCambiar} />
      ))}
    </div>
  )
}

function Titulo({ children }: { children: ReactNode }) {
  return <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-marca-400 uppercase">{children}</h3>
}

/** Los bloques de una pestaña propia del tipo. */
export function BloquesFicha({
  bloques,
  fichaValor,
  alCambiar,
  abrirFicha,
  hrefFicha,
}: {
  bloques: BloqueFicha[]
  fichaValor: string
  alCambiar?: () => void
  abrirFicha?: (valor: string) => void
  hrefFicha: (valor: string) => string
}) {
  return (
    <div className="flex flex-col gap-4">
      {bloques.map((b, i) => (
        <section key={i}>
          {'titulo' in b && b.titulo && <Titulo>{b.titulo}</Titulo>}
          {b.tipo === 'datos' && (
            <dl className="grid grid-cols-[minmax(7rem,35%)_1fr] gap-x-3 gap-y-1.5">
              {b.filas.map((d) => (
                <FilaDato key={d.etiqueta} d={d} fichaValor={fichaValor} alCambiar={alCambiar} />
              ))}
            </dl>
          )}
          {b.tipo === 'texto' && (
            <p className={cn('rounded-lg px-2.5 py-2 text-[12.5px] whitespace-pre-line', b.tono ? TONO_CHIP[b.tono] : 'bg-[#f6f7f9] text-marca-700')}>{b.texto}</p>
          )}
          {b.tipo === 'cifras' && (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                {b.cifras.map((c) => (
                  <div key={c.etiqueta} className="rounded-lg border border-[var(--borde)] px-2.5 py-1.5">
                    <p className="text-[11px] text-marca-500">{c.etiqueta}</p>
                    <p className={cn('text-[15px] font-bold text-marca-900 tabular-nums', c.tono && c.tono !== 'neutro' && 'text-[#8a5a12]', c.tono === 'rojo' && 'text-[#a3241f]', c.tono === 'verde' && 'text-[#1f6f4b]')}>
                      {c.valor}
                    </p>
                    {c.detalle && <p className="text-[11px] text-marca-400">{c.detalle}</p>}
                  </div>
                ))}
              </div>
              {b.sello && <p className="mt-1 text-[10.5px] text-marca-400">{b.sello}</p>}
            </>
          )}
          {b.tipo === 'archivos' && <ArchivosFicha archivos={b.archivos} vacio={b.vacio} />}
          {b.tipo === 'lista' &&
            (b.items.length ? (
              <ul className="flex flex-col gap-1">
                {b.items.map((r, j) => {
                  const cuerpo = (
                    <>
                      <span className="w-24 shrink-0 text-[10px] tracking-[0.06em] text-marca-400 uppercase">{r.tipo}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-marca-900">{r.titulo}</span>
                        {r.detalle && <span className="block truncate text-[11.5px] text-marca-500">{r.detalle}</span>}
                      </span>
                    </>
                  )
                  const clase = 'flex w-full items-center gap-2 rounded-lg border border-[var(--borde)] px-2.5 py-1.5 text-left hover:bg-marca-50'
                  return (
                    <li key={j}>
                      {r.ficha && abrirFicha ? (
                        <button type="button" className={clase} onClick={() => abrirFicha(r.ficha!)}>
                          {cuerpo}
                        </button>
                      ) : r.ficha ? (
                        <Link className={clase} href={hrefFicha(r.ficha)}>
                          {cuerpo}
                        </Link>
                      ) : r.href ? (
                        <Link className={clase} href={r.href}>
                          {cuerpo}
                        </Link>
                      ) : (
                        <div className={clase}>{cuerpo}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="py-2 text-center text-marca-400">{b.vacio ?? 'Nada que mostrar.'}</p>
            ))}
          {b.tipo === 'pasos' && (
            <ol className="ml-1 border-l-2 border-[var(--borde)] pl-3">
              {b.pasos.map((p) => (
                <li key={p.orden} className="relative mb-3">
                  <span className="absolute top-1 -left-[19px] grid h-3.5 w-3.5 place-items-center rounded-full bg-white text-[8px] ring-2 ring-[var(--borde)]" aria-hidden>
                    {p.orden}
                  </span>
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-marca-900">{p.nombre}</span>
                    <span className={cn('rounded-full px-1.5 py-px text-[10.5px] font-semibold', TONO_CHIP[p.tono])}>{p.estado}</span>
                  </p>
                  {p.quien && <p className="text-[12px] text-marca-600">{p.quien}</p>}
                  {p.en && <p className="text-[11.5px] text-marca-400">{fechaHora(p.en)}</p>}
                  {p.comentario && <p className="mt-0.5 rounded bg-[#f6f7f9] px-2 py-1 text-[12px] text-marca-700">«{p.comentario}»</p>}
                  {p.nota && <p className="text-[11.5px] text-marca-500">{p.nota}</p>}
                  {p.acciones?.length ? (
                    <div className="mt-1.5">
                      <FilaAcciones acciones={p.acciones} fichaValor={fichaValor} alCambiar={alCambiar} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {b.tipo === 'acciones' && <FilaAcciones acciones={b.acciones} fichaValor={fichaValor} alCambiar={alCambiar} />}
        </section>
      ))}
    </div>
  )
}

/** La pestaña IA mientras no haya capacidades encendidas: qué significa cada nivel cuando las haya. */
export function LeyendaIa() {
  const niveles = [
    { n: 'N1', nombre: 'Asistencia', como: 'Borde punteado y «Generado con IA · verifícalo»', clase: 'border border-dashed border-marca-300 text-marca-600' },
    { n: 'N2', nombre: 'Recomendación', como: 'Insignia azul y su evidencia a la vista', clase: 'bg-[#eaf2fb] text-[#2f5f9a]' },
    { n: 'N3', nombre: 'Requiere aprobación', como: 'Insignia ámbar: aprobar, editar o rechazar; queda quién decidió', clase: 'bg-[#fdf4e3] text-[#8a5a12]' },
    { n: 'N4', nombre: 'Automático', como: 'Insignia gris, con deshacer y registro obligatorio', clase: 'bg-[#eef0f3] text-marca-600' },
  ]
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-[#e6dff7] bg-gradient-to-b from-white to-[#fbf8ff] p-3">
        <p className="font-semibold text-[#5a3f9e]">Sin capacidades encendidas</p>
        <p className="mt-1 text-marca-600">
          La IA de este módulo todavía no está encendida. Cuando lo esté, sus propuestas sobre este objeto saldrán aquí con su nivel y su evidencia, y la
          decisión será siempre de una persona.
        </p>
      </div>
      <div>
        <Titulo>Cómo se verá cada nivel</Titulo>
        <ul className="flex flex-col gap-1.5">
          {niveles.map((x) => (
            <li key={x.n} className="flex items-start gap-2">
              <span className={cn('shrink-0 rounded-full px-1.5 py-px font-mono text-[10.5px] font-semibold', x.clase)}>{x.n}</span>
              <span className="text-[12px] text-marca-700">
                <strong className="font-semibold">{x.nombre}.</strong> {x.como}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
