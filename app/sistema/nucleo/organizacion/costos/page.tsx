import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaLarga, numero } from '@/lib/plataforma/formato'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_COMPONENTES, TABLA_COSTO_UNIDADES, TABLA_COSTOS_CARGO } from '@/lib/plataforma/tablas-organizacion'
import type { FuenteTabla } from '@/lib/plataforma/tabla-servidor'
import { editarCeldaComponente, editarCeldaCosto } from '@/app/sistema/nucleo/organizacion/celdas'
import { ListaParametros, NuevoComponente, type Parametro } from '@/components/sistema/organizacion/costos-formularios'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Costos · Organización' }

const BASE = '/sistema/nucleo/organizacion/costos'
const VISTAS = [
  { clave: 'unidades', etiqueta: 'Por unidad' },
  { clave: 'cargos', etiqueta: 'Costo de referencia por cargo' },
  { clave: 'componentes', etiqueta: 'Componentes' },
  { clave: 'parametros', etiqueta: 'Parámetros' },
] as const

/**
 * Costos 🔒 (perímetro de nómina, `sistema:costos`; Anexo D §6.2). Sin el
 * permiso la página no abre y nada de esto se consulta. Se modela el costo de
 * REFERENCIA del cargo, no el salario de nadie. El costo de una unidad es
 * Σ dotación × costo mensual del cargo; lo que no tiene costo de referencia se
 * cuenta aparte, nunca como cero. Bs o USD según la barra, convertido con la
 * tasa BCV vigente por fecha valor, que se muestra siempre. Sin IA (N0).
 */
export default async function CostosPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/costos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:costos'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const editar = puede(sesion, 'sistema:costos', 'editar')
  const vista = VISTAS.some((v) => v.clave === sp.ver) ? (sp.ver as (typeof VISTAS)[number]['clave']) : 'unidades'
  const usd = ctx.moneda === 'USD'

  const [{ data: unidades }, { data: tasa }, { data: cargos }, parametros] = await Promise.all([
    supabase.schema('ui').rpc('costo_unidades', { p_fecha: ctx.al }).select('dotacion, dotacion_sin_costo, costo_ves, costo_usd').range(0, 1999),
    supabase.schema('org').rpc('tasa_bcv', { p_fecha: ctx.al }).maybeSingle(),
    supabase.schema('ui').rpc('costos_cargo', { p_fecha: ctx.al }).select('estado, dotacion').gt('dotacion', 0).range(0, 1999),
    vista === 'parametros' ? supabase.schema('ui').rpc('parametros_costo', { p_fecha: ctx.al }) : Promise.resolve({ data: [] as Parametro[] }),
  ])
  const total = (unidades ?? []).reduce((s, u) => s + (Number(usd ? u.costo_usd : u.costo_ves) || 0), 0)
  const dot = (unidades ?? []).reduce((s, u) => s + (Number(u.dotacion) || 0), 0)
  const sinCosto = (unidades ?? []).reduce((s, u) => s + (Number(u.dotacion_sin_costo) || 0), 0)
  const cargosUsados = cargos ?? []
  const conCosto = cargosUsados.filter((c) => c.estado === 'con_costo').length
  const t = tasa as { tasa: number; fecha_valor: string; fuente: string } | null
  const mon = (v: number) => (usd ? `USD ${numero(v, 2)}` : `Bs ${numero(v, 2)}`)
  const selloTasa = t ? `tasa BCV ${numero(t.tasa, 2)} Bs/USD, fecha valor ${fechaLarga(t.fecha_valor)}` : 'sin tasa BCV cargada'

  // Bs o USD: una sola columna de dinero a la vista, la de la barra.
  const conMoneda = (f: FuenteTabla): FuenteTabla => ({
    ...f,
    columnas: f.columnas.map((c) => (c.clave.endsWith('_usd') && c.clave !== 'bonos_usd' ? { ...c, oculta: !usd } : c.clave.endsWith('_ves') ? { ...c, oculta: usd } : c)),
  })
  const editable = (f: FuenteTabla, cols: string[]): FuenteTabla => ({ ...f, columnas: f.columnas.map((c) => (cols.includes(c.clave) ? { ...c, editable: true } : c)) })

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Costos 🔒' }]}
        acciones={editar && vista === 'componentes' ? <NuevoComponente /> : undefined}
        descripcion={
          <>
            🔒 Perímetro de nómina: lo ve solo quien tiene costos, y la IA no entra. Es el costo de <strong className="font-semibold">referencia</strong> del cargo, no el salario
            de nadie. En {usd ? 'dólares' : 'bolívares'} con la {selloTasa} (cámbialo con Bs/USD en la barra).
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          titulo="Costo mensual de la dotación"
          valor={sinCosto === dot ? 'Falta costo' : mon(total)}
          comparacion={{ texto: sinCosto ? `sin ${numero(sinCosto)} de ${numero(dot)} puestos: falta su costo de referencia` : `${numero(dot)} puestos` }}
          sello={{ fuente: 'Costos de referencia × dotación', estado: sinCosto ? 'atrasado' : 'al_dia', detalle: selloTasa }}
          href={`${BASE}?ver=unidades`}
        />
        <Kpi
          titulo="Al año"
          valor={sinCosto === dot ? '—' : mon(total * 12)}
          comparacion={{ texto: 'doce meses de referencia, sin variación' }}
          sello={{ fuente: 'Costos de referencia × dotación', estado: sinCosto ? 'atrasado' : 'al_dia', detalle: selloTasa }}
        />
        <Kpi
          titulo="Cargos con costo de referencia"
          valor={`${numero(conCosto)} de ${numero(cargosUsados.length)}`}
          comparacion={{ texto: 'cargos con plazas vigentes' }}
          sello={{ fuente: 'Costo de referencia por cargo', estado: conCosto < cargosUsados.length ? 'atrasado' : 'al_dia' }}
          href={`${BASE}?ver=cargos&f.estado=falta`}
        />
        <Kpi
          titulo="Tasa BCV usada"
          valor={t ? numero(t.tasa, 2) : '—'}
          unidad="Bs/USD"
          comparacion={{ texto: t ? `fecha valor ${fechaLarga(t.fecha_valor)}` : 'sin tasa' }}
          sello={{ fuente: t?.fuente === 'BCV' ? 'BCV (oficial)' : (t?.fuente ?? 'BCV'), estado: t ? 'al_dia' : 'sin_dato', detalle: 'La oficial vigente por fecha valor: la que publica el BCV hoy rige el día hábil siguiente.' }}
          href={puede(sesion, 'sistema:tasas') ? '/sistema/finanzas/tasas' : undefined}
        />
      </div>

      <nav aria-label="Vistas de costos" className="mb-3 flex max-w-full gap-1 overflow-x-auto">
        {VISTAS.map((v) => (
          <Link
            key={v.clave}
            href={`${BASE}?ver=${v.clave}${ctx.esHoy ? '' : `&al=${ctx.al}`}`}
            aria-current={vista === v.clave ? 'page' : undefined}
            className={cn(
              'inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs',
              vista === v.clave ? 'bg-[#2b2a28] font-semibold text-white' : 'border border-[var(--borde)] bg-white text-marca-700 hover:bg-marca-50'
            )}
          >
            {v.etiqueta}
          </Link>
        ))}
      </nav>

      {vista === 'unidades' && <TablaServidor fuente={conMoneda(TABLA_COSTO_UNIDADES)} sp={sp} sesion={sesion} ctx={ctx} vacio="No hay unidades con plazas a esa fecha." />}
      {vista === 'cargos' && (
        <>
          {editar && <p className="mb-2 text-[12px] text-marca-500">Salario, moneda y bonos se editan en la celda: el costo nuevo rige desde hoy y el anterior queda cerrado. Para otra fecha, ábrelo en la ficha del cargo.</p>}
          <TablaServidor
            fuente={conMoneda(editar ? editable(TABLA_COSTOS_CARGO, ['salario', 'moneda', 'bonos_usd']) : TABLA_COSTOS_CARGO)}
            sp={sp}
            sesion={sesion}
            ctx={ctx}
            alEditar={editar ? editarCeldaCosto : undefined}
            vacio="No hay cargos con estos filtros."
          />
        </>
      )}
      {vista === 'componentes' && (
        <>
          <p className="mb-2 text-[12px] text-marca-500">
            Sin la convención colectiva vigente, los componentes van con valores de ley y marcados «por confirmar con Capital Humano». {editar ? 'Valor, base legal y estado se editan en la celda (rige desde hoy).' : ''}
          </p>
          <TablaServidor
            fuente={editar ? editable(TABLA_COMPONENTES, ['valor', 'base_legal', 'por_confirmar']) : TABLA_COMPONENTES}
            sp={sp}
            sesion={sesion}
            ctx={ctx}
            alEditar={editar ? editarCeldaComponente : undefined}
            vacio="No hay componentes vigentes a esa fecha."
          />
        </>
      )}
      {vista === 'parametros' && <ListaParametros parametros={(parametros.data ?? []) as Parametro[]} editar={editar} />}
    </>
  )
}
