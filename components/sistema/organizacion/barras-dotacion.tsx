import Link from 'next/link'
import { numero, porcentaje } from '@/lib/plataforma/formato'

/**
 * Plan contra real, por dirección: una barra de bala por fila. La barra clara
 * es la dotación aprobada, la oscura (adentro) la ocupada y la raya vertical el
 * plan del año. HTML y CSS, sin JavaScript: se lee igual en un teléfono (un SVG
 * escalado dejaba la letra en 6 px) y cada fila trae sus cifras escritas, así
 * que nada depende solo del color. El detalle al pasar el mouse es el `title`.
 */

export type FilaBarras = {
  clave: string
  etiqueta: string
  aprobada: number
  ocupada: number
  plan?: number | null
  porEncima?: number
  enRequisicion?: number
  href?: string
}

const CLARO = '#a9c1e0'
const OSCURO = '#2f5f9a'

export function BarrasDotacion({ filas, conPlan, titulo }: { filas: FilaBarras[]; conPlan: boolean; titulo: string }) {
  if (!filas.length) return <p className="py-6 text-center text-sm text-marca-400">Sin plazas a esa fecha.</p>
  const max = Math.max(1, ...filas.map((f) => Math.max(f.aprobada, f.ocupada, f.plan ?? 0)))
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`
  return (
    <figure aria-label={titulo}>
      <ul className="flex flex-col gap-2">
        {filas.map((f) => {
          const uso = f.aprobada ? (f.ocupada / f.aprobada) * 100 : null
          const detalle = `${f.etiqueta}\nAprobada: ${numero(f.aprobada)}\nOcupada: ${numero(f.ocupada)}${conPlan ? `\nPlan: ${f.plan === null || f.plan === undefined ? 'sin plan' : numero(f.plan)}` : ''}${f.porEncima ? `\nPor encima: ${numero(f.porEncima)}` : ''}${f.enRequisicion ? `\nEn requisición: ${numero(f.enRequisicion)}` : ''}`
          const cuerpo = (
            <>
              <span className="min-w-0 truncate text-[12.5px] text-marca-800 sm:w-52 sm:shrink-0">{f.etiqueta}</span>
              <span className="relative block h-3.5 w-full min-w-0 shrink-0 rounded-[3px] bg-[#f1f2f4] sm:w-auto sm:flex-1" aria-hidden>
                <span className="absolute inset-y-0 left-0 rounded-[3px]" style={{ width: pct(f.aprobada), background: CLARO }} />
                <span className="absolute inset-y-[3px] left-0 rounded-[2px]" style={{ width: pct(f.ocupada), background: OSCURO }} />
                {conPlan && f.plan !== null && f.plan !== undefined && (
                  <span className="absolute -inset-y-1 w-[2px] rounded bg-[#2b2a28]" style={{ left: `calc(${pct(f.plan)} - 1px)` }} />
                )}
              </span>
              <span className="shrink-0 text-[12px] sm:w-[7.5rem] sm:text-right text-marca-600 tabular-nums">
                {numero(f.ocupada)} / {numero(f.aprobada)}
                <span className="ml-1 text-marca-400">{uso === null ? '' : `· ${porcentaje(uso, 0)}`}</span>
                {!!f.porEncima && <span className="block text-[11px] text-[#8a5a12]">▲ {numero(f.porEncima)} por encima</span>}
              </span>
            </>
          )
          const clase = 'flex flex-col gap-1 rounded-md px-1.5 py-1 sm:flex-row sm:items-center sm:gap-3'
          return (
            <li key={f.clave} title={detalle}>
              {f.href ? (
                <Link href={f.href} className={`${clase} hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500`}>
                  {cuerpo}
                </Link>
              ) : (
                <div className={clase}>{cuerpo}</div>
              )}
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-marca-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-[2px]" style={{ background: CLARO }} aria-hidden />
          Dotación aprobada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-5 rounded-[2px]" style={{ background: OSCURO }} aria-hidden />
          Ocupada (titulares)
        </span>
        {conPlan && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-[2px] bg-[#2b2a28]" aria-hidden />
            Plan del año
          </span>
        )}
        <span className="text-marca-400">Cifras: ocupada / aprobada · uso.</span>
      </figcaption>
    </figure>
  )
}
