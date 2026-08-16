/**
 * Lector del guion de Ajito.
 *
 * El guion se escribe en markdown, en `contenido/adiestramiento/`, para que se
 * pueda leer y corregir sin abrir el editor. Pero la aplicación necesita
 * recorrerlo paso por paso, así que aquí se convierte en datos.
 *
 * Esto NO se ejecuta en cada petición: `scripts/generar-guion.mjs` lo corre una
 * vez y deja `contenido/adiestramiento/guion.json`, que es lo que importa la
 * app. El markdown sigue siendo la única fuente — el JSON es su sombra.
 *
 * La notación está en `contenido/adiestramiento/00-reglas-del-guion.md`:
 *
 *     ## 3.2 · La clase          ← un paso
 *
 *     🖼 Tarjeta cuadrada…       ← pieza gráfica
 *     🔊 **Audio 1** · 48 s      ← la clase, seguida de su cita
 *     💬 `Mándame una foto.`     ← la línea de texto
 *     ⌨️ `Vamos` · `Después`     ← botones
 *     🎯 **Ejercicio 1** `selfie` — foto
 *     ↩️ …                       ← devolución, se genera en el momento
 *     *comentario de producción* ← no llega a la app
 */

export type TipoBloque = 'audio' | 'pieza' | 'texto' | 'botones' | 'ejercicio'

export type Bloque =
  | { tipo: 'audio'; id: string; texto: string; segundos: number | null }
  | {
      tipo: 'pieza'
      descripcion: string
      /**
       * Las piezas no son todas iguales y solo una se genera.
       *
       * `ficha` es la de bolsillo: vertical, letra grande, tres líneas, para
       * guardar en la galería del teléfono. Es la única que el guion trae
       * escrita palabra por palabra, y por eso es la única que se puede generar
       * del guion — como los audios. `portada` es la tarjeta cuadrada de la
       * lección, que dentro de la aplicación ya la hace el encabezado. `otra`
       * es todo lo demás: la animación de bienvenida, las fotos autorizadas.
       */
      clase: 'ficha' | 'portada' | 'otra'
      /** El contenido de la ficha. La primera línea es el título. */
      lineas: string[]
      /**
       * `-A`, `-B` o vacío, heredado del audio que la ficha acompaña.
       *
       * La lección 8 se despide de dos maneras según `asistente_libre_activo`, y
       * cada despedida lleva su ficha. La ficha no trae marca propia en el
       * guion —va suelta debajo de su audio—, así que se le pega la del audio
       * que tiene encima. Sin esto, al apagar el interruptor desaparece el audio
       * `6-B` pero se queda su ficha, y la persona oye una despedida y ve la
       * otra.
       */
      sufijo: '' | '-A' | '-B'
    }
  | { tipo: 'texto'; texto: string }
  | { tipo: 'botones'; opciones: string[] }
  | { tipo: 'ejercicio'; indice: number; clave: string | null; nota: string }

export type Paso = {
  /** `3.2` — el número de sección del guion. */
  numero: string
  titulo: string
  bloques: Bloque[]
}

export type LeccionGuion = {
  numero: number
  archivo: string
  titulo: string
  pasos: Paso[]
}

/** Quita el marcado que se lee pero no se pronuncia ni se muestra. */
export function limpiarMarcado(texto: string): string {
  // `[\s\S]` en vez de `.` con la bandera `s`: la negrita del guion cruza
  // líneas y el `target` del proyecto no llega a esa bandera.
  return texto
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/(?<!\w)\*(?!\s)([\s\S]+?)(?<!\s)\*(?!\w)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Recoge la cita que sigue a un marcador, tolerando líneas en blanco. */
function citaDespuesDe(lineas: string[], desde: number): { texto: string; hasta: number } {
  let i = desde
  while (i < lineas.length && lineas[i].trim() === '') i++
  if (i >= lineas.length || !lineas[i].startsWith('>')) return { texto: '', hasta: desde }

  const cita: string[] = []
  while (i < lineas.length && lineas[i].startsWith('>')) {
    cita.push(lineas[i].replace(/^>\s?/, ''))
    i++
  }
  return { texto: limpiarMarcado(cita.join('\n')), hasta: i }
}

/** ¿Esta línea abre un bloque nuevo? Sirve para saber dónde acaba el anterior. */
function esMarcador(linea: string): boolean {
  return /^(🔊|🖼|💬|⌨️|🎯|↩️|🔀|⚠️|>|#{1,6}\s|---)/.test(linea.trim())
}

/** Los `así` de una línea de botones o de texto. */
function entreComillas(linea: string): string[] {
  return [...linea.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean)
}

/**
 * Lee una lección completa.
 *
 * Se para en el encabezado `## Producción`: de ahí para abajo son notas para
 * nosotros, no contenido del curso.
 */
export function leerLeccion(markdown: string, archivo: string): LeccionGuion {
  // Se normaliza el salto de línea antes de nada. Los guiones se editan en
  // Windows y a veces quedan con CRLF; un `\r` colgando al final de la línea
  // hace que ningún `$` de las expresiones de abajo case, y el lector devuelve
  // vacío sin quejarse. Cazarlo cuesta más que prevenirlo.
  const lineas = markdown.replace(/\r\n?/g, '\n').split('\n')
  const numero = Number(archivo.match(/^leccion-(\d+)/)?.[1] ?? -1)
  // El h1 dice «Lección 3 · Ajito ve»; el número ya lo tenemos aparte.
  const titulo = limpiarMarcado(lineas.find((l) => l.startsWith('# '))?.slice(2) ?? '')
    .replace(/^Lección\s+\d+\s+·\s+/, '')

  const pasos: Paso[] = []
  let actual: Paso | null = null
  let ejercicios = 0
  /** El `-A`/`-B` del último audio visto: lo hereda la ficha que venga debajo. */
  let sufijo: '' | '-A' | '-B' = ''

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    const seccion = linea.match(/^##\s+([\d.]+)\s+·\s+(.+)$/)
    if (seccion) {
      actual = { numero: seccion[1], titulo: limpiarMarcado(seccion[2]), bloques: [] }
      pasos.push(actual)
      sufijo = ''
      continue
    }

    // De «## Producción» en adelante son notas internas.
    if (/^##\s+Producción/.test(linea)) break
    if (!actual) continue

    const audio = linea.match(/^🔊\s+\*\*Audio\s+([\w-]+)\*\*(?:\s+·\s+(\d+)\s*s)?/)
    if (audio) {
      const { texto, hasta } = citaDespuesDe(lineas, i + 1)
      if (texto) {
        actual.bloques.push({
          tipo: 'audio',
          id: audio[1],
          texto,
          segundos: audio[2] ? Number(audio[2]) : null,
        })
        sufijo = audio[1].endsWith('-A') ? '-A' : audio[1].endsWith('-B') ? '-B' : ''
        i = hasta - 1
      }
      continue
    }

    if (linea.startsWith('🖼')) {
      // La descripción puede ocupar más de una línea: es un párrafo de Markdown
      // corriente y el editor lo parte donde le toca. Se junta antes de mirarla,
      // porque si no la cita de debajo queda detrás de la continuación y no se
      // encuentra — que es como la ficha de la lección 8 salió vacía sin que
      // nada se quejara.
      let fin = i
      const partes: string[] = [linea.slice(2).trim()]
      while (fin + 1 < lineas.length && lineas[fin + 1].trim() !== '' && !esMarcador(lineas[fin + 1])) {
        fin++
        partes.push(lineas[fin].trim())
      }

      const descripcion = limpiarMarcado(partes.join(' '))
      const esFicha = /^Ficha\b/i.test(descripcion)
      const esPortada = /^(Tarjeta cuadrada|Portada)\b/i.test(descripcion)

      // La ficha lleva su contenido en la cita de debajo, igual que un audio.
      // Se lee de ahí y no de una lista aparte: si el guion dice otra cosa que
      // la imagen, manda el guion — es la misma regla que con los audios.
      const { texto, hasta } = esFicha
        ? citaDespuesDe(lineas, fin + 1)
        : { texto: '', hasta: fin + 1 }

      actual.bloques.push({
        tipo: 'pieza',
        descripcion,
        clase: esFicha ? 'ficha' : esPortada ? 'portada' : 'otra',
        lineas: texto
          ? texto
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean)
          : [],
        sufijo,
      })

      i = (esFicha && texto ? hasta : fin + 1) - 1
      continue
    }

    if (linea.startsWith('💬')) {
      const partes = entreComillas(linea)
      const texto = partes.length ? partes[0] : limpiarMarcado(linea.slice(2).trim())
      if (texto) actual.bloques.push({ tipo: 'texto', texto })
      continue
    }

    if (linea.startsWith('⌨️')) {
      const opciones = entreComillas(linea)
      if (opciones.length) actual.bloques.push({ tipo: 'botones', opciones })
      continue
    }

    // La pregunta de campo va sin «**Ejercicio N**»: es el cierre de la lección,
    // no un ejercicio numerado. Por eso ese trozo es opcional.
    const ejercicio = linea.match(/^🎯\s+(?:\*\*Ejercicio\s+[\w-]+\*\*\s+)?(?:`([\w-]+)`)?\s*(.*)$/)
    if (ejercicio) {
      ejercicios++
      actual.bloques.push({
        tipo: 'ejercicio',
        indice: ejercicios,
        clave: ejercicio[1] ?? null,
        nota: limpiarMarcado(ejercicio[2] ?? '').replace(/^[—–-]\s*/, ''),
      })
      continue
    }

    // 🔀, ↩️, tablas, cursivas de producción y citas sueltas: no llegan a la app.
  }

  return { numero, archivo, titulo, pasos: pasos.filter((p) => p.bloques.length > 0) }
}

/** Todos los audios numerados de una lección, en orden. */
export function audiosDe(leccion: LeccionGuion) {
  return leccion.pasos.flatMap((p) =>
    p.bloques.filter((b): b is Extract<Bloque, { tipo: 'audio' }> => b.tipo === 'audio')
  )
}

/**
 * Las fichas de bolsillo de una lección, con su contenido.
 *
 * Una por lección, al final, y la 8 lleva dos —una por cada despedida, según el
 * interruptor del asistente libre—. Las que no traen líneas escritas no cuentan:
 * una ficha sin texto no se puede dibujar.
 */
export function fichasDe(leccion: LeccionGuion) {
  return leccion.pasos.flatMap((p) =>
    p.bloques.filter(
      (b): b is Extract<Bloque, { tipo: 'pieza' }> =>
        b.tipo === 'pieza' && b.clase === 'ficha' && b.lineas.length > 1
    )
  )
}

/**
 * Un turno: lo que Ajito dice de corrido y lo que espera después.
 *
 * La lección no se entrega de una. El guion está escrito como una conversación
 * —Ajito habla, tú tocas un botón, Ajito sigue— y esa es la unidad: **un turno
 * va desde donde se quedó hasta el próximo botón o ejercicio**, que es donde
 * Ajito se calla y espera.
 *
 * Los pasos del guion (`3.4 · Ahora un compañero`) son secciones para leer el
 * documento; un mismo paso puede tener dos turnos, con un ejercicio en medio.
 */
export type Turno = {
  /** Su posición en la lección. Es lo que se guarda en `avances.paso`. */
  indice: number
  /** Cómo se rotula el audio. Sale de la sección donde vive ese audio. */
  titulo: string
  /** Este turno parte una sección por la mitad: Ajito retoma, no empieza. */
  continuacion: boolean
  /** Lo que Ajito suelta antes de callarse. */
  bloques: Bloque[]
  /** Qué espera al final: botones, un ejercicio, o nada si es el último. */
  espera:
    | { tipo: 'botones'; opciones: string[] }
    | { tipo: 'ejercicio'; clave: string | null }
    | { tipo: 'nada' }
}

export function turnosDe(leccion: LeccionGuion): Turno[] {
  // Se aplana con la sección de cada bloque a cuestas: un turno puede cruzar de
  // una sección a otra, y el rótulo tiene que salir de dónde está el audio.
  const planos = leccion.pasos.flatMap((p) =>
    p.bloques.map((bloque) => ({ bloque, paso: p.numero, titulo: p.titulo }))
  )

  const turnos: Turno[] = []
  let acumulado: typeof planos = []
  let pasoAnterior: string | null = null

  function cerrar(espera: Turno['espera']) {
    if (!acumulado.length && espera.tipo === 'nada') return

    // El rótulo sale de la sección del primer audio. Si se tomara la del primer
    // bloque, un turno que arranca con la portada —que solo lleva una imagen—
    // rotularía la clase como «Portada».
    const conAudio = acumulado.find((x) => x.bloque.tipo === 'audio')
    const fuente = conAudio ?? acumulado[0]

    turnos.push({
      indice: turnos.length,
      titulo: fuente?.titulo ?? '',
      // Si la sección ya venía sonando en el turno anterior, Ajito no está
      // empezando algo: está retomando. Repetir el título ahí parece un error.
      continuacion: !!fuente && fuente.paso === pasoAnterior,
      bloques: acumulado.map((x) => x.bloque),
      espera,
    })

    if (fuente) pasoAnterior = acumulado[acumulado.length - 1].paso
    acumulado = []
  }

  for (const plano of planos) {
    if (plano.bloque.tipo === 'botones') {
      cerrar({ tipo: 'botones', opciones: plano.bloque.opciones })
      continue
    }
    if (plano.bloque.tipo === 'ejercicio') {
      cerrar({ tipo: 'ejercicio', clave: plano.bloque.clave })
      continue
    }
    acumulado.push(plano)
  }

  // Lo que quede después del último botón es el cierre: no espera nada, de ahí
  // se pasa a terminar la lección.
  cerrar({ tipo: 'nada' })

  return turnos
}

/**
 * En qué turno vive un ejercicio. Lo usa la acción de responder para saber
 * hasta dónde adelantar sin que el navegador le diga el número.
 */
export function turnoDelEjercicio(leccion: LeccionGuion, clave: string): number | null {
  const turno = turnosDe(leccion).find(
    (t) => t.espera.tipo === 'ejercicio' && t.espera.clave === clave
  )
  return turno ? turno.indice : null
}

/** «Sigo después», «Pausar por ahora»: se sale, no se avanza. */
export function esSalida(opcion: string): boolean {
  return /despu[eé]s|ma[ñn]ana|pausar/i.test(opcion)
}

/**
 * Descarta el cierre que no toca.
 *
 * La lección 8 tiene dos despedidas escritas —`Audio 6-A` si Ajito se va,
 * `Audio 6-B` si se queda— y el guion las lleva las dos seguidas porque en el
 * documento hay que poder leer ambas. En la aplicación solo suena una, la que
 * diga `cursos.asistente_libre_activo`.
 *
 * Por convención: sufijo `-A` es el interruptor apagado, `-B` encendido.
 */
export function segunInterruptor(bloques: Bloque[], asistenteLibre: boolean): Bloque[] {
  return bloques.filter((b) => {
    // La ficha lleva el sufijo del audio que acompaña, así que la despedida y su
    // ficha entran o salen juntas. Antes se filtraba solo el audio y quedaba una
    // ficha huérfana: se oía una despedida y se veía la otra.
    const marca = b.tipo === 'audio' ? b.id : b.tipo === 'pieza' ? b.sufijo : ''
    if (marca.endsWith('-A')) return !asistenteLibre
    if (marca.endsWith('-B')) return asistenteLibre
    return true
  })
}
