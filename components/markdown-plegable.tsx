'use client'

import { useEffect, useRef } from 'react'
import { Markdown } from '@/components/markdown'
import { normalizarNombre } from '@/lib/rehype-informe'

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

  // ⚠️ **Todos los padres, no el primero.** Desde que cada ficha tiene su propio
  // `<details>` dentro del de su nivel, un ancla puede estar a dos niveles de
  // profundidad: abrir solo el más cercano deja el bloque del nivel cerrado y el
  // salto vuelve a caer sobre un elemento sin altura.
  for (let n = destino.closest('details'); n; n = n.parentElement?.closest('details') ?? null) {
    if (!n.open) n.open = true
  }

  // ⚠️ **Si el ancla es el título de una ficha o de un nivel, se salta a su barra,
  // no al encabezado de adentro.** El `###` que lleva el id va dentro del cuerpo,
  // debajo del resumen plegable: saltando a él, la barra con el nombre de la ficha
  // quedaba escondida arriba y parecía que se había caído más abajo de donde
  // empieza, y había que subir con la rueda. La barra lleva su `scroll-margin-top`
  // para no quedar debajo de la cabecera fija.
  const contenedor = destino.closest('details')
  const esSuTitulo =
    contenedor?.querySelector(':scope > .plegable-cuerpo > .prosa > :first-child') === destino
  const objetivo = contenedor && esSuTitulo ? contenedor : destino

  // El salto se rehace tras abrir: el intento del navegador, si lo hubo, cayó
  // sobre un elemento que todavía no tenía altura.
  requestAnimationFrame(() => objetivo.scrollIntoView({ block: 'start' }))
}

type Ficha = { titulo: string; cuerpo: string }
type Nivel = { titulo: string; cuerpo: string; fichas: Ficha[] }

export function MarkdownPlegable({
  contenido,
  className,
  nuevos,
}: {
  contenido: string
  className?: string
  /** Procesos y macroprocesos nuevos, normalizados: llevan su marca. */
  nuevos?: string[]
}) {
  const esNuevo = (titulo: string) =>
    Boolean(nuevos?.includes(normalizarNombre(titulo.replace(/^[\d.]+\s*·\s*/, ''))))
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

      {/* Abrir y cerrar todo.
          ⚠️ **Actúa sobre el DOM y no sobre un estado de React**, igual que
          `revelarAncla`: el `open` de un `<details>` lo maneja el navegador
          cuando el usuario pulsa el resumen, así que llevarlo también en estado
          daría dos versiones de la verdad —y la de React se impondría al primer
          re-render, cerrando lo que alguien acababa de abrir a mano. */}
      <div className="plegable-mandos">
        <button type="button" onClick={() => abrirTodo(caja.current, true)}>
          Expandir todo
        </button>
        <button type="button" onClick={() => abrirTodo(caja.current, false)}>
          Colapsar todo
        </button>
      </div>

      {/* **Dos niveles de plegado, y los dos cerrados de entrada.** El nivel
          agrupa —Estratégico, Operativo, Soporte— y dentro cada ficha tiene el
          suyo: abrir «Operativo» daba nueve fichas de golpe, que es otra vez la
          página de corrido que el plegado venía a evitar.

          ⚠️ El ancla sigue funcionando porque `revelarAncla` abre **todos** los
          `<details>` que contienen el destino, no solo el primero. */}
      {bloques.slice(1).map((b) => (
        <details key={b.titulo} className={`plegable ${claseDeNivel(b.titulo)}`.trim()}>
          <summary>
            <span className="plegable-titulo">{b.titulo}</span>
            <span className="plegable-cuenta">
              {b.fichas.length} {b.fichas.length === 1 ? 'ficha' : 'fichas'}
            </span>
          </summary>
          <div className="plegable-cuerpo">
            {/* El encabezado del nivel, para que el ancla del nivel exista. */}
            <Markdown contenido={`## ${b.titulo}\n\n${b.cuerpo}`} className={className} nuevos={nuevos} />

            {b.fichas.map((f) => (
              <details key={f.titulo} className="plegable plegable-ficha">
                <summary>
                  <span className="plegable-titulo">
                    {f.titulo}
                    {esNuevo(f.titulo) && <span className="marca-nuevo ml-2 align-middle">Nuevo</span>}
                  </span>
                </summary>
                <div className="plegable-cuerpo">
                  <Markdown contenido={`### ${f.titulo}\n\n${f.cuerpo}`} className={className} nuevos={nuevos} />
                </div>
              </details>
            ))}
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
function partirPorNivel2(md: string): Nivel[] {
  const bloques: Nivel[] = [{ titulo: '', cuerpo: '', fichas: [] }]
  let enCodigo = false

  for (const linea of md.split('\n')) {
    if (linea.trimStart().startsWith('```')) enCodigo = !enCodigo

    const h2 = !enCodigo && /^## (?!#)(.+)$/.exec(linea)
    if (h2) {
      bloques.push({ titulo: h2[1].trim(), cuerpo: '', fichas: [] })
      continue
    }

    const actual = bloques[bloques.length - 1]
    const h3 = !enCodigo && /^### (?!#)(.+)$/.exec(linea)
    if (h3) {
      // Una ficha nueva. Su cuerpo se va llenando con lo que venga hasta el
      // próximo `###` o el próximo `##`.
      actual.fichas.push({ titulo: h3[1].trim(), cuerpo: '' })
      continue
    }

    const ficha = actual.fichas[actual.fichas.length - 1]
    if (ficha) ficha.cuerpo += linea + '\n'
    else actual.cuerpo += linea + '\n'
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

/**
 * Abre o cierra **todos** los bloques de la sección, los de nivel y los de cada
 * ficha. Veinte fichas en tres niveles son veintitrés chevrones: buscarlos uno a
 * uno para imprimir, o para leer de corrido, es justo lo que el plegado hace
 * incómodo.
 */
function abrirTodo(raiz: HTMLElement | null, abierto: boolean) {
  if (!raiz) return
  for (const d of Array.from(raiz.querySelectorAll('details'))) d.open = abierto
}