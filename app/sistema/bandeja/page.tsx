import type { Metadata } from 'next'
import Link from 'next/link'
import { nombresDe, plazasDe } from '@/components/sistema/flujo/datos'
import { ESTADO_SOLICITUD, TIPO_OBJETO, diasDesde, enlaceObjeto, type Regla } from '@/components/sistema/flujo/formato'
import { BandejaDecidir, type FilaDecidir } from '@/components/sistema/colaboracion/bandeja-decidir'
import { BotonFicha } from '@/components/sistema/colaboracion/boton-ficha'
import { leerTareas } from '@/components/sistema/colaboracion/datos'
import { ListaTareas, TareaRapida } from '@/components/sistema/colaboracion/tareas'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { vencida } from '@/lib/plataforma/colaboracion'
import { TONO_CHIP } from '@/lib/plataforma/ficha-tipos'
import { fechaHora, fechaLarga, numero } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bandeja · Plataforma Iberia' }

type Vista = 'decidir' | 'pedi' | 'tareas'
const TONO = { neutro: 'neutro', marca: 'neutro', acento: 'rojo', rojo: 'rojo', ambar: 'ambar', verde: 'verde' } as const

/** La ficha de una solicitud: los procesos se firman por versión y se abren por su `ref`. */
function fichaDe(tipo: string, objetoId: string, refProceso?: string | null): { tipo: string; id: string } | null {
  if (tipo === 'requisicion_personal') return { tipo: 'requisicion', id: objetoId }
  if (tipo === 'proceso') return refProceso ? { tipo: 'proceso', id: refProceso } : null
  if (tipo === 'escenario_estructura' || tipo === 'escenario_procesos') return { tipo: 'escenario', id: objetoId }
  return null
}

/**
 * La bandeja (Anexo E §8, R3): una lista de trabajo con tres vistas —lo que me
 * toca decidir (de cualquier tipo, con edad e impacto, decisión en la fila y
 * aprobación en lote por tipo), lo que pedí y en qué va, y mis tareas—. Quién
 * decide lo resuelve la base (`flujo.bandeja`, la misma regla de `flujo.decidir`).
 */
export default async function BandejaPage({ searchParams }: PageProps<'/sistema/bandeja'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  const vista: Vista = sp.vista === 'pedi' || sp.vista === 'tareas' ? sp.vista : 'decidir'
  const supabase = await createClient()
  const flujo = supabase.schema('flujo')

  const [{ data: pendientes }, { data: mias }, tareas] = await Promise.all([
    flujo.rpc('bandeja'),
    flujo
      .from('solicitud')
      .select('id, tipo_objeto, objeto_id, titulo, estado, paso_actual, creado_en, cerrado_en, paso(orden, nombre, aprobador_perfil, aprobador_plaza_ref, decision, comentario)')
      .eq('creado_por', sesion.userId)
      .order('creado_en', { ascending: false })
      .range(0, 199),
    leerTareas({ abiertas: true }),
  ])
  const porDecidir = pendientes ?? []
  const pedidas = mias ?? []
  const misTareas = tareas.filter((t) => t.mia)

  // Las fichas de proceso se abren por su identidad estable; el impacto sale de cada objeto.
  const procesos = [...porDecidir, ...pedidas].filter((x) => x.tipo_objeto === 'proceso').map((x) => x.objeto_id)
  const reqs = porDecidir.filter((x) => x.tipo_objeto === 'requisicion_personal').map((x) => x.objeto_id)
  const escs = porDecidir.filter((x) => x.tipo_objeto.startsWith('escenario_') || x.tipo_objeto === 'cambios').map((x) => x.objeto_id)
  type Paso = { orden: number; nombre: string; aprobador_perfil: string | null; aprobador_plaza_ref: string | null; decision: string; comentario: string | null }
  const pasoActual = (s: (typeof pedidas)[number]) => ((s.paso ?? []) as unknown as Paso[]).find((p) => p.orden === s.paso_actual)
  const [refs, impactos, escenarios, plazas, nombres] = await Promise.all([
    procesos.length ? supabase.schema('sgc').from('proceso').select('id, ref, version').in('id', procesos) : null,
    reqs.length ? supabase.schema('org').from('requisicion').select('id, cantidad, origen, impacto').in('id', reqs) : null,
    escs.length ? supabase.schema('org').from('escenario').select('id, alcance, vigente_desde, cambio(count)').in('id', escs) : null,
    plazasDe(supabase, [...porDecidir.map((p) => p.aprobador_plaza_ref), ...pedidas.map((s) => pasoActual(s)?.aprobador_plaza_ref)]),
    nombresDe(supabase, pedidas.map((s) => pasoActual(s)?.aprobador_perfil)),
  ])
  const refDe = new Map((refs?.data ?? []).map((p) => [p.id, p.ref]))
  const versionDe = new Map((refs?.data ?? []).map((p) => [p.id, p.version]))
  const reqDe = new Map((impactos?.data ?? []).map((r) => [r.id, r]))
  const escDe = new Map((escenarios?.data ?? []).map((e) => [e.id, e]))

  const impacto = (tipo: string, id: string): string | null => {
    if (tipo === 'requisicion_personal') {
      const r = reqDe.get(id)
      if (!r) return null
      const i = (r.impacto ?? {}) as { dotacion_aprobada?: number; dotacion_despues?: number; fuera_de_plan?: boolean }
      const partes = [`${numero(r.cantidad)} ${r.cantidad === 1 ? 'persona' : 'personas'}`]
      if (typeof i.dotacion_aprobada === 'number' && typeof i.dotacion_despues === 'number' && i.dotacion_despues !== i.dotacion_aprobada)
        partes.push(`dotación ${numero(i.dotacion_aprobada)} → ${numero(i.dotacion_despues)}`)
      else partes.push('dentro de la dotación')
      if (i.fuera_de_plan) partes.push('⚠ fuera del plan')
      return partes.join(' · ')
    }
    if (tipo === 'proceso') return versionDe.get(id) ? `Versión ${versionDe.get(id)} de la ficha` : null
    if (tipo === 'cambios') {
      const e = escDe.get(id) as { vigente_desde: string | null; cambio?: { count: number }[] } | undefined
      const n = e?.cambio?.[0]?.count ?? 0
      return e ? `${numero(n)} cambio${n === 1 ? '' : 's'}${e.vigente_desde ? ` · rigen desde ${fechaLarga(e.vigente_desde)}` : ''}` : null
    }
    if (tipo.startsWith('escenario_')) {
      const e = escDe.get(id)
      return e ? `Escenario de ${e.alcance}${e.vigente_desde ? ` · rige desde ${fechaLarga(e.vigente_desde)}` : ''}` : null
    }
    return null
  }

  const filas: FilaDecidir[] = porDecidir
    .map((p) => {
      const regla = p.regla as Regla
      const plaza = p.aprobador_plaza_ref ? plazas[p.aprobador_plaza_ref] : null
      return {
        pasoId: p.paso_id,
        tipoObjeto: p.tipo_objeto,
        tipoEtiqueta: TIPO_OBJETO[p.tipo_objeto] ?? p.tipo_objeto,
        ficha: fichaDe(p.tipo_objeto, p.objeto_id, refDe.get(p.objeto_id)),
        hrefModulo: enlaceObjeto(p.tipo_objeto, p.objeto_id, refDe.get(p.objeto_id)),
        titulo: p.titulo,
        paso: p.paso,
        orden: p.orden,
        accion: p.accion,
        hito: p.hito,
        pidio: p.pedido_por_nombre,
        esperandoDesde: p.esperando_desde,
        dias: diasDesde(p.esperando_desde),
        impacto: impacto(p.tipo_objeto, p.objeto_id),
        quien: regla?.sin_cuenta ? 'la plaza no tiene cuenta: decides como administración de aprobaciones' : plaza,
        requisicionId: p.tipo_objeto === 'requisicion_personal' ? p.objeto_id : null,
      }
    })
    .sort((a, b) => b.dias - a.dias)

  const vencidas = misTareas.filter((t) => vencida(t)).length
  const pestanas: { clave: Vista; etiqueta: string; n: number; alerta?: boolean }[] = [
    { clave: 'decidir', etiqueta: 'Me toca decidir', n: filas.length, alerta: filas.length > 0 },
    { clave: 'pedi', etiqueta: 'Lo que pedí', n: pedidas.filter((s) => s.estado === 'en_curso').length },
    { clave: 'tareas', etiqueta: 'Mis tareas', n: misTareas.length, alerta: vencidas > 0 },
  ]

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-DIA"
        titulo="Bandeja"
        migas={[{ etiqueta: 'Bandeja' }]}
        descripcion="Lo que te toca decidir de cualquier módulo, lo que pediste y en qué va, y tus tareas. Quién firma cada paso lo decide la ruta de aprobación a partir de la estructura."
      />

      <nav aria-label="Vistas de la bandeja" className="mb-3 flex flex-wrap gap-1 border-b border-[var(--borde)]">
        {pestanas.map((p) => (
          <Link
            key={p.clave}
            href={p.clave === 'decidir' ? '/sistema/bandeja' : `/sistema/bandeja?vista=${p.clave}`}
            aria-current={vista === p.clave ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-10 items-center gap-1.5 border-b-2 px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-acento-500',
              vista === p.clave ? 'border-[#D4332C] font-semibold text-marca-900' : 'border-transparent text-marca-500 hover:text-marca-800'
            )}
          >
            {p.etiqueta}
            <span className={cn('rounded-lg px-1.5 text-[11px]', p.alerta ? 'bg-[#fbeceb] font-semibold text-[#a3241f]' : 'bg-[#eef0f3] text-marca-600')}>{p.n}</span>
            {p.clave === 'tareas' && vencidas > 0 && <span className="text-[11px] font-semibold text-[#a3241f]">· {vencidas} vencida{vencidas === 1 ? '' : 's'}</span>}
          </Link>
        ))}
      </nav>

      {vista === 'decidir' &&
        (filas.length ? (
          <BandejaDecidir filas={filas} />
        ) : (
          <p className="rounded-xl border border-[var(--borde)] bg-white px-4 py-10 text-center text-[13px] text-marca-400">
            No tienes nada por decidir. Cuando una solicitud llegue a un paso tuyo, aparece aquí y te avisa la campana.
          </p>
        ))}

      {vista === 'pedi' && (
        <section className="overflow-hidden rounded-xl border border-[var(--borde)] bg-white" aria-label="Lo que pedí">
          {!pedidas.length ? (
            <p className="px-4 py-10 text-center text-[13px] text-marca-400">No has enviado nada a aprobación.</p>
          ) : (
            <ul>
              <li className="hidden grid-cols-[minmax(0,1fr)_8rem_minmax(0,14rem)_9rem] gap-3 border-b border-[var(--borde)] bg-[#fafbfc] px-4 py-2 text-[11px] font-semibold text-marca-500 lg:grid" aria-hidden>
                <span>Qué</span>
                <span>Estado</span>
                <span>En qué va</span>
                <span>Enviada</span>
              </li>
              {pedidas.map((s) => {
                const est = ESTADO_SOLICITUD[s.estado] ?? { etiqueta: s.estado, tono: 'neutro' as const }
                const actual = pasoActual(s)
                const ficha = fichaDe(s.tipo_objeto, s.objeto_id, refDe.get(s.objeto_id))
                const pasos = (s.paso ?? []) as unknown as Paso[]
                const ultimo = [...pasos].filter((p) => p.comentario && p.decision !== 'pendiente').sort((a, b) => b.orden - a.orden)[0]
                const conQuien = actual
                  ? [actual.aprobador_plaza_ref ? plazas[actual.aprobador_plaza_ref] : null, actual.aprobador_perfil ? nombres[actual.aprobador_perfil] : null].filter(Boolean).join(' · ')
                  : ''
                return (
                  <li key={s.id} className="grid gap-x-3 gap-y-1 border-t border-[#eef0f3] px-4 py-2.5 first:border-0 lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,14rem)_9rem] lg:items-center">
                    <div className="min-w-0">
                      {ficha ? (
                        <BotonFicha tipo={ficha.tipo} id={ficha.id} className="font-medium break-words text-marca-900">
                          {s.titulo}
                        </BotonFicha>
                      ) : (
                        <p className="font-medium break-words text-marca-900">{s.titulo}</p>
                      )}
                      <p className="text-[11.5px] text-marca-500">{TIPO_OBJETO[s.tipo_objeto] ?? s.tipo_objeto}</p>
                      {ultimo && s.estado !== 'en_curso' && <p className="mt-0.5 text-[12px] break-words text-marca-600">«{ultimo.comentario}»</p>}
                    </div>
                    <span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', TONO_CHIP[TONO[est.tono]])}>{est.etiqueta}</span>
                    </span>
                    <span className="text-[12px] break-words text-marca-600">
                      {s.estado === 'en_curso' && actual ? (
                        <>
                          En «{actual.nombre}»{conQuien ? <span className="text-marca-400"> · {conQuien}</span> : null}
                        </>
                      ) : s.cerrado_en ? (
                        `Cerrada ${fechaHora(s.cerrado_en)}`
                      ) : (
                        '—'
                      )}
                    </span>
                    <span className="text-[12px] text-marca-500">{fechaHora(s.creado_en)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {vista === 'tareas' && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="min-w-0 rounded-xl border border-[var(--borde)] bg-white" aria-labelledby="tareas-bandeja">
            <header className="flex items-center justify-between border-b border-[var(--borde)] px-4 py-2.5">
              <h2 id="tareas-bandeja" className="text-[13px] font-semibold text-marca-900">
                Abiertas para ti
              </h2>
              <Link href="/sistema/tareas" className="text-xs font-semibold text-acento-700 hover:underline">
                Todas las tareas
              </Link>
            </header>
            <ListaTareas tareas={[...misTareas].sort((a, b) => Number(vencida(b)) - Number(vencida(a)))} />
          </section>
          <aside className="min-w-0">
            <TareaRapida yo={{ id: sesion.userId, nombre: sesion.perfil.nombre_completo || sesion.email }} />
          </aside>
        </div>
      )}
    </>
  )
}
