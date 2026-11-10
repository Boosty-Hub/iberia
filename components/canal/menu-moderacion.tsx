'use client'

import { useRef, useState, useTransition } from 'react'
import {
  IconoAtras,
  IconoBandera,
  IconoBloquear,
  IconoCerrar,
  IconoCheck,
  IconoOpciones,
} from '@/components/iconos'
import {
  bloquearPersona,
  desbloquearPersona,
  reportarContenido,
} from '@/app/canal/(dentro)/moderacion/acciones'
import {
  ESTE_CONTENIDO,
  LARGO_DETALLE_REPORTE,
  MOTIVOS_REPORTE,
  type MotivoReporte,
  type TipoReportable,
} from '@/lib/reportes'
import { cn } from '@/lib/utils'

type Vista = 'menu' | 'reportar' | 'reportado' | 'bloquear'

/**
 * Los tres puntos de una publicación, un comentario, un mensaje o una persona:
 * una hoja que sube desde abajo con lo que se puede hacer.
 *
 * - **Reportar** (si se pasa `contenido`): una lista corta de motivos y, si se
 *   quiere, unas líneas. Dice a quién le llega el reporte y que la persona no
 *   sabrá quién fue.
 * - **Bloquear** o **Desbloquear** (si se pasa `persona`). Bloquear pide una
 *   confirmación que dice qué cambia y que a la otra persona no se le avisa.
 *
 * Va en un `<dialog>` modal, como `MenuMovil`: el navegador encierra el foco,
 * cierra con Escape y lo devuelve al botón. Todo lo que se toca mide 44 px.
 *
 * ⚠️ Al bloquear, la acción refresca el canal y lo bloqueado puede desaparecer
 * de la pantalla —con este componente adentro—. Por eso bloquear cierra la hoja
 * al terminar en lugar de mostrar un «listo» que ya no existiría.
 */
export function MenuModeracion({
  etiqueta,
  contenido,
  persona,
  className,
}: {
  /** Lo que el botón dice a un lector de pantalla. */
  etiqueta: string
  contenido?: { tipo: TipoReportable; id: string }
  persona?: { id: string; nombre: string; bloqueada: boolean }
  className?: string
}) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [vista, setVista] = useState<Vista>('menu')
  const [motivo, setMotivo] = useState<MotivoReporte | null>(null)
  const [detalle, setDetalle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enCurso, empezar] = useTransition()

  const abrir = () => {
    dialogo.current?.showModal()
  }
  const cerrar = () => dialogo.current?.close()
  // Cada vez que la hoja se cierra, la próxima abre limpia.
  const alCerrar = () => {
    setVista('menu')
    setMotivo(null)
    setDetalle('')
    setError(null)
  }

  const enviarReporte = () => {
    if (!contenido || !motivo) return
    setError(null)
    empezar(async () => {
      const r = await reportarContenido(contenido.tipo, contenido.id, motivo, detalle)
      if (r.ok) setVista('reportado')
      else setError(r.error ?? 'No se pudo enviar el reporte.')
    })
  }

  const bloquear = () => {
    if (!persona) return
    setError(null)
    empezar(async () => {
      const r = await bloquearPersona(persona.id)
      if (r.ok) cerrar()
      else setError(r.error ?? 'No se pudo bloquear.')
    })
  }

  const desbloquear = () => {
    if (!persona) return
    setError(null)
    empezar(async () => {
      const r = await desbloquearPersona(persona.id)
      if (r.ok) cerrar()
      else setError(r.error ?? 'No se pudo desbloquear.')
    })
  }

  const este = contenido ? ESTE_CONTENIDO[contenido.tipo] : ''

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={etiqueta}
        aria-haspopup="dialog"
        className={cn(
          'toque w-11 shrink-0 rounded-full text-marca-400 active:bg-marca-100',
          className
        )}
      >
        <IconoOpciones className="h-5 w-5" />
      </button>

      <dialog
        ref={dialogo}
        className="hoja-canal"
        aria-label={etiqueta}
        onClose={alCerrar}
        onClick={(ev) => {
          if (ev.target === dialogo.current) cerrar()
        }}
      >
        {/* En «reportar» la hoja es alta: el cuerpo se desplaza y el pie con los
            botones queda fijo abajo, a la vista aun en un teléfono de 320 px. */}
        <div className={cn('hoja-canal-panel', vista === 'reportar' && 'con-pie')}>
          {vista === 'menu' && (
            <>
              <Cabecera titulo="Opciones" onCerrar={cerrar} />
              <div className="space-y-2">
                {contenido && (
                  <button
                    type="button"
                    onClick={() => setVista('reportar')}
                    className="btn-canal btn-canal-suave w-full justify-start"
                  >
                    <IconoBandera className="h-4 w-4" />
                    Reportar {este}
                  </button>
                )}
                {persona && !persona.bloqueada && (
                  <button
                    type="button"
                    onClick={() => setVista('bloquear')}
                    className="btn-canal btn-canal-peligro w-full justify-start"
                  >
                    <IconoBloquear className="h-4 w-4" />
                    Bloquear a {persona.nombre}
                  </button>
                )}
                {persona?.bloqueada && (
                  <button
                    type="button"
                    onClick={desbloquear}
                    disabled={enCurso}
                    className="btn-canal btn-canal-suave w-full justify-start"
                  >
                    <IconoBloquear className="h-4 w-4" />
                    {enCurso ? 'Desbloqueando…' : `Desbloquear a ${persona.nombre}`}
                  </button>
                )}
                <button type="button" onClick={cerrar} className="btn-canal btn-canal-suave w-full">
                  Cancelar
                </button>
              </div>
              {error && <Aviso texto={error} />}
            </>
          )}

          {vista === 'reportar' && contenido && (
            <>
              <div className="hoja-canal-cuerpo">
              <Cabecera
                titulo={`Reportar ${este}`}
                onAtras={() => {
                  setError(null)
                  setVista('menu')
                }}
                onCerrar={cerrar}
              />
              <p className="mb-2 text-[13px] leading-relaxed text-marca-500">
                Cuéntanos qué pasa. El equipo lo revisa y la persona no sabrá que fuiste tú.
              </p>

              <fieldset>
                <legend className="sr-only">Motivo del reporte</legend>
                <div className="-mx-1">
                  {(Object.keys(MOTIVOS_REPORTE) as MotivoReporte[]).map((clave) => (
                    <label
                      key={clave}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] text-marca-800 active:bg-marca-50',
                        motivo === clave && 'bg-acento-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="motivo"
                        value={clave}
                        checked={motivo === clave}
                        onChange={() => setMotivo(clave)}
                        className="h-5 w-5 shrink-0 accent-acento-600"
                      />
                      {MOTIVOS_REPORTE[clave]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <label htmlFor="detalle-reporte" className="mt-3 block text-[13px] font-semibold text-marca-700">
                Algo más que quieras decirnos (opcional)
              </label>
              <textarea
                id="detalle-reporte"
                value={detalle}
                onChange={(ev) => setDetalle(ev.target.value)}
                maxLength={LARGO_DETALLE_REPORTE}
                rows={3}
                className="mt-1 w-full rounded-xl border border-marca-200 bg-marca-50 p-3 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:bg-white focus:ring-2 focus:ring-acento-100 focus:outline-none"
              />

              {error && <Aviso texto={error} />}
              </div>

              <div className="hoja-canal-pie">
                <button
                  type="button"
                  onClick={enviarReporte}
                  disabled={!motivo || enCurso}
                  className="btn-canal btn-canal-rojo w-full"
                >
                  <IconoBandera className="h-4 w-4" />
                  {enCurso ? 'Enviando…' : 'Enviar reporte'}
                </button>
              </div>
            </>
          )}

          {vista === 'reportado' && (
            <>
              <Cabecera titulo="Reporte enviado" onCerrar={cerrar} />
              <div className="mb-3 flex items-start gap-3 rounded-xl bg-marca-50 p-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-oro-300 text-marca-900">
                  <IconoCheck className="h-4 w-4" />
                </span>
                <p className="text-[15px] leading-relaxed text-marca-700">
                  Gracias por avisar. El equipo va a revisar {este}. La persona no sabrá que lo
                  reportaste.
                </p>
              </div>
              <div className="space-y-2">
                {persona && !persona.bloqueada && (
                  <button
                    type="button"
                    onClick={() => setVista('bloquear')}
                    className="btn-canal btn-canal-peligro w-full justify-start"
                  >
                    <IconoBloquear className="h-4 w-4" />
                    También bloquear a {persona.nombre}
                  </button>
                )}
                <button type="button" onClick={cerrar} className="btn-canal btn-canal-suave w-full">
                  Listo
                </button>
              </div>
            </>
          )}

          {vista === 'bloquear' && persona && (
            <>
              <Cabecera
                titulo={`¿Bloquear a ${persona.nombre}?`}
                onAtras={() => {
                  setError(null)
                  setVista('menu')
                }}
                onCerrar={cerrar}
              />
              <ul className="mb-3 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-marca-700">
                <li>No verás sus publicaciones, comentarios ni mensajes.</li>
                <li>No podrá escribirte ni pedirte conexión.</li>
                <li>No se le avisa. Puedes deshacerlo cuando quieras en Mi perfil, en «Personas bloqueadas».</li>
              </ul>
              {error && <Aviso texto={error} />}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={bloquear}
                  disabled={enCurso}
                  className="btn-canal btn-canal-peligro w-full"
                >
                  <IconoBloquear className="h-4 w-4" />
                  {enCurso ? 'Bloqueando…' : 'Bloquear'}
                </button>
                <button type="button" onClick={cerrar} className="btn-canal btn-canal-suave w-full">
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  )
}

function Cabecera({
  titulo,
  onAtras,
  onCerrar,
}: {
  titulo: string
  onAtras?: () => void
  onCerrar: () => void
}) {
  return (
    <div className="mb-2 flex items-center gap-1">
      {onAtras && (
        <button
          type="button"
          onClick={onAtras}
          aria-label="Volver"
          className="toque -ml-2 w-11 rounded-full text-marca-500 active:bg-marca-100"
        >
          <IconoAtras className="h-5 w-5" />
        </button>
      )}
      <p className="min-w-0 flex-1 text-[17px] leading-snug font-bold text-marca-900">{titulo}</p>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="toque -mr-2 w-11 rounded-full text-marca-500 active:bg-marca-100"
      >
        <IconoCerrar className="h-5 w-5" />
      </button>
    </div>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p role="alert" className="mt-2 text-[13px] text-acento-700">
      {texto}
    </p>
  )
}
