import { cookies } from 'next/headers'
import { cache } from 'react'
import { puede, type Sesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { DOMINIOS, MODULOS_MI_DIA, dominioDe, type ClaveDominio, type EstadoModulo, type ModuloPlan } from '@/lib/plataforma/dominios'
import { esFecha, esUuid, hoyCaracas } from '@/lib/plataforma/formato'

/**
 * Lo que el armazón y las páginas leen del servidor: el plan de módulos, las
 * tasas del día y el contexto global (fecha de los datos, escenario, moneda).
 * Cada lectura va con `cache()`: el layout y la página la piden en la misma
 * petición.
 */

export type Moneda = 'VES' | 'USD'
export const COOKIE_MONEDA = 'moneda'
export const COOKIE_RIEL = 'riel'
export const COOKIE_COLUMNA = 'columna'

/** El registro de módulos del plan, en su orden. Lo lee cualquiera con sesión. */
export const modulosDelPlan = cache(async (): Promise<ModuloPlan[]> => {
  const supabase = await createClient()
  const { data } = await supabase.schema('control').from('modulo').select('*').order('orden')
  return (data ?? []).map((m) => ({ ...m, estado: m.estado as EstadoModulo }))
})

/**
 * Los módulos que esta sesión ve en el menú: los planificados (son el plan, sin
 * pantalla) y los que tienen pantalla si su permiso alcanza. «Mi día» siempre.
 */
export function modulosVisibles(sesion: Sesion, modulos: ModuloPlan[]): (ModuloPlan & { dominioClave: ClaveDominio })[] {
  const todos = [...MODULOS_MI_DIA, ...modulos]
  return todos
    .filter((m) => m.estado === 'planificado' || !m.recurso || puede(sesion, m.recurso) || (m.recurso === 'sistema:requisiciones' && puede(sesion, m.recurso, 'crear')))
    .map((m) => ({ ...m, dominioClave: m.dominio === 'Mi día' ? ('inicio' as const) : dominioDe(m) }))
    .sort((a, b) => DOMINIOS.findIndex((d) => d.clave === a.dominioClave) - DOMINIOS.findIndex((d) => d.clave === b.dominioClave) || a.orden - b.orden)
}

export type TasasDelDia = {
  dia: string
  usd: number | null
  usdFechaValor: string | null
  usdCapturada: string | null
  usdVerificada: string | null
  usdAnterior: number | null
  eur: number | null
  eurFechaValor: string | null
  /** Solo con `sistema:tasas-paralelo`: la base no lo manda a nadie más. */
  paralelo: number | null
  paraleloCapturada: string | null
  brecha: number | null
  brechaAnterior: number | null
  veParalelo: boolean
}

/**
 * Las tasas vigentes de un día (`control.tasas_del_dia`). La RPC solo devuelve
 * el paralelo a quien tiene el permiso, y registra esa lectura. Con «ver como»
 * se esconde también si el rol previsualizado no lo tiene.
 */
export const tasasDelDia = cache(async (sesion: Sesion, dia?: string): Promise<TasasDelDia | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.schema('control').rpc('tasas_del_dia', dia ? { p_dia: dia } : {})
  if (error || !data) return null
  const r = data as Record<string, unknown>
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  const str = (v: unknown) => (typeof v === 'string' ? v : null)
  const ve = Boolean(r.ve_paralelo) && puede(sesion, 'sistema:tasas-paralelo')
  return {
    dia: str(r.dia) ?? hoyCaracas(),
    usd: num(r.usd),
    usdFechaValor: str(r.usd_fecha_valor),
    usdCapturada: str(r.usd_capturada),
    usdVerificada: str(r.usd_verificada),
    usdAnterior: num(r.usd_anterior),
    eur: num(r.eur),
    eurFechaValor: str(r.eur_fecha_valor),
    paralelo: ve ? num(r.paralelo) : null,
    paraleloCapturada: ve ? str(r.paralelo_capturada) : null,
    brecha: ve ? num(r.brecha) : null,
    brechaAnterior: ve ? num(r.brecha_anterior) : null,
    veParalelo: ve,
  }
})

export type ContextoGlobal = {
  /** La fecha de los datos (`?al=`), por defecto hoy en Caracas. */
  al: string
  /** ¿Es hoy? (si no, la barra lo marca). */
  esHoy: boolean
  /** El escenario activo (`?esc=`), o null: la realidad. */
  esc: string | null
  moneda: Moneda
}

/**
 * El contexto global de una página, de sus parámetros y de la cookie de moneda.
 * Los layouts no reciben `searchParams`: cada página lo pide con los suyos.
 */
export async function leerContexto(sp: Record<string, string | string[] | undefined>): Promise<ContextoGlobal> {
  const hoy = hoyCaracas()
  const al = typeof sp.al === 'string' && esFecha(sp.al) ? sp.al : hoy
  const esc = typeof sp.esc === 'string' && esUuid(sp.esc) ? sp.esc : null
  const moneda = (await cookies()).get(COOKIE_MONEDA)?.value === 'USD' ? 'USD' : 'VES'
  return { al, esHoy: al === hoy, esc, moneda }
}

export async function leerMoneda(): Promise<Moneda> {
  return (await cookies()).get(COOKIE_MONEDA)?.value === 'USD' ? 'USD' : 'VES'
}
