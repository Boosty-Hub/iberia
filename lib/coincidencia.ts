/**
 * Qué ficha del padrón es de una cuenta, por el nombre.
 *
 * Una cuenta creada desde Usuarios no sabe quién es en el padrón, y el canal
 * cuelga todo de la ficha. Para enlazarla, el panel propone la ficha que mejor
 * coincide con el nombre de la cuenta —«Martha Alvarez» → «Martha Elena Alvarez
 * Trejo»— y quien administra la confirma. **Solo propone**: con 276 personas hay
 * homónimos, y enlazar a la persona equivocada le daría su canal a otra.
 */

/** «Álvarez» → «alvarez»: sin tildes, sin mayúsculas, en palabras. */
export function palabras(nombre: string): string[] {
  return nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-zñ]+/)
    .filter((p) => p.length > 1)
}

/**
 * La ficha cuyo nombre contiene más palabras del nombre de la cuenta, si son al
 * menos dos —un nombre y un apellido—.
 *
 * ⚠️ **Hay gente dos veces en el padrón**: las fichas que se cargaron a mano en
 * agosto, antes del listado de Capital Humano —los directivos y las de muestra,
 * sin número de ficha—, y la del listado. En un empate gana la que trae número de
 * ficha, que es la de Capital Humano. Si siguen empatadas, no propone nada: mejor
 * elegir a mano que enlazar mal.
 */
export function mejorFicha<T extends { id: string; nombre_completo: string; ficha: string | null }>(
  nombre: string | null,
  fichas: T[]
): T | null {
  const buscadas = new Set(palabras(nombre ?? ''))
  if (buscadas.size < 2) return null

  let puntos = 1
  let mejores: T[] = []
  for (const ficha of fichas) {
    const suyas = new Set(palabras(ficha.nombre_completo))
    let n = 0
    for (const p of buscadas) if (suyas.has(p)) n++
    if (n > puntos) {
      puntos = n
      mejores = [ficha]
    } else if (n === puntos && n > 1) {
      mejores.push(ficha)
    }
  }

  if (mejores.length === 1) return mejores[0]
  const deCapitalHumano = mejores.filter((f) => f.ficha)
  return deCapitalHumano.length === 1 ? deCapitalHumano[0] : null
}
