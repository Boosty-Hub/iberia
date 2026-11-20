import Link from 'next/link'
import type { ReactNode } from 'react'
import { fechaLarga, numero } from '@/lib/plataforma/formato'
import { TONO_CHIP } from '@/lib/plataforma/ficha-tipos'
import { ESTADO_FASE, ESTADO_HITO, type EstadoFase, type EstadoHito } from '@/lib/plataforma/hoja-de-ruta-vocabulario'
import { cn } from '@/lib/utils'

/**
 * Las piezas de la hoja de ruta (PRG-PLN), dibujadas en el servidor: cero
 * JavaScript en el navegador. El estado nunca va solo en el color: cada barra
 * lleva su rótulo escrito y cada fase su pastilla. Sin montos.
 */

export function Pastilla({ tono, children }: { tono: keyof typeof TONO_CHIP; children: ReactNode }) {
  return <span className={cn('inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', TONO_CHIP[tono])}>{children}</span>
}

export function PastillaFase({ estado }: { estado: EstadoFase }) {
  const e = ESTADO_FASE[estado]
  return <Pastilla tono={e.tono}>{e.etiqueta}</Pastilla>
}

export function PastillaHito({ estado }: { estado: EstadoHito }) {
  const e = ESTADO_HITO[estado]
  return <Pastilla tono={e.tono}>{e.etiqueta}</Pastilla>
}

// -----------------------------------------------------------------------------
// La ruta en una vista: fases sobre los meses, con «hoy» marcado
// -----------------------------------------------------------------------------

export type FaseLinea = { clave: string; nombre: string; inicio: string | null; fin: string | null; estado: EstadoFase; contratada: boolean; periodo_texto: string | null }

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DESDE = { a: 2026, m: 8 } // agosto de 2026: arranca la Fase 1
const N_MESES = 15 // hasta octubre de 2027: cierra New Iberia
const COL_NOMBRE = 250
const ANCHO_MES = 40
const COL_SIN_FECHA = 100
const FILA = 34
const CABECERA = 30
const ANCHO = COL_NOMBRE + N_MESES * ANCHO_MES + COL_SIN_FECHA + 8

/** Meses (con fracción) desde agosto de 2026 hasta la fecha. */
function posicion(f: string): number {
  const [a, m, d] = f.slice(0, 10).split('-').map(Number)
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return (a - DESDE.a) * 12 + (m - DESDE.m) + (d - 1) / dias
}

export function LineaFases({ fases, hoy }: { fases: FaseLinea[]; hoy: string }) {
  const alto = CABECERA + fases.length * FILA + 8
  const x = (meses: number) => COL_NOMBRE + Math.max(0, Math.min(N_MESES, meses)) * ANCHO_MES
  const xHoy = x(posicion(hoy))
  const xSinFecha = COL_NOMBRE + N_MESES * ANCHO_MES + 10
  return (
    <div className="overflow-x-auto rounded-lg border border-[#eef0f3]" tabIndex={0} role="region" aria-label="La ruta en una vista: desliza de lado en el teléfono">
      <svg viewBox={`0 0 ${ANCHO} ${alto}`} className="block h-auto w-full min-w-[720px]" role="img" aria-labelledby="linea-fases-t linea-fases-d">
        <title id="linea-fases-t">Fases de la plataforma sobre los meses, de agosto de 2026 a octubre de 2027</title>
        <desc id="linea-fases-d">
          {fases.map((f) => `${f.nombre}: ${ESTADO_FASE[f.estado].etiqueta}, ${f.periodo_texto ?? (f.inicio ? `${fechaLarga(f.inicio)} a ${fechaLarga(f.fin)}` : 'sin fecha firme')}.`).join(' ')}
        </desc>
        {/* Meses: rejilla tenue y rótulo de cada mes (con el año en enero y al empezar). */}
        {Array.from({ length: N_MESES }, (_, i) => {
          const m = ((DESDE.m - 1 + i) % 12) + 1
          const a = DESDE.a + Math.floor((DESDE.m - 1 + i) / 12)
          const xi = COL_NOMBRE + i * ANCHO_MES
          return (
            <g key={i}>
              <line x1={xi} x2={xi} y1={CABECERA - 6} y2={alto - 4} stroke="#eef0f3" />
              <text x={xi + 4} y={14} fontSize={10.5} fill="#706a67">
                {MESES[m - 1]}
              </text>
              {(m === 1 || i === 0) && (
                <text x={xi + 4} y={25} fontSize={9.5} fill="#8d8785">
                  {a}
                </text>
              )}
            </g>
          )
        })}
        <line x1={COL_NOMBRE + N_MESES * ANCHO_MES} x2={COL_NOMBRE + N_MESES * ANCHO_MES} y1={CABECERA - 6} y2={alto - 4} stroke="#d5d8dd" strokeDasharray="3 3" />
        <text x={xSinFecha} y={14} fontSize={10.5} fill="#706a67">
          sin fecha
        </text>

        {fases.map((f, i) => {
          const y = CABECERA + i * FILA
          const e = ESTADO_FASE[f.estado]
          const fechas = Boolean(f.inicio && f.fin)
          const x1 = fechas ? x(posicion(f.inicio!)) : xSinFecha
          const x2 = fechas ? x(posicion(f.fin!) + 1 / 30) : xSinFecha + COL_SIN_FECHA - 24
          const ancho = Math.max(6, x2 - x1)
          const relleno = f.estado === 'planificado' ? '#f1f2f4' : e.color
          const detalle = `${f.nombre} · ${e.etiqueta} · ${f.periodo_texto ?? (fechas ? `${fechaLarga(f.inicio)} a ${fechaLarga(f.fin)}` : 'sin fecha firme')}`
          return (
            <g key={f.clave}>
              <title>{detalle}</title>
              {i % 2 === 1 && <rect x={0} y={y} width={ANCHO} height={FILA} fill="#fafbfc" />}
              <text x={10} y={y + 14} fontSize={12} fontWeight={600} fill="#2b2a28">
                {f.nombre.length > 36 ? `${f.nombre.slice(0, 35)}…` : f.nombre}
              </text>
              <text x={10} y={y + 27} fontSize={10.5} fill="#706a67">
                {e.etiqueta}
                {!fechas ? ' · sin fecha firme' : ''}
              </text>
              <rect
                x={x1}
                y={y + 9}
                width={ancho}
                height={14}
                rx={4}
                fill={relleno}
                stroke={f.estado === 'planificado' ? '#8d8785' : 'none'}
                strokeWidth={1}
                strokeDasharray={!fechas ? '4 3' : undefined}
              />
            </g>
          )
        })}

        {/* Hoy */}
        <line x1={xHoy} x2={xHoy} y1={CABECERA - 4} y2={alto - 4} stroke="#D4332C" strokeWidth={1.5} />
        <text x={xHoy + 3} y={CABECERA - 1} fontSize={10} fontWeight={600} fill="#a3241f">
          hoy
        </text>
      </svg>
    </div>
  )
}

export function LeyendaFases() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-marca-600" aria-label="Qué dice cada color">
      {(Object.keys(ESTADO_FASE) as EstadoFase[]).map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-5 rounded-[3px]"
            style={k === 'planificado' ? { background: '#f1f2f4', border: '1px solid #8d8785' } : { background: ESTADO_FASE[k].color }}
          />
          {ESTADO_FASE[k].etiqueta}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-3 w-[2px] bg-[#D4332C]" />
        Hoy
      </li>
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="inline-block h-2.5 w-5 rounded-[3px] border border-dashed border-[#8d8785] bg-[#f1f2f4]" />
        Sin fecha firme
      </li>
    </ul>
  )
}

// -----------------------------------------------------------------------------
// Avance por dominio: operando · en construcción · planificado
// -----------------------------------------------------------------------------

export type FilaDominio = { dominio: string; operando: number; en_construccion: number; planificado: number; total: number }

const VERDE = '#1f8a5b'
const AMBAR = '#d9a441'
const GRIS = '#e3e5e8'

export function BarrasDominio({ filas, hrefDe }: { filas: FilaDominio[]; hrefDe?: (dominio: string) => string }) {
  if (!filas.length) return <p className="py-6 text-center text-sm text-marca-400">Sin módulos en el registro.</p>
  return (
    <figure aria-label="Módulos del plan por dominio y estado">
      <ul className="flex flex-col gap-1.5">
        {filas.map((f) => {
          const pct = (n: number) => (f.total ? (n / f.total) * 100 : 0)
          const detalle = `${f.dominio}\nOperando: ${numero(f.operando)}\nEn construcción: ${numero(f.en_construccion)}\nPlanificados: ${numero(f.planificado)}`
          const cuerpo = (
            <>
              <span className="min-w-0 truncate text-[12.5px] text-marca-800 sm:w-48 sm:shrink-0">{f.dominio}</span>
              <span className="flex h-3 w-full min-w-0 gap-[2px] overflow-hidden rounded-[3px] sm:flex-1" aria-hidden>
                {f.operando > 0 && <span className="h-full" style={{ width: `${pct(f.operando)}%`, background: VERDE }} />}
                {f.en_construccion > 0 && <span className="h-full" style={{ width: `${pct(f.en_construccion)}%`, background: AMBAR }} />}
                {f.planificado > 0 && <span className="h-full flex-1" style={{ background: GRIS }} />}
              </span>
              <span className="shrink-0 text-[12px] text-marca-600 tabular-nums sm:w-52 sm:text-right">
                {numero(f.operando)} de {numero(f.total)} operando
                {f.en_construccion > 0 && <span className="text-marca-500"> · {numero(f.en_construccion)} en constr.</span>}
              </span>
            </>
          )
          const clase = 'flex flex-col gap-1 rounded-md px-1.5 py-1 sm:flex-row sm:items-center sm:gap-3'
          return (
            <li key={f.dominio} title={detalle}>
              {hrefDe ? (
                <Link href={hrefDe(f.dominio)} className={`${clase} hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500`}>
                  {cuerpo}
                </Link>
              ) : (
                <div className={clase}>{cuerpo}</div>
              )}
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-marca-600">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: VERDE }} />
          Operando
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: AMBAR }} />
          En construcción
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-4 rounded-[2px]" style={{ background: GRIS }} />
          Planificado
        </span>
      </figcaption>
    </figure>
  )
}

/** Botón chico de los formularios de la hoja de ruta. */
export const BOTON_CHICO =
  'inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500'
export const CAMPO_CHICO =
  'h-8 rounded-lg border border-[var(--borde)] bg-white px-2 text-[12.5px] text-marca-900 focus-visible:outline-2 focus-visible:outline-acento-500'
