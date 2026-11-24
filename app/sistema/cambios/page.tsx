import type { Metadata } from 'next'
import Link from 'next/link'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { DescartarCambios, EnviarCambios, QuitarCambio } from '@/components/sistema/cambios/formularios'
import { puede, requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaHora, fechaLarga, hoyCaracas, numero } from '@/lib/plataforma/formato'
import { ESTADO_LOTE } from '@/components/sistema/cambios/estado'

export const metadata: Metadata = { title: 'Mis cambios · Plataforma Iberia' }

/**
 * Mis cambios (24-nov-2026): todo lo que edito en la estructura, los cargos, los costos, el plan o el cruce queda aquí, en
 * mi borrador, hasta que lo envío y lo aprueba quien tiene «Aprobar cambios». Nada entra a la realidad sin esa firma.
 */
export default async function MisCambiosPage({ searchParams }: PageProps<'/sistema/cambios'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  const supabase = await createClient()
  const org = supabase.schema('org')
  const { data: lotes } = await org
    .from('escenario')
    .select('id, nombre, estado, vigente_desde, creado_en, publicado_en, descripcion, cambio(count)')
    .eq('tipo', 'cambios')
    .eq('creado_por', sesion.userId)
    .order('creado_en', { ascending: false })
    .range(0, 49)
  const abierto = (lotes ?? []).find((l) => l.estado === 'borrador')
  const { data: cambios } = abierto
    ? await org.from('cambio').select('id, descripcion, creado_en').eq('escenario_id', abierto.id).order('orden')
    : { data: [] as { id: string; descripcion: string; creado_en: string }[] }
  const enviados = (lotes ?? []).filter((l) => l.estado !== 'borrador')
  const apruebo = puede(sesion, 'sistema:cambios', 'editar')

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-DIA"
        titulo="Mis cambios"
        migas={[{ etiqueta: 'Mis cambios' }]}
        descripcion="Lo que editas en la estructura, las personas, los cargos, los costos, el plan de dotación o el cruce queda aquí, en tu borrador. Entra a la realidad cuando lo envías y lo aprueba quien tiene «Aprobar cambios» en su rol."
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        {sp.enviado && (
          <p role="status" className="rounded-xl bg-[#e7f5ee] px-4 py-3 text-[13px] text-[#1f6f4b]">
            ✓ Enviado a aprobación. Está en «Enviados»; quien aprueba lo ve en su Bandeja. Si lo devuelven, vuelve a tu borrador.
          </p>
        )}
        {sp.descartado && (
          <p role="status" className="rounded-xl bg-[#eef0f3] px-4 py-3 text-[13px] text-marca-700">
            Borrador descartado. La realidad no se tocó.
          </p>
        )}
        {apruebo && (
          <p className="rounded-xl border border-[var(--borde)] bg-white px-4 py-3 text-[12.5px] text-marca-600">
            Tu rol aprueba cambios: los que te mandan están en la{' '}
            <Link href="/sistema/bandeja" className="font-semibold text-acento-700 hover:underline">
              Bandeja
            </Link>
            . Los tuyos los aprueba otra persona.
          </p>
        )}

        <section className="rounded-xl border border-[var(--borde)] bg-white">
          <div className="flex items-center justify-between border-b border-[var(--borde)] px-4 py-3">
            <h2 className="text-[14px] font-bold text-marca-900">En tu borrador</h2>
            <span className="rounded-md bg-[#eef0f3] px-2 text-[12px] font-semibold text-marca-600 tabular-nums">{numero(cambios?.length ?? 0)}</span>
          </div>
          {cambios?.length ? (
            <ol className="divide-y divide-[var(--borde)]">
              {cambios.map((c, i) => (
                <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="mt-0.5 w-6 shrink-0 text-right text-[12px] text-marca-400 tabular-nums">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-marca-900">{c.descripcion}</p>
                    <p className="text-[11.5px] text-marca-400">Propuesto {fechaHora(c.creado_en)}</p>
                  </div>
                  <QuitarCambio id={c.id} />
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-marca-500">
              No tienes cambios sin enviar. Edita una plaza, una unidad, un cargo o una celda: el cambio queda aquí hasta que lo envíes.
            </p>
          )}
        </section>

        {abierto && (cambios?.length ?? 0) > 0 && (
          <>
            <EnviarCambios escenario={abierto.id} hoy={hoyCaracas()} n={cambios!.length} />
            <DescartarCambios escenario={abierto.id} />
          </>
        )}

        <section className="rounded-xl border border-[var(--borde)] bg-white">
          <h2 className="border-b border-[var(--borde)] px-4 py-3 text-[14px] font-bold text-marca-900">Enviados</h2>
          {enviados.length ? (
            <ul className="divide-y divide-[var(--borde)]">
              {enviados.map((l) => {
                const e = ESTADO_LOTE[l.estado] ?? { etiqueta: l.estado, clase: 'bg-[#eef0f3] text-marca-600' }
                const n = (l.cambio as unknown as { count: number }[] | null)?.[0]?.count ?? 0
                return (
                  <li key={l.id}>
                    <Link href={`/sistema/cambios/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-marca-50">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${e.clase}`}>{e.etiqueta}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-marca-900">
                        {numero(n)} cambio{n === 1 ? '' : 's'}
                        {l.vigente_desde ? ` · rigen desde ${fechaLarga(l.vigente_desde)}` : ''}
                      </span>
                      <span className="text-[11.5px] text-marca-400">{fechaHora(l.publicado_en ?? l.creado_en)}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-[13px] text-marca-500">Todavía no has enviado cambios.</p>
          )}
        </section>
      </div>
    </>
  )
}
