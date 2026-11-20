import { Insignia } from '@/components/ui'
import { monto } from './formato'

export type Impacto = {
  fecha?: string
  dotacion_aprobada?: number
  dotacion_ocupada?: number
  dotacion_despues?: number
  plan_del_anio?: number | null
  fuera_de_plan?: boolean
  tramo_jefe_antes?: number
  tramo_jefe_despues?: number
  procesos_del_cargo?: { nombre: string; codigo: string | null }[]
  rutas_donde_firma?: { ruta: string; paso: string }[]
  plazas_que_le_reportan?: number
}

export type Costo = {
  salario_ves?: number
  bonos_ves?: number
  componentes?: { nombre: string; monto_ves: number | null; por_confirmar: boolean }[]
  total_ves?: number
  total_usd?: number | null
  tasa?: number | null
  fecha?: string
  por_confirmar?: boolean
} | null

function Cifra({ etiqueta, antes, despues, nota }: { etiqueta: string; antes: number | string; despues?: number | string; nota?: string }) {
  const cambia = despues !== undefined && despues !== antes
  return (
    <div className="rounded-xl border border-marca-200/70 bg-white p-4">
      <p className="text-xs font-medium tracking-wide text-marca-500 uppercase">{etiqueta}</p>
      <p className="mt-1 flex items-baseline gap-2 text-2xl font-bold tracking-tight text-marca-900 tabular-nums">
        {antes}
        {cambia && (
          <>
            <span className="text-base font-medium text-marca-400" aria-label="pasa a">
              →
            </span>
            <span className="text-acento-700">{despues}</span>
          </>
        )}
      </p>
      {nota && <p className="mt-1 text-xs text-marca-500">{nota}</p>}
    </div>
  )
}

/** El impacto de una requisición: dotación, plan, tramo de control y dependencias. Sin costos. */
export function ImpactoRequisicion({ impacto }: { impacto: Impacto }) {
  const procesos = impacto.procesos_del_cargo ?? []
  const rutas = impacto.rutas_donde_firma ?? []
  const plan = impacto.plan_del_anio
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cifra
          etiqueta="Dotación de la unidad"
          antes={impacto.dotacion_aprobada ?? 0}
          despues={impacto.dotacion_despues}
          nota="Aprobada hoy → después de aprobarse"
        />
        <Cifra etiqueta="Ocupada hoy" antes={impacto.dotacion_ocupada ?? 0} nota="Titulares en las plazas de la unidad" />
        <div className="rounded-xl border border-marca-200/70 bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-marca-500 uppercase">Plan del año</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-marca-900 tabular-nums">{plan ?? '—'}</p>
          <p className="mt-1">
            {impacto.fuera_de_plan ? (
              <Insignia tono="ambar">Fuera de plan</Insignia>
            ) : plan === null || plan === undefined ? (
              <span className="text-xs text-marca-500">Sin plan aprobado para este cargo y unidad</span>
            ) : (
              <Insignia tono="verde">Dentro del plan</Insignia>
            )}
          </p>
        </div>
        <Cifra
          etiqueta="Tramo de control del jefe"
          antes={impacto.tramo_jefe_antes ?? 0}
          despues={impacto.tramo_jefe_despues}
          nota="Plazas que le reportan directo"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-marca-200/70 bg-white p-4">
          <p className="text-sm font-semibold text-marca-800">Procesos que dirige el cargo</p>
          {procesos.length ? (
            <ul className="mt-2 space-y-1 text-sm text-marca-700">
              {procesos.map((p, i) => (
                <li key={i}>
                  {p.codigo && <span className="mr-1.5 font-mono text-xs text-marca-500">{p.codigo}</span>}
                  {p.nombre}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-marca-500">Ninguno: el cargo no es dueño de procesos vigentes.</p>
          )}
        </div>
        <div className="rounded-xl border border-marca-200/70 bg-white p-4">
          <p className="text-sm font-semibold text-marca-800">Rutas de aprobación donde firma</p>
          {rutas.length ? (
            <ul className="mt-2 space-y-1 text-sm text-marca-700">
              {rutas.map((r, i) => (
                <li key={i}>
                  {r.ruta} · <span className="text-marca-500">{r.paso}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-marca-500">No firma en ninguna ruta activa.</p>
          )}
        </div>
        <div className="rounded-xl border border-marca-200/70 bg-white p-4">
          <p className="text-sm font-semibold text-marca-800">Plazas que le reportan</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-marca-900 tabular-nums">{impacto.plazas_que_le_reportan ?? 0}</p>
          <p className="text-xs text-marca-500">En la plaza de este cargo en la unidad</p>
        </div>
      </div>
    </div>
  )
}

/** El costo incremental: por persona y por la cantidad pedida, al mes y al año. Perímetro de nómina. */
export function CostoRequisicion({ costo, cantidad, congelado }: { costo: Costo; cantidad: number; congelado: boolean }) {
  if (!costo) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Falta el costo de referencia de este cargo: sin él no hay cifra. Se carga en Dotación y costos.
      </p>
    )
  }
  const mes = costo.total_ves ?? 0
  const mesUsd = costo.total_usd ?? null
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-marca-200/70 bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-marca-500 uppercase">Por persona al mes</p>
          <p className="mt-1 text-lg font-bold text-marca-900 tabular-nums">{monto(mes)}</p>
          {mesUsd !== null && <p className="text-xs text-marca-500 tabular-nums">{monto(mesUsd, 'USD')}</p>}
        </div>
        <div className="rounded-xl border border-marca-200/70 bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-marca-500 uppercase">Por persona al año</p>
          <p className="mt-1 text-lg font-bold text-marca-900 tabular-nums">{monto(mes * 12)}</p>
          {mesUsd !== null && <p className="text-xs text-marca-500 tabular-nums">{monto(mesUsd * 12, 'USD')}</p>}
        </div>
        <div className="rounded-xl border border-acento-200 bg-acento-50/40 p-4">
          <p className="text-xs font-medium tracking-wide text-marca-500 uppercase">× {cantidad} al mes</p>
          <p className="mt-1 text-lg font-bold text-acento-800 tabular-nums">{monto(mes * cantidad)}</p>
          {mesUsd !== null && <p className="text-xs text-marca-500 tabular-nums">{monto(mesUsd * cantidad, 'USD')}</p>}
        </div>
        <div className="rounded-xl border border-acento-200 bg-acento-50/40 p-4">
          <p className="text-xs font-medium tracking-wide text-marca-500 uppercase">× {cantidad} al año</p>
          <p className="mt-1 text-lg font-bold text-acento-800 tabular-nums">{monto(mes * cantidad * 12)}</p>
          {mesUsd !== null && <p className="text-xs text-marca-500 tabular-nums">{monto(mesUsd * cantidad * 12, 'USD')}</p>}
        </div>
      </div>
      <details className="rounded-xl border border-marca-200/70 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium text-marca-800">Cómo se compone (costo de referencia del cargo, no el salario de nadie)</summary>
        <ul className="mt-3 space-y-1 text-marca-700">
          <li className="flex justify-between gap-3">
            <span>Salario de referencia</span>
            <span className="tabular-nums">{monto(costo.salario_ves)}</span>
          </li>
          {!!costo.bonos_ves && (
            <li className="flex justify-between gap-3">
              <span>Bonos en divisas</span>
              <span className="tabular-nums">{monto(costo.bonos_ves)}</span>
            </li>
          )}
          {(costo.componentes ?? []).map((c, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span>
                {c.nombre}
                {c.por_confirmar && <span className="ml-1.5 text-xs text-amber-700">por confirmar</span>}
              </span>
              <span className="tabular-nums">{monto(c.monto_ves)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-marca-500">
          {congelado ? 'Calculado y congelado al enviar' : 'Calculado hoy'}
          {costo.tasa ? ` · tasa ${costo.tasa.toLocaleString('es-VE')} Bs./USD` : ' · sin tasa de cambio cargada'}
          {costo.por_confirmar ? ' · hay componentes por confirmar con Capital Humano' : ''}
        </p>
      </details>
    </div>
  )
}
