import { Insignia } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ContextoFlujo, PasoVista, SolicitudVista } from './datos'
import { ACCION_PASO, DECISION, ESTADO_SOLICITUD, RESOLUTOR, fechaHora, textoCondicion } from './formato'

/**
 * La línea de tiempo de una solicitud: cada paso con quién lo tiene, qué decidió,
 * su comentario, la fecha y **la regla** que lo resolvió —cómo salió el
 * aprobador de la estructura—. Es la evidencia de que firmó quien tocaba.
 */
export function LineaTiempo({
  contexto,
  etiquetasOrigen = {},
}: {
  contexto: ContextoFlujo
  etiquetasOrigen?: Record<string, string>
}) {
  const { solicitudes } = contexto
  if (!solicitudes.length) {
    return <p className="text-sm text-marca-500">Todavía no se ha enviado a aprobación.</p>
  }
  return (
    <div className="space-y-6">
      {solicitudes.map((s, i) => (
        <Solicitud key={s.id} s={s} contexto={contexto} anterior={i > 0} etiquetasOrigen={etiquetasOrigen} />
      ))}
    </div>
  )
}

function Solicitud({
  s,
  contexto,
  anterior,
  etiquetasOrigen,
}: {
  s: SolicitudVista
  contexto: ContextoFlujo
  anterior: boolean
  etiquetasOrigen: Record<string, string>
}) {
  const est = ESTADO_SOLICITUD[s.estado] ?? { etiqueta: s.estado, tono: 'neutro' as const }
  return (
    <section className={cn(anterior && 'opacity-80')}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-marca-500">
        <Insignia tono={est.tono}>{est.etiqueta}</Insignia>
        <span>
          {anterior ? 'Envío anterior' : 'Enviada'} el {fechaHora(s.creado_en)}
          {s.creado_por && contexto.nombres[s.creado_por] ? ` por ${contexto.nombres[s.creado_por]}` : ''}
        </span>
        {s.cerrado_en && <span>· cerrada el {fechaHora(s.cerrado_en)}</span>}
      </div>
      <ol className="relative space-y-0">
        {s.pasos.map((p, i) => (
          <Paso
            key={p.id}
            p={p}
            actual={s.estado === 'en_curso' && s.paso_actual === p.orden}
            ultimo={i === s.pasos.length - 1}
            contexto={contexto}
            etiquetasOrigen={etiquetasOrigen}
          />
        ))}
      </ol>
    </section>
  )
}

function Paso({
  p,
  actual,
  ultimo,
  contexto,
  etiquetasOrigen,
}: {
  p: PasoVista
  actual: boolean
  ultimo: boolean
  contexto: ContextoFlujo
  etiquetasOrigen: Record<string, string>
}) {
  const dec = DECISION[p.decision] ?? { etiqueta: p.decision, tono: 'neutro' as const }
  const punto =
    p.decision === 'aprobado'
      ? 'bg-emerald-500 border-emerald-500'
      : p.decision === 'rechazado'
        ? 'bg-acento-600 border-acento-600'
        : p.decision === 'devuelto'
          ? 'bg-amber-400 border-amber-400'
          : actual
            ? 'bg-white border-acento-500 ring-4 ring-acento-100'
            : 'bg-white border-marca-300'

  const plaza = p.aprobador_plaza_ref ? contexto.plazas[p.aprobador_plaza_ref] : null
  const quien = p.aprobador_perfil ? contexto.nombres[p.aprobador_perfil] : null
  const resolutor = RESOLUTOR[p.regla?.resolutor ?? ''] ?? p.regla?.resolutor ?? '—'
  const cond = textoCondicion(p.regla?.condicion as Record<string, unknown> | null, etiquetasOrigen)

  return (
    <li className="relative flex gap-3 pb-5">
      {!ultimo && <span aria-hidden className="absolute top-5 left-[9px] h-[calc(100%-12px)] w-px bg-marca-200" />}
      <span aria-hidden className={cn('relative mt-1 h-[19px] w-[19px] shrink-0 rounded-full border-2', punto)} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn('text-sm font-semibold', p.decision === 'omitido' ? 'text-marca-400 line-through' : 'text-marca-900')}>
            {p.orden}. {p.nombre}
          </p>
          <Insignia tono={dec.tono}>{dec.etiqueta}</Insignia>
          {actual && <Insignia tono="acento">Le toca ahora</Insignia>}
          {p.hito && <Insignia tono="marca">Aprueba el objeto</Insignia>}
          {p.ve_costos && <Insignia tono="neutro">Ve costos</Insignia>}
        </div>
        <p className="mt-1 text-xs text-marca-600">
          {ACCION_PASO[p.accion]?.etiqueta ?? p.accion}: {plaza ?? (p.regla?.resolutor === 'rol' ? 'quien tenga el rol' : 'sin plaza resuelta')}
          {quien ? ` · ${quien}` : ''}
        </p>
        <p className="mt-0.5 text-xs text-marca-500">
          Regla: {resolutor}
          {p.regla?.sin_cuenta ? ' · la plaza no tiene cuenta en la plataforma: decide quien administra aprobaciones' : ''}
          {cond ? ` · ${p.decision === 'omitido' && !p.decidido_por ? 'no aplica: solo ' : 'aplica '}${cond}` : ''}
        </p>
        {p.decidido_en && (
          <p className="mt-1 text-xs text-marca-600">
            {p.decidido_por ? (contexto.nombres[p.decidido_por] ?? 'Alguien') : 'El sistema'} · {fechaHora(p.decidido_en)}
          </p>
        )}
        {p.comentario && (
          <p className="mt-2 rounded-xl border border-marca-200/70 bg-marca-50 px-3 py-2 text-sm text-marca-800">«{p.comentario}»</p>
        )}
      </div>
    </li>
  )
}
