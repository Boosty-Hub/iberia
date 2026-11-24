import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaHora, fechaLarga, numero } from '@/lib/plataforma/formato'
import { ESTADO_LOTE } from '@/components/sistema/cambios/estado'
import { nombresDe } from '@/components/sistema/flujo/datos'

export const metadata: Metadata = { title: 'Lote de cambios · Plataforma Iberia' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Un lote de cambios: quién lo pidió, desde cuándo rige, cada cambio en orden y en qué va su aprobación. Lo ven su autor
 * y quien aprueba cambios (la RLS de `org.escenario` y `org.cambio`); la decisión se toma en la Bandeja.
 */
export default async function LoteCambiosPage({ params }: PageProps<'/sistema/cambios/[id]'>) {
  const [sesion, { id }] = await Promise.all([requerirSesion(), params])
  if (!UUID.test(id)) notFound()
  const supabase = await createClient()
  const org = supabase.schema('org')
  const [{ data: lote }, { data: cambios }, { data: solicitudes }] = await Promise.all([
    org.from('escenario').select('id, nombre, estado, vigente_desde, creado_en, publicado_en, descripcion, creado_por, tipo').eq('id', id).eq('tipo', 'cambios').maybeSingle(),
    org.from('cambio').select('id, descripcion, creado_en').eq('escenario_id', id).order('orden'),
    supabase
      .schema('flujo')
      .from('solicitud')
      .select('id, estado, creado_en, cerrado_en, paso(orden, nombre, decision, decidido_por, decidido_en, comentario)')
      .eq('tipo_objeto', 'cambios')
      .eq('objeto_id', id)
      .order('creado_en', { ascending: false }),
  ])
  if (!lote) notFound()
  type Paso = { orden: number; nombre: string; decision: string; decidido_por: string | null; decidido_en: string | null; comentario: string | null }
  const pasos = (solicitudes ?? []).flatMap((s) => ((s.paso ?? []) as unknown as Paso[]).map((p) => ({ ...p, solicitud: s.creado_en })))
  const nombres = await nombresDe(supabase, [lote.creado_por, ...pasos.map((p) => p.decidido_por)])
  const e = ESTADO_LOTE[lote.estado] ?? { etiqueta: lote.estado, clase: '' }
  const mio = lote.creado_por === sesion.userId

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-DIA"
        titulo="Lote de cambios"
        migas={[{ etiqueta: 'Mis cambios', href: '/sistema/cambios' }, { etiqueta: 'Lote' }]}
        descripcion={`Pedido por ${nombres[lote.creado_por ?? ''] ?? 'alguien'} el ${fechaHora(lote.creado_en)}${lote.vigente_desde ? ` · rige desde el ${fechaLarga(lote.vigente_desde)}` : ''}.`}
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${e.clase}`}>{e.etiqueta}</span>
          {lote.estado === 'en_aprobacion' && !mio && (
            <Link href="/sistema/bandeja" className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-3 text-[12px] font-semibold text-white hover:bg-marca-700">
              Decidir en la Bandeja
            </Link>
          )}
          {lote.descripcion && <span className="text-[12.5px] text-marca-600">Nota: {lote.descripcion}</span>}
        </div>

        <section className="rounded-xl border border-[var(--borde)] bg-white">
          <h2 className="border-b border-[var(--borde)] px-4 py-3 text-[14px] font-bold text-marca-900">
            {numero(cambios?.length ?? 0)} cambio{cambios?.length === 1 ? '' : 's'}, en el orden en que se aplican
          </h2>
          <ol className="divide-y divide-[var(--borde)]">
            {(cambios ?? []).map((c, i) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-0.5 w-6 shrink-0 text-right text-[12px] text-marca-400 tabular-nums">{i + 1}.</span>
                <p className="min-w-0 flex-1 text-[13px] text-marca-900">{c.descripcion}</p>
              </li>
            ))}
          </ol>
        </section>

        {pasos.length > 0 && (
          <section className="rounded-xl border border-[var(--borde)] bg-white">
            <h2 className="border-b border-[var(--borde)] px-4 py-3 text-[14px] font-bold text-marca-900">La aprobación</h2>
            <ul className="divide-y divide-[var(--borde)]">
              {pasos.map((p, i) => (
                <li key={i} className="px-4 py-2.5 text-[13px]">
                  <span className="font-semibold text-marca-900">{p.nombre}</span>
                  <span className="text-marca-500">
                    {' '}
                    · {p.decision === 'pendiente' ? 'pendiente' : `${p.decision} por ${nombres[p.decidido_por ?? ''] ?? '—'} el ${fechaHora(p.decidido_en ?? '')}`}
                  </span>
                  {p.comentario && <p className="mt-0.5 text-[12.5px] text-marca-600">«{p.comentario}»</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  )
}
