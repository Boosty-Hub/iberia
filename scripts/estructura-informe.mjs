/**
 * La estructura del Documento de Arquitectura de IA, y las secciones que se
 * pueden llenar solas.
 *
 *   npm run informe:estructura
 *   npm run informe:estructura -- --revisar   # dice qué haría, sin escribir
 *   npm run informe:estructura -- --rehacer   # reescribe la prosa desde el taller
 *   npm run informe:estructura -- --podar     # borra las huérfanas que estén vacías
 *
 * Hace tres cosas y en este orden importa:
 *
 *  1. **La estructura.** Crea o actualiza las 13 secciones con su número, parte y
 *     subtítulo. Idempotente por `slug`. Las que quedan fuera del armazón no se
 *     borran solas: `--podar` se lleva las vacías y **nunca** las que tienen texto.
 *  2. **Las secciones de datos** se **regeneran siempre**: son el reflejo del
 *     dato, no prosa. Si alguien las edita a mano, la próxima corrida las pisa, y
 *     así debe ser. Son los anexos que salen de la base y, desde el armazón del
 *     16 de septiembre, el **mapa de procesos**, las **veinte fichas** y su anexo,
 *     que salen del inventario V2. ⚠️ Una generadora sin fuente **no escribe**:
 *     devolver `null` guardaba la sección vacía y borraba lo que ya estaba.
 *  3. **Las secciones de prosa** salen de `contenido/informe/`, que es el taller
 *     donde se redactan, y se escriben **solo si están vacías**. En cuanto alguien
 *     las toca desde `/dashboard/informe`, el editor manda. Con `--rehacer` se
 *     fuerza a traerlas otra vez del taller, pisando lo que haya.
 *
 * Todo entra **sin publicar**. Un lector de Iberia no ve nada de esto hasta que
 * alguien lo publique a mano: los hallazgos que lo sostienen todavía están
 * propuestos, no validados.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import GithubSlugger from 'github-slugger'
import { resolve } from 'node:path'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

const revisar = process.argv.includes('--revisar')
// Fuerza a reescribir las secciones de prosa desde el taller, pisando lo que
// haya en el editor. Solo cuando se quiere justamente eso.
const rehacer = process.argv.includes('--rehacer')
// Borra las secciones que quedaron fuera del armazón nuevo **y están vacías**.
// Las huérfanas con texto no se borran ni con esto.
const podar = process.argv.includes('--podar')

// =============================================================================
// 1) LA ESTRUCTURA
// =============================================================================

const SECCIONES = [
  // --- Apertura --------------------------------------------------------------
  // ⚠️ **No es un resumen ejecutivo, y es a propósito.** Lo fue hasta el 18 de
  // septiembre de 2026: nueve mil caracteres de síntesis que repetían, más
  // corto, lo que los capítulos dicen entero. Ahora es una portada — de qué va
  // el encargo, cuánto se cubrió y cuál es el mapa— y las conclusiones se leen
  // donde se argumentan. La prosa del resumen sigue en el taller por si vuelve.
  ['portada', 'inicio', 'Inicio', 'El encargo, lo que se cubrió y el mapa de la operación'],

  // --- Levantamiento ---------------------------------------------------------
  // El orden es el del argumento, y va por pares: una sección afirma y la
  // siguiente la respalda. Cobertura dice cuánto se escuchó y las cifras qué se
  // midió; «Sistemas y estado del dato» argumenta y el inventario lo enseña.
  ['levantamiento', 'mapa-procesos', 'El mapa de procesos', 'El índice vivo: veinte macroprocesos y los procesos que se ejecutan hoy'],
  // Absorbe el informe de levantamiento por área: la ficha corta por proceso y
  // lleva dentro «Quién lo contó». Dos cortes del mismo material se
  // desincronizan en cuanto alguien edita uno.
  ['levantamiento', 'fichas-procesos', 'Las fichas de proceso', 'Una por macroproceso: qué hace, quién lo ejecuta, con qué sistemas y qué le falta'],
  ['levantamiento', 'sistemas-datos', 'Sistemas y estado del dato', 'Qué vive en el ERP, qué vive fuera y qué dato es confiable'],
  ['levantamiento', 'inventario-sistemas', 'Inventario de sistemas', 'Sistema por sistema, con su dueño, su estado y cuánto se apoya la operación en él'],
  // ⚠️ El subtítulo **no lleva el número de sesiones**, y es a propósito: lo
  // llevaba —decía «treinta y cuatro», cuando son diecisiete— y un subtítulo es
  // texto fijo que nadie recuerda corregir cuando el conteo cambia. La cifra
  // auditada vive en la primera línea del capítulo, que la calcula el generador.
  ['levantamiento', 'riesgo-continuidad', 'Riesgo y continuidad', 'El incidente de febrero: qué se perdió, qué volvió y qué sigue abierto'],
  // Dónde se traba el trabajo y su inventario. Entran en pareja, como manda la
  // regla: el primero afirma los patrones y el segundo los enseña uno por uno.
  // ⚠️ Existieron en el armazón de 32 como «Cuellos de botella y trabajo
  // manual» y se cortaron el 16 de septiembre. Vuelven porque entre «esto está
  // mal» y «hagamos esto» faltaba cuantificar el dolor, que es lo que un comité
  // pregunta antes de aprobar un presupuesto.
  ['levantamiento', 'trabas', 'Dónde se traba el trabajo', 'Los patrones que se repiten, con su costo en tiempo y margen'],
  // La bisagra: todo lo anterior los construye, todo lo posterior actúa sobre ellos.
  ['levantamiento', 'hallazgos', 'Los hallazgos', 'Los siete patrones del diagnóstico, y los cuarenta y dos hallazgos que los sostienen'],

  // --- Arquitectura ----------------------------------------------------------
  // Primero qué se puede hacer y qué no, después con qué reglas, y solo entonces
  // el plano. Al revés, el plano parece la respuesta antes de la pregunta.
  ['arquitectura', 'oportunidades', 'Las oportunidades, priorizadas', 'Impacto, costo, dependencias y disponibilidad del dato'],
  ['arquitectura', 'donde-no-va-la-ia', 'Dónde no va la IA', 'Lo que se resuelve sin un modelo, y por qué decirlo importa'],
  ['arquitectura', 'arquitectura-ia', 'La arquitectura propuesta', 'El plano completo: capas, flujos de datos y conexiones al núcleo'],
  ['arquitectura', 'hoja-de-ruta', 'Hoja de ruta', 'Fases siguientes: secuencia, dependencias y puntos de control'],
]

/**
 * Las referencias de un capítulo a otro, resueltas en la corrida.
 *
 * ⚠️ **Los números de capítulo no se escriben en el taller.** Llegó a haber
 * treinta y nueve «capítulo 9», «capítulo 11»… repartidos en diez archivos, y
 * bastaba insertar una sección para que todos apuntaran a otra cosa **sin que
 * nada avisara**. Ahora se escribe `{cap:hallazgos}` y aquí se convierte en
 * «capítulo 11», con el número que tenga hoy. Si el slug no existe, se avisa en
 * vez de publicar una referencia muerta.
 */
const NUMERO_DE_SLUG = new Map(
  SECCIONES.map(([, slug], i) => [slug, String(i + 1)])
)

function resolverCapitulos(md, etiqueta) {
  const malas = []
  const salida = md.replace(/\{cap:([a-z0-9-]+)\}/g, (_, slug) => {
    const n = NUMERO_DE_SLUG.get(slug)
    if (!n) {
      malas.push(slug)
      return 'ese capítulo'
    }
    return `capítulo ${n}`
  })
  if (malas.length) {
    console.warn(`  ⚠️ ${etiqueta}: referencia a un capítulo que no existe: ${[...new Set(malas)].join(', ')}`)
  }
  return salida
}

// =============================================================================
// 2) LAS SECCIONES QUE SE GENERAN DE LA BASE
// =============================================================================

const SEDES = { caracas: 'Caracas', cagua: 'Planta Cagua', remoto: 'Remoto' }

function fecha(iso) {
  if (!iso) return '—'
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

async function anexoInventario() {
  const { data: sistemas } = await admin
    .from('hallazgos')
    .select('titulo, descripcion, cita_textual, estado, areas(nombre), entrevistas(codigo, entrevistado_nombre)')
    .eq('tipo', 'sistema')
    .order('titulo')

  const { data: archivos } = await admin
    .from('archivos')
    .select('nombre, descripcion, categoria')
    .order('created_at')

  const filasSistemas = (sistemas ?? []).map(
    (s) =>
      `| **${s.titulo}** | ${s.areas?.nombre ?? '—'} | ${(s.descripcion ?? '').replace(/\n/g, ' ')} | ${s.entrevistas?.codigo ?? '—'} |`
  )

  const filasArchivos = (archivos ?? []).map(
    (a) => `| ${a.nombre} | ${a.categoria} | ${(a.descripcion ?? '').replace(/\n/g, ' ')} |`
  )

  return `Dos inventarios: los **sistemas** que la organización nombra al describir su
propio trabajo, y los **documentos** que sostienen este levantamiento.

El inventario de sistemas no se levantó aparte: se cosechó de las entrevistas. Cada
entrada es un sistema que alguien nombró al contar cómo hace su trabajo, con la sesión
donde se dijo. Eso significa que **es el sistema visto por quien lo usa, no por quien lo
mantiene** — la entrevista con Tecnología de la Información es la que cierra este anexo.

## Sistemas nombrados en el levantamiento · ${filasSistemas.length}

| Sistema | Área | Qué es | Sesión |
|---|---|---|---|
${filasSistemas.join('\n') || '| — | — | Todavía sin cosechar | — |'}

## Documentos del expediente · ${filasArchivos.length}

| Documento | Categoría | Qué contiene |
|---|---|---|
${filasArchivos.join('\n') || '| — | — | — |'}`
}


// =============================================================================
// 3) LOS HALLAZGOS REDACTADOS
//
// `contenido/informe/` es el taller: ahí se escribe y ahí se corrige. Este
// bloque los reparte por las secciones del informe según `MAPA.md`, que es quien
// decide dónde vive cada hallazgo — el orden temático con que se redactaron es
// bueno para leerlos de corrido, pero el entregable manda otra estructura.
//
// Las 236 observaciones en crudo **no** vienen acá: viven en `/dashboard/hallazgos`,
// que es la mesa de trabajo. Al informe solo llega lo redactado.
// =============================================================================

const TALLER = 'contenido/informe'

function leerTaller(archivo) {
  try {
    return readFileSync(resolve(TALLER, archivo), 'utf8')
  } catch {
    return null
  }
}

/**
 * Quita el título de nivel 1 y la línea de identificación que va debajo — en el
 * informe esa portada ya la pone la sección.
 *
 * Se quitan **solo esas dos líneas**. La primera versión cortaba hasta el
 * siguiente `##` y en `CITAS.md`, que no tiene ninguno, se comió el archivo
 * entero y dejó la sección vacía; en `NUMEROS.md` se llevó el párrafo de
 * entrada. Al recortar por estructura hay que recortar lo mínimo.
 */
function sinPortada(md) {
  return md
    .replace(/^#\s.*\n/, '')
    .replace(/^\s*\*\*Industrias Iberia[^\n]*\n/, '')
    .replace(/^\s*-{3,}\s*\n/, '')
    .trim()
}

/** De nombre de sección del mapa al slug del informe. */
const SLUG_DE_SECCION = {
  'De quién depende cada proceso': 'dependencias',
  'Del pedido al cobro': 'procesos-clave',
  'Sistemas, datos y conectividad': 'sistemas-datos',
  'El estado del dato': 'estado-del-dato',
  'Cuellos de botella y trabajo manual': 'cuellos-botella',
  'Madurez digital y disposición al cambio': 'madurez',
  'Restricciones y condiciones de borde': 'restricciones',
  'Dónde no va la IA': 'donde-no-va-la-ia',
}

/** Los hallazgos, partidos por su encabezado `### H-nn`. */
function partirHallazgos(md) {
  if (!md) return new Map()
  const bloques = new Map()
  const partes = md.split(/^### (?=H-\d+)/m).slice(1)
  for (const bloque of partes) {
    const clave = bloque.match(/^(H-\d+)/)?.[1]
    if (clave) bloques.set(clave, `### ${bloque.trim()}`)
  }
  return bloques
}

/** El reparto de `MAPA.md`: qué hallazgo va a qué slug. */
function leerMapa(md) {
  if (!md) return new Map()
  const reparto = new Map()
  for (const [, clave, seccion] of md.matchAll(/^\|\s*(H-\d+)\s*·[^|]*\|\s*([^|]+?)\s*\|/gm)) {
    const slug = SLUG_DE_SECCION[seccion.trim()]
    if (slug) (reparto.get(slug) ?? reparto.set(slug, []).get(slug)).push(clave)
  }
  return reparto
}

const HALLAZGOS = partirHallazgos(leerTaller('HALLAZGOS.md'))
const REPARTO = leerMapa(leerTaller('MAPA.md'))

/** Los hallazgos de una sección, en orden, listos para pegar. */
function hallazgosDe(slug) {
  const claves = REPARTO.get(slug) ?? []
  const bloques = claves.map((c) => HALLAZGOS.get(c)).filter(Boolean)
  return bloques.length ? bloques.join('\n\n') : null
}

/** El índice de los veintiocho, para el anexo. */
function indiceDeHallazgos() {
  const titulos = new Map()
  for (const [clave, bloque] of HALLAZGOS) {
    titulos.set(clave, bloque.match(/^### H-\d+ · (.+)$/m)?.[1] ?? '')
  }
  const seccionDe = new Map()
  for (const [slug, claves] of REPARTO) {
    const nombre = Object.entries(SLUG_DE_SECCION).find(([, s]) => s === slug)?.[0] ?? slug
    for (const c of claves) seccionDe.set(c, nombre)
  }
  const filas = [...titulos.entries()]
    .sort()
    .map(([c, titulo]) => `| **${c}** | ${titulo} | ${seccionDe.get(c) ?? '—'} |`)

  // Sin `HALLAZGOS.md` en el taller la tabla sale vacía, y un anexo con la
  // introducción y cero filas no es un anexo: es el anterior, borrado. Sin
  // hallazgos que indexar no se escribe nada y se conserva lo que hubiera.
  if (!filas.length) return null

  return `Los veintiocho hallazgos redactados de la primera ronda, con la sección del informe
donde vive cada uno. Se numeran de corrido para poder citarlos en las reuniones y en el
plan de las fases siguientes: «lo de H-04» tiene que querer decir lo mismo para todo el
mundo.

Las **236 observaciones en crudo** de las que salieron estos veintiocho están en el panel
del levantamiento, cada una con su cita y su sesión. No se traen acá a propósito: un anexo
con doscientas treinta y seis fichas no lo lee nadie, y el trabajo de este informe fue
justamente escoger.

| | Hallazgo | Sección |
|---|---|---|
${filas.join('\n')}`
}

// =============================================================================
// 4) EL PRIMER BORRADOR DE LAS SECCIONES DE PROSA
//    Solo se escribe si la sección está vacía.
// =============================================================================

async function borradorMetodo() {
  const { count: entrevistas } = await admin
    .from('entrevistas')
    .select('*', { count: 'exact', head: true })
    .eq('tipo', 'entrevista')
  const { count: turnos } = await admin
    .from('transcripcion_segmentos')
    .select('*', { count: 'exact', head: true })
  return `Este informe no se escribió desde la experiencia de quien lo firma. Se escribió
desde lo que dijo la gente que hace el trabajo, y cada afirmación lleva la cita que la
sostiene.

## De dónde sale lo que aquí se afirma

**${entrevistas} entrevistas estructuradas** con directores, gerentes, jefes y
coordinadores, más las reuniones del comité gerencial, los recorridos de la Planta de Cagua
y las sesiones de formación. En total,
**${(turnos ?? 0).toLocaleString('es-VE')} turnos de conversación transcritos**.

De lo leído hasta ahora se extrajeron **${hallazgos} hallazgos**, cada uno con su cita
textual y la sesión donde se dijo. La cosecha va por detrás de la transcripción: no todas
las sesiones están leídas todavía.

Las entrevistas se hicieron en el puesto de trabajo de cada quien, en dos pistas
simultáneas para no ocupar la planta más de un día por ronda. No se usó cuestionario
cerrado: la conversación siguió el flujo real del trabajo —cómo entra, qué se hace con
ello, a quién se le pasa— y de ahí salieron los sistemas, los archivos y las esperas que
nadie habría nombrado si se le pregunta directamente por «sus problemas».

## Cómo se leyó

De cada sesión se extrajeron hallazgos de siete tipos, que son también la estructura del
razonamiento de este informe:

| Tipo | Qué recoge |
|---|---|
| **Cuello de botella** | Lo que traba el flujo, hace esperar o limita la capacidad |
| **Trabajo manual repetitivo** | Lo que hoy hace una persona a mano y podría no hacerse |
| **Dato disponible** | El dato que ya existe y está capturado — lo que hace posible un módulo |
| **Sistema** | Cada sistema, aplicación o archivo nombrado, con quién lo usa |
| **Oportunidad de IA** | Dónde la IA aportaría, derivado de los tres anteriores |
| **Riesgo** | Dependencias de una persona, fragilidades y temas de seguridad |
| **Supuesto por validar** | Lo que la dirección tiene que confirmar antes de dimensionar |

## Lo que este método no puede darle

- **No mide, escucha.** Cuando este informe dice que un proceso tarda dos días, es porque
  quien lo ejecuta lo dijo. Las cifras que sustenten inversión se verifican contra el
  sistema antes de comprometerlas.
- **No cubre todavía toda la organización.** El levantamiento sigue abierto: las áreas que
  faltan se irán incorporando y este informe se actualiza con ellas. Cuáles son está en el
  anexo de sesiones, que se regenera de la base y no se escribe a mano.
- **Un hallazgo por validar no es una conclusión.** El anexo los marca como tales.`
}

const BORRADOR_DEPENDENCIAS = `Antes de hablar de tecnología hay que hablar de esto, porque
es lo que más se repitió en el levantamiento y no lo dijo nadie a propósito: fue saliendo
solo, al preguntar quién hace qué.

**Varios procesos centrales de Industrias Iberia funcionan hoy porque una persona
específica está.** No porque el sistema los sostenga, ni porque estén documentados: porque
esa persona sabe hacerlos. Son procesos que la empresa ejecuta bien, todos los días, con
gente que conoce su oficio — y que se detendrían si esa persona faltara.

## Por qué esto va antes que la arquitectura

Cualquier módulo de IA que se construya se apoya en un proceso. Si el proceso vive en una
cabeza y no en un dato, no hay dónde apoyarse: lo primero que hay que hacer no es
automatizarlo, es **sacarlo de la cabeza y ponerlo donde se pueda leer**. Ese trabajo no
es glamoroso y no se ve, pero es la condición de casi todo lo demás.

Y hay algo más: es también la oportunidad más limpia de todo el programa para demostrar
valor sin tocar a nadie. Documentar un proceso no le quita el trabajo a quien lo hace —
le quita el teléfono en las vacaciones.

## La organización ya vivió el costo de esto

Dos veces, y las dos recientes:

- La persona que llevaba las compras de importación, con treinta años en la compañía,
  **falleció en marzo**. Su trabajo cayó completo sobre otra gerencia, que hasta hoy no
  ha podido repartirlo.
- El estatus de los permisos y certificados sanitarios de la empresa estuvo **en el disco
  duro de la persona que ocupaba el cargo**, también fallecida. La compañía perdió acceso
  a su propia gestión regulatoria hasta que alguien la reconstruyó a mano.

Ninguno de los dos casos fue negligencia de nadie. Son la consecuencia normal de una
organización que creció apoyándose en su gente. Pero ya ocurrieron, y por eso esta sección
no es una advertencia teórica.

## Dónde está hoy

*Esta sección se completa a medida que se validan los hallazgos de tipo «riesgo» del
levantamiento. El catálogo del anexo ya recoge los casos identificados en la primera
ronda de entrevistas, con la cita de cada uno.*

## Qué se propone

1. **Nombrar el respaldo de cada proceso crítico.** No es un organigrama nuevo: es decir,
   por escrito, quién es la segunda persona que sabe hacer cada cosa.
2. **Documentar lo que hoy solo está en la práctica**, empezando por los procesos que ya
   probaron ser frágiles.
3. **Convertir en dato lo que hoy es criterio.** Cuando el juicio de una persona sobre un
   proveedor está respaldado por el histórico, ese juicio sobrevive a su ausencia — y de
   paso se vuelve utilizable por un módulo.`

const BORRADOR_ESTADO_DATO = `Esta sección existe para decir algo temprano que sería una
excusa si se dijera tarde: **cuánto dato hay realmente, y desde cuándo.**

Todo módulo de IA se sostiene sobre datos. No sobre los datos que la organización tiene en
principio, sino sobre los que están capturados, son consultables y son confiables. La
diferencia entre esas dos cosas es la diferencia entre un módulo que funciona y una
promesa que no se puede cumplir.

## El corte de febrero

Industrias Iberia sufrió un incidente de seguridad informática en **febrero de 2026** que
afectó la información de varias áreas. Lo que el levantamiento recogió sobre sus
consecuencias, en palabras de quienes las vivieron:

- El **histórico de producción** del año anterior se perdió. Se rehizo desde abril,
  transcribiendo a mano, con parte del personal que lo había cargado originalmente ya
  fuera de la empresa.
- La **red de carpetas compartidas** de compras desapareció, y con ella las órdenes y las
  cotizaciones. Las órdenes anteriores a esa fecha tampoco abren dentro del ERP.
- La **documentación del sistema de gestión de la calidad** solo se recuperó hasta la
  versión de 2024. Dos años de actualizaciones no existen en ninguna parte.

**Consecuencia práctica: el histórico confiable de la mayoría de los procesos arranca
alrededor de abril de 2026.** Cualquier módulo que dependa de series de tiempo —previsión
de demanda, mantenimiento por condición, comportamiento de proveedores— empieza con menos
de un año de datos, y con un tramo inicial de calidad desigual.

Eso no impide construir. Sí determina **qué se construye primero**: los módulos que
funcionan con el dato del día —una revisión antes de facturar, un cotejo de documentos, una
sugerencia de reposición— rinden desde el primer mes. Los que necesitan aprender del pasado
rinden cuando haya pasado que aprender.

## Dónde nace el dato hoy

*Esta sección se completa con los hallazgos de tipo «dato disponible» del levantamiento,
a medida que se validan.*

## Lo que hay que capturar y hoy no se captura

Hay decisiones que hoy no dejan rastro, y por eso no se pueden medir ni mejorar. El
levantamiento identificó varias; el catálogo del anexo las recoge una por una con su cita.
En todas ellas, **el primer entregable no es un modelo: es el registro.**`

// =============================================================================

// =============================================================================
// EL MAPA DE PROCESOS Y LAS VEINTE FICHAS
// =============================================================================
//
// Salen del inventario V2 —`contenido/informe/inventario-procesos.json`—, que es
// el volcado del Excel que valida el mapa contra las 36 sesiones. Son reflejo del
// dato: se regeneran en cada corrida y no se editan desde el editor.
//
// **Solo entran los procesos vigentes.** Los que están en el papel y no se
// ejecutan, y los que nadie nombró, quedan fuera del mapa y del conteo; viven al
// pie de la ficha de su macroproceso, bajo «Lo que NO se hace». Se decidió así
// porque una ausencia suelta en un anexo no es un hallazgo: pegada al proceso al
// que le falta, sí.

const INVENTARIO = (() => {
  const crudo = leerTaller('inventario-procesos.json')
  if (!crudo) return null
  try {
    return JSON.parse(crudo)
  } catch (e) {
    console.error(`✖ inventario-procesos.json no se pudo leer: ${e.message}`)
    return null
  }
})()

/**
 * El título de la ficha de un macroproceso, y el ancla a la que apunta el mapa.
 *
 * ⚠️ El ancla **no se escribe**: la pone `rehype-slug` a partir del texto del
 * encabezado, y acá se calcula con el mismo `github-slugger` para que coincidan.
 * Un `<a id="…">` en el markdown no sirve — `react-markdown` descarta el HTML
 * crudo y el enlace queda muerto sin que nada avise.
 */
function tituloDeFicha(macro) {
  return `${numeroDeFicha(macro)} · ${macro.nombre}`
}

/**
 * Los tres niveles, en el orden en que aparecen en el inventario.
 *
 * Se deriva del propio inventario y no se escribe a mano: si mañana se añade un
 * nivel o se reordenan, la numeración lo sigue en vez de mentir.
 */
const NIVELES = (() => {
  const vistos = []
  for (const m of INVENTARIO?.macroprocesos ?? []) {
    if (!vistos.includes(m.nivel)) vistos.push(m.nivel)
  }
  return vistos
})()

/** «1», «2», «3» — el número del nivel dentro del documento. */
function numeroDeNivel(nivel) {
  const i = NIVELES.indexOf(nivel)
  return i === -1 ? '?' : String(i + 1)
}

/**
 * «1.1», «2.5» — el número jerárquico de un macroproceso.
 *
 * ⚠️ **Esto cambia el ancla de la ficha**, porque el ancla la calcula
 * `github-slugger` sobre el texto del encabezado. No rompe nada porque el enlace
 * del mapa sale de esta misma función: los dos lados cambian juntos. Cualquier
 * enlace escrito a mano a una ficha sí se rompería, y por eso no hay ninguno.
 */
function numeroDeFicha(macro) {
  return `${numeroDeNivel(macro.nivel)}.${macro.numero}`
}

/**
 * ⚠️ El enlace del mapa a una ficha es **entre páginas**: desde que cada sección
 * del informe es su propia ruta, un `#ancla` a secas se queda en el mapa y no
 * lleva a ninguna parte. El destino es la página de las fichas más el ancla.
 */
/**
 * Las cifras de la operación, repartidas.
 *
 * ⚠️ **Eran un capítulo y dejaron de serlo** el 18 de septiembre de 2026: un
 * capítulo titulado «las cifras del levantamiento» se lee como un volcado de lo
 * que alguien dijo en una grabación, que es justo el registro del que el informe
 * se está apartando. Las mismas 188 cifras dicen más dentro de la ficha del
 * proceso que miden.
 *
 * Dos grupos no cuelgan de ningún macroproceso —el tamaño del negocio y el
 * incidente de febrero— y van donde diga `sueltos`. Y las discrepancias van
 * aparte: **comparan dos áreas, así que no caben en una ficha.**
 *
 * El destino de cada grupo se escribe en el taller, no se deduce del texto:
 * adivinarlo pondría cifras en la ficha equivocada, que es peor que no ponerlas.
 */
const CIFRAS = (() => {
  const crudo = leerTaller('cifras-levantamiento.json')
  if (!crudo) return null
  try {
    return JSON.parse(crudo)
  } catch (e) {
    console.warn(`  ⚠️ cifras-levantamiento.json ilegible: ${e.message}`)
    return null
  }
})()

/** Las filas de cifras que le tocan a un destino, ya en tabla. */
function tablaDeCifras(grupos, titulo) {
  if (!grupos?.length) return []
  const l = []
  l.push('')
  l.push(`**${titulo}**`)
  for (const g of grupos) {
    l.push('')
    if (grupos.length > 1) l.push(`*${g.titulo}*`)
    l.push('')
    l.push('| Cifra | Qué mide |')
    l.push('|---|---|')
    for (const f of g.filas) {
      // El cuarto elemento marca lo que no es dato duro. Se conserva: una
      // estimación presentada como medición es la forma más barata de que un
      // informe deje de ser creíble.
      const marca = f[3] ? ` *· ${f[3]}*` : ''
      l.push(`| **${f[0]}** | ${f[1]}${marca} |`)
    }
  }
  return l
}

/** Los grupos de cifras asignados a un macroproceso. */
function cifrasDeMacro(macro) {
  if (!CIFRAS) return []
  const clave = `${macro.nivel} ${macro.numero}`
  return CIFRAS.grupos.filter((g) => g.macro === clave)
}

/**
 * Las seis cifras que no coinciden.
 *
 * ⚠️ **Van a «Sistemas y estado del dato» y no a una ficha**, porque cada una
 * compara **dos áreas** dando números distintos de lo mismo. Metida en la ficha
 * de un macroproceso, la comparación desaparece — y la comparación *es* el
 * hallazgo: es la manifestación medible de que no hay una sola fuente de verdad.
 */
function tablaDeDiscrepancias(slug) {
  const dis = CIFRAS?.discrepancias
  if (!dis || dis.destino !== slug) return []
  const l = []
  l.push('')
  l.push(`## ${dis.titulo}`)
  l.push('')
  l.push(dis.entrada)
  l.push('')
  l.push('| El dato | Las dos versiones | Por qué pasa |')
  l.push('|---|---|---|')
  for (const [asunto, cifras, , nota] of dis.filas) {
    l.push(`| **${asunto}** | ${cifras} | ${(nota ?? '').replace(/\s+/g, ' ').trim()} |`)
  }
  return l
}

/** Los grupos que van a una sección que no es una ficha. */
function cifrasSueltas(slug) {
  if (!CIFRAS) return []
  return CIFRAS.grupos.filter((g) => CIFRAS.sueltos?.[g.titulo] === slug)
}

const RUTA_FICHAS = '/informe/fichas-procesos'
const RUTA_HALLAZGOS = '/informe/hallazgos'

/**
 * ⚠️ **En el informe se acredita por código de sesión, no por nombre.**
 *
 * Decidido con Jesús el 17 de septiembre. El documento nombraba a 34 personas en
 * 712 menciones, y varias de ellas quedaban asociadas a hallazgos incómodos —el
 * indicador que se arma en casa el sábado, el control de crédito que cede ante
 * una llamada—. Con el código, el texto deja de leerse como un señalamiento.
 *
 * ⚠️ **La excepción es la tabla de cobertura, y es deliberada**: ahí el nombre y
 * el cargo *son* la evidencia de a quién se escuchó, que es la función del
 * capítulo. Esa tabla es además la que permite resolver cualquier código, así
 * que **esto no anonimiza: formaliza**. Quien necesite el nombre lo encuentra.
 *
 * ⚠️ Va en dirección contraria a la nota de `AGENTS.md` —«se cita por nombre,
 * decisión de Gabriel»—, que regulaba nombre frente a cargo, no frente a código.
 * Queda dicho para que se revise con él.
 */
function acreditar(codigo, area) {
  if (SIN_CODIGOS) return area ?? ''
  return [area, codigo ? `\`${codigo}\`` : null].filter(Boolean).join(' · ')
}

/**
 * Los nombres de pila de la gente entrevistada, con el rol que le corresponde.
 *
 * **Se construye de la base, no se escribe aquí.** Este archivo sí va a git y el
 * repositorio es público: una lista de nombres de Iberia en el generador es la
 * misma fuga que la política de atribución viene a cerrar, y encima permanente.
 */
let ROLES_POR_NOMBRE = new Map()

async function cargarRoles() {
  const { data } = await admin
    .from('entrevistas')
    .select('entrevistado_nombre, entrevistado_cargo')
  const mapa = new Map()
  for (const e of data ?? []) {
    const pila = (e.entrevistado_nombre ?? '').trim().split(/\s+/)[0]
    if (!pila || pila.length < 3 || !e.entrevistado_cargo) continue
    mapa.set(pila, rolDeCargo(e.entrevistado_cargo))
  }
  // Los más largos primero: sin esto, un nombre contenido en otro parte el otro.
  ROLES_POR_NOMBRE = new Map([...mapa].sort((a, b) => b[0].length - a[0].length))
  return ROLES_POR_NOMBRE
}

/** «Gerente de Compras» → «la gerencia de Compras». El área se conserva; la persona no. */
function rolDeCargo(cargo) {
  const m = /^(Gerente|Jefe|Jefa|Director|Directora|Coordinador|Coordinadora|Supervisor|Supervisora|Analista|Asistente)\s+de\s+(.+)$/i.exec(
    cargo.trim()
  )
  if (!m) return `el área de ${cargo.trim()}`
  const cabeza = m[1].toLowerCase()
  const femenino = {
    gerente: 'la gerencia',
    jefe: 'la jefatura',
    jefa: 'la jefatura',
    director: 'la dirección',
    directora: 'la dirección',
    coordinador: 'la coordinación',
    coordinadora: 'la coordinación',
    supervisor: 'la supervisión',
    supervisora: 'la supervisión',
  }[cabeza]
  return `${femenino ?? `el área`} de ${m[2]}`
}

/**
 * Quita los nombres de pila de la prosa que viene de la base y los cambia por el
 * rol: «Fulano describe el módulo» → «la jefatura de Almacén de Materia Prima
 * describe el módulo».
 *
 * ⚠️ **Hace falta porque la política de atribución no alcanza a `descripcion`.**
 * `acreditar()` gobierna la línea de fuente —código de sesión y nada más—, pero
 * las descripciones de los hallazgos se escribieron en la cosecha nombrando a
 * quien lo dijo, y esas se renderizan tal cual. Trece nombres seguían saliendo en
 * el capítulo de oportunidades con la política ya aplicada.
 *
 * **No toca la base**: la sustitución ocurre al generar, así que volver atrás es
 * quitar esta llamada. El original sigue en `hallazgos.descripcion`.
 */
function despersonalizar(texto) {
  if (!texto) return texto
  let t = texto
  for (const [pila, rol] of ROLES_POR_NOMBRE) {
    if (!t.includes(pila)) continue
    // Con límite de palabra unicode: un nombre corto no puede partir otro que lo
    // contenga, y `\b` de JS no sirve con acentos.
    // ⚠️ **`\p` dentro de una plantilla no es `\p`.** En un template literal un
    // escape que JS no reconoce **pierde la barra**, así que `[^\p{L}]` llegaba al
    // motor como `[^p{L}]` —una clase con las letras p, llave, L— y el límite de
    // palabra dejaba de existir: «Analista de Operaciones» salía como «la gerencia
    // de Contabilidadlista de Operaciones». Va con doble barra. Es la misma trampa
    // que ya mordió con `\d` y con `\b`.
    const re = new RegExp(`(^|[^\\p{L}])${pila}(?![\\p{L}])`, 'gu')
    t = t.replace(re, (_, antes) => {
      // A principio de frase el rol va con mayúscula, que arranca en el artículo.
      const inicio = antes === '' || /[.!?:¿¡]\s$/.test(antes) || antes === '\n'
      const r = inicio ? rol[0].toUpperCase() + rol.slice(1) : rol
      return `${antes}${r}`
    })
  }
  return t
}

/** Las notas del levantamiento, que es de donde sale el conteo de sesiones. */
const NOTAS = 'Insumos/notas-entrevistas'

/**
 * El ancla del encabezado de un hallazgo en la página del capítulo 9.
 *
 * ⚠️ Se calcula sobre **el texto completo del encabezado**, `H-01 · Título`, no
 * sobre el título solo: el separador deja su hueco y el id real lleva doble
 * guion (`h-01--la-explosion…`). Construirlo a mano dejaba los sesenta enlaces
 * de las fichas apuntando a la nada, y sin error visible.
 */
function anclaDeHallazgo(clave, titulo) {
  return new GithubSlugger().slug(`H-${clave} · ${titulo}`)
}

/**
 * Los hallazgos redactados que referencia cada ficha.
 *
 * ⚠️ La asignación es **editorial y explícita**, en el campo `macros` de
 * `hallazgos-destacados.json`. Se intentó deducirla cruzando las sesiones del
 * macroproceso con las del hallazgo y no funciona: un macroproceso que cita una
 * sesión por un proceso tangencial hereda todo lo suyo — a Capital Humano le
 * caía un hallazgo sobre la recepción del laboratorio. Estrechar el cruce a las
 * sesiones principales dejaba a Compras sin ninguno, teniendo nueve voces.
 */
function destacadosDe(macro, destacados) {
  if (!destacados) return []
  const mio = `${macro.nivel} ${macro.numero}`
  let n = 0
  const suyos = []
  for (const b of destacados.bloques) {
    for (const h of b.hallazgos) {
      n++
      if ((h.macros ?? []).includes(mio)) {
        suyos.push({ clave: String(n).padStart(2, '0'), titulo: h.titulo })
      }
    }
  }
  return suyos
}

function anclaDe(macro) {
  // Un slugger nuevo por llamada: el que se reutiliza numera los repetidos
  // (`-1`, `-2`) y el enlace dejaría de casar con el encabezado.
  return new GithubSlugger().slug(tituloDeFicha(macro))
}

/**
 * El dueño del macroproceso: quien lleva más procesos, no la lista de todos.
 *
 * Capital Humano tiene nueve áreas distintas repartidas en once procesos, así que
 * enumerarlas todas no dice quién manda ahí — dice que nadie manda, que es otra
 * cosa y se escribe en la prosa. El reparto fino ya está en la tabla de abajo.
 *
 * Se descartan las anotaciones que el inventario trae en el campo de área
 * («Lo ejecuta TI (debería ser Nómina)»): son el hallazgo de un proceso suelto,
 * no el dueño del macroproceso.
 */
function duenosDe(macro) {
  const cuenta = new Map()
  for (const p of macro.procesos) {
    const a = (p.area ?? '').trim()
    if (!a || a === '—') continue
    if (/deber[íi]a|custodiad|lo ejecuta/i.test(a)) continue
    cuenta.set(a, (cuenta.get(a) ?? 0) + 1)
  }
  const orden = [...cuenta.entries()].sort((x, y) => y[1] - x[1])
  if (!orden.length) return '`sin dueño identificado en el levantamiento`'

  const principales = orden.filter(([, n]) => n > 1).slice(0, 3)
  const lista = (principales.length ? principales : orden.slice(0, 2)).map(
    ([a, n]) => (n > 1 ? `**${a}** (${n})` : `**${a}**`)
  )
  const resto = orden.length - lista.length
  return resto > 0
    ? `${lista.join(' · ')} · y ${resto} área${resto > 1 ? 's' : ''} más, en la tabla`
    : lista.join(' · ')
}

/** El recuento por nivel, que es lo primero que se mira del mapa. */
function conteoPorNivel(macros) {
  const filas = []
  for (const nivel of ['Estratégico', 'Operativo', 'Soporte']) {
    const sub = macros.filter((m) => m.nivel === nivel)
    filas.push({
      nivel,
      macros: sub.length,
      procesos: sub.reduce((t, m) => t + m.procesos.length, 0),
      nuevos: sub.filter((m) => m.nuevo).length,
    })
  }
  return filas
}

async function mapaDeProcesos() {
  if (!INVENTARIO) return null
  const macros = INVENTARIO.macroprocesos
  const { count: sesiones } = await admin
    .from('entrevistas')
    .select('*', { count: 'exact', head: true })
  const totalN1 = macros.reduce((t, m) => t + m.procesos.length, 0)
  const nuevos = macros.filter((m) => m.nuevo)
  const noEjecutan = macros.reduce(
    (t, m) => t + m.no_se_hace.filter((x) => x.estado === 'NO SE EJECUTA').length,
    0
  )
  const sinEvidencia = macros.reduce(
    (t, m) => t + m.no_se_hace.filter((x) => x.estado === 'SIN EVIDENCIA').length,
    0
  )

  const l = []
  l.push(
    'Este mapa es el índice del documento. No describe lo que la empresa debería hacer: ' +
      `recoge lo que hace hoy, validado contra las ${sesiones ?? 0} sesiones del levantamiento. ` +
      `Son **${macros.length} macroprocesos** y **${totalN1} procesos** de primer nivel.`
  )
  l.push('')
  l.push(
    `El inventario de partida tenía 14 macroprocesos y 47 procesos. Al contrastarlo con lo que ` +
      `dijeron las personas que los ejecutan, **${nuevos.length} macroprocesos aparecieron enteros**, ` +
      `**${noEjecutan} procesos documentados resultaron no ejecutarse** y de otros ${sinEvidencia} no quedó ` +
      `evidencia alguna. Esos ${noEjecutan + sinEvidencia} no cuentan aquí: cada uno está al pie de la ficha ` +
      'de su macroproceso, bajo «Lo que NO se hace».'
  )
  l.push('')
  l.push('| Nivel | Macroprocesos | Procesos | De ellos, nuevos |')
  l.push('| --- | ---: | ---: | ---: |')
  for (const f of conteoPorNivel(macros)) {
    l.push(`| ${f.nivel} | ${f.macros} | ${f.procesos} | ${f.nuevos} |`)
  }
  l.push(
    `| **Total** | **${macros.length}** | **${totalN1}** | **${nuevos.length}** |`
  )
  l.push('')

  let nivelActual = ''
  for (const m of macros) {
    if (m.nivel !== nivelActual) {
      nivelActual = m.nivel
      l.push('')
      l.push(`### ${numeroDeNivel(nivelActual)}. ${nivelActual}`)
      l.push('')
    }
    const marca = m.nuevo ? ' · **nuevo**' : ''
    l.push(
      `**${numeroDeFicha(m)}. [${m.nombre}](${RUTA_FICHAS}#${anclaDe(m)})** — ${m.procesos.length} procesos${marca}`
    )
    l.push('')
  }

  // ⚠️ **Los nuevos ya no van en una lista aparte.** Tenían su propio bloque al
  // final, y eso los sacaba del mapa justo cuando lo que dicen es que *forman
  // parte del mapa*: se ejecutan hoy, en su nivel, junto a los demás. Quedan
  // donde les toca, marcados con su distintivo, y la nota de abajo explica qué
  // significa el distintivo.
  if (nuevos.length) {
    l.push('')
    l.push(
      `Los **${enLetra(nuevos.length)}** marcados como nuevos no figuraban en el inventario de ` +
        'partida y se ejecutan hoy. No son una propuesta: que un macroproceso completo no ' +
        'estuviera en el papel es, por sí solo, un hallazgo.'
    )
    l.push('')
  }

  return l.join('\n')
}

/**
 * Los tres campos de la ficha que son redacción, no dato.
 *
 * ⚠️ **El relleno es parcial a propósito y la plantilla se queda a la vista.**
 * Son veinte macroprocesos por tres campos: escribirlos de una sentada produce
 * prosa de relleno, y dejarlos en blanco los vuelve invisibles. Con la plantilla
 * puesta, la ficha sin redactar se distingue de un vistazo y el generador dice
 * cuántas van — que es lo que faltó la primera vez: las fichas se dieron por
 * hechas con sesenta campos sin escribir.
 */
const PLANTILLA = {
  que_hace: '`pendiente de redactar · tres líneas, y cada una con su hallazgo`',
  sistemas: '`pendiente · qué vive en JD, qué en Excel y qué en ningún sitio`',
  dato: '`pendiente · sí / parcial / no, y desde cuándo`',
}

const PROSA_FICHAS = (() => {
  try {
    return JSON.parse(leerTaller('fichas-prosa.json')).fichas ?? {}
  } catch {
    return {}
  }
})()

async function fichasDeProceso() {
  if (!INVENTARIO) return null
  const macros = INVENTARIO.macroprocesos
  let redactadas = 0
  const retenidos = []

  const crudoDest = leerTaller('hallazgos-destacados.json')
  const destacados = crudoDest ? JSON.parse(crudoDest) : null

  const l = []
  l.push(
    'Una ficha por macroproceso, con el mismo formato en las veinte. Es el formato el que hace el ' +
      'trabajo: cuando todas las fichas responden a las mismas preguntas, lo que falta en una se ve ' +
      'sin tener que buscarlo.'
  )
  l.push('')
  l.push(
    'La regla de escritura es que **cada línea sostenga un hallazgo**. Si una línea solo describe, sobra: ' +
      'este documento no es un manual de procesos, y no pretende serlo.'
  )
  l.push('')

  let nivelActual = ''
  for (const m of macros) {
    if (m.nivel !== nivelActual) {
      nivelActual = m.nivel
      l.push('')
      l.push(`## ${numeroDeNivel(nivelActual)} · ${nivelActual}`)
      l.push('')
    }

    l.push('')
    l.push(`### ${tituloDeFicha(m)}`)
    if (m.nuevo) {
      l.push('')
      l.push('> **Macroproceso nuevo.** No figuraba en el inventario de partida.')
    }
    l.push('')
    const prosa = PROSA_FICHAS[`${m.nivel} ${m.numero}`] ?? {}
    if (prosa.que_hace) redactadas++
    l.push(`**Qué hace hoy** — ${prosa.que_hace ?? PLANTILLA.que_hace}`)
    l.push('')
    l.push(`**Quién lo ejecuta** — ${duenosDe(m)}`)
    l.push('')
    l.push(`**Sistemas** — ${prosa.sistemas ?? PLANTILLA.sistemas}`)
    l.push('')
    l.push(`**Dato disponible** — ${prosa.dato ?? PLANTILLA.dato}`)
    l.push('')
    l.push(`**Procesos (${m.procesos.length})**`)
    l.push('')
    l.push('| Proceso | Área que lo ejecuta |')
    l.push('| --- | --- |')
    for (const p of m.procesos) {
      const area = p.dueno_corregido ? `${p.area} ⟵ *dueño corregido*` : p.area || '—'
      l.push(`| ${p.nombre} | ${area} |`)
    }
    l.push('')
    // Las cifras de este macroproceso, si el taller le asignó alguna. Van
    // después de los procesos y antes de los hallazgos: primero qué hace, luego
    // cuánto, y al final qué le pasa.
    l.push(...tablaDeCifras(cifrasDeMacro(m), 'Las cifras de este proceso'))

    const suyos = destacadosDe(m, destacados)
    if (suyos.length) {
      l.push('')
      l.push('**Hallazgos**')
      l.push('')
      for (const h of suyos) {
        l.push(
          `- [**H-${h.clave}** · ${h.titulo}](${RUTA_HALLAZGOS}#${anclaDeHallazgo(h.clave, h.titulo)})`
        )
      }
    } else {
      l.push('')
      l.push(
        '**Hallazgos** — los de este macroproceso son transversales y se desarrollan en ' +
          `[Los hallazgos](${RUTA_HALLAZGOS}).`
      )
    }

    if (m.no_se_hace.length) {
      l.push('')
      l.push('**Lo que NO se hace**')
      l.push('')
      for (const p of m.no_se_hace) {
        const marca = p.estado === 'SIN EVIDENCIA' ? 'sin evidencia' : 'no se ejecuta'
        const todas = (p.fuente ?? '')
          .split(/[,;]/)
          .map((x) => x.trim())
          .filter((c) => c && c !== '—')
        const cods = todas.filter((c) => !SIN_CONSENTIMIENTO.has(c))

        // ⚠️ **Si la única fuente es una sesión retenida, la observación no se
        // publica.** La guarda de consentimiento cubría la acreditación —no
        // decir de quién sale— y dejaba pasar el contenido, que es lo que de
        // verdad importa: «no citarla» incluye no publicar lo que dijo. Se coló
        // una observación que además nombraba su cargo. Si hay otra sesión que
        // documenta lo mismo, se queda: ahí el hallazgo no depende de ella.
        if (todas.length && !cods.length) {
          retenidos.push(`${m.nombre} · ${p.nombre}`)
          continue
        }

        const fuente = SIN_CODIGOS || !cods.length ? '' : ` *(${cods.join(', ')})*`
        l.push(`- **${p.nombre}** · ${marca} — ${p.observacion}${fuente}`)
      }
    }
    // ⚠️ **La línea «Quién lo contó» ya no existe.** Estuvo al pie de las
    // veinte fichas y era el atajo de quien tuviera que validar un hallazgo,
    // pero decir de dónde sale un proceso es exactamente lo que el informe
    // dejó de hacer el 18 de septiembre. Ese atajo vive ahora en el expediente
    // de trazabilidad (`npm run expediente`), que no se entrega al cliente.
    l.push('')
    l.push('---')
  }

  if (retenidos.length) {
    console.log(
      `  ⛔ fichas: ${retenidos.length} observación(es) no publicada(s), su única fuente es una sesión retenida:`
    )
    for (const r of retenidos) console.log(`     ${r}`)
  }

  console.log(
    `  · fichas-procesos: ${redactadas} de ${macros.length} fichas redactadas` +
      (redactadas < macros.length ? ` · ⚠️ faltan ${(macros.length - redactadas) * 3} campos` : '')
  )

  return l.join('\n')
}

async function anexoProcesos() {
  if (!INVENTARIO) return null
  const macros = INVENTARIO.macroprocesos
  const totalN1 = macros.reduce((t, m) => t + m.procesos.length, 0)

  const l = []
  l.push(
    `El inventario completo detrás del mapa y de las fichas: **${totalN1} procesos vigentes** en ` +
      `**${macros.length} macroprocesos**, con el área que ejecuta cada uno y la sesión donde se levantó.`
  )
  l.push('')
  l.push(
    'La columna de área es la **real**, la que dijo quien lo hace, que no siempre coincide con la que ' +
      'asignaba el organigrama. Donde difiere va marcada.'
  )
  l.push('')
  l.push(
    `Fuente: \`${INVENTARIO.fuente}\`. Los procesos documentados que no se ejecutan están en la hoja ` +
      '«No vigentes» de ese archivo y al pie de cada ficha, no aquí.'
  )
  l.push('')

  for (const m of macros) {
    l.push('')
    l.push(`### ${m.nivel} ${m.numero} · ${m.nombre}${m.nuevo ? ' *(nuevo)*' : ''}`)
    l.push('')
    l.push('| # | Proceso | Área que lo ejecuta | Fuente |')
    l.push('| ---: | --- | --- | --- |')
    for (const [i, p] of m.procesos.entries()) {
      const area = p.dueno_corregido ? `${p.area} ⟵ corregido` : p.area || '—'
      l.push(`| ${i + 1} | ${p.nombre} | ${area} | ${p.fuente || '—'} |`)
    }
    l.push('')
  }

  return l.join('\n')
}

// =============================================================================


// =============================================================================
// SECCIÓN 09 · LOS HALLAZGOS
// =============================================================================
//
// Dos piezas y una regla. La prosa —los cuarenta y dos redactados— vive en
// `contenido/informe/hallazgos-destacados.json`, porque es criterio editorial y
// no sale del dato. **Las citas no se copian ahí**: se leen de la tabla
// `hallazgos` por la pareja (entrevista, título), de modo que la cita del
// informe y la que Iberia valida en el panel sean siempre la misma. Si alguien
// renombra un hallazgo en la base, la referencia deja de casar y el script lo
// dice en vez de publicar un hueco.
//
// Debajo va el índice de los 394 agrupado por área: el mapa completo para quien
// quiera ir al detalle. El cuerpo del capítulo son los cuarenta y dos.

/** Los rótulos del panel, para no inventar otros en el informe. */
const TIPO_HALLAZGO = {
  cuello_botella: 'Cuello de botella',
  trabajo_manual: 'Trabajo manual',
  dato_disponible: 'Dato disponible',
  oportunidad_ia: 'Oportunidad de IA',
  riesgo: 'Riesgo',
  sistema: 'Sistema',
  supuesto: 'Supuesto',
}

async function losHallazgos() {
  const crudo = leerTaller('hallazgos-destacados.json')
  if (!crudo) return null
  const destacados = JSON.parse(crudo)

  const { data: todos } = await admin
    .from('hallazgos')
    .select(
      'tipo, titulo, cita_textual, estado, impacto, areas(nombre), entrevistas(codigo, entrevistado_nombre)'
    )
    .order('titulo')

  const porClave = new Map()
  for (const h of todos ?? []) porClave.set(`${h.entrevistas?.codigo}|${h.titulo}`, h)

  const total = (todos ?? []).length
  const redactados = destacados.bloques.reduce((t, b) => t + b.hallazgos.length, 0)
  const l = []
  const huerfanas = []

  l.push(
    `De todo lo que el diagnóstico documentó, este capítulo desarrolla los **${redactados} ` +
      `hallazgos** que sostienen el argumento del documento, agrupados en ` +
      `**${destacados.bloques.length} patrones**.`
  )
  l.push('')
  l.push(
    'El criterio para desarrollar uno fue el mismo en todos: **impacto alto, y detrás una ' +
      'consecuencia medible o la coincidencia de áreas que no trabajan juntas**. Lo que aparece una ' +
      'sola vez y en un solo sitio no está acá, por cierto que sea.'
  )

  // --- El cuadro de mando ----------------------------------------------------
  //
  // ⚠️ **Las columnas se cuentan, no se escriben.** Cuántos hallazgos tiene un
  // patrón, cuántas áreas cruza y cuántos son de impacto alto sale de la propia
  // lista y de la base. Tecleadas serían un segundo sitio donde vive el mismo
  // dato, y al mover un hallazgo de patrón dejarían de coincidir con las tablas
  // de abajo.
  const datosDe = (bloque) => {
    const suyos = bloque.hallazgos.map((h) => {
      for (const [cod, tit] of h.fuentes) {
        const f = porClave.get(`${cod}|${tit}`)
        if (f) return f
      }
      return null
    })
    const areas = new Set(suyos.filter(Boolean).map((f) => f.areas?.nombre).filter(Boolean))
    const altos = suyos.filter((f) => f?.impacto === 'alto').length
    return { suyos, areas, altos }
  }

  l.push('')
  l.push('## Los siete patrones, de un vistazo')
  l.push('')
  l.push(
    'Cada uno agrupa hallazgos que aparecieron en áreas que no trabajan juntas. Esa coincidencia ' +
      'es lo que los convierte en un problema del sistema y no de un área.'
  )
  l.push('')
  l.push('| Patrón | Hallazgos | Áreas que cruza | De impacto alto |')
  l.push('|---|---:|---:|---:|')
  for (const bloque of destacados.bloques) {
    const d = datosDe(bloque)
    l.push(
      `| **${bloque.titulo}** | ${bloque.hallazgos.length} | ${d.areas.size} | ${d.altos || '—'} |`
    )
  }

  let n = 0
  let contador = 0
  for (const bloque of destacados.bloques) {
    l.push('')
    l.push(`## ${bloque.titulo}`)
    l.push('')
    l.push(bloque.entrada)

    // El índice del patrón, para leerlo de un vistazo antes de entrar en cada
    // hallazgo. Es la misma lista que sigue, con su área y su impacto — que son
    // dato de la base y no estaban a la vista en ningún sitio.
    l.push('')
    l.push('| # | Hallazgo | Área | Impacto |')
    l.push('|---|---|---|---|')
    for (const h of bloque.hallazgos) {
      contador++
      const clave = String(contador).padStart(2, '0')
      let f = null
      for (const [cod, tit] of h.fuentes) {
        f = porClave.get(`${cod}|${tit}`)
        if (f) break
      }
      const imp = f?.impacto ? f.impacto[0].toUpperCase() + f.impacto.slice(1) : '—'
      l.push(
        `| **H-${clave}** | [${h.titulo}](#${anclaDeHallazgo(clave, h.titulo)}) | ` +
          `${f?.areas?.nombre ?? '—'} | ${imp} |`
      )
    }

    for (const h of bloque.hallazgos) {
      n++
      const clave = String(n).padStart(2, '0')
      l.push('')
      l.push(`### H-${clave} · ${h.titulo}`)
      l.push('')
      l.push(h.texto)

      const fuentesDelHallazgo = []
      for (const [cod, tit] of h.fuentes) {
        const f = porClave.get(`${cod}|${tit}`)
        if (!f) {
          huerfanas.push(`H-${clave} → ${cod} · ${tit}`)
          continue
        }
        if (!f.cita_textual?.trim()) continue
        fuentesDelHallazgo.push([cod, f.areas?.nombre])
      }
      // El capítulo de hallazgos tiene su propio camino de citas, y también
      // respeta la regla: prosa formal más la acreditación al pie.
      if (fuentesDelHallazgo.length) {
        l.push('')
        if (SIN_CITA_TEXTUAL.has('hallazgos')) {
          const cods = [...new Set(fuentesDelHallazgo.map(([c]) => c))]
          if (!SIN_CODIGOS) l.push(`*Fuentes · ${cods.map((c) => `\`${c}\``).join(' · ')}*`)
        } else {
          for (const [cod, area] of fuentesDelHallazgo) {
            const f = porClave.get(`${cod}|${h.fuentes.find(([c]) => c === cod)?.[1]}`)
            l.push(`> «${f?.cita_textual?.trim() ?? ''}»`)
            l.push(`> — ${acreditar(cod, area)}`)
          }
        }
      }
    }
  }

  // --- El mapa de los que no se desarrollan --------------------------------
  //
  // ⚠️ Aquí había una tabla con los 394, y era un error por dos motivos. El
  // editorial: un índice de cientos de filas no lo lee nadie, y el trabajo de
  // este informe fue justamente escoger — el detalle vive en el panel del
  // levantamiento, con su ficha completa. Y el técnico: 421 filas de tabla
  // tumbaban el proceso de render de Next con un 500, sin más pista que un
  // «Jest worker» en el log.
  const porArea = new Map()
  for (const h of todos ?? []) {
    const a = h.areas?.nombre ?? 'Sin área asignada'
    if (!porArea.has(a)) porArea.set(a, [])
    porArea.get(a).push(h)
  }

  const marcados = new Set()
  for (const b of destacados.bloques) {
    for (const h of b.hallazgos) for (const [c, t] of h.fuentes) marcados.add(`${c}|${t}`)
  }

  const TIPOS = ['cuello_botella', 'trabajo_manual', 'riesgo', 'dato_disponible', 'oportunidad_ia', 'sistema', 'supuesto']

  // ⚠️ **Aquí iba «Dónde está el resto»**, una matriz de áreas por tipo con los
  // hallazgos que el capítulo no desarrolla. Se quitó el 18 de septiembre de
  // 2026: anunciar cuántos hallazgos quedan sin desarrollar invita a pedirlos,
  // y el trabajo de este informe fue justamente escoger. El reparto completo
  // sigue en el panel del programa, filtrable por área, tipo y estado.

  if (huerfanas.length) {
    console.error('\n⚠️  Referencias de hallazgos-destacados.json que no casan con la base:')
    for (const h of huerfanas) console.error(`     · ${h}`)
    console.error('')
  }

  return l.join('\n')
}

// ⚠️ **Desconectadas a propósito el 16 de septiembre de 2026.** El armazón se
// dejó en blanco por decisión del cliente: las trece secciones se escriben desde
// cero contra el levantamiento, sin relleno que revisar.
//
// Las generadoras **no se borraron** —`mapaDeProcesos`, `fichasDeProceso`,
// `anexoProcesos`, `anexoSesiones`, `indiceDeHallazgos` y `anexoInventario`
// siguen ahí arriba, y `contenido/informe/inventario-procesos.json` también—,
// así que volver a llenarlas del dato es devolver la entrada a este mapa, no
// reescribir nada. Mientras esté vacío, ninguna sección se autogenera.
// =============================================================================
// 8) RIESGO Y CONTINUIDAD
// =============================================================================
//
// El incidente de febrero visto desde las áreas, no desde TI. La prosa vive en
// `riesgo-continuidad.json` y las citas **no se copian ahí**: se leen de la
// tabla `hallazgos` por la pareja (entrevista, título), igual que el capítulo 9.
//
// ⚠️ El número de sesiones que hablan del ataque **no se escribe a mano**. Se
// contó primero a ojo y el subtítulo del armazón llegó a decir «treinta y
// cuatro» cuando son dieciocho; un número inflado en la primera línea de un
// capítulo sobre pérdida de datos es exactamente lo que un lector usa para
// dejar de creerte. Lo cuenta `sesionesDelAtaque()` sobre las notas.

/** Términos del ciberataque, y el falso positivo que hay que excluir. */
const RE_ATAQUE = /ataque|hackeo|hacke|ciberataque|secuestr|ransom|encript|cifrad|incidente de febrero|desde febrero|en febrero/i
// ⚠️ SES-004 habla de un «ataque de plagas» (gorgojos en las especias) y entraba
// en el conteo. Es el único falso positivo del corpus, y basta con mirar si la
// coincidencia es esa.
const RE_PLAGA = /ataque de plaga/i

/** Menciona el ciberataque de verdad, y no los gorgojos. */
function hablaDelAtaque(texto) {
  if (!texto) return false
  const limpio = texto.replace(RE_PLAGA, '')
  return RE_ATAQUE.test(limpio)
}

/**
 * Sesiones que no pueden usarse, **ni siquiera para contar**.
 *
 * ⚠️ `ENT-005` se grabó sin que la entrevistada lo supiera y pidió que se
 * borrara: no se cosecha y no se cita. Y tampoco entra en un conteo publicado —
 * decir «el ataque aparece en dieciocho sesiones» apoyándose en una de ellas es
 * usar el material por la puerta de atrás. Se descuenta del numerador y del
 * denominador, y por eso la cifra del capítulo es diecisiete sobre treinta y
 * cinco. Si se resuelve el consentimiento, se saca de esta lista y el número se
 * corrige solo.
 */
/**
 * **El informe no lleva códigos de sesión.**
 *
 * Decisión del cliente del 18 de septiembre de 2026, hablada con Gabriel: el
 * documento se sostiene en la autoría del equipo consultor y no en un aparato
 * de referencias. Eso deja fuera las citas textuales —ya convertidas a prosa—,
 * los códigos `ENT-`, `SES-` y `FOR-`, y la tabla de sesiones con nombres.
 *
 * ⚠️ **No se pierde la trazabilidad, cambia de sitio.** `npm run expediente`
 * deja en `Insumos/` el dossier con cada afirmación, su sesión, quién lo dijo y
 * la cita literal — fuera de git, que es material bajo NDA. Ese archivo pasa a
 * ser el único puente entre el informe y su evidencia.
 *
 * ⚠️ **Es un interruptor, no una reescritura.** Los pares (sesión, hallazgo)
 * siguen en el taller y en la base: ponerlo en `false` y regenerar devuelve el
 * informe con referencias. Nada de esto se borra en el origen.
 */
/**
 * **Fuera el bloque «Los hallazgos de este capítulo».**
 *
 * Estaba al pie de seis capítulos y repetía, en forma de lista de enlaces, lo
 * que el capítulo acababa de argumentar. Con el informe ya sin códigos de
 * sesión, esa lista dejó de ser una acreditación y quedó en un índice de sí
 * mismo. Decisión del cliente del 18 de septiembre de 2026.
 *
 * El cálculo se conserva: apagarlo es esto, y encenderlo, `false`.
 */
const SIN_ENLACES_A_HALLAZGOS = true

const SIN_CODIGOS = true

const SIN_CONSENTIMIENTO = new Set(['ENT-005'])

/**
 * Cuántas sesiones del levantamiento hablan del ataque, y cuántas dejaron un
 * hallazgo. Une las notas del taller con los hallazgos de la base: hay áreas que
 * lo cuentan sin usar la palabra —Compras dice «desde febrero»— y al revés.
 */
function sesionesDelAtaque(hallazgos) {
  const conNota = new Set()
  let total = 0
  try {
    for (const f of readdirSync(NOTAS)) {
      if (!f.endsWith('.md')) continue
      const codigo = f.replace(/\.md$/, '')
      if (SIN_CONSENTIMIENTO.has(codigo)) continue
      total++
      const t = readFileSync(resolve(NOTAS, f), 'utf8')
      if (hablaDelAtaque(t)) conNota.add(codigo)
    }
  } catch {
    // Sin las notas a mano el capítulo se escribe igual: el conteo es del
    // levantamiento, no del render, y vale más publicar sin cifra que con una
    // inventada.
    return null
  }

  const conHallazgo = new Set()
  for (const h of hallazgos ?? []) {
    const cod = h.entrevistas?.codigo
    if (!cod || SIN_CONSENTIMIENTO.has(cod)) continue
    if (hablaDelAtaque([h.titulo, h.descripcion, h.cita_textual].filter(Boolean).join(' '))) {
      conHallazgo.add(cod)
    }
  }

  const todas = new Set([...conNota, ...conHallazgo])
  return { sesiones: todas.size, total, conHallazgo: conHallazgo.size }
}

/** Los números en palabras, que es como se escriben en el cuerpo del informe. */
const EN_LETRA = {
  1: 'una', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete',
  8: 'ocho', 9: 'nueve', 10: 'diez', 11: 'once', 12: 'doce', 13: 'trece',
  14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho',
  19: 'diecinueve', 20: 'veinte', 34: 'treinta y cuatro', 35: 'treinta y cinco',
  36: 'treinta y seis', 37: 'treinta y siete',
}
const enLetra = (n) => EN_LETRA[n] ?? String(n)

/**
 * Pega las citas de un bloque de taller, leídas de la base por la pareja
 * (entrevista, título). Es común a los capítulos que se escriben así, y con
 * ella viajan las dos guardas que ninguno puede saltarse:
 *
 *  - **Consentimiento.** Va aquí y no solo en la cosecha, porque el taller se
 *    escribe a mano y nadie se acuerda de la lista al pegar una cita.
 *  - **Cita repetida.** La misma cita en dos bloques se lee como un error de
 *    copiado y es invisible al escribir: pasó con la cita de TI sobre el
 *    proveedor de respaldo, que sostiene a la vez el relato del ataque y el del
 *    respaldo. Se queda en el primer bloque que la use.
 *
 * `ctx.yaCitadas` es por capítulo, no global: repetir una cita en dos capítulos
 * distintos es legítimo — el lector de uno no ha leído el otro.
 */
/**
 * Los capítulos que **no llevan cita textual**, sino una línea de fuentes.
 *
 * ⚠️ El bloque de arquitectura y el resumen son **argumento, no evidencia**: su
 * prosa ya afirma lo que la cita repetía —«el MRP no corre», «la nómina lleva
 * siete años sin interfaz»— y la cita solo reforzaba, en registro coloquial.
 * Decidido con Jesús el 17 de septiembre: ahí la cita se sustituye por la
 * acreditación, que **conserva la trazabilidad y sube el registro**.
 *
 * Los capítulos del levantamiento (2 al 11) **sí las conservan**: ahí la cita no
 * ilustra, prueba. Es la diferencia entre sostener un argumento y sostener un
 * hecho, y borrarla ahí dejaría al informe diciendo cosas que nadie dijo.
 */
const SIN_CITA_TEXTUAL = new Set([
  'resumen-ejecutivo',
  'cobertura',
  'cifras',
  'sistemas-datos',
  'riesgo-continuidad',
  'trabas',
  'hallazgos',
  'oportunidades',
  'donde-no-va-la-ia',
  'arquitectura-ia',
  'hoja-de-ruta',
])

function pegarCitas(l, bloque, ctx) {
  // En los capítulos de argumento, una sola línea de fuentes al pie del bloque.
  if (SIN_CITA_TEXTUAL.has(ctx.etiqueta)) {
    const cods = []
    for (const [cod] of bloque.fuentes ?? []) {
      if (SIN_CONSENTIMIENTO.has(cod)) continue
      if (!cods.includes(cod)) cods.push(cod)
    }
    if (cods.length) {
      l.push('')
      if (!SIN_CODIGOS) l.push(`*Fuentes · ${cods.map((c) => `\`${c}\``).join(' · ')}*`)
    }
    return
  }

  for (const [cod, tit] of bloque.fuentes ?? []) {
    if (SIN_CONSENTIMIENTO.has(cod)) {
      console.warn(`  ⛔ ${ctx.etiqueta}: ${cod} no puede citarse (sin consentimiento). Omitida en «${bloque.titulo}».`)
      continue
    }
    const f = ctx.porClave.get(`${cod}|${tit}`)
    if (!f) {
      ctx.huerfanas.push(`${bloque.titulo} → ${cod} · ${tit}`)
      continue
    }
    if (!f.cita_textual?.trim()) continue
    if (ctx.yaCitadas.has(`${cod}|${tit}`)) {
      console.warn(`  ⚠️ ${ctx.etiqueta}: cita repetida, omitida en «${bloque.titulo}» → ${cod} · ${tit}`)
      continue
    }
    ctx.yaCitadas.add(`${cod}|${tit}`)
    const firma = acreditar(f.entrevistas?.codigo, f.areas?.nombre)
    l.push('')
    l.push(`> «${f.cita_textual.trim()}»`)
    l.push(`> — ${firma || `\`${cod}\``}`)
  }
}

/** Los hallazgos de la base, indexados por la pareja (entrevista, título). */
async function hallazgosPorClave() {
  const { data } = await admin
    .from('hallazgos')
    .select('titulo, descripcion, cita_textual, areas(nombre), entrevistas(codigo, entrevistado_nombre)')
    .order('titulo')
  const porClave = new Map()
  for (const h of data ?? []) porClave.set(`${h.entrevistas?.codigo}|${h.titulo}`, h)
  return { todos: data ?? [], porClave }
}

/**
 * Los hallazgos redactados de un bloque del capítulo 9, con su número y su
 * ancla. Se lee del mismo archivo que numera el capítulo, así que si mañana se
 * agrega un hallazgo antes, los enlaces se corrigen solos.
 */
function bloqueDeHallazgos(destacados, titulo) {
  let n = 0
  for (const b of destacados.bloques) {
    const suyos = []
    for (const h of b.hallazgos) {
      n++
      suyos.push({ clave: String(n).padStart(2, '0'), titulo: h.titulo })
    }
    if (b.titulo === titulo) return suyos
  }
  return []
}

/**
 * Todos los hallazgos redactados, indexados por su título.
 *
 * ⚠️ Un capítulo que referencia hallazgos sueltos de varios bloques **los nombra
 * por título, nunca por número**. El número es la posición en el capítulo 9: en
 * cuanto alguien inserte un hallazgo antes, un `H-37` escrito a mano apunta a
 * otro. Aquí el título es la clave y el número se resuelve en cada corrida.
 */
function hallazgosPorTitulo(destacados) {
  const m = new Map()
  let n = 0
  for (const b of destacados.bloques) {
    for (const h of b.hallazgos) {
      n++
      m.set(h.titulo, { clave: String(n).padStart(2, '0'), titulo: h.titulo })
    }
  }
  return m
}

/** La lista de enlaces al capítulo 9 que cierra un capítulo, resuelta por título. */
function enlacesAHallazgos(destacados, titulos, etiqueta) {
  const indice = hallazgosPorTitulo(destacados)
  const l = []
  for (const t of titulos ?? []) {
    const h = indice.get(t)
    if (!h) {
      console.warn(`  ⚠️ ${etiqueta}: no existe un hallazgo redactado titulado «${t}»`)
      continue
    }
    l.push(`- [**H-${h.clave}** · ${h.titulo}](${RUTA_HALLAZGOS}#${anclaDeHallazgo(h.clave, h.titulo)})`)
  }
  return l
}

async function riesgoYContinuidad() {
  const crudo = leerTaller('riesgo-continuidad.json')
  if (!crudo) return null
  const taller = JSON.parse(crudo)

  const { todos, porClave } = await hallazgosPorClave()
  const cuenta = sesionesDelAtaque(todos)
  const l = []
  const huerfanas = []
  const ctx = { porClave, huerfanas, yaCitadas: new Set(), etiqueta: 'riesgo-continuidad' }

  l.push(
    cuenta
      ? taller.entrada
          .replace('{SESIONES}', enLetra(cuenta.sesiones))
          .replace('{TOTAL}', enLetra(cuenta.total))
          .replace('{CONHALLAZGO}', enLetra(cuenta.conHallazgo))
      : taller.entrada.replace(
          /El ataque aparece en[^.]+\. /,
          'El ataque aparece en buena parte de las sesiones del levantamiento. '
        )
  )

  /** Una tabla del taller, con su entrada y su cierre. */
  const tabla = (bloque, cabecera) => {
    if (!bloque) return
    l.push('')
    l.push(`## ${bloque.titulo}`)
    l.push('')
    l.push(bloque.entrada)
    l.push('')
    l.push(`| ${cabecera.join(' | ')} |`)
    l.push(`|${cabecera.map(() => '---').join('|')}|`)
    for (const fila of bloque.filas) l.push(`| ${fila.join(' | ')} |`)
    if (bloque.cierre) {
      l.push('')
      l.push(bloque.cierre)
    }
  }

  tabla(taller.cronologia, taller.cronologia?.columnas ?? ['', '', ''])
  tabla(taller.resistio, ['Componente', 'Estado', 'Qué pasó'])

  // --- El inventario de pérdidas -------------------------------------------
  //
  // ⚠️ **El área y la sesión salen de la base, no del taller.** Escritas a mano
  // se separarían del hallazgo en cuanto alguien reasignara un área, y esta es
  // justo la tabla que un gerente va a leer buscando su propia fila.
  //
  // ⚠️ Y el conteo de «no volvió» **se cuenta**: es la tesis del capítulo. Una
  // cifra tecleada seguiría diciendo lo mismo el día que se añada una pérdida
  // más, que es como un documento empieza a mentir sin que nadie lo toque.
  if (taller.perdidas) {
    const pd = taller.perdidas
    const porTitulo = new Map([...porClave.values()].map((h) => [h.titulo, h]))
    const sinCasar = []
    const ESTADO = { No: '🔴 **No**', Parcial: '⚠️ Parcial', Sí: '✅ Sí' }
    const cuentaEstado = { No: 0, Parcial: 0, Sí: 0 }

    l.push('')
    l.push(`## ${pd.titulo}`)
    l.push('')
    l.push(pd.entrada)
    l.push('')
    l.push(SIN_CODIGOS ? '| Área | Qué perdió | ¿Volvió? |' : '| Área | Qué perdió | ¿Volvió? | Sesión |')
    l.push(SIN_CODIGOS ? '|---|---|---|' : '|---|---|---|---|')
    for (const [titulo, que, volvio] of pd.filas) {
      const h = porTitulo.get(titulo)
      if (!h) {
        sinCasar.push(titulo)
        continue
      }
      const cod = h.entrevistas?.codigo
      if (SIN_CONSENTIMIENTO.has(cod)) continue
      cuentaEstado[volvio] = (cuentaEstado[volvio] ?? 0) + 1
      const fila = `| **${h.areas?.nombre ?? '—'}** | ${que} | ${ESTADO[volvio] ?? volvio} |`
      l.push(SIN_CODIGOS ? fila : `${fila} \`${cod ?? '—'}\` |`)
    }
    if (sinCasar.length) {
      console.warn(`  ⚠️ riesgo-continuidad: ${sinCasar.length} pérdida(s) sin casar en la base:`)
      for (const t of sinCasar) console.warn(`     ${t}`)
    }
    const totalP = cuentaEstado.No + cuentaEstado.Parcial + cuentaEstado.Sí
    if (pd.cierre) {
      l.push('')
      l.push(
        pd.cierre
          .replaceAll('{TOTAL_P}', enLetra(totalP))
          .replaceAll('{NO_VOLVIO}', enLetra(cuentaEstado.No))
          .replaceAll('{PARCIAL}', enLetra(cuentaEstado.Parcial))
      )
    }
    console.log(
      `  · riesgo-continuidad: ${totalP} pérdidas · ${cuentaEstado.No} no volvieron · ` +
        `${cuentaEstado.Parcial} parciales · ${cuentaEstado.Sí} recuperadas`
    )
  }

  for (const bloque of taller.bloques ?? []) {
    l.push('')
    l.push(`## ${bloque.titulo}`)
    l.push('')
    l.push(bloque.texto)
    pegarCitas(l, bloque, ctx)
  }

  tabla(taller.medidas, ['Medida', 'Qué es', 'Qué resuelve'])
  tabla(taller.abiertos, ['Frente', 'Por qué sigue abierto', 'Quién lo cierra'])

  const destacados = (() => {
    try {
      return JSON.parse(leerTaller('hallazgos-destacados.json'))
    } catch {
      return null
    }
  })()
  if (destacados && taller.hallazgos?.length) {
    const enlaces = SIN_ENLACES_A_HALLAZGOS ? [] : enlacesAHallazgos(destacados, taller.hallazgos, 'riesgo-continuidad')
    if (enlaces.length) {
      l.push('')
      l.push('## Los hallazgos de este capítulo')
      l.push('')
      l.push('Los que el capítulo de hallazgos desarrolla sobre el incidente, con su cita completa:')
      l.push('')
      l.push(...enlaces)
    }
  }

  if (taller.cierre) {
    l.push('')
    l.push('---')
    l.push('')
    l.push(taller.cierre)
  }

  // Las cifras del incidente. No cuelgan de un macroproceso —el ataque no es un
  // proceso— y este es el capítulo que lo cuenta.
  l.push(...tablaDeCifras(cifrasSueltas('riesgo-continuidad'), 'El incidente, en cifras'))

  if (huerfanas.length) {
    console.warn(`  ⚠️ riesgo-continuidad: ${huerfanas.length} cita(s) sin casar en la base:`)
    for (const h of huerfanas) console.warn(`     ${h}`)
  }
  if (cuenta) {
    console.log(
      `  · riesgo-continuidad: ${cuenta.sesiones}/${cuenta.total} sesiones hablan del ataque, ${cuenta.conHallazgo} con hallazgo`
    )
  }

  return l.join('\n')
}

// =============================================================================
// 6) SISTEMAS Y ESTADO DEL DATO
// =============================================================================
//
// El argumento: qué vive en el ERP, qué vive fuera y qué dato es confiable.
//
// ⚠️ **Este capítulo no lleva el inventario de sistemas.** Ese es el 7, que sale
// de la base con `anexoInventario`. Van en pareja —el 6 afirma y el 7 enseña la
// evidencia— y si el 6 monta su propia tabla de sistemas, las dos se
// desincronizan en cuanto alguien cosecha un hallazgo nuevo. El cuadro que sí
// lleva es otro: los **soportes** —Excel, papel, WhatsApp, correo— sobre los que
// se apoya la operación cuando el ERP no llega, que no es una lista de sistemas
// y no existe en ninguna otra parte del documento.

/**
 * Un capítulo de prosa con citas: entrada, bloques con sus citas leídas de la
 * base, el puente al capítulo 9 y el cierre.
 *
 * Lo comparten el 6 y el 11, que se escriben igual. Cuando eran dos funciones
 * idénticas, arreglar la guarda de citas en una dejaba la otra sin arreglar.
 */
async function capituloConCitas(archivo, etiqueta, entradaDeHallazgos) {
  const crudo = leerTaller(archivo)
  if (!crudo) return null
  const taller = JSON.parse(crudo)

  const { porClave } = await hallazgosPorClave()
  const l = []
  const huerfanas = []
  const ctx = { porClave, huerfanas, yaCitadas: new Set(), etiqueta }

  l.push(taller.entrada)

  // --- El cuadro de mando, si el taller lo trae ------------------------------
  //
  // ⚠️ **Opcional y calculado.** Lo lleva el 13 y no el 6, porque el 13 tiene
  // seis filtros comparables entre sí y el 6 son nueve bloques de argumento que
  // no forman una serie. Un cuadro de mando sobre cosas que no son comparables
  // es decoración. Los casos se cuentan de la propia lista de cada bloque.
  if (taller.cuadro) {
    const q = taller.cuadro
    const conFiltro = taller.bloques.filter((b) => b.filtro)
    const casos = conFiltro.reduce((t, b) => t + (b.casos?.length ?? 0), 0)
    l.push('')
    l.push(`## ${q.titulo}`)
    l.push('')
    l.push(q.entrada)
    l.push('')
    l.push('| # | Se resuelve con | Casos | Quién lo hace | Naturaleza |')
    l.push('|---|---|---|---|---|')
    conFiltro.forEach((b, i) => {
      l.push(
        `| **${i + 1}** | ${b.filtro} | ${(b.casos ?? []).length} | ${b.dueno ?? '—'} | ${b.naturaleza ?? '—'} |`
      )
    })
    l.push('')
    l.push(q.cierre.replaceAll('{CASOS}', String(casos)))
  }

  for (const bloque of taller.bloques) {
    l.push('')
    l.push(`## ${bloque.titulo}`)
    l.push('')
    l.push(bloque.texto)
    // Los casos del filtro. **Un caso puede ser una etiqueta o una fila.** Con
    // etiquetas sueltas salen en viñetas —en tabla de una columna se leerían
    // peor—; en cuanto el taller le pone detalle al lado, el mismo bloque sale
    // en tabla. Así una categoría gana columnas sin tocar el generador, y el
    // conteo del cuadro de mando sigue siendo el mismo `casos.length`.
    if (bloque.casos?.length) {
      l.push('')
      if (bloque.casos.every((c) => Array.isArray(c))) {
        const cab = bloque.cabeceras ?? ['Caso', 'Qué hace falta']
        l.push(`| ${cab.join(' | ')} |`)
        l.push(`|${cab.map(() => '---').join('|')}|`)
        for (const c of bloque.casos) l.push(`| **${c[0]}** | ${c.slice(1).join(' | ')} |`)
      } else {
        for (const c of bloque.casos) l.push(`- ${c}`)
      }
    }
    pegarCitas(l, bloque, ctx)
  }

  const destacados = (() => {
    try {
      return JSON.parse(leerTaller('hallazgos-destacados.json'))
    } catch {
      return null
    }
  })()

  if (destacados && taller.hallazgos?.length) {
    const enlaces = SIN_ENLACES_A_HALLAZGOS ? [] : enlacesAHallazgos(destacados, taller.hallazgos, etiqueta)
    if (enlaces.length) {
      l.push('')
      l.push('## Los hallazgos de este capítulo')
      l.push('')
      l.push(entradaDeHallazgos)
      l.push('')
      l.push(...enlaces)
    }
  }

  if (taller.cierre) {
    l.push('')
    l.push('---')
    l.push('')
    l.push(taller.cierre)
  }

  if (huerfanas.length) {
    console.warn(`  ⚠️ ${etiqueta}: ${huerfanas.length} cita(s) sin casar en la base:`)
    for (const h of huerfanas) console.warn(`     ${h}`)
  } else {
    console.log(`  · ${etiqueta}: ${taller.bloques.length} bloques, todas las citas casaron`)
  }

  return l.join('\n')
}

const sistemasYDato = async () => {
  const md = await capituloConCitas(
    'sistemas-datos.json',
    'sistemas-datos',
    'Los que el capítulo 9 desarrolla sobre sistemas y calidad del dato, cada uno con su cita completa:'
  )
  if (!md) return null
  // Las cifras que no coinciden cierran este capítulo, y no por comodidad: el
  // capítulo argumenta que **no hay una sola fuente de verdad**, y estas seis son
  // esa tesis contada en números.
  const dis = tablaDeDiscrepancias('sistemas-datos')
  return dis.length ? `${md}\n${dis.join('\n')}` : md
}

// =============================================================================
// 11) DÓNDE NO VA LA IA
// =============================================================================
//
// El par de la 10: aquella dice qué se puede hacer y esta qué no —y, sobre todo,
// qué se resuelve sin un modelo.
//
// ⚠️ **No es el negativo de la 10.** Tiene argumento propio: los cuatro filtros
// —configurar, conectar, decidir y comprar— y los límites que pusieron las
// personas entrevistadas, que son el mejor insumo de gobierno del levantamiento.
// Repetir aquí la lista de oportunidades desincroniza los dos capítulos.

const dondeNoVaLaIA = () =>
  capituloConCitas(
    'donde-no-va-la-ia.json',
    'donde-no-va-la-ia',
    'Los del capítulo 9 que sostienen este límite, cada uno con su cita completa:'
  )

// =============================================================================
// 12) LA ARQUITECTURA PROPUESTA
// =============================================================================
//
// El plano, y llega después de «qué se puede» y «qué no», que es el orden que
// manda el armazón.
//
// ⚠️ **Las reglas van antes que el dibujo.** En el armazón viejo «Principios» y
// «Gobierno del dato» eran secciones aparte; aquí se absorben, porque una
// arquitectura sin sus reglas se lee como un catálogo de cajas y la fase 2 la
// ejecuta eligiendo herramientas sin saber qué no puede romper.
//
// ⚠️ El diagrama de capas va en **bloque de código monoespaciado**: el
// renderizador no tiene mermaid, y `.prosa pre` ya trae `overflow-x-auto`, así
// que un dibujo ancho se desplaza dentro de su caja en vez de romper la página.

const laArquitectura = () =>
  capituloConCitas(
    'arquitectura-ia.json',
    'arquitectura-ia',
    'Los del capítulo 9 de los que se derivan estas reglas y estas capas:'
  )

// =============================================================================
// 13) HOJA DE RUTA
// =============================================================================
//
// Secuencia, dependencias y puntos de control. **No fechas de Fase 2**: esas
// dependen de una decisión que todavía no se ha tomado, y comprometerlas antes
// sería inventarlas.
//
// ⚠️ **Las fechas del contrato no se escriben en el taller**: se leen de
// `lib/programa.ts`, que es donde viven. Si el calendario se corre —ya se corrió
// una vez, para que el comité apruebe con el documento en la mano—, el capítulo
// se corrige solo en vez de contradecir al panel del programa.
//
// ⚠️ Y el conteo de hallazgos validados sale de la base en cada corrida. Es el
// punto de control más urgente del capítulo y cambia todos los días; escrito a
// mano, envejece en una tarde y deja el cierre diciendo una cifra falsa.

/**
 * Una constante de fecha de `lib/programa.ts`, leída del archivo.
 *
 * Es un `.ts` y esto es un `.mjs`, así que se extrae con expresión regular en
 * vez de importarlo. Feo, pero mantiene **una sola fuente** para el calendario
 * contractual: el panel del programa y el informe no pueden decir fechas
 * distintas del mismo contrato.
 */
function fechaDelPrograma(nombre) {
  try {
    const src = readFileSync('lib/programa.ts', 'utf8')
    // ⚠️ `\\d` doble: en un template literal, `\d` pierde la barra invertida y
    // el patrón pasa a buscar la letra «d». Fallaba en silencio devolviendo null.
    const m = src.match(new RegExp(`export const ${nombre} = '(\\d{4}-\\d{2}-\\d{2})'`))
    return m?.[1] ?? null
  } catch {
    return null
  }
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * «2026-12-06» → «diciembre de 2026».
 *
 * ⚠️ **Sin el día, a propósito.** El informe decía «el comité decide el 6 de
 * diciembre de 2026», que es la fecha en que vence el aviso de no renovación —
 * un dato del contrato, no una convocatoria. Puesto así se leía como una
 * citación, y además se rompe solo si el calendario se corre. El mes basta para
 * lo que la frase tiene que decir.
 */
function enMes(iso) {
  if (!iso) return null
  const [a, m] = iso.split('-').map(Number)
  return `${MESES[m - 1]} de ${a}`
}

/** «2026-12-06» → «6 de diciembre de 2026». */
function enPalabras(iso) {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

async function laHojaDeRuta() {
  const aviso = enMes(fechaDelPrograma('AVISO_RENOVACION'))
  const cierre = enPalabras(fechaDelPrograma('CIERRE_FASE'))
  if (!aviso || !cierre) {
    console.error('  ✖ hoja-de-ruta: no se pudieron leer las fechas de lib/programa.ts; no se escribe.')
    return null
  }

  const { data: todos } = await admin.from('hallazgos').select('estado')
  const total = (todos ?? []).length
  const validados = (todos ?? []).filter((h) => h.estado === 'validado').length

  const md = await capituloConCitas(
    'hoja-de-ruta.json',
    'hoja-de-ruta',
    'Los del capítulo 9 que esta hoja de ruta tiene que atender primero:'
  )
  if (!md) return null

  console.log(
    `  · hoja-de-ruta: decide el ${aviso} · ${validados} de ${total} hallazgos validados` +
      (validados < total / 2 ? ' · ⚠️ el documento descansa sobre material sin confirmar' : '')
  )

  // Las palabras en letra para que el texto no diga «2 hallazgos» en medio de
  // un párrafo escrito en prosa.
  const enLetraCorta = { 0: 'ninguno', 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco' }
  const vTexto = enLetraCorta[validados] ?? String(validados)

  return md
    .replaceAll('{AVISO}', aviso)
    .replaceAll('{CIERRE}', cierre)
    .replaceAll('{TOTAL}', String(total))
    .replaceAll('{VALIDADOS}', vTexto)
}

// =============================================================================
// 7) INVENTARIO DE SISTEMAS
// =============================================================================
//
// El respaldo del capítulo 6: sistema por sistema, con su dueño, su estado y su
// rastro.
//
// ⚠️ **No usa `anexoInventario`**, que era la generadora del armazón viejo. Esa
// lista los hallazgos de `tipo = 'sistema'`, que son hallazgos **sobre**
// sistemas y no sistemas: la columna «Sistema» decía «El MRP no corre en el
// ERP» y «Almacén de repuestos con inventario mínimo de dos unidades». Tampoco
// traía dueño ni estado, que es lo que promete el subtítulo, y le colgaba una
// tabla de los documentos del expediente, que no son sistemas. Se queda escrita
// por si el anexo vuelve; este capítulo sale de `inventario-sistemas.json`.
//
// ⚠️ **El rastro no se escribe a mano.** Un inventario con las sesiones
// tecleadas envejece a la primera cosecha, y la cifra es justo lo que un lector
// usa para calibrar cuánto pesa cada sistema. Lo cuenta `rastroDeSistema()`
// buscando los alias en las notas del levantamiento.

/**
 * En qué sesiones se nombró un sistema.
 *
 * Los alias son expresiones regulares porque los nombres cortos necesitan
 * frontera de palabra —`JD`, `EXA`, `ATC`, `SPI` aparecen dentro de otras
 * palabras— y los largos tienen variantes de escritura: «Star Quality»,
 * «StarQuality», «Star Point».
 */
function rastroDeSistema(alias, notas) {
  const re = new RegExp((alias ?? []).join('|'), 'i')
  const codigos = []
  for (const [codigo, texto] of notas) {
    if (re.test(texto)) codigos.push(codigo)
  }
  return codigos.sort()
}

/** Las notas del levantamiento en memoria, sin las que no pueden usarse. */
function leerNotas() {
  const notas = []
  try {
    for (const f of readdirSync(NOTAS)) {
      if (!f.endsWith('.md')) continue
      const codigo = f.replace(/\.md$/, '')
      if (SIN_CONSENTIMIENTO.has(codigo)) continue
      notas.push([codigo, readFileSync(resolve(NOTAS, f), 'utf8')])
    }
  } catch {
    return null
  }
  return notas
}

/**
 * El rastro, escrito para leerse. Hasta cuatro sesiones se enumeran; a partir
 * de ahí el número dice más que la lista — `JD Edwards` aparece en treinta y
 * enumerarlas llena la celda sin informar.
 */
function rastroEnTexto(codigos) {
  // Sin códigos la columna sigue sirviendo: lo que informa es **en cuántas
  // sesiones apareció el sistema**, que es la medida de cuán extendido está.
  // Cuál sesión exactamente es lo que se fue al expediente.
  if (SIN_CODIGOS) {
    if (!codigos.length) return '—'
    return `${codigos.length} ${codigos.length === 1 ? 'sesión' : 'sesiones'}`
  }
  if (!codigos.length) return '`sin rastro en notas`'
  if (codigos.length <= 4) return codigos.map((c) => `\`${c}\``).join(' ')
  return `**${codigos.length}** sesiones`
}

async function inventarioDeSistemas() {
  const crudo = leerTaller('inventario-sistemas.json')
  if (!crudo) return null
  const taller = JSON.parse(crudo)

  const notas = leerNotas()
  if (!notas) {
    console.error('  ✖ inventario-sistemas: no se pudieron leer las notas; no se escribe.')
    return null
  }

  const l = []
  l.push(taller.entrada)

  let total = 0
  let sinRastro = 0

  for (const capa of taller.capas) {
    l.push('')
    l.push(`## ${capa.titulo}`)
    l.push('')
    l.push(capa.entrada)
    l.push('')
    l.push('| Sistema | Qué hace | Dueño | Estado | Nombrado en |')
    l.push('|---|---|---|---|---|')
    for (const s of capa.sistemas) {
      total++
      const codigos = rastroDeSistema(s.alias, notas)
      if (!codigos.length) sinRastro++
      l.push(
        `| **${s.nombre}** | ${s.que} | ${s.dueno} | ${s.estado} | ${rastroEnTexto(codigos)} |`
      )
    }
    // Las notas van debajo de la tabla y no dentro: una celda con tres líneas
    // de prosa rompe el ancho de la tabla en pantalla de teléfono, y esto se
    // lee también desde el teléfono.
    const conNota = capa.sistemas.filter((s) => s.nota)
    if (conNota.length) {
      l.push('')
      for (const s of conNota) l.push(`- **${s.nombre}** — ${s.nota}`)
    }
  }

  if (taller.proveedores) {
    l.push('')
    l.push(`## ${taller.proveedores.titulo}`)
    l.push('')
    l.push(taller.proveedores.entrada)
    l.push('')
    l.push('| Proveedor | Qué sostiene | Estado de la relación |')
    l.push('|---|---|---|')
    for (const [quien, que, estado] of taller.proveedores.filas) {
      l.push(`| **${quien}** | ${que} | ${estado} |`)
    }
  }

  if (taller.cierre) {
    l.push('')
    l.push('---')
    l.push('')
    l.push(taller.cierre)
  }

  console.log(
    `  · inventario-sistemas: ${total} sistemas en ${taller.capas.length} capas` +
      (sinRastro ? ` · ⚠️ ${sinRastro} sin rastro en las notas` : '')
  )

  return l.join('\n')
}

// =============================================================================
// 3) LAS CIFRAS DEL LEVANTAMIENTO
// =============================================================================
//
// El respaldo de la 02: aquella dice cuánto se escuchó y esta qué se midió.
//
// ⚠️ **La atribución se resuelve contra `entrevistas`, no se escribe en el
// taller.** El anexo del armazón viejo la tenía a mano y se veía: tres filas
// firmadas «Jesús · ENT-004» —que es el consultor que condujo la sesión, no el
// entrevistado— y nueve firmadas con el área en vez de la persona, cuando el
// informe cita por nombre. Aquí la fila solo lleva el código y el nombre sale
// del padrón.
//
// ⚠️ Y cada fila lleva **marca**: una cifra medida y una estimación de quien
// habló se parecen mucho en una tabla y no son lo mismo. Varias de estas cifras
// terminan en la hoja de ruta, y comprometerse con un ahorro calculado sobre
// una estimación es la forma más rápida de incumplir.

/** Las marcas que puede llevar una cifra, y cómo se rotulan. */
// =============================================================================
// 10) LAS OPORTUNIDADES, PRIORIZADAS
// =============================================================================
//
// Lo que el levantamiento propone hacer, ordenado. El orden vale más que la
// lista, y la regla que lo produce es la del dato: una oportunidad de impacto
// alto cuyo dato no existe **no va primero**.
//
// ⚠️ **La guarda de este capítulo es la cobertura.** El taller referencia cada
// oportunidad por el título exacto de su hallazgo, y el generador comprueba las
// dos direcciones: que todo título del taller exista en la base, y que **toda
// oportunidad de la base esté clasificada en algún grupo**. Sin eso, reordenar
// los grupos deja caer una en silencio, que es el modo de fallar de una lista
// que se edita a mano.
//
// El impacto y el área **no se escriben en el taller**: se heredan del hallazgo.
// El taller pone lo que es juicio de priorización —costo, disponibilidad del
// dato y dependencias— y nada más.

/** Cómo se rotula la disponibilidad del dato, que es la dimensión que manda. */
const DATO_OPORTUNIDAD = {
  disponible: '✅ Disponible',
  'hay que limpiarlo': '⚠️ Hay que limpiarlo',
  'no existe': '🔴 No existe',
  '—': '—',
}

async function lasOportunidades() {
  const crudo = leerTaller('oportunidades.json')
  if (!crudo) return null
  const taller = JSON.parse(crudo)

  const { data: todas } = await admin
    .from('hallazgos')
    .select('titulo, descripcion, impacto, areas(nombre), entrevistas(codigo, entrevistado_nombre)')
    .eq('tipo', 'oportunidad_ia')
    .order('titulo')

  const porTitulo = new Map()
  for (const h of todas ?? []) {
    if (SIN_CONSENTIMIENTO.has(h.entrevistas?.codigo)) continue
    porTitulo.set(h.titulo, h)
  }

  const l = []
  const sinCasar = []
  const colocadas = new Set()
  let total = 0

  const posicionEntrada = l.length
  l.push('')

  // --- El cuadro de mando ----------------------------------------------------
  //
  // ⚠️ **Las columnas de conteo no se escriben: se cuentan.** Oportunidades por
  // grupo, cuántas son de impacto alto y qué disponibilidad de dato tienen salen
  // de la propia lista y de la base. Tecleadas serían un segundo sitio donde
  // vive el mismo dato, y al reclasificar una oportunidad dejarían de coincidir
  // con las tablas de abajo. Solo «Arranca» es criterio editorial.
  if (taller.cuadro) {
    const q = taller.cuadro
    l.push('')
    l.push(`## ${q.titulo}`)
    l.push('')
    l.push(q.entrada)
    l.push('')
    l.push('| Grupo | Oportunidades | Impacto alto | Dato | Arranca |')
    l.push('|---|---|---|---|---|')
    let altasTotal = 0
    let altasG1 = 0
    for (const grupo of taller.grupos) {
      const suyas = grupo.oportunidades ?? []
      const altas = suyas.filter((o) => porTitulo.get(o.h)?.impacto === 'alto').length
      altasTotal += altas
      if (/grupo 1/i.test(grupo.titulo)) altasG1 = altas
      // El dato es uniforme dentro de cada grupo por diseño — el grupo *es* su
      // disponibilidad de dato. Si algún día deja de serlo, se ve aquí.
      const datos = [...new Set(suyas.map((o) => o.dato))]
      const dato = datos.length === 1 ? (DATO_OPORTUNIDAD[datos[0]] ?? datos[0]) : '*mezclado*'
      l.push(
        `| **${grupo.titulo}** | ${suyas.length} | ${altas || '—'} | ${dato} | ${grupo.arranca ?? '—'} |`
      )
    }
    l.push('')
    l.push(
      q.cierre
        .replaceAll('{ALTAS}', enLetra(altasTotal))
        .replaceAll('{ALTAS1}', enLetra(altasG1))
        .replaceAll('{ALTASRESTO}', enLetra(altasTotal - altasG1))
    )
  }

  // --- Los criterios, que es lo que hace defendible el orden -----------------
  const c = taller.criterios
  l.push('')
  l.push(`## ${c.titulo}`)
  l.push('')
  l.push(c.entrada)
  l.push('')
  l.push('| Dimensión | Qué mide | Escala |')
  l.push('|---|---|---|')
  for (const [dim, que, escala] of c.filas) l.push(`| **${dim}** | ${que} | ${escala} |`)
  l.push('')
  l.push(c.regla)

  // --- El eje del consenso ---------------------------------------------------
  if (taller.consenso) {
    l.push('')
    l.push(`## ${taller.consenso.titulo}`)
    l.push('')
    l.push(taller.consenso.entrada)
    l.push('')
    for (const [cuantas, que] of taller.consenso.filas) l.push(`- **${cuantas}** · ${que}`)
  }

  // --- Los grupos ------------------------------------------------------------
  for (const grupo of taller.grupos) {
    l.push('')
    l.push(`## ${grupo.titulo}`)
    l.push('')
    l.push(grupo.entrada)
    l.push('')
    l.push('| Oportunidad | Área | Impacto | Costo | Dato | Depende de |')
    l.push('|---|---|---|---|---|---|')
    for (const o of grupo.oportunidades) {
      total++
      const h = porTitulo.get(o.h)
      if (!h) {
        sinCasar.push(`${grupo.titulo} → «${o.h}»`)
        continue
      }
      colocadas.add(o.h)
      const area = h.areas?.nombre ?? '—'
      const impacto = h.impacto ? h.impacto[0].toUpperCase() + h.impacto.slice(1) : '—'
      const dato = DATO_OPORTUNIDAD[o.dato] ?? o.dato
      l.push(
        `| **${o.h}** | ${area} | ${impacto} | ${o.costo} | ${dato} | ${o.depende} |`
      )
    }
    // La sesión de cada una va debajo: metida en la tabla, la columna de
    // «depende de» deja de caber y es la que hay que leer entera.
    l.push('')
    for (const o of grupo.oportunidades) {
      const h = porTitulo.get(o.h)
      if (!h) continue
      const quien = SIN_CODIGOS || !h.entrevistas?.codigo ? '' : `\`${h.entrevistas.codigo}\``
      l.push(`- **${o.h}** — ${h.descripcion ?? ''} ${quien ? `*(${quien})*` : ''}`)
    }
  }

  if (taller.cierre) {
    l.push('')
    l.push('---')
    l.push('')
    l.push(taller.cierre)
  }

  l[posicionEntrada] = taller.entrada.replace('{TOTAL}', String(total))

  // --- Las dos direcciones de la guarda -------------------------------------
  const huerfanas = [...porTitulo.keys()].filter((t) => !colocadas.has(t))
  if (sinCasar.length) {
    console.warn(`  ⚠️ oportunidades: ${sinCasar.length} título(s) del taller que no existen en la base:`)
    for (const s of sinCasar) console.warn(`     ${s}`)
  }
  if (huerfanas.length) {
    console.warn(`  ⚠️ oportunidades: ${huerfanas.length} oportunidad(es) de la base SIN clasificar:`)
    for (const h of huerfanas) console.warn(`     ${h}`)
  }
  console.log(
    `  · oportunidades: ${total} clasificadas de ${porTitulo.size} en la base` +
      (sinCasar.length || huerfanas.length ? ' · ⚠️ revisar' : ' · cobertura completa')
  )

  return l.join('\n')
}

// =============================================================================
// 1) RESUMEN EJECUTIVO
// =============================================================================
//
// Se escribe el último porque resume a los demás, y va primero en el documento.
//
// ⚠️ **Ninguna cifra se escribe a mano.** Todas se calculan en la corrida, desde
// la base y desde el inventario, que es de donde las sacan los capítulos que
// resume. Un resumen ejecutivo con una cifra que ya no coincide con su capítulo
// es la forma más rápida de que el lector deje de creer el documento entero — y
// es justo la sección donde más tienta escribirlas, porque son pocas.

/**
 * El cuadro de cobertura que abre el informe.
 *
 * Es lo que quedó de la vieja sección 2 cuando se le quitaron los nombres y los
 * códigos: **cuánto se escuchó, sin decir a quién**. Y es lo que un resumen
 * ejecutivo quiere arriba — un comité pregunta primero sobre cuánta base
 * descansa lo que va a leer.
 *
 * ⚠️ **Ni una cifra se escribe.** Salen de la base y del inventario, que es la
 * razón de que este cuadro esté aquí y no en el taller: un número tecleado
 * seguiría diciendo lo mismo el día que entre una sesión más.
 *
 * ⚠️ **La sesión retenida cuenta y no se cosecha.** Se grabó sin que la persona
 * lo supiera y pidió que se borrara. Sacarla del total falsearía la cobertura;
 * nombrarla o cosecharla sería usar lo que pidió que no se usara. Cuenta, y la
 * nota al pie lo dice sin identificarla.
 */
async function cuadroDeCobertura() {
  const { data: sesiones } = await admin
    .from('entrevistas')
    .select('codigo, sede, entrevistado_nombre, areas(nombre), participantes:sesion_participantes(personas(nombre_completo))')

  const ses = sesiones ?? []
  if (!ses.length) return ''

  const de = (p) => ses.filter((x) => x.codigo?.startsWith(p)).length
  const gente = new Set()
  for (const x of ses) {
    if (x.entrevistado_nombre) gente.add(x.entrevistado_nombre.trim())
    for (const p of x.participantes ?? []) {
      if (p.personas?.nombre_completo) gente.add(p.personas.nombre_completo.trim())
    }
  }

  const porSede = new Map()
  for (const x of ses) porSede.set(x.sede, (porSede.get(x.sede) ?? 0) + 1)
  const sedes = [...porSede.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sede, n]) => `**${n}** en ${SEDES[sede] ?? 'sin sede'}`)
    .join(' · ')

  const areas = new Set(ses.map((x) => x.areas?.nombre).filter(Boolean))

  const inv = (() => {
    try {
      return JSON.parse(leerTaller('inventario-procesos.json'))
    } catch {
      return null
    }
  })()
  const macros = inv?.macroprocesos ?? []
  const procesos = macros.reduce((t, m) => t + (m.procesos?.length ?? 0), 0)

  // ⚠️ **Se enseñan los que el informe desarrolla, no los que hay en la base.**
  // «394 hallazgos documentados» en una portada invita a preguntar por los 394,
  // y el trabajo de este informe fue justamente escoger. El número sale del
  // taller de destacados, así que sigue sin escribirse.
  const destacados = (() => {
    try {
      return JSON.parse(leerTaller('hallazgos-destacados.json'))
    } catch {
      return null
    }
  })()
  const desarrollados = (destacados?.bloques ?? []).reduce((t, b) => t + b.hallazgos.length, 0)
  const patrones = (destacados?.bloques ?? []).length

  const retenidas = ses.filter((x) => SIN_CONSENTIMIENTO.has(x.codigo)).length

  const l = []
  l.push('## Lo que se cubrió')
  l.push('')
  l.push(
    'El levantamiento se hizo en sitio, área por área, con quien ejecuta el proceso y no con ' +
      'quien lo describe desde afuera. Esto es su alcance:'
  )
  l.push('')
  l.push('| | |')
  l.push('|---|---|')
  l.push(
    `| **Sesiones de levantamiento** | **${ses.length}** — ${de('ENT')} entrevistas de proceso, ` +
      `${de('SES')} reuniones y recorridos, ${de('FOR')} formaciones |`
  )
  l.push(`| **Personas escuchadas** | **${gente.size}** |`)
  l.push(`| **Dónde** | ${sedes} |`)
  l.push(`| **Áreas con sesión propia** | **${areas.size}** |`)
  l.push(`| **Procesos mapeados** | **${macros.length}** macroprocesos · **${procesos}** procesos de primer nivel |`)
  l.push(
    `| **Hallazgos desarrollados** | **${desarrollados}**, agrupados en ${patrones} patrones |`
  )
  // ⚠️ **La nota de la sesión retenida ya no se escribe.** Decía que una sesión
  // contaba en el total y no se había cosechado a solicitud de la persona
  // entrevistada: era honesto y era, a la vez, contarle al cliente algo de una
  // persona identificable por descarte. La guarda sigue viva en el generador
  // —`SIN_CONSENTIMIENTO`—, que es donde tiene efecto; lo que se quita es
  // anunciarla.

  console.log(
    `  · cobertura: ${ses.length} sesiones · ${gente.size} personas · ${areas.size} áreas · ` +
      `${desarrollados} hallazgos en ${patrones} patrones` +
      (retenidas ? ` · ${retenidas} retenida(s), contada(s) y sin anunciar` : '')
  )
  return l.join('\n')
}

/**
 * La portada del informe: de qué va, cuánto se cubrió y cuál es el mapa.
 *
 * ⚠️ **Es corta a propósito.** La sección que ocupaba este sitio era un resumen
 * ejecutivo de nueve mil caracteres que adelantaba, más breve, lo que los trece
 * capítulos siguientes argumentan con su evidencia. Un documento que se resume
 * a sí mismo en la primera página invita a no leer el resto, y la síntesis
 * envejece cada vez que cambia un capítulo — sin que nadie se acuerde.
 *
 * ⚠️ **Ni una cifra se escribe.** El cuadro de cobertura y el del mapa salen de
 * la base y del inventario. Tecleados serían un segundo sitio donde vive el
 * mismo dato, y dejarían de coincidir con los capítulos en la primera revisión.
 */
async function laPortada() {
  const aviso = enMes(fechaDelPrograma('AVISO_RENOVACION'))
  if (!aviso) {
    console.error('  ✖ inicio: no se pudo leer la fecha de lib/programa.ts; no se escribe.')
    return null
  }
  if (!INVENTARIO) {
    console.error('  ✖ inicio: sin inventario de procesos; no se escribe.')
    return null
  }

  const macros = INVENTARIO.macroprocesos
  const l = []

  l.push(
    'Iberia contrató a Boosty Digital para responder una pregunta: **dónde puede la ' +
      'inteligencia artificial mejorar su operación, y dónde no.** Este documento es la ' +
      `respuesta, y es el instrumento con el que el comité decide **hacia final de año** si el ` +
      'programa continúa.'
  )
  l.push('')
  l.push(
    'No propone tecnología antes de entender el trabajo. Lo que sigue es el trabajo tal como ' +
      'se hace hoy —proceso por proceso, sistema por sistema— y solo después qué parte de eso ' +
      'la inteligencia artificial puede mejorar. **Buena parte no la necesita**, y decirlo es ' +
      'la mitad del valor de este informe.'
  )
  l.push('')
  l.push(await cuadroDeCobertura())

  // --- El mapa, resumido -----------------------------------------------------
  //
  // Resumido de verdad: los conteos por nivel y los veinte nombres. El mapa
  // entero es el {cap:mapa-procesos} y las fichas son otro capítulo; repetirlos
  // acá sería tener tres sitios donde vive lo mismo.
  l.push('')
  l.push('## El mapa de la operación')
  l.push('')
  l.push(
    `La empresa ejecuta **${macros.length} macroprocesos** en tres niveles. Este es el índice ` +
      'de todo lo que sigue: cada uno tiene su ficha, y de cada ficha cuelgan sus procesos, ' +
      'sus sistemas y lo que le falta.'
  )
  l.push('')
  l.push('| Nivel | Qué hace | Macroprocesos | Procesos |')
  l.push('| --- | --- | ---: | ---: |')
  const QUE_HACE = {
    Estratégico: 'Orientan el rumbo',
    Operativo: 'Producen y entregan',
    Soporte: 'Sostienen a los otros dos',
  }
  for (const f of conteoPorNivel(macros)) {
    l.push(`| **${f.nivel}** | ${QUE_HACE[f.nivel] ?? '—'} | ${f.macros} | ${f.procesos} |`)
  }
  const totalN1 = macros.reduce((t, m) => t + m.procesos.length, 0)
  l.push(`| **Total** | | **${macros.length}** | **${totalN1}** |`)

  // ⚠️ **Aquí iban los veinte, uno por uno.** Se quitaron: el mapa de procesos
  // los lista enteros en el capítulo siguiente, y las fichas otra vez después.
  // Tres sitios con la misma lista es una lista que se desincroniza.

  const nuevos = macros.filter((m) => m.nuevo).length
  const enLetraMay = (n) => `${enLetra(n)[0].toUpperCase()}${enLetra(n).slice(1)}`
  l.push('')
  l.push(
    `${enLetraMay(nuevos)} de esos macroprocesos **no figuraban en el inventario de partida** y ` +
      'se ejecutan hoy. Que un macroproceso completo no estuviera en el papel es, por sí solo, ' +
      'un hallazgo.'
  )
  l.push('')
  l.push(`El mapa completo, navegable, está en el {cap:mapa-procesos}.`)

  console.log(`  · inicio: ${macros.length} macroprocesos · ${totalN1} procesos · decide el ${aviso}`)
  return l.join('\n')
}

// =============================================================================
// 9 y 10) DÓNDE SE TRABA EL TRABAJO · INVENTARIO DE TRABAS
// =============================================================================
//
// El par: el 9 afirma los patrones transversales y el 10 los enseña uno por uno.
//
// ⚠️ **En el 9 no va ninguna tabla área por área**, y en el 10 no va prosa. Son
// dos cortes del mismo material y mezclarlos es garantizar que se
// desincronicen: ya pasó con el informe por área y las fichas.
//
// ⚠️ Existieron en el armazón de 32 como «Cuellos de botella y trabajo manual»
// y se cortaron el 16 de septiembre. Vuelven porque entre «esto está mal» y
// «hagamos esto» faltaba cuantificar el dolor.

/** Los dos tipos de hallazgo que son una traba. */
const TIPOS_TRABA = ['cuello_botella', 'trabajo_manual']

const ROTULO_TRABA = {
  cuello_botella: 'Cuello de botella',
  trabajo_manual: 'Trabajo manual',
}

/** Las trabas de la base, sin las sesiones que no pueden usarse. */
async function leerTrabas() {
  const { data } = await admin
    .from('hallazgos')
    .select('tipo, titulo, descripcion, impacto, areas(nombre), entrevistas(codigo, entrevistado_nombre)')
    .in('tipo', TIPOS_TRABA)
    .order('titulo')
  return (data ?? []).filter((h) => !SIN_CONSENTIMIENTO.has(h.entrevistas?.codigo))
}

async function dondeSeTraba() {
  const crudo = leerTaller('trabas.json')
  if (!crudo) return null
  const taller = JSON.parse(crudo)

  const trabas = await leerTrabas()
  const areasTotal = new Set(trabas.map((h) => h.areas?.nombre).filter(Boolean))
  const { porClave } = await hallazgosPorClave()

  const l = []
  const huerfanas = []
  const ctx = { porClave, huerfanas, yaCitadas: new Set(), etiqueta: 'trabas' }

  l.push(
    taller.entrada
      .replaceAll('{TOTAL}', String(trabas.length))
      .replaceAll('{AREAS}', String(areasTotal.size))
  )

  // --- El cuadro de mando --------------------------------------------------
  //
  // ⚠️ **No se escribe en el taller: se cuenta.** Los casos y las áreas de cada
  // patrón salen de su propia lista, y la columna del modelo de su bandera. Un
  // resumen tecleado a mano es un segundo sitio donde vive el mismo dato, y al
  // primer patrón que gane un caso deja de coincidir con la tabla de abajo.
  const sinModelo = taller.patrones.filter((p) => !p.modelo).length
  const r = taller.resumen
  l.push('')
  l.push(`## ${r.titulo}`)
  l.push('')
  l.push(r.entrada)
  l.push('')
  // ⚠️ **Sin las columnas de conteo.** Llevaba casos, áreas y un «sí/no» de
  // modelo: los dos primeros invitaban a comparar patrones por tamaño —que es
  // justo lo que este capítulo dice que no hay que hacer, porque lo que pesa no
  // es cuántas veces ocurre sino que ocurra en áreas sin contacto— y el tercero
  // ya lo dice la columna de al lado. Queda lo único accionable: qué lo cierra.
  l.push('| # | Patrón | Se cierra con |')
  l.push('|---|---|---|')
  taller.patrones.forEach((p, i) => {
    l.push(`| **${i + 1}** | ${p.titulo} | ${p.resuelve} |`)
  })
  l.push('')
  l.push(r.cierre.replaceAll('{SINMODELO}', enLetra(sinModelo)))

  // --- Cada patrón, con su tabla de casos ----------------------------------
  taller.patrones.forEach((p, i) => {
    l.push('')
    l.push(`## ${i + 1} · ${p.titulo}`)
    l.push('')
    l.push(p.texto)
    if (p.casos?.length) {
      l.push('')
      l.push('| Dónde | Qué se traba | Lo que cuesta |')
      l.push('|---|---|---|')
      for (const [donde, que, cuesta] of p.casos) l.push(`| **${donde}** | ${que} | ${cuesta} |`)
    }
    pegarCitas(l, p, ctx)
  })

  // --- El puente al capítulo de hallazgos ------------------------------------
  const destacados = (() => {
    try {
      return JSON.parse(leerTaller('hallazgos-destacados.json'))
    } catch {
      return null
    }
  })()
  if (destacados && taller.hallazgos?.length) {
    const enlaces = SIN_ENLACES_A_HALLAZGOS ? [] : enlacesAHallazgos(destacados, taller.hallazgos, 'trabas')
    if (enlaces.length) {
      l.push('')
      l.push('## Los hallazgos de este capítulo')
      l.push('')
      l.push('Los que desarrollan estos patrones, cada uno con su cita completa:')
      l.push('')
      l.push(...enlaces)
    }
  }

  if (taller.cierre) {
    l.push('')
    l.push('---')
    l.push('')
    l.push(taller.cierre)
  }

  if (huerfanas.length) {
    console.warn(`  ⚠️ trabas: ${huerfanas.length} cita(s) sin casar:`)
    for (const h of huerfanas) console.warn(`     ${h}`)
  }
  const casos = taller.patrones.reduce((t, p) => t + (p.casos?.length ?? 0), 0)
  console.log(
    `  · trabas: ${taller.patrones.length} patrones · ${casos} casos · ${sinModelo} se cierran sin modelo · ` +
      `${trabas.length} trabas en ${areasTotal.size} áreas`
  )


  // El cuadro de fricción era el capítulo siguiente —«Inventario de trabas»— y
  // se absorbió aquí el 18 de septiembre de 2026. El par «una afirma, la otra
  // respalda» funcionaba mientras el respaldo fueran las 149 trabas; condensado
  // a un cuadro por área, un capítulo entero para una tabla no se sostiene.
  const friccion = await cuadroDeFriccion()
  if (friccion) l.push(friccion)
  return l.join('\n')
}

/**
 * El inventario, agrupado por área.
 *
 * ⚠️ **Por área y no por tipo.** Agrupado por cuello de botella contra trabajo
 * manual se lee como una taxonomía y no dice a quién llamar; por área, cada
 * gerente encuentra lo suyo de una vez y ve cuánto carga comparado con el resto.
 * El tipo va en su columna.
 */
async function cuadroDeFriccion() {
  const trabas = await leerTrabas()
  if (!trabas.length) return null

  const porArea = new Map()
  for (const h of trabas) {
    const a = h.areas?.nombre ?? 'Sin área asignada'
    if (!porArea.has(a)) porArea.set(a, [])
    porArea.get(a).push(h)
  }

  const orden = [...porArea.entries()].sort((a, b) => b[1].length - a[1].length)
  const altas = trabas.filter((h) => h.impacto === 'alto').length

  const l = []
  l.push('')
  l.push('---')
  l.push('')
  l.push(
    `Los siete patrones salen de **${trabas.length} trabas documentadas** —cuellos de botella y ` +
      `trabajo manual— repartidas en ${porArea.size} áreas, de las cuales ${altas} son de ` +
      'impacto alto. Listarlas una por una no sería un diagnóstico, sería un desahogo: **cada ' +
      `traba está en la ficha del proceso al que pertenece**. Lo que sí cambia una decisión es ` +
      'dónde se acumulan.'
  )

  // --- El cuadro de carga por área -------------------------------------------
  //
  // ⚠️ Sin esto el capítulo son veinticinco tablas seguidas: sirve de referencia
  // —cada gerente busca la suya— pero **no deja ver el conjunto**, que es la
  // pregunta que un comité hace mirando este capítulo. Para saber quién carga
  // más había que recorrer las veinticinco cabeceras contando.
  //
  // Todas las columnas se calculan. No hay nada escrito a mano.
  // ⚠️ **Aquí iba «Dónde está concentrada la fricción»**, un cuadro con una fila
  // por área y sus conteos. Se quitó el 18 de septiembre de 2026: un ranking de
  // áreas por número de trabas se lee como una tabla de culpables, y el
  // capítulo argumenta justo lo contrario — que ninguna traba pertenece al área
  // donde se ve. El reparto por área sigue disponible en el panel del programa.

  // ⚠️ **Aquí había veinticinco tablas con las 149 trabas, una por una**, y era
  // un capítulo aparte. Se quitaron el 18 de septiembre de 2026 al fundir los
  // dos capítulos: veinticinco tablas seguidas sirven de referencia —cada
  // gerente busca la suya— pero nadie las lee, y el detalle ya vive en la ficha
  // del proceso, que es donde se busca. Lo que no estaba en ningún sitio es el
  // conjunto, y eso es lo que se queda.
  l.push('')
  l.push(
    `Las ${trabas.length} trabas, una por una y con su proceso, están en el {cap:fichas-procesos} ` +
      'y en el panel del programa, filtrables por área y por tipo.'
  )

  console.log(`  · fricción: ${trabas.length} trabas · ${porArea.size} áreas · ${altas} de impacto alto`)
  return l.join('\n')
}

const GENERADAS = {
  inicio: laPortada,
  // Reconectadas paso a paso, a medida que se revisa cada una. El resto sigue
  // desconectado: sus generadoras están escritas arriba y esperan su turno.
  oportunidades: lasOportunidades,
  'inventario-sistemas': inventarioDeSistemas,
  'mapa-procesos': mapaDeProcesos,
  hallazgos: losHallazgos,
  'fichas-procesos': fichasDeProceso,
  'sistemas-datos': sistemasYDato,
  'donde-no-va-la-ia': dondeNoVaLaIA,
  'arquitectura-ia': laArquitectura,
  'hoja-de-ruta': laHojaDeRuta,
  'riesgo-continuidad': riesgoYContinuidad,
  trabas: dondeSeTraba,
}

/**
 * Las secciones de prosa. Las que reciben hallazgos los pegan debajo de su
 * entrada; las demás salen enteras del taller.
 */
function conHallazgos(intro) {
  return async (slug) => {
    const bloques = hallazgosDe(slug)
    if (!intro) return bloques
    return bloques ? `${intro}

---

${bloques}` : intro
  }
}

const BORRADORES = {
  metodo: borradorMetodo,
  'como-leer': async () => {
    const md = leerTaller('HALLAZGOS.md')
    if (!md) return null
    // La apertura del informe de hallazgos explica qué se leyó, qué se recortó y
    // por qué, y cuáles son los dos patrones de fondo. Eso es exactamente «cómo
    // leer este informe». El cierre —lo que todavía no se puede afirmar— va con
    // ella: quien empieza a leer tiene derecho a saber dónde están los límites.
    const apertura = md.match(/^## Qué se leyó[\s\S]*?(?=^## I ·)/m)?.[0]?.trim()
    const limites = md
      .match(/^## Lo que este informe todavía no puede afirmar[\s\S]*/m)?.[0]
      ?.trim()
    return [apertura, limites].filter(Boolean).join('\n\n---\n\n') || null
  },
  dependencias: conHallazgos(BORRADOR_DEPENDENCIAS),
  'estado-del-dato': conHallazgos(BORRADOR_ESTADO_DATO),
  'procesos-clave': conHallazgos(null),
  // `sistemas-datos` salió de aquí: ahora se genera del taller (ver `sistemasYDato`).
  'cuellos-botella': conHallazgos(null),
  madurez: conHallazgos(null),
  restricciones: conHallazgos(null),
  // `donde-no-va-la-ia` salió de aquí: ahora se genera del taller.
  'en-sus-palabras': async () => {
    const md = leerTaller('CITAS.md')
    return md ? sinPortada(md) : null
  },
  'anexo-cifras': async () => {
    const md = leerTaller('NUMEROS.md')
    return md ? sinPortada(md) : null
  },
}

// -----------------------------------------------------------------------------

await cargarRoles()

const { data: existentes } = await admin
  .from('informe_secciones')
  .select('id, slug, contenido_md')
const porSlug = new Map((existentes ?? []).map((s) => [s.slug, s]))

let creadas = 0
let reordenadas = 0
let generadas = 0
let escritas = 0
let respetadas = 0
const sinFuente = []

for (const [i, [parte, slug, titulo, subtitulo]] of SECCIONES.entries()) {
  const numero = String(i + 1).padStart(2, '0')
  const orden = (i + 1) * 10
  const previa = porSlug.get(slug)

  let contenido
  if (GENERADAS[slug]) {
    // Los anexos se regeneran siempre: son el reflejo de la base.
    //
    // ⚠️ Salvo que la generadora no tenga con qué. Devolvía `null` cuando le
    // faltaba su archivo del taller, y `null` no es `undefined`: la sección se
    // guardaba vacía y se perdía lo que ya estaba escrito. Sin fuente no se
    // escribe nada y se deja lo que haya.
    const generado = await GENERADAS[slug]()
    if (generado && generado.trim()) {
      contenido = generado
      generadas++
    } else {
      sinFuente.push(slug)
    }
  } else if (BORRADORES[slug]) {
    if (previa?.contenido_md?.trim() && !rehacer) {
      // Alguien ya escribió aquí. El editor manda.
      respetadas++
    } else {
      const nuevo = await BORRADORES[slug](slug)
      if (nuevo) {
        contenido = nuevo
        escritas++
      }
    }
  }

  const fila = { parte, slug, numero, titulo, subtitulo, orden }
  // Un solo sitio por donde pasa todo el contenido: aquí se resuelven las
  // referencias `{cap:slug}` de un capítulo a otro, vengan de una generadora o
  // del taller. Ponerlo en cada generadora sería olvidarlo en la siguiente.
  if (contenido !== undefined) {
    // Y aquí mismo caen los nombres de pila. Va en el paso final y no en cada
    // generadora por lo mismo: la próxima generadora se olvidaría de llamarlo.
    // **Cobertura es la excepción** — ahí el nombre *es* el contenido.
    const resuelto = resolverCapitulos(contenido, slug)
    fila.contenido_md = slug === 'cobertura' ? resuelto : despersonalizar(resuelto)
  }

  if (revisar) {
    const marca = previa ? (contenido !== undefined ? '~' : '=') : '+'
    console.log(`  ${marca} ${numero} ${titulo}`)
    continue
  }

  if (previa) {
    await admin.from('informe_secciones').update(fila).eq('id', previa.id)
    reordenadas++
  } else {
    const { error } = await admin
      .from('informe_secciones')
      .insert({ ...fila, publicado: false })
    if (error) {
      console.error(`\n✖ ${slug}: ${error.message}\n`)
      process.exit(1)
    }
    console.log(`  + ${numero} ${titulo}`)
    creadas++
  }
}

// Las que quedaron fuera de la estructura nueva.
const slugs = new Set(SECCIONES.map(([, s]) => s))
const huerfanas = (existentes ?? []).filter((s) => !slugs.has(s.slug))

console.log(
  revisar
    ? '\nRevisión: no se escribió nada.\n'
    : `\n${SECCIONES.length} secciones · ${creadas} nuevas · ${reordenadas} actualizadas\n` +
      `${generadas} anexos regenerados · ${escritas} borradores escritos · ${respetadas} respetadas por tener contenido\n`
)

if (sinFuente.length) {
  console.log('Sin fuente para regenerarse — se dejó intacto lo que tenían:')
  for (const s of sinFuente) console.log(`     · ${s}`)
  console.log('')
}

if (huerfanas.length) {
  // Una huérfana vacía es un resto del armazón anterior y estorba en el editor.
  // Una huérfana con texto es trabajo de alguien: esa no se toca ni con --podar.
  const vacias = huerfanas.filter((h) => !(h.contenido_md ?? '').trim())
  const conTexto = huerfanas.filter((h) => (h.contenido_md ?? '').trim())

  if (podar && vacias.length && !revisar) {
    await admin
      .from('informe_secciones')
      .delete()
      .in('id', vacias.map((v) => v.id))
    console.log(`Podadas ${vacias.length} secciones huérfanas y vacías:`)
    for (const v of vacias) console.log(`     · ${v.slug}`)
    console.log('')
  } else if (vacias.length) {
    console.log('Fuera de la estructura y vacías — se van con --podar:')
    for (const v of vacias) console.log(`     · ${v.slug}`)
    console.log('')
  }

  if (conTexto.length) {
    console.log('⚠️  Fuera de la estructura pero CON contenido, no se borran nunca:')
    for (const h of conTexto) {
      console.log(`     · ${h.slug} · ${h.contenido_md.trim().length} caracteres`)
    }
    console.log('')
  }
}

console.log('Todo entra sin publicar. Se publica a mano desde /dashboard/informe.\n')
