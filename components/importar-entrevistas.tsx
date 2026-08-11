'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { crearEntrevistaDesdeArchivo } from '@/app/dashboard/entrevistas/acciones'
import {
  IconoAlerta,
  IconoBasura,
  IconoCheck,
  IconoImportar,
  IconoSubir,
} from '@/components/iconos'
import { Insignia } from '@/components/ui'
import {
  derivarEntrevista,
  type AreaMinima,
  type EntrevistaDerivada,
} from '@/lib/entrevista-desde-transcripcion'
import { parsearTranscripcion, type TranscripcionParseada } from '@/lib/fireflies'
import { SEDES, type Sede } from '@/lib/types'

const EXTENSIONES = '.json,.md,.markdown,.txt'
const TAMANO_MAXIMO = 8 * 1024 * 1024

type Estado = 'pendiente' | 'creando' | 'creada' | 'error'

type Item = {
  clave: string
  archivo: string
  parseada: TranscripcionParseada
  derivada: EntrevistaDerivada
  nombre: string
  cargo: string
  areaId: string
  sede: string
  fecha: string
  estado: Estado
  mensaje?: string
  creadaId?: string
  creadaCodigo?: string
}

const TONO_CONFIANZA: Record<EntrevistaDerivada['confianza'], 'verde' | 'ambar' | 'rojo'> = {
  alta: 'verde',
  media: 'ambar',
  baja: 'rojo',
}

const TEXTO_CONFIANZA: Record<EntrevistaDerivada['confianza'], string> = {
  alta: 'Nombre deducido de quién habla',
  media: 'Nombre deducido del título — conviene revisarlo',
  baja: 'No se pudo deducir el nombre — escríbelo',
}

export function ImportarEntrevistas({ areas }: { areas: AreaMinima[] }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [leyendo, setLeyendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const [creando, iniciarCreacion] = useTransition()

  function actualizar(clave: string, cambios: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.clave === clave ? { ...i, ...cambios } : i)))
  }

  async function alElegirArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    await procesar(Array.from(e.target.files ?? []))
    if (inputRef.current) inputRef.current.value = ''
  }

  async function alSoltar(e: React.DragEvent) {
    e.preventDefault()
    setArrastrando(false)
    if (creando || leyendo) return
    await procesar(Array.from(e.dataTransfer.files ?? []))
  }

  async function procesar(archivos: File[]) {
    if (archivos.length === 0) return

    setLeyendo(true)
    const nuevos: Item[] = []

    for (const archivo of archivos) {
      if (archivo.size > TAMANO_MAXIMO) {
        nuevos.push(crearItemInvalido(archivo.name, 'Pesa más de 8 MB; no parece una transcripción.'))
        continue
      }
      try {
        const contenido = await archivo.text()
        const parseada = parsearTranscripcion(contenido, archivo.name)
        const derivada = derivarEntrevista(parseada, areas, archivo.name)

        nuevos.push({
          clave: `${archivo.name}-${archivo.size}-${nuevos.length}`,
          archivo: archivo.name,
          parseada,
          derivada,
          nombre: derivada.entrevistadoNombre,
          cargo: derivada.entrevistadoCargo ?? '',
          areaId: derivada.areaId ?? '',
          sede: derivada.sede ?? '',
          fecha: derivada.fecha ?? '',
          estado: 'pendiente',
        })
      } catch {
        nuevos.push(crearItemInvalido(archivo.name, 'No se pudo leer el archivo.'))
      }
    }

    setItems((prev) => [...prev, ...nuevos])
    setLeyendo(false)
  }

  function crearItemInvalido(archivo: string, mensaje: string): Item {
    const vacia = parsearTranscripcion('', archivo)
    return {
      clave: `${archivo}-error-${Math.random().toString(36).slice(2)}`,
      archivo,
      parseada: vacia,
      derivada: derivarEntrevista(vacia, areas, archivo),
      nombre: '',
      cargo: '',
      areaId: '',
      sede: '',
      fecha: '',
      estado: 'error',
      mensaje,
    }
  }

  function crearTodas() {
    const pendientes = items.filter((i) => i.estado === 'pendiente' && i.nombre.trim())
    if (pendientes.length === 0) return

    iniciarCreacion(async () => {
      for (const item of pendientes) {
        actualizar(item.clave, { estado: 'creando', mensaje: undefined })

        const respuesta = await crearEntrevistaDesdeArchivo({
          entrevistadoNombre: item.nombre,
          entrevistadoCargo: item.cargo || null,
          entrevistador: item.derivada.entrevistador,
          areaId: item.areaId || null,
          sede: item.sede || null,
          fecha: item.fecha || null,
          duracionMinutos: item.derivada.duracionMinutos,
          resumen: item.derivada.resumen,
          firefliesUrl: item.derivada.firefliesUrl,
          meta: item.parseada.meta,
          segmentos: item.parseada.segmentos.map((s) => ({
            hablante: s.hablante,
            inicioSegundos: s.inicioSegundos,
            finSegundos: s.finSegundos,
            texto: s.texto,
          })),
        })

        if (respuesta.error) {
          actualizar(item.clave, { estado: 'error', mensaje: respuesta.error })
        } else {
          actualizar(item.clave, {
            estado: 'creada',
            creadaId: respuesta.id,
            creadaCodigo: respuesta.codigo,
            mensaje: `${respuesta.segmentos} turnos cargados`,
          })
        }
      }
      router.refresh()
    })
  }

  const pendientes = items.filter((i) => i.estado === 'pendiente' && i.nombre.trim()).length
  const creadas = items.filter((i) => i.estado === 'creada').length

  return (
    <div className="space-y-5">
      <section className="tarjeta p-5">
        <h2 className="mb-1 text-sm font-semibold text-marca-800">Archivos de Fireflies</h2>
        <p className="mb-4 text-xs text-marca-500">
          Markdown o JSON. Puedes soltar varios a la vez. Se leen en tu navegador y el
          sistema deduce el entrevistado, el área, la fecha y la duración: solo tienes que
          confirmar.
        </p>

        {/* El control nativo rotula "Choose Files" en inglés y no se puede
            traducir: se oculta y se etiqueta a mano. */}
        <input
          ref={inputRef}
          id="archivos-fireflies"
          type="file"
          multiple
          accept={EXTENSIONES}
          onChange={alElegirArchivos}
          disabled={leyendo || creando}
          className="sr-only"
        />
        <label
          htmlFor="archivos-fireflies"
          onDragOver={(e) => {
            e.preventDefault()
            setArrastrando(true)
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={alSoltar}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${
            arrastrando
              ? 'border-acento-500 bg-acento-50'
              : 'border-[var(--borde)] bg-marca-50 hover:border-acento-300 hover:bg-acento-50/40'
          } ${leyendo || creando ? 'pointer-events-none opacity-60' : ''}`}
        >
          <IconoSubir className="h-6 w-6 text-marca-400" />
          <span className="text-sm font-medium text-marca-800">
            {leyendo ? 'Leyendo archivos…' : 'Arrastra los archivos aquí o haz clic para elegirlos'}
          </span>
          <span className="text-xs text-marca-500">
            Formatos de Fireflies: .json, .md o .txt · varios a la vez
          </span>
        </label>
      </section>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-marca-600">
              {items.length} {items.length === 1 ? 'archivo' : 'archivos'}
              {creadas > 0 && ` · ${creadas} ${creadas === 1 ? 'creada' : 'creadas'}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setItems([])}
                disabled={creando}
                className="btn-neutro"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={crearTodas}
                disabled={creando || pendientes === 0}
                className="btn-acento"
              >
                <IconoImportar className="h-4 w-4" />
                {creando
                  ? 'Creando…'
                  : `Crear ${pendientes} ${pendientes === 1 ? 'entrevista' : 'entrevistas'}`}
              </button>
            </div>
          </div>

          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.clave} className="tarjeta p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-xs text-marca-500">{item.archivo}</p>

                  <div className="flex items-center gap-2">
                    {item.estado === 'creada' ? (
                      <>
                        <Insignia tono="verde">
                          <IconoCheck className="h-3 w-3" />
                          {item.creadaCodigo}
                        </Insignia>
                        {item.creadaId && (
                          <Link
                            href={`/dashboard/entrevistas/${item.creadaId}`}
                            className="text-xs font-medium text-acento-700 hover:underline"
                          >
                            Abrir →
                          </Link>
                        )}
                      </>
                    ) : item.estado === 'error' ? (
                      <Insignia tono="rojo">
                        <IconoAlerta className="h-3 w-3" />
                        Error
                      </Insignia>
                    ) : item.estado === 'creando' ? (
                      <Insignia tono="ambar">Creando…</Insignia>
                    ) : (
                      <>
                        <Insignia tono={TONO_CONFIANZA[item.derivada.confianza]}>
                          {TEXTO_CONFIANZA[item.derivada.confianza]}
                        </Insignia>
                        <button
                          type="button"
                          onClick={() =>
                            setItems((prev) => prev.filter((i) => i.clave !== item.clave))
                          }
                          disabled={creando}
                          className="rounded p-1 text-marca-300 hover:bg-acento-50 hover:text-acento-600"
                          title="Quitar de la lista"
                        >
                          <IconoBasura className="h-4 w-4" />
                          <span className="sr-only">Quitar</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {item.mensaje && (
                  <p
                    className={`mb-3 rounded-md border px-3 py-2 text-xs ${
                      item.estado === 'error'
                        ? 'border-acento-200 bg-acento-50 text-acento-800'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {item.mensaje}
                  </p>
                )}

                {item.estado !== 'creada' && item.estado !== 'error' && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2">
                        <label className="etiqueta text-xs">Entrevistado</label>
                        <input
                          value={item.nombre}
                          onChange={(e) => actualizar(item.clave, { nombre: e.target.value })}
                          disabled={creando}
                          placeholder="Nombre y apellido"
                          className="campo py-1.5 text-sm"
                        />
                        {item.derivada.hablantes.length > 1 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="text-[11px] text-marca-400">Quien habla:</span>
                            {item.derivada.hablantes.slice(0, 4).map((h) => (
                              <button
                                key={h.nombre}
                                type="button"
                                onClick={() => actualizar(item.clave, { nombre: h.nombre })}
                                disabled={creando}
                                className={`rounded-full px-2 py-0.5 text-[11px] transition-colors ${
                                  item.nombre === h.nombre
                                    ? 'bg-acento-600 text-white'
                                    : 'bg-marca-100 text-marca-600 hover:bg-marca-200'
                                }`}
                                title={`${h.palabras} palabras en ${h.turnos} turnos`}
                              >
                                {h.nombre}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className="etiqueta text-xs">Cargo</label>
                        <input
                          value={item.cargo}
                          onChange={(e) => actualizar(item.clave, { cargo: e.target.value })}
                          disabled={creando}
                          placeholder="Opcional"
                          className="campo py-1.5 text-sm"
                        />
                      </div>

                      <div>
                        <label className="etiqueta text-xs">Área</label>
                        <select
                          value={item.areaId}
                          onChange={(e) => actualizar(item.clave, { areaId: e.target.value })}
                          disabled={creando}
                          className="campo py-1.5 text-sm"
                        >
                          <option value="">Sin asignar</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.nombre}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="etiqueta text-xs">Sede</label>
                        <select
                          value={item.sede}
                          onChange={(e) => actualizar(item.clave, { sede: e.target.value })}
                          disabled={creando}
                          className="campo py-1.5 text-sm"
                        >
                          <option value="">Sin especificar</option>
                          {Object.entries(SEDES).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="etiqueta text-xs">Fecha</label>
                        <input
                          type="date"
                          value={item.fecha}
                          onChange={(e) => actualizar(item.clave, { fecha: e.target.value })}
                          disabled={creando}
                          className="campo py-1.5 text-sm"
                        />
                      </div>

                      <div>
                        <label className="etiqueta text-xs">Duración</label>
                        <p className="px-1 py-1.5 text-sm text-marca-600">
                          {item.derivada.duracionMinutos
                            ? `${item.derivada.duracionMinutos} min`
                            : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--borde)] pt-3 text-xs text-marca-500">
                      <span>
                        <strong className="text-marca-700">
                          {item.parseada.segmentos.length}
                        </strong>{' '}
                        turnos
                      </span>
                      <span>
                        <strong className="text-marca-700">
                          {item.derivada.hablantes.length}
                        </strong>{' '}
                        hablantes
                      </span>
                      {item.derivada.entrevistador && (
                        <span>Entrevistador: {item.derivada.entrevistador}</span>
                      )}
                      {item.derivada.sede && (
                        <span>Sede detectada: {SEDES[item.derivada.sede as Sede]}</span>
                      )}
                      {item.derivada.resumen && <span>Con resumen</span>}
                    </div>

                    {item.parseada.advertencias.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {item.parseada.advertencias.map((a, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-amber-800"
                          >
                            <IconoAlerta className="mt-0.5 h-3 w-3 shrink-0" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
