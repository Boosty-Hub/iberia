/**
 * Vocabulario del adiestramiento en IA · el curso de Ajito.
 *
 * Las claves espejan los CHECK del schema; los valores son lo que ve el usuario.
 * El guion completo, palabra por palabra, vive en `contenido/adiestramiento/`.
 * Aquí está solo lo que la aplicación necesita para presentarlo.
 */

/** Clave del único curso por ahora. */
export const CURSO = 'ajito'

// -----------------------------------------------------------------------------
// Familias de oficio
// -----------------------------------------------------------------------------

/**
 * El ejercicio bifurca por oficio, no por nivel.
 *
 * Bajo `nivel = 'planta'` conviven la operadora de envasado, la cocinera de
 * pruebas, el montacarguista y el vigilante. Si a la cocinera le llega un
 * ejercicio del codificador de frascos, el curso le está diciendo que la
 * empresa no sabe qué hace ella.
 */
export type FamiliaOficio =
  | 'linea'
  | 'cocina'
  | 'almacen'
  | 'mantenimiento'
  | 'laboratorio'
  | 'limpieza'
  | 'seguridad'
  | 'oficina'
  | 'supervision'
  | 'generico'

export const FAMILIAS_OFICIO: Record<FamiliaOficio, string> = {
  linea: 'Línea de producción',
  cocina: 'Cocina de pruebas',
  almacen: 'Almacén y despacho',
  mantenimiento: 'Mantenimiento',
  laboratorio: 'Laboratorio y calidad',
  limpieza: 'Limpieza y servicios',
  seguridad: 'Seguridad y vigilancia',
  oficina: 'Oficina',
  supervision: 'Supervisión',
  generico: 'General',
}

/** Qué hace cada quien, para explicar la clasificación en el panel. */
export const FAMILIA_DESCRIPCION: Record<FamiliaOficio, string> = {
  linea: 'Operadores de máquinas, empacadores, embaladores, alimentadores',
  cocina: 'Preparadores de pruebas, cocineros, desarrollo de producto',
  almacen: 'Despachadores, montacarguistas, auxiliares y analistas de almacén',
  mantenimiento: 'Técnicos, coordinadores y almacén de repuestos',
  laboratorio: 'Analistas, inspectores de procesos, auxiliares de calidad',
  limpieza: 'Limpiadores y servicios generales',
  seguridad: 'Vigilantes, prevención de pérdidas, seguridad y salud',
  oficina: 'Administrativos, nómina, auxiliares, motorizado',
  supervision: 'Supervisores y coordinadores de cualquier área',
  generico:
    'Sin clasificar todavía. No es un descarte: recibe el ejercicio general, ' +
    'que está escrito para funcionar con cualquier oficio.',
}

export const FAMILIAS_ORDEN: FamiliaOficio[] = [
  'linea',
  'cocina',
  'almacen',
  'mantenimiento',
  'laboratorio',
  'limpieza',
  'seguridad',
  'supervision',
  'oficina',
  'generico',
]

// -----------------------------------------------------------------------------
// Las formas en que actúa la IA — el eje del curso
// -----------------------------------------------------------------------------

export type FormaIA =
  | 'bienvenida'
  | 'entiende'
  | 'escucha'
  | 've'
  | 'dibuja'
  | 'habla'
  | 'cuenta'
  | 'se_equivoca'
  | 'cierre'

export const FORMAS_IA: Record<FormaIA, string> = {
  bienvenida: 'Bienvenida',
  entiende: 'Entiende lo que le dices',
  escucha: 'Te escucha',
  ve: 'Ve',
  dibuja: 'Dibuja',
  habla: 'Habla',
  cuenta: 'Saca cuentas',
  se_equivoca: 'Se equivoca',
  cierre: 'Cierre',
}

/** Una línea que cabe en la tarjeta de la lección, en la voz de Ajito. */
export const FORMA_GANCHO: Record<FormaIA, string> = {
  bienvenida: 'Quién soy y qué vamos a hacer.',
  entiende: 'Háblame en criollo. No hay claves que aprenderse.',
  escucha: 'No escribas. Mándame un audio.',
  ve: 'Mándame una foto y te digo qué hay.',
  dibuja: 'Descríbeme algo y te lo hago.',
  habla: 'Te leo en voz alta lo que quieras.',
  cuenta: 'Dime los números y yo saco la cuenta.',
  se_equivoca: 'Dónde me equivoco yo, y cómo pillarme.',
  cierre: 'Lo que aprendiste, y tu certificado.',
}

export type EstadoMatricula = 'pendiente' | 'en_curso' | 'completado'

export const ESTADOS_MATRICULA: Record<EstadoMatricula, string> = {
  pendiente: 'Sin empezar',
  en_curso: 'En curso',
  completado: 'Terminado',
}

export type TipoEntrada = 'texto' | 'voz' | 'foto' | 'boton'

export const TIPOS_ENTRADA: Record<TipoEntrada, string> = {
  texto: 'Escrito',
  voz: 'Nota de voz',
  foto: 'Foto',
  boton: 'Botón',
}

// -----------------------------------------------------------------------------
// La pregunta de campo — lo que convierte el curso en levantamiento
// -----------------------------------------------------------------------------

/**
 * Cada lección cierra con una pregunta abierta, y la pregunta cambia según el
 * oficio. Doscientas respuestas habladas a estas preguntas, segmentadas por
 * familia, son la fuente más rica del Documento de Arquitectura — y no la
 * produce ninguna ronda de entrevistas.
 *
 * `generico` no es el respaldo cuando algo falla: es el estado por defecto, y
 * está escrito para que funcione bien con cualquiera.
 */
type PreguntaPorFamilia = Partial<Record<FamiliaOficio, string>> & {
  generico: string
}

export const PREGUNTA_CAMPO: Partial<Record<FormaIA, PreguntaPorFamilia>> = {
  entiende: {
    linea: '¿Qué es lo primero que hay que explicarle a alguien nuevo en tu línea, y qué es lo que más les cuesta agarrar?',
    cocina: 'Cuando estás haciendo una prueba, ¿qué es lo que no se puede explicar por escrito y hay que enseñarlo probando?',
    almacen: '¿Qué es lo que más te preguntan los demás cuando vienen a buscar algo?',
    mantenimiento: 'Cuando llega una falla, ¿qué es lo primero que revisas, eso que ya sabes de memoria?',
    laboratorio: '¿Qué es lo que más te toca explicarle a alguien de producción sobre un resultado?',
    limpieza: '¿Qué es lo que la gente no sabe de tu trabajo y debería saber?',
    seguridad: '¿Qué es lo que más te toca recordarle a la gente todos los días?',
    oficina: '¿Qué es lo que más te vienen a preguntar, una y otra vez?',
    supervision: '¿Qué es lo que más te toca explicar dos y tres veces en un turno?',
    generico: '¿Qué es lo que más te toca explicarle a otra persona en tu trabajo?',
  },
  escucha: {
    generico:
      'En tu trabajo, ¿qué es lo que te toca contar o avisar hablando todos los días? ¿Y a quién se lo cuentas?',
  },
  ve: {
    generico:
      'En tu puesto, ¿qué es lo que te toca leer o revisar con los ojos todos los días? Una etiqueta, un número, un tablero, una planilla.',
  },
  dibuja: {
    generico:
      'En tu trabajo, ¿hay algo que sería más fácil de explicar con un dibujo que con palabras? ¿Qué cosa?',
  },
  habla: {
    generico:
      '¿Qué papel te toca leer en tu trabajo que sea largo, o que tenga la letra muy chiquita, o que cueste entender?',
  },
  cuenta: {
    generico:
      '¿Qué cuenta te toca sacar en tu trabajo que hoy haces de cabeza, o en un papel, o con la calculadora del teléfono?',
  },
  se_equivoca: {
    generico:
      '¿Qué sabes tú de tu puesto que no esté escrito en ningún lado? Eso que uno aprende con los años y que no está en ningún manual: un truco, una maña, algo que se nota por el ruido o por el olor.',
  },
  cierre: {
    generico:
      'En tu puesto, en lo que tú haces todos los días, ¿en qué te ayudaría a ti algo como yo? No pienses en la empresa: piensa en tu turno, en lo que te fastidia o te quita tiempo.',
  },
}

/** La pregunta que le toca a esta persona en esta lección. */
export function preguntaDeCampo(forma: FormaIA, familia: FamiliaOficio): string | null {
  const mapa = PREGUNTA_CAMPO[forma]
  if (!mapa) return null
  return mapa[familia] ?? mapa.generico
}

// -----------------------------------------------------------------------------
// Ejercicios que bifurcan por oficio
// -----------------------------------------------------------------------------

/** Lección 2 · «cuéntame de corrido cómo haces esto». */
export const EJERCICIO_PROCESO: PreguntaPorFamilia = {
  linea: 'Cómo se arranca tu máquina en la mañana, desde que llegas.',
  cocina: 'Cómo preparas una de las pruebas que haces, desde que sacas los ingredientes.',
  almacen: 'Cómo recibes un camión, desde que se para en el muelle.',
  mantenimiento: 'Cómo atiendes una falla, desde que te avisan.',
  laboratorio: 'Cómo procesas una muestra, desde que te llega.',
  limpieza: 'Cómo se lava un equipo, desde que lo paran.',
  seguridad: 'Cómo haces una ronda, desde que arrancas.',
  oficina: 'Cómo procesas una de las cosas que te llegan todos los días.',
  supervision: 'Cómo arrancas un turno, desde que llegas.',
  generico: 'Algo que hagas todos los días, paso por paso, desde el principio.',
}

/** Lección 4 · el escudo que después se comparte. */
export const EJERCICIO_ESCUDO: PreguntaPorFamilia = {
  linea: 'El escudo de tu línea. Qué animal la representaría, qué colores, qué lema.',
  cocina: 'El escudo de la cocina de pruebas, con lo que se hace ahí.',
  almacen: 'El escudo del almacén. Con montacargas, si quieres.',
  mantenimiento: 'El escudo de mantenimiento, con las herramientas que más usas.',
  laboratorio: 'El escudo del laboratorio.',
  limpieza: 'El escudo de tu equipo.',
  seguridad: 'El escudo de tu grupo.',
  oficina: 'El escudo de tu oficina.',
  supervision: 'El escudo de tu turno.',
  generico:
    'El escudo de tu equipo de trabajo. Qué animal los representaría, qué colores, qué lema.',
}

/** Lección 6 · cinco números del oficio. */
export const EJERCICIO_NUMEROS: PreguntaPorFamilia = {
  linea: 'Cuántas cajas o cuántos frascos salieron en cada una de las últimas horas.',
  cocina: 'Los gramajes de una fórmula que te sepas.',
  almacen: 'Cuántos bultos traía cada uno de los últimos camiones.',
  mantenimiento: 'Cuántas horas te llevó cada una de las últimas reparaciones.',
  laboratorio: 'Los resultados de las últimas muestras que corriste.',
  limpieza: 'Cuántos minutos te lleva lavar cada equipo.',
  seguridad: 'Cuántas rondas hiciste cada día de la semana.',
  oficina: 'Cuántas planillas procesaste cada día de esta semana.',
  supervision: 'Cuánta gente tuviste en cada uno de los últimos turnos.',
  generico: 'Cinco números cualquiera de tu semana. Los que sean.',
}

/** Lección 7 · pregúntame algo que solo se sepa aquí adentro. */
export const EJERCICIO_PILLAME: PreguntaPorFamilia = {
  linea: 'Cuántos frascos sacó tu línea la semana pasada, o por qué se paró ayer.',
  cocina: 'Qué lleva una de las fórmulas que tú preparas.',
  almacen: 'Qué llegó en el último camión, o qué hay en el rack 16.',
  mantenimiento: 'Qué le pasó al equipo que arreglaste esta semana.',
  laboratorio: 'Cómo salió la última muestra que corriste.',
  limpieza: 'Cada cuánto se lava un equipo específico de aquí.',
  seguridad: 'Quién entró ayer por la mañana.',
  oficina: 'Cuántas planillas entraron esta semana.',
  supervision: 'Cuánta gente tuviste ayer en tu turno.',
  generico: 'Algo de tu trabajo que solo se sepa aquí adentro.',
}

export function porFamilia(mapa: PreguntaPorFamilia, familia: FamiliaOficio): string {
  return mapa[familia] ?? mapa.generico
}

/** Un ejercicio de la lección: lo que Ajito pide y cómo se le contesta. */
export type Ejercicio = {
  clave: string
  consigna: string
  /** Cómo se espera la respuesta. Manda la etiqueta del campo de entrada. */
  entrada: TipoEntrada
  /** Aparece bajo la consigna cuando hay una norma de por medio. */
  aviso?: string
}

/**
 * Los ejercicios de práctica de cada lección, ya resueltos para el oficio de
 * quien los va a hacer. La pregunta de campo va aparte: esa cierra siempre y la
 * arma `preguntaDeCampo`.
 */
export function ejerciciosDeLeccion(
  forma: FormaIA,
  familia: FamiliaOficio
): Ejercicio[] {
  switch (forma) {
    case 'bienvenida':
      return [
        { clave: 'apodo', consigna: '¿Cómo te digo? No el nombre del carnet: como te dicen aquí.', entrada: 'texto' },
        { clave: 'primer-toque', consigna: 'Mándame lo que sea. Una pregunta, un saludo, lo primero que se te ocurra.', entrada: 'texto' },
      ]
    case 'entiende':
      return [
        { clave: 'pregunta-corta', consigna: 'Pregúntame algo. Lo que sea, corto, como te salga.', entrada: 'texto' },
        { clave: 'pregunta-con-contexto', consigna: 'Hazme la misma pregunta, pero esta vez cuéntame más: dónde estás, qué tienes delante, para qué lo quieres saber.', entrada: 'texto' },
        { clave: 'mas-facil', consigna: 'Ahora pídeme que te lo explique más fácil.', entrada: 'texto' },
      ]
    case 'escucha':
      return [
        { clave: 'como-te-fue', consigna: 'Mándame una nota de voz contándome cómo te fue hoy. Como se lo contarías a un compañero.', entrada: 'voz' },
        { clave: 'proceso', consigna: `Cuéntame de corrido, sin ordenar nada: ${porFamilia(EJERCICIO_PROCESO, familia)}`, entrada: 'voz' },
      ]
    case 've':
      return [
        { clave: 'selfie', consigna: 'Tómate una foto tú, así como estés. No te arregles, que esto no es para el carnet.', entrada: 'foto', aviso: AVISO_FOTOS },
        { clave: 'companero', consigna: 'Ahora una con un compañero. Pídele permiso primero: esa foto es de él.', entrada: 'foto', aviso: AVISO_FOTOS },
        { clave: 'etiqueta-casa', consigna: 'Búscate algo de Iberia en tu cocina —la mayonesa, la salsa de soya, un adobo— y tómale foto a la etiqueta de atrás, la de la letra chiquita.', entrada: 'foto' },
      ]
    case 'dibuja':
      return [
        { clave: 'libre', consigna: 'Descríbeme lo que quieras ver. No tiene que ser del trabajo.', entrada: 'texto' },
        { clave: 'escudo', consigna: porFamilia(EJERCICIO_ESCUDO, familia), entrada: 'texto' },
      ]
    case 'habla':
      return [
        { clave: 'dime-algo', consigna: 'Pídeme que te diga algo con la voz. Un chiste, un refrán, algo en otro idioma.', entrada: 'texto' },
        { clave: 'leeme-esto', consigna: 'Búscate algo escrito que no hayas terminado de leer y mándamelo. Que no sea del trabajo, que ya sabes la norma.', entrada: 'texto' },
      ]
    case 'cuenta':
      return [
        { clave: 'numeros-oficio', consigna: `Dame cinco números de los que tú manejas: ${porFamilia(EJERCICIO_NUMEROS, familia)}`, entrada: 'voz' },
        { clave: 'cuenta-propia', consigna: 'Ahora una que sí te sirve: cuánto gastas en pasaje al día, y cuántos días trabajas al mes.', entrada: 'texto' },
      ]
    case 'se_equivoca':
      return [
        { clave: 'pillame', consigna: `Pregúntame algo de aquí adentro: ${porFamilia(EJERCICIO_PILLAME, familia)}`, entrada: 'texto' },
        { clave: 'ahora-cuentame', consigna: 'Vuelve a preguntarme lo mismo, pero contándomelo tú primero.', entrada: 'texto' },
      ]
    case 'cierre':
      return [
        { clave: 'como-te-fue-el-curso', consigna: '¿Cómo te pareció el curso? Dime la verdad, que a mí no me duele. Qué te sirvió, qué no, qué le falta.', entrada: 'voz' },
      ]
    default:
      return []
  }
}

// -----------------------------------------------------------------------------
// Reglas de forma que la interfaz tiene que respetar
// -----------------------------------------------------------------------------

/**
 * En planta no se toman fotos y el teléfono no se usa en las líneas. Ningún
 * ejercicio pide fotografiar una máquina, una etiqueta de proceso ni un
 * documento de trabajo — solo a la persona, a un compañero con su permiso, o
 * cosas de su casa. La regla completa está en
 * `contenido/adiestramiento/00-reglas-del-guion.md`.
 */
export const AVISO_FOTOS =
  'En el área de producción no se toman fotos. Hazla en el salón, en el comedor, ' +
  'en la entrada o en tu casa.'

/** Cuánto se demora una lección, para poder prometerlo sin mentir. */
export function minutosTexto(minutos: number): string {
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`
}
