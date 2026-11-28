import type { Bloque, Contenido } from './procesos-vivos'

/** Comparación de versiones de un documento, sección por sección y palabra por palabra (LCS). */

export type Trozo = { t: 'igual' | 'quitado' | 'agregado'; x: string }
export type CambioSeccion = { titulo: string; tipo: 'modificada' | 'nueva' | 'quitada'; trozos: Trozo[] }

export function textoDe(bloques: Bloque[]): string {
  return bloques.map((b) => {
    switch (b.tipo) {
      case 'parrafo': return b.texto
      case 'lista': return b.items.join(' · ')
      case 'tabla': return b.filas.map((f) => f.join(' | ')).join(' / ')
      case 'paso': return `${b.responsable ? `${b.responsable}: ` : ''}${b.actividad}`
      case 'decision': return `¿${b.pregunta}? ${b.si ?? ''} ${b.no ?? ''}`
      case 'referencia': return `${b.codigo} ${b.titulo ?? ''}`
    }
  }).join('\n')
}

function diffPalabras(a: string, b: string): Trozo[] {
  const A = a.split(/(\s+)/).filter(Boolean)
  const B = b.split(/(\s+)/).filter(Boolean)
  if (A.length * B.length > 4_000_000) return [{ t: 'quitado', x: a }, { t: 'agregado', x: b }]
  const n = A.length, m = B.length
  const L: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out: Trozo[] = []
  const push = (t: Trozo['t'], x: string) => { const u = out[out.length - 1]; if (u && u.t === t) u.x += x; else out.push({ t, x }) }
  let i = 0, j = 0
  while (i < n && j < m) {
    if (A[i] === B[j]) { push('igual', A[i]); i++; j++ }
    else if (L[i + 1][j] >= L[i][j + 1]) push('quitado', A[i++])
    else push('agregado', B[j++])
  }
  while (i < n) push('quitado', A[i++])
  while (j < m) push('agregado', B[j++])
  return out
}

const clave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^[\d.\s]+/, '').trim()

/** Qué cambió de `antes` a `despues`. Las secciones se emparejan por título. */
export function compararVersiones(antes: Contenido, despues: Contenido): CambioSeccion[] {
  const previas = new Map(antes.secciones.map((s) => [clave(s.titulo), s]))
  const out: CambioSeccion[] = []
  const vistas = new Set<string>()
  for (const s of despues.secciones) {
    const k = clave(s.titulo)
    vistas.add(k)
    const p = previas.get(k)
    const nuevo = textoDe(s.bloques)
    if (!p) { out.push({ titulo: s.titulo, tipo: 'nueva', trozos: [{ t: 'agregado', x: nuevo }] }); continue }
    const viejo = textoDe(p.bloques)
    if (viejo === nuevo) continue
    out.push({ titulo: s.titulo, tipo: 'modificada', trozos: diffPalabras(viejo, nuevo) })
  }
  for (const s of antes.secciones) if (!vistas.has(clave(s.titulo))) out.push({ titulo: s.titulo, tipo: 'quitada', trozos: [{ t: 'quitado', x: textoDe(s.bloques) }] })
  return out
}
