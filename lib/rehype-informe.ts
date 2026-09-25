/**
 * Lo que el informe entiende además del markdown de siempre.
 *
 * Es un plugin de rehype —trabaja sobre el HTML ya armado— porque `react-markdown`
 * descarta el HTML crudo: un `<span class="…">` escrito en el taller llegaría como
 * texto. Así, quien escribe usa marcas de texto legibles en el editor, y aquí se
 * convierten en forma y color. Tres marcas y una tarjeta:
 *
 *   · `[Crítico]`, `[Atención]`, `[Funciona]` al principio de un párrafo, una
 *     viñeta o una celda → una pastilla de color. Rojo, ámbar y verde.
 *   · `> [!CLAVE]`, `> [!CRITICO]`, `> [!ATENCION]` al principio de una cita → un
 *     aviso con su rótulo.
 *   · con `tarjetas`, cada `###` y lo que sigue hasta el próximo `###`, `##` o
 *     `---` → una tarjeta, con el borde del nivel de su primera línea.
 *   · con `nuevos`, la primera celda de una fila cuyo texto sea un proceso o un
 *     macroproceso que no figuraba en el inventario de partida → la marca «No
 *     documentado»; con `propuestos`, la de «Propuesto». Y un `**nuevo**`,
 *     `**no documentado**` o `**propuesto**` suelto, también.
 *
 *     ⚠️ **Se llamaba «Nuevo» y se cambió el 25 de septiembre de 2026**, en la reunión
 *     del equipo: un proceso que se hace desde hace años no es nuevo, es que nadie lo
 *     escribió. Lo único nuevo de verdad es lo que el programa propone. La clase
 *     sigue siendo `marca-nuevo` para no romper estilos ni pruebas.
 *
 * ⚠️ **Va después de `rehype-slug`**: los ids de los encabezados ya están puestos
 * cuando se envuelven en tarjetas, así que las anclas no cambian.
 */

type Texto = { type: 'text'; value: string }
type Elemento = {
  type: 'element'
  tagName: string
  properties?: Record<string, unknown>
  children: Nodo[]
}
type Nodo = Texto | Elemento | { type: string; children?: Nodo[]; value?: string }
type Raiz = { type: 'root'; children: Nodo[] }

export type OpcionesInforme = {
  /** Envolver cada `###` en una tarjeta. */
  tarjetas?: boolean
  /** Procesos y macroprocesos no documentados, ya normalizados con `normalizarNombre`. */
  nuevos?: string[]
  /** Procesos que propone el programa, normalizados igual. */
  propuestos?: string[]
}

export const ROTULO_NO_DOCUMENTADO = 'No documentado'
export const ROTULO_PROPUESTO = 'Propuesto'

const NIVELES: Record<string, { clave: string; rotulo: string }> = {
  crítico: { clave: 'critico', rotulo: 'Crítico' },
  critico: { clave: 'critico', rotulo: 'Crítico' },
  atención: { clave: 'atencion', rotulo: 'Atención' },
  atencion: { clave: 'atencion', rotulo: 'Atención' },
  funciona: { clave: 'funciona', rotulo: 'Funciona' },
  // La disponibilidad de una oportunidad, con el mismo semáforo: verde arranca,
  // ámbar pide un paso antes, rojo espera a que exista el dato.
  'arranca ya': { clave: 'funciona', rotulo: 'Arranca ya' },
  'paso previo': { clave: 'atencion', rotulo: 'Paso previo' },
  'falta el dato': { clave: 'critico', rotulo: 'Falta el dato' },
}
const ETIQUETA = /^\s*\[(Crítico|Critico|Atención|Atencion|Funciona|Arranca ya|Paso previo|Falta el dato)\]\s*/i

const AVISOS: Record<string, string> = {
  CLAVE: 'La clave',
  CRITICO: 'Crítico',
  ATENCION: 'Atención',
}
const MARCA_AVISO = /^\s*\[!(CLAVE|CRITICO|ATENCION)\]\s*/

/** Para comparar nombres de procesos: sin mayúsculas, sin acentos, sin markdown. */
export function normalizarNombre(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const esElemento = (n: Nodo | undefined, tag?: string): n is Elemento =>
  Boolean(n) && n!.type === 'element' && (!tag || (n as Elemento).tagName === tag)

function textoDe(n: Nodo): string {
  if (n.type === 'text') return (n as Texto).value
  return ((n as Elemento).children ?? []).map(textoDe).join('')
}

const span = (clase: string, texto: string): Elemento => ({
  type: 'element',
  tagName: 'span',
  properties: { className: clase.split(' ') },
  children: [{ type: 'text', value: texto }],
})

/** Si el primer texto del elemento empieza con una etiqueta de nivel, la vuelve pastilla. */
function etiquetar(el: Elemento): string | null {
  const primero = el.children[0]
  if (!primero || primero.type !== 'text') return null
  const m = ETIQUETA.exec((primero as Texto).value)
  if (!m) return null
  const nivel = NIVELES[m[1].toLowerCase()]
  ;(primero as Texto).value = (primero as Texto).value.slice(m[0].length)
  el.children.unshift(span(`nivel nivel-${nivel.clave}`, nivel.rotulo), { type: 'text', value: ' ' })
  return nivel.clave
}

function recorrer(n: Nodo, opciones: OpcionesInforme, nuevos: Set<string>, propuestos: Set<string>) {
  if (!esElemento(n) && n.type !== 'root') return
  const el = n as Elemento

  if (esElemento(el, 'p') || esElemento(el, 'li') || esElemento(el, 'td')) etiquetar(el)

  // Una viñeta de lista con su párrafo adentro (lista «suelta»).
  if (esElemento(el, 'li') && esElemento(el.children[0], 'p')) etiquetar(el.children[0] as Elemento)

  if (esElemento(el, 'blockquote')) {
    const p = el.children.find((c) => esElemento(c, 'p')) as Elemento | undefined
    const primero = p?.children[0]
    const m = primero?.type === 'text' ? MARCA_AVISO.exec((primero as Texto).value) : null
    if (p && m) {
      ;(primero as Texto).value = (primero as Texto).value.slice(m[0].length)
      el.tagName = 'aside'
      el.properties = { ...(el.properties ?? {}), className: ['aviso-md', `aviso-${m[1].toLowerCase()}`] }
      el.children.unshift({
        type: 'element',
        tagName: 'p',
        properties: { className: ['aviso-rotulo'] },
        children: [{ type: 'text', value: AVISOS[m[1]] }],
      })
    }
  }

  // «**no documentado**» o «**propuesto**» suelto, como lo escribe el mapa de
  // procesos. «**nuevo**» se sigue entendiendo: es lo que escribía antes.
  if (esElemento(el, 'strong')) {
    const t = normalizarNombre(textoDe(el))
    if (t === 'nuevo' || t === 'no documentado') {
      el.tagName = 'span'
      el.properties = { className: ['marca-nuevo'] }
      el.children = [{ type: 'text', value: ROTULO_NO_DOCUMENTADO }]
    } else if (t === 'propuesto') {
      el.tagName = 'span'
      el.properties = { className: ['marca-propuesto'] }
      el.children = [{ type: 'text', value: ROTULO_PROPUESTO }]
    }
  }

  if ((nuevos.size || propuestos.size) && esElemento(el, 'tr')) {
    const celda = el.children.find((c) => esElemento(c, 'td')) as Elemento | undefined
    const nombre = celda ? normalizarNombre(textoDe(celda)) : ''
    if (celda && propuestos.has(nombre)) {
      celda.children.push({ type: 'text', value: ' ' }, span('marca-propuesto', ROTULO_PROPUESTO))
    } else if (celda && nuevos.has(nombre)) {
      celda.children.push({ type: 'text', value: ' ' }, span('marca-nuevo', ROTULO_NO_DOCUMENTADO))
    }
  }

  for (const hijo of el.children ?? []) recorrer(hijo, opciones, nuevos, propuestos)
}

/** Envuelve cada `###` y lo que lo sigue en una `<section class="tarjeta-md">`. */
function enTarjetas(raiz: Raiz) {
  const salida: Nodo[] = []
  let actual: Elemento | null = null
  for (const n of raiz.children) {
    const corta = esElemento(n, 'h1') || esElemento(n, 'h2') || esElemento(n, 'hr')
    if (esElemento(n, 'h3')) {
      actual = { type: 'element', tagName: 'section', properties: { className: ['tarjeta-md'] }, children: [n] }
      salida.push(actual)
      continue
    }
    if (corta) actual = null
    if (actual) actual.children.push(n)
    else salida.push(n)
  }
  raiz.children = salida

  // El nivel de la tarjeta es el de su primera línea con etiqueta.
  for (const n of salida) {
    if (!esElemento(n, 'section')) continue
    const pastilla = n.children
      .filter((c) => esElemento(c))
      .slice(1, 3)
      .map((c) => (c as Elemento).children?.find((x) => esElemento(x, 'span')) as Elemento | undefined)
      .find((s) => (s?.properties?.className as string[] | undefined)?.includes('nivel'))
    const clase = (pastilla?.properties?.className as string[] | undefined)?.find((c) => c.startsWith('nivel-'))
    if (clase) n.properties = { ...n.properties, dataNivel: clase.replace('nivel-', '') }
  }
}

export function rehypeInforme(opciones: OpcionesInforme = {}) {
  const nuevos = new Set(opciones.nuevos ?? [])
  const propuestos = new Set(opciones.propuestos ?? [])
  return (arbol: Raiz) => {
    recorrer(arbol as unknown as Nodo, opciones, nuevos, propuestos)
    if (opciones.tarjetas) enTarjetas(arbol)
  }
}
