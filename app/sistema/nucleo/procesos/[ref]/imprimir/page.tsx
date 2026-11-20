import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { fichaProceso } from '@/lib/plataforma/fichas/procesos'
import { fechaHora } from '@/lib/plataforma/formato'
import { BotonImprimir } from '@/components/sistema/procesos/boton-imprimir'
import type { BloqueFicha, DatoFicha } from '@/lib/plataforma/ficha-tipos'

export const metadata: Metadata = { title: 'Ficha de proceso · versión para imprimir' }

/**
 * La ficha PHVA lista para imprimir o guardar en PDF desde el navegador: el
 * cajetín (código, versión, estado, dueño, fecha de impresión), los datos, la
 * ficha PHVA completa y la ruta de aprobación. Lo que se imprime es lo mismo
 * que muestra la ficha, con la misma RLS. No es el documento controlado: ese
 * sale con plantilla versionada en NUC-DOC (F2).
 */
export default async function ImprimirProcesoPage({ params }: PageProps<'/sistema/nucleo/procesos/[ref]/imprimir'>) {
  const [sesion, { ref }] = await Promise.all([requerirPermiso('sistema:procesos'), params])
  const ficha = await fichaProceso(sesion, ref)
  if (!ficha) notFound()
  const phva = ficha.secciones?.find((s) => s.clave === 'phva')?.bloques ?? []
  const ciclo = ficha.secciones?.find((s) => s.clave === 'ciclo')?.bloques ?? []
  const pasos = ciclo.find((b): b is Extract<BloqueFicha, { tipo: 'pasos' }> => b.tipo === 'pasos')
  const dato = (etiqueta: string) => ficha.datos.find((d) => d.etiqueta === etiqueta)?.valor ?? '—'

  const tabla = (filas: DatoFicha[]) => (
    <table className="w-full border-collapse text-[12px]">
      <tbody>
        {filas.map((f) => (
          <tr key={f.etiqueta} className="align-top">
            <th scope="row" className="w-44 border border-[#d9dce1] bg-[#f6f7f9] px-2 py-1 text-left font-semibold text-marca-700">
              {f.etiqueta}
            </th>
            <td className={`border border-[#d9dce1] px-2 py-1 whitespace-pre-line text-marca-900 ${f.mono ? 'font-mono text-[11px]' : ''}`}>{f.valor}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  return (
    <>
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .hoja-impresion, .hoja-impresion * { visibility: visible !important; }
        .hoja-impresion { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; }
        .solo-pantalla { display: none !important; }
        @page { margin: 14mm; }
      }`}</style>
      <div className="solo-pantalla mb-3 flex flex-wrap items-center gap-2">
        <Link href={`/sistema/nucleo/procesos/${ref}`} className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs text-marca-800 hover:bg-marca-50">
          ← Volver a la ficha
        </Link>
        <BotonImprimir className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700" />
        <span className="text-[11.5px] text-marca-500">En el diálogo, elige «Guardar como PDF».</span>
      </div>
      <article className="hoja-impresion mx-auto max-w-[800px] rounded-xl border border-[var(--borde)] bg-white p-6 text-marca-900">
        <header className="mb-4 grid grid-cols-[auto_1fr_auto] items-start gap-4 border-b-2 border-[#2b2a28] pb-3">
          <span className="rounded-md bg-[#D4332C] px-2 py-1 text-[13px] font-extrabold text-white">IB</span>
          <div>
            <p className="text-[10.5px] font-semibold tracking-[0.12em] text-marca-500 uppercase">Industrias Iberia · Mapa de proceso y ciclo PHVA</p>
            <h1 className="text-[19px] leading-tight font-bold">{ficha.titulo}</h1>
            <p className="text-[12px] text-marca-600">{ficha.subtitulo}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-2 text-[11px]">
            <dt className="text-marca-500">Código</dt>
            <dd className="font-mono">{ficha.codigo ?? '—'}</dd>
            <dt className="text-marca-500">Estado</dt>
            <dd>{ficha.estado?.etiqueta ?? '—'}</dd>
            <dt className="text-marca-500">Impreso</dt>
            <dd>{fechaHora(new Date().toISOString())}</dd>
          </dl>
        </header>

        <h2 className="mb-1.5 text-[13px] font-bold">Datos del proceso</h2>
        {tabla(ficha.datos.filter((d) => !['Nombre'].includes(d.etiqueta)))}

        {phva.map((b, i) =>
          b.tipo === 'datos' ? (
            <section key={i} className="mt-4 break-inside-avoid">
              <h2 className="mb-1.5 text-[13px] font-bold">{b.titulo}</h2>
              {tabla(b.filas)}
            </section>
          ) : null
        )}

        {pasos && (
          <section className="mt-4 break-inside-avoid">
            <h2 className="mb-1.5 text-[13px] font-bold">{pasos.titulo}</h2>
            {tabla(pasos.pasos.map((p) => ({ etiqueta: `${p.orden}. ${p.nombre}`, valor: [p.estado, p.en ? fechaHora(p.en) : null, p.comentario ? `«${p.comentario}»` : null].filter(Boolean).join(' · ') })))}
          </section>
        )}

        <footer className="mt-6 border-t border-[#d9dce1] pt-2 text-[10.5px] text-marca-500">
          Copia no controlada, válida al {fechaHora(new Date().toISOString())}. Dueño: {dato('Dueño (plaza)')}. La versión vigente es la de la Plataforma Iberia.
        </footer>
      </article>
    </>
  )
}
