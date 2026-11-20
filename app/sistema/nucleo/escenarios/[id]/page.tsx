import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { descartarEscenario, enviarEscenario } from '../acciones'
import { IconoAlerta, IconoAtras, IconoCandado, IconoEnviar } from '@/components/iconos'
import { contextoFlujo } from '@/components/sistema/flujo/datos'
import { DecidirPaso } from '@/components/sistema/flujo/decidir-paso'
import { EditorEscenario } from '@/components/sistema/flujo/editor-escenario'
import { ordenarArbol } from '@/components/sistema/flujo/estructura'
import { ESTADO_ESCENARIO, fecha, fechaHora, hoyCaracas, monto } from '@/components/sistema/flujo/formato'
import { Enviar, FormAccion } from '@/components/sistema/flujo/formulario'
import { LineaTiempo } from '@/components/sistema/flujo/linea-tiempo'
import { Aviso, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Escenario de estructura' }

type Cambio = { objeto: string; ref: string; cambio: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }

const CAMBIO: Record<string, { etiqueta: string; tono: 'verde' | 'rojo' | 'ambar' | 'marca' | 'neutro' }> = {
  alta: { etiqueta: 'Alta', tono: 'verde' },
  baja: { etiqueta: 'Cierre', tono: 'rojo' },
  renombre: { etiqueta: 'Renombre', tono: 'marca' },
  movimiento: { etiqueta: 'Movimiento', tono: 'ambar' },
  dotacion: { etiqueta: 'Dotación', tono: 'ambar' },
  cambio: { etiqueta: 'Cambio', tono: 'neutro' },
}

/**
 * Un escenario de estructura: el editor (mientras es borrador), el comparador
 * contra la realidad con su delta de dotación —y de costo, con permiso—, el
 * impacto (procesos sin dueño, rutas sin firmante, gente en plazas que cierran)
 * y la aprobación con su fecha de entrada en vigencia.
 */
export default async function EscenarioPage({ params, searchParams }: PageProps<'/sistema/nucleo/escenarios/[id]'>) {
  const [sesion, { id }, consulta] = await Promise.all([requerirPermiso('sistema:escenarios'), params, searchParams])
  const supabase = await createClient()
  const org = supabase.schema('org')

  const { data: e } = await org.from('escenario').select('*').eq('id', id).maybeSingle()
  if (!e || e.alcance !== 'estructura') notFound()

  const editable = e.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'editar')
  const vista = consulta.vista === 'diseno' || consulta.vista === 'comparar' || consulta.vista === 'aprobacion' ? consulta.vista : e.estado === 'borrador' ? 'diseno' : 'comparar'
  const verCostos = puede(sesion, 'sistema:costos')
  const hoy = hoyCaracas()

  const [unidadesEsc, plazasEsc, cargos, catalogo, real, comparacion, flujo] = await Promise.all([
    org.from('unidad').select('ref, nombre, tipo, padre_ref, orden').eq('escenario_id', id),
    org.from('plaza').select('ref, unidad_ref, cargo_id, reporta_a_ref, dotacion, estado').eq('escenario_id', id).range(0, 1999),
    org.from('cargo').select('id, nombre').order('nombre'),
    supabase.schema('control').from('catalogo').select('tipo, clave, etiqueta').in('tipo', ['tipo_unidad', 'tipo_nomina']).eq('activo', true).order('orden'),
    org.rpc('estructura_al', { p_fecha: e.fecha_base }),
    org.rpc('comparar_escenario', { p_escenario: id }),
    contextoFlujo(supabase, 'escenario_estructura', id),
  ])

  const nombreCargo = new Map((cargos.data ?? []).map((c) => [c.id, c.nombre]))
  const filasReal = real.data ?? []
  const realPlaza = new Map(filasReal.filter((f) => f.plaza_ref).map((f) => [f.plaza_ref, f]))
  const nombreUnidad = new Map<string, string>()
  for (const f of filasReal) nombreUnidad.set(f.unidad_ref, f.unidad)
  for (const u of unidadesEsc.data ?? []) nombreUnidad.set(u.ref, u.nombre)

  const unidades = ordenarArbol((unidadesEsc.data ?? []).map((u) => ({ ...u, padre_ref: u.padre_ref })))
  const plazas = (plazasEsc.data ?? []).map((p) => ({
    ref: p.ref,
    unidad_ref: p.unidad_ref,
    cargo_id: p.cargo_id,
    cargo: nombreCargo.get(p.cargo_id) ?? 'Cargo',
    reporta_a_ref: p.reporta_a_ref,
    dotacion: p.dotacion,
    real: realPlaza.get(p.ref)?.dotacion ?? null,
    ocupadas: realPlaza.get(p.ref)?.ocupadas ?? 0,
  }))

  const cambios = (comparacion.data ?? []) as unknown as Cambio[]
  const cambiosUnidad = cambios.filter((c) => c.objeto === 'unidad')
  const cambiosPlaza = cambios.filter((c) => c.objeto === 'plaza')
  const dot = (x: Record<string, unknown> | null) => Number(x?.dotacion ?? 0)
  const deltaDotacion = cambiosPlaza.reduce((s, c) => s + dot(c.despues) - dot(c.antes), 0)
  const dotacionReal = filasReal.reduce((s, f) => s + (f.plaza_ref && f.estado !== 'cerrada' ? f.dotacion : 0), 0)

  // Δ de costo por cargo: Σ Δdotación × costo mensual de referencia. Perímetro de nómina.
  const deltaPorCargo = new Map<string, number>()
  for (const c of cambiosPlaza) {
    const antes = c.antes?.cargo_id as string | undefined
    const despues = c.despues?.cargo_id as string | undefined
    if (antes) deltaPorCargo.set(antes, (deltaPorCargo.get(antes) ?? 0) - dot(c.antes))
    if (despues) deltaPorCargo.set(despues, (deltaPorCargo.get(despues) ?? 0) + dot(c.despues))
  }
  let costo: { total: number; totalUsd: number; sinCosto: string[] } | null = null
  if (verCostos && vista === 'comparar') {
    const conDelta = [...deltaPorCargo.entries()].filter(([, d]) => d !== 0)
    const costos = await Promise.all(conDelta.map(([cargo]) => org.rpc('costo_mensual', { p_cargo: cargo, p_fecha: hoy })))
    costo = { total: 0, totalUsd: 0, sinCosto: [] }
    conDelta.forEach(([cargo, d], i) => {
      const c = costos[i].data as { total_ves?: number; total_usd?: number } | null
      if (!c) costo!.sinCosto.push(nombreCargo.get(cargo) ?? cargo)
      else {
        costo!.total += d * (c.total_ves ?? 0)
        costo!.totalUsd += d * (c.total_usd ?? 0)
      }
    })
  }

  // Impacto: lo que se queda sin dueño, sin firmante o sin plaza.
  const bajas = cambiosPlaza.filter((c) => c.cambio === 'baja').map((c) => c.ref)
  const cargosReal = new Set(filasReal.map((f) => f.cargo_id).filter(Boolean))
  const cargosEsc = new Set(plazas.map((p) => p.cargo_id))
  const cargosQueSalen = [...cargosReal].filter((c) => !cargosEsc.has(c))
  let impacto: {
    procesos: { nombre: string; codigo: string | null }[] | null
    rutas: { ruta: string; paso: string }[] | null
    gente: { nombre: string; plaza: string }[]
    excedidas: { plaza: string; dotacion: number; ocupadas: number }[]
  } | null = null
  if (vista === 'comparar') {
    const [procesos, rutas, ocupaciones] = await Promise.all([
      bajas.length && puede(sesion, 'sistema:procesos')
        ? supabase.schema('sgc').from('proceso').select('nombre, codigo_sgc, codigo_informe').in('dueno_plaza_ref', bajas).is('escenario_id', null).eq('estado', 'vigente')
        : null,
      puede(sesion, 'sistema:aprobaciones') && (cargosQueSalen.length || bajas.length)
        ? supabase
            .schema('flujo')
            .from('ruta_paso')
            .select('nombre, cargo_id, plaza_ref, ruta(nombre, activa)')
            .or([cargosQueSalen.length ? `cargo_id.in.(${cargosQueSalen.join(',')})` : '', bajas.length ? `plaza_ref.in.(${bajas.join(',')})` : ''].filter(Boolean).join(','))
        : null,
      bajas.length ? org.from('ocupacion').select('empleado_id, plaza_ref').in('plaza_ref', bajas).filter('vigencia', 'cs', `[${hoy},${hoy}]`) : null,
    ])
    const ids = (ocupaciones?.data ?? []).map((o) => o.empleado_id)
    const { data: gente } = ids.length ? await supabase.from('empleados').select('id, nombre_completo').in('id', ids) : { data: [] }
    const nombreEmp = new Map((gente ?? []).map((g) => [g.id, g.nombre_completo]))
    const descPlaza = (ref: string) => {
      const r = realPlaza.get(ref)
      return r ? `${r.cargo} · ${r.unidad}` : 'Plaza'
    }
    impacto = {
      procesos: procesos ? (procesos.data ?? []).map((p) => ({ nombre: p.nombre, codigo: p.codigo_sgc ?? p.codigo_informe })) : null,
      rutas: rutas
        ? (rutas.data ?? [])
            .filter((r) => (r.ruta as unknown as { activa: boolean } | null)?.activa)
            .map((r) => ({ ruta: (r.ruta as unknown as { nombre: string }).nombre, paso: r.nombre }))
        : puede(sesion, 'sistema:aprobaciones')
          ? []
          : null,
      gente: (ocupaciones?.data ?? []).map((o) => ({ nombre: nombreEmp.get(o.empleado_id) ?? 'Persona', plaza: descPlaza(o.plaza_ref) })),
      excedidas: cambiosPlaza
        .filter((c) => c.cambio !== 'baja' && c.cambio !== 'alta' && (realPlaza.get(c.ref)?.ocupadas ?? 0) > dot(c.despues))
        .map((c) => ({ plaza: descPlaza(c.ref), dotacion: dot(c.despues), ocupadas: realPlaza.get(c.ref)?.ocupadas ?? 0 })),
    }
  }

  const tipos = (catalogo.data ?? []).filter((c) => c.tipo === 'tipo_unidad').map((c) => ({ clave: c.clave, etiqueta: c.etiqueta }))
  const nominas = (catalogo.data ?? []).filter((c) => c.tipo === 'tipo_nomina').map((c) => ({ clave: c.clave, etiqueta: c.etiqueta }))
  const est = ESTADO_ESCENARIO[e.estado] ?? { etiqueta: e.estado, tono: 'neutro' as const }
  const pestanas = [
    ['diseno', 'Diseño'],
    ['comparar', `Comparación e impacto · ${cambios.length}`],
    ['aprobacion', 'Aprobación'],
  ] as const

  return (
    <>
      <Link href="/sistema/nucleo/escenarios" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Escenarios
      </Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo mb-2">Escenario de estructura</p>
          <h1 className="text-2xl font-bold tracking-tight text-marca-900">{e.nombre}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-marca-600">
            <Insignia tono={est.tono}>{est.etiqueta}</Insignia>
            <span>Copia de la estructura del {fecha(e.fecha_base)}</span>
            {e.vigente_desde && <span>· rige desde el {fecha(e.vigente_desde)}</span>}
            {e.publicado_en && <span>· publicado el {fechaHora(e.publicado_en)}</span>}
          </div>
          {e.descripcion && <p className="mt-2 max-w-2xl text-sm text-marca-600">{e.descripcion}</p>}
          <Link
            href={`/sistema/nucleo/organizacion?esc=${id}`}
            className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#d9cff0] bg-[#f7f4fd] px-3.5 text-sm font-semibold text-[#6b4fb3] hover:bg-[#f1edfa]"
          >
            ◆ {editable ? 'Editar en el organigrama' : 'Ver en el organigrama'}
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="tarjeta px-4 py-3">
            <p className="text-xs text-marca-500 uppercase">Dotación</p>
            <p className="text-xl font-bold text-marca-900 tabular-nums">
              {dotacionReal} → {dotacionReal + deltaDotacion}
            </p>
          </div>
          <div className="tarjeta px-4 py-3">
            <p className="text-xs text-marca-500 uppercase">Δ</p>
            <p className={cn('text-xl font-bold tabular-nums', deltaDotacion > 0 ? 'text-acento-700' : deltaDotacion < 0 ? 'text-emerald-700' : 'text-marca-900')}>
              {deltaDotacion > 0 ? '+' : ''}
              {deltaDotacion}
            </p>
          </div>
        </div>
      </div>

      {e.estado === 'publicado' && (
        <Aviso tono="verde">
          Publicado: sus cambios entraron a la estructura real con vigencia desde el {fecha(e.vigente_desde)}. Este escenario queda cerrado
          como evidencia.
        </Aviso>
      )}
      {flujo.decidible && (
        <div className="mb-6">
          <DecidirPaso pasoId={flujo.decidible.id} accion={flujo.decidible.accion} nombre={flujo.decidible.nombre} />
        </div>
      )}

      <nav className="mb-5 flex flex-wrap gap-1 rounded-xl border border-marca-200 bg-white p-1 text-sm" aria-label="Vistas del escenario">
        {pestanas.map(([clave, texto]) => (
          <Link
            key={clave}
            href={`/sistema/nucleo/escenarios/${id}?vista=${clave}`}
            aria-current={vista === clave ? 'page' : undefined}
            className={cn('rounded-lg px-3 py-1.5', vista === clave ? 'bg-marca-800 font-semibold text-white' : 'text-marca-600 hover:bg-marca-50')}
          >
            {texto}
          </Link>
        ))}
      </nav>

      {vista === 'diseno' && (
        <>
          {!editable && (
            <Aviso>
              {e.estado === 'borrador' ? 'Puedes ver el escenario, pero editarlo pide permiso de editar escenarios.' : 'El escenario ya no está en borrador: se ve, no se edita.'}
            </Aviso>
          )}
          <EditorEscenario escenario={id} editable={editable} unidades={unidades} plazas={plazas} cargos={cargos.data ?? []} tiposUnidad={tipos} nominas={nominas} />
        </>
      )}

      {vista === 'comparar' && (
        <div className="space-y-6">
          <section className="tarjeta p-5 sm:p-6" aria-labelledby="cmp">
            <h2 id="cmp" className="mb-1 text-base font-semibold text-marca-900">
              Qué cambia contra la realidad
            </h2>
            <p className="mb-4 text-xs text-marca-500">Contra la estructura vigente el {fecha(e.fecha_base)}.</p>
            {!cambios.length ? (
              <p className="text-sm text-marca-500">Todavía es idéntico a la realidad.</p>
            ) : (
              <div className="space-y-5">
                {!!cambiosUnidad.length && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-marca-800">Unidades · {cambiosUnidad.length}</h3>
                    <ul className="divide-y divide-[var(--borde)] rounded-xl border border-marca-200/70">
                      {cambiosUnidad.map((c) => (
                        <li key={c.ref} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                          <Insignia tono={CAMBIO[c.cambio]?.tono ?? 'neutro'}>{CAMBIO[c.cambio]?.etiqueta ?? c.cambio}</Insignia>
                          <span className="font-medium text-marca-900">{String((c.despues ?? c.antes)?.nombre ?? '')}</span>
                          {c.cambio === 'renombre' && <span className="text-marca-500">antes «{String(c.antes?.nombre)}»</span>}
                          {(c.cambio === 'movimiento' || c.cambio === 'alta') && (
                            <span className="text-marca-500">
                              depende de {nombreUnidad.get(String(c.despues?.padre_ref ?? '')) ?? 'nadie'}
                              {c.cambio === 'movimiento' && <> · antes de {nombreUnidad.get(String(c.antes?.padre_ref ?? '')) ?? 'nadie'}</>}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!cambiosPlaza.length && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-marca-800">Plazas · {cambiosPlaza.length}</h3>
                    <ul className="divide-y divide-[var(--borde)] rounded-xl border border-marca-200/70">
                      {cambiosPlaza.map((c) => {
                        const d = dot(c.despues) - dot(c.antes)
                        const x = c.despues ?? c.antes
                        return (
                          <li key={c.ref} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                            <Insignia tono={CAMBIO[c.cambio]?.tono ?? 'neutro'}>{CAMBIO[c.cambio]?.etiqueta ?? c.cambio}</Insignia>
                            <span className="font-medium text-marca-900">{nombreCargo.get(String(x?.cargo_id)) ?? 'Cargo'}</span>
                            <span className="text-marca-500">{nombreUnidad.get(String(x?.unidad_ref)) ?? ''}</span>
                            <span className="ml-auto text-xs tabular-nums text-marca-600">
                              {c.antes ? dot(c.antes) : '—'} → {c.despues ? dot(c.despues) : '—'}
                              {d !== 0 && <span className={cn('ml-1.5 font-semibold', d > 0 ? 'text-acento-700' : 'text-emerald-700')}>({d > 0 ? '+' : ''}{d})</span>}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {verCostos && costo && (
            <section className="tarjeta p-5 sm:p-6" aria-labelledby="costo">
              <h2 id="costo" className="mb-3 flex items-center gap-2 text-base font-semibold text-marca-900">
                <IconoCandado className="h-4 w-4 text-marca-500" />
                Delta de costo mensual
              </h2>
              <p className="text-2xl font-bold tracking-tight text-marca-900 tabular-nums">
                {costo.total > 0 ? '+' : ''}
                {monto(costo.total)}
                <span className="ml-2 text-base font-medium text-marca-500">
                  {costo.totalUsd > 0 ? '+' : ''}
                  {monto(costo.totalUsd, 'USD')}
                </span>
              </p>
              <p className="mt-1 text-xs text-marca-500">Σ Δdotación × costo mensual de referencia del cargo, a hoy. Al año: {monto(costo.total * 12)}.</p>
              {!!costo.sinCosto.length && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                  Falta costo de referencia de: {costo.sinCosto.join(', ')}. La cifra no los incluye.
                </p>
              )}
            </section>
          )}

          {impacto && (
            <section className="tarjeta p-5 sm:p-6" aria-labelledby="imp">
              <h2 id="imp" className="mb-4 text-base font-semibold text-marca-900">
                Impacto
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-marca-200/70 p-4">
                  <p className="text-sm font-semibold text-marca-800">Procesos que se quedan sin dueño</p>
                  {impacto.procesos === null ? (
                    <p className="mt-2 text-sm text-marca-500">{bajas.length ? 'No tienes permiso para ver procesos.' : 'Ninguno: no cierra plazas.'}</p>
                  ) : impacto.procesos.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-marca-700">
                      {impacto.procesos.map((p, i) => (
                        <li key={i}>
                          {p.codigo && <span className="mr-1.5 font-mono text-xs text-marca-500">{p.codigo}</span>}
                          {p.nombre}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-marca-500">Ninguno.</p>
                  )}
                </div>
                <div className="rounded-xl border border-marca-200/70 p-4">
                  <p className="text-sm font-semibold text-marca-800">Rutas de aprobación que pierden a quien firma</p>
                  {impacto.rutas === null ? (
                    <p className="mt-2 text-sm text-marca-500">No tienes permiso para ver las rutas.</p>
                  ) : impacto.rutas.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-marca-700">
                      {impacto.rutas.map((r, i) => (
                        <li key={i}>
                          {r.ruta} · <span className="text-marca-500">{r.paso}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-marca-500">Ninguna.</p>
                  )}
                </div>
                <div className="rounded-xl border border-marca-200/70 p-4">
                  <p className="text-sm font-semibold text-marca-800">Personas en plazas que cierran</p>
                  {impacto.gente.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-marca-700">
                      {impacto.gente.map((g, i) => (
                        <li key={i}>
                          {g.nombre} · <span className="text-marca-500">{g.plaza}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-marca-500">Nadie.</p>
                  )}
                </div>
                <div className="rounded-xl border border-marca-200/70 p-4">
                  <p className="text-sm font-semibold text-marca-800">Plazas con más gente que su nueva dotación</p>
                  {impacto.excedidas.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-marca-700">
                      {impacto.excedidas.map((x, i) => (
                        <li key={i}>
                          {x.plaza} · <span className="text-amber-700">{x.ocupadas} ocupadas para {x.dotacion}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-marca-500">Ninguna.</p>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {vista === 'aprobacion' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {editable && (
              <FormAccion accion={enviarEscenario} className="tarjeta p-5 sm:p-6">
                <input type="hidden" name="escenario" value={id} />
                <h2 className="text-base font-semibold text-marca-900">Enviar a aprobación</h2>
                <p className="mt-1 mb-4 text-sm text-marca-600">
                  La estructura publicada es configuración sensible: la firman dos (doble aprobación). Al firmar el último paso se publica sola,
                  con la fecha que elijas. No se permite una fecha anterior a hoy.
                </p>
                <label htmlFor="vig" className="etiqueta">
                  Vigente desde <span className="text-acento-600">*</span>
                </label>
                <input id="vig" name="vigente_desde" type="date" min={hoy} defaultValue={hoy} className="campo max-w-xs" />
                <div className="mt-4">
                  <Enviar pendiente="Enviando…" confirmar={`¿Enviar el escenario a aprobación con ${cambios.length} cambio(s)? Ya no se podrá editar.`}>
                    <IconoEnviar className="h-4 w-4" />
                    Enviar a aprobación
                  </Enviar>
                </div>
              </FormAccion>
            )}
            {e.estado === 'borrador' && puede(sesion, 'sistema:escenarios', 'eliminar') && (
              <details className="tarjeta p-5">
                <summary className="cursor-pointer text-sm font-medium text-acento-700">Descartar el escenario</summary>
                <FormAccion accion={descartarEscenario} className="mt-3">
                  <input type="hidden" name="escenario" value={id} />
                  <p className="mb-3 text-sm text-marca-600">Queda como registro, con estado «Descartado». No se borra.</p>
                  <Enviar clase="btn-peligro" pendiente="Descartando…" confirmar="¿Descartar el escenario?">
                    <IconoAlerta className="h-4 w-4" />
                    Descartar
                  </Enviar>
                </FormAccion>
              </details>
            )}
            {!editable && e.estado === 'borrador' && <p className="text-sm text-marca-500">Enviarlo a aprobación pide permiso de editar escenarios.</p>}
          </div>
          <section className="tarjeta p-5" aria-labelledby="pasos">
            <h2 id="pasos" className="mb-4 text-base font-semibold text-marca-900">
              Ruta de aprobación
            </h2>
            <LineaTiempo contexto={flujo} />
          </section>
        </div>
      )}
    </>
  )
}
