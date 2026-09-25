'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Los circuitos del informe: el flujo, los sistemas y el espejo.
 *
 * Todo el contenido llega de la base (`informe_circuito_puntos`,
 * `informe_modulos`, `informe_circuito_textos`), sembrado desde el taller con
 * `sembrar:circuitos`. Aquí solo vive la geometría del anillo y los nombres
 * genéricos de las estaciones: lo que es de Iberia no entra al repositorio, que
 * es público. Mismo criterio que el mapa interactivo.
 *
 * Los dos dibujos se enlazan entre sí: un punto del circuito dice qué módulo lo
 * atiende, y un módulo dice qué puntos destapa. Cada enlace lleva a la otra
 * sección con `?punto=` o `?modulo=`, que la página traduce en la selección
 * inicial.
 */

// ============================== Tipos ==============================
export type PuntoCircuito = {
  id: string
  circuito: 'flujo' | 'sistemas'
  numero: number
  titulo: string
  donde: string | null
  fase: string | null
  tipo: string | null
  sistemas: string[]
  que_pasa: string
  cifras: string[]
  destapes: { tipo: string; texto: string }[]
  pos_x: number
  pos_y: number
  centro: string | null
}

export type ModuloIberia = {
  id: string
  numero: number
  ola: string
  nombre: string[]
  titulo: string
  cubre: { texto: string; ia: boolean }[]
  nota: string | null
  lee: string
  postea: string
  deja_atras: string
  cifras: string[]
  destapa: string[]
  dispositivo: string
  pos_x: number
}

/** Un hallazgo del informe ubicado en el circuito (tabla `informe_hallazgos`). */
export type HallazgoCircuito = {
  codigo: string
  titulo: string
  patron: string
  nivel: 'critico' | 'atencion' | 'funciona'
  punto: string | null
  sistema: string | null
  orden: number
  /** El id del `### H-NN · Título` de la sección, calculado en el servidor. */
  ancla: string
}

const NIVEL_HALLAZGO: Record<string, string> = { critico: 'Crítico', atencion: 'Atención', funciona: 'Funciona' }

type Tramo = [modo: 'mano' | 'sistema', rotulo: string | null]
export type TextosCircuitos = {
  flujo?: {
    tesis: string; subtesis: string; retorno: string; codo_izq: string[]; codo_der: string[]; relojes: { cifra: string; texto: string }[]
    /** El área que lleva cada estación, en el orden de `EST_TOP` y `EST_BOT`. Son nombres de Iberia: viven en la base. */
    areas?: { arriba: (string | string[])[]; abajo: (string | string[])[] }
  }
  sistemas?: {
    tesis: string; subtesis: string; retorno: string; codo_izq: string[]; codo_der: string[]
    tramos: Record<string, Tramo>
    traspasos: { total: number; sistema: number; detalle: string }
    dormidas: string[]
  }
  espejo?: {
    jd: { titulo: string; sub: string; lineas: string[] }
    espejo: { titulo: string; sub: string; reflejo: string; fuerte: string; lineas: string[]; lema: string }
    vigas: { obtiene: string[]; postea: string[] }
  }
}

/**
 * El marco de los dibujos. Por debajo de ~860 px el dibujo no cabe y el marco se
 * desliza de lado; sin más, en el teléfono abría en el borde izquierdo, que en
 * los dos dibujos está casi vacío. Arranca centrado, y avisa que se desliza.
 */
function Lienzo({ children }: { children: ReactNode }) {
  const marco = useRef<HTMLDivElement>(null)
  const [desliza, setDesliza] = useState(false)
  useEffect(() => {
    const m = marco.current
    if (!m) return
    const medir = () => setDesliza(m.scrollWidth > m.clientWidth + 1)
    if (m.scrollWidth > m.clientWidth) m.scrollLeft = (m.scrollWidth - m.clientWidth) / 2
    // Se mide el marco y no la ventana: al abrir el panel de la ficha el marco
    // se encoge sin que la ventana cambie de tamaño.
    const observador = new ResizeObserver(medir)
    observador.observe(m)
    return () => observador.disconnect()
  }, [])
  return (
    <>
      <div ref={marco} className="circ-lienzo">{children}</div>
      {desliza && <p className="circ-desliza">Desliza de lado para ver el dibujo completo.</p>}
    </>
  )
}

const sinSuscripcion = () => () => {}

/**
 * La ficha de un punto o de un módulo, en un panel que entra desde la derecha.
 *
 * Antes iba debajo del dibujo, y para leerla había que bajar y perder el
 * circuito de vista: el lector subía, tocaba otro trombo y volvía a bajar. Ahora
 * se lee al lado del dibujo, que sigue vivo — **no es un modal**: no hay velo ni
 * se bloquea la página, y tocar otro trombo cambia la ficha sin cerrarla.
 *
 * En pantalla ancha ocupa casi media pantalla y le hace sitio: el índice del
 * informe se retira a la izquierda y el contenido se corre (`html.con-cajon` en
 * `globals.css`), para que el dibujo quede entero y no tapado. En teléfono
 * ocupa el ancho completo y se cierra con la ✕ o con Esc.
 *
 * Va por portal al `body`: un `position: fixed` dentro de la hoja quedaría
 * atrapado por cualquier ancestro con `transform` o `filter`.
 */
function Cajon({
  abierto,
  onCerrar,
  rotulo,
  clave,
  anterior,
  siguiente,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  rotulo: string
  /** Cambia con la ficha: al cambiar, el panel vuelve arriba. */
  clave: string
  anterior?: { etiqueta: string; ir: () => void }
  siguiente?: { etiqueta: string; ir: () => void }
  children: ReactNode
}) {
  // En el servidor no hay `document`: el portal se monta ya en el navegador.
  const enNavegador = useSyncExternalStore(sinSuscripcion, () => true, () => false)
  const cuerpo = useRef<HTMLDivElement>(null)
  const cerrar = useRef(onCerrar)
  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    if (!abierto) return
    const raiz = document.documentElement
    raiz.classList.add('con-cajon')
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current()
    }
    document.addEventListener('keydown', alTeclear)
    return () => {
      raiz.classList.remove('con-cajon')
      document.removeEventListener('keydown', alTeclear)
    }
  }, [abierto])

  useEffect(() => {
    cuerpo.current?.scrollTo({ top: 0 })
  }, [clave])

  if (!enNavegador) return null
  return createPortal(
    <aside className={`circ-vars circ-cajon${abierto ? ' abierto' : ''}`} aria-label={rotulo} aria-hidden={!abierto} inert={!abierto}>
      <div className="circ-cajon-barra">
        <span className="circ-cajon-rotulo">{rotulo}</span>
        <div className="circ-cajon-botones">
          <button type="button" className="circ-cajon-boton" onClick={anterior?.ir} disabled={!anterior} aria-label={anterior ? `Anterior: ${anterior.etiqueta}` : 'Anterior'} title={anterior?.etiqueta}>
            <span aria-hidden="true">←</span>
          </button>
          <button type="button" className="circ-cajon-boton" onClick={siguiente?.ir} disabled={!siguiente} aria-label={siguiente ? `Siguiente: ${siguiente.etiqueta}` : 'Siguiente'} title={siguiente?.etiqueta}>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="circ-cajon-boton cerrar" onClick={onCerrar} aria-label="Cerrar la ficha" title="Cerrar (Esc)">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
      <div ref={cuerpo} className="circ-cajon-cuerpo" aria-live="polite">
        {children}
      </div>
    </aside>,
    document.body
  )
}

/** El anterior y el siguiente dentro de lo que el filtro deja ver. */
function vecinos<T extends { id: string }>(recorrido: T[], actual: T | undefined) {
  const i = actual ? recorrido.findIndex((x) => x.id === actual.id) : -1
  return { antes: i > 0 ? recorrido[i - 1] : undefined, despues: i === -1 ? recorrido[0] : recorrido[i + 1] }
}

// ============================== Vocabulario ==============================
const DESTAPE: Record<string, string> = {
  erp: 'Conectar o configurar lo que ya existe', regla: 'Escribir una regla', captura: 'Capturar donde ocurre', ia: 'IA que propone, la persona decide',
  espejo: 'Construir en el sistema Iberia',
}
const FASE: Record<string, [string, string]> = { '2': ['Fase 2 propuesta', 'f2'], '3': ['Fase 3 · planta', 'f3'], sin: ['Sin fase asignada', 'sin'] }
const TIPO: Record<string, string> = {
  duplicacion: 'Se escribe más de una vez', doble_esfuerzo: 'Se rehace a mano', choque: 'Versiones que chocan',
  puente_roto: 'Puente roto', dato_fuera: 'Vive fuera del sistema', punto_unico: 'Depende de una persona',
}
const OLA: Record<string, [string, string]> = { base: ['Base · antes de todo', 'sin'], '1': ['Ola 1 · Fase 2', 'f2'], '2': ['Ola 2', 'sin'], '3': ['Ola 3 · Fase 3', 'f3'] }

// ============================== Geometría ==============================
const TOPX = [180, 283, 386, 489, 591, 694, 797, 900]
const BOTX = [900, 780, 660, 540, 420, 300, 180]
const EST_TOP: (string | string[])[] = ['Pronóstico', ['Plan de', 'producción'], ['Explosión de', 'materiales'], 'Compra', 'Recepción', 'Calidad', 'Producción', ['Producto', 'terminado']]
const EST_BOT: (string | string[])[] = ['Pedido', ['Liberación', 'de crédito'], 'Factura', 'Despacho', 'Entrega', 'Cobro', ['Pago', 'aplicado']]
const PIEZAS: Record<string, string> = {
  t0: 'M180,120 H283', t1: 'M283,120 H386', t2: 'M386,120 H489', t3: 'M489,120 H591', t4: 'M591,120 H694', t5: 'M694,120 H797', t6: 'M797,120 H900',
  aD: 'M900,120 A140,140 0 0 1 900,400',
  b0: 'M900,400 H780', b1: 'M780,400 H660', b2: 'M660,400 H540', b3: 'M540,400 H420', b4: 'M420,400 H300', b5: 'M300,400 H180',
  aI: 'M180,400 A140,140 0 0 1 180,120',
}
const RETORNO = 'M180,391 C300,300 660,300 778,389'
const MEDIO: Record<string, number> = { t0: 231.5, t1: 334.5, t2: 437.5, t3: 540, t4: 642.5, t5: 745.5, t6: 848.5, b0: 840, b1: 720, b2: 600, b3: 480, b4: 360, b5: 240 }
const CHEVRONES: [number, number, number][] = [[231, 120, 0], [643, 120, 0], [990, 153, 40], [990, 367, 140], [90, 367, -140], [90, 153, -40]]

/**
 * El nombre de la estación y, debajo, el área que la lleva. Arriba del anillo el
 * rótulo sube para dejarle sitio al área sin tocar la estación; abajo, el área va
 * detrás del nombre. Se pidió en la reunión del equipo del 25 de septiembre: «el
 * departamento responsable debería estar en el propio gráfico».
 */
function Rotulo({ x, nombre, area, abajo = false }: { x: number; nombre: string | string[]; area?: string | string[]; abajo?: boolean }) {
  const lineas = Array.isArray(nombre) ? nombre : [nombre]
  const areas = area ? (Array.isArray(area) ? area : [area]) : []
  let y: number
  let yArea: number
  if (abajo) {
    y = 444
    yArea = 444 + lineas.length * 15 - 1
  } else if (areas.length) {
    y = 74 - (lineas.length - 1) * 15
    yArea = 89
  } else {
    y = lineas.length > 1 ? 71 : 86
    yArea = 0
  }
  return (
    <>
      {lineas.map((l, i) => <text key={l} className="circ-t-estacion" x={x} y={y + i * 15}>{l}</text>)}
      {areas.map((l, i) => <text key={`a-${l}`} className="circ-t-area" x={x} y={yArea + i * 11}>{l}</text>)}
    </>
  )
}

function Anillo({ id, chevrones = true, lanesTop = 36, lanesBot = 506, areas, children }: { id: string; chevrones?: boolean; lanesTop?: number; lanesBot?: number; areas?: { arriba: (string | string[])[]; abajo: (string | string[])[] }; children?: React.ReactNode }) {
  return (
    <>
      <defs>
        <marker id={`${id}-flecha`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>
      <text className="circ-t-carril" x={180} y={lanesTop}>ABASTECER Y PRODUCIR  →</text>
      <text className="circ-t-carril" x={900} y={lanesBot} textAnchor="end">←  VENDER Y COBRAR</text>
      {Object.entries(PIEZAS).map(([k, d]) => <path key={k} className="circ-vaso" d={d} />)}
      {children}
      {chevrones && CHEVRONES.map(([x, y, r]) => <path key={`${x}-${y}`} className="circ-chevron" transform={`translate(${x},${y}) rotate(${r})`} d="M-4,-6 L3,0 L-4,6" />)}
      {TOPX.map((x, i) => (
        <g key={`t${x}`}><circle className="circ-estacion" cx={x} cy={120} r={7} /><Rotulo x={x} nombre={EST_TOP[i]} area={areas?.arriba[i]} /></g>
      ))}
      {BOTX.map((x, i) => (
        <g key={`b${x}`}><circle className="circ-estacion" cx={x} cy={400} r={7} /><Rotulo x={x} nombre={EST_BOT[i]} area={areas?.abajo[i]} abajo /></g>
      ))}
    </>
  )
}

function Marcador({ p, sel, atenuado, resaltado, onElegir, r = 14, cuenta }: { p: PuntoCircuito; sel: boolean; atenuado: boolean; resaltado: boolean; onElegir: () => void; r?: number; cuenta?: { n: number; critico: boolean } }) {
  const cx = Number(p.pos_x), cy = Number(p.pos_y)
  return (
    <g
      className={`circ-punto${sel ? ' sel' : ''}${atenuado ? ' atenuado' : ''}${resaltado ? ' resaltado' : ''}`}
      tabIndex={0} role="button" aria-label={`${p.numero}: ${p.titulo}`}
      onClick={onElegir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onElegir() } }}
    >
      <circle className="halo" cx={cx} cy={cy} r={r + 8} />
      <circle className="anillo" cx={cx} cy={cy} r={r + 12} />
      <circle className="nucleo" cx={cx} cy={cy} r={r} />
      <text className="numero" x={cx} y={cy}>{p.numero}</text>
      {/* Cuántos hallazgos caen en este punto: el globo va en rojo si alguno es crítico. */}
      {cuenta && cuenta.n > 0 && (
        <g className={`circ-cuenta${cuenta.critico ? ' critico' : ''}`} aria-hidden="true">
          <circle cx={cx + r + 4} cy={cy - r - 4} r={9} />
          <text x={cx + r + 4} y={cy - r - 4}>{cuenta.n}</text>
        </g>
      )}
    </g>
  )
}

// ============================== Piezas de la ficha ==============================
function Etq({ children, tono = '' }: { children: React.ReactNode; tono?: string }) {
  return <span className={`circ-etq ${tono}`}>{children}</span>
}
function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <div><h3 className="circ-h3">{titulo}</h3>{children}</div>
}
function Cifras({ cifras }: { cifras: string[] }) {
  return <ul className="circ-cifras">{cifras.map((c) => <li key={c}>{c}</li>)}</ul>
}
function claseModulo(m: ModuloIberia) { return m.ola === 'base' ? 'base' : `ola${m.ola}` }

function Filtros({ opciones, valor, onCambio }: { opciones: [string, string, string?][]; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="circ-filtros" role="group" aria-label="Filtrar">
      <span className="etiqueta">Ver</span>
      {opciones.map(([clave, texto, extra]) => (
        <button key={clave} type="button" className={`circ-chip ${extra ?? ''}`} aria-pressed={valor === clave} onClick={() => onCambio(clave)}>{texto}</button>
      ))}
    </div>
  )
}

/** «3 hallazgos · 1 crítico», para la lista de puntos. */
function metaHallazgos(hs: HallazgoCircuito[]) {
  if (!hs.length) return 'Sin hallazgos propios'
  const criticos = hs.filter((h) => h.nivel === 'critico').length
  return `${hs.length} ${hs.length === 1 ? 'hallazgo' : 'hallazgos'}${criticos ? ` · ${criticos} ${criticos === 1 ? 'crítico' : 'críticos'}` : ''}`
}

/**
 * Cada hallazgo con su nivel, y enlace a su tarjeta en la misma sección. Desde
 * el panel, el enlace lo cierra: quien baja a la tarjeta pasa a leer, y la
 * tarjeta se lee a todo el ancho.
 */
function ListaHallazgos({ hallazgos, base = '', onIr }: { hallazgos: HallazgoCircuito[]; base?: string; onIr?: () => void }) {
  return (
    <ul className="circ-hallazgos">
      {hallazgos.map((h) => (
        <li key={h.codigo}>
          <a href={`${base}#${h.ancla}`} className="circ-hallazgo" onClick={onIr}>
            <span className={`circ-nivel ${h.nivel}`}>{NIVEL_HALLAZGO[h.nivel]}</span>
            <span className="min-w-0"><b>{h.codigo}</b> {h.titulo}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

// ============================== Circuitos 1 y 2 ==============================
/**
 * Los dos anillos del circuito. Con `vistaFija` pinta uno solo, sin pestañas:
 * el flujo en «Los hallazgos» y los sistemas en «Sistemas y estado del dato».
 * Con `hallazgos`, cada punto lleva cuántos hallazgos caen en él —en rojo si
 * alguno es crítico—, su ficha los lista con enlace a su tarjeta, y debajo van
 * los transversales, los que no caen en un solo punto.
 */
export function CircuitosDelNegocio({
  puntos,
  modulos,
  textos,
  inicial,
  vistaFija,
  hallazgos = [],
  hallazgosEn = '',
}: {
  puntos: PuntoCircuito[]
  modulos: ModuloIberia[]
  textos: TextosCircuitos
  inicial?: string
  vistaFija?: 'flujo' | 'sistemas'
  hallazgos?: HallazgoCircuito[]
  /** Dónde viven las tarjetas de los hallazgos: vacío si es esta misma página. */
  hallazgosEn?: string
}) {
  const inicialValido = puntos.find((p) => p.id === inicial && (!vistaFija || p.circuito === vistaFija))
  const [vista, setVista] = useState<'flujo' | 'sistemas'>(vistaFija ?? inicialValido?.circuito ?? 'flujo')
  const conHallazgos = hallazgos.length > 0
  const hallazgosDe = (p: PuntoCircuito) =>
    hallazgos.filter((h) => (p.circuito === 'flujo' ? h.punto : h.sistema) === p.id).sort((a, b) => a.orden - b.orden)
  const cuentaDe = (p: PuntoCircuito) => {
    const hs = hallazgosDe(p)
    return { n: hs.length, critico: hs.some((h) => h.nivel === 'critico') }
  }
  const transversales =
    conHallazgos && vista === 'flujo' ? hallazgos.filter((h) => !h.punto).sort((a, b) => a.orden - b.orden) : []
  const [sel, setSel] = useState<Record<string, string>>({
    flujo: inicialValido?.circuito === 'flujo' ? inicialValido.id : puntos.find((p) => p.circuito === 'flujo' && p.numero === 5)?.id ?? '',
    sistemas: inicialValido?.circuito === 'sistemas' ? inicialValido.id : puntos.find((p) => p.circuito === 'sistemas' && p.numero === 3)?.id ?? '',
  })
  const [filtro, setFiltro] = useState<Record<string, string>>({ flujo: 'todos', sistemas: 'todos' })
  // El panel arranca cerrado, salvo que se llegue con `?punto=` desde otra sección.
  const [abierto, setAbierto] = useState(Boolean(inicialValido))

  const lista = puntos.filter((p) => p.circuito === vista).sort((a, b) => a.numero - b.numero)
  const f = filtro[vista]
  const porNivel = conHallazgos && vista === 'flujo'
  const coincide = (p: PuntoCircuito) => {
    if (f === 'todos') return true
    if (porNivel) return hallazgosDe(p).some((h) => h.nivel === f)
    if (vista === 'flujo') return p.fase === f
    const grupos: Record<string, string[]> = { dos: ['duplicacion', 'doble_esfuerzo'], fuera: ['dato_fuera', 'punto_unico'], roto: ['puente_roto'], choque: ['choque'] }
    return (grupos[f] ?? []).includes(p.tipo ?? '')
  }
  const elegido = lista.find((p) => p.id === sel[vista]) ?? lista[0]
  const elegir = (id: string) => setSel((s) => ({ ...s, [vista]: id }))
  const abrir = (id: string) => {
    elegir(id)
    setAbierto(true)
  }
  const visibleSel = (p: PuntoCircuito) => abierto && p.id === elegido?.id
  const recorrido = lista.filter(coincide).length ? lista.filter(coincide) : lista
  const { antes, despues } = vecinos(recorrido, elegido)
  const cambiarFiltro = (v: string) => {
    setFiltro((s) => ({ ...s, [vista]: v }))
    const actual = lista.find((p) => p.id === sel[vista])
    const nuevoCoincide = (p: PuntoCircuito) => v === 'todos' || (porNivel ? hallazgosDe(p).some((h) => h.nivel === v) : vista === 'flujo' ? p.fase === v : ({ dos: ['duplicacion', 'doble_esfuerzo'], fuera: ['dato_fuera', 'punto_unico'], roto: ['puente_roto'], choque: ['choque'] }[v] ?? []).includes(p.tipo ?? ''))
    if (actual && !nuevoCoincide(actual)) { const primero = lista.find(nuevoCoincide); if (primero) elegir(primero.id) }
  }
  const cuenta = (pred: (p: PuntoCircuito) => boolean) => lista.filter(pred).length
  const opciones: [string, string, string?][] = porNivel
    ? [['todos', `Los ${lista.length} puntos`], ['critico', `Con críticos · ${cuenta((p) => hallazgosDe(p).some((h) => h.nivel === 'critico'))}`, 'rojo'], ['atencion', `Con atención · ${cuenta((p) => hallazgosDe(p).some((h) => h.nivel === 'atencion'))}`]]
    : vista === 'flujo'
    ? [['todos', `Los ${lista.length}`], ['2', `Fase 2 propuesta · ${cuenta((p) => p.fase === '2')}`, 'dorado'], ['3', `Fase 3 · planta · ${cuenta((p) => p.fase === '3')}`], ['sin', `Sin fase todavía · ${cuenta((p) => p.fase === 'sin')}`]]
    : [['todos', `Los ${lista.length}`], ['dos', `Se escribe más de una vez · ${cuenta((p) => ['duplicacion', 'doble_esfuerzo'].includes(p.tipo ?? ''))}`], ['fuera', `Fuera o en una persona · ${cuenta((p) => ['dato_fuera', 'punto_unico'].includes(p.tipo ?? ''))}`], ['roto', `Puente roto · ${cuenta((p) => p.tipo === 'puente_roto')}`], ['choque', `Chocan · ${cuenta((p) => p.tipo === 'choque')}`]]

  const tf = textos.flujo
  const ts = textos.sistemas
  const atendidoPor = (id: string) => modulos.filter((m) => m.destapa.includes(id))

  return (
    <div className="circ" id="circuitos">
      <div className="circ-controles">
        {vistaFija ? (
          <span className="circ-rotulo-vista">
            {vistaFija === 'flujo' ? 'El circuito del negocio · dónde espera el trabajo' : 'El circuito del negocio · por dónde viaja el dato'}
          </span>
        ) : (
          <div className="circ-pestanas" role="tablist" aria-label="Circuito">
            <button type="button" role="tab" aria-selected={vista === 'flujo'} className="circ-pestana" onClick={() => setVista('flujo')}>El flujo</button>
            <button type="button" role="tab" aria-selected={vista === 'sistemas'} className="circ-pestana" onClick={() => setVista('sistemas')}>Los sistemas</button>
          </div>
        )}
        <Filtros opciones={opciones} valor={f} onCambio={cambiarFiltro} />
      </div>

      <figure className="circ-figura">
        <Lienzo>
          {vista === 'flujo' ? (
            <svg viewBox="0 0 1080 520" role="group" aria-label="El circuito del negocio con los puntos donde el flujo espera">
              <Anillo id="flujo" areas={tf?.areas}>
                <path className="circ-retorno" d={RETORNO} markerEnd="url(#flujo-flecha)" />
              </Anillo>
              {tf && (
                <>
                  <text className="circ-t-nota" x={480} y={286} textAnchor="middle" fontStyle="italic">{tf.retorno}</text>
                  <text className="circ-t-tesis" x={540} y={198}>{tf.tesis}</text>
                  <text className="circ-t-subtesis" x={540} y={228}>{tf.subtesis}</text>
                  {tf.codo_izq.map((l, i) => <text key={l} className="circ-t-nota" x={74} y={252 + i * 15}>{l}</text>)}
                  {tf.codo_der.map((l, i) => <text key={l} className="circ-t-nota" x={1006} y={252 + i * 15} textAnchor="end">{l}</text>)}
                </>
              )}
              {lista.map((p) => (
                <Marcador key={p.id} p={p} sel={visibleSel(p)} atenuado={!coincide(p)} resaltado={f === '2' && p.fase === '2'} onElegir={() => abrir(p.id)} cuenta={conHallazgos ? cuentaDe(p) : undefined} />
              ))}
            </svg>
          ) : (
            <svg viewBox="0 0 1080 520" role="group" aria-label="El mismo circuito visto desde los sistemas: cómo cruza el dato cada tramo y dónde se tapa">
              <Anillo id="sistemas" chevrones={false} lanesTop={22} lanesBot={508}>
                {ts && Object.entries(ts.tramos).map(([k, [modo]]) => (
                  k === 'in'
                    ? <path key={k} className={modo === 'sistema' ? 'circ-retorno-sistema' : 'circ-modo-mano'} d={RETORNO} />
                    : <path key={k} className={`circ-modo-${modo}`} d={PIEZAS[k]} />
                ))}
              </Anillo>
              {ts && (
                <>
                  {Object.entries(ts.tramos).filter(([k, [, rot]]) => rot && MEDIO[k] !== undefined).map(([k, [modo, rot]]) => (
                    <text key={k} className={`circ-t-medio ${modo}`} x={MEDIO[k]} y={k.startsWith('t') ? 50 : 482}>{rot}</text>
                  ))}
                  {ts.codo_izq.map((l, i) => <text key={l} className="circ-t-medio mano" x={74} y={252 + i * 15} textAnchor="start">{l}</text>)}
                  {ts.codo_der.map((l, i) => <text key={l} className="circ-t-medio mano" x={1006} y={252 + i * 15} textAnchor="end">{l}</text>)}
                  <text className="circ-t-medio sistema" x={480} y={304}>{ts.retorno}</text>
                  <text className="circ-t-tesis" x={540} y={200}>{ts.tesis}</text>
                  <text className="circ-t-subtesis" x={540} y={226}>{ts.subtesis}</text>
                </>
              )}
              {lista.map((p) => (
                <g key={p.id}>
                  <Marcador p={p} r={p.centro ? 12 : 14} sel={visibleSel(p)} atenuado={!coincide(p)} resaltado={false} onElegir={() => abrir(p.id)} cuenta={conHallazgos ? cuentaDe(p) : undefined} />
                  {p.centro && <text className="circ-t-nota circ-t-centro" x={Number(p.pos_x) + 22} y={Number(p.pos_y) + 4}>{p.centro}</text>}
                </g>
              ))}
            </svg>
          )}
        </Lienzo>
        {vista === 'sistemas' && (
          <div className="circ-leyenda" aria-hidden="true">
            <span><svg width="34" height="10" viewBox="0 0 34 10"><line x1="2" y1="5" x2="32" y2="5" className="circ-modo-sistema" /></svg>el dato pasa de sistema a sistema</span>
            <span><svg width="34" height="10" viewBox="0 0 34 10"><line x1="2" y1="5" x2="32" y2="5" className="circ-modo-mano" /></svg>el dato pasa a mano: correo, re-tecleo, papel, palabra, WhatsApp</span>
          </div>
        )}
      </figure>

      {vista === 'sistemas' && ts && (
        <div className="circ-traspasos">
          <div className="circ-barra" role="img" aria-label={`${ts.traspasos.sistema} de ${ts.traspasos.total} traspasos van de sistema a sistema`}>
            <i style={{ width: `${(ts.traspasos.sistema / ts.traspasos.total) * 100}%` }} className="sis" />
            <i style={{ width: `${(1 - ts.traspasos.sistema / ts.traspasos.total) * 100}%` }} className="mano" />
          </div>
          <p><b>{ts.traspasos.total} traspasos de dato</b> describió la gente. <b>{ts.traspasos.sistema}</b> van de sistema a sistema; los otros <b>{ts.traspasos.total - ts.traspasos.sistema}</b> viajan a mano: {ts.traspasos.detalle}.</p>
          <p><b>Lo que JD ya tiene y no se usa</b>, y apareció en una entrevista como algo que «JD no hace»:</p>
          <div className="circ-dormidas">{ts.dormidas.map((d) => <span key={d}>{d}</span>)}</div>
        </div>
      )}

      <div className="circ-detalle">
        <p className="circ-guia">Elige un punto del dibujo o de la lista: su ficha se abre a un lado, sin perder el circuito de vista.</p>
        <div className="circ-lista" role="group" aria-label={vista === 'flujo' ? 'Los puntos donde el flujo espera' : 'Los trombos de sistema'}>
          {lista.map((p) => (
            <button key={p.id} type="button" className={`circ-item${coincide(p) ? '' : ' atenuado'}`} aria-pressed={visibleSel(p)} onClick={() => abrir(p.id)}>
              <span className="circ-badge">{p.numero}</span>
              <span><span className="tit">{p.titulo}</span><span className="meta">{conHallazgos ? metaHallazgos(hallazgosDe(p)) : vista === 'flujo' ? `${(p.donde ?? '').split(' · ')[0]} · ${FASE[p.fase ?? 'sin']?.[0] ?? ''}` : TIPO[p.tipo ?? ''] ?? ''}</span></span>
            </button>
          ))}
        </div>
      </div>

      <Cajon
        abierto={abierto && Boolean(elegido)}
        onCerrar={() => setAbierto(false)}
        rotulo={`${vista === 'flujo' ? 'Punto' : 'Trombo'} ${elegido?.numero ?? ''} de ${lista.length}`}
        clave={elegido?.id ?? ''}
        anterior={antes && { etiqueta: `${antes.numero} · ${antes.titulo}`, ir: () => elegir(antes.id) }}
        siguiente={despues && { etiqueta: `${despues.numero} · ${despues.titulo}`, ir: () => elegir(despues.id) }}
      >
        {elegido && (
          <article className="circ-ficha">
            <div className="circ-ficha-cabeza">
              <div className="circ-ficha-num" aria-hidden="true">{elegido.numero}</div>
              <div>
                <h3 className="circ-ficha-titulo">{elegido.titulo}</h3>
                <div className="circ-donde">
                  {vista === 'flujo' ? (
                    <><span>{elegido.donde}</span><Etq tono={FASE[elegido.fase ?? 'sin']?.[1]}>{FASE[elegido.fase ?? 'sin']?.[0]}</Etq></>
                  ) : (
                    <><Etq tono="rojo">{TIPO[elegido.tipo ?? '']}</Etq>{elegido.sistemas.map((s) => <Etq key={s} tono="sis">{s}</Etq>)}</>
                  )}
                </div>
              </div>
            </div>
            <Bloque titulo={vista === 'flujo' ? 'Qué pasa' : 'Qué pasa con el dato'}><p>{elegido.que_pasa}</p></Bloque>
            {conHallazgos && hallazgosDe(elegido).length > 0 && (
              <Bloque titulo="Los hallazgos de este punto">
                <ListaHallazgos hallazgos={hallazgosDe(elegido)} base={hallazgosEn} onIr={() => setAbierto(false)} />
              </Bloque>
            )}
            <Bloque titulo="Las cifras"><Cifras cifras={elegido.cifras} /></Bloque>
            {vista === 'flujo' && elegido.destapes.length > 0 && (
              <Bloque titulo="Cómo se destapa">
                <div className="circ-destapes">
                  {elegido.destapes.map((d) => (
                    <div key={d.texto} className="circ-destape"><span className={`circ-tipo${d.tipo === 'ia' ? ' ia' : ''}`}>{DESTAPE[d.tipo]}</span><span>{d.texto}</span></div>
                  ))}
                </div>
              </Bloque>
            )}
            <Bloque titulo="Lo atiende en el sistema Iberia">
              <div className="circ-enlaces">
                {atendidoPor(elegido.id).length === 0 && <span className="circ-nada">Sin módulo propuesto todavía</span>}
                {atendidoPor(elegido.id).map((m) => (
                  <Link key={m.id} className="circ-ir" href={`/informe/arquitectura-ia?modulo=${m.id}#espejo`}>
                    <span className={`mini mod ${claseModulo(m)}`}>{m.numero}</span><span>Módulo · {m.titulo}</span>
                  </Link>
                ))}
              </div>
            </Bloque>
          </article>
        )}
      </Cajon>

      {transversales.length > 0 && (
        <section className="circ-transversales" aria-label="Hallazgos transversales">
          <h3 className="circ-h3">Los que no caen en un solo punto · {transversales.length}</h3>
          <p className="circ-nota-transversal">Recorren el circuito entero: el ataque, el gobierno, el conocimiento que vive en una persona.</p>
          <ListaHallazgos hallazgos={transversales} base={hallazgosEn} />
        </section>
      )}

      {vista === 'flujo' && tf && (
        <div className="circ-relojes">
          {tf.relojes.map((r) => <div key={r.cifra} className="circ-reloj"><b>{r.cifra}</b><span>{r.texto}</span></div>)}
        </div>
      )}
    </div>
  )
}

// ============================== Circuito 3 · El espejo ==============================
const yModulo = (x: number) => { const t = (x - 550) / 460; return 520 + 60 * (1 - t * t) }

export function EspejoIberia({ modulos, puntos, textos, inicial }: { modulos: ModuloIberia[]; puntos: PuntoCircuito[]; textos: TextosCircuitos; inicial?: string }) {
  const ordenados = [...modulos].sort((a, b) => a.numero - b.numero)
  const [sel, setSel] = useState(ordenados.find((m) => m.id === inicial)?.id ?? ordenados.find((m) => m.ola === '1')?.id ?? ordenados[0]?.id)
  const [filtro, setFiltro] = useState('todos')
  const [abierto, setAbierto] = useState(Boolean(inicial && ordenados.some((m) => m.id === inicial)))
  const coincide = (m: ModuloIberia) => filtro === 'todos' || m.ola === filtro
  const elegido = ordenados.find((m) => m.id === sel) ?? ordenados[0]
  const abrir = (id: string) => {
    setSel(id)
    setAbierto(true)
  }
  const visibleSel = (m: ModuloIberia) => abierto && m.id === elegido?.id
  const recorrido = ordenados.filter(coincide).length ? ordenados.filter(coincide) : ordenados
  const { antes, despues } = vecinos(recorrido, elegido)
  const te = textos.espejo
  const cambiarFiltro = (v: string) => {
    setFiltro(v)
    if (elegido && !(v === 'todos' || elegido.ola === v)) { const primero = ordenados.find((m) => v === 'todos' || m.ola === v); if (primero) setSel(primero.id) }
  }
  const cuenta = (o: string) => ordenados.filter((m) => m.ola === o).length
  const opciones: [string, string, string?][] = [['todos', `Los ${ordenados.length}`], ['1', `Ola 1 · Fase 2 · ${cuenta('1')}`, 'dorado'], ['2', `Ola 2 · ${cuenta('2')}`], ['3', `Ola 3 · Fase 3 · ${cuenta('3')}`], ['base', `Base · ${cuenta('base')}`]]
  const porId = Object.fromEntries(puntos.map((p) => [p.id, p]))
  const ia = elegido ? elegido.cubre.filter((c) => c.ia).length : 0

  return (
    <div className="circ" id="espejo">
      <div className="circ-controles"><span className="circ-rotulo-vista">El sistema Iberia · el espejo de JD</span><Filtros opciones={opciones} valor={filtro} onCambio={cambiarFiltro} /></div>
      <figure className="circ-figura">
        <Lienzo>
          <svg viewBox="0 0 1100 700" role="group" aria-label="JD queda atrás con lo administrativo; delante, el sistema Iberia como espejo al día y conectado de ida y vuelta; del espejo salen los módulos" className="circ-escena">
            <defs>
              <marker id="espejo-flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
              </marker>
              <linearGradient id="espejo-vidrio" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" className="circ-vidrio-a" />
                <stop offset="1" className="circ-vidrio-b" />
              </linearGradient>
            </defs>
            {te && (
              <>
                <g transform="skewY(-3.32)">
                  <rect className="circ-panel-jd" x={400} y={81.2} width={310} height={154} rx={6} />
                  <text className="circ-t-jd-titulo" x={555} y={112} textAnchor="middle">{te.jd.titulo}</text>
                  <text className="circ-t-jd" x={555} y={130} textAnchor="middle">{te.jd.sub}</text>
                  {te.jd.lineas.map((l, i) => <text key={l} className="circ-t-jd" x={555} y={152 + i * 16} textAnchor="middle">{l}</text>)}
                </g>
                <path className="circ-viga" d="M398,64 L298,164" markerEnd="url(#espejo-flecha)" />
                <path className="circ-viga" d="M804,136 L716,46" markerEnd="url(#espejo-flecha)" />
                <text className="circ-t-viga" x={336} y={98} textAnchor="end">{te.vigas.obtiene[0]}</text>
                <text className="circ-t-viga-2" x={336} y={114} textAnchor="end">{te.vigas.obtiene[1]}</text>
                <text className="circ-t-viga" x={778} y={82}>{te.vigas.postea[0]}</text>
                <text className="circ-t-viga-2" x={778} y={98}>{te.vigas.postea[1]}</text>
                <g transform="skewY(-3.08)">
                  <rect className="circ-espejo-halo" x={290} y={185.6} width={520} height={254} rx={10} />
                  <rect className="circ-espejo" x={290} y={185.6} width={520} height={254} rx={10} fill="url(#espejo-vidrio)" />
                  <polygon className="circ-brillo" points="572,188 646,188 486,437 412,437" />
                  <text className="circ-t-espejo-titulo" x={550} y={222} textAnchor="middle">{te.espejo.titulo}</text>
                  <text className="circ-t-espejo" x={550} y={241} textAnchor="middle">{te.espejo.sub}</text>
                  <text className="circ-t-espejo-reflejo" x={550} y={266} textAnchor="middle">{te.espejo.reflejo}</text>
                  <line className="circ-separador" x1={330} x2={770} y1={282} y2={282} />
                  <text className="circ-t-espejo-fuerte" x={550} y={304} textAnchor="middle">{te.espejo.fuerte}</text>
                  {te.espejo.lineas.map((l, i) => <text key={l} className="circ-t-espejo" x={550} y={324 + i * 18} textAnchor="middle">{l}</text>)}
                  <text className="circ-t-espejo-lema" x={550} y={380} textAnchor="middle">{te.espejo.lema}</text>
                </g>
              </>
            )}
            {ordenados.map((m, i) => {
              const xa = 320 + i * (460 / Math.max(1, ordenados.length - 1))
              const ya = 424 - 0.0538 * (xa - 290)
              return <path key={m.id} className={`circ-haz${visibleSel(m) ? ' on' : ''}`} d={`M${xa},${ya} L${Number(m.pos_x)},${yModulo(Number(m.pos_x)) - 15}`} />
            })}
            {ordenados.map((m) => {
              const x = Number(m.pos_x), y = yModulo(x)
              return (
                <g
                  key={m.id}
                  className={`circ-modulo ${claseModulo(m)}${visibleSel(m) ? ' sel' : ''}${coincide(m) ? '' : ' atenuado'}`}
                  tabIndex={0} role="button" aria-label={`Módulo ${m.numero}, ${m.nombre.join(' ')}: ${m.titulo}`}
                  onClick={() => abrir(m.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(m.id) } }}
                >
                  <polygon className="cara-izq" points={`${x - 46},${y} ${x},${y + 15} ${x},${y + 29} ${x - 46},${y + 14}`} />
                  <polygon className="cara-der" points={`${x},${y + 15} ${x + 46},${y} ${x + 46},${y + 14} ${x},${y + 29}`} />
                  <polygon className="cara-sup" points={`${x - 46},${y} ${x},${y - 15} ${x + 46},${y} ${x},${y + 15}`} />
                  <text className="n-mod" x={x} y={y}>{m.numero}</text>
                  {m.nombre.map((l, i) => <text key={l} className="t-mod" x={x} y={y + 48 + i * 15}>{l}</text>)}
                </g>
              )
            })}
          </svg>
        </Lienzo>
        <div className="circ-leyenda" aria-hidden="true">
          <span><span className="circ-badge mod base">·</span>base: una sola fuente</span>
          <span><span className="circ-badge mod ola1">·</span>ola 1 · Fase 2: comercial, compras y finanzas</span>
          <span><span className="circ-badge mod ola2">·</span>ola 2 · distribución y personas</span>
          <span><span className="circ-badge mod ola3">·</span>ola 3 · planta, Fase 3</span>
        </div>
      </figure>

      <div className="circ-detalle">
        <p className="circ-guia">Elige un módulo del dibujo o de la lista: su ficha se abre a un lado.</p>
        <div className="circ-lista" role="group" aria-label="Los módulos del sistema Iberia">
          {ordenados.map((m) => (
            <button key={m.id} type="button" className={`circ-item mod${coincide(m) ? '' : ' atenuado'}`} aria-pressed={visibleSel(m)} onClick={() => abrir(m.id)}>
              <span className={`circ-badge mod ${claseModulo(m)}`}>{m.numero}</span>
              <span><span className="tit">{m.titulo}</span><span className="meta">{m.nombre.join(' ')} · {OLA[m.ola]?.[0]}</span></span>
            </button>
          ))}
        </div>
      </div>

      <Cajon
        abierto={abierto && Boolean(elegido)}
        onCerrar={() => setAbierto(false)}
        rotulo={`Módulo ${elegido?.numero ?? ''} de ${ordenados.length}`}
        clave={elegido?.id ?? ''}
        anterior={antes && { etiqueta: `${antes.numero} · ${antes.titulo}`, ir: () => setSel(antes.id) }}
        siguiente={despues && { etiqueta: `${despues.numero} · ${despues.titulo}`, ir: () => setSel(despues.id) }}
      >
        {elegido && (
          <article className="circ-ficha">
            <div className="circ-ficha-cabeza">
              <div className={`circ-ficha-num mod ${claseModulo(elegido)}`} aria-hidden="true">{elegido.numero}</div>
              <div>
                <h3 className="circ-ficha-titulo">{elegido.titulo}</h3>
                <div className="circ-donde"><span>{elegido.nombre.join(' ')}</span><Etq tono={OLA[elegido.ola]?.[1]}>{OLA[elegido.ola]?.[0]}</Etq><Etq>{ia} de {elegido.cubre.length} con IA</Etq></div>
              </div>
            </div>
            <Bloque titulo="Qué cubre">
              <ul className="circ-cubre">
                {elegido.cubre.map((c) => <li key={c.texto} className={c.ia ? 'ia' : ''}>{c.texto}{c.ia && <span className="circ-marca-ia">IA</span>}</li>)}
              </ul>
            </Bloque>
            {elegido.nota && <p className="circ-nada">{elegido.nota}</p>}
            <div className="circ-tres">
              <div><h3 className="circ-h3">Lee de JD</h3><p>{elegido.lee}</p></div>
              <div><h3 className="circ-h3">Postea en JD</h3><p>{elegido.postea}</p></div>
              <div><h3 className="circ-h3">Deja atrás</h3><p>{elegido.deja_atras}</p></div>
            </div>
            <Bloque titulo="Las cifras de hoy"><Cifras cifras={elegido.cifras} /></Bloque>
            <Bloque titulo="Dónde se usa"><p>{elegido.dispositivo}</p></Bloque>
            <Bloque titulo="Destapa">
              <div className="circ-enlaces">
                {elegido.destapa.length === 0 && <span className="circ-nada">Sus trombos quedan fuera del circuito principal</span>}
                {elegido.destapa.filter((id) => porId[id]).map((id) => (
                  <Link key={id} className="circ-ir" href={`/informe/${id.startsWith('S') ? 'sistemas-datos' : 'hallazgos'}?punto=${id}#circuitos`}>
                    <span className="mini">{porId[id].numero}</span><span>{porId[id].circuito === 'flujo' ? 'Flujo' : 'Sistema'} · {porId[id].titulo}</span>
                  </Link>
                ))}
              </div>
            </Bloque>
          </article>
        )}
      </Cajon>
    </div>
  )
}
