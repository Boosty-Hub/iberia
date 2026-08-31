/**
 * La estructura del Documento de Arquitectura de IA, y las secciones que se
 * pueden llenar solas.
 *
 *   npm run informe:estructura
 *   npm run informe:estructura -- --revisar
 *
 * Hace tres cosas y en este orden importa:
 *
 *   npm run informe:estructura -- --rehacer   # reescribe la prosa desde el taller
 *
 *  1. **La estructura.** Crea o actualiza las 28 secciones con su número, parte y
 *     subtítulo. Idempotente por `slug`.
 *  2. **Las secciones de datos** —los tres anexos que salen de la base— se
 *     **regeneran siempre**: son el reflejo del dato, no prosa. Si alguien las
 *     edita a mano, la próxima corrida las pisa, y así debe ser.
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

// =============================================================================
// 1) LA ESTRUCTURA
// =============================================================================

const SECCIONES = [
  // --- Portada ---------------------------------------------------------------
  ['portada', 'resumen-ejecutivo', 'Resumen ejecutivo', 'Qué encontramos y qué proponemos, en dos páginas'],
  ['portada', 'como-leer', 'Cómo leer este informe', 'El recorrido: del levantamiento a la arquitectura'],

  // --- Levantamiento ---------------------------------------------------------
  ['levantamiento', 'punto-de-partida', 'El punto de partida', 'La decisión del comité gerencial y el encargo'],
  ['levantamiento', 'metodo', 'Cómo se hizo el levantamiento', 'Sesiones, entrevistas, recorridos y fuentes consultadas'],
  ['levantamiento', 'la-empresa', 'Industrias Iberia hoy', 'El negocio, el portafolio y la planta de Cagua'],
  ['levantamiento', 'mapa-organizacion', 'Mapa de la organización', 'Direcciones, gerencias y quién decide qué'],
  // NUEVA · el hallazgo más repetido del levantamiento no es tecnológico
  ['levantamiento', 'dependencias', 'De quién depende cada proceso', 'Los procesos que hoy viven en una sola cabeza'],
  ['levantamiento', 'procesos-clave', 'Del pedido al cobro', 'Los procesos que sostienen la operación'],
  ['levantamiento', 'sistemas-datos', 'Sistemas, datos y conectividad', 'Qué vive en el ERP, qué vive fuera y dónde nace cada dato'],
  // NUEVA · qué dato existe de verdad, y desde cuándo
  ['levantamiento', 'estado-del-dato', 'El estado del dato', 'Qué hay, qué es confiable y desde cuándo'],
  ['levantamiento', 'cuellos-botella', 'Cuellos de botella y trabajo manual', 'Dónde se pierde tiempo, trazabilidad y margen'],
  ['levantamiento', 'madurez', 'Madurez digital y disposición al cambio', 'El punto de partida de las personas, no solo el de la tecnología'],
  ['levantamiento', 'restricciones', 'Restricciones y condiciones de borde', 'Lo que el contexto país, el ERP y la seguridad imponen'],
  // NUEVA · una sola sección de citas, y solo lo que mueve la aguja
  ['levantamiento', 'en-sus-palabras', 'En sus palabras', 'Lo que nos dijeron, y por qué importa'],

  // --- Arquitectura ----------------------------------------------------------
  ['arquitectura', 'principios', 'Principios de arquitectura', 'El núcleo protegido, las dos vías y la aprobación humana'],
  ['arquitectura', 'arquitectura-ia', 'Arquitectura de IA propuesta', 'El plano completo: capas, flujos de datos y conexiones al núcleo'],
  ['arquitectura', 'modulos', 'Módulos priorizados', 'Qué se construye, en qué orden y por qué ese orden'],
  // NUEVA · la propuesta promete decir «dónde interviene la IA y dónde no»
  ['arquitectura', 'donde-no-va-la-ia', 'Dónde no va la IA', 'Lo que se resuelve sin un modelo, y por qué decirlo importa'],
  ['arquitectura', 'gobierno-datos', 'Gobierno de datos y seguridad', 'Accesos, licenciamiento, trazabilidad y protección del núcleo'],
  ['arquitectura', 'hoja-de-ruta', 'Hoja de ruta fases 2 a 4', 'Secuencia, dependencias y puntos de control'],
  ['arquitectura', 'inversion-retorno', 'Inversión y retorno estimado', 'Costo por módulo y beneficio esperado'],
  ['arquitectura', 'supuestos-riesgos', 'Supuestos y riesgos', 'Qué debe validar la dirección antes de dimensionar la Fase 2'],
  // NUEVA · la cláusula 7 hace de este documento la condición para la Fase 2
  ['arquitectura', 'la-decision', 'La decisión', 'Qué aprueba el comité al aprobar este documento'],

  // --- Anexos ----------------------------------------------------------------
  ['anexos', 'anexo-sesiones', 'Anexo · Sesiones y entrevistas', 'Registro de todo lo levantado, con fecha y participantes'],
  // NUEVA · entregable contractual de la cláusula 5 que no tenía dónde vivir
  ['anexos', 'anexo-levantamientos', 'Anexo · Informes de levantamiento por área', 'Un informe por área, con lo que dijo cada quien'],
  // Ya no es un volcado de las 236 observaciones crudas: eso vive en el panel.
  // Acá va el índice de los hallazgos redactados, para poder navegarlos.
  ['anexos', 'anexo-hallazgos', 'Anexo · Índice de hallazgos', 'Los veintiocho, con su sección y su impacto'],
  // NUEVA · las cifras que sostienen el informe, con su fuente
  ['anexos', 'anexo-cifras', 'Anexo · Las cifras del levantamiento', 'Solo lo que alguien dijo explícitamente'],
  ['anexos', 'anexo-inventario', 'Anexo · Inventario de sistemas y archivos', 'Fuentes documentales del levantamiento'],
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

async function anexoSesiones() {
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

  return `Todo lo levantado hasta la fecha, con su código, su fecha y quién estuvo. Las
sesiones marcadas \`SES-\` son reuniones de comité y recorridos de planta; las \`ENT-\`
son las entrevistas estructuradas que cuentan contra las ~25 que compromete el programa;
las \`FOR-\` son formaciones y no cuentan contra esa meta.

**${entrevistas.length} de ~25 entrevistas** · ${sesiones.length} sesiones en total ·
${Math.round(minutos / 60)} horas de grabación · **${(turnos ?? 0).toLocaleString('es-VE')} turnos** transcritos.

| Código | Fecha | Quién | Área | Sede | Duración | Participantes |
|---|---|---|---|---|---|---|
${filas.join('\n')}

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

const GENERADAS = {
  'anexo-sesiones': anexoSesiones,
  'anexo-hallazgos': async () => indiceDeHallazgos(),
  'anexo-inventario': anexoInventario,
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

for (const [i, [parte, slug, titulo, subtitulo]] of SECCIONES.entries()) {
  const numero = String(i + 1).padStart(2, '0')
  const orden = (i + 1) * 10
  const previa = porSlug.get(slug)

  let contenido
  if (GENERADAS[slug]) {
    // Los anexos se regeneran siempre: son el reflejo de la base.
    contenido = await GENERADAS[slug]()
    generadas++
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

if (huerfanas.length) {
  console.log('⚠️  Fuera de la estructura, no se borraron por si tienen contenido:')
  for (const h of huerfanas) console.log(`     · ${h.slug}`)
  console.log('')
}

console.log('Todo entra sin publicar. Se publica a mano desde /dashboard/informe.\n')
