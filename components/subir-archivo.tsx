'use client'

import { useRouter } from 'next/navigation'
import { OpcionesArea } from '@/components/ui'
import { useRef, useState, useTransition } from 'react'
import { descartarSubida, registrarArchivo } from '@/app/dashboard/archivos/acciones'
import { IconoAlerta, IconoCheck, IconoSubir } from '@/components/iconos'
import { BUCKET_ARCHIVOS } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS_ARCHIVO, type Area } from '@/lib/types'
import { formatBytes, slugifyFilename, nombreSesion } from '@/lib/utils'

/** Límite del plan de Storage por defecto en Supabase. */
const TAMANO_MAXIMO = 50 * 1024 * 1024

type Resultado = { tipo: 'ok' | 'error'; mensaje: string }

export function SubirArchivo({
  areas,
  entrevistas,
  entrevistaFija,
}: {
  areas: Pick<Area, 'id' | 'nombre' | 'tipo'>[]
  entrevistas: { id: string; codigo: string; titulo: string | null; entrevistado_nombre: string | null }[]
  entrevistaFija?: string
}) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [progreso, setProgreso] = useState<'inactivo' | 'subiendo' | 'registrando'>('inactivo')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [, iniciar] = useTransition()

  const ocupado = progreso !== 'inactivo'

  async function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setResultado(null)

    if (!archivo) {
      setResultado({ tipo: 'error', mensaje: 'Elige un archivo.' })
      return
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setResultado({
        tipo: 'error',
        mensaje: `El archivo pesa ${formatBytes(archivo.size)}; el máximo es ${formatBytes(TAMANO_MAXIMO)}.`,
      })
      return
    }

    const fd = new FormData(e.currentTarget)
    const categoria = String(fd.get('categoria') ?? 'otro')

    // Ruta única: la categoría agrupa y el UUID evita colisiones de nombre.
    const storagePath = `${categoria}/${crypto.randomUUID()}-${slugifyFilename(archivo.name)}`

    setProgreso('subiendo')
    const supabase = createClient()

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET_ARCHIVOS)
      .upload(storagePath, archivo, {
        cacheControl: '3600',
        upsert: false,
        contentType: archivo.type || undefined,
      })

    if (errorSubida) {
      setProgreso('inactivo')
      setResultado({ tipo: 'error', mensaje: `No se pudo subir: ${errorSubida.message}` })
      return
    }

    setProgreso('registrando')

    const nombreVisible = String(fd.get('nombre') ?? '').trim() || archivo.name
    const faseCruda = Number.parseInt(String(fd.get('fase') ?? ''), 10)

    const respuesta = await registrarArchivo({
      nombre: nombreVisible,
      storagePath,
      mimeType: archivo.type || null,
      tamanoBytes: archivo.size,
      descripcion: String(fd.get('descripcion') ?? ''),
      categoria,
      areaId: String(fd.get('area_id') ?? '') || null,
      entrevistaId: entrevistaFija ?? (String(fd.get('entrevista_id') ?? '') || null),
      fase: Number.isFinite(faseCruda) ? faseCruda : null,
      confidencial: fd.get('confidencial') === 'on',
    })

    setProgreso('inactivo')

    if (respuesta.error) {
      // El binario ya está arriba pero sin registro: se retira para no dejar
      // basura invisible en el bucket.
      await descartarSubida(storagePath)
      setResultado({ tipo: 'error', mensaje: respuesta.error })
      return
    }

    setResultado({ tipo: 'ok', mensaje: `«${nombreVisible}» quedó guardado.` })
    setArchivo(null)
    formRef.current?.reset()
    iniciar(() => router.refresh())
  }

  return (
    <form ref={formRef} onSubmit={alEnviar} className="tarjeta p-5">
      <h2 className="mb-1 text-sm font-semibold text-marca-800">Subir archivo</h2>
      <p className="mb-4 text-xs text-marca-500">
        Bucket privado: solo se descarga con sesión activa y por enlace firmado de corta vida.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="archivo" className="etiqueta">
            Archivo <span className="text-red-600">*</span>
          </label>
          <input
            id="archivo"
            type="file"
            required
            disabled={ocupado}
            onChange={(e) => {
              setArchivo(e.target.files?.[0] ?? null)
              setResultado(null)
            }}
            className="block w-full cursor-pointer rounded-md border border-dashed border-[var(--borde)] bg-marca-50 px-3 py-3 text-sm text-marca-600 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-marca-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-marca-600 disabled:opacity-60"
          />
          {archivo && (
            <p className="mt-1.5 text-xs text-marca-500">
              {archivo.name} · {formatBytes(archivo.size)}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="nombre" className="etiqueta">
              Nombre visible
            </label>
            <input
              id="nombre"
              name="nombre"
              disabled={ocupado}
              placeholder={archivo?.name ?? 'Se usa el nombre del archivo'}
              className="campo"
            />
          </div>

          <div>
            <label htmlFor="categoria" className="etiqueta">
              Categoría
            </label>
            <select id="categoria" name="categoria" defaultValue="otro" disabled={ocupado} className="campo">
              {Object.entries(CATEGORIAS_ARCHIVO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="area_id" className="etiqueta">
              Área
            </label>
            <select id="area_id" name="area_id" defaultValue="" disabled={ocupado} className="campo">
              <option value="">Sin asignar</option>
              <OpcionesArea areas={areas} />
            </select>
          </div>

          {!entrevistaFija && (
            <div>
              <label htmlFor="entrevista_id" className="etiqueta">
                Entrevista relacionada
              </label>
              <select
                id="entrevista_id"
                name="entrevista_id"
                defaultValue=""
                disabled={ocupado}
                className="campo"
              >
                <option value="">Ninguna</option>
                {entrevistas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.codigo} · {nombreSesion(e)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="fase" className="etiqueta">
              Fase del programa
            </label>
            <select id="fase" name="fase" defaultValue="1" disabled={ocupado} className="campo">
              <option value="1">Fase 1 · Entender</option>
              <option value="2">Fase 2 · Aliviar</option>
              <option value="3">Fase 3 · Transformar</option>
              <option value="4">Fase 4 · Transferir</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="descripcion" className="etiqueta">
              Descripción
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={2}
              disabled={ocupado}
              placeholder="Qué contiene y para qué sirve en el levantamiento."
              className="campo resize-y"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-marca-700">
          <input
            type="checkbox"
            name="confidencial"
            defaultChecked
            disabled={ocupado}
            className="accent-acento-600"
          />
          Material confidencial de Iberia
        </label>

        {resultado && (
          <p
            role="status"
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
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

        <button type="submit" className="btn-acento" disabled={ocupado}>
          <IconoSubir className="h-4 w-4" />
          {progreso === 'subiendo'
            ? 'Subiendo…'
            : progreso === 'registrando'
              ? 'Registrando…'
              : 'Subir archivo'}
        </button>
      </div>
    </form>
  )
}
