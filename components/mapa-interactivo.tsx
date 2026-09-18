'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/**
 * El mapa de procesos, como lienzo navegable.
 *
 * Es la forma canónica de un mapa de procesos y no un organigrama: los
 * **estratégicos arriba** orientando el rumbo, la **cadena de valor en el
 * medio** —el orden en que el producto atraviesa la empresa— y los **de
 * soporte abajo**, sosteniendo a los otros dos.
 *
 * ⚠️ **Es un lienzo, no una página.** Se arrastra para moverlo, se acerca y se
 * aleja, y al pulsar una caja el lienzo **se centra en ella** y abre su panel.
 * Veinte macroprocesos no caben en una pantalla a un tamaño legible: o se
 * encogen hasta no leerse, o se navega. Esto segundo.
 *
 * ⚠️ **Las flechas dibujan la secuencia de la cadena, y nada más.** No hay dato
 * estructurado de los cruces entre áreas —eso vive en la prosa del capítulo de
 * trabas—, así que una línea entre dos cajas cualesquiera sería dibujar una
 * relación que nadie validó. La leyenda lo dice en voz alta.
 *
 * ⚠️ **No hay ancla por proceso en el informe.** Las fichas son por
 * macroproceso y los procesos viven dentro, como filas de una tabla — y las
 * tablas no producen anclas. Por eso el enlace va a la ficha del macroproceso
 * **más `?proceso=`**, que la página de fichas usa para resaltar la fila.
 */

export type ProcesoDelMapa = {
  nombre: string
  estado: string
  area: string | null
  dueno_corregido: boolean
}

export type MacroDelMapa = {
  nivel: string
  numero: number
  nombre: string
  nuevo: boolean
  ancla: string
  procesos: ProcesoDelMapa[]
}

const NO_SE_DIBUJA = new Set(['NO SE EJECUTA', 'SIN EVIDENCIA'])

/**
 * Las tres familias, con su tinte.
 *
 * ⚠️ **El reparto es el mismo que el de las fichas** —rojo de marca para lo
 * estratégico, oro para la cadena, carbón para soporte—. Un macroproceso tiene
 * que ser del mismo color en los dos sitios o el lector no los relaciona.
 */
const FAMILIAS = [
  {
    nivel: 'Estratégico',
    rotulo: 'Procesos estratégicos · orientan el rumbo',
    clase: 'n-estrategico',
    corto: 'Estratégicos',
  },
  {
    nivel: 'Operativo',
    rotulo: 'Cadena de valor · producen y entregan',
    clase: 'n-operativo',
    corto: 'Cadena de valor',
  },
  {
    nivel: 'Soporte',
    rotulo: 'Procesos de soporte · sostienen',
    clase: 'n-soporte',
    corto: 'Soporte',
  },
] as const

type Nivel = (typeof FAMILIAS)[number]['nivel']

// --- La geometría del lienzo -------------------------------------------------
//
// Todo se calcula en coordenadas del lienzo, y la vista solo aplica un
// `translate` y un `scale`. Así el arrastre, el zoom y el centrado son la misma
// operación sobre tres números, y las flechas no hay que recalcularlas nunca.
const ANCHO = 236
const ALTO = 96
const PASO = 300
const MARGEN = 56
const FILA: Record<Nivel, number> = { Estratégico: 92, Operativo: 396, Soporte: 700 }

type Puesto = { macro: MacroDelMapa; x: number; y: number; clase: string }

function repartir(macros: MacroDelMapa[]) {
  const porNivel = new Map<string, MacroDelMapa[]>()
  for (const f of FAMILIAS) porNivel.set(f.nivel, [])
  for (const m of macros) porNivel.get(m.nivel)?.push(m)
  for (const lista of porNivel.values()) lista.sort((a, b) => a.numero - b.numero)

  // El ancho lo fija la cadena, que es la fila más larga y la única con paso
  // fijo —porque es una secuencia—. Las otras dos se reparten sobre ese mismo
  // ancho, así el dibujo queda alineado por los bordes y se lee como un bloque.
  const cadena = porNivel.get('Operativo') ?? []
  const util = Math.max(1, cadena.length) * PASO - (PASO - ANCHO)
  const ancho = MARGEN * 2 + util

  const puestos: Puesto[] = []
  for (const f of FAMILIAS) {
    const lista = porNivel.get(f.nivel) ?? []
    lista.forEach((macro, i) => {
      const x =
        f.nivel === 'Operativo'
          ? MARGEN + i * PASO
          : MARGEN +
            (lista.length === 1 ? (util - ANCHO) / 2 : (i * (util - ANCHO)) / (lista.length - 1))
      puestos.push({ macro, x, y: FILA[f.nivel], clase: f.clase })
    })
  }

  return { puestos, ancho, alto: FILA.Soporte + ALTO + MARGEN, cadena }
}

/**
 * Los dos rieles donde acometen las bandas de arriba y de abajo.
 *
 * Van a **44 px de la cadena**, ni pegados —se leerían como parte de la caja—
 * ni a media altura, que es donde dejarían de apuntar a nada.
 */
const RIEL_ARRIBA = FILA.Operativo - 44
const RIEL_ABAJO = FILA.Operativo + ALTO + 44

/** La curva de la troncal entre dos eslabones: sale y entra en horizontal. */
function curva(x1: number, y1: number, x2: number, y2: number) {
  const d = Math.max(28, (x2 - x1) / 2)
  return `M ${x1} ${y1} C ${x1 + d} ${y1}, ${x2 - d} ${y2}, ${x2} ${y2}`
}

export function MapaInteractivo({ macros }: { macros: MacroDelMapa[] }) {
  const { puestos, ancho, alto, cadena } = useMemo(() => repartir(macros), [macros])

  const marco = useRef<HTMLDivElement>(null)
  const [vista, setVista] = useState({ x: 0, y: 0, k: 1 })
  const [suave, setSuave] = useState(false)
  const [filtro, setFiltro] = useState<string>('todo')
  const [elegido, setElegido] = useState<string | null>(null)
  // El desplazamiento de la leyenda respecto de su sitio, que es abajo a la
  // izquierda: ahí tapa lienzo vacío, y arriba tapaba la primera fila de cajas.
  const [leyenda, setLeyenda] = useState({ x: 0, y: 0 })
  // Plegable porque flota sobre el dibujo: se puede arrastrar, pero a veces lo
  // que hace falta es quitarla de en medio sin buscarle sitio.
  const [leyendaAbierta, setLeyendaAbierta] = useState(true)

  /**
   * Pantalla completa.
   *
   * ⚠️ **No usa la API de `requestFullscreen`.** El mapa vive dentro de un
   * documento con barra lateral, y el modo nativo del navegador saca el
   * elemento de la página: se pierden los estilos heredados en algunos motores,
   * el botón de salir es el del navegador y no el nuestro, y en iOS no existe
   * para elementos que no sean vídeo. Un panel fijo sobre la página da lo mismo
   * —todo el ancho y todo el alto— y se comporta igual en los cuatro motores.
   */
  const [ampliado, setAmpliado] = useState(false)

  const clave = (m: MacroDelMapa) => `${m.nivel}-${m.numero}`
  const activo = puestos.find((p) => clave(p.macro) === elegido) ?? null
  const numeroDe = (nivel: string) => FAMILIAS.findIndex((f) => f.nivel === nivel) + 1

  /** Encaja el lienzo entero en el marco. Es el estado inicial y el botón de ajustar. */
  const ajustar = useCallback(() => {
    const caja = marco.current?.getBoundingClientRect()
    if (!caja || !caja.width) return
    const k = Math.min(caja.width / (ancho + 48), caja.height / (alto + 48), 1)
    setSuave(true)
    setVista({ k, x: (caja.width - ancho * k) / 2, y: (caja.height - alto * k) / 2 })
  }, [ancho, alto])

  /**
   * La vista de entrada: **legible, no completa**.
   *
   * ⚠️ Encajar los veinte de golpe deja las cajas a un tercio de tamaño y no se
   * lee ni el título — o sea, un mapa que no se puede leer. Se abre por el
   * principio de la cadena, a escala de lectura, y quien quiera la vista de
   * pájaro tiene el botón de ver todo.
   */
  const asomar = useCallback(() => {
    const caja = marco.current?.getBoundingClientRect()
    if (!caja || !caja.width) return
    const k = 0.82
    setSuave(false)
    // ⚠️ Arranca a la derecha de la leyenda, no en el borde. La leyenda flota
    // abajo a la izquierda y con `x: 24` el primer eslabón de la cadena nacía
    // justo debajo — el mapa se abría tapándose su propia entrada.
    setVista({ k, x: 300, y: (caja.height - alto * k) / 2 })
  }, [alto])

  useEffect(() => {
    asomar()
  }, [asomar])

  // Al entrar o salir de la vista ampliada el marco cambia de tamaño, y el
  // lienzo hay que recolocarlo: si no, el dibujo se queda donde estaba y aparece
  // fuera de la vista. Se espera un fotograma para medir el marco ya crecido.
  useEffect(() => {
    const id = requestAnimationFrame(() => ajustar())
    return () => cancelAnimationFrame(id)
  }, [ampliado, ajustar])

  // Escapar cierra, que es lo que espera cualquiera en una vista a pantalla
  // completa. Solo se escucha mientras está abierta.
  useEffect(() => {
    if (!ampliado) return
    const alPulsar = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setAmpliado(false)
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [ampliado])

  /** Lleva el lienzo hasta una caja y la deja en el centro del marco. */
  const centrar = useCallback((p: Puesto) => {
    const caja = marco.current?.getBoundingClientRect()
    if (!caja) return
    setSuave(true)
    setVista((v) => {
      // Al centrar se acerca si venía muy lejos, pero no se aleja nunca: quien
      // ya estaba mirando de cerca no quiere que le cambien la escala.
      const k = Math.max(v.k, 0.8)
      return {
        k,
        x: caja.width / 2 - (p.x + ANCHO / 2) * k,
        y: caja.height / 2 - (p.y + ALTO / 2) * k,
      }
    })
  }, [])

  // ⚠️ **El centrado va en un efecto, no en el `onClick`.** El panel de la caja
  // elegida se abre al lado y **le quita ancho al lienzo**: calculando el centro
  // en el manejador se usa el ancho de antes, y la caja quedaba desviada casi
  // doscientos píxeles. El efecto corre con la maqueta ya rehecha.
  useEffect(() => {
    if (!elegido) return
    const p = puestos.find((x) => clave(x.macro) === elegido)
    if (p) centrar(p)
    // `puestos` no cambia mientras no cambien los datos, y `centrar` es estable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido])

  // --- Arrastre del lienzo ---------------------------------------------------
  const tiron = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null)

  const empezarTiron = (ev: React.PointerEvent) => {
    // Sobre una caja o sobre un control el gesto es «abrir» o «pulsar», no
    // «mover»: si el lienzo se llevara esos, no se podría tocar nada.
    if (ev.button !== 0) return
    if ((ev.target as HTMLElement).closest('.nodo, .leyenda, .mapa-controles, .mapa-pestanas'))
      return
    setSuave(false)
    tiron.current = { x: ev.clientX, y: ev.clientY, vx: vista.x, vy: vista.y }
    ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
  }

  const seguirTiron = (ev: React.PointerEvent) => {
    const t = tiron.current
    if (!t) return
    setVista((v) => ({ ...v, x: t.vx + (ev.clientX - t.x), y: t.vy + (ev.clientY - t.y) }))
  }

  /** Acercar y alejar desde el centro del marco, para que no se escape el dibujo. */
  const escalar = (factor: number) => {
    const caja = marco.current?.getBoundingClientRect()
    if (!caja) return
    setSuave(true)
    setVista((v) => {
      const k = Math.min(1.8, Math.max(0.2, v.k * factor))
      const cx = caja.width / 2
      const cy = caja.height / 2
      return { k, x: cx - ((cx - v.x) / v.k) * k, y: cy - ((cy - v.y) / v.k) * k }
    })
  }

  // ⚠️ La rueda **no** hace zoom por su cuenta: el mapa vive dentro de un
  // documento largo, y robarle la rueda a la página deja al lector atrapado
  // dentro del recuadro. Con Ctrl o ⌘ sí, que es el gesto que ya espera quien
  // acerca un plano.
  const conRueda = (ev: React.WheelEvent) => {
    if (!ev.ctrlKey && !ev.metaKey) return
    ev.preventDefault()
    escalar(ev.deltaY < 0 ? 1.12 : 0.89)
  }

  // --- Arrastre de la leyenda ------------------------------------------------
  const asa = useRef<{ x: number; y: number; lx: number; ly: number } | null>(null)

  const atenuado = (nivel: string) => filtro !== 'todo' && filtro !== nivel

  return (
    <div className={`mapa-marco${ampliado ? ' ampliado' : ''}`}>
      <div
        ref={marco}
        className="mapa-lienzo"
        onPointerDown={empezarTiron}
        onPointerMove={seguirTiron}
        onPointerUp={() => (tiron.current = null)}
        onPointerCancel={() => (tiron.current = null)}
        onWheel={conRueda}
      >
        <div
          className={`mapa-mundo${suave ? ' suave' : ''}`}
          style={{
            width: ancho,
            height: alto,
            transform: `translate(${vista.x}px, ${vista.y}px) scale(${vista.k})`,
          }}
        >
          {/* Las flechas van debajo de las cajas, en su propia capa. */}
          <svg className="mapa-hilos" width={ancho} height={alto} aria-hidden>
            <defs>
              <marker
                id="punta"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-oro-600)" />
              </marker>
              <marker
                id="punta-estrategico"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-acento-400)" />
              </marker>
              <marker
                id="punta-soporte"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-marca-400)" />
              </marker>
            </defs>
            {/* ⚠️ **Las bandas de arriba y de abajo acometen a la CADENA, no a una
                caja.** Emparejar un estratégico con un eslabón concreto sería
                inventar una relación que nadie validó; lo que sí está dicho
                —y es lo que el dibujo tenía sin dibujar— es que los
                estratégicos orientan la cadena entera y los de soporte la
                sostienen. De ahí el riel: la línea baja hasta él, y es el riel
                el que abarca la banda.

                Y **entre sí no llevan flecha**, a propósito: los estratégicos
                no son una secuencia. Una flecha de 1.1 a 1.2 afirmaría un orden
                que no existe. */}
            {(['Estratégico', 'Soporte'] as const).map((nivel) => {
              const arriba = nivel === 'Estratégico'
              const y = arriba ? RIEL_ARRIBA : RIEL_ABAJO
              const suyos = puestos.filter((p) => p.macro.nivel === nivel)
              if (!suyos.length) return null
              const clase = arriba ? 'a-estrategico' : 'a-soporte'
              const punta = arriba ? 'url(#punta-estrategico)' : 'url(#punta-soporte)'
              const apagado = atenuado(nivel) ? ' apagado' : ''

              return (
                <g key={`riel-${nivel}`}>
                  <line
                    className={`mapa-riel ${clase}${apagado}`}
                    x1={MARGEN}
                    y1={y}
                    x2={ancho - MARGEN}
                    y2={y}
                  />
                  {suyos.map((p) => (
                    <line
                      key={`${clave(p.macro)}-baja`}
                      className={`mapa-baja ${clase}${apagado}`}
                      x1={p.x + ANCHO / 2}
                      y1={arriba ? p.y + ALTO : p.y}
                      x2={p.x + ANCHO / 2}
                      y2={y}
                      markerEnd={punta}
                    />
                  ))}
                </g>
              )
            })}

            {cadena.slice(0, -1).map((m, i) => {
              const a = puestos.find((p) => p.macro === m)
              const b = puestos.find((p) => p.macro === cadena[i + 1])
              if (!a || !b) return null
              return (
                <path
                  key={`${clave(m)}-hilo`}
                  className={`mapa-hilo${atenuado('Operativo') ? ' apagado' : ''}`}
                  d={curva(a.x + ANCHO, a.y + ALTO / 2, b.x, b.y + ALTO / 2)}
                  markerEnd="url(#punta)"
                />
              )
            })}
          </svg>

          {/* El rótulo de cada zona, tenue: nombra la banda sin llegar a pintarla. */}
          {FAMILIAS.map((f) => (
            <span
              key={f.nivel}
              className={`mapa-zona${atenuado(f.nivel) ? ' apagada' : ''}`}
              style={{ left: MARGEN, top: FILA[f.nivel] - 36 }}
            >
              {f.rotulo}
            </span>
          ))}

          {puestos.map((p) => {
            const m = p.macro
            const k = clave(m)
            const vivos = m.procesos.filter((x) => !NO_SE_DIBUJA.has(x.estado))
            const fuera = m.procesos.length - vivos.length

            return (
              <button
                key={k}
                type="button"
                className={`nodo ${p.clase}${elegido === k ? ' elegido' : ''}${atenuado(m.nivel) ? ' apagado' : ''}`}
                style={{ left: p.x, top: p.y, width: ANCHO, height: ALTO }}
                onClick={() => setElegido(k)}
              >
                <span className="nodo-icono">
                  {numeroDe(m.nivel)}.{m.numero}
                </span>
                <span className="nodo-cuerpo">
                  <span className="nodo-titulo">{m.nombre}</span>
                  <span className="nodo-cuenta">
                    {vivos.length} {vivos.length === 1 ? 'proceso' : 'procesos'}
                  </span>
                  <span className="nodo-marcas">
                    {m.nuevo && <span className="marca-nuevo">nuevo</span>}
                    {fuera > 0 && <span className="marca-aviso">⚠ {fuera}</span>}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* --- La leyenda, que se arrastra ------------------------------------ */}
        <aside
          className={`leyenda${leyendaAbierta ? '' : ' plegada'}`}
          style={{ left: 20 + leyenda.x, bottom: 68 - leyenda.y }}
        >
          <header
            className="leyenda-asa"
            onPointerDown={(ev) => {
              ev.stopPropagation()
              asa.current = { x: ev.clientX, y: ev.clientY, lx: leyenda.x, ly: leyenda.y }
              ;(ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId)
            }}
            onPointerMove={(ev) => {
              const l = asa.current
              if (!l) return
              setLeyenda({ x: l.lx + (ev.clientX - l.x), y: l.ly + (ev.clientY - l.y) })
            }}
            onPointerUp={() => (asa.current = null)}
          >
            <strong>Leyenda</strong>
            {leyendaAbierta && <span>· arrastra para mover</span>}
            <button
              type="button"
              className="leyenda-plegar"
              onPointerDown={(ev) => ev.stopPropagation()}
              onClick={() => setLeyendaAbierta((x) => !x)}
              aria-label={leyendaAbierta ? 'Plegar la leyenda' : 'Abrir la leyenda'}
            >
              {leyendaAbierta ? '−' : '+'}
            </button>
          </header>
          <ul>
            {FAMILIAS.map((f) => (
              <li key={f.nivel}>
                <i className={`ficha-color ${f.clase}`} />
                {f.corto} — {macros.filter((m) => m.nivel === f.nivel).length}
              </li>
            ))}
            <li>
              <i className="ficha-linea" />
              Secuencia de la cadena de valor
            </li>
            <li>
              <i className="ficha-punteada" />
              Orientan la cadena · la sostienen
            </li>
            <li>
              <span className="marca-nuevo">nuevo</span>
              Macroproceso que el inventario no recogía
            </li>
            <li>
              <span className="marca-aviso">⚠ n</span>
              Procesos documentados que no se ejecutan
            </li>
          </ul>
          <p className="leyenda-nota">
            La línea llena es la secuencia de la cadena. El punteado va de cada banda a la
            cadena entera, no a una caja: emparejar un estratégico con un eslabón sería inventar
            una relación. Los cruces documentados entre áreas están en{' '}
            <Link href="/informe/trabas">Dónde se traba el trabajo</Link>.
          </p>
        </aside>

        {/* --- Acercar, alejar, ajustar --------------------------------------- */}
        <div className="mapa-controles">
          <button type="button" onClick={() => escalar(1.2)} aria-label="Acercar">
            +
          </button>
          <button type="button" onClick={() => escalar(0.83)} aria-label="Alejar">
            −
          </button>
          <button type="button" onClick={ajustar} aria-label="Ver todo el mapa" title="Ver todo">
            ⤢
          </button>
          <button
            type="button"
            onClick={() => setAmpliado((x) => !x)}
            aria-label={ampliado ? 'Salir de pantalla completa' : 'Ver a pantalla completa'}
            title={ampliado ? 'Salir · Esc' : 'Pantalla completa'}
          >
            {ampliado ? '✕' : '⛶'}
          </button>
        </div>

        {/* --- Las pestañas de familia ---------------------------------------- */}
        <div className="mapa-pestanas">
          <button
            type="button"
            className={filtro === 'todo' ? 'activa' : ''}
            onClick={() => setFiltro('todo')}
          >
            Vista general
          </button>
          {FAMILIAS.map((f) => (
            <button
              key={f.nivel}
              type="button"
              className={filtro === f.nivel ? 'activa' : ''}
              onClick={() => setFiltro(f.nivel)}
            >
              {f.corto}
            </button>
          ))}
        </div>

        <p className="mapa-pista">Arrastra para moverte · Ctrl + rueda para acercar</p>
      </div>

      {/* --- El panel de la caja elegida --------------------------------------
          Va fuera del lienzo y no dentro de la caja: en un lienzo que se
          arrastra, un desplegable dentro del nodo se sale de la vista en cuanto
          alguien mueve el mapa. */}
      {activo && (
        <aside className={`mapa-panel ${activo.clase}`}>
          <header>
            <span className="nodo-icono">
              {numeroDe(activo.macro.nivel)}.{activo.macro.numero}
            </span>
            <div className="mapa-panel-titulo">
              <h3>{activo.macro.nombre}</h3>
              <p>{activo.macro.nivel}</p>
            </div>
            <button type="button" onClick={() => setElegido(null)} aria-label="Cerrar">
              ×
            </button>
          </header>

          <ol className="mapa-panel-procesos">
            {activo.macro.procesos
              .filter((p) => !NO_SE_DIBUJA.has(p.estado))
              .map((p, i) => (
                <li key={`${p.nombre}-${i}`}>
                  <Link
                    href={`/informe/fichas-procesos?proceso=${encodeURIComponent(p.nombre)}#${activo.macro.ancla}`}
                  >
                    <span className="p-numero">
                      {numeroDe(activo.macro.nivel)}.{activo.macro.numero}.{i + 1}
                    </span>
                    <span className="p-nombre">
                      {p.nombre}
                      {p.estado === 'NUEVO' && <em className="marca-nuevo">nuevo</em>}
                      {p.dueno_corregido && <em className="marca-aviso">dueño corregido</em>}
                    </span>
                    {p.area && <span className="p-area">{p.area}</span>}
                  </Link>
                </li>
              ))}
          </ol>

          <footer>
            <Link href={`/informe/fichas-procesos#${activo.macro.ancla}`}>
              Ver la ficha completa →
            </Link>
          </footer>
        </aside>
      )}
    </div>
  )
}
