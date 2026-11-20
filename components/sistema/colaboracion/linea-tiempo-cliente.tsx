'use client'

import { Fragment, useCallback, useEffect, useState, useTransition, type ReactNode } from 'react'
import { cargarLinea, comentar, editarComentario, ocultarComentario, seguir } from '@/components/sistema/colaboracion/acciones'
import { Compositor } from '@/components/sistema/colaboracion/compositor'
import { TareaRapida } from '@/components/sistema/colaboracion/tareas'
import { ACCION_APROBACION, NIVEL_IA, tieneLinea, type DatosLinea, type EntradaLinea, type Persona } from '@/lib/plataforma/colaboracion'
import { fechaHora, hace, hora, iniciales } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

/**
 * La línea de tiempo de un objeto, en el navegador: filtros, seguir, comentar
 * con @menciones, responder, corregir lo propio en 15 minutos, crear una tarea
 * sobre el objeto, y las entradas de la IA con su nivel (Anexo E §7). Lo nuevo
 * va arriba, con la caja de comentar a la vista.
 *
 * Con `inicial` pinta en el acto (lo trae `LineaTiempo`, del servidor); sin él
 * lo pide al montar (el panel lateral). Después de cada acción se vuelve a leer.
 */

type Filtro = 'todo' | 'comentarios' | 'cambios' | 'aprobaciones' | 'ia'

const FILTROS: { clave: Filtro; etiqueta: string; clases: EntradaLinea['clase'][] }[] = [
  { clave: 'todo', etiqueta: 'Todo', clases: ['comentario', 'aprobacion', 'ia', 'sistema', 'cambio'] },
  { clave: 'comentarios', etiqueta: 'Comentarios', clases: ['comentario'] },
  { clave: 'aprobaciones', etiqueta: 'Aprobaciones', clases: ['aprobacion'] },
  { clave: 'cambios', etiqueta: 'Cambios', clases: ['cambio', 'sistema'] },
  { clave: 'ia', etiqueta: 'IA', clases: ['ia'] },
]

export function LineaTiempoCliente({ tipo, id, inicial }: { tipo: string; id: string; inicial?: DatosLinea | null }) {
  const [datos, setDatos] = useState<DatosLinea | null | undefined>(inicial)
  const [filtro, setFiltro] = useState<Filtro>('todo')
  const [tarea, setTarea] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, iniciar] = useTransition()
  // El reloj de la ventana de 15 minutos: se lee fuera del render.
  const [ahora, setAhora] = useState<number | null>(null)

  const refrescar = useCallback(() => {
    iniciar(async () => {
      const r = await cargarLinea(tipo, id).catch(() => null)
      setDatos(r)
    })
  }, [tipo, id])

  // Sin datos del servidor (el panel), o al cambiar de objeto, se pide.
  const [llave, setLlave] = useState(`${tipo}:${id}`)
  if (llave !== `${tipo}:${id}`) {
    setLlave(`${tipo}:${id}`)
    setDatos(undefined)
  }
  useEffect(() => {
    if (datos === undefined && tieneLinea(tipo)) refrescar()
  }, [datos, tipo, refrescar])

  // La ventana de 15 minutos se descuenta sola.
  const conVentana = Boolean(datos?.entradas.some((e) => e.clase === 'comentario' && (e.editableHasta || e.respuestas.some((r) => r.clase === 'comentario' && r.editableHasta))))
  useEffect(() => {
    const tic = () => setAhora(Date.now())
    const primero = setTimeout(tic, 0)
    const t = conVentana ? setInterval(tic, 30_000) : undefined
    return () => {
      clearTimeout(primero)
      if (t) clearInterval(t)
    }
  }, [conVentana, datos])

  if (!tieneLinea(tipo)) return <p className="py-4 text-center text-marca-400">Este tipo de objeto no tiene línea de tiempo.</p>
  if (datos === undefined) return <EsqueletoLinea />
  if (datos === null) return <p className="py-4 text-center text-marca-400">La línea de tiempo de este objeto no está a tu alcance.</p>

  const visibles = datos.entradas.filter((e) => FILTROS.find((f) => f.clave === filtro)!.clases.includes(e.clase))
  const cuenta = (f: (typeof FILTROS)[number]) => datos.entradas.filter((e) => f.clases.includes(e.clase)).length

  async function mandar(texto: string, menciones: string[], padre?: string) {
    const r = await comentar({ tipo, id, texto, menciones, padre })
    if (r.error) return r.error
    refrescar()
    return null
  }

  function accion(p: Promise<{ error?: string }>) {
    setError(null)
    iniciar(async () => {
      const r = await p
      if (r.error) setError(r.error)
      const nuevo = await cargarLinea(tipo, id).catch(() => null)
      setDatos(nuevo)
    })
  }

  return (
    <div className={cn('flex flex-col gap-3 transition-opacity', cargando && 'opacity-70')} aria-busy={cargando}>
      <div className="flex flex-wrap items-center gap-1.5">
        <div role="group" aria-label="Qué mostrar" className="flex flex-wrap gap-1">
          {FILTROS.filter((f) => f.clave !== 'ia' || cuenta(f) > 0).map((f) => (
            <button
              key={f.clave}
              type="button"
              aria-pressed={filtro === f.clave}
              onClick={() => setFiltro(f.clave)}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11.5px] focus-visible:outline-2 focus-visible:outline-acento-500',
                filtro === f.clave ? 'border-[#2b2a28] bg-[#2b2a28] font-semibold text-white' : 'border-[var(--borde)] bg-white text-marca-600 hover:bg-marca-50'
              )}
            >
              {f.etiqueta}
              <span className={cn('text-[10px]', filtro === f.clave ? 'text-white/80' : 'text-marca-400')}>{cuenta(f)}</span>
            </button>
          ))}
        </div>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setTarea((v) => !v)}
          aria-expanded={tarea}
          className="inline-flex h-7 items-center rounded-lg border border-[var(--borde)] px-2 text-[11.5px] text-marca-700 hover:bg-marca-50"
        >
          ☐ Tarea
        </button>
        <button
          type="button"
          aria-pressed={datos.siguiendo}
          onClick={() => accion(seguir(tipo, id, !datos.siguiendo))}
          title={datos.siguiendo ? 'Te avisamos de cada novedad. Toca para dejar de seguir.' : 'Recibe un aviso con cada comentario o decisión sobre este objeto.'}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[11.5px] focus-visible:outline-2 focus-visible:outline-acento-500',
            datos.siguiendo ? 'border-[#2f5f9a] bg-[#eaf2fb] font-semibold text-[#2f5f9a]' : 'border-[var(--borde)] text-marca-700 hover:bg-marca-50'
          )}
        >
          {datos.siguiendo ? '◉ Siguiendo' : '○ Seguir'}
        </button>
      </div>

      {tarea && <TareaRapida objeto={{ tipo, id }} yo={datos.yo} alCancelar={() => setTarea(false)} />}

      <Compositor tipo={tipo} id={id} alMandar={(t, m) => mandar(t, m)} />

      {error && (
        <p role="alert" className="text-[12px] text-acento-700">
          {error}
        </p>
      )}

      {!visibles.length ? (
        <p className="py-4 text-center text-marca-400">
          {filtro === 'todo' ? 'Todavía no hay nada en la línea de tiempo. El primer comentario lo puedes dejar tú.' : 'Nada de este tipo todavía.'}
        </p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Línea de tiempo">
          {visibles.map((e) => (
            <li key={e.id}>
              <Entrada e={e} tipo={tipo} id={id} ahora={ahora} alResponder={mandar} accion={accion} />
            </li>
          ))}
        </ol>
      )}
      {datos.masCambios && filtro !== 'comentarios' && filtro !== 'aprobaciones' && (
        <p className="text-center text-[11.5px] text-marca-400">Se muestran los últimos 60 cambios. El historial completo está en Administración › Auditoría.</p>
      )}
    </div>
  )
}

function EsqueletoLinea() {
  return (
    <div className="flex flex-col gap-3" aria-label="Cargando la línea de tiempo" role="status">
      <div className="h-7 w-2/3 animate-pulse rounded-full bg-[#eef0f3]" />
      <div className="h-20 animate-pulse rounded-lg bg-[#f3f4f6]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-2">
          <div className="h-7 w-7 animate-pulse rounded-full bg-[#eef0f3]" />
          <div className="h-10 flex-1 animate-pulse rounded-lg bg-[#f3f4f6]" />
        </div>
      ))}
    </div>
  )
}

function Cuando({ en }: { en: string }) {
  return (
    <time dateTime={en} title={fechaHora(en)} suppressHydrationWarning className="text-[11px] text-marca-400">
      {hace(en)}
    </time>
  )
}

function Avatar({ children, clase }: { children: ReactNode; clase?: string }) {
  return (
    <span aria-hidden className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eef0f3] text-[10.5px] font-bold text-marca-700', clase)}>
      {children}
    </span>
  )
}

/** El texto con las menciones resaltadas (fondo + «@», no solo color). */
function ConMenciones({ texto, menciones }: { texto: string; menciones: Persona[] }) {
  const nombres = [...new Set(menciones.map((m) => m.nombre))].sort((a, b) => b.length - a.length)
  if (!nombres.length) return <>{texto}</>
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const partes = texto.split(new RegExp(`(@(?:${nombres.map(escapar).join('|')}))`, 'g'))
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('@') && nombres.includes(p.slice(1)) ? (
          <span key={i} className="rounded bg-[#eaf2fb] px-0.5 font-medium text-[#2f5f9a]">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </>
  )
}

function Entrada({
  e,
  tipo,
  id,
  ahora,
  alResponder,
  accion,
  respuesta = false,
}: {
  e: EntradaLinea
  tipo: string
  id: string
  ahora: number | null
  alResponder: (texto: string, menciones: string[], padre?: string) => Promise<string | null>
  accion: (p: Promise<{ error?: string }>) => void
  respuesta?: boolean
}) {
  const [respondiendo, setRespondiendo] = useState(false)
  const [editando, setEditando] = useState(false)

  if (e.clase === 'comentario') {
    const minutos = e.editableHasta && ahora ? Math.max(0, Math.ceil((new Date(e.editableHasta).getTime() - ahora) / 60_000)) : 0
    const editable = e.mio && minutos > 0
    return (
      <div className="flex gap-2">
        <Avatar>{iniciales(e.autor?.nombre)}</Avatar>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="font-semibold text-marca-900">{e.autor?.nombre ?? 'Alguien'}</span>
            <Cuando en={e.en} />
            {e.editadoEn && !e.oculto && (
              <span className="text-[11px] text-marca-400" title={`Editado ${fechaHora(e.editadoEn)}`}>
                · editado
              </span>
            )}
          </p>
          {editando ? (
            <div className="mt-1">
              <Compositor
                tipo={tipo}
                id={id}
                inicial={e.texto}
                autoFoco
                compacto
                etiqueta="Guardar"
                alCancelar={() => setEditando(false)}
                alMandar={async (t) => {
                  const r = await editarComentario(e.id, t)
                  if (r.error) return r.error
                  setEditando(false)
                  accion(Promise.resolve({}))
                }}
              />
            </div>
          ) : e.oculto ? (
            <p className="mt-0.5 rounded-md border border-dashed border-[var(--borde)] px-2 py-1 text-[12px] text-marca-500 italic">
              Ocultaste este comentario: solo tú lo ves. <span className="line-through">{e.texto}</span>
            </p>
          ) : (
            <p className="mt-0.5 break-words whitespace-pre-wrap text-marca-800">
              <ConMenciones texto={e.texto} menciones={e.menciones} />
            </p>
          )}
          {!editando && (
            <p className="mt-1 flex flex-wrap gap-x-3 text-[11.5px]">
              {!respuesta && !e.oculto && (
                <button type="button" onClick={() => setRespondiendo((v) => !v)} aria-expanded={respondiendo} className="text-marca-500 hover:text-marca-900">
                  Responder
                </button>
              )}
              {editable && !e.oculto && (
                <button type="button" onClick={() => setEditando(true)} className="text-marca-500 hover:text-marca-900">
                  Editar
                </button>
              )}
              {editable && (
                <button type="button" onClick={() => accion(ocultarComentario(e.id, !e.oculto))} className="text-marca-500 hover:text-marca-900">
                  {e.oculto ? 'Mostrar de nuevo' : 'Ocultar'}
                </button>
              )}
              {editable && <span className="text-marca-400">quedan {minutos} min para corregir</span>}
            </p>
          )}
          {(e.respuestas.length > 0 || respondiendo) && (
            <div className="mt-2 flex flex-col gap-2.5 border-l-2 border-[var(--borde)] pl-3">
              {e.respuestas.map((r) => (
                <Entrada key={r.id} e={r} tipo={tipo} id={id} ahora={ahora} alResponder={alResponder} accion={accion} respuesta />
              ))}
              {respondiendo && (
                <Compositor
                  tipo={tipo}
                  id={id}
                  autoFoco
                  compacto
                  etiqueta="Responder"
                  placeholder={`Responde a ${e.autor?.nombre ?? 'este comentario'}…`}
                  alCancelar={() => setRespondiendo(false)}
                  alMandar={async (t, m) => {
                    const r = await alResponder(t, m, e.id)
                    if (!r) setRespondiendo(false)
                    return r
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (e.clase === 'aprobacion') {
    const a = ACCION_APROBACION[e.accion] ?? { texto: e.accion, marca: '·', clase: 'bg-[#eef0f3] text-marca-600' }
    return (
      <div className="flex gap-2">
        <Avatar clase={a.clase}>{a.marca}</Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-marca-800">
            <span className="font-semibold text-marca-900">{e.autor?.nombre ?? 'El sistema'}</span> {a.texto}
            {e.paso ? <> «{e.paso}»</> : null} <Cuando en={e.en} />
          </p>
          {e.titulo && <p className="text-[11.5px] text-marca-500">{e.titulo}</p>}
          {e.texto && <p className="mt-1 rounded-lg border border-[var(--borde)] bg-[#fafbfc] px-2.5 py-1.5 text-[12.5px] text-marca-800">«{e.texto}»</p>}
        </div>
      </div>
    )
  }

  if (e.clase === 'ia') {
    const n = NIVEL_IA[e.nivel]
    const reversible = e.nivel === 'N4' && e.deshacerHasta && ahora !== null && new Date(e.deshacerHasta).getTime() > ahora
    return (
      <div className={cn('rounded-lg p-2.5', n.tarjeta)}>
        <p className="flex flex-wrap items-center gap-1.5">
          <Avatar clase="h-6 w-6 bg-[#f1edfa] text-[#5a3f9e]">✦</Avatar>
          <span className="font-semibold text-marca-900">IA · {e.capacidad}</span>
          <span className={cn('inline-flex items-center rounded-md px-1.5 py-px text-[10.5px] font-bold', n.insignia)}>{n.etiqueta}</span>
          <Cuando en={e.en} />
        </p>
        <p className="mt-0.5 text-[11px] text-marca-500">{n.leyenda}</p>
        {e.texto && <p className="mt-1 break-words text-marca-800">{e.texto}</p>}
        {e.evidencia &&
          (e.nivel === 'N2' ? (
            <p className="mt-1 text-[12px] text-marca-600">
              <span className="font-semibold">Evidencia:</span> {e.evidencia}
            </p>
          ) : (
            <details className="mt-1 text-[12px] text-marca-600">
              <summary className="cursor-pointer">Ver evidencia</summary>
              <p className="mt-0.5">{e.evidencia}</p>
            </details>
          ))}
        {e.nivel === 'N3' && <p className="mt-1 text-[12px] text-marca-600">{e.decididoPor ? `Decidió: ${e.decididoPor}` : 'Espera la decisión de una persona.'}</p>}
        {e.nivel === 'N4' && (
          <p className="mt-1 text-[12px] text-marca-600">
            {reversible ? `Se puede deshacer hasta las ${hora(e.deshacerHasta)} desde la actividad de la IA.` : 'Quedó registrado en la actividad de la IA.'}
          </p>
        )}
      </div>
    )
  }

  if (e.clase === 'cambio') {
    return (
      <div className="flex gap-2">
        <Avatar clase="bg-white border border-[var(--borde)] text-marca-500">✎</Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-marca-800">
            <span className="font-semibold text-marca-900">{e.autor?.nombre ?? 'El sistema'}</span> · {e.titulo} <Cuando en={e.en} />
          </p>
          {e.cambios.length > 0 && (
            <dl className="mt-1 grid grid-cols-[minmax(6rem,30%)_1fr] gap-x-2 gap-y-0.5 text-[12px]">
              {e.cambios.slice(0, 8).map((c) => (
                <div key={c.campo} className="contents">
                  <dt className="text-marca-500">{c.etiqueta}</dt>
                  <dd className="min-w-0 break-words text-marca-800">
                    {c.antes === c.despues ? (
                      <span>actualizado</span>
                    ) : (
                      <>
                        <span className="text-marca-400 line-through">{c.antes}</span> <span aria-label="cambió a">→</span> <span>{c.despues}</span>
                      </>
                    )}
                  </dd>
                </div>
              ))}
              {e.cambios.length > 8 && <p className="col-span-2 text-marca-400">y {e.cambios.length - 8} campos más</p>}
            </dl>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Avatar>⚙</Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-marca-700">
          <span className="font-semibold text-marca-900">{e.autor?.nombre ?? 'Sistema'}</span> {e.texto ?? ''} <Cuando en={e.en} />
        </p>
      </div>
    </div>
  )
}
