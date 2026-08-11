import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoBasura, IconoBuscar, IconoDescargar } from '@/components/iconos'
import { SubirArchivo } from '@/components/subir-archivo'
import { EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatBytes, formatFecha } from '@/lib/utils'
import { CATEGORIAS_ARCHIVO, type CategoriaArchivo } from '@/lib/types'
import { eliminarArchivo } from './acciones'

export const metadata: Metadata = { title: 'Archivos' }

/** Etiqueta corta a partir del nombre o del mime, para el cuadro de tipo. */
function extension(nombre: string, mime: string | null): string {
  const punto = nombre.lastIndexOf('.')
  if (punto > 0 && punto < nombre.length - 1) {
    return nombre.slice(punto + 1).toUpperCase().slice(0, 4)
  }
  if (mime?.includes('pdf')) return 'PDF'
  if (mime?.startsWith('image/')) return 'IMG'
  if (mime?.startsWith('audio/')) return 'AUD'
  if (mime?.startsWith('video/')) return 'VID'
  return '···'
}

function limpiarBusqueda(q: string): string {
  return q.replace(/[,()%\\]/g, ' ').trim().slice(0, 80)
}

export default async function ArchivosPage({ searchParams }: PageProps<'/dashboard/archivos'>) {
  const [{ perfil }, params] = await Promise.all([requerirSesion(), searchParams])
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const valor = (k: string) => {
    const v = params[k]
    const s = Array.isArray(v) ? v[0] : v
    return s?.trim() || ''
  }

  const q = limpiarBusqueda(valor('q'))
  const filtroCategoria = valor('categoria')
  const filtroArea = valor('area')

  const [{ data: areas }, { data: entrevistas }] = await Promise.all([
    supabase.from('areas').select('id, nombre, tipo').order('orden'),
    supabase
      .from('entrevistas')
      .select('id, codigo, titulo, entrevistado_nombre')
      .order('codigo'),
  ])

  let consulta = supabase
    .from('archivos')
    .select(
      'id, nombre, descripcion, mime_type, tamano_bytes, categoria, fase, confidencial, created_at, areas(nombre), entrevistas(id, codigo)'
    )

  if (q) {
    consulta = consulta.or([`nombre.ilike.%${q}%`, `descripcion.ilike.%${q}%`].join(','))
  }
  if (filtroCategoria) consulta = consulta.eq('categoria', filtroCategoria)
  if (filtroArea) consulta = consulta.eq('area_id', filtroArea)

  const { data: archivos } = await consulta.order('created_at', { ascending: false })

  const hayFiltros = !!(q || filtroCategoria || filtroArea)
  const total = archivos?.length ?? 0
  const pesoTotal = (archivos ?? []).reduce((suma, a) => suma + (a.tamano_bytes ?? 0), 0)

  return (
    <>
      <EncabezadoPagina
        rotulo="Inventario de sistemas y datos"
        titulo="Archivos"
        descripcion="Documentos del levantamiento: manuales, reportes del ERP, muestras de data, políticas y material de comunicación."
      />

      {puedeEditar && (
        <div className="mb-6">
          <SubirArchivo areas={areas ?? []} entrevistas={entrevistas ?? []} />
        </div>
      )}

      {/* Filtros */}
      <form method="get" className="tarjeta mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
          <div className="relative">
            <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-marca-400" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nombre o descripción…"
              aria-label="Buscar archivos"
              className="campo pl-9"
            />
          </div>

          <select
            name="categoria"
            defaultValue={filtroCategoria}
            aria-label="Categoría"
            className="campo"
          >
            <option value="">Todas las categorías</option>
            {Object.entries(CATEGORIAS_ARCHIVO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select name="area" defaultValue={filtroArea} aria-label="Área" className="campo">
            <option value="">Todas las áreas</option>
            {(areas ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button type="submit" className="btn-primario flex-1 lg:flex-none">
              Filtrar
            </button>
            {hayFiltros && (
              <Link href="/dashboard/archivos" className="btn-neutro">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      {total === 0 ? (
        hayFiltros ? (
          <EstadoVacio
            titulo="Ningún archivo coincide"
            descripcion="Prueba con otro término o quita los filtros."
          />
        ) : (
          <EstadoVacio
            titulo="Todavía no hay archivos"
            descripcion={
              puedeEditar
                ? 'Sube el primer documento del levantamiento con el formulario de arriba.'
                : 'El equipo consultor aún no ha cargado documentos.'
            }
          />
        )
      ) : (
        <>
          <p className="mb-3 text-xs text-marca-500">
            {total} {total === 1 ? 'archivo' : 'archivos'} · {formatBytes(pesoTotal)}
          </p>

          <ul className="grid gap-3">
            {archivos!.map((a) => (
              <li key={a.id} className="tarjeta flex items-start gap-4 p-4">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded bg-marca-50 font-mono text-[10px] font-bold text-marca-600"
                >
                  {extension(a.nombre, a.mime_type)}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-marca-800">{a.nombre}</p>

                  {a.descripcion && (
                    <p className="mt-0.5 line-clamp-2 text-sm text-marca-600">
                      {a.descripcion}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-marca-500">
                    <Insignia tono="marca">
                      {CATEGORIAS_ARCHIVO[a.categoria as CategoriaArchivo]}
                    </Insignia>
                    {a.areas?.nombre && <span>{a.areas.nombre}</span>}
                    {a.entrevistas?.codigo && (
                      <Link
                        href={`/dashboard/entrevistas/${a.entrevistas.id}`}
                        className="font-mono text-acento-700 hover:underline"
                      >
                        {a.entrevistas.codigo}
                      </Link>
                    )}
                    {a.fase && <span>Fase {a.fase}</span>}
                    <span>{formatBytes(a.tamano_bytes)}</span>
                    <span>{formatFecha(a.created_at)}</span>
                    {a.confidencial && <Insignia tono="ambar">Confidencial</Insignia>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`/dashboard/archivos/${a.id}/descargar`}
                    className="btn-neutro px-2.5"
                    title={`Descargar ${a.nombre}`}
                  >
                    <IconoDescargar className="h-4 w-4" />
                    <span className="sr-only">Descargar</span>
                  </a>

                  {puedeEditar && (
                    <form action={eliminarArchivo}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        className="btn-peligro px-2.5"
                        title={`Eliminar ${a.nombre}`}
                      >
                        <IconoBasura className="h-4 w-4" />
                        <span className="sr-only">Eliminar</span>
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
