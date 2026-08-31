/**
 * El programa, en datos: los perfiles con su tarifa, los siete entregables de la
 * Fase 1 y sus fechas.
 *
 * Todo lo de aquí sale de dos documentos que están en el módulo de archivos —la
 * Propuesta Técnica y Económica y el contrato `CONT-2026-08-0002`— y **no es
 * configurable desde el panel a propósito**: son términos firmados. Si cambia
 * alguno, cambió el contrato, y eso se toca aquí y en la migración, no en una
 * pantalla de ajustes.
 */

import type { Row } from '@/lib/types'

export type Hito = Row<'hitos'>
export type RegistroHoras = Row<'registros_horas'>

// -----------------------------------------------------------------------------
// Los perfiles · Sección 07 de la propuesta, incorporada por la cláusula 8
// -----------------------------------------------------------------------------

export type Perfil =
  | 'consultor_senior'
  | 'director_arquitecto'
  | 'consultor_procesos'
  | 'desarrollador_ia'

export const PERFILES: Record<Perfil, string> = {
  consultor_senior: 'Consultor senior estratégico',
  director_arquitecto: 'Director de proyecto y arquitecto de IA',
  consultor_procesos: 'Consultores de procesos',
  desarrollador_ia: 'Desarrolladores de IA',
}

/**
 * Para los encabezados de tabla. No se recorta el nombre largo por código:
 * «Consultor senior» y «Consultores de procesos» empiezan igual, y cortando por
 * la primera palabra las dos columnas quedan diciendo «Consultor».
 */
export const PERFIL_CORTO: Record<Perfil, string> = {
  consultor_senior: 'Senior',
  director_arquitecto: 'Dirección',
  consultor_procesos: 'Procesos',
  desarrollador_ia: 'Desarrollo',
}

/** Qué hace cada perfil, tal como lo describe la propuesta. */
export const PERFIL_ROL: Record<Perfil, string> = {
  consultor_senior: 'Gobernanza, acompañamiento directivo quincenal, gestión del cambio',
  director_arquitecto: 'Dirección del programa, arquitectura y relación con la Gerencia General',
  consultor_procesos: 'Entrevistas, levantamiento, documentación de procesos y formación por áreas',
  desarrollador_ia: 'App interna, chat organizacional, integraciones y módulos',
}

/**
 * El trabajo, no el cargo. Es lo que va al lado del nombre de una persona.
 *
 * `PERFILES` nombra la casilla del contrato y va en plural —«Consultores de
 * procesos»—, que al lado de un nombre propio se lee mal: «Ruth Velázquez ·
 * Consultores de procesos». Y el singular obliga a elegir género, que es lo que
 * este proyecto no hace con nadie. Nombrar el trabajo lo resuelve: sirve para
 * cualquiera y además le dice más al cliente que el título del puesto.
 */
export const PERFIL_TRABAJO: Record<Perfil, string> = {
  consultor_senior: 'Acompañamiento directivo y gestión del cambio',
  director_arquitecto: 'Dirección del programa y arquitectura de IA',
  consultor_procesos: 'Levantamiento de procesos y formación',
  desarrollador_ia: 'Desarrollo del aplicativo',
}

/**
 * Tarifa por hora de cada perfil, en dólares. Término firmado.
 *
 * ⚠️ **No se pinta en pantalla.** `/dashboard/programa` lo lee Iberia, y el
 * precio ya está firmado en el contrato: un contador de dinero corriendo en una
 * pantalla no informa, negocia. Vive aquí porque de aquí sale `FEE_MENSUAL`, y
 * se usa cuando hay que escribir el reporte mensual.
 */
export const TARIFA: Record<Perfil, number> = {
  consultor_senior: 200,
  director_arquitecto: 160,
  consultor_procesos: 100,
  desarrollador_ia: 80,
}

/** Horas al mes de cada perfil. Suman las 107 de la bolsa. */
export const CUOTA: Record<Perfil, number> = {
  consultor_senior: 6,
  director_arquitecto: 20,
  consultor_procesos: 36,
  desarrollador_ia: 45,
}

export const ORDEN_PERFILES: Perfil[] = [
  'consultor_senior',
  'director_arquitecto',
  'consultor_procesos',
  'desarrollador_ia',
]

/** 107 h/mes. Se calcula, no se escribe: si cambia una cuota, cambia el total. */
export const BOLSA_MENSUAL = ORDEN_PERFILES.reduce((t, p) => t + CUOTA[p], 0)

/** USD 11.600. Igual: sale de las cuotas y las tarifas, no de una constante suelta. */
export const FEE_MENSUAL = ORDEN_PERFILES.reduce((t, p) => t + CUOTA[p] * TARIFA[p], 0)

// -----------------------------------------------------------------------------
// Los siete entregables · cláusula 5 y tabla de la página 7 de la propuesta
// -----------------------------------------------------------------------------

export type Entregable =
  | 'comunicacion'
  | 'app'
  | 'formacion'
  | 'levantamiento'
  | 'inventario'
  | 'planta'
  | 'arquitectura'
  | 'gestion'

export const ENTREGABLES: Record<Entregable, string> = {
  comunicacion: 'Plan de comunicación y comunicado',
  app: 'App de comunicación interna',
  formacion: 'Chat organizacional y formación dirigente',
  levantamiento: 'Entrevistas y levantamiento',
  inventario: 'Inventario de sistemas y datos',
  planta: 'Programa de formación de planta',
  arquitectura: 'Documento de Arquitectura de IA',
  // `gestion` es el que no cuenta contra ninguno de los siete: la dirección del
  // programa, la reportería **y el aplicativo del levantamiento**, que no es
  // entregable contractual pero es donde vive todo lo demás.
  //
  // Se llamaba «Dirección, gobierno y reportería» y era el rótulo más engañoso de
  // la página: con las 40 h del dashboard y las 16 del importador adentro, el
  // cliente leía 90 horas de pura administración. Nombrar la herramienta cambia lo
  // que se entiende sin tocar un solo dato.
  gestion: 'Herramientas y dirección del programa',
}

/** Qué hay dentro de cada bolsillo, para el cliente. */
export const ENTREGABLE_NOTA: Partial<Record<Entregable, string>> = {
  gestion:
    'El aplicativo donde vive el levantamiento, la dirección del programa y la reportería. ' +
    'No es uno de los siete entregables del contrato.',
}

/**
 * Cuándo vence cada uno.
 *
 * ⚠️ Estas fechas **no** son las de la propuesta. La propuesta pone el Documento
 * de Arquitectura en el Mes 5 —principios de enero—, pero el aviso de no
 * renovación de la cláusula 8 es de 30 días sobre un plazo mínimo que vence
 * alrededor del 6 de enero: **Iberia tiene que decidir si sigue alrededor del 6
 * de diciembre**, un mes antes de recibir el instrumento que existe para que
 * decida. Todo el calendario se adelantó para que el comité apruebe con el
 * documento en la mano y no de memoria.
 */
export const VENCE: Record<Entregable, string | null> = {
  comunicacion: '2026-09-06',
  app: '2026-09-30',
  formacion: '2026-10-31',
  levantamiento: '2026-11-07',
  inventario: '2026-11-14',
  planta: '2026-11-30',
  arquitectura: '2026-12-06',
  gestion: null,
}

/** El orden en que se leen: por fecha de vencimiento, no por importancia. */
export const ORDEN_ENTREGABLES: Entregable[] = [
  'comunicacion',
  'app',
  'formacion',
  'levantamiento',
  'inventario',
  'planta',
  'arquitectura',
  'gestion',
]

// -----------------------------------------------------------------------------
// La fase
// -----------------------------------------------------------------------------

/** Cuerpo del contrato, cláusula 17: «a los seis (6) días del mes de Agosto». */
export const FIRMA = '2026-08-06'

/** Plazo mínimo: 5 meses desde la firma. */
export const CIERRE_FASE = '2027-01-06'

/** Aviso de no renovación: 30 días antes (cláusula 8). Es la fecha que manda. */
export const AVISO_RENOVACION = '2026-12-06'

// -----------------------------------------------------------------------------

/**
 * Contra qué se mide una partida de horas.
 *
 * No todo lo que se trabaja se le cobra a la bolsa. El programa de formación de
 * planta se factura aparte —USD 60 por despliegue individual, activable en la
 * Fase 2 según la cláusula 8—, así que sus horas se registran pero no descuentan:
 * cargarlas contra las 107 mensuales sería cobrarlas dos veces.
 */
export type Imputacion = 'bolsa' | 'fase_0' | 'fase_2' | 'adicional'

export const IMPUTACIONES: Record<Imputacion, string> = {
  bolsa: 'Consume la bolsa de la fase',
  fase_0: 'Etapa anterior, ya facturada aparte',
  fase_2: 'Se factura aparte en la Fase 2',
  adicional: 'Fuera de la bolsa, aprobada por escrito',
}

export const IMPUTACION_NOTA: Record<Imputacion, string> = {
  bolsa: 'Lo normal: descuenta de las 107 h del mes',
  fase_0: 'lo previo a la firma, aunque caiga en el mes de la firma — ya se cobró aparte',
  fase_2: 'el curso de planta, que va por licenciamiento propio y no descuenta',
  adicional: 'solo si Iberia la aprobó por escrito ANTES de ejecutarla',
}

/** Cómo se le presenta a Iberia cada bolsa que no descuenta de la referencia. */
export const IMPUTACION_TITULO: Partial<Record<Imputacion, string>> = {
  fase_0: 'de la etapa anterior',
  fase_2: 'del programa de formación de planta',
  adicional: 'aprobadas aparte por escrito',
}

export const IMPUTACION_DETALLE: Partial<Record<Imputacion, string>> = {
  fase_0:
    'El cierre de la etapa anterior: el comité de julio, la memoria estratégica, la propuesta, ' +
    'el deck de la sesión de lanzamiento y la negociación del contrato. Se facturó aparte y por ' +
    'eso se muestra separado, aunque parte de ese trabajo caiga en los primeros días de agosto.',
  fase_2:
    'Diseño completo del curso para el personal de planta —guion, audios, material y ' +
    'seguimiento—. Va por su propio licenciamiento en la Fase 2, así que tampoco descuenta de ' +
    'la referencia mensual: cargarlo aquí sería contarlo dos veces.',
  adicional:
    'Horas fuera de la referencia mensual que Iberia aprobó por escrito antes de ejecutarlas.',
}

export type TipoHito = 'contrato' | 'entregable' | 'sesion' | 'comunicacion' | 'decision' | 'hito'

export const TIPOS_HITO: Record<TipoHito, string> = {
  contrato: 'Contrato',
  entregable: 'Entregable',
  sesion: 'Sesión',
  comunicacion: 'Comunicación',
  decision: 'Decisión',
  hito: 'Hito',
}

export type EstadoHito = 'hecho' | 'previsto' | 'en_riesgo' | 'cancelado'

export const ESTADOS_HITO: Record<EstadoHito, string> = {
  hecho: 'Hecho',
  previsto: 'Previsto',
  en_riesgo: 'En riesgo',
  cancelado: 'Cancelado',
}

/** Horas a dinero, al perfil que corresponda. */
export function valorDe(perfil: Perfil, horas: number): number {
  return horas * TARIFA[perfil]
}

/** `YYYY-MM-01` del mes al que pertenece una fecha. */
export function mesDe(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`
}

/** El mes de la firma. Todo lo anterior es trabajo previo, no consume bolsa. */
export const MES_FIRMA = mesDe(FIRMA)

/**
 * Los meses del reporte, en `YYYY-MM-01`. Van del cierre de la fase hacia atrás
 * hasta la firma, y **más atrás si hay horas cargadas antes** — el trabajo previo
 * a la firma existió y tiene que verse.
 *
 * El reporte va por mes calendario porque así se factura: la cláusula 8 factura
 * «dentro de los primeros cinco días hábiles de cada mes».
 */
export function mesesDelReporte(desde: string = MES_FIRMA): string[] {
  const meses: string[] = []
  const inicio = desde < MES_FIRMA ? desde : MES_FIRMA
  const [a0, m0] = inicio.split('-').map(Number)
  const [a1, m1] = CIERRE_FASE.split('-').map(Number)
  for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1); m++) {
    if (m > 12) {
      m = 1
      a++
    }
    meses.push(`${a}-${String(m).padStart(2, '0')}-01`)
  }
  return meses
}

/**
 * ¿Ese mes consume bolsa?
 *
 * Lo anterior a la firma es la Fase 0 —la propuesta, el comité del 9 de julio, la
 * memoria estratégica—, que se cobró aparte por USD 4.700. Se registra porque el
 * expediente tiene que estar completo y porque son horas que el equipo trabajó,
 * pero **no se descuenta de las 107 mensuales de la Fase 1**: contarlas ahí sería
 * cobrar dos veces el mismo trabajo.
 */
export function consumeBolsa(mes: string): boolean {
  return mes >= MES_FIRMA
}

/**
 * «agosto de 2026», para los encabezados.
 *
 * Se formatea en UTC a propósito. Sin eso, el primero del mes a medianoche UTC
 * cae en el mes anterior visto desde Venezuela (UTC−4), y la tabla entera
 * arranca un mes antes de lo que debe. Es la misma trampa que `formatFecha`
 * esquiva forzando el mediodía.
 */
export function nombreMes(iso: string): string {
  const [a, m] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-VE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(a, m - 1, 1, 12)))
}
