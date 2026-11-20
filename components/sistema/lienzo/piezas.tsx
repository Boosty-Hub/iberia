'use client'

import { createContext, memo, useContext, type ReactNode } from 'react'
import { Handle, Position, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { COLOR_TONO, ETIQUETA_DIFF, TEXTO_TONO, type Capa, type NodoLienzo } from './tipos'

/**
 * La caja y la arista del lienzo. Lo que cambia con la interacción (la caja
 * elegida, el destino de un arrastre, la capa de color) llega por contexto, no
 * por los datos del nodo: así el lienzo no rehace los nodos en cada clic.
 */

export type ContextoCaja = {
  capa: Capa | null
  cuerpo?: (n: NodoLienzo, capa: string) => ReactNode
  abiertos: Set<string>
  sel: string | null
  hit: string | null
  destino: { id: string; error: string | null } | null
  editable: boolean
  conMenu: (n: NodoLienzo) => boolean
  abrirFicha: (n: NodoLienzo) => void
  abrirMenu: (n: NodoLienzo) => void
}

export const ContextoLienzo = createContext<ContextoCaja | null>(null)

export type DatosCaja = { nodo: NodoLienzo; nHijos: number }
export type NodoCaja = Node<DatosCaja, 'caja'>

export function MarcaChip({ capa, nodo, className }: { capa: Capa | null; nodo: NodoLienzo; className?: string }) {
  const m = capa?.marca(nodo)
  if (!m) return null
  return (
    <span className={cn('lz-chip', className)} style={{ color: TEXTO_TONO[m.tono], borderColor: `${COLOR_TONO[m.tono]}40` }} title={m.etiqueta}>
      <span aria-hidden>{m.icono}</span> {m.corta ?? m.etiqueta}
    </span>
  )
}

function CajaBase({ id, data }: NodeProps<NodoCaja>) {
  const ctx = useContext(ContextoLienzo)
  if (!ctx) return null
  const n = data.nodo
  const marca = ctx.capa?.marca(n) ?? null
  const abierto = ctx.abiertos.has(id)
  const sel = ctx.sel === id
  const destino = ctx.destino?.id === id ? ctx.destino : null
  const oscura = n.clase === 'raiz' || n.clase === 'grupo'
  return (
    <div
      className={cn(
        'lz-caja',
        `k-${n.clase}`,
        n.diff && `d-${n.diff}`,
        sel && 'sel',
        ctx.hit === id && 'hit',
        destino && (destino.error ? 'destino-no' : 'destino'),
      )}
    >
      <Handle type="target" id="t" position={Position.Top} isConnectable={false} className="lz-asa" />
      <Handle type="target" id="l" position={Position.Left} isConnectable={false} className="lz-asa" />
      <Handle type="source" id="b" position={Position.Bottom} isConnectable={false} className="lz-asa" />
      <Handle type="source" id="bl" position={Position.Bottom} isConnectable={false} className="lz-asa" style={{ left: 14 }} />
      {marca && !oscura && <span className="lz-franja" style={{ background: COLOR_TONO[marca.tono] }} aria-hidden />}
      {n.diff && <span className="lz-diff">{ETIQUETA_DIFF[n.diff]}</span>}
      <div className="lz-t" title={n.titulo}>
        {n.titulo}
      </div>
      {n.subtitulo && (
        <div className="lz-s" title={n.subtitulo}>
          {n.subtitulo}
        </div>
      )}
      <div className="lz-m">
        {ctx.cuerpo?.(n, ctx.capa?.clave ?? '')}
        {!oscura && <MarcaChip capa={ctx.capa} nodo={n} />}
      </div>
      {sel && (n.ficha || (ctx.editable && ctx.conMenu(n))) && (
        <div className="lz-acciones nodrag nopan">
          {ctx.editable && ctx.conMenu(n) && (
            <button
              type="button"
              className="lz-boton-caja"
              aria-label={`Cambiar «${n.titulo}» en el escenario`}
              onClick={(e) => {
                e.stopPropagation()
                ctx.abrirMenu(n)
              }}
            >
              ⋯
            </button>
          )}
          {n.ficha && (
            <button
              type="button"
              className="lz-boton-caja lz-vf"
              onClick={(e) => {
                e.stopPropagation()
                ctx.abrirFicha(n)
              }}
            >
              Ficha ›
            </button>
          )}
        </div>
      )}
      {data.nHijos > 0 && (
        <span className={cn('lz-mas', abierto && 'abierto')} aria-hidden>
          {abierto ? '−' : `+${data.nHijos}`}
        </span>
      )}
      {destino?.error && <span className="lz-destino-error">{destino.error}</span>}
    </div>
  )
}

export const Caja = memo(CajaBase)

// -----------------------------------------------------------------------------
// La arista: en ángulo recto, como en el organigrama de papel
// -----------------------------------------------------------------------------

export type DatosArista = { tipo: 'rama' | 'pila' | 'pila-lado'; dif: boolean }
export type AristaOrto = Edge<DatosArista, 'orto'>

const MEDIA_SEP_Y = 28

export function Arista({ sourceX, sourceY, targetX, targetY, data }: EdgeProps<AristaOrto>) {
  const sx = Math.round(sourceX)
  const sy = Math.round(sourceY)
  const tx = Math.round(targetX)
  const ty = Math.round(targetY)
  let d: string
  if (data?.tipo === 'pila') d = `M${sx},${sy} V${ty} H${tx}`
  else if (data?.tipo === 'pila-lado') d = `M${sx},${sy} V${sy + MEDIA_SEP_Y} H${tx - 15} V${ty} H${tx}`
  else {
    const ym = Math.round(sy + (ty - sy) / 2)
    d = `M${sx},${sy} V${ym} H${tx} V${ty}`
  }
  return <path className={cn('lz-arista', data?.dif && 'dif')} d={d} fill="none" />
}
