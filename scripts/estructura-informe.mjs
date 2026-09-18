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
  // ⚠️ El subtítulo **no lleva el número de sesiones**, y es a propósito: lo
  // llevaba —decía «treinta y cuatro», cuando son diecisiete— y un subtítulo es
  // texto fijo que nadie recuerda corregir cuando el conteo cambia. La cifra
  // auditada vive en la primera línea del capítulo, que la calcula el generador.
  ['levantamiento', 'riesgo-continuidad', 'Riesgo y continuidad', 'El incidente de febrero visto desde las áreas que lo vivieron'],
  // Dónde se traba el trabajo y su inventario. Entran en pareja, como manda la
  // regla: el primero afirma los patrones y el segundo los enseña uno por uno.
  // ⚠️ Existieron en el armazón de 32 como «Cuellos de botella y trabajo
  // manual» y se cortaron el 16 de septiembre. Vuelven porque entre «esto está
  // mal» y «hagamos esto» faltaba cuantificar el dolor, que es lo que un comité
  // pregunta antes de aprobar un presupuesto.
  ['levantamiento', 'trabas', 'Dónde se traba el trabajo', 'Los patrones que se repiten, con su costo en tiempo y margen'],
  ['levantamiento', 'inventario-trabas', 'Inventario de trabas', 'Traba por traba, con su área, su tipo y la sesión donde se dijo'],
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

  // ⚠️ **La sesión sin consentimiento cuenta pero no se acredita.** Sigue en la
  // tabla —ocurrió, y quitarla dejaría un hueco en un conteo que otros capítulos
  // citan— pero sin nombre, sin cargo, sin área y sin duración. Y su nombre se
  // filtra también de los participantes de **las demás** sesiones: el criterio
  // acordado es que no aparezca en ninguna parte del documento.
  const vetados = new Set(
    sesiones
      .filter((s) => SIN_CONSENTIMIENTO.has(s.codigo))
      .map((s) => s.entrevistado_nombre)
      .filter(Boolean)
  )
  if (vetados.size) {
    console.log(`  · cobertura: ${vetados.size} sesión(es) retenida(s), contadas y sin acreditar`)
  }

  const filas = sesiones.map((s) => {
    if (SIN_CONSENTIMIENTO.has(s.codigo)) {
      return `| \`${s.codigo}\` | ${fecha(s.fecha_entrevista)} | **Sesión retenida** · sin consentimiento de grabación | — | ${SEDES[s.sede] ?? '—'} | — | — |`
    }
    const nombre = s.titulo || s.entrevistado_nombre || s.codigo
    const gente = (s.participantes ?? [])
      .map((p) => p.personas?.nombre_completo)
      .filter((n) => n && !vetados.has(n))
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
  return [area, codigo ? `\`${codigo}\`` : null].filter(Boolean).join(' · ')
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
 * Quién contó este macroproceso: las sesiones que documentaron **más de uno** de
 * sus procesos, y si ninguna llega a dos, las que haya. Listarlas todas producía
 * párrafos de diez nombres —Capital Humano citaba a diez personas— que no dicen
 * quién es la fuente de verdad del proceso.
 */
function quienesContaron(macro, porSesion) {
  const cuenta = new Map()
  for (const pr of [...macro.procesos, ...macro.no_se_hace]) {
    for (const c of (pr.fuente ?? '').split(/[,;]/).map((x) => x.trim())) {
      // ⚠️ La guarda de consentimiento también aquí. Esta función es anterior a
      // `SIN_CONSENTIMIENTO` y no la tenía: el inventario trae ENT-005 como
      // fuente de varios procesos, así que la ficha la nombraba —con nombre y
      // apellido— en un capítulo del informe. No citarla incluye no acreditarla.
      if (SIN_CONSENTIMIENTO.has(c)) continue
      if (/^(ENT|SES|FOR)-\d+$/.test(c)) cuenta.set(c, (cuenta.get(c) ?? 0) + 1)
    }
  }
  if (!cuenta.size) return '`sin fuente registrada`'

  const orden = [...cuenta.entries()].sort((a, b) => b[1] - a[1])
  const principales = orden.filter(([, n]) => n > 1)
  const elegidas = (principales.length ? principales : orden).slice(0, 4)

  const gente = elegidas.map(([c, n]) => {
    const e = porSesion.get(c)
    const veces = n > 1 ? ` (${n})` : ''
    // Solo el código: la acreditación por nombre vive en la cobertura.
    return `\`${c}\`${veces}`
  })
  const resto = cuenta.size - elegidas.length
  // «sesiones» pierde la tilde en plural: no vale con pegarle «es» a «sesión».
  const cola = resto > 0 ? ` · y ${resto} ${resto > 1 ? 'sesiones' : 'sesión'} más` : ''
  return gente.join(' · ') + cola
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

  const crudoDest = leerTaller('hallazgos-destacados.json')
  const destacados = crudoDest ? JSON.parse(crudoDest) : null

  // Quién habló en cada sesión, para la línea «Quién lo contó».
  const { data: sesiones } = await admin
    .from('entrevistas')
    .select('codigo, entrevistado_nombre, entrevistado_cargo')
  const porSesion = new Map((sesiones ?? []).map((e) => [e.codigo, e]))

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
        // Misma guarda: la observación se conserva, la acreditación no.
        const cods = (p.fuente ?? '')
          .split(/[,;]/)
          .map((x) => x.trim())
          .filter((c) => c && c !== '—' && !SIN_CONSENTIMIENTO.has(c))
        const fuente = cods.length ? ` *(${cods.join(', ')})*` : ''
        l.push(`- **${p.nombre}** · ${marca} — ${p.observacion}${fuente}`)
      }
    }
    // ⚠️ **«Quién lo contó» va al pie, no en medio.** Estaba entre «Quién lo
    // ejecuta» y «Sistemas», o sea interrumpiendo el contenido con la
    // procedencia. No se quita —la ficha absorbió el informe por área
    // justamente con esta línea, y es el atajo de quien tenga que validar los
    // hallazgos— pero deja de competir con lo que el lector vino a buscar.
    l.push('')
    l.push(`*Quién lo contó* — ${quienesContaron(m, porSesion)}`)
    l.push('')
    l.push('---')
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
        const firma = acreditar(f.entrevistas?.codigo, f.areas?.nombre)
        l.push('')
        l.push(`> «${f.cita_textual.trim()}»`)
        l.push(`> — ${firma || `\`${cod}\``}`)
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
      l.push(`*Fuentes · ${cods.map((c) => `\`${c}\``).join(' · ')}*`)
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

  // Si no se pudo contar, la entrada va sin cifras antes que con cifras falsas.
  const entrada = cuenta
    ? taller.entrada
        .replace('{SESIONES}', enLetra(cuenta.sesiones))
        .replace('{TOTAL}', enLetra(cuenta.total))
        .replace('{CONHALLAZGO}', enLetra(cuenta.conHallazgo))
    : taller.entrada.replace(
        /El ataque aparece en[^.]+\. /,
        'El ataque aparece en buena parte de las sesiones del levantamiento. '
      )
  l.push(entrada)

  for (const bloque of taller.bloques) {
    l.push('')
    l.push(`## ${bloque.titulo}`)
    l.push('')
    l.push(bloque.texto)
    pegarCitas(l, bloque, ctx)
  }

  // El puente al capítulo 9: los seis hallazgos del bloque del ataque, con el
  // ancla calculada por el mismo slugger que pone el id del encabezado.
  const destacados = (() => {
    try {
      return JSON.parse(leerTaller('hallazgos-destacados.json'))
    } catch {
      return null
    }
  })()

  if (destacados) {
    const suyos = bloqueDeHallazgos(destacados, 'Lo que el ataque se llevó, y no volvió')
    if (suyos.length) {
      l.push('')
      l.push('## Los hallazgos de este capítulo')
      l.push('')
      l.push(
        `Los ${enLetra(suyos.length)} hallazgos que el capítulo 9 desarrolla sobre el incidente, ` +
          'cada uno con su cita completa:'
      )
      l.push('')
      for (const h of suyos) {
        l.push(
          `- [**H-${h.clave}** · ${h.titulo}](${RUTA_HALLAZGOS}#${anclaDeHallazgo(h.clave, h.titulo)})`
        )
      }
    }
  }

  if (taller.cierre) {
    l.push('')
    l.push('---')
    l.push('')
    l.push(taller.cierre)
  }

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
    // Los casos del filtro, en lista: son etiquetas cortas y en tabla de una
    // columna se leerían peor que como viñetas.
    if (bloque.casos?.length) {
      l.push('')
      for (const c of bloque.casos) l.push(`- ${c}`)
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
    const enlaces = enlacesAHallazgos(destacados, taller.hallazgos, etiqueta)
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

const sistemasYDato = () =>
  capituloConCitas(
    'sistemas-datos.json',
    'sistemas-datos',
    'Los que el capítulo 9 desarrolla sobre sistemas y calidad del dato, cada uno con su cita completa:'
  )

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

/** «2026-12-06» → «6 de diciembre de 2026». */
function enPalabras(iso) {
  if (!iso) return null
  const [a, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${a}`
}

async function laHojaDeRuta() {
  const aviso = enPalabras(fechaDelPrograma('AVISO_RENOVACION'))
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
const MARCA_CIFRA = {
  estimación: 'estimación',
  ejemplo: 'ejemplo',
  'sin confirmar': 'sin confirmar',
}

/** La acreditación de una cifra: el código de sesión, sin nombre. */
function firmaDeSesion(codigo) {
  return `\`${codigo}\``
}

async function cifrasDelLevantamiento() {
  const crudo = leerTaller('cifras-levantamiento.json')
  if (!crudo) return null
  const taller = JSON.parse(crudo)

  const { data: sesiones } = await admin
    .from('entrevistas')
    .select('codigo, entrevistado_nombre')
    .order('codigo')
  const porCodigo = new Map((sesiones ?? []).map((e) => [e.codigo, e]))

  const l = []
  const desconocidas = []
  const marcasMalas = []
  let total = 0
  const porMarca = new Map()
  const usadas = new Set()

  /** La columna de fuente, con todas las voces de una misma cifra. */
  const fuentes = (codigos) => {
    const buenos = []
    for (const c of codigos ?? []) {
      if (SIN_CONSENTIMIENTO.has(c)) {
        console.warn(`  ⛔ cifras: ${c} no puede citarse (sin consentimiento). Omitida.`)
        continue
      }
      if (!porCodigo.has(c)) desconocidas.push(c)
      usadas.add(c)
      buenos.push(firmaDeSesion(c))
    }
    return buenos.join('; ') || '—'
  }

  // La entrada se arma al final, cuando ya se contaron las cifras y las voces:
  // el total es justo el número que no puede escribirse a mano.
  const posicionEntrada = l.length
  l.push('')

  for (const grupo of taller.grupos) {
    l.push('')
    l.push(`## ${grupo.titulo}`)
    l.push('')
    l.push(grupo.entrada)
    l.push('')
    l.push('| Cifra | Qué mide | De dónde sale |')
    l.push('|---|---|---|')
    for (const [cifra, que, codigos, marca] of grupo.filas) {
      total++
      if (marca && !MARCA_CIFRA[marca]) marcasMalas.push(`${grupo.titulo} → «${cifra}»: marca «${marca}»`)
      porMarca.set(marca ?? 'dato', (porMarca.get(marca ?? 'dato') ?? 0) + 1)
      const cola = marca ? ` *· ${MARCA_CIFRA[marca] ?? marca}*` : ''
      l.push(`| **${cifra}** | ${que}${cola} | ${fuentes(codigos)} |`)
    }
  }

  if (taller.discrepancias) {
    l.push('')
    l.push(`## ${taller.discrepancias.titulo}`)
    l.push('')
    l.push(taller.discrepancias.entrada)
    l.push('')
    for (const [asunto, cifras, codigos, nota] of taller.discrepancias.filas) {
      l.push('')
      l.push(`**${asunto}** — ${cifras}`)
      l.push('')
      l.push(`> ${nota}`)
      l.push(`> — ${fuentes(codigos)}`)
    }
  }

  if (taller.cierre) {
    l.push('')
    l.push('---')
    l.push('')
    l.push(taller.cierre)
  }

  if (desconocidas.length) {
    console.warn(`  ⚠️ cifras: ${[...new Set(desconocidas)].join(', ')} no están en la tabla de sesiones`)
  }
  if (marcasMalas.length) {
    console.warn(`  ⚠️ cifras: ${marcasMalas.length} marca(s) que no existen:`)
    for (const m of marcasMalas) console.warn(`     ${m}`)
  }
  l[posicionEntrada] = taller.entrada
    .replace('{TOTAL}', String(total))
    .replace('{SESIONES}', String(usadas.size))

  const reparto = [...porMarca.entries()].map(([k, n]) => `${n} ${k}`).join(' · ')
  console.log(`  · cifras: ${total} cifras de ${usadas.size} sesiones — ${reparto}`)

  return l.join('\n')
}

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
      const quien = h.entrevistas?.codigo ? `\`${h.entrevistas.codigo}\`` : ''
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

async function elResumenEjecutivo() {
  const aviso = enPalabras(fechaDelPrograma('AVISO_RENOVACION'))
  if (!aviso) {
    console.error('  ✖ resumen-ejecutivo: no se pudo leer la fecha de lib/programa.ts; no se escribe.')
    return null
  }

  const { data: sesiones } = await admin.from('entrevistas').select('codigo')
  const { data: hallazgos } = await admin.from('hallazgos').select('estado, tipo')

  const inv = (() => {
    try {
      return JSON.parse(leerTaller('inventario-procesos.json'))
    } catch {
      return null
    }
  })()
  if (!inv) {
    console.error('  ✖ resumen-ejecutivo: sin inventario de procesos; no se escribe.')
    return null
  }

  const macros = inv.macroprocesos ?? []
  const procesos = macros.reduce((t, m) => t + (m.procesos?.length ?? 0), 0)

  const cifras = {
    SESIONES: (sesiones ?? []).length,
    ENTREVISTAS: (sesiones ?? []).filter((s) => s.codigo?.startsWith('ENT')).length,
    HALLAZGOS: (hallazgos ?? []).length,
    VALIDADOS: (hallazgos ?? []).filter((h) => h.estado === 'validado').length,
    OPORTUNIDADES: (hallazgos ?? []).filter((h) => h.tipo === 'oportunidad_ia').length,
    MACROS: macros.length,
    PROCESOS: procesos,
  }

  const md = await capituloConCitas(
    'resumen-ejecutivo.json',
    'resumen-ejecutivo',
    'Los del capítulo 9 que más pesan en este resumen:'
  )
  if (!md) return null

  // «dos validados» y no «2 validados»: va en medio de un párrafo de prosa.
  const EN_LETRA_CORTA = { 0: 'ninguno', 1: 'uno', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco' }

  let salida = md.replaceAll('{AVISO}', aviso)
  for (const [clave, valor] of Object.entries(cifras)) {
    const texto = clave === 'VALIDADOS' ? (EN_LETRA_CORTA[valor] ?? String(valor)) : String(valor)
    salida = salida.replaceAll(`{${clave}}`, texto)
  }

  const quedan = salida.match(/\{[A-Z]+\}/g)
  if (quedan) console.warn(`  ⚠️ resumen-ejecutivo: marcadores sin sustituir: ${[...new Set(quedan)].join(' ')}`)

  console.log(
    `  · resumen-ejecutivo: ${cifras.SESIONES} sesiones · ${cifras.HALLAZGOS} hallazgos (${cifras.VALIDADOS} validados) · ` +
      `${cifras.OPORTUNIDADES} oportunidades · ${cifras.MACROS}/${cifras.PROCESOS} procesos`
  )

  return salida
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
  l.push('| # | Patrón | Casos | Áreas | Se cierra con | ¿Modelo? |')
  l.push('|---|---|---|---|---|---|')
  taller.patrones.forEach((p, i) => {
    const areas = new Set((p.casos ?? []).map((c) => c[0]))
    l.push(
      `| **${i + 1}** | ${p.titulo} | ${(p.casos ?? []).length} | ${areas.size} | ${p.resuelve} | ` +
        `${p.modelo ? 'Sí' : '**No**'} |`
    )
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
    const enlaces = enlacesAHallazgos(destacados, taller.hallazgos, 'trabas')
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
async function inventarioDeTrabas() {
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
  l.push(
    `El respaldo del capítulo anterior: **las ${trabas.length} trabas que recogió el levantamiento**, ` +
      `una por una. ${altas} son de impacto alto, y están repartidas en ${porArea.size} áreas.`
  )
  l.push('')
  l.push(
    'Va **ordenado por área y de mayor a menor carga**, no por tipo: agrupado por cuello de ' +
      'botella contra trabajo manual se lee como una taxonomía y no dice a quién llamar. Así, ' +
      'cada gerencia encuentra lo suyo de una vez y ve cuánto carga comparada con el resto.'
  )
  l.push('')
  l.push(
    '> Todas entran como **propuestas**, igual que el resto de hallazgos: son candidatas con su ' +
      'cita hasta que alguien que estuvo en esa sesión las confirma o las descarta.'
  )

  for (const [area, suyas] of orden) {
    l.push('')
    l.push(`## ${area} · ${suyas.length}`)
    l.push('')
    l.push('| Traba | Tipo | Impacto | Sesión |')
    l.push('|---|---|---|---|')
    for (const h of suyas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))) {
      const quien = h.entrevistas?.codigo ?? ''
      const imp = h.impacto ? h.impacto[0].toUpperCase() + h.impacto.slice(1) : '—'
      l.push(`| **${h.titulo}** | ${ROTULO_TRABA[h.tipo] ?? h.tipo} | ${imp} | ${quien || '—'} |`)
    }
  }

  console.log(`  · inventario-trabas: ${trabas.length} trabas · ${porArea.size} áreas · ${altas} de impacto alto`)
  return l.join('\n')
}

const GENERADAS = {
  'resumen-ejecutivo': elResumenEjecutivo,
  // Reconectadas paso a paso, a medida que se revisa cada una. El resto sigue
  // desconectado: sus generadoras están escritas arriba y esperan su turno.
  cobertura: coberturaDelLevantamiento,
  cifras: cifrasDelLevantamiento,
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
  'inventario-trabas': inventarioDeTrabas,
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
  if (contenido !== undefined) fila.contenido_md = resolverCapitulos(contenido, slug)

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
