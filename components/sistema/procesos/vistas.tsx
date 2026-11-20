import { Insignia } from '@/components/ui'
import { IconoAlerta, IconoCheck } from '@/components/iconos'
import { cn } from '@/lib/utils'
import {
  DECISIONES,
  ESTADOS_SOLICITUD,
  FASES_PHVA,
  LISTAS_FICHA,
  TONO_DECISION,
  fechaHora,
  type Diferencia,
  type Ficha,
} from './comun'
import type { SolicitudLeida } from './datos'
import { ListaSimple, Seccion } from './piezas'

/** La ficha PHVA ampliada, en lectura. */
export function FichaVista({ ficha }: { ficha: Ficha }) {
  const listas = Object.fromEntries(LISTAS_FICHA) as Record<string, string>
  const bloque = (k: (typeof LISTAS_FICHA)[number][0]) => (
    <Seccion key={k} titulo={listas[k]}>
      <ListaSimple items={ficha[k]} />
    </Seccion>
  )
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Seccion titulo="Objetivo">
          <p className={cn('text-sm', ficha.objetivo ? 'text-marca-700' : 'text-marca-400')}>{ficha.objetivo || 'La hoja de origen no lo declara.'}</p>
        </Seccion>
        <Seccion titulo="Alcance">
          <p className={cn('text-sm', ficha.alcance ? 'text-marca-700' : 'text-marca-400')}>{ficha.alcance || 'La hoja de origen no lo declara.'}</p>
        </Seccion>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {bloque('proveedores')}
        {bloque('entradas')}
      </div>

      <Seccion titulo="Actividades · ciclo PHVA">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FASES_PHVA.map(([k, etiqueta], i) => (
            <div key={k} className="rounded-xl border border-[var(--borde)] bg-marca-50/40 p-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-marca-600 uppercase">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-marca-800 text-[10px] text-white">{'PHVA'[i]}</span>
                {etiqueta}
              </p>
              <ListaSimple items={ficha.actividades[k]} vacio="—" />
            </div>
          ))}
        </div>
      </Seccion>

      <div className="grid gap-4 md:grid-cols-2">
        {bloque('salidas')}
        {bloque('clientes')}
        {bloque('recursos')}
        {bloque('documentos')}
        {bloque('registros')}
        {bloque('requisitos')}
      </div>

      <Seccion titulo="Indicadores">
        {ficha.indicadores.length ? (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--borde)] text-xs text-marca-500">
                  <th className="py-2 pr-3 font-medium">Indicador</th>
                  <th className="py-2 pr-3 font-medium">Fórmula</th>
                  <th className="py-2 pr-3 font-medium">Meta</th>
                  <th className="py-2 font-medium">Frecuencia</th>
                </tr>
              </thead>
              <tbody>
                {ficha.indicadores.map((x, i) => (
                  <tr key={i} className="border-b border-[var(--borde)] last:border-0 align-top">
                    <td className="py-2 pr-3 text-marca-800">{x.nombre}</td>
                    <td className="py-2 pr-3 text-marca-600">{x.formula ?? <span className="text-marca-400">Sin definir</span>}</td>
                    <td className="py-2 pr-3 text-marca-600">{x.meta ?? <span className="text-marca-400">Sin meta</span>}</td>
                    <td className="py-2 text-marca-600">{x.frecuencia ?? <span className="text-marca-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-marca-400">Sin indicadores en la ficha.</p>
        )}
      </Seccion>

      <div className="grid gap-4 md:grid-cols-2">
        {bloque('riesgos')}
        {bloque('oportunidades')}
      </div>
    </div>
  )
}

/** Lo que cambia del borrador frente a la vigente. */
export function Diferencias({ cambios, titulo = 'Qué cambia frente a la versión vigente' }: { cambios: Diferencia[]; titulo?: string }) {
  return (
    <Seccion titulo={titulo}>
      {cambios.length === 0 ? (
        <p className="text-sm text-marca-500">Todavía no hay cambios: el borrador es igual a la vigente.</p>
      ) : (
        <ul className="divide-y divide-[var(--borde)]">
          {cambios.map((c, i) => (
            <li key={i} className="py-2.5 text-sm">
              <p className="font-medium text-marca-800">{c.campo}</p>
              {c.agregados || c.quitados ? (
                <div className="mt-1 space-y-1">
                  {c.quitados?.map((x, j) => (
                    <p key={`q${j}`} className="rounded-md bg-marca-100 px-2 py-1 text-marca-600 line-through decoration-marca-400">
                      − {x}
                    </p>
                  ))}
                  {c.agregados?.map((x, j) => (
                    <p key={`a${j}`} className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-900">
                      + {x}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-marca-600">
                  <span className="rounded-md bg-marca-100 px-2 py-0.5 line-through decoration-marca-400">{c.antes}</span>
                  <span aria-hidden>→</span>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-900">{c.despues}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Seccion>
  )
}

/** Una solicitud de aprobación con sus pasos, en orden. */
export function LineaSolicitud({ solicitud }: { solicitud: SolicitudLeida }) {
  const tono = solicitud.estado === 'aprobada' ? 'verde' : solicitud.estado === 'en_curso' ? 'ambar' : solicitud.estado === 'rechazada' ? 'rojo' : 'neutro'
  return (
    <div className="rounded-xl border border-[var(--borde)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-marca-800">{solicitud.titulo}</p>
          <p className="text-xs text-marca-500">
            Enviada el {fechaHora(solicitud.creado_en)}
            {solicitud.creado_por_nombre && <> por {solicitud.creado_por_nombre}</>}
            {solicitud.cerrado_en && <> · cerrada el {fechaHora(solicitud.cerrado_en)}</>}
          </p>
        </div>
        <Insignia tono={tono}>{ESTADOS_SOLICITUD[solicitud.estado] ?? solicitud.estado}</Insignia>
      </div>
      <ol className="mt-4 space-y-3">
        {solicitud.pasos.map((p) => {
          const actual = solicitud.estado === 'en_curso' && solicitud.paso_actual === p.orden
          return (
            <li key={p.id} className={cn('flex gap-3 rounded-lg p-2', actual && 'bg-amber-50/70')}>
              <span
                className={cn(
                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  p.decision === 'aprobado' ? 'bg-emerald-600 text-white' : actual ? 'bg-amber-500 text-white' : 'bg-marca-100 text-marca-600',
                )}
              >
                {p.decision === 'aprobado' ? <IconoCheck className="h-3.5 w-3.5" /> : p.orden}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-marca-800">{p.nombre}</p>
                  {p.hito && <Insignia tono="marca">Aprueba</Insignia>}
                  <Insignia tono={TONO_DECISION[p.decision] ?? 'neutro'}>{actual ? 'Le toca' : (DECISIONES[p.decision] ?? p.decision)}</Insignia>
                </div>
                <p className="mt-0.5 text-xs text-marca-500">{p.aprobador}</p>
                {p.sin_cuenta && p.decision === 'pendiente' && (
                  <p className="mt-1 flex items-start gap-1.5 text-xs text-amber-800">
                    <IconoAlerta className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    La plaza no tiene cuenta en la plataforma: decide quien administra las aprobaciones.
                  </p>
                )}
                {p.decidido_en && (
                  <p className="mt-1 text-xs text-marca-500">
                    {DECISIONES[p.decision] ?? p.decision} el {fechaHora(p.decidido_en)}
                    {p.decidido_por_nombre && <> por {p.decidido_por_nombre}</>}
                  </p>
                )}
                {p.comentario && <p className="mt-1 rounded-md bg-marca-50 px-2 py-1 text-xs text-marca-700">«{p.comentario}»</p>}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
