import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaLarga, porcentaje, sumarDias } from '@/lib/plataforma/formato'
import { leerContexto, tasasDelDia } from '@/lib/plataforma/servidor'
import { TABLA_TASAS } from '@/lib/plataforma/tablas'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { GraficoBarras, GraficoLineas } from '@/components/sistema/ui/graficos'
import { KpiMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { IconoCandadito } from '@/components/sistema/shell/iconos'
import { FormularioTasa } from '@/app/sistema/finanzas/tasas/formulario'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Tasas de cambio · Finanzas' }

/** Colores validados (skill de visualización): azul, verde azulado y ocre; el paralelo además va punteado. */
const COLOR = { usd: '#3567a8', eur: '#1e8a72', paralelo: '#b7791f' }

/**
 * Tasas de cambio (FIN-TAS, Anexo E §6). BCV dólar y euro para todo el que
 * tiene el módulo; paralelo y brecha solo con `sistema:tasas-paralelo` —la base
 * ni siquiera los manda a nadie más, y registra cada lectura—. La carga manual
 * es respaldo, con motivo, para quien edita tasas.
 *
 * Contabilidad, facturas y precios usan solo la oficial vigente por fecha valor.
 */
export default async function TasasPage({ searchParams }: PageProps<'/sistema/finanzas/tasas'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:tasas'), searchParams])
  const ctx = await leerContexto(sp)
  const periodo = sp.periodo === '90' ? 90 : 30
  const hasta = ctx.al
  const desde = sumarDias(hasta, -(periodo - 1))
  const supabase = await createClient()

  const [t, { data: serie }] = await Promise.all([
    tasasDelDia(sesion, ctx.esHoy ? undefined : ctx.al),
    supabase.schema('control').rpc('serie_tasas', { p_desde: desde, p_hasta: hasta }),
    precargarMetricas(['tasa_bcv_usd', 'tasa_bcv_eur', ...(puede(sesion, 'sistema:tasas-paralelo') ? ['tasa_paralelo', 'brecha_cambiaria'] : [])], ctx),
  ])
  const filas = serie ?? []
  const vePar = Boolean(t?.veParalelo)
  const dias = filas.map((f) => f.dia)
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
  const usd = filas.map((f) => num(f.usd))
  const eur = filas.map((f) => num(f.eur))
  const par = vePar ? filas.map((f) => num(f.paralelo)) : []
  const brecha = vePar ? filas.map((f) => num(f.brecha)) : []
  const conBrecha = brecha.filter((x): x is number => x !== null)

  const enlacePeriodo = (p: number) => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) if (typeof v === 'string' && k !== 'periodo') q.set(k, v)
    if (p === 90) q.set('periodo', '90')
    const s = q.toString()
    return s ? `/sistema/finanzas/tasas?${s}` : '/sistema/finanzas/tasas'
  }

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="FIN-TAS"
        migas={[{ etiqueta: 'Tasas' }]}
        descripcion="La tasa del BCV que se publica un día rige el día hábil siguiente (fecha valor). Contabilidad, facturas y precios usan solo la oficial."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-[var(--borde)] bg-white text-xs" role="group" aria-label="Período">
          {[30, 90].map((p) => (
            <Link key={p} href={enlacePeriodo(p)} aria-current={periodo === p ? 'true' : undefined} className={cn('inline-flex h-8 items-center px-3', periodo === p ? 'bg-[#2b2a28] font-semibold text-white' : 'text-marca-600 hover:bg-marca-50')}>
              {p} días
            </Link>
          ))}
        </div>
        <span className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs text-marca-600">
          Hasta el <b className="ml-1 font-semibold text-marca-900">{fechaLarga(hasta)}</b>
        </span>
        {vePar && (
          <p className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#e7c98f] bg-[#fdf6e7] px-2.5 text-xs text-[#6b4a10]">
            <IconoCandadito className="h-3.5 w-3.5 shrink-0" />
            Paralelo: referencia de mercado, uso interno, nunca para facturar · lo ven Finanzas y la Gerencia General · cada lectura queda registrada
          </p>
        )}
      </div>

      {/* Las cuatro cifras salen del registro de métricas: las mismas de la barra y de Mi día. */}
      <div className={cn('grid gap-3', vePar ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2')}>
        <KpiMetrica clave="tasa_bcv_usd" ctx={ctx} sesion={sesion} />
        <KpiMetrica clave="tasa_bcv_eur" ctx={ctx} sesion={sesion} />
        {vePar && <KpiMetrica clave="tasa_paralelo" ctx={ctx} sesion={sesion} />}
        {vePar && <KpiMetrica clave="brecha_cambiaria" ctx={ctx} sesion={sesion} titulo="Brecha del día" />}
      </div>

      <div className={cn('mt-3 grid gap-3', vePar && 'xl:grid-cols-2')}>
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="mb-2 text-[12.5px] font-semibold text-marca-600">Tasas · últimos {periodo} días</h2>
          <GraficoLineas
            titulo={`Tasas en bolívares, del ${fechaLarga(desde)} al ${fechaLarga(hasta)}`}
            dias={dias}
            unidad="Bs"
            series={[
              { nombre: 'BCV $', color: COLOR.usd, valores: usd, escalones: true },
              { nombre: 'BCV €', color: COLOR.eur, valores: eur, escalones: true },
              ...(vePar ? [{ nombre: 'Paralelo $', color: COLOR.paralelo, valores: par, punteada: true }] : []),
            ]}
          />
        </section>
        {vePar && (
          <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
            <h2 className="mb-2 text-[12.5px] font-semibold text-marca-600">Brecha diaria (%)</h2>
            <GraficoBarras titulo={`Brecha diaria entre el paralelo y el BCV, últimos ${periodo} días`} dias={dias} valores={brecha} unidad="%" />
            <p className="mt-2 text-[11.5px] text-marca-500">
              Cada barra es la brecha de ese día: (paralelo ÷ BCV vigente − 1) × 100. La de la última fecha va más oscura.
              {conBrecha.length > 1 && ` Mínimo ${porcentaje(Math.min(...conBrecha))}, máximo ${porcentaje(Math.max(...conBrecha))}.`} Los días sin captura del paralelo quedan vacíos.
            </p>
          </section>
        )}
      </div>

      <section className="mt-4">
        <h2 className="mb-2 text-[13px] font-semibold text-marca-900">Historial</h2>
        <p className="mb-2 text-[12px] text-marca-500">
          Cada captura, con su fecha valor, su fuente y su verificación. Una corrección es una fila nueva con motivo: la anterior queda «reemplazada», nunca se borra.
        </p>
        <TablaServidor fuente={TABLA_TASAS} sp={sp} sesion={sesion} ctx={ctx} />
      </section>

      {puede(sesion, 'sistema:tasas', 'editar') && (
        <section id="cargar-tasa" className="mt-4 scroll-mt-16 rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="text-[13px] font-semibold text-marca-900">Cargar una tasa a mano</h2>
          <p className="mb-3 text-[12px] text-marca-500">Respaldo para cuando el BCV no publica o la captura automática falla. Queda con tu nombre y tu motivo en la auditoría.</p>
          <FormularioTasa conParalelo={vePar} />
        </section>
      )}
    </>
  )
}
