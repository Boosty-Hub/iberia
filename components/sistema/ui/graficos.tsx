import { fechaLarga, numero } from '@/lib/plataforma/formato'

/**
 * Gráficos de la plataforma, en SVG dibujado en el servidor: cero JavaScript en
 * el navegador, se imprimen bien y se leen igual con o sin hidratar. La capa de
 * detalle al pasar el mouse es el `<title>` de cada día (lo lee también el
 * lector de pantalla), y cada gráfico tiene al lado su tabla con las cifras
 * exactas. Si un día hace falta zoom o pincel, entra Recharts; hoy no.
 *
 * Reglas (skill de visualización): un solo eje; ≥ 2 series llevan leyenda y
 * rótulo directo al final de la línea; líneas de 2 px; la serie no se distingue
 * solo por el color (el paralelo va punteado); barras desde cero.
 */

export type Serie = { nombre: string; color: string; valores: (number | null)[]; escalones?: boolean; punteada?: boolean }

const AN = 640
const AL = 230
const M = { izq: 44, der: 118, arr: 12, aba: 26 }

function marcas(min: number, max: number, n = 4): number[] {
  const rango = max - min || 1
  const paso0 = rango / n
  const pot = 10 ** Math.floor(Math.log10(paso0))
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= paso0) ?? paso0
  const desde = Math.floor(min / paso) * paso
  const lista: number[] = []
  for (let v = desde; v <= max + paso * 0.001; v += paso) lista.push(Math.round(v * 1e6) / 1e6)
  // La última marca cubre el máximo: si no, la línea se sale por arriba.
  while (lista[lista.length - 1] < max) lista.push(Math.round((lista[lista.length - 1] + paso) * 1e6) / 1e6)
  return lista
}

export function GraficoLineas({ dias, series, unidad, decimales = 2, titulo }: { dias: string[]; series: Serie[]; unidad: string; decimales?: number; titulo: string }) {
  const todos = series.flatMap((s) => s.valores).filter((v): v is number => v !== null)
  if (!todos.length || dias.length < 2) return <p className="py-10 text-center text-sm text-marca-400">Sin datos en el período.</p>
  const ticks = marcas(Math.min(...todos), Math.max(...todos))
  const yMin = ticks[0]
  const yMax = ticks[ticks.length - 1]
  const ancho = AN - M.izq - M.der
  const alto = AL - M.arr - M.aba
  const x = (i: number) => M.izq + (i / (dias.length - 1)) * ancho
  const y = (v: number) => M.arr + alto - ((v - yMin) / (yMax - yMin || 1)) * alto

  const camino = (s: Serie) => {
    let d = ''
    let abierto = false
    s.valores.forEach((v, i) => {
      if (v === null) {
        abierto = false
        return
      }
      if (!abierto) {
        d += `M${x(i).toFixed(1)},${y(v).toFixed(1)}`
        abierto = true
      } else if (s.escalones) d += `H${x(i).toFixed(1)}V${y(v).toFixed(1)}`
      else d += `L${x(i).toFixed(1)},${y(v).toFixed(1)}`
    })
    return d
  }

  // Rótulos directos al final, sin pisarse: se separan al menos 13 px.
  const finales = series
    .map((s) => {
      const i = s.valores.findLastIndex((v) => v !== null)
      return i < 0 ? null : { s, y: y(s.valores[i] as number), v: s.valores[i] as number }
    })
    .filter((f): f is { s: Serie; y: number; v: number } => f !== null)
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < finales.length; i++) if (finales[i].y - finales[i - 1].y < 13) finales[i].y = finales[i - 1].y + 13

  const etiquetasX = [0, Math.floor((dias.length - 1) / 2), dias.length - 1]
  const anchoDia = ancho / (dias.length - 1)

  return (
    <figure>
      <svg viewBox={`0 0 ${AN} ${AL}`} className="h-auto w-full" role="img" aria-label={titulo}>
        <title>{titulo}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.izq} x2={AN - M.der} y1={y(t)} y2={y(t)} stroke="#eef0f3" />
            <text x={M.izq - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#8d8785" className="tabular-nums">
              {numero(t, 0)}
            </text>
          </g>
        ))}
        {etiquetasX.map((i) => (
          <text key={i} x={x(i)} y={AL - 8} textAnchor={i === 0 ? 'start' : i === dias.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#8d8785">
            {fechaLarga(dias[i]).replace(/ \d{4}$/, '')}
          </text>
        ))}
        {series.map((s) => (
          <path key={s.nombre} d={camino(s)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.punteada ? '5 4' : undefined} strokeLinejoin="round" />
        ))}
        {finales.map((f) => (
          <text key={f.s.nombre} x={AN - M.der + 6} y={f.y + 3.5} fontSize="10.5" fill="#474342">
            <tspan fontWeight="600">{f.s.nombre}</tspan> {numero(f.v, decimales)}
          </text>
        ))}
        {/* La capa de detalle: un rectángulo por día con su <title>. */}
        {dias.map((d, i) => (
          <rect key={d} x={x(i) - anchoDia / 2} y={M.arr} width={anchoDia} height={alto} fill="transparent">
            {/* Un solo nodo de texto: el navegador junta los del <title> y la hidratación no cuadraría. */}
            <title>{fechaLarga(d) + series.map((s) => `\n${s.nombre}: ${s.valores[i] === null ? '—' : `${numero(s.valores[i], decimales)} ${unidad}`}`).join('')}</title>
          </rect>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-marca-600">
        {series.map((s) => (
          <span key={s.nombre} className="inline-flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden>
              <line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="2" strokeDasharray={s.punteada ? '5 4' : undefined} />
            </svg>
            {s.nombre}
            {s.escalones ? ' (en escalones: rige hasta la siguiente fecha valor)' : ''}
          </span>
        ))}
        <span className="text-marca-400">Eje en {unidad}.</span>
      </figcaption>
    </figure>
  )
}

export function GraficoBarras({ dias, valores, unidad, titulo, color = '#c8a15a', resalte = '#8a5a12' }: { dias: string[]; valores: (number | null)[]; unidad: string; titulo: string; color?: string; resalte?: string }) {
  const v = valores.filter((x): x is number => x !== null)
  if (!v.length) return <p className="py-10 text-center text-sm text-marca-400">Sin datos en el período.</p>
  const ticks = marcas(0, Math.max(...v))
  const yMax = ticks[ticks.length - 1]
  const izq = 34
  const der = 10
  const arr = 14
  const aba = 26
  const ancho = AN - izq - der
  const alto = AL - arr - aba
  const paso = ancho / dias.length
  const barra = Math.max(2, paso - 2)
  const y = (x: number) => arr + alto - (x / (yMax || 1)) * alto
  const ultimo = valores.findLastIndex((x) => x !== null)
  const etiquetasX = [0, Math.floor((dias.length - 1) / 2), dias.length - 1]

  return (
    <figure>
      <svg viewBox={`0 0 ${AN} ${AL}`} className="h-auto w-full" role="img" aria-label={titulo}>
        <title>{titulo}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={izq} x2={AN - der} y1={y(t)} y2={y(t)} stroke="#eef0f3" />
            <text x={izq - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="#8d8785">
              {numero(t, 0)}
            </text>
          </g>
        ))}
        {valores.map((val, i) =>
          val === null ? null : (
            <g key={dias[i]}>
              <rect x={izq + i * paso + 1} y={y(val)} width={barra} height={Math.max(0, arr + alto - y(val))} rx={Math.min(3, barra / 2)} fill={i === ultimo ? resalte : color} />
              <rect x={izq + i * paso} y={arr} width={paso} height={alto} fill="transparent">
                <title>{`${fechaLarga(dias[i])}\n${numero(val, 2)} ${unidad}`}</title>
              </rect>
            </g>
          )
        )}
        {ultimo >= 0 && (
          <text x={Math.min(izq + ultimo * paso + paso / 2, AN - der - 2)} y={y(valores[ultimo] as number) - 4} textAnchor="end" fontSize="10.5" fontWeight="600" fill="#474342">
            {numero(valores[ultimo], 1)} {unidad}
          </text>
        )}
        {etiquetasX.map((i) => (
          <text key={i} x={izq + i * paso + paso / 2} y={AL - 8} textAnchor={i === 0 ? 'start' : i === dias.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#8d8785">
            {fechaLarga(dias[i]).replace(/ \d{4}$/, '')}
          </text>
        ))}
      </svg>
    </figure>
  )
}
