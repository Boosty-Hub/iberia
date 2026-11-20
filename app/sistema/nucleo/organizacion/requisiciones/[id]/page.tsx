import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cancelarRequisicion, enviarRequisicion, guardarPropuestaSalarial, registrarIngreso } from '../acciones'
import { IconoAlerta, IconoAtras, IconoCandado, IconoEditar, IconoEnviar } from '@/components/iconos'
import { contextoFlujo } from '@/components/sistema/flujo/datos'
import { DecidirPaso } from '@/components/sistema/flujo/decidir-paso'
import { CostoRequisicion, ImpactoRequisicion, type Costo, type Impacto } from '@/components/sistema/flujo/impacto'
import { ESTADO_REQUISICION, fecha, fechaHora, hoyCaracas } from '@/components/sistema/flujo/formato'
import { Enviar, FormAccion } from '@/components/sistema/flujo/formulario'
import { LineaTiempo } from '@/components/sistema/flujo/linea-tiempo'
import { Aviso, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Requisición de personal' }

const POSTURA: Record<string, string> = { de_pie: 'De pie', sentado: 'Sentado', alterna: 'Alterna' }

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-marca-500 uppercase">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-pretty break-words text-marca-900">{children || <span className="text-marca-400">—</span>}</dd>
    </div>
  )
}

/**
 * Una requisición: lo que pide, su impacto (vivo antes de enviarla, congelado
 * después), el costo para quien tiene el perímetro de nómina, la ruta con cada
 * firma y la regla que la habilitó, y las acciones que le tocan a quien mira.
 */
export default async function RequisicionPage({ params, searchParams }: PageProps<'/sistema/nucleo/organizacion/requisiciones/[id]'>) {
  const [sesion, { id }, consulta] = await Promise.all([requerirPermiso('sistema:requisiciones', 'crear'), params, searchParams])
  const supabase = await createClient()
  const org = supabase.schema('org')
  const hoy = hoyCaracas()

  const { data: q } = await org.from('requisicion').select('*, cargo(nombre)').eq('id', id).maybeSingle()
  if (!q) notFound()

  const verCostos = puede(sesion, 'sistema:costos')
  const editarCostos = puede(sesion, 'sistema:costos', 'editar')
  const rrhh = puede(sesion, 'sistema:requisiciones', 'editar')
  const propia = q.creado_por === sesion.userId
  const enviada = q.impacto !== null

  const [unidad, impactoVivo, costoFila, costoVivo, flujo, catalogo, reemplaza, ocupaciones, plaza] = await Promise.all([
    org.from('unidad').select('nombre').eq('ref', q.unidad_ref).is('escenario_id', null).order('vigencia', { ascending: false }).limit(1).maybeSingle(),
    enviada ? null : org.rpc('impacto_requisicion', { p_req: id }),
    verCostos ? org.from('requisicion_costo').select('*').eq('requisicion_id', id).maybeSingle() : null,
    verCostos && !enviada ? org.rpc('costo_mensual', { p_cargo: q.cargo_id, p_fecha: hoy }) : null,
    contextoFlujo(supabase, 'requisicion_personal', id),
    supabase.schema('control').from('catalogo').select('tipo, clave, etiqueta').in('tipo', ['origen_requisicion', 'tipo_nomina']),
    q.reemplaza_empleado_id ? supabase.from('empleados').select('nombre_completo').eq('id', q.reemplaza_empleado_id).maybeSingle() : null,
    q.plaza_ref
      ? org.from('ocupacion').select('id, vigencia, tipo, empleado_id').eq('plaza_ref', q.plaza_ref).eq('motivo', `Requisición ${q.numero}`)
      : null,
    q.plaza_ref
      ? org.from('plaza').select('dotacion, estado, vigencia').eq('ref', q.plaza_ref).is('escenario_id', null).filter('vigencia', 'cs', `[${hoy},${hoy}]`).maybeSingle()
      : null,
  ])

  const etiqueta = (tipo: string, clave: string | null) => (catalogo.data ?? []).find((c) => c.tipo === tipo && c.clave === clave)?.etiqueta ?? clave
  const origenes = Object.fromEntries((catalogo.data ?? []).filter((c) => c.tipo === 'origen_requisicion').map((c) => [c.clave, c.etiqueta]))
  const impacto = (enviada ? q.impacto : impactoVivo?.data) as Impacto | null
  const costoCongelado = (costoFila?.data?.impacto_costo as { por_plaza?: Costo } | null)?.por_plaza ?? null
  const costo: Costo = enviada ? costoCongelado : ((costoVivo?.data as Costo) ?? null)
  const est = ESTADO_REQUISICION[q.estado] ?? { etiqueta: q.estado, tono: 'neutro' as const }
  const perfil = (q.perfil ?? {}) as Record<string, string | null>
  const cond = (q.condiciones ?? {}) as Record<string, string | null>
  const cargo = (q.cargo as unknown as { nombre: string } | null)?.nombre ?? 'Cargo'
  const corregible = ['borrador', 'devuelta'].includes(q.estado) && (propia || rrhh)
  const cancelable = ['borrador', 'devuelta', 'en_aprobacion'].includes(q.estado) && (propia || rrhh)
  const ingresable = ['aprobada', 'en_seleccion'].includes(q.estado) && rrhh && Boolean(q.plaza_ref)
  const devolucion = flujo.solicitudes[0]?.pasos.find((p) => p.decision === 'devuelto')
  const ultimaSolicitud = flujo.solicitudes[0]

  const ingresaron = ocupaciones?.data?.length
    ? ((await supabase.from('empleados').select('id, nombre_completo').in('id', ocupaciones.data.map((o) => o.empleado_id))).data ?? [])
    : []

  // Para registrar el ingreso: el padrón activo, marcando quién ya es titular de otra plaza.
  let empleados: { id: string; nombre: string; cargo: string | null; titular: boolean }[] = []
  if (ingresable) {
    const [{ data: gente }, { data: titulares }] = await Promise.all([
      supabase.from('empleados').select('id, nombre_completo, cargo').eq('activo', true).order('nombre_completo').range(0, 999),
      org.from('ocupacion').select('empleado_id').eq('tipo', 'titular').filter('vigencia', 'cs', `[${hoy},${hoy}]`).range(0, 999),
    ])
    const ocupados = new Set((titulares ?? []).map((t) => t.empleado_id))
    empleados = (gente ?? []).map((e) => ({ id: e.id, nombre: e.nombre_completo, cargo: e.cargo, titular: ocupados.has(e.id) }))
  }

  return (
    <>
      <Link href="/sistema/nucleo/organizacion/requisiciones" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Requisiciones
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="rotulo mb-2">Requisición N.º {q.numero} · II-21-40-001</p>
          <h1 className="text-2xl font-bold tracking-tight text-marca-900">
            {cargo}
            {q.cantidad > 1 && <span className="font-medium text-marca-500"> × {q.cantidad}</span>}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-marca-600">
            <Insignia tono={est.tono}>{est.etiqueta}</Insignia>
            <span>{unidad.data?.nombre ?? 'Unidad'}</span>
            <span aria-hidden>·</span>
            <span>{etiqueta('origen_requisicion', q.origen)}</span>
            <span aria-hidden>·</span>
            <span>Creada el {fechaHora(q.creado_en)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {corregible && (
            <Link href={`/sistema/nucleo/organizacion/requisiciones/${id}/editar`} className="btn-neutro h-10">
              <IconoEditar className="h-4 w-4" />
              Corregir
            </Link>
          )}
          {corregible && (
            <FormAccion accion={enviarRequisicion} mensajeClase="max-w-sm">
              <input type="hidden" name="id" value={id} />
              <Enviar pendiente="Enviando…" confirmar="¿Enviarla a aprobación? El impacto se congela y la ruta arranca.">
                <IconoEnviar className="h-4 w-4" />
                {q.estado === 'devuelta' ? 'Reenviar a aprobación' : 'Enviar a aprobación'}
              </Enviar>
            </FormAccion>
          )}
        </div>
      </div>

      {consulta.guardada === '1' && q.estado === 'borrador' && (
        <Aviso tono="verde">Borrador guardado. Revisa el impacto y, si está bien, envíala a aprobación.</Aviso>
      )}
      {q.estado === 'devuelta' && devolucion && (
        <Aviso tono="ambar">
          <strong>Te la devolvieron</strong> en «{devolucion.nombre}»: «{devolucion.comentario}». Corrígela y vuelve a enviarla.
        </Aviso>
      )}
      {q.estado === 'rechazada' && ultimaSolicitud && (
        <Aviso tono="rojo">Rechazada: «{ultimaSolicitud.pasos.find((p) => p.decision === 'rechazado')?.comentario ?? 'sin motivo'}».</Aviso>
      )}

      {flujo.decidible && (
        <div className="mb-6">
          <DecidirPaso
            pasoId={flujo.decidible.id}
            accion={flujo.decidible.accion}
            nombre={flujo.decidible.nombre}
            requisicionId={id}
            candidato={q.candidato}
            fechaIngreso={q.fecha_ingreso}
          />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          <section className="tarjeta p-5 sm:p-6" aria-labelledby="impacto">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 id="impacto" className="text-base font-semibold text-marca-900">
                Impacto
              </h2>
              <span className="text-xs text-marca-500">
                {enviada ? `Congelado al enviar · ${fecha(impacto?.fecha)}` : 'Así quedaría si la envías hoy'}
              </span>
            </div>
            {impacto ? <ImpactoRequisicion impacto={impacto} /> : <p className="text-sm text-marca-500">No se pudo calcular.</p>}
          </section>

          {verCostos && (
            <section className="tarjeta p-5 sm:p-6" aria-labelledby="costo">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 id="costo" className="flex items-center gap-2 text-base font-semibold text-marca-900">
                  <IconoCandado className="h-4 w-4 text-marca-500" />
                  Costo incremental
                </h2>
                <span className="text-xs text-marca-500">Perímetro de nómina · solo con permiso de costos</span>
              </div>
              <CostoRequisicion costo={costo} cantidad={q.cantidad} congelado={enviada} />

              <div className="mt-6 border-t border-[var(--borde)] pt-5">
                <h3 className="text-sm font-semibold text-marca-800">Propuesta salarial</h3>
                {editarCostos && !['cubierta', 'cancelada', 'rechazada'].includes(q.estado) ? (
                  <FormAccion accion={guardarPropuestaSalarial} className="mt-3 grid gap-3 sm:grid-cols-4">
                    <input type="hidden" name="id" value={id} />
                    <div className="sm:col-span-2">
                      <label htmlFor="sal" className="etiqueta">
                        Salario propuesto
                      </label>
                      <input id="sal" name="salario_propuesto" inputMode="decimal" defaultValue={costoFila?.data?.salario_propuesto ?? ''} className="campo" />
                    </div>
                    <div>
                      <label htmlFor="mon" className="etiqueta">
                        Moneda
                      </label>
                      <select id="mon" name="moneda" defaultValue={costoFila?.data?.moneda ?? 'VES'} className="campo">
                        <option value="VES">Bs.</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="bon" className="etiqueta">
                        Bonos (USD/mes)
                      </label>
                      <input id="bon" name="bonos_usd" inputMode="decimal" defaultValue={costoFila?.data?.bonos_usd ?? ''} className="campo" />
                    </div>
                    <div className="sm:col-span-4">
                      <label htmlFor="nota" className="etiqueta">
                        Nota (vehículo, cesta ticket, otros)
                      </label>
                      <input id="nota" name="nota" maxLength={500} defaultValue={costoFila?.data?.nota ?? ''} className="campo" />
                    </div>
                    <div className="sm:col-span-4">
                      <Enviar clase="btn-primario">Guardar la propuesta</Enviar>
                    </div>
                  </FormAccion>
                ) : (
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Dato etiqueta="Salario propuesto">
                      {costoFila?.data?.salario_propuesto != null ? `${costoFila.data.salario_propuesto.toLocaleString('es-VE')} ${costoFila.data.moneda ?? ''}` : null}
                    </Dato>
                    <Dato etiqueta="Bonos (USD/mes)">{costoFila?.data?.bonos_usd?.toLocaleString('es-VE')}</Dato>
                    <Dato etiqueta="Nota">{costoFila?.data?.nota}</Dato>
                  </dl>
                )}
              </div>
            </section>
          )}

          <section className="tarjeta p-5 sm:p-6" aria-labelledby="pedido">
            <h2 id="pedido" className="mb-4 text-base font-semibold text-marca-900">
              Lo que se pide
            </h2>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Dato etiqueta="Unidad">{unidad.data?.nombre}</Dato>
              <Dato etiqueta="Cargo">{cargo}</Dato>
              <Dato etiqueta="Cantidad">{q.cantidad}</Dato>
              <Dato etiqueta="Origen">{etiqueta('origen_requisicion', q.origen)}</Dato>
              <Dato etiqueta="Tipo de nómina">{etiqueta('tipo_nomina', q.tipo_nomina)}</Dato>
              <Dato etiqueta="Fecha deseada">{q.fecha_deseada ? fecha(q.fecha_deseada) : null}</Dato>
              {q.origen.startsWith('vacante') && <Dato etiqueta="Reemplaza a">{reemplaza?.data?.nombre_completo}</Dato>}
              {q.origen === 'tiempo_determinado' && (
                <>
                  <Dato etiqueta="Motivo del contrato">{q.motivo_contrato}</Dato>
                  <Dato etiqueta="Tiempo">{q.tiempo_contrato}</Dato>
                </>
              )}
              <div className="sm:col-span-2 lg:col-span-3">
                <Dato etiqueta="Justificación">{q.justificacion}</Dato>
              </div>
              <Dato etiqueta="Nivel educativo">{perfil.nivel_educativo}</Dato>
              <Dato etiqueta="Especialidad">{perfil.especialidad}</Dato>
              <Dato etiqueta="Conocimientos y habilidades">{perfil.conocimientos}</Dato>
              {perfil.requisito_fisico && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <Dato etiqueta="Requisito físico del puesto">
                    {perfil.requisito_fisico}
                    <span className="block text-marca-600">Por qué: {perfil.requisito_fisico_justificacion}</span>
                  </Dato>
                </div>
              )}
              <Dato etiqueta="Turnos">{cond.turnos}</Dato>
              <Dato etiqueta="De pie o sentado">{cond.postura ? (POSTURA[cond.postura] ?? cond.postura) : null}</Dato>
              <Dato etiqueta="Carga">{cond.carga}</Dato>
            </dl>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="tarjeta p-5" aria-labelledby="ruta">
            <h2 id="ruta" className="mb-4 text-base font-semibold text-marca-900">
              Ruta de aprobación
            </h2>
            <LineaTiempo contexto={flujo} etiquetasOrigen={origenes} />
          </section>

          {(q.candidato || q.fecha_ingreso || q.plaza_ref) && (
            <section className="tarjeta p-5" aria-labelledby="cobertura">
              <h2 id="cobertura" className="mb-3 text-base font-semibold text-marca-900">
                Plaza y cobertura
              </h2>
              <dl className="grid gap-3">
                {plaza?.data && (
                  <Dato etiqueta="Plaza">
                    Dotación {plaza.data.dotacion} · {plaza.data.estado === 'en_creacion' ? 'en creación' : plaza.data.estado}
                  </Dato>
                )}
                <Dato etiqueta="Candidato">{q.candidato}</Dato>
                <Dato etiqueta="Fecha de ingreso">{q.fecha_ingreso ? fecha(q.fecha_ingreso) : null}</Dato>
                {!!ingresaron.length && (
                  <Dato etiqueta="Ingresaron">
                    <ul className="space-y-0.5">
                      {ingresaron.map((e) => (
                        <li key={e.id}>{e.nombre_completo}</li>
                      ))}
                    </ul>
                  </Dato>
                )}
              </dl>

              {ingresable && (
                <FormAccion accion={registrarIngreso} className="mt-5 border-t border-[var(--borde)] pt-4">
                  <input type="hidden" name="id" value={id} />
                  <p className="mb-3 text-sm font-semibold text-marca-800">Registrar el ingreso</p>
                  <label htmlFor="ing-emp" className="etiqueta">
                    Persona del padrón
                  </label>
                  <select id="ing-emp" name="empleado_id" defaultValue="" className="campo">
                    <option value="">Elige a quien ingresó…</option>
                    {empleados.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                        {e.cargo ? ` · ${e.cargo}` : ''}
                        {e.titular ? ' (ya es titular de otra plaza)' : ''}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="ing-fecha" className="etiqueta mt-3">
                    Fecha de ingreso
                  </label>
                  <input id="ing-fecha" name="fecha" type="date" defaultValue={q.fecha_ingreso ?? hoy} className="campo" />
                  <p className="mt-2 text-xs text-marca-500">
                    Crea su ocupación en la plaza con esa fecha
                    {q.reemplaza_empleado_id ? ' y cierra la de quien se fue' : ''}. El padrón de Capital Humano sigue mandando sobre
                    el dato personal.
                  </p>
                  <div className="mt-3">
                    <Enviar pendiente="Registrando…">Registrar el ingreso</Enviar>
                  </div>
                </FormAccion>
              )}
            </section>
          )}

          {cancelable && (
            <details className="tarjeta p-5">
              <summary className="cursor-pointer text-sm font-medium text-acento-700">Cancelar la requisición</summary>
              <FormAccion accion={cancelarRequisicion} className="mt-3">
                <input type="hidden" name="id" value={id} />
                <label htmlFor="can-mot" className="etiqueta">
                  Motivo
                </label>
                <input id="can-mot" name="motivo" maxLength={300} className="campo" placeholder="Ya no hace falta, se cubrió de otra forma…" />
                <div className="mt-3">
                  <Enviar clase="btn-peligro" pendiente="Cancelando…" confirmar="¿Cancelar la requisición? No se puede deshacer.">
                    <IconoAlerta className="h-4 w-4" />
                    Cancelar la requisición
                  </Enviar>
                </div>
              </FormAccion>
            </details>
          )}
        </aside>
      </div>
    </>
  )
}
