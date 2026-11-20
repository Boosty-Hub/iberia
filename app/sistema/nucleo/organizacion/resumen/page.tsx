import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { fechaLarga, numero, porcentaje } from '@/lib/plataforma/formato'
import { dotacionPorDireccion } from '@/lib/plataforma/organizacion-datos'
import { leerContexto } from '@/lib/plataforma/servidor'
import { BarrasDotacion } from '@/components/sistema/organizacion/barras-dotacion'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Kpi, type Sello } from '@/components/sistema/ui/kpi'

export const metadata: Metadata = { title: 'Resumen · Organización' }

const BASE = '/sistema/nucleo/organizacion'

type Alertas = {
  plazas_por_encima: number
  personas_por_encima: number
  plazas_vacias: number
  unidades_inferidas: number
  plazas_inferidas: number
  unidades_sin_plazas: number
  padron_sin_plaza: number
  ocupaciones_por_nombre: number
  conciliacion_abierta: number
  requisiciones_en_ruta: number
  ultima_edicion: string | null
}

/**
 * Organización · Resumen (Anexo E §3, anatomía): las cifras de la dotación con
 * su fuente y su fecha, la dotación por dirección con su uso y lo que pide
 * atención. Cada cifra lleva a la tabla que la origina. Sin costos: viven en
 * su pestaña 🔒.
 */
export default async function ResumenPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/resumen'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const ctx = await leerContexto(sp)
  const supabase = await createClient()
  const conPlan = puede(sesion, 'sistema:dotacion')
  const [direcciones, { data: alertasCrudas }] = await Promise.all([
    dotacionPorDireccion(supabase, ctx.al, conPlan),
    supabase.schema('ui').rpc('alertas_organizacion', { p_al: ctx.al }),
  ])
  const a = (alertasCrudas ?? {}) as Partial<Alertas>

  const t = direcciones.reduce(
    (s, d) => ({
      aprobada: s.aprobada + d.aprobada,
      ocupada: s.ocupada + d.ocupada,
      vacantes: s.vacantes + d.vacantes,
      porEncima: s.porEncima + d.porEncima,
      plan: d.plan === null ? s.plan : (s.plan ?? 0) + d.plan,
      enRequisicion: s.enRequisicion + d.enRequisicion,
      plazas: s.plazas + d.plazas,
    }),
    { aprobada: 0, ocupada: 0, vacantes: 0, porEncima: 0, plan: null as number | null, enRequisicion: 0, plazas: 0 }
  )
  const sello: Sello = {
    fuente: 'Estructura (organigramas II-21-14 y ediciones)',
    en: a.ultima_edicion ?? null,
    estado: ctx.esHoy ? 'al_dia' : 'manual',
    detalle: `Plazas vigentes al ${fechaLarga(ctx.al)}. La hora es la del último cambio registrado en la estructura.`,
  }
  const q = (href: string) => (ctx.esHoy ? href : `${href}${href.includes('?') ? '&' : '?'}al=${ctx.al}`)

  const alertas = [
    { n: a.plazas_por_encima ?? 0, texto: `plaza${a.plazas_por_encima === 1 ? '' : 's'} con gente por encima de la dotación (${numero(a.personas_por_encima ?? 0)} persona${a.personas_por_encima === 1 ? '' : 's'})`, href: q(`${BASE}/plazas?orden=exceso&dir=desc`), tono: 'rojo' },
    { n: a.plazas_vacias ?? 0, texto: 'plazas sin ningún titular', href: q(`${BASE}/plazas?orden=ocupadas&dir=asc`), tono: 'ambar' },
    { n: a.padron_sin_plaza ?? 0, texto: 'personas activas del padrón sin plaza asignada', href: null, tono: 'ambar' },
    { n: a.ocupaciones_por_nombre ?? 0, texto: 'ocupaciones casadas solo por el nombre del cargo: conviene confirmarlas', href: q(`${BASE}/personas?f.certeza=por_nombre_de_cargo`), tono: 'ambar' },
    { n: (a.unidades_inferidas ?? 0) + (a.plazas_inferidas ?? 0), texto: `datos inferidos por la carga (${numero(a.unidades_inferidas ?? 0)} unidades, ${numero(a.plazas_inferidas ?? 0)} plazas)`, href: q(`${BASE}/plazas?f.certeza=inferencia`), tono: 'azul' },
    { n: a.unidades_sin_plazas ?? 0, texto: 'unidades sin plazas ni unidades debajo', href: null, tono: 'neutro' },
    { n: a.conciliacion_abierta ?? 0, texto: 'puntos abiertos en la cola de conciliación', href: '/sistema/nucleo/conciliacion?f.estado=abierto', tono: 'ambar' },
    ...(puede(sesion, 'sistema:requisiciones', 'crear') ? [{ n: a.requisiciones_en_ruta ?? 0, texto: 'requisiciones en su ruta de aprobación', href: `${BASE}/requisiciones?f.estado=en_aprobacion`, tono: 'neutro' }] : []),
  ].filter((x) => x.n > 0)
  const SIMBOLO: Record<string, string> = { rojo: '▲', ambar: '!', azul: 'i', neutro: '·' }
  const TONO: Record<string, string> = {
    rojo: 'bg-[#fbeceb] text-[#a3241f]',
    ambar: 'bg-[#fdf4e3] text-[#8a5a12]',
    azul: 'bg-[#eaf2fb] text-[#2f5f9a]',
    neutro: 'bg-[#eef0f3] text-marca-600',
  }

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo="Organización"
        migas={[{ etiqueta: 'Resumen' }]}
        descripcion={`La dotación de Iberia al ${fechaLarga(ctx.al)}: lo aprobado, lo ocupado y lo que falta o sobra, por dirección. Cada cifra lleva a su tabla.`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi titulo="Dotación aprobada" valor={numero(t.aprobada)} comparacion={{ texto: `${numero(t.plazas)} plazas` }} sello={sello} href={q(`${BASE}/plazas`)} />
        <Kpi
          titulo="Ocupada"
          valor={numero(t.ocupada)}
          comparacion={{ texto: t.aprobada ? `${porcentaje((t.ocupada / t.aprobada) * 100, 0)} de lo aprobado` : '—' }}
          sello={sello}
          href={q(`${BASE}/personas`)}
        />
        <Kpi titulo="Vacantes" valor={numero(t.vacantes)} comparacion={{ texto: 'puestos aprobados sin titular' }} sello={sello} href={q(`${BASE}/plazas?orden=vacantes&dir=desc`)} />
        <Kpi
          titulo="Por encima"
          valor={numero(t.porEncima)}
          comparacion={{ texto: `en ${numero(a.plazas_por_encima ?? 0)} plaza${a.plazas_por_encima === 1 ? '' : 's'}: es un hallazgo, no un error de carga` }}
          sello={sello}
          href={q(`${BASE}/plazas?orden=exceso&dir=desc`)}
        />
        {conPlan ? (
          <Kpi
            titulo="En requisición"
            valor={numero(t.enRequisicion)}
            comparacion={{ texto: t.plan === null ? 'Sin plan aprobado del año' : `Plan ${ctx.al.slice(0, 4)}: ${numero(t.plan)}` }}
            sello={{ fuente: 'Requisiciones y plan de dotación', estado: 'al_dia', detalle: 'Personas pedidas en requisiciones en ruta, aprobadas o en selección.' }}
            href={`${BASE}/dotacion`}
          />
        ) : (
          <Kpi
            titulo="Requisiciones en ruta"
            valor={numero(a.requisiciones_en_ruta ?? 0)}
            sello={{ fuente: 'Requisiciones de personal (II-21-40-001)', estado: 'al_dia' }}
            href={puede(sesion, 'sistema:requisiciones', 'crear') ? `${BASE}/requisiciones?f.estado=en_aprobacion` : undefined}
          />
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="text-[13px] font-semibold text-marca-800">Dotación por dirección{conPlan ? ', contra el plan' : ''}</h2>
          <p className="mb-3 text-[12px] text-marca-500">Ordenadas por tamaño. Una fila abre su detalle por unidad y cargo.</p>
          <BarrasDotacion
            titulo="Dotación aprobada, ocupada y plan por dirección"
            conPlan={conPlan}
            filas={direcciones.map((d) => ({
              clave: d.ref,
              etiqueta: d.nombre,
              aprobada: d.aprobada,
              ocupada: d.ocupada,
              plan: d.plan,
              porEncima: d.porEncima,
              enRequisicion: d.enRequisicion,
              href: conPlan ? q(`${BASE}/dotacion?f.direccion=${encodeURIComponent(d.nombre)}`) : `${BASE}?ficha=unidad:${d.ref}`,
            }))}
          />
          <p className="mt-3 text-[10.5px] text-marca-400">
            Fuente: plazas vigentes al {fechaLarga(ctx.al)}{t.plan !== null ? ` y plan ${ctx.al.slice(0, 4)} aprobado` : ''}. La dirección es la unidad de tipo dirección más cercana hacia arriba.
          </p>
        </section>

        <section className="rounded-xl border border-[var(--borde)] bg-white p-4">
          <h2 className="mb-2 text-[13px] font-semibold text-marca-800">Lo que pide atención</h2>
          {alertas.length ? (
            <ul className="flex flex-col gap-1.5">
              {alertas.map((x) => {
                const cuerpo = (
                  <>
                    <span className={`grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1 text-[10px] font-bold ${TONO[x.tono]}`} aria-hidden>
                      {SIMBOLO[x.tono]}
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-marca-700">
                      <strong className="font-semibold text-marca-900 tabular-nums">{numero(x.n)}</strong> {x.texto}
                    </span>
                    {x.href && <span className="text-marca-400" aria-hidden>›</span>}
                  </>
                )
                return (
                  <li key={x.texto}>
                    {x.href ? (
                      <Link href={x.href} className="flex items-start gap-2 rounded-lg px-1.5 py-1.5 hover:bg-marca-50">
                        {cuerpo}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2 px-1.5 py-1.5">{cuerpo}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-marca-400">Nada pendiente.</p>
          )}
        </section>
      </div>
    </>
  )
}
