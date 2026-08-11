'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { guardarTranscripcion } from '@/app/dashboard/entrevistas/acciones'
import { IconoAlerta, IconoCheck, IconoImportar } from '@/components/iconos'
import { parsearTranscripcion, type TranscripcionParseada } from '@/lib/fireflies'
import { formatTimestamp } from '@/lib/utils'

const EXTENSIONES = '.md,.markdown,.json,.txt'
const TAMANO_MAXIMO = 8 * 1024 * 1024 // 8 MB: una transcripción de texto nunca llega ahí.

type Resultado = { tipo: 'ok'; mensaje: string } | { tipo: 'error'; mensaje: string }

export function ImportadorFireflies({
  entrevistaId,
  tieneResumen,
  segmentosActuales,
}: {
  entrevistaId: string
  tieneResumen: boolean
  segmentosActuales: number
}) {
  const router = useRouter()
  const inputArchivo = useRef<HTMLInputElement>(null)

  const [parseado, setParseado] = useState<TranscripcionParseada | null>(null)
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null)
  const [pegado, setPegado] = useState('')
  const [modo, setModo] = useState<'archivo' | 'pegar'>('archivo')
  const [sobrescribirResumen, setSobrescribirResumen] = useState(!tieneResumen)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [guardando, iniciarGuardado] = useTransition()

  function limpiar() {
    setParseado(null)
    setNombreArchivo(null)
    setPegado('')
    setResultado(null)
    if (inputArchivo.current) inputArchivo.current.value = ''
  }

  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    setResultado(null)

    if (archivo.size > TAMANO_MAXIMO) {
      setResultado({
        tipo: 'error',
        mensaje: 'El archivo pesa más de 8 MB. ¿Seguro que es una transcripción de texto?',
      })
      return
    }

    try {
      const contenido = await archivo.text()
      setNombreArchivo(archivo.name)
      setParseado(parsearTranscripcion(contenido, archivo.name))
    } catch {
      setResultado({ tipo: 'error', mensaje: 'No se pudo leer el archivo.' })
    }
  }

  function alPegar() {
    setResultado(null)
    if (!pegado.trim()) {
      setResultado({ tipo: 'error', mensaje: 'Pega el contenido de la transcripción primero.' })
      return
    }
    setNombreArchivo(null)
    setParseado(parsearTranscripcion(pegado))
  }

  function guardar() {
    if (!parseado) return

    iniciarGuardado(async () => {
      const respuesta = await guardarTranscripcion({
        entrevistaId,
        segmentos: parseado.segmentos.map((s) => ({
          hablante: s.hablante,
          inicioSegundos: s.inicioSegundos,
          finSegundos: s.finSegundos,
          texto: s.texto,
        })),
        resumen: parseado.resumen,
        duracionMinutos: parseado.duracionMinutos,
        firefliesUrl: (parseado.meta.fireflies_url as string | undefined) ?? null,
        meta: parseado.meta,
        sobrescribirResumen,
      })

      if (respuesta.error) {
        setResultado({ tipo: 'error', mensaje: respuesta.error })
        return
      }

      const descartados = respuesta.descartados
        ? ` Se omitieron ${respuesta.descartados} fragmentos vacíos.`
        : ''
      setResultado({
        tipo: 'ok',
        mensaje: `Transcripción guardada: ${respuesta.segmentosGuardados} turnos.${descartados}`,
      })
      setParseado(null)
      setPegado('')
      if (inputArchivo.current) inputArchivo.current.value = ''
      router.refresh()
    })
  }

  return (
    <section className="tarjeta p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-marca-800">Importar transcripción</h2>
        <div className="flex gap-1 rounded-md bg-marca-100 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setModo('archivo')}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              modo === 'archivo' ? 'bg-white text-marca-800 shadow-sm' : 'text-marca-600'
            }`}
          >
            Archivo
          </button>
          <button
            type="button"
            onClick={() => setModo('pegar')}
            className={`rounded px-2.5 py-1 font-medium transition-colors ${
              modo === 'pegar' ? 'bg-white text-marca-800 shadow-sm' : 'text-marca-600'
            }`}
          >
            Pegar texto
          </button>
        </div>
      </div>

      <p className="mb-4 text-xs text-marca-500">
        Acepta el export de Fireflies en Markdown o JSON. El archivo se lee en tu navegador:
        solo se envía la transcripción ya interpretada.
        {segmentosActuales > 0 && (
          <>
            {' '}
            <strong className="text-amber-700">
              Esta entrevista ya tiene {segmentosActuales} turnos; al importar se reemplazan.
            </strong>
          </>
        )}
      </p>

      {modo === 'archivo' ? (
        <input
          ref={inputArchivo}
          type="file"
          accept={EXTENSIONES}
          onChange={alElegirArchivo}
          aria-label="Archivo de transcripción"
          className="block w-full cursor-pointer rounded-md border border-dashed border-[var(--borde)] bg-marca-50 px-3 py-3 text-sm text-marca-600 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-marca-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-marca-600"
        />
      ) : (
        <div className="space-y-2">
          <textarea
            value={pegado}
            onChange={(e) => setPegado(e.target.value)}
            rows={8}
            placeholder={'**Gabriel Montiel** 00:03\nBuenos días, cuéntame cómo entra un pedido…'}
            className="campo resize-y font-mono text-xs"
          />
          <button type="button" onClick={alPegar} className="btn-neutro">
            Interpretar texto
          </button>
        </div>
      )}

      {/* Vista previa */}
      {parseado && (
        <div className="mt-5 rounded-md border border-[var(--borde)] bg-marca-50/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-marca-800">
              Vista previa
              {nombreArchivo && (
                <span className="ml-2 font-mono text-xs font-normal text-marca-500">
                  {nombreArchivo}
                </span>
              )}
            </p>
            <span className="insignia bg-marca-50 text-marca-700">
              {parseado.formato === 'json' ? 'JSON' : 'Markdown'}
            </span>
          </div>

          <dl className="mb-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-marca-500">Turnos</dt>
              <dd className="text-base font-semibold text-marca-800">
                {parseado.segmentos.length}
              </dd>
            </div>
            <div>
              <dt className="text-marca-500">Hablantes</dt>
              <dd className="text-base font-semibold text-marca-800">
                {parseado.hablantes.length || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-marca-500">Duración</dt>
              <dd className="text-base font-semibold text-marca-800">
                {parseado.duracionMinutos ? `${parseado.duracionMinutos} min` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-marca-500">Fecha</dt>
              <dd className="text-base font-semibold text-marca-800">
                {parseado.fecha ?? '—'}
              </dd>
            </div>
          </dl>

          {parseado.hablantes.length > 0 && (
            <p className="mb-3 text-xs text-marca-600">
              <span className="text-marca-500">Hablantes detectados: </span>
              {parseado.hablantes.join(' · ')}
            </p>
          )}

          {parseado.advertencias.length > 0 && (
            <ul className="mb-3 space-y-1">
              {parseado.advertencias.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"
                >
                  <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          )}

          {/* Primeros turnos, para confirmar que la atribución quedó bien */}
          {parseado.segmentos.length > 0 && (
            <div className="mb-4 max-h-56 space-y-2 overflow-y-auto rounded border border-[var(--borde)] bg-white p-3">
              {parseado.segmentos.slice(0, 6).map((s, i) => (
                <p key={i} className="text-xs leading-relaxed">
                  <span className="font-semibold text-acento-700">
                    {s.hablante ?? 'Sin atribuir'}
                  </span>
                  {s.inicioSegundos !== null && (
                    <span className="ml-1.5 font-mono text-[11px] text-marca-400">
                      {formatTimestamp(s.inicioSegundos)}
                    </span>
                  )}
                  <span className="mt-0.5 block text-marca-700">
                    {s.texto.length > 220 ? `${s.texto.slice(0, 220)}…` : s.texto}
                  </span>
                </p>
              ))}
              {parseado.segmentos.length > 6 && (
                <p className="pt-1 text-center text-[11px] text-marca-400">
                  y {parseado.segmentos.length - 6} turnos más
                </p>
              )}
            </div>
          )}

          {parseado.resumen && (
            <label className="mb-4 flex items-start gap-2 text-xs text-marca-700">
              <input
                type="checkbox"
                checked={sobrescribirResumen}
                onChange={(e) => setSobrescribirResumen(e.target.checked)}
                className="mt-0.5 accent-acento-600"
              />
              <span>
                Usar el resumen de Fireflies
                {tieneResumen && (
                  <strong className="text-amber-700">
                    {' '}
                    (reemplaza el resumen que ya tiene la entrevista)
                  </strong>
                )}
              </span>
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || parseado.segmentos.length === 0}
              className="btn-acento"
            >
              <IconoImportar className="h-4 w-4" />
              {guardando ? 'Guardando…' : 'Guardar transcripción'}
            </button>
            <button type="button" onClick={limpiar} className="btn-neutro" disabled={guardando}>
              Descartar
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <p
          role="status"
          className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
            resultado.tipo === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {resultado.tipo === 'ok' ? (
            <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          {resultado.mensaje}
        </p>
      )}
    </section>
  )
}
