'use client'

import { useEffect, useRef } from 'react'
import { Markdown } from '@/components/markdown'

/**
 * El markdown de una sección, plegado por sus encabezados de nivel 2.
 *
 * Existe para «Las fichas de proceso», que son veinte macroprocesos en una sola
 * página: cincuenta mil caracteres de corrido, sin forma de saltar a lo que uno
 * busca. Plegado por nivel —Estratégico, Operativo, Soporte— la página cabe en
 * una pantalla y cada bloque se abre cuando hace falta.
 *
 * ⚠️ **El riesgo de plegar no es visual, son las anclas.** A las fichas apuntan
 * veinte enlaces desde el mapa de procesos, que es *otra página*, y esos enlaces
 * caen dentro de un bloque que puede estar cerrado. Por eso el componente abre
 * el bloque que contiene el ancla del `#hash` antes de dejar que el navegador
 * haga su salto, tanto al cargar como al cambiar el hash. Sin eso, el enlace
 * llevaría a la página correcta y a ningún sitio dentro de ella — que es
 * exactamente la clase de fallo que no da error.
 */
/**
 * Abre el bloque plegado que contiene un id y salta hasta él.
 *
 * Se exporta porque **el índice lateral también la necesita**: sus enlaces
 * apuntan a anclas de esta misma página, y ahí el navegador no hace nada por su
 * cuenta (ver abajo).
 */
export function revelarAncla(id: string) {
  if (!id) return
  // `getElementById` encuentra el destino aunque el bloque esté cerrado: el
  // contenido está en el DOM, solo oculto.
  const destino = document.getElementById(id)
  if (!destino) return

  const bloque = destino.closest('details')
  if (bloque && !bloque.open) bloque.open = true

  // El salto se rehace tras abrir: el intento del navegador, si lo hubo, cayó
  // sobre un elemento que todavía no tenía altura.
  requestAnimationFrame(() => destino.scrollIntoView({ block: 'start' }))
}

export function MarkdownPlegable({
  contenido,
  className,
}: {
  contenido: string
  className?: string
}) {
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const porHash = () => revelarAncla(decodeURIComponent(window.location.hash.slice(1)))
    porHash()
    window.addEventListener('hashchange', porHash)

    // Quien llega desde el mapa interactivo viene por un proceso concreto, no
    // por la ficha. El ancla lo deja en el encabezado del macroproceso; esto lo
    // lleva hasta su fila.
    const buscado = new URLSearchParams(window.location.search).get('proceso')
    if (buscado) senalarProceso(buscado)

    return () => window.removeEventListener('hashchange', porHash)
  }, [])

  const bloques = partirPorNivel2(contenido)

  // Sin encabezados de nivel 2 no hay nada que plegar, y plegar la sección
  // entera en un solo bloque no ayuda a nadie.
  if (bloques.length < 2) return <Markdown contenido={contenido} className={className} />

  return (
    <div ref={caja}>
      {bloques[0].cuerpo.trim() && <Markdown contenido={bloques[0].cuerpo} className={className} />}

      {/* Cerrados de entrada: la sección son veinte fichas y el objetivo es que
          quepa en una pantalla y se elija qué leer. Un ancla externa abre su
          bloque sola, y de eso se encarga el efecto de arriba. */}
      {bloques.slice(1).map((b) => (
        <details key={b.titulo} className={`plegable ${claseDeNivel(b.titulo)}`.trim()}>
          <summary>
            <span className="plegable-titulo">{b.titulo}</span>
            <span className="plegable-cuenta">
              {b.fichas} {b.fichas === 1 ? 'ficha' : 'fichas'}
            </span>
          </summary>
          <div className="plegable-cuerpo">
            <Markdown contenido={`## ${b.titulo}\n\n${b.cuerpo}`} className={className} />
          </div>
        </details>
      ))}
    </div>
  )
}

/**
 * Parte el markdown por sus `##`. El primer trozo es lo que va antes del primer
 * encabezado —la entrada de la sección— y se queda fuera del plegado.
 *
 * ⚠️ Ignora los `##` que estén dentro de un bloque de código: en este documento
 * hay diagramas en bloques ``` y una línea suya que empiece por `##` partiría la
 * sección por la mitad.
 */
function partirPorNivel2(md: string) {
  const bloques: { titulo: string; cuerpo: string; fichas: number }[] = [
    { titulo: '', cuerpo: '', fichas: 0 },
  ]
  let enCodigo = false

  for (const linea of md.split('\n')) {
    if (linea.trimStart().startsWith('```')) enCodigo = !enCodigo

    const h2 = !enCodigo && /^## (?!#)(.+)$/.exec(linea)
    if (h2) {
      bloques.push({ titulo: h2[1].trim(), cuerpo: '', fichas: 0 })
      continue
    }

    const actual = bloques[bloques.length - 1]
    if (!enCodigo && /^### /.test(linea)) actual.fichas++
    actual.cuerpo += linea + '\n'
  }

  return bloques
}

/**
 * La clase de tinte que le toca a un bloque, deducida de su título.
 *
 * Los títulos vienen numerados del generador —«1 · Estratégico»— y esa
 * numeración sale del propio inventario, así que **no se puede tintar por
 * posición**: si mañana se reordenan los niveles, el color seguiría al sitio y
 * no a la categoría. Se deduce del nombre, sin acentos ni mayúsculas.
 *
 * Una categoría que no esté en la lista se queda con el gris de `.plegable`, que
 * es un bloque perfectamente legible — no un fallo visible.
 */
function claseDeNivel(titulo: string) {
  const limpio = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  if (limpio.includes('estrategico')) return 'plegable-estrategico'
  if (limpio.includes('operativo')) return 'plegable-operativo'
  if (limpio.includes('soporte')) return 'plegable-soporte'
  return ''
}

/**
 * Resalta la fila del proceso al que se llegó desde el mapa, y salta hasta ella.
 *
 * ⚠️ **Se busca por texto porque no hay otra cosa por la que buscar.** Los
 * procesos viven como filas de una tabla del markdown, y las tablas no producen
 * anclas —`rehype-slug` solo trabaja sobre encabezados—. Darles una exigiría
 * HTML crudo, que el renderizador descarta.
 *
 * Por eso compara el nombre normalizado contra la primera casilla de cada fila.
 * Si no lo encuentra **no hace nada y no avisa**: el lector se queda en la ficha
 * del macroproceso, que es a donde el enlace lo llevó de todos modos.
 */
function senalarProceso(nombre: string) {
  const objetivo = normalizar(nombre)
  if (!objetivo) return

  requestAnimationFrame(() => {
    for (const fila of Array.from(document.querySelectorAll('table tbody tr'))) {
      const celda = fila.querySelector('td')
      if (!celda || normalizar(celda.textContent ?? '') !== objetivo) continue

      const bloque = fila.closest('details')
      if (bloque && !bloque.open) bloque.open = true

      fila.classList.add('proceso-senalado')
      requestAnimationFrame(() => fila.scrollIntoView({ block: 'center' }))
      // Se apaga solo: un resaltado permanente se confunde con un estado del
      // documento, y esto es «venías buscando esto».
      window.setTimeout(() => fila.classList.remove('proceso-senalado'), 2600)
      return
    }
  })
}

function normalizar(t: string) {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}
