/**
 * Carga las transcripciones del levantamiento y les pone nombre a los hablantes.
 *
 *   npm run importar:transcripciones
 *   npm run importar:transcripciones -- --solo ENT-004
 *   npm run importar:transcripciones -- --revisar     # dice qué haría, sin escribir
 *
 * Por qué existe, teniendo ya el importador de la interfaz: Fireflies renumera
 * los hablantes en cada grabación —el «speaker 2» de una entrevista no es el de
 * la siguiente— y **sin nombre, lo que se dijo no se puede citar en el informe**.
 * El importador de la interfaz deja las etiquetas crudas; aquí el mapa va
 * escrito, con la evidencia que lo sostiene anotada al lado. Esa evidencia es lo
 * que permite que otra persona lo revise sin volver a oír hora y media de audio.
 *
 * Los archivos viven en `contenido/transcripciones/`, que está fuera de git: es
 * material de Iberia bajo NDA.
 *
 * Idempotente: reimportar una sesión reemplaza sus segmentos y sus
 * participantes, no los duplica.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parsearTranscripcion } from '../lib/fireflies.ts'

const CARPETA = 'contenido/transcripciones'

/**
 * El primer rodaje: las nueve entrevistas se hicieron el mismo día, en Cagua, en
 * dos pistas —cinco Gabriel y cuatro Ruth—. La fecha no viene en el archivo de
 * Fireflies; sale del correo del 17 de agosto a la Gerencia General, donde
 * Gabriel escribe «el jueves 20 estoy en cagua en las entrevistas, ese día lo
 * tengo copado ahí».
 */
const DIA_DEL_RODAJE = '2026-08-20'

/**
 * La ronda 2: diez entrevistas el mismo día, en Cagua, en dos pistas —cuatro
 * Jesús Planas con el dinero y la gente, seis Ruth Velázquez con la planta por
 * debajo—. La fecha tampoco viene en el archivo. Sale de tres cosas que
 * coinciden: el documento a Martha proponía «jueves 27 de agosto o martes 1.º de
 * septiembre»; Fireflies dejó una copia de la entrevista de Juan Pablo Yépez
 * rotulada `Aug-27-11-48-AM`, byte por byte idéntica; y en la reunión con Fuguet
 * de `SES-006` Carlos Quintana dice «hoy fue la tercera ronda de entrevistas»
 * mientras Marcela Ojeda pide sacar la nota «mañana… el lunes» —viernes 28 y
 * lunes 31—.
 */
const DIA_DE_LA_RONDA_2 = '2026-08-27'

/** Cuando un hablante no se pudo identificar. No se inventa un nombre. */
const SIN_IDENTIFICAR = null

/**
 * El levantamiento, sesión por sesión.
 *
 * `hablantes` mapea la etiqueta cruda del export al nombre real. `null` deja la
 * etiqueta como está: es una identificación pendiente, no un descarte, y sale
 * listada al final de la corrida para que no se pierda de vista.
 */
const SESIONES = [
  {
    codigo: 'ENT-001',
    archivo: 'ENT-001-manuel-de-macedo.json',
    tipo: 'entrevista',
    entrevistado: 'Manuel de Macedo',
    cargo: 'Gerente de Planta',
    area: 'g-planta',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Gabriel Montiel Toro',
    // speaker 1 pregunta «¿Cómo estás, Manuel?» y «¿Tú estás Manuel, en toda la
    // parte producción?». speaker 2 se narra a sí mismo: «dice bueno, Manuel no
    // produjo esto», y es quien levanta el plan de producción.
    hablantes: {
      'speaker 1': 'Gabriel Montiel Toro',
      'speaker 2': 'Manuel de Macedo',
      'speaker 3': SIN_IDENTIFICAR,
    },
  },
  {
    codigo: 'ENT-002',
    archivo: 'ENT-002-carlos-martinez.json',
    tipo: 'entrevista',
    entrevistado: 'Carlos Martínez',
    cargo: 'Jefe de Producción',
    area: 'j-produccion',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Gabriel Montiel Toro',
    // speaker 3 lee la lista del rodaje —«Manuel Macedo, Carlos Martínez, Katy
    // Peña, Mauri Armas y Uslar»— y abre con «Mira, te comento, Carlos, estamos
    // ahorita como en el proceso de entender el flujo»: es el entrevistador.
    // speaker 2 dice «Los dejo con Gabriel» y se va: es el anfitrión.
    hablantes: {
      'speaker 1': 'Carlos Martínez',
      'speaker 2': SIN_IDENTIFICAR,
      'speaker 3': 'Gabriel Montiel Toro',
    },
  },
  {
    codigo: 'ENT-003',
    archivo: 'ENT-003-rafael-acosta.json',
    tipo: 'entrevista',
    entrevistado: 'Rafael Acosta',
    cargo: 'Jefe de Almacén de Materia Prima',
    area: 'j-almacen-materia-prima',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Ruth Velázquez',
    // speaker 1: «mi nombre es Ruth Velázquez, yo soy consultor desarrollo
    // organizacional», y cierra con «muchísimas gracias, señor Rafael».
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'Rafael Acosta',
    },
  },
  {
    codigo: 'ENT-004',
    archivo: 'ENT-004-luis-caceres.json',
    tipo: 'entrevista',
    entrevistado: 'Luis Cáceres',
    cargo: 'Jefe de Mantenimiento',
    area: 'j-mantenimiento',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Ruth Velázquez',
    // speaker 2 se presenta solo: «Mi nombre es Luis Cáceres, ingeniero mecánico
    // y jefe de mantenimiento en Industria Iberia». speaker 3 es su gerente:
    // Ruth lo nombra al cerrar —«su nombre es Jesús… Gerente de Mantenimiento»—
    // y aporta más de la mitad del contenido técnico.
    //
    // ⚠️ `speaker 3` viene contaminado. Entre los minutos 5 y 6 se cuela **Rafael
    // Acosta**, de almacén de materia prima, que llegó a la hora equivocada por un
    // cambio de agenda, y la diarización lo mete en la misma etiqueta. Antes de
    // citar cualquier cosa de ese tramo hay que oírla.
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'Luis Cáceres',
      'speaker 3': 'Jesús',
    },
  },
  {
    codigo: 'ENT-005',
    archivo: 'ENT-005-milagro-salas.json',
    tipo: 'entrevista',
    entrevistado: 'Milagro Salas',
    cargo: 'Gerente de Calidad',
    area: 'g-calidad',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Ruth Velázquez',
    // speaker 1 abre con «A ver, Milagro, ¿sabes por qué estamos aquí?».
    // speaker 2 firma como «Milagro Sala» al describir su propio archivo.
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'Milagro Salas',
    },
  },
  {
    codigo: 'ENT-006',
    archivo: 'ENT-006-andreina-castro.json',
    tipo: 'entrevista',
    entrevistado: 'Andreína Castro',
    cargo: 'Jefe de Aseguramiento de la Calidad',
    area: 'j-aseguramiento-calidad',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Ruth Velázquez',
    // ⚠️ Aquí los números van al revés que en las otras de Ruth: speaker 2 es
    // quien se presenta («mi nombre es Ruth Velázquez») y speaker 1 es la
    // entrevistada. Es justo el fallo que este script existe para evitar.
    hablantes: {
      'speaker 1': 'Andreína Castro',
      'speaker 2': 'Ruth Velázquez',
    },
  },
  {
    codigo: 'ENT-007',
    archivo: 'ENT-007-maury-armas.json',
    tipo: 'entrevista',
    entrevistado: 'Maury Armas',
    cargo: 'Jefe de Diseño y Desarrollo',
    area: 'j-diseno-desarrollo',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Gabriel Montiel Toro',
    // speaker 1 abre con «¿Cómo está usted, señor Mauri?» y conduce todo el
    // recorrido del macroproceso; speaker 2 explica las formulaciones.
    hablantes: {
      'speaker 1': 'Gabriel Montiel Toro',
      'speaker 2': 'Maury Armas',
    },
  },
  {
    codigo: 'ENT-008',
    archivo: 'ENT-008-uslar-valor.json',
    tipo: 'entrevista',
    entrevistado: 'Uslar Valor',
    cargo: 'Gerente de Distribución',
    area: 'g-distribucion',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Gabriel Montiel Toro',
    // speaker 3 es quien conoce la flota por dentro: «diariamente cargamos en
    // promedio diez, doce vehículos (…) a todo el territorio nacional».
    // speaker 1 presenta —«él va a levantar todo (…) haciendo su mapa»— y se va.
    hablantes: {
      'speaker 1': SIN_IDENTIFICAR,
      'speaker 2': 'Gabriel Montiel Toro',
      'speaker 3': 'Uslar Valor',
    },
  },
  {
    codigo: 'ENT-009',
    archivo: 'ENT-009-katty-pena.json',
    tipo: 'entrevista',
    entrevistado: 'Katty Peña',
    cargo: 'Gerente de Compras',
    area: 'g-compras',
    sede: 'cagua',
    fecha: DIA_DEL_RODAJE,
    entrevistador: 'Gabriel Montiel Toro',
    // speaker 2 abre con «¿ya te mapearon de qué es la entrevista?»; speaker 1
    // contesta desde adentro de Compras y dice «me he metido con IA, pero no soy
    // experta».
    hablantes: {
      'speaker 1': 'Katty Peña',
      'speaker 2': 'Gabriel Montiel Toro',
      'speaker 3': SIN_IDENTIFICAR,
    },
  },
  {
    // No lleva ENT-: no es del levantamiento y no cuenta contra las ~25 que pide
    // la cláusula 5. Es formación dirigente, uno a uno, y fuera de agenda.
    codigo: 'FOR-001',
    archivo: 'FOR-001-alberto-garcia-ramos.json',
    tipo: 'formacion',
    // Sin título: la insignia ya dice «Formación» y así manda el nombre, igual
    // que en las entrevistas. Con título salía «Formación uno a uno · Gerencia
    // General · Gerente General», que dice tres veces lo mismo.
    entrevistado: 'Alberto García-Ramos',
    cargo: 'Gerente General',
    area: 'direccion-general',
    sede: 'caracas',
    // Correo del 17 de agosto: «hagamoslo hoy 3pm en tu oficina» / «Listo nos
    // vemos a las 3PM en mi oficina». Hora y media pedida, tres horas grabadas.
    fecha: '2026-08-17',
    entrevistador: 'Gabriel Montiel Toro',
    // speaker 1 es quien enseña: «Alberto, esta parte es importante», «aquí en
    // computador hay dos cosas, Alberto».
    hablantes: {
      'speaker 1': 'Gabriel Montiel Toro',
      'speaker 2': 'Alberto García-Ramos',
    },
  },

  // ---------------------------------------------------------------------------
  // RONDA 2 · Pista A · Jesús Planas — el dinero y la gente
  // ---------------------------------------------------------------------------
  {
    codigo: 'ENT-010',
    archivo: 'ENT-010-dora-luciche.json',
    tipo: 'entrevista',
    entrevistado: 'Dora Luciche',
    cargo: 'Directora de Finanzas',
    area: 'finanzas',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Jesús Planas',
    // ⚠️ La entrevistada es speaker 1, no el entrevistador: speaker 2 la trata de
    // «Señora Dora, no vi que lo sacara de aquí» y «Señora Dora, y en cuanto a
    // esa parte de crédito y Cobranza». speaker 2 es quien conduce —«y si le
    // comentó Gabriel o alguien del equipo, el propósito ya de esta sesión»—.
    //
    // speaker 3 son 27 turnos de quien lleva la agenda del día: «está con Jorge
    // por el tema de su huecaja». En ENT-016 el mismo papel dice «mi jefa Dora»,
    // así que con toda probabilidad es la misma persona. No se le pone nombre.
    hablantes: {
      'speaker 1': 'Dora Luciche',
      'speaker 2': 'Jesús Planas',
      'speaker 3': SIN_IDENTIFICAR,
    },
  },
  {
    codigo: 'ENT-011',
    archivo: 'ENT-011-ana-karina-vargas.json',
    tipo: 'entrevista',
    entrevistado: 'Ana Karina Vargas',
    cargo: 'Gerente de Contabilidad',
    area: 'g-contabilidad',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Jesús Planas',
    // speaker 1 se ubica solo: «yo soy apoyo en la parte de procesos (…) para que
    // luego Gabriel y el equipo de Gabriel», y presenta a la otra pista —«está
    // Ruth, no sé si la conocieron»—.
    //
    // speaker 3 se presenta —«yo soy la gerente de contabilidad y ella es la jefa
    // de contabilidad»— y contesta cuando le preguntan por nombre: «las
    // auditorías, Ana Karina, ¿hay auditorías acá?» → «desde que yo entré, una
    // misma firma». speaker 2 es la otra, y el entrevistador le corrige el cargo
    // en el acto: «y jefa de costos». El padrón lo confirma: María Criselia
    // Briceño Marín, ficha 4976, Jefe de Costos.
    hablantes: {
      'speaker 1': 'Jesús Planas',
      'speaker 2': 'María Criselia Briceño',
      'speaker 3': 'Ana Karina Vargas',
    },
  },
  {
    codigo: 'ENT-012',
    archivo: 'ENT-012-edgardo-quevedo.json',
    tipo: 'entrevista',
    entrevistado: 'Edgardo Quevedo',
    cargo: 'Gerente de Tesorería',
    area: 'g-tesoreria',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Jesús Planas',
    // «Y en el caso del señor Edgardo» → speaker 2: «y la parte tesorería como
    // parte, o sea, banco, seguro, casa de bolsa». Y habla de Jorge en tercera
    // persona: «Jorge tiene en el flujo de caja, tiene nómina obrero
    // confidencial diaria».
    //
    // «Impuestos, tú llevas pagos fiscales, parafiscales» → speaker 3: «pago de
    // portales, el procesamiento del impuesto». Es Jorge Luis Rodríguez Aguirre,
    // ficha 4925, Jefe de Impuestos y Cuentas por Pagar — el doble rol que el
    // entrevistador le nombra en el primer minuto.
    hablantes: {
      'speaker 1': 'Jesús Planas',
      'speaker 2': 'Edgardo Quevedo',
      'speaker 3': 'Jorge Rodríguez',
    },
  },
  {
    codigo: 'ENT-013',
    archivo: 'ENT-013-luz-marina-sanz.json',
    tipo: 'entrevista',
    entrevistado: 'Luz Marina Sanz',
    cargo: 'Gerente de Recursos Humanos',
    area: 'g-recursos-humanos',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Jesús Planas',
    // speaker 1 conduce —«¿qué les comentaron de esta sesión?»— y de paso deja
    // constancia de que las dos pistas iban a la vez: «no sé si Ruth ya terminó».
    //
    // A speaker 2 la llaman por su nombre dos veces —«mira, Luz Marina, yo estoy
    // fuera de la ciudad», «gracias, Luz Marina, un placer»—. speaker 3 la nombra
    // en tercera persona: «los reportes que se le envían a la Gerencia General, a
    // la Dirección de Operaciones, a Luz Marina». Es Liseth Yánez, ficha 4924.
    hablantes: {
      'speaker 1': 'Jesús Planas',
      'speaker 2': 'Luz Marina Sanz',
      'speaker 3': 'Liseth Yánez',
    },
  },

  // ---------------------------------------------------------------------------
  // RONDA 2 · Pista B · Ruth Velázquez — la planta por debajo
  // ---------------------------------------------------------------------------
  {
    codigo: 'ENT-014',
    archivo: 'ENT-014-beatriz-vieira.json',
    tipo: 'entrevista',
    entrevistado: 'Beatriz Vieira',
    cargo: 'Analista de Operaciones',
    area: 'operaciones',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Ruth Velázquez',
    // «Dime tu nombre completo y tu cargo» → speaker 2: «Beatriz Nazaret y soy
    // analista de operaciones». El padrón la escribe Beatriz Nazareth Vieira
    // Texeira, ficha 4999; el archivo de Fireflies venía rotulado con el segundo
    // nombre. speaker 1 cierra con «bueno, Beatriz, muchísimas gracias».
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'Beatriz Vieira',
    },
  },
  {
    codigo: 'ENT-015',
    archivo: 'ENT-015-josgleisy-ascanio.json',
    tipo: 'entrevista',
    entrevistado: 'Josgleisy Ascanio',
    cargo: 'Coordinadora de Compras',
    area: 'g-compras',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Ruth Velázquez',
    // ⚠️ **El archivo llegó rotulado «Entrevista-Beatriz-Parte-2» y no es Beatriz.**
    // Es la sesión de Compras, la fila 2 de la pista B, que se daba por no hecha.
    // Se cazó al leer el primer minuto: «lo primero que necesito es que ustedes me
    // digan sus nombres y el cargo que cada uno ocupa» → dos personas.
    //
    // speaker 2: «José Acevedo y soy coordinador de compras» — el padrón lo
    // registra como Comprador, ficha 5033, y él mismo se ubica en «suministro de
    // materiales». Cuatro meses en la empresa.
    //
    // speaker 3: «yo, Glaciar Caño, coordinador de compras» — Fireflies por
    // sonido. Es Josgleisy Jazmín Ascanio Suárez, ficha 4994, Coordinador de
    // Compras, y ella se reparte el área en la línea siguiente: «yo llevo la parte
    // de lo que es materia prima y material de empaque» / «y tú todo lo demás».
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'José Acevedo',
      'speaker 3': 'Josgleisy Ascanio',
    },
  },
  {
    codigo: 'ENT-016',
    archivo: 'ENT-016-juan-pablo-yepez.json',
    tipo: 'entrevista',
    entrevistado: 'Juan Pablo Yépez',
    cargo: 'Jefe de Prevención y Control de Pérdidas',
    area: 'j-prevencion-perdidas',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Ruth Velázquez',
    // «¿Me dijo su nombre?» → speaker 2: «Juan Pablo Yepes. (…) Jefe de
    // transición y control de pérdida. (…) En la Dirección de Capital Humano». El
    // padrón: Juan Pablo Yépez Perozo, ficha 4981, Jefe de Prevención y Control
    // de Pérdidas.
    //
    // **Esta es la entrevista que le pone nombre a la conductora de toda la pista
    // B**: al cerrar, speaker 2 pregunta «¿cómo te fue, Ruth?». La misma voz abre
    // ENT-014, 015, 017, 018 y 019 con la misma fórmula.
    //
    // speaker 3 lleva la agenda del día y no se identifica: «mi jefa Dora dice que
    // prefiere que la persona que está ausente sea la que lleva muchos procesos
    // críticos», «si Jesús va a regresar con las otras rondas, la metemos».
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'Juan Pablo Yépez',
      'speaker 3': SIN_IDENTIFICAR,
    },
  },
  {
    codigo: 'ENT-017',
    archivo: 'ENT-017-mary-carmen-torres.json',
    tipo: 'entrevista',
    entrevistado: 'Mary Carmen Torres',
    cargo: 'Jefa del Servicio de Seguridad y Salud en el Trabajo',
    area: 'j-seguridad-salud',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Ruth Velázquez',
    // ⚠️ Aquí los números van al revés, como en ENT-006: speaker 2 es quien
    // pregunta —«dime tu nombre, qué proceso llevas, cuánto tiempo tienes en la
    // organización»— y speaker 1 es la entrevistada: «Mari Carmen Torres, tengo
    // desde el 6 de mayo, tres meses (…) es una jefatura de Salud y Seguridad
    // Laboral». El padrón la escribe Mary Carmen Torres Soto, ficha 5032.
    //
    // ⚠️ Y el primer turno, a los 0:01, es de la conductora aunque la diarización
    // lo cuelgue de speaker 1. Cuidado si se cita el arranque.
    hablantes: {
      'speaker 1': 'Mary Carmen Torres',
      'speaker 2': 'Ruth Velázquez',
    },
  },
  {
    codigo: 'ENT-018',
    archivo: 'ENT-018-paola-mansilla.json',
    tipo: 'entrevista',
    entrevistado: 'Paola Mansilla',
    cargo: 'Coordinadora del Sistema de Gestión de la Calidad',
    area: 'g-calidad',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Ruth Velázquez',
    // speaker 2: «mi nombre es Paola Mancillo, yo soy la coordinadora Gestión de
    // calidad, pero mi área está como dividida en dos (…) permisología y (…) el
    // sistema de documentación». El padrón: Paola Alejandra Mansilla Pineda,
    // ficha 4584.
    //
    // speaker 3: «soy coordinador de laboratorio, el área de nosotros que es
    // control de calidad», y habla de Paola en tercera persona —«la ventaja que
    // tenemos Paola y mi persona es que ella nació en el departamento de
    // calidad»—. Es Merquidia María Coss Arias, ficha 4307. La conductora cierra
    // con «muchísimas gracias, chicas»: las dos entrevistadas son mujeres.
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'Paola Mansilla',
      'speaker 3': 'Merquidia Coss',
    },
  },
  {
    codigo: 'ENT-019',
    archivo: 'ENT-019-pedro-mendez.json',
    tipo: 'entrevista',
    entrevistado: 'Pedro Méndez',
    cargo: 'Coordinador de Servicios Generales',
    // No hay nodo de Servicios Generales en el organigrama: cuelga de
    // Mantenimiento, que es el macroproceso S5 al que pertenece.
    area: 'g-mantenimiento',
    sede: 'cagua',
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: 'Ruth Velázquez',
    // «Me dices tu nombre, tu área y cuánto tiempo tienes» → speaker 2: «mi
    // nombre es Pedro Ruiz Méndez, estoy en el área de servicios generales como
    // coordinador de Servicios Generales (…) este año cumplo 12 años, del 2014».
    // El padrón: Pedro Luis Méndez Pérez, ficha 4813.
    hablantes: {
      'speaker 1': 'Ruth Velázquez',
      'speaker 2': 'Pedro Méndez',
    },
  },

  // ---------------------------------------------------------------------------
  // La formación de la directiva y la reunión de comunicaciones
  // ---------------------------------------------------------------------------
  {
    // Serie propia, como FOR-001: es formación y no cuenta contra las ~25 que
    // pide la cláusula 5.
    codigo: 'FOR-002',
    archivo: 'FOR-002-petit-comite.json',
    tipo: 'formacion',
    titulo: 'Sesión IA Petit Comité · formación de la directiva',
    entrevistado: null,
    cargo: null,
    area: 'direccion-general',
    sede: 'caracas',
    // La convocatoria decía miércoles 26 de agosto. Fireflies dejó una copia
    // rotulada `Aug-26-08-41-AM`, byte por byte idéntica: la hora calza con la
    // sala pedida para la mañana.
    fecha: '2026-08-26',
    entrevistador: 'Gabriel Montiel Toro',
    // Cuatro horas y siete hablantes. speaker 1 es quien dicta: «lo que acabamos
    // de hacer es descargar Claude en la computadora (…) porque vamos a utilizar
    // nuestros archivos», y se autopregunta en voz alta lo que espera que le
    // pregunten: «bueno, Gabriel, pero si yo no estoy en la computadora, ¿puedo
    // usarlo?».
    //
    // speaker 2 es a quien Gabriel llama al arrancar —«ya yo estoy aquí, necesito
    // a Marta» / «Marta, Marta, I need you»— y es quien administra las cuentas y
    // las licencias toda la sesión: «el señor Gustavo, el señor Alberto y yo
    // estamos trabajando», «van a entrar a tu máquina, Dora, para poner tu
    // usuario y contraseña».
    //
    // speaker 3 contesta a «Dora, ¿cómo es que es tu correo, de Luciche?» —«no,
    // porque Marta se antojó que llevara el segundo» / «igual, de Luciche»— y es
    // quien saluda a Luis Daniel y le avisa a Gustavo del café.
    //
    // speaker 4 contesta el saludo «¿qué tal, Luis?» y acto seguido speaker 3
    // dice «hola, Luis Daniel, ¿cómo está?». Entra a los 13:39, justo antes.
    //
    // ⚠️ **Tres sin identificar, y son de la directiva.** Entre los speakers 5, 6
    // y 7 están Antonio Sorrentino y Gustavo Carballo. Al 7 Gabriel le pregunta
    // «¿qué manejas tú, Antonio, en un Excel?» y contesta «listas de precio,
    // venta» —que es lo suyo, Comercialización—, pero ese mismo hablante entra a
    // los 21:47, antes de que speaker 4 avise «Antonio dice que llega ya» a los
    // 25:28, y en el archivo se nombra a más de un Antonio. No se cierra con eso,
    // y quien estuvo en la sala los reconoce de una.
    hablantes: {
      'speaker 1': 'Gabriel Montiel Toro',
      'speaker 2': 'Martha Fuentes',
      'speaker 3': 'Dora Luciche',
      'speaker 4': 'Luis Daniel Agostini',
      'speaker 5': SIN_IDENTIFICAR,
      'speaker 6': SIN_IDENTIFICAR,
      'speaker 7': SIN_IDENTIFICAR,
    },
  },
  {
    codigo: 'SES-006',
    archivo: 'SES-006-fuguet-comunicaciones.json',
    tipo: 'reunion',
    titulo: 'Comunicaciones · Boosty con Fuguet Comunicación y Cambio',
    entrevistado: null,
    cargo: null,
    area: 'j-comunicaciones',
    sede: 'remoto',
    // El mismo día de la ronda 2: Carlos Quintana dice «hoy fue la tercera ronda
    // de entrevistas» y Marcela Ojeda quiere la nota del boletín «mañana… el
    // lunes». Él se conectó desde Buenos Aires.
    fecha: DIA_DE_LA_RONDA_2,
    entrevistador: null,
    // Esta llegó con los nombres puestos: era videollamada con participantes
    // identificados, no una grabación de sala. Se mapean a sí mismos para que el
    // registro de participantes quede colgado de las fichas de personas.
    hablantes: {
      'Gabriel Montiel Toro': 'Gabriel Montiel Toro',
      'Carlos Quintana': 'Carlos Quintana',
      'Amado Fuguet': 'Amado Fuguet',
      'Marcela Ojeda': 'Marcela Ojeda',
    },
  },
]

/**
 * Quién es cada quien, para el registro de personas. El levantamiento cita a
 * gente por su nombre y el informe necesita saber de qué área habla cada cita.
 */
const PERSONAS = {
  'Manuel de Macedo': { cargo: 'Gerente de Planta', area: 'g-planta', org: 'iberia' },
  'Carlos Martínez': { cargo: 'Jefe de Producción', area: 'j-produccion', org: 'iberia' },
  'Rafael Acosta': {
    cargo: 'Jefe de Almacén de Materia Prima',
    area: 'j-almacen-materia-prima',
    org: 'iberia',
  },
  'Luis Cáceres': {
    cargo: 'Jefe de Mantenimiento · ingeniero mecánico',
    area: 'j-mantenimiento',
    org: 'iberia',
    notas: '20 años en el cargo. Reporta a Jesús, Gerente de Mantenimiento.',
  },
  Jesús: {
    cargo: 'Gerente de Mantenimiento',
    area: 'g-mantenimiento',
    org: 'iberia',
    notas:
      '⚠️ Falta el apellido: en ENT-004 solo se le nombra por el nombre de pila. Recién ' +
      'llegado a la empresa. Es quien puso sobre la mesa la pregunta de alcance del área: ' +
      'si conviene el módulo de mantenimiento de JD Edwards o lo que traiga el programa.',
  },
  'Andreína Castro': {
    cargo: 'Jefe de Aseguramiento de la Calidad',
    area: 'j-aseguramiento-calidad',
    org: 'iberia',
  },
  'Maury Armas': {
    cargo: 'Jefe de Diseño y Desarrollo',
    area: 'j-diseno-desarrollo',
    org: 'iberia',
  },
  'Uslar Valor': { cargo: 'Gerente de Distribución', area: 'g-distribucion', org: 'iberia' },
  'Katty Peña': { cargo: 'Gerente de Compras', area: 'g-compras', org: 'iberia' },
  'Ruth Velázquez': {
    cargo: 'Consultora de desarrollo organizacional · Boosty Digital',
    area: 'boosty',
    org: 'boosty',
    notas:
      'Levantamiento de procesos en planta. Condujo 4 de las 9 de la ronda 1 y las 6 de ' +
      'la pista B de la ronda 2.',
  },
  'Jesús Planas': {
    cargo: 'Consultor de procesos · Boosty Digital (Consultores UCAB)',
    area: 'boosty',
    org: 'boosty',
    notas:
      'Levantó el mapa de macroprocesos v7. Condujo las 4 de la pista A de la ronda 2 ' +
      '—el dinero y la gente—.',
  },

  // --- Ronda 2 · el dinero y la gente ---------------------------------------
  'Ana Karina Vargas': {
    cargo: 'Gerente de Contabilidad',
    area: 'g-contabilidad',
    org: 'iberia',
    notas:
      'Ficha 4957 · Ana Karina Vargas Escudero. ⚠️ En el registro había una «Ana Karina ' +
      'Vázquez» de una sesión anterior: es la misma persona con el apellido transcrito ' +
      'por sonido.',
  },
  'María Criselia Briceño': {
    cargo: 'Jefa de Costos',
    area: 'j-costos',
    org: 'iberia',
    notas: 'Ficha 4976 · María Criselia Briceño Marín.',
  },
  'Edgardo Quevedo': {
    cargo: 'Gerente de Tesorería',
    area: 'g-tesoreria',
    org: 'iberia',
    notas: 'Ficha 4712 · Edgardo Augusto Quevedo Martínez. Banco, seguros y casa de bolsa.',
  },
  'Jorge Rodríguez': {
    cargo: 'Jefe de Impuestos y Cuentas por Pagar',
    area: 'j-impuestos-cxp',
    org: 'iberia',
    notas: 'Ficha 4925 · Jorge Luis Rodríguez Aguirre. Doble rol: cuentas por pagar e impuestos.',
  },
  'Luz Marina Sanz': {
    cargo: 'Gerente de Recursos Humanos',
    area: 'g-recursos-humanos',
    org: 'iberia',
    notas: 'Ficha 4771 · Luz Marina Sanz Afonso.',
  },
  'Liseth Yánez': {
    cargo: 'Jefa de Administración de Personal',
    area: 'j-administracion-personal',
    org: 'iberia',
    notas: 'Ficha 4924 · Liseth Virginia Yánez de Reina. Nómina y reportería de personal.',
  },

  // --- Ronda 2 · la planta por debajo ---------------------------------------
  'Beatriz Vieira': {
    cargo: 'Analista de Operaciones',
    area: 'operaciones',
    org: 'iberia',
    notas:
      'Ficha 4999 · Beatriz Nazareth Vieira Texeira. Dos años en el cargo. Es el filtro ' +
      'entre los supervisores de producción y la Dirección de Operaciones.',
  },
  'Josgleisy Ascanio': {
    cargo: 'Coordinadora de Compras · materia prima y material de empaque',
    area: 'g-compras',
    org: 'iberia',
    notas: 'Ficha 4994 · Josgleisy Jazmín Ascanio Suárez.',
  },
  'José Acevedo': {
    cargo: 'Comprador · suministro de materiales',
    area: 'g-compras',
    org: 'iberia',
    notas:
      'Ficha 5033 · José Yoneiber Acevedo Balcárcel. Cuatro meses en la empresa. Se ' +
      'presenta como coordinador de compras; el padrón lo registra como Comprador.',
  },
  'Juan Pablo Yépez': {
    cargo: 'Jefe de Prevención y Control de Pérdidas',
    area: 'j-prevencion-perdidas',
    org: 'iberia',
    notas:
      'Ficha 4981 · Juan Pablo Yépez Perozo. Reporta a la Dirección de Capital Humano. ' +
      'Supervisa vigilancia, las dos casetas Omega y la auditoría de salida de producto.',
  },
  'Mary Carmen Torres': {
    cargo: 'Jefa del Servicio de Seguridad y Salud en el Trabajo',
    area: 'j-seguridad-salud',
    org: 'iberia',
    notas:
      'Ficha 5032 · Mary Carmen Torres Soto. Entró el 6 de mayo de 2026. Reporta a ' +
      'Gustavo Carballo y tiene línea directa con la Gerencia General.',
  },
  'Paola Mansilla': {
    cargo: 'Coordinadora del Sistema de Gestión de la Calidad',
    area: 'g-calidad',
    org: 'iberia',
    notas:
      'Ficha 4584 · Paola Alejandra Mansilla Pineda. El área va partida en dos: ' +
      'permisología y el sistema documental de todas las áreas.',
  },
  'Merquidia Coss': {
    cargo: 'Coordinadora de Laboratorio',
    area: 'j-laboratorio',
    org: 'iberia',
    notas: 'Ficha 4307 · Merquidia María Coss Arias. Control de calidad.',
  },
  'Pedro Méndez': {
    cargo: 'Coordinador de Servicios Generales',
    area: 'g-mantenimiento',
    org: 'iberia',
    notas:
      'Ficha 4813 · Pedro Luis Méndez Pérez. Doce años en la empresa, desde 2014. ' +
      'Planta de tratamiento de aguas, control de plagas y limpieza, con dos ' +
      'contratistas externos.',
  },

  // --- La formación de la directiva y las comunicaciones ---------------------
  'Martha Fuentes': {
    cargo: 'Gerente de Tecnología de la Información',
    area: 'g-tecnologia',
    org: 'iberia',
    notas:
      'Ficha 4837 · Martha Beatriz Fuentes Quintero. Coordinadora del programa por ' +
      'Iberia. Es quien administra las cuentas y probó los accesos de la formación.',
  },
  'Luis Daniel Agostini': {
    cargo: 'Gerente de Desarrollo Comercial',
    area: 'g-desarrollo-comercial',
    org: 'iberia',
    notas: 'Ficha 5006 · Luis Daniel Agostini Yoris. Analítica, estadística y proyecciones.',
  },
  'Carlos Quintana': {
    cargo: 'Consultor senior en dirigencia y gestión del cambio · Boosty Digital',
    area: 'boosty',
    org: 'boosty',
  },
  'Amado Fuguet': {
    cargo: 'Fuguet Comunicación y Cambio · consultoría de comunicaciones',
    org: 'externo',
  },
  'Marcela Ojeda': {
    cargo: 'Consultora senior · Fuguet Comunicación y Cambio',
    org: 'externo',
  },
}

// -----------------------------------------------------------------------------

const args = process.argv.slice(2)
const revisar = args.includes('--revisar')
const solo = args[args.indexOf('--solo') + 1] || null
const filtro = args.includes('--solo') ? solo : null

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
)

/** Áreas por slug, para colgar cada sesión y cada persona de su nodo. */
const { data: areas, error: errorAreas } = await admin.from('areas').select('id, slug')
if (errorAreas) {
  console.error(`\n✖ No se pudieron leer las áreas: ${errorAreas.message}\n`)
  process.exit(1)
}
const areaPorSlug = new Map(areas.map((a) => [a.slug, a.id]))

/** Crea o actualiza una persona y devuelve su id. */
async function asegurarPersona(nombre) {
  const ficha = PERSONAS[nombre] ?? {}
  const { data: existente } = await admin
    .from('personas')
    .select('id')
    .ilike('nombre_completo', nombre)
    .maybeSingle()

  if (existente) {
    // No se pisa lo que ya está escrito a mano: solo se rellena lo que falta.
    const fila = {}
    if (ficha.cargo) fila.cargo = ficha.cargo
    if (ficha.area) fila.area_id = areaPorSlug.get(ficha.area) ?? null
    if (Object.keys(fila).length) await admin.from('personas').update(fila).eq('id', existente.id)
    return existente.id
  }

  const { data, error } = await admin
    .from('personas')
    .insert({
      nombre_completo: nombre,
      cargo: ficha.cargo ?? null,
      area_id: ficha.area ? (areaPorSlug.get(ficha.area) ?? null) : null,
      organizacion: ficha.org ?? 'iberia',
      notas: ficha.notas ?? null,
    })
    .select('id')
    .single()

  if (error) throw new Error(`persona «${nombre}»: ${error.message}`)
  console.log(`     + persona: ${nombre}`)
  return data.id
}

const pendientes = []
let importadas = 0

for (const s of SESIONES) {
  if (filtro && s.codigo !== filtro) continue

  const ruta = resolve(CARPETA, s.archivo)
  let crudo
  try {
    crudo = readFileSync(ruta, 'utf8')
  } catch {
    console.error(`\n✖ ${s.codigo}: no se encontró ${ruta}\n`)
    process.exit(1)
  }

  const parseada = parsearTranscripcion(crudo, s.archivo)
  if (parseada.segmentos.length === 0) {
    console.error(`\n✖ ${s.codigo}: el archivo no trajo ni un segmento.\n`)
    process.exit(1)
  }
  for (const aviso of parseada.advertencias) console.log(`     ! ${aviso}`)

  // La duración sale del último segmento; no viene en el archivo.
  const ultimoFin = parseada.segmentos.at(-1)?.finSegundos ?? null
  const duracion = ultimoFin ? Math.round(ultimoFin / 60) : null

  const etiquetas = [...new Set(parseada.segmentos.map((x) => x.hablante).filter(Boolean))]
  const sinMapa = etiquetas.filter((e) => !(e in s.hablantes))
  if (sinMapa.length) {
    console.error(`\n✖ ${s.codigo}: hablantes sin mapear → ${sinMapa.join(', ')}\n`)
    process.exit(1)
  }
  for (const [etiqueta, nombre] of Object.entries(s.hablantes)) {
    if (!nombre) pendientes.push(`${s.codigo} · ${etiqueta}`)
  }

  const resueltos = etiquetas.filter((e) => s.hablantes[e]).length
  // Una formación o una reunión no tienen entrevistado: ahí manda el título.
  const rotulo = s.entrevistado ? `${s.entrevistado} · ${s.cargo}` : s.titulo
  console.log(
    `\n── ${s.codigo} · ${rotulo}` +
      `\n     ${parseada.segmentos.length} turnos · ${duracion} min · ` +
      `${resueltos}/${etiquetas.length} hablantes con nombre`
  )

  if (revisar) continue

  // --- La ficha de la sesión -------------------------------------------------
  const fila = {
    codigo: s.codigo,
    tipo: s.tipo,
    // En una entrevista 1:1 el título va vacío a propósito: manda el nombre.
    titulo: s.titulo ?? null,
    entrevistado_nombre: s.entrevistado,
    entrevistado_cargo: s.cargo,
    area_id: s.area ? (areaPorSlug.get(s.area) ?? null) : null,
    sede: s.sede,
    fecha_entrevista: s.fecha ?? null,
    duracion_minutos: duracion,
    entrevistador: s.entrevistador,
    estado: 'transcrita',
  }

  const { data: existente } = await admin
    .from('entrevistas')
    .select('id')
    .eq('codigo', s.codigo)
    .maybeSingle()

  let entrevistaId
  if (existente) {
    entrevistaId = existente.id
    const { error } = await admin.from('entrevistas').update(fila).eq('id', entrevistaId)
    if (error) throw new Error(`${s.codigo}: ${error.message}`)
  } else {
    const { data, error } = await admin.from('entrevistas').insert(fila).select('id').single()
    if (error) throw new Error(`${s.codigo}: ${error.message}`)
    entrevistaId = data.id
  }

  // --- Participantes ---------------------------------------------------------
  await admin.from('sesion_participantes').delete().eq('entrevista_id', entrevistaId)

  for (const [etiqueta, nombre] of Object.entries(s.hablantes)) {
    if (!nombre) continue
    const personaId = await asegurarPersona(nombre)
    const rol =
      nombre === s.entrevistado
        ? 'entrevistado'
        : nombre === s.entrevistador
          ? 'entrevistador'
          : 'participante'
    const { error } = await admin.from('sesion_participantes').insert({
      entrevista_id: entrevistaId,
      persona_id: personaId,
      rol,
      etiqueta_hablante: etiqueta,
    })
    if (error) throw new Error(`${s.codigo} · ${nombre}: ${error.message}`)
  }

  // Al entrevistado se le cuelga también la ficha, para poder saltar de la
  // transcripción a la persona sin pasar por el nombre escrito.
  if (s.entrevistado) {
    const personaId = await asegurarPersona(s.entrevistado)
    await admin.from('entrevistas').update({ entrevistado_id: personaId }).eq('id', entrevistaId)
  }

  // --- Segmentos -------------------------------------------------------------
  await admin.from('transcripcion_segmentos').delete().eq('entrevista_id', entrevistaId)

  const filas = parseada.segmentos.map((seg, i) => ({
    entrevista_id: entrevistaId,
    indice: i,
    // Si no hay nombre se conserva la etiqueta cruda: es más honesto que un
    // «Hablante 3» que parece un nombre y no lo es.
    hablante: (seg.hablante && s.hablantes[seg.hablante]) || seg.hablante,
    hablante_original: seg.hablante,
    inicio_segundos: seg.inicioSegundos,
    fin_segundos: seg.finSegundos,
    texto: seg.texto,
  }))

  for (let i = 0; i < filas.length; i += 500) {
    const { error } = await admin.from('transcripcion_segmentos').insert(filas.slice(i, i + 500))
    if (error) throw new Error(`${s.codigo} segmentos: ${error.message}`)
  }

  console.log(`     ✓ ${filas.length} turnos cargados`)
  importadas++
}

console.log(
  revisar
    ? '\nRevisión: no se escribió nada.\n'
    : `\n${importadas} ${importadas === 1 ? 'sesión cargada' : 'sesiones cargadas'}.\n`
)

if (pendientes.length) {
  console.log('⚠️  Hablantes sin identificar — sin nombre no se puede citar en el informe:')
  for (const p of pendientes) console.log(`     · ${p}`)
  console.log('\n   Para ver los indicios de cada uno:')
  console.log('     node --env-file=.env.local scripts/perfilar-hablantes.mjs <CÓDIGO>\n')
}

const sinFecha = SESIONES.filter((s) => !s.fecha && (!filtro || s.codigo === filtro))
if (sinFecha.length) {
  console.log('⚠️  Sin fecha — no viene en el archivo de Fireflies, hay que ponerla a mano:')
  for (const s of sinFecha) console.log(`     · ${s.codigo}`)
  console.log('')
}
