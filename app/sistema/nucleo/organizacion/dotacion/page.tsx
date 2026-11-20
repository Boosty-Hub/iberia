import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaCorta, fechaLarga, numero } from '@/lib/plataforma/formato'
import { dotacionPorDireccion } from '@/lib/plataforma/organizacion-datos'
import { leerContexto } from '@/lib/plataforma/servidor'
import { TABLA_DOTACION } from '@/lib/plataforma/tablas-organizacion'
import { editarCeldaPlan } from '@/app/sistema/nucleo/organizacion/celdas'
import { BarrasDotacion } from '@/components/sistema/organizacion/barras-dotacion'
import { PlanVersiones, type VersionPlan } from '@/components/sistema/organizacion/plan-versiones'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi } from '@/components/sistema/ui/kpi'
import { KpiMetrica, leerMetrica, precargarMetricas } from '@/lib/plataforma/metricas'
import { TablaServidor } from '@/components/sistema/ui/tabla-servidor'

export const metadata: Metadata = { title: 'Dotación · Organización' }

const BASE = '/sistema/nucleo/organizacion'

/**
 * Dotación (Anexo D §6.1): plan contra real por dirección, la tabla por unidad
 * y cargo (aprobada · ocupada · vacante · por encima · en requisición · plan) y
 * las versiones del plan del año. Sin costos: viven en Costos 🔒. El borrador
 * del plan se edita en la celda; aprobarlo lo congela.
 */
export default async function DotacionPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/dotacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:dotacion'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const org = supabase.schema('org')
  const anio = Number(ctx.al.slice(0, 4))
  const editar = puede(sesion, 'sistema:dotacion', 'editar')

  const [direcciones, , { data: planes }, { data: unidades }, { data: cargos }] = await Promise.all([
    dotacionPorDireccion(supabase, ctx.al, true),
    precargarMetricas(['dotacion_aprobada', 'dotacion_ocupada', 'dotacion_en_requisicion'], ctx).then(() => null),
    org.from('plan_dotacion').select('id, anio, version, estado, aprobado_por, aprobado_en, nota, plan_dotacion_linea(cantidad)').eq('anio', anio).order('version', { ascending: false }),
    editar ? org.from('unidad').select('ref, nombre').is('escenario_id', null).filter('vigencia', 'cs', `[${ctx.al},${ctx.al}]`).order('nombre').range(0, 999) : Promise.resolve({ data: [] as { ref: string; nombre: string }[] }),
    editar ? org.from('cargo').select('id, nombre').eq('activo', true).order('nombre').range(0, 1999) : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ])
  const aprobadores = [...new Set((planes ?? []).map((p) => p.aprobado_por).filter(Boolean))] as string[]
  const { data: nombres } = aprobadores.length ? await supabase.schema('flujo').rpc('nombres', { p_ids: aprobadores }) : { data: [] as { id: string; nombre: string }[] }
  const nombre = new Map((nombres ?? []).map((n) => [n.id, n.nombre]))
  const versiones: VersionPlan[] = (planes ?? []).map((p) => {
    const lineas = (p.plan_dotacion_linea ?? []) as { cantidad: number }[]
    return {
      id: p.id,
      anio: p.anio,
      version: p.version,
      estado: p.estado,
      aprobadoEn: p.aprobado_en ? fechaCorta(p.aprobado_en.slice(0, 10)) : null,
      aprobadoPor: p.aprobado_por ? (nombre.get(p.aprobado_por) ?? null) : null,
      lineas: lineas.length,
      total: lineas.reduce((s, l) => s + l.cantidad, 0),
      nota: p.nota,
    }
  })
  const borrador = versiones.find((v) => v.estado === 'borrador')
  const aprobado = versiones.find((v) => v.estado === 'aprobado')

  // «Aprobada − plan» usa la misma dotación aprobada del registro de métricas.
  const t = { aprobada: (await leerMetrica('dotacion_aprobada', ctx))?.valor ?? 0 }
  const plan = aprobado?.total ?? null
  const fuente = editar && borrador ? { ...TABLA_DOTACION, columnas: TABLA_DOTACION.columnas.map((c) => (c.clave === 'plan_borrador' ? { ...c, editable: true, ayudaEdicion: `Cantidad en el borrador v${borrador.version}` } : c)) } : TABLA_DOTACION

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Dotación' }]}
        descripcion={`La dotación al ${fechaLarga(ctx.al)} contra el plan ${anio}: por dirección, y por unidad y cargo en la tabla. Sin costos (están en Costos 🔒).`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiMetrica clave="dotacion_aprobada" ctx={ctx} sesion={sesion} titulo="Aprobada" />
        <KpiMetrica clave="dotacion_ocupada" ctx={ctx} sesion={sesion} titulo="Ocupada" />
        <Kpi
          titulo={`Plan ${anio}`}
          valor={plan === null ? 'Sin plan' : numero(plan)}
          comparacion={plan === null ? { texto: 'No hay versión aprobada' } : { texto: `Aprobada − plan: ${t.aprobada - plan > 0 ? '+' : ''}${numero(t.aprobada - plan)}` }}
          sello={{ fuente: aprobado ? `Plan ${anio} v${aprobado.version} aprobado` : `Plan ${anio}`, estado: aprobado ? 'al_dia' : 'sin_dato', detalle: aprobado?.aprobadoEn ? `Aprobado el ${aprobado.aprobadoEn}` : undefined }}
        />
        <KpiMetrica clave="dotacion_en_requisicion" ctx={ctx} sesion={sesion} />
        <Kpi
          titulo="Borrador del plan"
          valor={borrador ? `v${borrador.version}` : '—'}
          comparacion={{ texto: borrador ? `${numero(borrador.total)} puestos en ${borrador.lineas} líneas` : 'Sin borrador abierto' }}
          sello={{ fuente: `Plan ${anio}`, estado: borrador ? 'manual' : 'sin_dato' }}
        />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="text-[13px] font-semibold text-marca-800">Plan contra real, por dirección</h2>
          <p className="mb-3 text-[12px] text-marca-500">Una fila filtra la tabla de abajo por esa dirección.</p>
          <BarrasDotacion
            titulo={`Dotación aprobada, ocupada y plan ${anio} por dirección`}
            conPlan
            filas={direcciones.map((d) => ({
              clave: d.ref,
              etiqueta: d.nombre,
              aprobada: d.aprobada,
              ocupada: d.ocupada,
              plan: d.plan,
              porEncima: d.porEncima,
              enRequisicion: d.enRequisicion,
              href: `${BASE}/dotacion?f.direccion=${encodeURIComponent(d.nombre)}${ctx.esHoy ? '' : `&al=${ctx.al}`}`,
            }))}
          />
        </section>
        <PlanVersiones
          anio={anio}
          versiones={versiones}
          editar={editar}
          unidades={(unidades ?? []).map((u) => ({ valor: u.ref, etiqueta: u.nombre }))}
          cargos={(cargos ?? []).map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        />
      </div>

      <TablaServidor
        fuente={fuente}
        sp={sp}
        sesion={sesion}
        ctx={ctx}
        alEditar={editar && borrador ? editarCeldaPlan.bind(null, borrador.id) : undefined}
        vacio="No hay dotación con estos filtros."
      />
    </>
  )
}
