import {
  ORDEN_PERFILES,
  consumeBolsa,
  mesDe,
  mesesDelReporte,
  type Entregable,
  type Imputacion,
  type Perfil,
  type RegistroHoras,
} from '@/lib/programa'
import { hoyCaracas } from '@/lib/plataforma/formato'

/**
 * Las cuentas de Consumos (PRG-PLN), las mismas de la página vieja: se movieron,
 * no se reescribieron. Por mes **y por perfil** (el cuadro del contrato), la
 * etapa anterior aparte, lo que se factura aparte por su motivo, quién dedicó
 * las horas y en qué se fueron.
 *
 * ⚠️ Lo lee Iberia: aquí solo hay horas. Las tarifas y el fee viven en
 * `lib/programa.ts` y se usan al escribir el reporte mensual, nunca en pantalla.
 *
 * Sin `'use client'` ni `'use server'`: son cuentas puras.
 */

export type Horas = Pick<RegistroHoras, 'fecha' | 'perfil' | 'horas' | 'persona' | 'entregable' | 'imputacion'>

/**
 * En el registro, `persona` es «Boosty» cuando la partida es trabajo de taller
 * —desarrollo, lectura de transcripciones, redacción— que no lo hizo una sola
 * persona. Atribuírselo a alguien sería inventar; dejarlo como «Boosty» a secas,
 * al lado de nombres propios, se lee como un hueco.
 */
export function comoSeLlama(persona: string | null): string {
  if (!persona || persona === 'Boosty') return 'Equipo Boosty'
  return persona
}

export const NOTA_EQUIPO = 'Trabajo de taller —desarrollo, lectura de transcripciones y redacción— que no corresponde a una sola persona.'

export function calcularConsumos(registros: Horas[], hoy = hoyCaracas()) {
  // El reporte arranca en el mes más viejo con horas, aunque sea anterior a la
  // firma: el trabajo previo existió y tiene que verse. Lo que no hace es
  // descontarse de la bolsa — ver `consumeBolsa`.
  const primerMes = registros.reduce((min, r) => (mesDe(r.fecha) < min ? mesDe(r.fecha) : min), mesDe(hoy))
  const meses = mesesDelReporte(primerMes)
  const imputacionDe = (r: { imputacion: string | null }) => (r.imputacion ?? 'bolsa') as Imputacion
  const enBolsa = (r: { imputacion: string | null }) => imputacionDe(r) === 'bolsa'

  const vacio = (): Record<Perfil, number> => ({ consultor_senior: 0, director_arquitecto: 0, consultor_procesos: 0, desarrollador_ia: 0 })
  const porMes = new Map<string, Record<Perfil, number>>(meses.map((m) => [m, vacio()]))
  for (const r of registros) {
    if (!enBolsa(r)) continue
    const fila = porMes.get(mesDe(r.fecha))
    if (fila) fila[r.perfil as Perfil] += Number(r.horas)
  }
  const totalDelMes = (m: string) => ORDEN_PERFILES.reduce((t, p) => t + (porMes.get(m)?.[p] ?? 0), 0)

  const deLaFase = registros.filter((r) => consumeBolsa(mesDe(r.fecha)) && enBolsa(r))
  // La etapa anterior: lo de antes del mes de la firma, y lo que cae dentro de
  // ese mes pero es cierre de la etapa anterior (`fase_0`): el corte de
  // `consumeBolsa()` va por mes calendario, no por día.
  const previas = registros.filter((r) => !consumeBolsa(mesDe(r.fecha)) || imputacionDe(r) === 'fase_0')
  const aparte = registros.filter((r) => consumeBolsa(mesDe(r.fecha)) && !enBolsa(r) && imputacionDe(r) !== 'fase_0')
  const suma = (l: Horas[]) => l.reduce((t, r) => t + Number(r.horas), 0)

  const bolsasAparte = [...new Set(aparte.map(imputacionDe))].map((imp) => ({ imp, horas: suma(aparte.filter((r) => imputacionDe(r) === imp)) }))

  const porPersona = new Map<string, { horas: number; perfiles: Set<Perfil> }>()
  for (const r of deLaFase) {
    const clave = comoSeLlama(r.persona)
    const ficha = porPersona.get(clave) ?? { horas: 0, perfiles: new Set<Perfil>() }
    ficha.horas += Number(r.horas)
    ficha.perfiles.add(r.perfil as Perfil)
    porPersona.set(clave, ficha)
  }

  const porEntregable = new Map<Entregable, number>()
  for (const r of deLaFase) porEntregable.set(r.entregable as Entregable, (porEntregable.get(r.entregable as Entregable) ?? 0) + Number(r.horas))
  const aparteDe = new Map<Entregable, number>()
  for (const r of aparte) aparteDe.set(r.entregable as Entregable, (aparteDe.get(r.entregable as Entregable) ?? 0) + Number(r.horas))

  return {
    meses,
    porMes,
    totalDelMes,
    totalHoras: suma(deLaFase),
    totalPrevias: suma(previas),
    bolsasAparte,
    gente: [...porPersona].sort((a, b) => b[1].horas - a[1].horas),
    porEntregable,
    aparteDe,
    mesActual: mesDe(hoy),
  }
}

/** «12,5 h»: coma decimal, y sin decimales cuando es redondo. */
export function horas(n: number): string {
  return `${n.toLocaleString('es-VE', { maximumFractionDigits: 2 })} h`
}

/** Días que faltan para una fecha (negativo = ya pasó), contados en Caracas. */
export function diasHasta(iso: string, hoy = hoyCaracas()): number {
  return Math.round((new Date(`${iso}T12:00:00Z`).getTime() - new Date(`${hoy}T12:00:00Z`).getTime()) / 86_400_000)
}
