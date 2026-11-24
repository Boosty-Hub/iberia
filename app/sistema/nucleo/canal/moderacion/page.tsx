import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { legible } from '@/lib/certificado'
import { MOTIVOS_REPORTE, TIPOS_REPORTABLES, type MotivoReporte, type TipoReportable } from '@/lib/reportes'
import { createClient } from '@/lib/supabase/server'
import { leerContexto } from '@/lib/plataforma/servidor'
import { KpiMetrica } from '@/lib/plataforma/metricas'
import { fechaHora } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Segmentos } from '@/components/sistema/procesos/piezas-r2'
import { ocultarReportado, revisarReporte } from '../acciones'

export const metadata: Metadata = { title: 'Moderación · Canal' }

const RUTA = '/sistema/nucleo/canal/moderacion'
const BOTON = 'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--borde)] bg-white px-3 text-xs font-medium text-marca-800 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500'
const BOTON_PELIGRO = 'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-acento-200 bg-white px-3 text-xs font-semibold text-acento-700 hover:bg-acento-50 focus-visible:outline-2 focus-visible:outline-acento-500'

/**
 * Lo que la gente reporta en el canal (guía 1.2 de la App Store): antes vivía
 * en /dashboard/reportes. El extracto es lo que decía lo reportado cuando se
 * reportó, congelado en el reporte por `reportar_contenido()`: se lee sin entrar
 * a la conversación de nadie, y de un mensaje directo reportado solo se ve ese
 * mensaje. Ocultar no borra nada y se deshace con «Restaurar».
 *
 * ⚠️ Esta pantalla muestra quién reportó. La persona reportada nunca la ve: la
 * tabla `reportes` solo se lee con la casilla `modulo:reportes`.
 */
export default async function ModeracionCanalPage({ searchParams }: PageProps<'/sistema/nucleo/canal/moderacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:reportes', 'ver'), searchParams])
  const ctx = await leerContexto(sp)
  const verRevisados = sp.estado === 'revisado'
  const puedeEditar = puede(sesion, 'modulo:reportes', 'editar')

  const supabase = await createClient()
  const [{ data: reportes }, { count: abiertos }, { count: revisados }] = await Promise.all([
    supabase
      .from('reportes')
      .select(
        'id, tipo, motivo, detalle, extracto, contexto, estado, oculto, revisado_en, created_at, reportante:empleados!reportes_reportante_id_fkey(nombre_completo, cargo), autor:empleados!reportes_autor_id_fkey(nombre_completo, cargo)'
      )
      .eq('estado', verRevisados ? 'revisado' : 'abierto')
      .order('created_at', { ascending: false })
      .range(0, 199),
    supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('estado', 'abierto'),
    supabase.from('reportes').select('id', { count: 'exact', head: true }).eq('estado', 'revisado'),
  ])
  const filas = reportes ?? []
  const volver = verRevisados ? `${RUTA}?estado=revisado` : RUTA

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Portal planta"
        migas={[{ etiqueta: 'Moderación' }]}
        descripcion="Lo que la gente reportó de las publicaciones, los comentarios y los mensajes, con el texto congelado al momento del reporte. Lo que se oculta no se borra: se puede restaurar."
      />

      {sp.aviso === 'error' && (
        <p role="alert" className="mb-3 rounded-xl border border-acento-200 bg-acento-50 px-3.5 py-2.5 text-[12.5px] text-acento-800">
          No se pudo guardar el cambio. Inténtalo otra vez.
        </p>
      )}

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiMetrica clave="canal_reportes_abiertos" ctx={ctx} sesion={sesion} />
        <KpiMetrica clave="canal_reportes_abiertos" ctx={ctx} sesion={sesion} parte={{ detalle: 'ocultos', titulo: 'Contenido oculto', texto: 'Ocultado por moderación; se puede restaurar', href: `${RUTA}?estado=revisado` }} />
      </div>

      <Segmentos
        etiqueta="Estado de los reportes"
        activa={verRevisados ? 'revisado' : 'abierto'}
        opciones={[
          { valor: 'abierto', etiqueta: 'Por revisar', href: RUTA, n: abiertos ?? 0 },
          { valor: 'revisado', etiqueta: 'Revisados', href: `${RUTA}?estado=revisado`, n: revisados ?? 0 },
        ]}
      />

      <section className="overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        {filas.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <h2 className="text-[14px] font-semibold text-marca-900">{verRevisados ? 'Todavía no hay reportes revisados' : 'No hay reportes por revisar'}</h2>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] text-marca-500">
              {verRevisados ? 'Cuando marques uno como revisado, queda aquí.' : 'Cuando alguien reporte algo desde la app, aparece aquí con lo que decía.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--borde)]">
            {filas.map((r) => (
              <li key={r.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-[#eef0f3] px-2 py-0.5 text-[11px] font-semibold text-marca-700">{TIPOS_REPORTABLES[r.tipo as TipoReportable] ?? r.tipo}</span>
                    <span className="rounded-full bg-[#fdf4e3] px-2 py-0.5 text-[11px] font-semibold text-[#8a5a12]">{MOTIVOS_REPORTE[r.motivo as MotivoReporte] ?? r.motivo}</span>
                    {r.oculto && <span className="rounded-full bg-acento-50 px-2 py-0.5 text-[11px] font-semibold text-acento-700">Oculto</span>}
                  </div>
                  <time dateTime={r.created_at} className="text-[12px] text-marca-500 tabular-nums">
                    {fechaHora(r.created_at)}
                  </time>
                </div>
                {r.contexto && <p className="mt-1.5 text-[12px] text-marca-500">{r.contexto}</p>}
                <blockquote className="mt-1.5 rounded-lg bg-marca-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line text-marca-800">{r.extracto || 'Sin texto'}</blockquote>
                {r.detalle && (
                  <p className="mt-1.5 text-[12.5px] text-marca-600">
                    <span className="font-semibold">Lo que añadió quien reportó:</span> {r.detalle}
                  </p>
                )}
                <dl className="mt-2 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
                  <div>
                    <dt className="text-marca-500">Lo escribió</dt>
                    <dd className="font-medium text-marca-800">
                      {r.autor ? (
                        <>
                          {r.autor.nombre_completo}
                          {r.autor.cargo && <span className="font-normal text-marca-500"> · {legible(r.autor.cargo)}</span>}
                        </>
                      ) : (
                        'La empresa (sin autor)'
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-marca-500">Lo reportó</dt>
                    <dd className="font-medium text-marca-800">
                      {r.reportante?.nombre_completo ?? 'Persona que ya no está en el padrón'}
                      {r.reportante?.cargo && <span className="font-normal text-marca-500"> · {legible(r.reportante.cargo)}</span>}
                    </dd>
                  </div>
                </dl>
                {r.revisado_en && <p className="mt-1.5 text-[11.5px] text-marca-500">Revisado el {fechaHora(r.revisado_en)}</p>}
                {puedeEditar && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <form action={revisarReporte}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="volver" value={volver} />
                      <input type="hidden" name="revisado" value={r.estado === 'abierto' ? 'si' : 'no'} />
                      <button type="submit" className={BOTON}>
                        {r.estado === 'abierto' ? 'Marcar como revisado' : 'Reabrir'}
                      </button>
                    </form>
                    <form action={ocultarReportado}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="volver" value={volver} />
                      <input type="hidden" name="ocultar" value={r.oculto ? 'no' : 'si'} />
                      {r.oculto ? (
                        <button type="submit" className={BOTON}>
                          Restaurar lo reportado
                        </button>
                      ) : (
                        <button type="submit" className={BOTON_PELIGRO}>
                          <span aria-hidden>⊘</span>
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
