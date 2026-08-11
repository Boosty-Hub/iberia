import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoBuscar, IconoImportar, IconoMas, IconoReloj, IconoSede } from '@/components/iconos'
import { EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatFecha, nombreSesion } from '@/lib/utils'
import {
  ESTADOS_ENTREVISTA,
  ESTADO_ENTREVISTA_ORDEN,
  SEDES,
  TIPOS_SESION,
  TIPOS_SESION_ORDEN,
  type EstadoEntrevista,
  type Sede,
  type TipoSesion,
} from '@/lib/types'

export const metadata: Metadata = { title: 'Entrevistas' }

const TONO_ESTADO: Record<EstadoEntrevista, 'neutro' | 'ambar' | 'marca' | 'verde'> = {
  programada: 'neutro',
  realizada: 'ambar',
  transcrita: 'marca',
  analizada: 'verde',
}

/**
 * PostgREST separa los filtros de `.or()` por coma y usa paréntesis como
 * delimitadores, así que esos caracteres se retiran del término de búsqueda.
 */
function limpiarBusqueda(q: string): string {
  return q.replace(/[,()%\\]/g, ' ').trim().slice(0, 80)
}

function unico<T extends { id: string }>(filas: T[]): T[] {
  const vistos = new Set<string>()
  return filas.filter((f) => (vistos.has(f.id) ? false : (vistos.add(f.id), true)))
}

export default async function EntrevistasPage({
  searchParams,
}: PageProps<'/dashboard/entrevistas'>) {
  const [{ perfil }, params] = await Promise.all([requerirSesion(), searchParams])
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const valor = (k: string) => {
    const v = params[k]
    const s = Array.isArray(v) ? v[0] : v
    return s?.trim() || ''
  }

  const q = limpiarBusqueda(valor('q'))
  const filtroEstado = valor('estado')
  const filtroArea = valor('area')
  const filtroSede = valor('sede')
  const filtroTipo = valor('tipo')

  const { data: areas } = await supabase
    .from('areas')
    .select('id, nombre, slug, tipo')
    .order('orden')

  const SELECT =
    'id, codigo, tipo, titulo, entrevistado_nombre, entrevistado_cargo, sede, fecha_entrevista, duracion_minutos, estado, resumen, areas(id, nombre, slug), participantes:sesion_participantes(count)'

  /** Los tres filtros de columna se aplican igual a ambas consultas. */
  function conFiltros<T extends { eq(columna: string, valor: string): T }>(consulta: T): T {
    let salida = consulta
    if (filtroEstado) salida = salida.eq('estado', filtroEstado)
    if (filtroArea) salida = salida.eq('area_id', filtroArea)
    if (filtroSede) salida = salida.eq('sede', filtroSede)
    if (filtroTipo) salida = salida.eq('tipo', filtroTipo)
    return salida
  }

  // Búsqueda en metadata de la entrevista.
  let base = supabase.from('entrevistas').select(SELECT)
  if (q) {
    base = base.or(
      [
        `codigo.ilike.%${q}%`,
        `titulo.ilike.%${q}%`,
        `entrevistado_nombre.ilike.%${q}%`,
        `entrevistado_cargo.ilike.%${q}%`,
        `resumen.ilike.%${q}%`,
        `notas_consultor.ilike.%${q}%`,
      ].join(',')
    )
  }

  const [porMetadata, idsPorTranscripcion] = await Promise.all([
    conFiltros(base)
      .order('fecha_entrevista', { ascending: false, nullsFirst: false })
      .order('codigo', { ascending: true }),
    // Segunda pasada: lo que se dijo dentro de la transcripción también cuenta.
    q
      ? supabase
          .from('transcripcion_segmentos')
          .select('entrevista_id')
          .ilike('texto', `%${q}%`)
          .limit(2000)
      : Promise.resolve({ data: null, error: null }),
  ])

  let entrevistas = porMetadata.data ?? []
  const idsTranscripcion = [
    ...new Set((idsPorTranscripcion.data ?? []).map((s) => s.entrevista_id)),
  ].filter((id) => !entrevistas.some((e) => e.id === id))

  let coincidenciasEnTranscripcion = 0
  if (idsTranscripcion.length > 0) {
    const { data } = await conFiltros(
      supabase.from('entrevistas').select(SELECT).in('id', idsTranscripcion)
    )
    if (data?.length) {
      coincidenciasEnTranscripcion = data.length
      entrevistas = unico([...entrevistas, ...data])
    }
  }

  const hayFiltros = !!(q || filtroEstado || filtroArea || filtroSede || filtroTipo)

  return (
    <>
      <EncabezadoPagina
        rotulo="Corriente B · Diagnóstico"
        titulo="Entrevistas y sesiones"
        descripcion="Todo lo levantado: entrevistas a directores, gerentes y coordinadores, más las reuniones de comité y los recorridos de planta. Cada sesión guarda su transcripción, sus participantes y los hallazgos que salieron de ella."
        acciones={
          puedeEditar ? (
            <>
              <Link href="/dashboard/entrevistas/importar" className="btn-acento">
                <IconoImportar className="h-4 w-4" />
                Importar de Fireflies
              </Link>
              <Link href="/dashboard/entrevistas/nueva" className="btn-neutro">
                <IconoMas className="h-4 w-4" />
                Crear a mano
              </Link>
            </>
          ) : undefined
        }
      />

      {/* Filtros */}
      <form method="get" className="tarjeta mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-marca-400" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Nombre, título, cargo o algo que se dijo…"
              aria-label="Buscar sesiones"
              className="campo pl-9"
            />
          </div>

          <select name="tipo" defaultValue={filtroTipo} aria-label="Tipo" className="campo">
            <option value="">Todos los tipos</option>
            {TIPOS_SESION_ORDEN.map((t) => (
              <option key={t} value={t}>
                {TIPOS_SESION[t]}
              </option>
            ))}
          </select>

          <select name="estado" defaultValue={filtroEstado} aria-label="Estado" className="campo">
            <option value="">Todos los estados</option>
            {ESTADO_ENTREVISTA_ORDEN.map((e) => (
              <option key={e} value={e}>
                {ESTADOS_ENTREVISTA[e]}
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

          <select name="sede" defaultValue={filtroSede} aria-label="Sede" className="campo">
            <option value="">Todas las sedes</option>
            {Object.entries(SEDES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            <button type="submit" className="btn-primario flex-1 lg:flex-none">
              Filtrar
            </button>
            {hayFiltros && (
              <Link href="/dashboard/entrevistas" className="btn-neutro">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      {/* Resultados */}
      {entrevistas.length === 0 ? (
        hayFiltros ? (
          <EstadoVacio
            titulo="Ninguna entrevista coincide"
            descripcion="Prueba con otro término o quita los filtros."
          />
        ) : (
          <EstadoVacio
            titulo="Todavía no hay entrevistas"
            descripcion="Carga los archivos de Fireflies y el sistema arma cada entrevista con sus datos y su transcripción. No hace falta escribir nada."
            accion={
              puedeEditar
                ? { href: '/dashboard/entrevistas/importar', etiqueta: 'Importar de Fireflies' }
                : undefined
            }
          />
        )
      ) : (
        <>
          <p className="mb-3 text-xs text-marca-500">
            {entrevistas.length}{' '}
            {/* Mientras convivan entrevistas y sesiones grupales, el conteo no
                puede llamarlas a todas entrevistas. */}
            {entrevistas.every((e) => e.tipo === 'entrevista')
              ? entrevistas.length === 1
                ? 'entrevista'
                : 'entrevistas'
              : entrevistas.length === 1
                ? 'sesión'
                : 'sesiones'}
            {coincidenciasEnTranscripcion > 0 && (
              <>
                {' · '}
                {coincidenciasEnTranscripcion}{' '}
                {coincidenciasEnTranscripcion === 1
                  ? 'coincide solo en la transcripción'
                  : 'coinciden solo en la transcripción'}
              </>
            )}
          </p>

          <ul className="grid gap-3">
            {entrevistas.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/dashboard/entrevistas/${e.id}`}
                  className="tarjeta block p-4 transition-colors hover:border-acento-300 hover:bg-marca-50/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-2">
                        <span className="font-mono text-xs text-marca-400">{e.codigo}</span>
                        <span className="font-semibold text-marca-800">
                          {nombreSesion(e)}
                        </span>
                        {e.entrevistado_cargo && (
                          <span className="text-sm text-marca-500">
                            · {e.entrevistado_cargo}
                          </span>
                        )}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-marca-500">
                        {e.tipo !== 'entrevista' && (
                          <Insignia tono="neutro">
                            {TIPOS_SESION[e.tipo as TipoSesion]}
                          </Insignia>
                        )}
                        {e.participantes?.[0]?.count ? (
                          <span>{e.participantes[0].count} participantes</span>
                        ) : null}
                        {e.areas?.nombre && (
                          <Insignia tono="marca">{e.areas.nombre}</Insignia>
                        )}
                        {e.sede && (
                          <span className="inline-flex items-center gap-1">
                            <IconoSede className="h-3.5 w-3.5" />
                            {SEDES[e.sede as Sede]}
                          </span>
                        )}
                        <span>{formatFecha(e.fecha_entrevista)}</span>
                        {e.duracion_minutos && (
                          <span className="inline-flex items-center gap-1">
                            <IconoReloj className="h-3.5 w-3.5" />
                            {e.duracion_minutos} min
                          </span>
                        )}
                      </div>

                      {e.resumen && (
                        <p className="mt-2 line-clamp-2 text-sm text-marca-600">{e.resumen}</p>
                      )}
                    </div>

                    <Insignia tono={TONO_ESTADO[e.estado as EstadoEntrevista]}>
                      {ESTADOS_ENTREVISTA[e.estado as EstadoEntrevista]}
                    </Insignia>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
