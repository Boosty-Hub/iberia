import dagre from '@dagrejs/dagre'

/**
 * Dónde va cada caja. Dos disposiciones:
 *
 * - **Compacta** (la de fábrica, la del modelo aprobado): árbol ordenado en el
 *   que cada subárbol tiene su propia franja de ancho —no se pisan nunca— y las
 *   hojas de un mismo padre (hijos sin hijos, o plegados) van **apiladas en
 *   columna** debajo de él, como en las herramientas de organigramas. Si un
 *   padre tiene hojas y ramas abiertas a la vez, las hojas van en una columna y
 *   las ramas en abanico al lado: así el dibujo no revienta a lo ancho.
 * - **Clásica**: todas las cajas en abanico, por niveles, con dagre. Es la del
 *   organigrama de papel: más ancha, útil para exportar un subárbol corto.
 *
 * Las dos devuelven la esquina superior izquierda de cada caja y las aristas
 * con el tipo de trazo (rama en ángulo o espina de pila).
 */

export const ANCHO = 200
export const ALTO = 80
const SEP_X = 24 // entre subárboles vecinos
const SEP_Y = 56 // entre un padre y sus hijos
const PILA_DX = 30 // sangría de la columna apilada
const PILA_SEP = 14 // entre cajas apiladas

export type Punto = { x: number; y: number }
export type TipoArista = 'rama' | 'pila' | 'pila-lado'
export type AristaDispuesta = { id: string; origen: string; destino: string; tipo: TipoArista }
export type Disposicion = { pos: Map<string, Punto>; aristas: AristaDispuesta[]; visibles: string[] }

type Arbol = { raices: string[]; hijos: Map<string, string[]> }

function visiblesDe(arbol: Arbol, abiertos: Set<string>): string[] {
  const salida: string[] = []
  const ir = (id: string) => {
    salida.push(id)
    if (abiertos.has(id)) for (const h of arbol.hijos.get(id) ?? []) ir(h)
  }
  arbol.raices.forEach(ir)
  return salida
}

export function disponer(arbol: Arbol, abiertos: Set<string>, compacta: boolean): Disposicion {
  return compacta ? compactar(arbol, abiertos) : clasica(arbol, abiertos)
}

// -----------------------------------------------------------------------------
// Compacta
// -----------------------------------------------------------------------------

type Parte = { tipo: 'nodo'; id: string } | { tipo: 'pila'; ids: string[] }

function compactar(arbol: Arbol, abiertos: Set<string>): Disposicion {
  const pos = new Map<string, Punto>()
  const aristas: AristaDispuesta[] = []
  const hijosDe = (id: string) => (abiertos.has(id) ? (arbol.hijos.get(id) ?? []) : [])
  const esHoja = (id: string) => hijosDe(id).length === 0

  const partesMemo = new Map<string, Parte[]>()
  const partes = (id: string): Parte[] => {
    const memo = partesMemo.get(id)
    if (memo) return memo
    const hijos = hijosDe(id)
    const hojas = hijos.filter(esHoja)
    let p: Parte[]
    if (hojas.length >= 2) {
      const ramas = hijos.filter((h) => !esHoja(h))
      p = [{ tipo: 'pila', ids: hojas }, ...ramas.map((r) => ({ tipo: 'nodo' as const, id: r }))]
    } else {
      p = hijos.map((h) => ({ tipo: 'nodo' as const, id: h }))
    }
    partesMemo.set(id, p)
    return p
  }
  const soloPila = (id: string) => {
    const p = partes(id)
    return p.length === 1 && p[0].tipo === 'pila'
  }

  const anchoMemo = new Map<string, number>()
  const ancho = (id: string): number => {
    const memo = anchoMemo.get(id)
    if (memo != null) return memo
    const p = partes(id)
    let a = ANCHO
    if (p.length && soloPila(id)) a = ANCHO + PILA_DX
    else if (p.length) a = Math.max(ANCHO, p.reduce((s, x) => s + anchoParte(x), 0) + SEP_X * (p.length - 1))
    anchoMemo.set(id, a)
    return a
  }
  const anchoParte = (x: Parte) => (x.tipo === 'nodo' ? ancho(x.id) : ANCHO + PILA_DX)

  const ubicar = (id: string, x: number, y: number) => {
    const p = partes(id)
    if (p.length && soloPila(id)) {
      pos.set(id, { x, y })
      const ids = (p[0] as { ids: string[] }).ids
      ids.forEach((h, i) => {
        pos.set(h, { x: x + PILA_DX, y: y + ALTO + 22 + i * (ALTO + PILA_SEP) })
        aristas.push({ id: `${id}>${h}`, origen: id, destino: h, tipo: 'pila' })
      })
      return
    }
    const a = ancho(id)
    pos.set(id, { x: x + a / 2 - ANCHO / 2, y })
    if (!p.length) return
    const total = p.reduce((s, q) => s + anchoParte(q), 0) + SEP_X * (p.length - 1)
    let cx = x + (a - total) / 2
    const yh = y + ALTO + SEP_Y
    for (const q of p) {
      if (q.tipo === 'nodo') {
        ubicar(q.id, cx, yh)
        aristas.push({ id: `${id}>${q.id}`, origen: id, destino: q.id, tipo: 'rama' })
      } else {
        q.ids.forEach((h, i) => {
          pos.set(h, { x: cx + PILA_DX, y: yh + i * (ALTO + PILA_SEP) })
          aristas.push({ id: `${id}>${h}`, origen: id, destino: h, tipo: 'pila-lado' })
        })
      }
      cx += anchoParte(q) + SEP_X
    }
  }

  let x = 0
  for (const r of arbol.raices) {
    ubicar(r, x, 0)
    x += ancho(r) + SEP_X * 3
  }
  return { pos, aristas, visibles: visiblesDe(arbol, abiertos) }
}

// -----------------------------------------------------------------------------
// Clásica (dagre)
// -----------------------------------------------------------------------------

function clasica(arbol: Arbol, abiertos: Set<string>): Disposicion {
  const visibles = visiblesDe(arbol, abiertos)
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: SEP_X, ranksep: SEP_Y, marginx: 0, marginy: 0 })
  g.setDefaultEdgeLabel(() => ({}))
  for (const id of visibles) g.setNode(id, { width: ANCHO, height: ALTO })
  const aristas: AristaDispuesta[] = []
  for (const id of visibles) {
    if (!abiertos.has(id)) continue
    for (const h of arbol.hijos.get(id) ?? []) {
      g.setEdge(id, h)
      aristas.push({ id: `${id}>${h}`, origen: id, destino: h, tipo: 'rama' })
    }
  }
  dagre.layout(g)
  const pos = new Map<string, Punto>()
  for (const id of visibles) {
    const n = g.node(id)
    pos.set(id, { x: n.x - ANCHO / 2, y: n.y - ALTO / 2 })
  }
  return { pos, aristas, visibles }
}
