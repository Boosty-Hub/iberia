/**
 * El PDF de una sección del informe, armado en el navegador.
 *
 * Netlify no trae navegador en sus funciones (ver `app/sistema/pdf/subarbol`),
 * así que el PDF no lo imprime el servidor: lo dibuja quien pulsa «Descargar PDF».
 * La sección se carga en un `<iframe>` de ancho fijo —así el diseño responde a
 * ese ancho y no a la pantalla de cada quien—, se parte en bloques (el
 * encabezado, cada dibujo y cada párrafo, tabla o tarjeta del texto) y los
 * bloques se reparten en hojas A4 sin cortar ninguno por la mitad. Cada hoja se
 * copia a un contenedor aparte, con la misma cadena de clases que tenía en la
 * página para que los estilos le lleguen igual, y se dibuja con `html-to-image`.
 *
 * El texto queda como imagen: se lee y se imprime bien, pero no se selecciona.
 */
import { getFontEmbedCSS, toCanvas } from 'html-to-image'
import { jsPDF } from 'jspdf'

/**
 * Ancho del iframe, en px. Ancho a propósito: el espejo de la arquitectura mide
 * 1080 y, más estrecho, sale con barra de desplazamiento y cortado. Cada hoja se
 * recorta después a lo que ocupan sus bloques (ver `generarPdfSeccion`), así que
 * el texto, que va a 760–840, no sale chico.
 */
export const ANCHO_PDF = 1600

/** Aire a cada lado de lo que ocupan los bloques de una hoja, en px. */
const AIRE = 20

/** Lo que no va en el PDF: migas, índices plegados, flechas de navegación, botones. */
export const ATRIBUTO_OMITIR = 'data-pdf-omitir'

/** El mensaje que el iframe le manda a la página que pidió el PDF. */
export type MensajePdf =
  | { tipo: 'informe-pdf:progreso'; hechas: number; total: number }
  | { tipo: 'informe-pdf:listo'; pdf: Blob }
  | { tipo: 'informe-pdf:error'; mensaje: string }

// Hoja A4 en milímetros: margen parejo y una franja abajo para el pie.
const HOJA = { ancho: 210, alto: 297, margen: 12, pie: 8 }
const AREA = { ancho: HOJA.ancho - 2 * HOJA.margen, alto: HOJA.alto - 2 * HOJA.margen - HOJA.pie }

/**
 * Un bloque es un elemento entero o, en una tabla larga, una de sus filas: `fila`
 * es su número en el cuerpo y `encabezado` lo que mide la cabecera, que se repite
 * arriba de cada hoja donde siga la tabla.
 */
type Bloque = { el: HTMLElement; arriba: number; abajo: number; izq: number; der: number; fila?: number; encabezado?: number }

/** Una hoja: sus bloques y lo que ocupan de lado a lado. */
type Hoja = { bloques: Bloque[]; izq: number; der: number }

/** Una tabla más alta que esto se parte por filas; las cortas van enteras. */
const TABLA_PARTIBLE = 320

/** Los bloques de la sección en el orden en que se leen. */
function bloquesDe(articulo: HTMLElement): Bloque[] {
  const elementos: HTMLElement[] = []
  const recorrer = (padre: HTMLElement) => {
    for (const hijo of Array.from(padre.children) as HTMLElement[]) {
      if (hijo.hasAttribute(ATRIBUTO_OMITIR)) continue
      const estilo = getComputedStyle(hijo)
      if (estilo.display === 'none' || hijo.offsetHeight === 0) continue
      // El texto se parte en sus piezas; un contenedor sin texto propio que solo
      // envuelve (el `py-8` de la prosa) se abre. Lo demás —encabezado, dibujos,
      // tarjetas, tablas— es un bloque entero.
      if (hijo.classList.contains('prosa') || hijo.dataset.pdfAbrir !== undefined) recorrer(hijo)
      else elementos.push(hijo)
    }
  }
  recorrer(articulo)
  const y = (r: DOMRect) => ({ arriba: r.top + window.scrollY, abajo: r.bottom + window.scrollY, izq: r.left, der: r.right })
  return elementos.flatMap((el): Bloque[] => {
    const caja = y(el.getBoundingClientRect())
    const tabla = el.tagName === 'TABLE' ? (el as HTMLTableElement) : el.querySelector<HTMLTableElement>(':scope > table')
    const filas = tabla ? Array.from(tabla.tBodies[0]?.rows ?? []) : []
    if (!tabla || filas.length < 2 || caja.abajo - caja.arriba <= TABLA_PARTIBLE) return [{ el, ...caja }]
    const encabezado = tabla.tHead?.getBoundingClientRect().height ?? 0
    return filas.map((tr, i) => {
      const f = y(tr.getBoundingClientRect())
      // La primera fila carga con el margen y la cabecera de la tabla; la última, con lo que queda debajo.
      return {
        el,
        fila: i,
        encabezado,
        izq: caja.izq,
        der: caja.der,
        arriba: i === 0 ? caja.arriba : f.arriba,
        abajo: i === filas.length - 1 ? caja.abajo : f.abajo,
      }
    })
  })
}

/**
 * Alto que cabe en una hoja cuyo contenido mide `ancho` px de lado a lado: la hoja se
 * escala a lo ancho del área útil, así que una hoja más angosta admite menos px de alto.
 */
const altoPara = (ancho: number) => Math.floor((AREA.alto * ancho) / AREA.ancho)

/**
 * Reparte los bloques en hojas sin partir ninguno. Una hoja toma el ancho de su
 * bloque más ancho; un título no se queda solo al pie, y el encabezado de la
 * sección acompaña al dibujo que le sigue aunque haya que achicar la hoja.
 */
function repartir(bloques: Bloque[]): Hoja[] {
  const hojas: Hoja[] = []
  let actual: Hoja | null = null
  let inicio = 0
  // Una fila que abre hoja lleva arriba la cabecera repetida de su tabla.
  const desde = (x: Bloque) => (x.fila ? x.arriba - (x.encabezado ?? 0) : x.arriba)
  const nueva = (bs: Bloque[]): Hoja => ({
    bloques: bs,
    izq: Math.min(...bs.map((b) => b.izq)),
    der: Math.max(...bs.map((b) => b.der)),
  })
  for (const b of bloques) {
    if (!actual) {
      actual = nueva([b])
      inicio = desde(b)
      continue
    }
    const izq = Math.min(actual.izq, b.izq)
    const der = Math.max(actual.der, b.der)
    const cabe = altoPara(der - izq + 2 * AIRE)
    const conEncabezado = actual.bloques.length === 1 && actual.bloques[0].el.tagName === 'HEADER'
    if (b.abajo - inicio <= cabe || (conEncabezado && b.abajo - inicio <= cabe * 1.45)) {
      actual.bloques.push(b)
      actual.izq = izq
      actual.der = der
      continue
    }
    const ultimo = actual.bloques[actual.bloques.length - 1]
    const titulo = actual.bloques.length > 1 && /^H[1-4]$/.test(ultimo.el.tagName) ? actual.bloques.pop()! : null
    hojas.push(nueva(actual.bloques))
    actual = nueva(titulo ? [titulo, b] : [b])
    inicio = desde(actual.bloques[0])
  }
  if (actual) hojas.push(nueva(actual.bloques))
  return hojas
}

/**
 * Copia una hoja a un contenedor propio: cada bloque, metido en copias vacías de
 * sus ancestros hasta el artículo, para que los selectores (`.prosa p`,
 * `.hoja-informe h2`…) y lo heredado le lleguen igual que en la página.
 */
function armarHoja(bloques: Bloque[], articulo: HTMLElement, ancho: number): HTMLElement {
  const hoja = document.createElement('div')
  hoja.style.cssText = `width:${ancho}px;background:#ffffff;padding:0;margin:0;`
  // Con la misma cadena de ancestros, los bloques seguidos comparten contenedor:
  // así el margen entre párrafos es el de la página.
  let cadenaPrevia: HTMLElement[] = []
  let copiasPrevias: HTMLElement[] = []
  for (let k = 0; k < bloques.length; k++) {
    const { el, fila } = bloques[k]
    // Las filas seguidas de una misma tabla van en una sola copia de la tabla.
    if (fila !== undefined && k > 0 && bloques[k - 1].el === el && bloques[k - 1].fila !== undefined) continue
    const cadena: HTMLElement[] = []
    for (let p = el.parentElement; p && p !== articulo.parentElement; p = p.parentElement) cadena.unshift(p)
    let comun = 0
    while (comun < cadena.length && comun < cadenaPrevia.length && cadena[comun] === cadenaPrevia[comun]) comun++
    const copias = copiasPrevias.slice(0, comun)
    let destino: HTMLElement = copias[copias.length - 1] ?? hoja
    for (let i = comun; i < cadena.length; i++) {
      const vacia = cadena[i].cloneNode(false) as HTMLElement
      // El artículo y sus envoltorios no llevan alto mínimo ni relleno vertical en la hoja.
      vacia.style.minHeight = '0'
      if (i === 0) {
        // El artículo es la hoja: sin el marco de tarjeta que lleva en pantalla.
        vacia.style.maxWidth = 'none'
        vacia.style.border = '0'
        vacia.style.boxShadow = 'none'
        vacia.style.borderRadius = '0'
      }
      destino.appendChild(vacia)
      copias.push(vacia)
      destino = vacia
    }
    const copia = el.cloneNode(true) as HTMLElement
    copia.querySelectorAll(`[${ATRIBUTO_OMITIR}]`).forEach((n) => n.remove())
    if (fila !== undefined) {
      // Solo las filas de esta hoja; la cabecera de la tabla se queda.
      let ultima = fila
      while (bloques[ultima + 1 - fila + k]?.el === el && bloques[ultima + 1 - fila + k]?.fila === ultima + 1) ultima++
      const cuerpo = (copia.tagName === 'TABLE' ? (copia as HTMLTableElement) : copia.querySelector<HTMLTableElement>(':scope > table'))?.tBodies[0]
      Array.from(cuerpo?.rows ?? []).forEach((tr, i) => {
        if (i < fila || i > ultima) tr.remove()
      })
      // Lo que sigue en otra hoja no lleva margen de abajo; lo que viene de antes, ni de arriba.
      if (fila > 0) copia.style.marginTop = '0'
    }
    destino.appendChild(copia)
    cadenaPrevia = cadena
    copiasPrevias = copias
  }
  return hoja
}

/**
 * Los dibujos son SVG con clases de Tailwind (`fill-white`, `stroke-marca-300`), y
 * `html-to-image` no lleva el relleno de esas clases: las cajas salían en negro.
 * En la copia se escriben como atributos, ya resueltos.
 */
const PROPIEDADES_SVG = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap',
  'stroke-linejoin', 'stop-color', 'stop-opacity', 'opacity', 'color', 'font-size', 'font-weight', 'font-family',
  'letter-spacing', 'mix-blend-mode',
] as const

function fijarColoresSvg(hoja: HTMLElement) {
  hoja.querySelectorAll<SVGElement>('svg *').forEach((n) => {
    const c = getComputedStyle(n)
    for (const prop of PROPIEDADES_SVG) {
      const v = c.getPropertyValue(prop)
      if (v) n.style.setProperty(prop, v)
    }
  })
}

/** Espera a que las fuentes y los dibujos terminen de pintarse. */
async function esperarPintado() {
  await document.fonts.ready
  await new Promise((r) => setTimeout(r, 900))
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
}

/**
 * Arma el PDF de la sección que está en `articulo`.
 * `alProgresar` recibe cuántas hojas van dibujadas.
 */
export async function generarPdfSeccion(
  articulo: HTMLElement,
  datos: { titulo: string; numero?: string | null },
  alProgresar?: (hechas: number, total: number) => void
): Promise<Blob> {
  await esperarPintado()

  const marco = articulo.getBoundingClientRect()
  const ancho = Math.round(marco.width)

  const hojas = repartir(bloquesDe(articulo))
  if (hojas.length === 0) throw new Error('La sección no tiene contenido para el PDF')

  // Fuera de la vista, pero pintado (con `display:none` no se dibuja nada).
  const taller = document.createElement('div')
  taller.style.cssText = 'position:fixed;left:-20000px;top:0;pointer-events:none;'
  document.body.appendChild(taller)

  const fuentes = await getFontEmbedCSS(articulo).catch(() => undefined)
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pie = [datos.numero, datos.titulo].filter(Boolean).join(' · ')

  try {
    for (let i = 0; i < hojas.length; i++) {
      const hoja = armarHoja(hojas[i].bloques, articulo, ancho)
      taller.replaceChildren(hoja)
      fijarColoresSvg(hoja)
      const escala = 2
      const lienzo = await toCanvas(hoja, {
        pixelRatio: escala,
        backgroundColor: '#ffffff',
        width: ancho,
        fontEmbedCSS: fuentes,
        cacheBust: false,
      })
      // La hoja se dibuja al ancho del artículo y se recorta a lo que ocupan sus bloques.
      const x0 = Math.max(0, hojas[i].izq - marco.left - AIRE)
      const anchoHoja = Math.min(ancho - x0, hojas[i].der - hojas[i].izq + 2 * AIRE)
      const altoPx = hoja.offsetHeight
      const recorte = document.createElement('canvas')
      recorte.width = Math.round(anchoHoja * escala)
      recorte.height = Math.round(altoPx * escala)
      const ctx = recorte.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, recorte.width, recorte.height)
      ctx.drawImage(lienzo, Math.round(x0 * escala), 0, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height)
      const imagen = recorte.toDataURL('image/jpeg', 0.9)
      const pxPorMm = anchoHoja / AREA.ancho
      // Un bloque más alto que la hoja (un dibujo grande) se achica hasta caber.
      let w = AREA.ancho
      let h = altoPx / pxPorMm
      if (h > AREA.alto) {
        w = (AREA.ancho * AREA.alto) / h
        h = AREA.alto
      }
      if (i > 0) pdf.addPage()
      pdf.addImage(imagen, 'JPEG', HOJA.margen + (AREA.ancho - w) / 2, HOJA.margen, w, h, undefined, 'FAST')
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(120, 116, 114)
      const base = HOJA.alto - HOJA.margen + 2
      pdf.text(`Industrias Iberia · Informe · ${pie}`, HOJA.margen, base)
      pdf.text(`Página ${i + 1} de ${hojas.length}`, HOJA.ancho - HOJA.margen, base, { align: 'right' })
      alProgresar?.(i + 1, hojas.length)
    }
  } finally {
    taller.remove()
  }

  return pdf.output('blob')
}
