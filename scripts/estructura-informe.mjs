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
 *  1. **La estructura.** Crea o actualiza las 32 secciones con su número, parte y
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
import { readFileSync } from 'node:fs'
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
  ['portada', 'resumen-ejecutivo', 'Resumen ejecutivo', 'El encargo, qué encontramos y qué proponemos'],

  // --- Levantamiento ---------------------------------------------------------
  // El orden es el del argumento, y va por pares: una sección afirma y la
  // siguiente la respalda. Cobertura dice cuánto se escuchó y las cifras qué se
  // midió; «Sistemas y estado del dato» argumenta y el inventario lo enseña.
  ['levantamiento', 'cobertura', 'Cobertura del levantamiento', 'Qué se cubrió, con quién y con qué profundidad'],
  ['levantamiento', 'cifras', 'Las cifras del levantamiento', 'Solo lo que alguien dijo explícitamente, con su fuente'],
  ['levantamiento', 'mapa-procesos', 'El mapa de procesos', 'El índice vivo: veinte macroprocesos y los procesos que se ejecutan hoy'],
  // Absorbe el informe de levantamiento por área: la ficha corta por proceso y
  // lleva dentro «Quién lo contó». Dos cortes del mismo material se
  // desincronizan en cuanto alguien edita uno.
  ['levantamiento', 'fichas-procesos', 'Las fichas de proceso', 'Una por macroproceso: qué hace, quién lo ejecuta, quién lo contó y qué le falta'],
  ['levantamiento', 'sistemas-datos', 'Sistemas y estado del dato', 'Qué vive en el ERP, qué vive fuera y qué dato es confiable'],
  ['levantamiento', 'inventario-sistemas', 'Inventario de sistemas', 'Sistema por sistema, con su dueño, su estado y su rastro'],
  ['levantamiento', 'riesgo-continuidad', 'Riesgo y continuidad', 'El incidente de febrero visto desde treinta y cuatro entrevistas'],
  // La bisagra: todo lo anterior los construye, todo lo posterior actúa sobre ellos.
  ['levantamiento', 'hallazgos', 'Los hallazgos', 'Lo que encontramos, cada uno con su cita'],

  // --- Arquitectura ----------------------------------------------------------
  // Primero qué se puede hacer y qué no, después con qué reglas, y solo entonces
  // el plano. Al revés, el plano parece la respuesta antes de la pregunta.
  ['arquitectura', 'oportunidades', 'Las oportunidades, priorizadas', 'Impacto, costo, dependencias y disponibilidad del dato'],
  ['arquitectura', 'donde-no-va-la-ia', 'Dónde no va la IA', 'Lo que se resuelve sin un modelo, y por qué decirlo importa'],
  ['arquitectura', 'arquitectura-ia', 'La arquitectura propuesta', 'El plano completo: capas, flujos de datos y conexiones al núcleo'],
  ['arquitectura', 'hoja-de-ruta', 'Hoja de ruta', 'Fases siguientes: secuencia, dependencias y puntos de control'],
]

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

/**
 * Sección 02 · Cobertura del levantamiento.
 *
 * Era el anexo de sesiones. Como sección tiene que responder algo más que «qué
 * se escuchó»: **qué quedó fuera**. Por eso cierra con las áreas de Iberia que
 * no tienen ni una sesión — eso sale del dato, y es lo que un comité pregunta
 * primero.
 */
async function coberturaDelLevantamiento() {
  const { data } = await admin
    .from('entrevistas')
    .select(
      'codigo, tipo, titulo, entrevistado_nombre, entrevistado_cargo, sede, fecha_entrevista, duracion_minutos, entrevistador, areas(nombre), participantes:sesion_participantes(personas(nombre_completo), rol)'
    )
    .order('fecha_entrevista', { ascending: true })
    .order('codigo', { ascending: true })

  const sesiones = data ?? []
  const entrevistas = sesiones.filter((s) => s.tipo === 'entrevista')
  const minutos = sesiones.reduce((t, s) => t + (s.duracion_minutos ?? 0), 0)

  const { count: turnos } = await admin
    .from('transcripcion_segmentos')
    .select('*', { count: 'exact', head: true })

  const filas = sesiones.map((s) => {
    const nombre = s.titulo || s.entrevistado_nombre || s.codigo
    const gente = (s.participantes ?? [])
      .map((p) => p.personas?.nombre_completo)
      .filter(Boolean)
      .join(', ')
    return `| \`${s.codigo}\` | ${fecha(s.fecha_entrevista)} | ${nombre}${
      s.entrevistado_cargo ? ` · ${s.entrevistado_cargo}` : ''
    } | ${s.areas?.nombre ?? '—'} | ${SEDES[s.sede] ?? '—'} | ${
      s.duracion_minutos ? `${s.duracion_minutos} min` : '—'
    } | ${gente || '—'} |`
  })


  // Lo que no se escuchó importa tanto como lo que sí. Se excluye al equipo
  // consultor, que no es un área de Iberia.
  const { data: areas } = await admin.from('areas').select('id, nombre').order('nombre')
  const { data: conArea } = await admin.from('entrevistas').select('area_id')
  // Un área está cubierta si tiene sesión propia **o si alguien suyo estuvo en
  // alguna**: la Jefatura de Laboratorio no tiene entrevista, pero su jefa
  // condujo el recorrido de planta. Contar solo por `entrevistas.area_id` la
  // daba por no escuchada, que es falso.
  const { data: asistentes } = await admin
    .from('sesion_participantes')
    .select('personas(area_id)')
  const conSesion = new Set((conArea ?? []).map((e) => e.area_id).filter(Boolean))
  for (const a of asistentes ?? []) {
    if (a.personas?.area_id) conSesion.add(a.personas.area_id)
  }

  const deIberia = (areas ?? []).filter((a) => !/Boosty|consultor/i.test(a.nombre))
  const sinSesion = deIberia.filter((a) => !conSesion.has(a.id))
  const cubiertas = deIberia.length - sinSesion.length

  const hueco = sinSesion.length
    ? [
        '',
        '## Lo que quedó fuera',
        '',
        `**${cubiertas} de las ${deIberia.length} áreas** de la estructura estuvieron en alguna sesión, con entrevista propia o a través de alguien de su equipo. Las ${sinSesion.length} que no:`,
        '',
        ...sinSesion.map((a) => `- ${a.nombre}`),
        '',
        'No todas pesan igual: varias son jefaturas dentro de una dirección que sí se entrevistó, y lo suyo se recogió por boca de quien las dirige. Pero ninguna afirmación de este documento se apoya en una fuente propia de estas áreas.',
      ].join('\n')
    : ''


  return `Este capítulo dice **qué se escuchó y qué no**, porque todo lo que viene después se
apoya en eso. Las sesiones marcadas \`SES-\` son reuniones de comité y recorridos de planta;
las \`ENT-\` son las entrevistas estructuradas que cuentan contra las ~25 que compromete el
programa; las \`FOR-\` son formaciones y no cuentan contra esa meta.

**${entrevistas.length} entrevistas** —el programa comprometía ~25— · ${sesiones.length} sesiones en total ·
${Math.round(minutos / 60)} horas de grabación · **${(turnos ?? 0).toLocaleString('es-VE')} turnos** transcritos.

## El registro completo

| Código | Fecha | Quién | Área | Sede | Duración | Participantes |
|---|---|---|---|---|---|---|
${filas.join('\n')}
${hueco}

> Las transcripciones completas están en el módulo de entrevistas del panel. Cada
> afirmación de este informe que provenga de una sesión lleva su cita textual y el
> código de la sesión donde se dijo.`
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
  const { count: hallazgos } = await admin
    .from('hallazgos')
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
  return `${macro.nivel} ${macro.numero} · ${macro.nombre}`
}

/**
 * ⚠️ El enlace del mapa a una ficha es **entre páginas**: desde que cada sección
 * del informe es su propia ruta, un `#ancla` a secas se queda en el mapa y no
 * lleva a ninguna parte. El destino es la página de las fichas más el ancla.
 */
const RUTA_FICHAS = '/informe/fichas-procesos'

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
      l.push(`### ${nivelActual}`)
      l.push('')
    }
    const marca = m.nuevo ? ' · **nuevo**' : ''
    l.push(
      `**${m.numero}. [${m.nombre}](${RUTA_FICHAS}#${anclaDe(m)})** — ${m.procesos.length} procesos${marca}`
    )
    l.push('')
  }

  if (nuevos.length) {
    l.push('')
    l.push('### Los macroprocesos que el inventario no recogía')
    l.push('')
    l.push(
      'Ninguno de estos seis es una propuesta: los seis se ejecutan hoy y ninguno tenía sitio en el ' +
        'mapa anterior. Que un macroproceso completo no estuviera en el papel es, por sí solo, un hallazgo.'
    )
    l.push('')
    for (const m of nuevos) {
      l.push(`- **${m.nombre}** *(${m.nivel})* — ${m.procesos.length} procesos`)
    }
    l.push('')
  }

  return l.join('\n')
}

async function fichasDeProceso() {
  if (!INVENTARIO) return null
  const macros = INVENTARIO.macroprocesos

  const l = []
  l.push(
    'Una ficha por macroproceso, con el mismo formato en las veinte. Es el formato el que hace el ' +
      'trabajo: cuando todas las fichas responden a las mismas preguntas, lo que falta en una se ve ' +
      'sin tener que buscarlo.'
  )
  l.push('')
  l.push(
    'La regla de escritura es que **cada línea sostenga un hallazgo**. Si una línea solo describe, sobra: ' +
      'este documento no es un manual de procesos y las guías de entrevista dicen explícitamente que no ' +
      'lo estamos produciendo.'
  )
  l.push('')

  let nivelActual = ''
  for (const m of macros) {
    if (m.nivel !== nivelActual) {
      nivelActual = m.nivel
      l.push('')
      l.push(`## ${nivelActual}`)
      l.push('')
    }

    l.push('')
    l.push(`### ${tituloDeFicha(m)}`)
    if (m.nuevo) {
      l.push('')
      l.push('> **Macroproceso nuevo.** No figuraba en el inventario de partida.')
    }
    l.push('')
    l.push('**Qué hace hoy** — `pendiente de redactar · tres líneas, y cada una con su hallazgo`')
    l.push('')
    l.push(`**Quién lo ejecuta** — ${duenosDe(m)}`)
    l.push('')
    l.push('**Sistemas** — `pendiente · qué vive en JD, qué en Excel y qué en ningún sitio`')
    l.push('')
    l.push('**Dato disponible** — `pendiente · sí / parcial / no, y desde cuándo`')
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
    l.push('**Hallazgos** — `pendiente · los que sostiene este macroproceso, con su cita textual`')

    if (m.no_se_hace.length) {
      l.push('')
      l.push('**Lo que NO se hace**')
      l.push('')
      for (const p of m.no_se_hace) {
        const marca = p.estado === 'SIN EVIDENCIA' ? 'sin evidencia' : 'no se ejecuta'
        const fuente = p.fuente && p.fuente !== '—' ? ` *(${p.fuente})*` : ''
        l.push(`- **${p.nombre}** · ${marca} — ${p.observacion}${fuente}`)
      }
    }
    l.push('')
    l.push('---')
  }

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
    `El levantamiento produjo **${total} hallazgos**, cada uno con la cita textual de quien lo dijo ` +
      `y la sesión donde se dijo. Este capítulo no los lista todos: escoge los **${redactados}** que ` +
      'sostienen el argumento del documento. El resto está en el índice del final y, con su ficha ' +
      'completa, en el panel del levantamiento.'
  )
  l.push('')
  l.push(
    'El criterio de selección fue el mismo para todos: **impacto alto, y al menos dos voces ' +
      'independientes o una consecuencia medible detrás**. Lo que dijo una sola persona una sola vez ' +
      'quedó fuera, por cierto que sea.'
  )
  l.push('')
  l.push(
    '> Todos entran como **propuestos**. Un hallazgo propuesto no es un hallazgo: es un candidato ' +
      'con su cita, hasta que alguien que estuvo en esa entrevista lo valida o lo descarta.'
  )

  let n = 0
  for (const bloque of destacados.bloques) {
    l.push('')
    l.push(`## ${bloque.titulo}`)
    l.push('')
    l.push(bloque.entrada)

    for (const h of bloque.hallazgos) {
      n++
      const clave = String(n).padStart(2, '0')
      l.push('')
      l.push(`### H-${clave} · ${h.titulo}`)
      l.push('')
      l.push(h.texto)

      for (const [cod, tit] of h.fuentes) {
        const f = porClave.get(`${cod}|${tit}`)
        if (!f) {
          huerfanas.push(`H-${clave} → ${cod} · ${tit}`)
          continue
        }
        if (!f.cita_textual?.trim()) continue
        const firma = [f.entrevistas?.entrevistado_nombre, f.areas?.nombre].filter(Boolean).join(' · ')
        l.push('')
        l.push(`> «${f.cita_textual.trim()}»`)
        l.push(`> — ${firma || 'Sin identificar'} · \`${cod}\``)
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

  l.push('')
  l.push('## Dónde está el resto')
  l.push('')
  l.push(
    `Los otros ${total - marcados.size} hallazgos no son descarte: son el detalle que sostiene lo ` +
      'anterior y el material de las fichas de proceso. Cada uno está en el panel del levantamiento ' +
      'con su cita, su sesión y su área, filtrable por tipo y por estado. Este es su reparto:'
  )
  l.push('')
  l.push('| Área | Total | Desarrollados | Cuello | Manual | Riesgo | Dato | IA | Sist. | Sup. |')
  l.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')

  for (const [area, lista] of [...porArea.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const dest = lista.filter((h) => marcados.has(`${h.entrevistas?.codigo}|${h.titulo}`)).length
    const cuenta = TIPOS.map((t) => lista.filter((h) => h.tipo === t).length || '')
    l.push(`| ${area} | ${lista.length} | ${dest || ''} | ${cuenta.join(' | ')} |`)
  }
  l.push(`| **Total** | **${total}** | **${marcados.size}** | ${TIPOS.map((t) => `**${(todos ?? []).filter((h) => h.tipo === t).length}**`).join(' | ')} |`)

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
const GENERADAS = {
  // Reconectadas paso a paso, a medida que se revisa cada una. El resto sigue
  // desconectado: sus generadoras están escritas arriba y esperan su turno.
  cobertura: coberturaDelLevantamiento,
  'mapa-procesos': mapaDeProcesos,
  hallazgos: losHallazgos,
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
  'sistemas-datos': conHallazgos(null),
  'cuellos-botella': conHallazgos(null),
  madurez: conHallazgos(null),
  restricciones: conHallazgos(null),
  'donde-no-va-la-ia': conHallazgos(null),
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
  if (contenido !== undefined) fila.contenido_md = contenido

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
