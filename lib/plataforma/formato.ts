/**
 * Formato de la plataforma: números es-VE, fechas en America/Caracas y texto
 * comparable sin tildes. Sin `'use client'` ni `'use server'`: lo usan las dos
 * orillas.
 */

export const ZONA = 'America/Caracas'

/** Hoy en Caracas, `AAAA-MM-DD`. El servidor vive en UTC y a las 8 p. m. ya es mañana. */
export function hoyCaracas(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

/** ¿Es una fecha `AAAA-MM-DD` de verdad? */
export function esFecha(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime())
}

export function esUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
}

/** Suma días a una fecha `AAAA-MM-DD` (a mediodía, para que la zona no corra el día). */
export function sumarDias(f: string, dias: number): string {
  const d = new Date(`${f}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/**
 * 1234.5 → «1.234,5». Armado a mano (punto de miles, coma decimal) por lo mismo
 * que las fechas: el servidor y el navegador tienen que pintar idéntico.
 */
export function numero(n: number | null | undefined, decimales = 0, minimo = decimales): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  const v = Number(n)
  let txt = Math.abs(v).toFixed(decimales)
  if (decimales > minimo && txt.includes('.')) {
    txt = txt.replace(/0+$/, '')
    const [, dec = ''] = txt.split('.')
    if (dec.length < minimo) txt = Math.abs(v).toFixed(minimo)
    txt = txt.replace(/\.$/, '')
  }
  const [ent, dec] = txt.split('.')
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const signo = v < 0 && Number(txt) !== 0 ? '−' : ''
  return signo + miles + (dec ? `,${dec}` : '')
}

/** Una tasa en bolívares: dos decimales siempre. */
export function tasa(n: number | null | undefined): string {
  return numero(n, 2)
}

/** 15.43 → «15,4 %». */
export function porcentaje(n: number | null | undefined, decimales = 1): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return `${numero(n, decimales)} %`
}

/** Variación con signo y flecha: nunca solo el color. */
export function variacion(n: number | null | undefined, decimales = 2): { texto: string; sentido: 'sube' | 'baja' | 'igual' } {
  if (n === null || n === undefined || Number.isNaN(n)) return { texto: '—', sentido: 'igual' }
  const r = Math.round(n * 10 ** decimales) / 10 ** decimales
  if (r === 0) return { texto: `= ${numero(0, decimales)} %`, sentido: 'igual' }
  return r > 0 ? { texto: `▲ ${numero(r, decimales)} %`, sentido: 'sube' } : { texto: `▼ ${numero(-r, decimales)} %`, sentido: 'baja' }
}

/** 2026-11-20 → «20/11/2026». */
export function fechaCorta(f: string | null | undefined): string {
  if (!f) return '—'
  const [a, m, d] = f.slice(0, 10).split('-')
  return a && m && d ? `${d}/${m}/${a}` : '—'
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/**
 * Las partes de una marca de tiempo en Caracas. Se arma el texto a mano y no
 * con `toLocaleString('es-VE')`: Node y el navegador traen ICU distintos («p. m.»
 * contra «p.m.», «nov.» contra «nov»), y un componente de cliente que pinta una
 * fecha en el servidor y otra en el navegador rompe la hidratación.
 */
const partesCcs = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
})
function partes(d: Date) {
  const p = Object.fromEntries(partesCcs.formatToParts(d).map((x) => [x.type, x.value]))
  return { a: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, min: p.minute }
}
function hora12(h: number, min: string) {
  return `${h % 12 === 0 ? 12 : h % 12}:${min} ${h < 12 ? 'a. m.' : 'p. m.'}`
}

/** 2026-11-20 → «20 nov 2026». */
export function fechaLarga(f: string | null | undefined): string {
  if (!f || !esFecha(f.slice(0, 10))) return '—'
  const [a, m, d] = f.slice(0, 10).split('-').map(Number)
  return `${d} ${MESES[m - 1]} ${a}`
}

/** Una marca de tiempo en la hora de Caracas: «20/11/2026 4:52 p. m.». */
export function fechaHora(f: string | null | undefined): string {
  if (!f) return '—'
  const t = new Date(f)
  if (Number.isNaN(t.getTime())) return '—'
  const p = partes(t)
  return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.a} ${hora12(p.h, p.min)}`
}

/** Solo la hora: «4:52 p. m.». */
export function hora(f: string | null | undefined): string {
  if (!f) return '—'
  const t = new Date(f)
  if (Number.isNaN(t.getTime())) return '—'
  const p = partes(t)
  return hora12(p.h, p.min)
}

/** La fecha (`AAAA-MM-DD`) de una marca de tiempo, en Caracas. */
export function diaDe(f: string): string {
  const p = partes(new Date(f))
  return `${p.a}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** «hace 4 min», «hace 2 h», «hace 3 días». */
export function hace(f: string | null | undefined): string {
  if (!f) return '—'
  const s = Math.max(0, (Date.now() - new Date(f).getTime()) / 1000)
  if (s < 60) return 'hace un momento'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'hace 1 día' : `hace ${d} días`
}

/** Texto comparable: sin tildes y en minúsculas, como `ui.plano()` en la base. */
export function plano(t: string | null | undefined): string {
  return (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Las iniciales de un nombre, para el avatar. */
export function iniciales(nombre: string | null | undefined): string {
  const partes = (nombre ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '·'
  return ((partes[0][0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}
