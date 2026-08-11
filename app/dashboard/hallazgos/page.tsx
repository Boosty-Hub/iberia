import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoBuscar, IconoCheck, IconoMas } from '@/components/iconos'
import { EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { esEditor, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  ESTADOS_HALLAZGO,
  NIVELES,
  TIPOS_HALLAZGO,
  type EstadoHallazgo,
  type Nivel,
  type TipoHallazgo,
} from '@/lib/types'
import { cambiarEstadoHallazgo } from './acciones'

export const metadata: Metadata = { title: 'Hallazgos' }

const TONO_ESTADO: Record<EstadoHallazgo, 'ambar' | 'verde' | 'neutro'> = {
  propuesto: 'ambar',
  validado: 'verde',
  descartado: 'neutro',
}

const TONO_IMPACTO: Record<Nivel, 'rojo' | 'ambar' | 'neutro'> = {
  alto: 'rojo',
  medio: 'ambar',
  bajo: 'neutro',
}

function limpiarBusqueda(q: string): string {
  return q.replace(/[,()%\\]/g, ' ').trim().slice(0, 80)
}

export default async function HallazgosPage({
  searchParams,
}: PageProps<'/dashboard/hallazgos'>) {
  const [{ perfil }, params] = await Promise.all([requerirSesion(), searchParams])
  const puedeEditar = esEditor(perfil)
  const supabase = await createClient()

  const valor = (k: string) => {
    const v = params[k]
    const s = Array.isArray(v) ? v[0] : v
    return s?.trim() || ''
  }

  const q = limpiarBusqueda(valor('q'))
  const filtroTipo = valor('tipo')
  const filtroEstado = valor('estado')
  const filtroArea = valor('area')

  const { data: areas } = await supabase.from('areas').select('id, nombre, tipo').order('orden')

  let consulta = supabase
    .from('hallazgos')
    .select(
      'id, titulo, descripcion, tipo, estado, impacto, esfuerzo, cita_textual, created_at, areas(nombre), entrevistas(id, codigo, entrevistado_nombre)'
    )

  if (q) {
    consulta = consulta.or(
      [`titulo.ilike.%${q}%`, `descripcion.ilike.%${q}%`, `cita_textual.ilike.%${q}%`].join(',')
    )
  }
  if (filtroTipo) consulta = consulta.eq('tipo', filtroTipo)
  if (filtroEstado) consulta = consulta.eq('estado', filtroEstado)
  if (filtroArea) consulta = consulta.eq('area_id', filtroArea)

  const [{ data: hallazgos }, { data: todos }] = await Promise.all([
    consulta.order('created_at', { ascending: false }),
    supabase.from('hallazgos').select('tipo, estado'),
  ])

  const conteoTipo = (tipo: TipoHallazgo) =>
    (todos ?? []).filter((h) => h.tipo === tipo).length

  const hayFiltros = !!(q || filtroTipo || filtroEstado || filtroArea)
  const total = hallazgos?.length ?? 0

  return (
    <>
      <EncabezadoPagina
        rotulo="Insumo de la arquitectura"
        titulo="Hallazgos"
        descripcion="Lo que el diagnóstico leyó: cuellos de botella, trabajo manual repetitivo, datos disponibles y oportunidades de IA. Cada uno con la cita que lo respalda."
        acciones={
          puedeEditar ? (
            <Link href="/dashboard/hallazgos/nuevo" className="btn-acento">
              <IconoMas className="h-4 w-4" />
              Nuevo hallazgo
            </Link>
          ) : undefined
        }
      />

      {/* Conteo por tipo, clicable como filtro */}
      {!!todos?.length && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(Object.keys(TIPOS_HALLAZGO) as TipoHallazgo[])
            .filter((t) => conteoTipo(t) > 0)
            .map((t) => (
              <Link
                key={t}
                href={filtroTipo === t ? '/dashboard/hallazgos' : `/dashboard/hallazgos?tipo=${t}`}
                className={`insignia border transition-colors ${
                  filtroTipo === t
                    ? 'border-acento-600 bg-acento-600 text-white'
                    : 'border-[var(--borde)] bg-white text-marca-700 hover:border-acento-300'
                }`}
              >
                {TIPOS_HALLAZGO[t]}
                <span className={filtroTipo === t ? 'text-white/70' : 'text-marca-400'}>
                  {conteoTipo(t)}
                </span>
              </Link>
            ))}
        </div>
      )}

      {/* Filtros */}
      <form method="get" className="tarjeta mb-5 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <IconoBuscar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-marca-400" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Título, descripción o cita…"
              aria-label="Buscar hallazgos"
              className="campo pl-9"
            />
          </div>

          <select name="tipo" defaultValue={filtroTipo} aria-label="Tipo" className="campo">
            <option value="">Todos los tipos</option>
            {Object.entries(TIPOS_HALLAZGO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>

          <select name="estado" defaultValue={filtroEstado} aria-label="Estado" className="campo">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADOS_HALLAZGO).map(([k, v]) => (
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
              <Link href="/dashboard/hallazgos" className="btn-neutro">
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      {total === 0 ? (
        hayFiltros ? (
          <EstadoVacio
            titulo="Ningún hallazgo coincide"
            descripcion="Prueba con otro término o quita los filtros."
          />
        ) : (
          <EstadoVacio
            titulo="Todavía no hay hallazgos"
            descripcion="Los hallazgos se marcan sobre la transcripción de una entrevista, o se crean a mano desde aquí."
            accion={
              puedeEditar
                ? { href: '/dashboard/hallazgos/nuevo', etiqueta: 'Crear hallazgo' }
                : undefined
            }
          />
        )
      ) : (
        <>
          <p className="mb-3 text-xs text-marca-500">
            {total} {total === 1 ? 'hallazgo' : 'hallazgos'}
          </p>

          <ul className="grid gap-3">
            {hallazgos!.map((h) => (
              <li key={h.id} className="tarjeta p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/hallazgos/${h.id}`}
                      className="font-semibold text-marca-800 hover:text-acento-700"
                    >
                      {h.titulo}
                    </Link>

                    {h.descripcion && (
                      <p className="mt-1 line-clamp-2 text-sm text-marca-600">{h.descripcion}</p>
                    )}

                    {h.cita_textual && (
                      <blockquote className="mt-2 border-l-2 border-acento-300 pl-3 text-sm text-marca-600 italic">
                        {h.cita_textual.length > 200
                          ? `${h.cita_textual.slice(0, 200)}…`
                          : h.cita_textual}
                      </blockquote>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <Insignia tono="marca">{TIPOS_HALLAZGO[h.tipo as TipoHallazgo]}</Insignia>
                      {h.impacto && (
                        <Insignia tono={TONO_IMPACTO[h.impacto as Nivel]}>
                          Impacto {NIVELES[h.impacto as Nivel].toLowerCase()}
                        </Insignia>
                      )}
                      {h.esfuerzo && (
                        <Insignia tono="neutro">
                          Esfuerzo {NIVELES[h.esfuerzo as Nivel].toLowerCase()}
                        </Insignia>
                      )}
                      {h.areas?.nombre && <Insignia tono="neutro">{h.areas.nombre}</Insignia>}
                      {h.entrevistas?.codigo && (
                        <Link
                          href={`/dashboard/entrevistas/${h.entrevistas.id}`}
                          className="insignia bg-acento-50 font-mono text-acento-800 hover:bg-acento-100"
                        >
                          {h.entrevistas.codigo}
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Insignia tono={TONO_ESTADO[h.estado as EstadoHallazgo]}>
                      {ESTADOS_HALLAZGO[h.estado as EstadoHallazgo]}
                    </Insignia>

                    {puedeEditar && h.estado === 'propuesto' && (
                      <form action={cambiarEstadoHallazgo}>
                        <input type="hidden" name="id" value={h.id} />
                        <input type="hidden" name="estado" value="validado" />
                        <button
                          type="submit"
                          className="btn-neutro px-2 py-1 text-xs"
                          title="Marcar como validado"
                        >
                          <IconoCheck className="h-3.5 w-3.5" />
                          Validar
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
