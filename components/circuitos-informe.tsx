'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'

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

type Tramo = [modo: 'mano' | 'sistema', rotulo: string | null]
export type TextosCircuitos = {
  flujo?: { tesis: string; subtesis: string; retorno: string; codo_izq: string[]; codo_der: string[]; relojes: { cifra: string; texto: string }[] }
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
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [])
  return (
    <>
      <div ref={marco} className="circ-lienzo">{children}</div>
      {desliza && <p className="circ-desliza">Desliza de lado para ver el dibujo completo.</p>}
    </>
  )
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

function Rotulo({ x, y, nombre }: { x: number; y: number; nombre: string | string[] }) {
  const lineas = Array.isArray(nombre) ? nombre : [nombre]
  return <>{lineas.map((l, i) => <text key={l} className="circ-t-estacion" x={x} y={y + i * 15}>{l}</text>)}</>
}

function Anillo({ id, chevrones = true, lanesTop = 36, lanesBot = 506, children }: { id: string; chevrones?: boolean; lanesTop?: number; lanesBot?: number; children?: React.ReactNode }) {
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
        <g key={`t${x}`}><circle className="circ-estacion" cx={x} cy={120} r={7} /><Rotulo x={x} y={Array.isArray(EST_TOP[i]) ? 71 : 86} nombre={EST_TOP[i]} /></g>
      ))}
      {BOTX.map((x, i) => (
        <g key={`b${x}`}><circle className="circ-estacion" cx={x} cy={400} r={7} /><Rotulo x={x} y={444} nombre={EST_BOT[i]} /></g>
      ))}
    </>
  )
}

function Marcador({ p, sel, atenuado, resaltado, onElegir, r = 14 }: { p: PuntoCircuito; sel: boolean; atenuado: boolean; resaltado: boolean; onElegir: () => void; r?: number }) {
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

// ============================== Circuitos 1 y 2 ==============================
export function CircuitosDelNegocio({ puntos, modulos, textos, inicial }: { puntos: PuntoCircuito[]; modulos: ModuloIberia[]; textos: TextosCircuitos; inicial?: string }) {
  const inicialValido = puntos.find((p) => p.id === inicial)
  const [vista, setVista] = useState<'flujo' | 'sistemas'>(inicialValido?.circuito ?? 'flujo')
  const [sel, setSel] = useState<Record<string, string>>({
    flujo: inicialValido?.circuito === 'flujo' ? inicialValido.id : puntos.find((p) => p.circuito === 'flujo' && p.numero === 5)?.id ?? '',
    sistemas: inicialValido?.circuito === 'sistemas' ? inicialValido.id : puntos.find((p) => p.circuito === 'sistemas' && p.numero === 3)?.id ?? '',
  })
  const [filtro, setFiltro] = useState<Record<string, string>>({ flujo: 'todos', sistemas: 'todos' })

  const lista = puntos.filter((p) => p.circuito === vista).sort((a, b) => a.numero - b.numero)
  const f = filtro[vista]
  const coincide = (p: PuntoCircuito) => {
    if (f === 'todos') return true
    if (vista === 'flujo') return p.fase === f
    const grupos: Record<string, string[]> = { dos: ['duplicacion', 'doble_esfuerzo'], fuera: ['dato_fuera', 'punto_unico'], roto: ['puente_roto'], choque: ['choque'] }
    return (grupos[f] ?? []).includes(p.tipo ?? '')
  }
  const elegido = lista.find((p) => p.id === sel[vista]) ?? lista[0]
  const elegir = (id: string) => setSel((s) => ({ ...s, [vista]: id }))
  const cambiarFiltro = (v: string) => {
    setFiltro((s) => ({ ...s, [vista]: v }))
    const actual = lista.find((p) => p.id === sel[vista])
    const nuevoCoincide = (p: PuntoCircuito) => v === 'todos' || (vista === 'flujo' ? p.fase === v : ({ dos: ['duplicacion', 'doble_esfuerzo'], fuera: ['dato_fuera', 'punto_unico'], roto: ['puente_roto'], choque: ['choque'] }[v] ?? []).includes(p.tipo ?? ''))
    if (actual && !nuevoCoincide(actual)) { const primero = lista.find(nuevoCoincide); if (primero) elegir(primero.id) }
  }
  const cuenta = (pred: (p: PuntoCircuito) => boolean) => lista.filter(pred).length
  const opciones: [string, string, string?][] = vista === 'flujo'
    ? [['todos', `Los ${lista.length}`], ['2', `Fase 2 propuesta · ${cuenta((p) => p.fase === '2')}`, 'dorado'], ['3', `Fase 3 · planta · ${cuenta((p) => p.fase === '3')}`], ['sin', `Sin fase todavía · ${cuenta((p) => p.fase === 'sin')}`]]
    : [['todos', `Los ${lista.length}`], ['dos', `Se escribe más de una vez · ${cuenta((p) => ['duplicacion', 'doble_esfuerzo'].includes(p.tipo ?? ''))}`], ['fuera', `Fuera o en una persona · ${cuenta((p) => ['dato_fuera', 'punto_unico'].includes(p.tipo ?? ''))}`], ['roto', `Puente roto · ${cuenta((p) => p.tipo === 'puente_roto')}`], ['choque', `Chocan · ${cuenta((p) => p.tipo === 'choque')}`]]

  const tf = textos.flujo
  const ts = textos.sistemas
  const atendidoPor = (id: string) => modulos.filter((m) => m.destapa.includes(id))

  return (
    <div className="circ" id="circuitos">
      <div className="circ-controles">
        <div className="circ-pestanas" role="tablist" aria-label="Circuito">
          <button type="button" role="tab" aria-selected={vista === 'flujo'} className="circ-pestana" onClick={() => setVista('flujo')}>El flujo</button>
          <button type="button" role="tab" aria-selected={vista === 'sistemas'} className="circ-pestana" onClick={() => setVista('sistemas')}>Los sistemas</button>
        </div>
        <Filtros opciones={opciones} valor={f} onCambio={cambiarFiltro} />
      </div>

      <figure className="circ-figura">
        <Lienzo>
          {vista === 'flujo' ? (
            <svg viewBox="0 0 1080 520" role="group" aria-label="El circuito del negocio con los puntos donde el flujo espera">
              <Anillo id="flujo">
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
                <Marcador key={p.id} p={p} sel={p.id === elegido?.id} atenuado={!coincide(p)} resaltado={f === '2' && p.fase === '2'} onElegir={() => elegir(p.id)} />
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
                  <Marcador p={p} r={p.centro ? 12 : 14} sel={p.id === elegido?.id} atenuado={!coincide(p)} resaltado={false} onElegir={() => elegir(p.id)} />
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
        <div className="circ-lista" role="group" aria-label={vista === 'flujo' ? 'Los puntos donde el flujo espera' : 'Los trombos de sistema'}>
          {lista.map((p) => (
            <button key={p.id} type="button" className={`circ-item${coincide(p) ? '' : ' atenuado'}`} aria-pressed={p.id === elegido?.id} onClick={() => elegir(p.id)}>
              <span className="circ-badge">{p.numero}</span>
              <span><span className="tit">{p.titulo}</span><span className="meta">{vista === 'flujo' ? `${(p.donde ?? '').split(' · ')[0]} · ${FASE[p.fase ?? 'sin']?.[0] ?? ''}` : TIPO[p.tipo ?? ''] ?? ''}</span></span>
            </button>
          ))}
        </div>
        {elegido && (
          <article className="circ-ficha" aria-live="polite">
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
      </div>

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
  const coincide = (m: ModuloIberia) => filtro === 'todos' || m.ola === filtro
  const elegido = ordenados.find((m) => m.id === sel) ?? ordenados[0]
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
              return <path key={m.id} className={`circ-haz${m.id === elegido?.id ? ' on' : ''}`} d={`M${xa},${ya} L${Number(m.pos_x)},${yModulo(Number(m.pos_x)) - 15}`} />
            })}
            {ordenados.map((m) => {
              const x = Number(m.pos_x), y = yModulo(x)
              return (
                <g
                  key={m.id}
                  className={`circ-modulo ${claseModulo(m)}${m.id === elegido?.id ? ' sel' : ''}${coincide(m) ? '' : ' atenuado'}`}
                  tabIndex={0} role="button" aria-label={`Módulo ${m.numero}, ${m.nombre.join(' ')}: ${m.titulo}`}
                  onClick={() => setSel(m.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSel(m.id) } }}
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
        <div className="circ-lista" role="group" aria-label="Los módulos del sistema Iberia">
          {ordenados.map((m) => (
            <button key={m.id} type="button" className={`circ-item mod${coincide(m) ? '' : ' atenuado'}`} aria-pressed={m.id === elegido?.id} onClick={() => setSel(m.id)}>
              <span className={`circ-badge mod ${claseModulo(m)}`}>{m.numero}</span>
              <span><span className="tit">{m.titulo}</span><span className="meta">{m.nombre.join(' ')} · {OLA[m.ola]?.[0]}</span></span>
            </button>
          ))}
        </div>
        {elegido && (
          <article className="circ-ficha" aria-live="polite">
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
                  <Link key={id} className="circ-ir" href={`/informe/circuitos?punto=${id}#circuitos`}>
                    <span className="mini">{porId[id].numero}</span><span>{porId[id].circuito === 'flujo' ? 'Flujo' : 'Sistema'} · {porId[id].titulo}</span>
                  </Link>
                ))}
              </div>
            </Bloque>
          </article>
        )}
      </div>
    </div>
  )
}
