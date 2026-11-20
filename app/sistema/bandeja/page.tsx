import type { Metadata } from 'next'
import Link from 'next/link'
import { nombresDe, plazasDe } from '@/components/sistema/flujo/datos'
import { DecidirPaso } from '@/components/sistema/flujo/decidir-paso'
import { ESTADO_SOLICITUD, RESOLUTOR, TIPO_OBJETO, diasDesde, diasTexto, enlaceObjeto, fechaHora, type Regla } from '@/components/sistema/flujo/formato'
import { EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mis aprobaciones' }

/**
 * Una sola bandeja para todo lo que se firma en la plataforma: requisiciones,
 * fichas de proceso y escenarios. Arriba, lo que te toca decidir ahora (lo
 * resuelve la base con `flujo.bandeja()`, la misma regla que `flujo.decidir`);
 * abajo, lo que pediste y en qué va.
 */
export default async function BandejaPage() {
  const sesion = await requerirSesion()
  const supabase = await createClient()
  const flujo = supabase.schema('flujo')

  const [{ data: pendientes }, { data: mias }] = await Promise.all([
    flujo.rpc('bandeja'),
    flujo
      .from('solicitud')
      .select('id, tipo_objeto, objeto_id, titulo, estado, paso_actual, creado_en, cerrado_en, paso(orden, nombre)')
      .eq('creado_por', sesion.userId)
      .order('creado_en', { ascending: false })
      .range(0, 99),
  ])
  const porDecidir = pendientes ?? []
  const pedidas = mias ?? []

  // Las fichas de proceso se abren por su identidad estable, no por la versión.
  const procesos = [...porDecidir, ...pedidas].filter((x) => x.tipo_objeto === 'proceso').map((x) => x.objeto_id)
  const [refs, plazas] = await Promise.all([
    procesos.length ? supabase.schema('sgc').from('proceso').select('id, ref').in('id', procesos) : null,
    plazasDe(supabase, porDecidir.map((p) => p.aprobador_plaza_ref)),
  ])
  const refDe = new Map((refs?.data ?? []).map((p) => [p.id, p.ref]))
  const nombres = await nombresDe(supabase, porDecidir.map((p) => p.aprobador_perfil))

  return (
    <>
      <EncabezadoPagina
        rotulo="Plataforma"
        titulo="Mis aprobaciones"
        descripcion="Lo que te toca firmar, de cualquier módulo, y lo que pediste tú. Quién firma cada paso lo decide la ruta de aprobación a partir de la estructura, no la persona."
      />

      <section aria-labelledby="por-decidir" className="mb-10">
        <h2 id="por-decidir" className="mb-3 flex items-center gap-2 text-base font-semibold text-marca-900">
          Por decidir
          <Insignia tono={porDecidir.length ? 'acento' : 'neutro'}>{porDecidir.length}</Insignia>
        </h2>
        {!porDecidir.length ? (
          <EstadoVacio titulo="No tienes nada por decidir" descripcion="Cuando una solicitud llegue a un paso que te toca, aparece aquí." />
        ) : (
          <ul className="space-y-4">
            {porDecidir.map((p) => {
              const href = enlaceObjeto(p.tipo_objeto, p.objeto_id, refDe.get(p.objeto_id))
              const regla = p.regla as Regla
              const dias = diasDesde(p.esperando_desde)
              return (
                // La llave es la solicitud, no el paso: al aprobar, el paso cambia y el aviso de
                // lo que pasó se habría perdido con el componente.
                <li key={p.solicitud_id} className="tarjeta p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Insignia tono="marca">{TIPO_OBJETO[p.tipo_objeto] ?? p.tipo_objeto}</Insignia>
                        {p.hito && <Insignia tono="acento">Aprueba el objeto</Insignia>}
                        <span className="text-xs text-marca-500">esperando {dias === 0 ? 'desde hoy' : diasTexto(dias)}</span>
                      </div>
                      <p className="mt-2 font-semibold text-marca-900">{p.titulo}</p>
                      <p className="mt-0.5 text-sm text-marca-600">
                        Paso {p.orden}: {p.paso}
                      </p>
                      <p className="mt-0.5 text-xs text-marca-500">
                        Pidió {p.pedido_por_nombre ?? '—'} el {fechaHora(p.pedido_en)} · {RESOLUTOR[regla?.resolutor ?? ''] ?? '—'}
                        {p.aprobador_plaza_ref && plazas[p.aprobador_plaza_ref] ? ` → ${plazas[p.aprobador_plaza_ref]}` : ''}
                        {p.aprobador_perfil && nombres[p.aprobador_perfil] ? ` (${nombres[p.aprobador_perfil]})` : ''}
                        {regla?.sin_cuenta ? ' · la plaza no tiene cuenta: decides como administrador de aprobaciones' : ''}
                      </p>
                    </div>
                    {href && (
                      <Link href={href} className="btn-neutro h-10 shrink-0">
                        Abrir para revisar
                      </Link>
                    )}
                  </div>
                  <div className="mt-4 border-t border-[var(--borde)] pt-4">
                    <DecidirPaso
                      compacto
                      pasoId={p.paso_id}
                      accion={p.accion}
                      nombre={p.paso}
                      requisicionId={p.tipo_objeto === 'requisicion_personal' ? p.objeto_id : undefined}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="lo-que-pedi">
        <h2 id="lo-que-pedi" className="mb-3 text-base font-semibold text-marca-900">
          Lo que pedí
        </h2>
        {!pedidas.length ? (
          <p className="text-sm text-marca-500">No has enviado nada a aprobación.</p>
        ) : (
          <ul className="tarjeta divide-y divide-[var(--borde)] overflow-hidden">
            {pedidas.map((s) => {
              const est = ESTADO_SOLICITUD[s.estado] ?? { etiqueta: s.estado, tono: 'neutro' as const }
              const pasos = (s.paso ?? []) as unknown as { orden: number; nombre: string }[]
              const actual = pasos.find((x) => x.orden === s.paso_actual)
              const href = enlaceObjeto(s.tipo_objeto, s.objeto_id, refDe.get(s.objeto_id))
              const cuerpo = (
                <>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-marca-900">{s.titulo}</span>
                    <span className="block text-xs text-marca-500">
                      {TIPO_OBJETO[s.tipo_objeto] ?? s.tipo_objeto} · enviada el {fechaHora(s.creado_en)}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-marca-600">
                    <Insignia tono={est.tono}>{est.etiqueta}</Insignia>
                    {s.estado === 'en_curso' && actual && <span>en «{actual.nombre}»</span>}
                  </span>
                </>
              )
              return (
                <li key={s.id}>
                  {href ? (
                    <Link href={href} className="grid gap-2 px-5 py-3.5 hover:bg-marca-50/60 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className="grid gap-2 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">{cuerpo}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
