'use client'

import '@xyflow/react/dist/base.css'
import './lienzo.css'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as EventoTeclado,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  applyNodeChanges,
  getNodesBounds,
  useReactFlow,
  type NodeChange,
  type OnNodeDrag,
} from '@xyflow/react'
import { cn } from '@/lib/utils'
import { abrirFicha } from './ficha'
import { ALTO, ANCHO, disponer, type Disposicion, type Punto } from './disposicion'
import { Arista, Caja, ContextoLienzo, MarcaChip, type AristaOrto, type ContextoCaja, type NodoCaja } from './piezas'
import { COLOR_TONO, ETIQUETA_DIFF, TEXTO_TONO, type AccionMenu, type Capa, type ContextoArbol, type NodoLienzo, type PropsLienzo } from './tipos'

/**
 * El lienzo: organigrama y mapa de procesos en un solo componente.
 *
 * - Se mueve arrastrando el fondo, con la rueda o el pellizco, y con ＋ y −.
 * - Un clic en una caja la despliega o la pliega (con animación) y la elige;
 *   «Ficha ›» o el doble clic abren su ficha.
 * - Las hojas de un mismo padre van apiladas (`disposicion.ts`), así que el
 *   dibujo no revienta a lo ancho.
 * - Buscar abre el camino hasta lo encontrado y lo centra; las migas suben.
 * - Capas de color con leyenda: el color siempre va con icono y etiqueta.
 * - En modo escenario, arrastrar una caja sobre otra le cambia la dependencia,
 *   y el menú «⋯» agrega, renombra o cierra. Lo que cambia sale en morado.
 * - Teclado: Tab recorre las cajas; Enter despliega; Mayús+Enter o F abre la
 *   ficha; las flechas suben, bajan y van de hermano en hermano; M abre el menú.
 * - En el teléfono arranca en lista, con migas, y se puede pasar al lienzo.
 */

const CONSULTA_MOVIL = '(max-width: 767px)'
const tiposNodo = { caja: Caja }
const tiposArista = { orto: Arista }

const ARIA_LIENZO = {
  'node.a11yDescription.default': 'Enter despliega o pliega. Mayúsculas y Enter abre la ficha. Las flechas recorren el árbol.',
  'node.a11yDescription.keyboardDisabled': 'Enter despliega o pliega. Mayúsculas y Enter abre la ficha. Las flechas recorren el árbol.',
  'node.a11yDescription.ariaLiveMessage': ({ direction }: { direction: string; x: number; y: number }) => `Caja movida hacia ${direction}.`,
  'edge.a11yDescription.default': 'Línea de dependencia.',
  'controls.ariaLabel': 'Controles del lienzo',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Ajustar a la vista',
  'controls.interactive.ariaLabel': 'Activar o desactivar la interacción',
  'minimap.ariaLabel': 'Minimapa',
  'handle.ariaLabel': 'Punto de unión',
}

// -----------------------------------------------------------------------------
// El árbol
// -----------------------------------------------------------------------------

type Arbol = ContextoArbol & {
  porId: Map<string, NodoLienzo>
  hijos: Map<string, string[]>
  raices: string[]
  ancestros: (id: string) => string[]
  planos: Map<string, string>
}

export const plano = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

function armarArbol(nodos: NodoLienzo[]): Arbol {
  const porId = new Map(nodos.map((n) => [n.id, n]))
  const hijos = new Map<string, string[]>()
  const raices: string[] = []
  for (const n of nodos) {
    if (n.padre && porId.has(n.padre) && n.padre !== n.id) {
      const l = hijos.get(n.padre)
      if (l) l.push(n.id)
      else hijos.set(n.padre, [n.id])
    } else raices.push(n.id)
  }
  const cmp = (a: string, b: string) => {
    const A = porId.get(a)!
    const B = porId.get(b)!
    return (A.orden ?? 0) - (B.orden ?? 0) || A.titulo.localeCompare(B.titulo, 'es')
  }
  for (const l of hijos.values()) l.sort(cmp)
  raices.sort(cmp)
  const padreDe = (id: string) => {
    const p = porId.get(id)?.padre
    return p && porId.has(p) && p !== id ? p : null
  }
  const ancestros = (id: string) => {
    const r: string[] = []
    let p = padreDe(id)
    while (p && r.length < 60) {
      r.push(p)
      p = padreDe(p)
    }
    return r
  }
  const planos = new Map(nodos.map((n) => [n.id, plano(`${n.titulo} ${n.subtitulo ?? ''} ${n.busqueda ?? ''}`)]))
  return {
    porId,
    hijos,
    raices,
    padreDe,
    ancestros,
    planos,
    nodo: (id) => porId.get(id),
    esDescendiente: (id, anc) => ancestros(id).includes(anc),
  }
}

function suscribirMovil(avisar: () => void) {
  const m = window.matchMedia(CONSULTA_MOVIL)
  m.addEventListener('change', avisar)
  return () => m.removeEventListener('change', avisar)
}

function leerMemoria(clave: string): Set<string> | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.sessionStorage.getItem(`lienzo:${clave}`)
    return v ? new Set(JSON.parse(v) as string[]) : null
  } catch {
    return null
  }
}

/**
 * «PDF del subárbol»: manda al servidor solo ids —la caja y lo desplegado— y la
 * fecha y el escenario de la dirección; el servidor vuelve a leer la rama con la
 * RLS de quien la pide. Se abre en otra pestaña.
 */
function pedirPdf(tipo: 'organizacion' | 'procesos', raiz: string | null, abiertos: Set<string> | null) {
  const sp = new URLSearchParams(window.location.search)
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = '/sistema/pdf/subarbol'
  form.target = '_blank'
  const campos: Record<string, string> = { tipo, raiz: raiz ?? '', abiertos: abiertos ? [...abiertos].join(',') : '', al: sp.get('al') ?? '', esc: sp.get('esc') ?? '' }
  for (const [k, v] of Object.entries(campos)) {
    const i = document.createElement('input')
    i.type = 'hidden'
    i.name = k
    i.value = v
    form.appendChild(i)
  }
  document.body.appendChild(form)
  form.submit()
  form.remove()
}

function etiquetaAria(n: NodoLienzo, nHijos: number, abierto: boolean, capa: Capa | null): string {
  const partes = [n.titulo]
  if (n.subtitulo) partes.push(n.subtitulo)
  const m = capa?.marca(n)
  if (m) partes.push(m.corta ? `${m.etiqueta}: ${m.corta}` : m.etiqueta)
  if (n.diff) partes.push(`escenario: ${ETIQUETA_DIFF[n.diff]}${n.diffTexto ? `, ${n.diffTexto}` : ''}`)
  if (nHijos) partes.push(`${nHijos} ${nHijos === 1 ? 'dependencia' : 'dependencias'}, ${abierto ? 'desplegado' : 'plegado'}`)
  return partes.join('. ')
}

type Aviso = { texto: string; error?: boolean; n: number }
type Pedido = { id: string; n: number }

type Compartido = {
  p: PropsLienzo
  arbol: Arbol
  abiertos: Set<string>
  abrir: (ids: string[]) => void
  alternar: (id: string) => void
  fijarAbiertos: (s: Set<string>) => void
  sel: string | null
  setSel: (id: string | null) => void
  hit: string | null
  capa: Capa | null
  setCapa: (clave: string) => void
  enfocar: (id: string) => void
  pedido: Pedido | null
  verFicha: (n: NodoLienzo) => void
  acciones: (n: NodoLienzo) => AccionMenu[]
  menu: string | null
  setMenu: (id: string | null) => void
  avisar: (texto: string, error?: boolean) => void
  soltar: (origen: string, destino: string) => Promise<void>
  validar: (origen: string, destino: string) => string | null
  setModo: (m: 'lienzo' | 'lista') => void
}

// -----------------------------------------------------------------------------
// La raíz: estado compartido entre el lienzo y la lista
// -----------------------------------------------------------------------------

export function Lienzo(p: PropsLienzo) {
  const router = useRouter()
  const movil = useSyncExternalStore(suscribirMovil, () => window.matchMedia(CONSULTA_MOVIL).matches, () => null)
  const [modoElegido, setModo] = useState<'lienzo' | 'lista' | null>(null)
  const modo = modoElegido ?? (movil == null ? null : movil ? 'lista' : 'lienzo')

  // Mientras el servidor confirma un arrastre, la caja ya se dibuja en su sitio nuevo.
  const [movidos, setMovidos] = useState<Map<string, string>>(() => new Map())
  const [base, setBase] = useState(p.nodos)
  if (base !== p.nodos) {
    setBase(p.nodos)
    setMovidos(new Map())
  }
  const nodos = useMemo(
    () => (movidos.size ? p.nodos.map((n) => (movidos.has(n.id) ? { ...n, padre: movidos.get(n.id)!, diff: n.diff ?? 'movido' } : n)) : p.nodos),
    [p.nodos, movidos],
  )
  const arbol = useMemo(() => armarArbol(nodos), [nodos])

  const [abiertos, setAbiertos] = useState<Set<string>>(() => leerMemoria(p.claveMemoria) ?? new Set(p.abiertosIniciales))
  useEffect(() => {
    try {
      window.sessionStorage.setItem(`lienzo:${p.claveMemoria}`, JSON.stringify([...abiertos]))
    } catch {
      /* sin almacenamiento: no pasa nada */
    }
  }, [abiertos, p.claveMemoria])

  const [sel, setSel] = useState<string | null>(null)
  const [hit, setHit] = useState<string | null>(null)
  const [capaClave, setCapa] = useState(p.capas[0]?.clave ?? '')
  const capa = p.capas.find((c) => c.clave === capaClave) ?? p.capas[0] ?? null
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  const avisar = useCallback((texto: string, error = false) => {
    setAviso((a) => ({ texto, error, n: (a?.n ?? 0) + 1 }))
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setAviso(null), error ? 6000 : 3500)
  }, [])

  const abrir = useCallback((ids: string[]) => {
    setAbiertos((s) => {
      if (ids.every((i) => s.has(i))) return s
      const t = new Set(s)
      ids.forEach((i) => t.add(i))
      return t
    })
  }, [])

  const alternar = useCallback(
    (id: string) => {
      if (!(arbol.hijos.get(id)?.length ?? 0)) return
      setAbiertos((s) => {
        const t = new Set(s)
        if (t.has(id)) t.delete(id)
        else t.add(id)
        return t
      })
    },
    [arbol],
  )

  const enfocar = useCallback(
    (id: string) => {
      abrir(arbol.ancestros(id))
      setSel(id)
      setHit(id)
      setTimeout(() => setHit((h) => (h === id ? null : h)), 1800)
      setPedido((x) => ({ id, n: (x?.n ?? 0) + 1 }))
    },
    [abrir, arbol],
  )

  const verFicha = useCallback(
    (n: NodoLienzo) => {
      if (n.ficha) abrirFicha(router, n.ficha)
    },
    [router],
  )

  const validar = useCallback(
    (origen: string, destino: string): string | null => {
      const o = arbol.porId.get(origen)
      const d = arbol.porId.get(destino)
      if (!o || !d || !p.validarSoltar) return 'No se puede soltar aquí.'
      if (origen === destino) return 'Es la misma caja.'
      if (arbol.padreDe(origen) === destino) return `Ya depende de «${d.titulo}».`
      if (arbol.esDescendiente(destino, origen)) return 'No se puede colgar de algo que depende de ella.'
      return p.validarSoltar(o, d, arbol)
    },
    [arbol, p],
  )

  const { alSoltar } = p
  const soltar = useCallback(
    async (origen: string, destino: string) => {
      const o = arbol.porId.get(origen)
      const d = arbol.porId.get(destino)
      if (!o || !d || !alSoltar) return
      setMovidos((m) => new Map(m).set(origen, destino))
      abrir([destino, ...arbol.ancestros(destino)])
      avisar('Guardando en el escenario…')
      const error = await alSoltar(o, d)
      if (error) {
        setMovidos((m) => {
          const t = new Map(m)
          t.delete(origen)
          return t
        })
        avisar(error, true)
      } else avisar(`«${o.titulo}» pasa a depender de «${d.titulo}».`)
    },
    [abrir, alSoltar, arbol, avisar],
  )

  const acciones = useCallback(
    (n: NodoLienzo): AccionMenu[] => {
      if (!p.editable) return []
      const propias = p.menu?.(n) ?? []
      if (!p.alSoltar || !p.validarSoltar || !n.arrastrable || n.diff === 'quitado') return propias
      const opciones = [...arbol.porId.values()]
        .filter((d) => validar(n.id, d.id) == null)
        .map((d) => {
          const camino = arbol
            .ancestros(d.id)
            .slice(0, 2)
            .reverse()
            .map((a) => arbol.porId.get(a)!.titulo)
          return { valor: d.id, etiqueta: [...camino, d.titulo].join(' › ') }
        })
        .sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es'))
      if (!opciones.length) return propias
      return [
        {
          clave: 'mover-a',
          etiqueta: 'Mover a…',
          campos: [{ nombre: 'destino', etiqueta: 'Pasa a depender de', tipo: 'opciones', opciones, requerido: true }],
          ejecutar: async (v) => {
            await soltar(n.id, v.destino)
            return null
          },
        },
        ...propias,
      ]
    },
    [arbol, p, soltar, validar],
  )

  const c: Compartido = {
    p,
    arbol,
    abiertos,
    abrir,
    alternar,
    fijarAbiertos: setAbiertos,
    sel,
    setSel,
    hit,
    capa,
    setCapa,
    enfocar,
    pedido,
    verFicha,
    acciones,
    menu,
    setMenu,
    avisar,
    soltar,
    validar,
    setModo,
  }

  const cambios = useMemo(() => nodos.filter((n) => n.diff), [nodos])
  const nodoMenu = menu ? arbol.porId.get(menu) : undefined

  return (
    <div className="lz">
      <div className="min-w-0 flex-1">
        {modo == null ? (
          <div className="lz-marco animate-pulse" aria-busy="true" aria-label="Cargando el lienzo" />
        ) : modo === 'lienzo' ? (
          <ReactFlowProvider>
            <VistaLienzo c={c} />
          </ReactFlowProvider>
        ) : (
          <VistaLista c={c} />
        )}
      </div>
      {(cambios.length > 0 || p.resumenCambios != null) && <PanelCambios c={c} cambios={cambios} />}
      {aviso && (
        <div className="pointer-events-none absolute top-14 left-1/2 z-50 -translate-x-1/2" role="status" aria-live="polite">
          <div className={cn('lz-aviso', aviso.error && 'error')}>{aviso.texto}</div>
        </div>
      )}
      {nodoMenu && modo === 'lista' && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <MenuNodo c={c} nodo={nodoMenu} className="!relative !w-full" />
        </div>
      )}
    </div>
  )
}

// -----------------------------------------------------------------------------
// El lienzo (React Flow)
// -----------------------------------------------------------------------------

type Mostrado = Punto & { o: number }

/** Ajustar deja aire arriba y, abajo, sitio para las migas. */
const RELLENO = { top: '28px', bottom: '56px', x: '32px' } as const

function VistaLienzo({ c }: { c: Compartido }) {
  const rf = useReactFlow()
  const marco = useRef<HTMLDivElement>(null)
  const [compacta, setCompacta] = useState(true)
  const [rev, setRev] = useState(0)
  // Pantalla completa (24-nov-2026, Gabriel: «solo el lienzo, para ver todo mejor»): el marco tapa el armazón
  // (`.lz-completa`) y, si el navegador deja, la página pasa a pantalla completa de verdad. La ficha que se abre
  // desde una caja sigue viéndose encima (`html.lz-pantalla-completa` en lienzo.css).
  const [completa, setCompleta] = useState(false)
  const { arbol, abiertos, p } = c
  const editable = !!p.editable

  const disp = useMemo<Disposicion>(() => {
    void rev
    return disponer({ raices: arbol.raices, hijos: arbol.hijos }, abiertos, compacta)
  }, [arbol, abiertos, compacta, rev])

  const [nodosRF, setNodosRF] = useState<NodoCaja[]>([])
  const mostrado = useRef(new Map<string, Mostrado>())
  const ultimaDisp = useRef<Disposicion | null>(null)
  const animando = useRef(false)
  const pendiente = useRef<{ ajustar?: boolean; centrar?: string }>({})
  const primera = useRef(true)

  const ajustar = useCallback(
    (duracion?: number) => void rf.fitView({ padding: RELLENO, maxZoom: 1, minZoom: 0.12, duration: duracion }),
    [rf],
  )
  // Al abrir (y al desplegar o plegar todo): que se lea. Si todo cabe a ese zoom
  // o más, se ajusta; si no, se queda ahí, arriba y centrado en la raíz más
  // grande. «Ajustar» sí mete todo, aunque quede chico.
  const ajustarLegible = useCallback((minimo = 0.6, duracion?: number) => {
    const m = marco.current
    const visibles = rf.getNodes().filter((n) => n.className !== 'lz-sale')
    if (!m || !visibles.length) return
    const b = getNodesBounds(visibles)
    const r = (m.querySelector('.lz-area') ?? m).getBoundingClientRect()
    const arriba = 30
    const cabe = Math.min((r.width - 64) / b.width, (r.height - arriba - 56) / b.height)
    const zoom = Math.min(1, Math.max(minimo, cabe))
    let x = (r.width - b.width * zoom) / 2 - b.x * zoom
    if (b.width * zoom > r.width - 64) {
      const raiz = [...arbol.raices].sort((a, z) => (arbol.hijos.get(z)?.length ?? 0) - (arbol.hijos.get(a)?.length ?? 0))[0]
      const q = raiz ? ultimaDisp.current?.pos.get(raiz) : null
      x = q ? r.width / 2 - (q.x + ANCHO / 2) * zoom : 32 - b.x * zoom
    }
    void rf.setViewport({ x, y: arriba - b.y * zoom, zoom }, { duration: duracion })
  }, [rf, arbol])

  const centrar = useCallback(
    (id: string) => {
      const pos = ultimaDisp.current?.pos.get(id)
      if (!pos) return
      rf.setCenter(pos.x + ANCHO / 2, pos.y + ALTO / 2 + 40, { zoom: Math.max(rf.getZoom(), 0.8), duration: 450 })
    },
    [rf],
  )

  // La animación: de donde está cada caja a donde la pone la disposición. Las
  // que aparecen salen de su padre; las que se van, vuelven a él y se apagan.
  useEffect(() => {
    ultimaDisp.current = disp
    const destino = new Map<string, Mostrado>()
    for (const id of disp.visibles) {
      const q = disp.pos.get(id)
      if (q) destino.set(id, { x: q.x, y: q.y, o: 1 })
    }
    const actual = mostrado.current
    const ancestroEn = (id: string, mapa: Map<string, Mostrado>) => {
      let a = arbol.padreDe(id)
      let guardia = 0
      while (a && !mapa.has(a) && guardia++ < 60) a = arbol.padreDe(a)
      return a && mapa.has(a) ? a : null
    }
    const origen = new Map<string, Mostrado>()
    for (const [id, d] of destino) {
      const a = actual.get(id)
      if (a) origen.set(id, a)
      else {
        const anc = ancestroEn(id, actual)
        const pa = anc ? actual.get(anc) : null
        origen.set(id, pa ? { x: pa.x, y: pa.y, o: 0 } : { ...d, o: 0 })
      }
    }
    const salientes = new Set([...actual.keys()].filter((id) => !destino.has(id)))
    for (const id of salientes) {
      const a = actual.get(id)!
      const anc = ancestroEn(id, destino)
      const pd = anc ? destino.get(anc)! : a
      origen.set(id, a)
      destino.set(id, { x: pd.x, y: pd.y, o: 0 })
    }

    const reducido = primera.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const DURACION = 340
    const t0 = performance.now()
    let raf = 0
    animando.current = true

    const fusionar = (previos: NodoCaja[], pos: Map<string, Mostrado>, fin: boolean): NodoCaja[] => {
      const porId = new Map(previos.map((n) => [n.id, n]))
      const salida: NodoCaja[] = []
      for (const [id, q] of pos) {
        if (fin && salientes.has(id)) continue
        const viejo = porId.get(id)
        const nodo = arbol.porId.get(id) ?? viejo?.data.nodo
        if (!nodo) continue
        const nHijos = arbol.hijos.get(id)?.length ?? 0
        const sale = salientes.has(id)
        const datos = viejo && viejo.data.nodo === nodo && viejo.data.nHijos === nHijos ? viejo.data : { nodo, nHijos }
        salida.push({
          ...(viejo ?? { id, type: 'caja' as const, width: ANCHO, height: ALTO }),
          position: { x: q.x, y: q.y },
          data: datos,
          style: { opacity: q.o },
          className: sale ? 'lz-sale' : undefined,
          draggable: !sale && editable && !!nodo.arrastrable && nodo.diff !== 'quitado',
          selectable: false,
          ariaLabel: etiquetaAria(nodo, nHijos, abiertos.has(id), c.capa),
        })
      }
      return salida
    }

    const alTerminar = () => {
      animando.current = false
      const pend = pendiente.current
      pendiente.current = {}
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (primera.current) {
            primera.current = false
            ajustarLegible()
          } else if (pend.ajustar) ajustarLegible(0.45, 450)
          if (pend.centrar) centrar(pend.centrar)
        }),
      )
    }

    const cuadro = (ahora: number) => {
      const t = reducido ? 1 : Math.min(1, (ahora - t0) / DURACION)
      const k = 1 - Math.pow(1 - t, 3)
      const pos = new Map<string, Mostrado>()
      for (const [id, d] of destino) {
        const o = origen.get(id) ?? d
        pos.set(id, { x: o.x + (d.x - o.x) * k, y: o.y + (d.y - o.y) * k, o: o.o + (d.o - o.o) * k })
      }
      if (t >= 1) for (const id of salientes) pos.delete(id)
      mostrado.current = pos
      setNodosRF((prev) => fusionar(prev, pos, t >= 1))
      if (t < 1) raf = requestAnimationFrame(cuadro)
      else alTerminar()
    }
    raf = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(raf)
    // `abiertos` y la capa solo cambian el rótulo accesible: no merecen otra animación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disp, editable, rf, centrar, ajustarLegible])

  // Lo que pide la raíz (buscar, la lista de cambios, las migas): centrar.
  const pedidoVisto = useRef(0)
  useEffect(() => {
    if (!c.pedido || c.pedido.n === pedidoVisto.current) return
    pedidoVisto.current = c.pedido.n
    if (animando.current) pendiente.current.centrar = c.pedido.id
    else centrar(c.pedido.id)
  }, [c.pedido, centrar])

  const aristas = useMemo<AristaOrto[]>(
    () =>
      disp.aristas.map((a) => ({
        id: a.id,
        source: a.origen,
        target: a.destino,
        type: 'orto' as const,
        sourceHandle: a.tipo === 'pila' ? 'bl' : 'b',
        targetHandle: a.tipo === 'rama' ? 't' : 'l',
        data: { tipo: a.tipo, dif: !!arbol.porId.get(a.destino)?.diff },
        selectable: false,
        focusable: false,
      })),
    [disp, arbol],
  )

  const alCambiarNodos = useCallback((cambios: NodeChange<NodoCaja>[]) => {
    const utiles = cambios.filter((x) => x.type === 'position' || x.type === 'dimensions')
    if (!utiles.length) return
    for (const x of utiles) {
      if (x.type === 'position' && x.position) {
        const m = mostrado.current.get(x.id)
        if (m) mostrado.current.set(x.id, { ...m, x: x.position.x, y: x.position.y })
      }
    }
    setNodosRF((prev) => applyNodeChanges(utiles, prev))
  }, [])

  // --- Arrastrar una caja sobre otra (modo escenario) ---
  const [destino, setDestino] = useState<{ id: string; error: string | null } | null>(null)
  const alArrastrar: OnNodeDrag<NodoCaja> = useCallback(
    (ev, nodo) => {
      const punto = 'touches' in ev ? (ev.changedTouches[0] ?? ev.touches[0]) : ev
      if (!punto) return
      const bajo = document
        .elementsFromPoint(punto.clientX, punto.clientY)
        .find((el) => el.classList.contains('react-flow__node') && el.getAttribute('data-id') !== nodo.id)
      const id = bajo?.getAttribute('data-id') ?? null
      setDestino((d) => {
        if (!id) return d ? null : d
        if (d?.id === id) return d
        return { id, error: c.validar(nodo.id, id) }
      })
    },
    [c],
  )
  const alSoltarNodo: OnNodeDrag<NodoCaja> = useCallback(
    (_ev, nodo) => {
      const d = destino
      setDestino(null)
      if (d && !d.error) void c.soltar(nodo.id, d.id)
      else if (d?.error) c.avisar(d.error, true)
      setRev((r) => r + 1)
    },
    [c, destino],
  )

  // --- Teclado ---
  const moverFoco = useCallback(
    (id: string) => {
      c.setSel(id)
      if (animando.current) pendiente.current.centrar = id
      else centrar(id)
      setTimeout(() => {
        const el = marco.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
        el?.focus({ preventScroll: true })
      }, 90)
    },
    [c, centrar],
  )

  const alTeclear = (e: EventoTeclado<HTMLDivElement>) => {
    const objetivo = e.target as HTMLElement
    if (objetivo.closest('input, select, textarea, .lz-menu')) return
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      void rf.zoomIn({ duration: 200 })
      return
    }
    if (e.key === '-') {
      e.preventDefault()
      void rf.zoomOut({ duration: 200 })
      return
    }
    if (e.key === '0') {
      e.preventDefault()
      ajustar(300)
      return
    }
    const id = objetivo.closest('.react-flow__node')?.getAttribute('data-id')
    if (!id) return
    const n = arbol.porId.get(id)
    if (!n) return
    const hijos = arbol.hijos.get(id) ?? []
    const padre = arbol.padreDe(id)
    const hermanos = padre ? (arbol.hijos.get(padre) ?? []) : arbol.raices
    const i = hermanos.indexOf(id)
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (e.shiftKey) c.verFicha(n)
        else {
          c.alternar(id)
          c.setSel(id)
        }
        break
      case 'f':
      case 'F':
        e.preventDefault()
        c.verFicha(n)
        break
      case 'm':
      case 'M':
        if (editable && c.acciones(n).length) {
          e.preventDefault()
          abrirMenuEn(id)
        }
        break
      case 'ArrowDown':
        if (hijos.length) {
          e.preventDefault()
          if (!abiertos.has(id)) c.abrir([id])
          moverFoco(hijos[0])
        }
        break
      case 'ArrowUp':
        if (padre) {
          e.preventDefault()
          moverFoco(padre)
        }
        break
      case 'ArrowLeft':
        if (i > 0) {
          e.preventDefault()
          moverFoco(hermanos[i - 1])
        }
        break
      case 'ArrowRight':
        if (i >= 0 && i < hermanos.length - 1) {
          e.preventDefault()
          moverFoco(hermanos[i + 1])
        }
        break
      case 'Escape':
        c.setSel(null)
        c.setMenu(null)
        break
    }
  }

  // --- Botones ---
  const desplegarTodo = () => {
    pendiente.current.ajustar = true
    c.fijarAbiertos(new Set([...arbol.hijos.keys()]))
  }
  const plegar = () => {
    pendiente.current.ajustar = true
    c.fijarAbiertos(new Set(p.abiertosIniciales))
  }
  const cambiarDisposicion = () => {
    pendiente.current.ajustar = true
    setCompacta((x) => !x)
  }
  const [exportando, setExportando] = useState(false)
  const exportar = async () => {
    const vista = marco.current?.querySelector<HTMLElement>('.react-flow__viewport')
    const visibles = rf.getNodes().filter((n) => !n.hidden && n.className !== 'lz-sale')
    if (!vista || !visibles.length) return
    setExportando(true)
    try {
      const { toPng } = await import('html-to-image')
      const b = getNodesBounds(visibles)
      const margen = 48
      const ancho = b.width + margen * 2
      const alto = b.height + margen * 2 + 24
      const escala = Math.min(1, 14000 / (ancho * 1.5), 14000 / (alto * 1.5))
      const url = await toPng(vista, {
        backgroundColor: '#ffffff',
        width: Math.round(ancho * escala),
        height: Math.round(alto * escala),
        pixelRatio: 1.5,
        style: {
          width: `${Math.round(ancho * escala)}px`,
          height: `${Math.round(alto * escala)}px`,
          transform: `translate(${(margen - b.x) * escala}px, ${(margen - b.y) * escala}px) scale(${escala})`,
        },
      })
      const a = document.createElement('a')
      const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
      a.download = `${plano(p.nombre).replace(/[^a-z0-9]+/g, '-')}-${fecha}.png`
      a.href = url
      a.click()
      c.avisar('Imagen descargada: lo que está desplegado en el lienzo.')
    } catch {
      c.avisar('No se pudo generar la imagen.', true)
    } finally {
      setExportando(false)
    }
  }

  // El menú se ancla a la caja, en coordenadas del marco; se calcula al abrirlo.
  const [ancla, setAncla] = useState<{ left: number; top: number } | null>(null)
  const abrirMenuEn = useCallback(
    (id: string) => {
      const m = marco.current
      const el = m?.querySelector(`.react-flow__node[data-id="${CSS.escape(id)}"]`)
      if (m && el) {
        const r = m.getBoundingClientRect()
        const e = el.getBoundingClientRect()
        setAncla({ left: Math.max(8, Math.min(r.width - 290, e.right - r.left + 8)), top: Math.max(8, Math.min(r.height - 280, e.top - r.top)) })
      }
      c.setSel(id)
      c.setMenu(id)
    },
    [c],
  )

  const contexto: ContextoCaja = {
    capa: c.capa,
    cuerpo: p.cuerpo,
    abiertos,
    sel: c.sel,
    hit: c.hit,
    destino,
    editable,
    conMenu: (n) => c.acciones(n).length > 0,
    abrirFicha: c.verFicha,
    abrirMenu: (n) => abrirMenuEn(n.id),
  }

  const nodoMenu = c.menu ? arbol.porId.get(c.menu) : undefined

  const alternarCompleta = () => {
    const nueva = !completa
    setCompleta(nueva)
    if (nueva) void document.documentElement.requestFullscreen?.().catch(() => {})
    else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }
  useEffect(() => {
    if (!completa) return
    const html = document.documentElement
    html.classList.add('lz-pantalla-completa')
    // Esc sale (en pantalla completa de verdad, el navegador la consume y avisa con `fullscreenchange`).
    const alSalir = () => !document.fullscreenElement && setCompleta(false)
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement && !(e.target as HTMLElement).closest?.('input, select, textarea, dialog, [data-ficha-objeto]')) setCompleta(false)
    }
    document.addEventListener('fullscreenchange', alSalir)
    document.addEventListener('keydown', alTecla)
    const t = setTimeout(() => ajustarLegible(0.4, 300), 250)
    return () => {
      html.classList.remove('lz-pantalla-completa')
      document.removeEventListener('fullscreenchange', alSalir)
      document.removeEventListener('keydown', alTecla)
      clearTimeout(t)
      setTimeout(() => ajustarLegible(0.6, 300), 250)
    }
  }, [completa, ajustarLegible])

  const migas = c.sel ? [...arbol.ancestros(c.sel)].reverse().concat(c.sel) : []

  return (
    <ContextoLienzo.Provider value={contexto}>
      <div className={cn('lz-marco', completa && 'lz-completa')} ref={marco} onKeyDown={alTeclear}>
        <div className="lz-herramientas">
          <div className="flex flex-wrap items-center gap-2">
            <Buscador c={c} />
            <CapaSelector c={c} />
            <span className="flex-1" />
            <div className="flex flex-wrap gap-1">
              <button type="button" className="lz-boton" onClick={desplegarTodo}>
                Desplegar todo
              </button>
              <button type="button" className="lz-boton" onClick={plegar}>
                Plegar
              </button>
              <button type="button" className="lz-boton" aria-label="Alejar" onClick={() => void rf.zoomOut({ duration: 200 })}>
                −
              </button>
              <button type="button" className="lz-boton" aria-label="Acercar" onClick={() => void rf.zoomIn({ duration: 200 })}>
                ＋
              </button>
              <button type="button" className="lz-boton" onClick={() => ajustar(400)}>
                ⤢ Ajustar
              </button>
              <button
                type="button"
                className="lz-boton"
                aria-pressed={compacta}
                title="Apila las hojas de un mismo padre en columna para que el dibujo no se ensanche"
                onClick={cambiarDisposicion}
              >
                Apilar hojas
              </button>
              <button type="button" className="lz-boton" onClick={() => void exportar()} disabled={exportando}>
                {exportando ? 'Generando…' : '⇩ PNG'}
              </button>
              {p.pdf && (
                <button type="button" className="lz-boton" title="La caja elegida y lo desplegado debajo, con cajetín, impreso en el servidor" onClick={() => pedirPdf(p.pdf!, c.sel, c.abiertos)}>
                  ⇩ PDF del subárbol
                </button>
              )}
              <button type="button" className="lz-boton" title="Ver como lista, con migas" onClick={() => c.setModo('lista')}>
                Lista
              </button>
              <button
                type="button"
                className={cn('lz-boton', completa && '!border-marca-800 !bg-marca-800 !text-white')}
                aria-pressed={completa}
                title={completa ? 'Volver a la pantalla normal (Esc)' : 'Solo el lienzo, a toda la pantalla'}
                onClick={alternarCompleta}
              >
                <svg viewBox="0 0 16 16" className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  {completa ? <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" /> : <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />}
                </svg>
                {completa ? 'Salir de pantalla completa' : 'Pantalla completa'}
              </button>
            </div>
          </div>
          <Leyenda capa={c.capa} escenario={editable || c.p.nodos.some((n) => n.diff)} />
        </div>
        <div className="lz-area">
        <ReactFlow<NodoCaja, AristaOrto>
          nodes={nodosRF}
          edges={aristas}
          nodeTypes={tiposNodo}
          edgeTypes={tiposArista}
          onNodesChange={alCambiarNodos}
          onNodeClick={(_e, n) => {
            if (n.className === 'lz-sale') return
            c.setMenu(null)
            c.alternar(n.id)
            c.setSel(n.id)
          }}
          onNodeDoubleClick={(_e, n) => c.verFicha(n.data.nodo)}
          onNodeContextMenu={(e, n) => {
            if (!editable || !c.acciones(n.data.nodo).length) return
            e.preventDefault()
            abrirMenuEn(n.id)
          }}
          onPaneClick={() => {
            c.setSel(null)
            c.setMenu(null)
          }}
          onMoveStart={() => c.menu && c.setMenu(null)}
          onNodeDrag={alArrastrar}
          onNodeDragStop={alSoltarNodo}
          nodesDraggable={editable}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable
          edgesFocusable={false}
          disableKeyboardA11y
          nodeDragThreshold={6}
          minZoom={0.1}
          maxZoom={2}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          ariaLabelConfig={ARIA_LIENZO}
          aria-label={p.nombre}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#e3e0dd" />
          <Panel position="bottom-left" className="!m-2.5">
            <nav className="lz-panel lz-migas" aria-label="Camino hasta la caja elegida">
              {migas.length ? (
                migas.map((id, i) => {
                  const n = arbol.porId.get(id)
                  if (!n) return null
                  return (
                    <span key={id}>
                      {i > 0 && ' › '}
                      {i === migas.length - 1 ? (
                        <b>{n.titulo}</b>
                      ) : (
                        <button type="button" onClick={() => c.enfocar(id)}>
                          {n.titulo}
                        </button>
                      )}
                    </span>
                  )
                })
              ) : (
                <span>{p.ayuda ?? 'Clic: desplegar o plegar · «Ficha ›» o doble clic: abrir la ficha · arrastra el fondo para moverte · rueda: zoom'}</span>
              )}
            </nav>
          </Panel>
          <MiniMap<NodoCaja>
            className="lz-minimapa"
            pannable
            zoomable
            ariaLabel="Minimapa"
            nodeBorderRadius={8}
            nodeStrokeWidth={0}
            nodeColor={(n) => (n.id === c.sel ? '#d4332c' : n.data.nodo.diff ? '#6b4fb3' : n.data.nodo.clase === 'grupo' || n.data.nodo.clase === 'raiz' ? '#57534e' : '#c9ced5')}
            maskColor="rgba(246, 247, 249, 0.6)"
            style={{ width: 180, height: 110 }}
          />
        </ReactFlow>
        </div>
        {nodoMenu && ancla && <MenuNodo c={c} nodo={nodoMenu} style={ancla} />}
      </div>
    </ContextoLienzo.Provider>
  )
}

// -----------------------------------------------------------------------------
// La lista (teléfono)
// -----------------------------------------------------------------------------

function focoInicial(arbol: Arbol): string | null {
  // Baja por la cadena de hijos únicos: nadie quiere tocar «Junta Directiva» para ver algo.
  const tam = (r: string): number => 1 + (arbol.hijos.get(r) ?? []).reduce((s, h) => s + tam(h), 0)
  let id = arbol.raices.length ? [...arbol.raices].sort((a, b) => tam(b) - tam(a))[0] : null
  let guardia = 0
  // Baja mientras haya una sola rama (las hojas de al lado, como la plaza del jefe, no cuentan).
  const ramas = (x: string) => (arbol.hijos.get(x) ?? []).filter((h) => (arbol.hijos.get(h)?.length ?? 0) > 0)
  while (id && ramas(id).length === 1 && guardia++ < 10) id = ramas(id)[0]
  return id
}

function VistaLista({ c }: { c: Compartido }) {
  const { arbol, p } = c
  const [foco, setFoco] = useState<string | null>(() => focoInicial(arbol))
  const [visto, setVisto] = useState(0)
  if (c.pedido && c.pedido.n !== visto) {
    setVisto(c.pedido.n)
    setFoco(arbol.padreDe(c.pedido.id))
  }
  const actual = foco ? arbol.porId.get(foco) : undefined
  const filas = foco ? (arbol.hijos.get(foco) ?? []) : arbol.raices
  const migas = foco ? [...arbol.ancestros(foco)].reverse().concat(foco) : []

  const fila = (id: string) => {
    const n = arbol.porId.get(id)!
    const nh = arbol.hijos.get(id)?.length ?? 0
    const conMenu = !!p.editable && c.acciones(n).length > 0
    return (
      <li key={id} className={cn('fila', n.diff && `d-${n.diff}`, c.sel === id && 'bg-oro-50')}>
        <button
          type="button"
          className="txt lz-toque"
          onClick={() => {
            c.setSel(id)
            if (nh) setFoco(id)
          }}
        >
          {/* Sin aria-label: el nombre es lo que se lee en la fila (WCAG 2.5.3); lo que no se ve va en sr-only. */}
          <b>{n.titulo}</b>
          {n.subtitulo && <small>{n.subtitulo}</small>}
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-marca-500">
            {p.cuerpo?.(n, c.capa?.clave ?? '')}
            <MarcaChip capa={c.capa} nodo={n} />
            {n.diff && <span className={cn('lz-etq', n.diff === 'quitado' && 'quitado')}>{ETIQUETA_DIFF[n.diff]}</span>}
          </span>
          {(nh > 0 || n.diffTexto) && (
            <span className="sr-only">
              {n.diffTexto ? `. ${n.diffTexto}` : ''}
              {nh ? `. ${nh} ${nh === 1 ? 'dependencia' : 'dependencias'}` : ''}
            </span>
          )}
        </button>
        {conMenu && (
          <button type="button" className="lz-boton lz-toque" aria-label={`Cambiar «${n.titulo}»`} onClick={() => c.setMenu(id)}>
            ⋯
          </button>
        )}
        {n.ficha && (
          <button type="button" className="lz-boton lz-toque" onClick={() => c.verFicha(n)}>
            Ficha ›
          </button>
        )}
        {nh > 0 && (
          <span className="w-8 text-right text-sm font-semibold text-marca-500" aria-hidden>
            {nh} ›
          </span>
        )}
      </li>
    )
  }

  return (
    <div className="lz-lista">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Buscador c={c} ancho />
        <CapaSelector c={c} />
        <button type="button" className="lz-boton lz-toque" onClick={() => c.setModo('lienzo')}>
          Ver lienzo
        </button>
        {p.pdf && (
          <button type="button" className="lz-boton lz-toque" onClick={() => pedirPdf(p.pdf!, foco, null)}>
            ⇩ PDF del subárbol
          </button>
        )}
      </div>
      <Leyenda capa={c.capa} escenario={!!p.editable || p.nodos.some((n) => n.diff)} />
      <nav className="my-3 flex flex-wrap items-center gap-1 text-sm text-marca-600" aria-label="Camino">
        <button type="button" className="lz-toque rounded-lg px-2 hover:bg-marca-100" onClick={() => setFoco(null)}>
          Inicio
        </button>
        {migas.map((id) => (
          <span key={id} className="flex items-center gap-1">
            <span aria-hidden>›</span>
            <button type="button" className="lz-toque rounded-lg px-2 text-left hover:bg-marca-100" onClick={() => setFoco(id)} aria-current={id === foco ? 'page' : undefined}>
              {id === foco ? <b className="text-marca-900">{arbol.porId.get(id)?.titulo}</b> : arbol.porId.get(id)?.titulo}
            </button>
          </span>
        ))}
      </nav>
      {actual && (
        <div className="tarjeta mb-3 flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-marca-900">{actual.titulo}</p>
            {actual.subtitulo && <p className="text-sm text-marca-500">{actual.subtitulo}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-marca-600">
              {p.cuerpo?.(actual, c.capa?.clave ?? '')}
              <MarcaChip capa={c.capa} nodo={actual} />
            </div>
          </div>
          {actual.ficha && (
            <button type="button" className="lz-boton lz-toque" onClick={() => c.verFicha(actual)}>
              Ficha ›
            </button>
          )}
        </div>
      )}
      <ul className="tarjeta overflow-hidden">
        {filas.map(fila)}
        {!filas.length && <li className="fila text-sm text-marca-500">No tiene nada debajo.</li>}
      </ul>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Piezas comunes
// -----------------------------------------------------------------------------

function Buscador({ c, ancho }: { c: Compartido; ancho?: boolean }) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const resultados = useMemo(() => {
    const t = plano(q.trim())
    if (t.length < 2) return []
    const salida: { id: string; peso: number }[] = []
    for (const [id, texto] of c.arbol.planos) {
      const i = texto.indexOf(t)
      if (i < 0) continue
      const titulo = plano(c.arbol.porId.get(id)!.titulo)
      salida.push({ id, peso: titulo.startsWith(t) ? 0 : titulo.includes(t) ? 1 : 2 })
    }
    return salida.sort((a, b) => a.peso - b.peso).slice(0, 12)
  }, [q, c.arbol])

  const elegir = (id: string) => {
    setAbierto(false)
    c.enfocar(id)
  }
  return (
    <div className="relative">
      <input
        type="search"
        className={cn('lz-campo', ancho ? 'w-full min-w-56' : 'w-56')}
        placeholder="Buscar y enfocar…"
        aria-label="Buscar en el dibujo"
        role="combobox"
        aria-expanded={abierto && resultados.length > 0}
        aria-controls="lz-resultados"
        aria-autocomplete="list"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setAbierto(true)
          setActivo(0)
        }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActivo((a) => Math.min(a + 1, resultados.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActivo((a) => Math.max(a - 1, 0))
          } else if (e.key === 'Enter' && resultados[activo]) {
            e.preventDefault()
            elegir(resultados[activo].id)
          } else if (e.key === 'Escape') setAbierto(false)
        }}
      />
      {abierto && q.trim().length >= 2 && (
        <ul id="lz-resultados" role="listbox" className="lz-resultados">
          {resultados.map((r, i) => {
            const n = c.arbol.porId.get(r.id)!
            const padre = c.arbol.padreDe(r.id)
            return (
              <li
                key={r.id}
                role="option"
                aria-selected={i === activo}
                onMouseDown={(e) => {
                  e.preventDefault()
                  elegir(r.id)
                }}
              >
                {n.titulo}
                <small>
                  {[n.subtitulo, padre ? `en ${c.arbol.porId.get(padre)?.titulo}` : null].filter(Boolean).join(' · ')}
                </small>
              </li>
            )
          })}
          {!resultados.length && <li className="!cursor-default text-marca-500">Nada coincide con «{q.trim()}».</li>}
        </ul>
      )}
    </div>
  )
}

function CapaSelector({ c }: { c: Compartido }) {
  if (c.p.capas.length < 2) return null
  return (
    <label className="lz-panel flex items-center gap-1.5 py-0.5 pr-0.5 pl-2.5">
      Color:
      <select className="lz-campo !border-0 !pl-1" value={c.capa?.clave ?? ''} onChange={(e) => c.setCapa(e.target.value)}>
        {c.p.capas.map((x) => (
          <option key={x.clave} value={x.clave}>
            {x.etiqueta}
          </option>
        ))}
      </select>
    </label>
  )
}

function Leyenda({ capa, escenario }: { capa: Capa | null; escenario: boolean }) {
  if (!capa) return null
  return (
    <div className="lz-leyenda" aria-label={`Leyenda: ${capa.etiqueta}`}>
      {capa.leyenda.map((m) => (
        <span key={m.etiqueta}>
          <i style={{ background: COLOR_TONO[m.tono] }} aria-hidden />
          <span aria-hidden style={{ color: TEXTO_TONO[m.tono], fontWeight: 700 }}>
            {m.icono}
          </span>
          {m.etiqueta}
        </span>
      ))}
      {escenario && (
        <span>
          <i style={{ background: COLOR_TONO.morado }} aria-hidden />
          cambio del escenario (con su rótulo)
        </span>
      )}
    </div>
  )
}

function PanelCambios({ c, cambios }: { c: Compartido; cambios: NodoLienzo[] }) {
  const orden = { nuevo: 0, movido: 1, cambiado: 2, quitado: 3 }
  const lista = [...cambios].sort((a, b) => orden[a.diff!] - orden[b.diff!] || a.titulo.localeCompare(b.titulo, 'es'))
  return (
    <aside className="lz-cambios" aria-label="Cambios del escenario">
      {c.p.resumenCambios}
      <h3>
        Cambios contra la realidad <span className="font-normal text-marca-500">({lista.length})</span>
      </h3>
      {lista.length ? (
        <ul>
          {lista.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => c.enfocar(n.id)}>
                <span className={cn('lz-etq', n.diff === 'quitado' && 'quitado')}>{ETIQUETA_DIFF[n.diff!]}</span>
                <span className="min-w-0">
                  {n.titulo}
                  {n.diffTexto && <small>{n.diffTexto}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-marca-500">Todavía no cambia nada. Arrastra una caja sobre otra o usa «⋯» en una caja elegida.</p>
      )}
      {c.p.editable && (
        <p className="mt-3 border-t border-[var(--borde)] pt-3 text-xs text-marca-500">
          Nada de esto toca la realidad hasta que el escenario se apruebe.
        </p>
      )}
    </aside>
  )
}

function MenuNodo({ c, nodo, style, className }: { c: Compartido; nodo: NodoLienzo; style?: { left: number; top: number }; className?: string }) {
  const acciones = c.acciones(nodo)
  const [eleccion, setEleccion] = useState<AccionMenu | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const primero = useRef<HTMLButtonElement | HTMLInputElement | HTMLSelectElement | null>(null)
  useEffect(() => {
    primero.current?.focus()
  }, [eleccion])

  const elegir = (a: AccionMenu) => {
    setError(null)
    setEleccion(a)
    setValores(Object.fromEntries((a.campos ?? []).map((x) => [x.nombre, x.inicial ?? (x.tipo === 'opciones' ? (x.opciones?.[0]?.valor ?? '') : '')])))
  }
  const ejecutar = async () => {
    if (!eleccion) return
    const falta = eleccion.campos?.find((x) => x.requerido && !valores[x.nombre]?.trim())
    if (falta) {
      setError(`Falta «${falta.etiqueta}».`)
      return
    }
    setEnviando(true)
    const e = await eleccion.ejecutar(valores)
    setEnviando(false)
    if (e) {
      setError(e)
      return
    }
    c.setMenu(null)
    c.abrir([nodo.id])
    if (eleccion.hecho) c.avisar(eleccion.hecho)
  }

  let cuerpo: ReactNode
  if (!eleccion) {
    cuerpo = acciones.map((a, i) => (
      <button
        key={a.clave}
        type="button"
        ref={i === 0 ? (el) => void (primero.current = el) : undefined}
        className={cn('item', a.peligro && 'peligro')}
        onClick={() => elegir(a)}
      >
        {a.etiqueta}
      </button>
    ))
  } else {
    cuerpo = (
      <form
        className="px-1 pb-1"
        onSubmit={(e) => {
          e.preventDefault()
          void ejecutar()
        }}
      >
        <p className="px-1 pt-1 text-sm font-semibold text-marca-800">{eleccion.etiqueta}</p>
        {eleccion.campos?.map((x, i) => (
          <div key={x.nombre}>
            <label htmlFor={`lz-campo-${x.nombre}`}>{x.etiqueta}</label>
            {x.tipo === 'opciones' ? (
              <select
                id={`lz-campo-${x.nombre}`}
                ref={i === 0 ? (el) => void (primero.current = el) : undefined}
                className="lz-campo"
                value={valores[x.nombre] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [x.nombre]: e.target.value }))}
              >
                {x.opciones?.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`lz-campo-${x.nombre}`}
                ref={i === 0 ? (el) => void (primero.current = el) : undefined}
                className="lz-campo"
                type={x.tipo === 'numero' ? 'number' : 'text'}
                min={x.tipo === 'numero' ? 0 : undefined}
                value={valores[x.nombre] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [x.nombre]: e.target.value }))}
              />
            )}
          </div>
        ))}
        {eleccion.confirmar && <p className="mt-2 px-1 text-sm text-marca-700">{eleccion.confirmar}</p>}
        {error && (
          <p className="mt-2 px-1 text-sm text-acento-700" role="alert">
            {error}
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" className="lz-boton" onClick={() => setEleccion(null)}>
            Volver
          </button>
          <button type="submit" className={cn('lz-boton', eleccion.peligro ? '!border-acento-300 !text-acento-700' : '!border-marca-800 !bg-marca-800 !text-white')} disabled={enviando}>
            {enviando ? 'Guardando…' : eleccion.peligro ? 'Sí, hacerlo' : 'Guardar'}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div
      className={cn('lz-menu', className)}
      style={style}
      role="dialog"
      aria-label={`Cambiar «${nodo.titulo}» en el escenario`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          c.setMenu(null)
        }
      }}
    >
      <header>
        {nodo.titulo}
        <small>En el escenario · no toca la realidad</small>
      </header>
      {cuerpo}
      {!eleccion && (
        <button type="button" className="item text-marca-500" onClick={() => c.setMenu(null)}>
          Cerrar
        </button>
      )}
    </div>
  )
}
