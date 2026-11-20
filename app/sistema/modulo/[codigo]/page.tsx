import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { puede, requerirSesion } from '@/lib/auth'
import { ANATOMIA, ESTADO_MODULO, PESTANAS } from '@/lib/plataforma/dominios'
import { modulosDelPlan } from '@/lib/plataforma/servidor'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'

export async function generateMetadata({ params }: PageProps<'/sistema/modulo/[codigo]'>): Promise<Metadata> {
  const { codigo } = await params
  const m = (await modulosDelPlan()).find((x) => x.codigo === codigo)
  return { title: m ? `${m.nombre} · Plan` : 'Módulo' }
}

/**
 * La anatomía de un módulo del plan que todavía no tiene pantallas: qué es, en
 * qué fase entra y qué pestañas va a tener. **El plan es dato**: todo sale de
 * `control.modulo`. Lo abre cualquiera con sesión (es el plan, no el dato).
 */
export default async function ModuloPage({ params }: PageProps<'/sistema/modulo/[codigo]'>) {
  const [sesion, { codigo }] = await Promise.all([requerirSesion(), params])
  const m = (await modulosDelPlan()).find((x) => x.codigo === codigo)
  if (!m) notFound()
  const conPantalla = m.ruta && m.estado !== 'planificado' && (!m.recurso || puede(sesion, m.recurso))
  const pestanas = PESTANAS[m.codigo] ?? []

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo={m.codigo} pestanas={[]} descripcion={m.descripcion} />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="text-[13px] font-semibold text-marca-900">La anatomía de este módulo</h2>
          <p className="mt-1 text-[12.5px] text-marca-500">
            Todos los módulos de la plataforma comparten estas pestañas: así se aprende uno y se saben todos. Las propias del módulo se suman cuando se construye.
          </p>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {ANATOMIA.map((a, i) => (
              <li key={a.etiqueta} className="rounded-lg border border-dashed border-[#d5d8dd] bg-[#fbfbfc] p-3">
                <p className="text-[11px] text-marca-400">{i + 1}</p>
                <p className="font-semibold text-marca-800">{a.etiqueta}</p>
                <p className="mt-0.5 text-[12px] text-marca-500">{a.para}</p>
              </li>
            ))}
          </ol>
        </section>

        <aside className="flex flex-col gap-3">
          <dl className="rounded-xl border border-[var(--borde)] bg-white p-4 text-[12.5px]">
            <div className="flex justify-between gap-3 border-b border-[#eef0f3] py-1.5">
              <dt className="text-marca-400">Código</dt>
              <dd className="font-mono">{m.codigo}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-[#eef0f3] py-1.5">
              <dt className="text-marca-400">Dominio</dt>
              <dd className="text-right">{m.dominio}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-[#eef0f3] py-1.5">
              <dt className="text-marca-400">Estado</dt>
              <dd className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: ESTADO_MODULO[m.estado].color }} aria-hidden />
                {ESTADO_MODULO[m.estado].etiqueta}
              </dd>
            </div>
            <div className="py-1.5">
              <dt className="text-marca-400">Fase</dt>
              <dd className="mt-0.5 text-marca-800">{m.fase ?? 'Por definir'}</dd>
            </div>
          </dl>
          {conPantalla && m.ruta && (
            <Link href={m.ruta} className="inline-flex h-9 items-center justify-center rounded-lg bg-[#2b2a28] px-3 text-xs font-semibold text-white hover:bg-marca-700">
              Abrir el módulo
            </Link>
          )}
          {pestanas.length > 0 && conPantalla && (
            <ul className="rounded-xl border border-[var(--borde)] bg-white p-2 text-[12.5px]">
              {pestanas.map((p) => (
                <li key={p.href}>
                  <Link href={p.href} className="block rounded-md px-2 py-1.5 hover:bg-marca-50">
                    {p.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="px-1 text-[11.5px] text-marca-400">Lo que dice esta página sale del registro de módulos del plan (NUC-CFG). Cambia el plan y cambia la página.</p>
        </aside>
      </div>
    </>
  )
}
