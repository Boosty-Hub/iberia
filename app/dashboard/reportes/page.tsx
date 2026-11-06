import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoBloquear } from '@/components/iconos'
import { EncabezadoPagina, EstadoVacio, Insignia, Metrica } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { legible } from '@/lib/certificado'
import {
  MOTIVOS_REPORTE,
  TIPOS_REPORTABLES,
  type MotivoReporte,
  type TipoReportable,
} from '@/lib/reportes'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { ocultarReportado, revisarReporte } from './acciones'

export const metadata: Metadata = { title: 'Reportes del canal' }

const FECHA = new Intl.DateTimeFormat('es-VE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Caracas',
})

/**
 * Lo que la gente reporta en el canal: publicaciones, comentarios y mensajes.
 *
 * El extracto es lo que decía lo reportado cuando se reportó, congelado en el
 * reporte: el equipo lo lee sin entrar a las conversaciones de nadie. Ocultar no
 * borra nada y se deshace con «Restaurar».
 *
 * ⚠️ Esta pantalla muestra quién reportó. La persona reportada nunca la ve: la
 * tabla solo se lee con la casilla de este módulo.
 */
export default async function ReportesPage({ searchParams }: PageProps<'/dashboard/reportes'>) {
  const sesion = await requerirPermiso('modulo:reportes', 'ver')
  const params = await searchParams
  const verRevisados = params.estado === 'revisado'
  const puedeEditar = puede(sesion, 'modulo:reportes', 'editar')

  const supabase = await createClient()
  const [{ data: reportes }, { count: abiertos }, { count: revisados }] = await Promise.all([
    supabase
      .from('reportes')
      .select(
        '*, reportante:empleados!reportes_reportante_id_fkey(nombre_completo, cargo), autor:empleados!reportes_autor_id_fkey(nombre_completo, cargo)'
      )
      .eq('estado', verRevisados ? 'revisado' : 'abierto')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('estado', 'abierto'),
    supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('estado', 'revisado'),
  ])

  const filas = reportes ?? []

  return (
    <>
      <EncabezadoPagina
        rotulo="El canal"
        titulo="Reportes"
        descripcion="Lo que la gente reportó de las publicaciones, los comentarios y los mensajes. Lo que se oculta no se borra: se puede restaurar."
      />

      {params.aviso === 'error' && (
        <p role="alert" className="tarjeta mb-6 border-acento-200 px-5 py-4 text-sm text-acento-800">
          No se pudo guardar el cambio. Inténtalo otra vez.
        </p>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Metrica valor={abiertos ?? 0} etiqueta="Por revisar" />
        <Metrica valor={revisados ?? 0} etiqueta="Ya revisados" />
      </div>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Estado de los reportes">
        <Link
          href="/dashboard/reportes"
          role="tab"
          aria-selected={!verRevisados}
          className={cn('btn-neutro', !verRevisados && 'border-acento-300 bg-acento-50 text-acento-700')}
        >
          Por revisar
        </Link>
        <Link
          href="/dashboard/reportes?estado=revisado"
          role="tab"
          aria-selected={verRevisados}
          className={cn('btn-neutro', verRevisados && 'border-acento-300 bg-acento-50 text-acento-700')}
        >
          Revisados
        </Link>
      </div>

      <section className="tarjeta overflow-hidden">
        {filas.length === 0 ? (
          <EstadoVacio
            titulo={verRevisados ? 'Todavía no hay reportes revisados' : 'No hay reportes por revisar'}
            descripcion={
              verRevisados
                ? 'Cuando marques uno como revisado, queda aquí.'
                : 'Cuando alguien reporte algo desde el canal, aparece aquí con lo que decía.'
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--borde)]">
            {filas.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Insignia tono="marca">{TIPOS_REPORTABLES[r.tipo as TipoReportable] ?? r.tipo}</Insignia>
                    <Insignia tono="ambar">{MOTIVOS_REPORTE[r.motivo as MotivoReporte] ?? r.motivo}</Insignia>
                    {r.oculto && <Insignia tono="acento">Oculto</Insignia>}
                  </div>
                  <time dateTime={r.created_at} className="text-[13px] text-marca-500">
                    {FECHA.format(new Date(r.created_at))}
                  </time>
                </div>

                {r.contexto && <p className="mt-2 text-[13px] text-marca-500">{r.contexto}</p>}

                <blockquote className="mt-2 rounded-xl bg-marca-50 px-3 py-2 text-[14px] leading-relaxed whitespace-pre-line text-marca-700">
                  {r.extracto || 'Sin texto'}
                </blockquote>

                {r.detalle && (
                  <p className="mt-2 text-[13px] text-marca-600">
                    <span className="font-semibold">Lo que añadió quien reportó:</span> {r.detalle}
                  </p>
                )}

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-marca-400">Lo escribió</dt>
                    <dd className="font-medium text-marca-800">
                      {r.autor ? (
                        <>
                          {r.autor.nombre_completo}
                          {r.autor.cargo && (
                            <span className="font-normal text-marca-500"> · {legible(r.autor.cargo)}</span>
                          )}
                        </>
                      ) : (
                        'La empresa (sin autor)'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-marca-400">Lo reportó</dt>
                    <dd className="font-medium text-marca-800">
                      {r.reportante?.nombre_completo ?? 'Persona que ya no está en el padrón'}
                      {r.reportante?.cargo && (
                        <span className="font-normal text-marca-500"> · {legible(r.reportante.cargo)}</span>
                      )}
                    </dd>
                  </div>
                </dl>

                {r.revisado_en && (
                  <p className="mt-2 text-[12px] text-marca-400">
                    Revisado el {FECHA.format(new Date(r.revisado_en))}
                  </p>
                )}

                {puedeEditar && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <form action={revisarReporte}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="revisado" value={r.estado === 'abierto' ? 'si' : 'no'} />
                      <button type="submit" className="btn-neutro">
                        {r.estado === 'abierto' ? 'Marcar como revisado' : 'Reabrir'}
                      </button>
                    </form>

                    <form action={ocultarReportado}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="ocultar" value={r.oculto ? 'no' : 'si'} />
                      {r.oculto ? (
                        <button type="submit" className="btn-neutro">
                          Restaurar lo reportado
                        </button>
                      ) : (
                        <button type="submit" className="btn-peligro">
                          <IconoBloquear className="h-4 w-4" />
                          Ocultar lo reportado
                        </button>
                      )}
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
