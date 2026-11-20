import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { fuenteLegible } from '@/lib/plataforma/fuentes'
import { Cifras } from '@/components/sistema/organizacion/arbol'
import {
  aplanar,
  etiquetaDe,
  fechaDe,
  fmtFecha,
  hoyCaracas,
  leerCatalogos,
  leerEstructura,
  leerNombres,
  nombrePlaza,
  rango,
  todas,
  type Catalogos,
  type Estructura,
  type Nodo,
  type Opcion,
  type PlazaVista,
} from '@/components/sistema/organizacion/datos'
import { BuscarPersona, Formulario, Plegable } from '@/components/sistema/organizacion/formulario'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  asignarOcupacion,
  buscarEmpleados,
  cerrarPlaza,
  cerrarUnidad,
  crearPlaza,
  crearUnidad,
  editarPlaza,
  editarUnidad,
  moverOcupacion,
  terminarOcupacion,
} from '../../acciones'

export const metadata: Metadata = { title: 'Unidad · Estructura' }

/**
 * La ficha de una unidad: sus plazas con quién las ocupa, lo que cuelga de ella,
 * su historial de versiones y la edición con fecha efectiva. Cada cambio cierra
 * la versión que rige y abre otra desde la fecha elegida (hoy o después).
 */

const SANGRIA = '\u00a0\u00a0\u00a0'

function Campo({ id, etiqueta, children, requerido, ayuda }: { id: string; etiqueta: string; children: React.ReactNode; requerido?: boolean; ayuda?: string }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="etiqueta">
        {etiqueta} {requerido && <span className="text-acento-600">*</span>}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-xs text-marca-500">{ayuda}</p>}
    </div>
  )
}

function Fecha({ id, hoy }: { id: string; hoy: string }) {
  return (
    <Campo id={id} etiqueta="Rige desde" requerido ayuda="Hoy o una fecha futura: hacia atrás no se permite.">
      <input id={id} type="date" name="fecha" required min={hoy} defaultValue={hoy} className="campo" />
    </Campo>
  )
}

function Opciones({ lista, vacia }: { lista: Opcion[]; vacia?: string }) {
  return (
    <>
      {vacia !== undefined && <option value="">{vacia}</option>}
      {lista
        .filter((o) => o.activo)
        .map((o) => (
          <option key={o.clave} value={o.clave}>
            {o.etiqueta}
          </option>
        ))}
    </>
  )
}

/** Las plazas de la unidad y de las que están por encima: a quién puede reportar una plaza de aquí. */
function OpcionesReporta({ e, nodo, excluir }: { e: Estructura; nodo: Nodo; excluir?: string }) {
  const cadena = [...nodo.ruta.map((r) => e.nodos.get(r)).filter(Boolean), nodo].reverse() as Nodo[]
  return (
    <>
      <option value="">Sin plaza superior</option>
      {cadena.map((n) => (
        <optgroup key={n.unidad.ref} label={n.unidad.nombre}>
          {n.plazas
            .filter((p) => p.ref !== excluir)
            .map((p) => (
              <option key={p.ref} value={p.ref}>
                {p.cargo}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  )
}

function OpcionesPlazas({ e, excluir }: { e: Estructura; excluir?: string }) {
  return (
    <>
      <option value="">Elige la plaza</option>
      {aplanar(e.raices)
        .filter((n) => n.plazas.length)
        .map((n) => (
          <optgroup key={n.unidad.ref} label={n.unidad.nombre}>
            {n.plazas
              .filter((p) => p.ref !== excluir)
              .map((p) => (
                <option key={p.ref} value={p.ref}>
                  {p.cargo} ({p.titulares}/{p.dotacion})
                </option>
              ))}
          </optgroup>
        ))}
    </>
  )
}

function TarjetaPlaza({
  p,
  e,
  nodo,
  catalogos,
  hoy,
  editar,
  asignar,
}: {
  p: PlazaVista
  e: Estructura
  nodo: Nodo
  catalogos: Catalogos
  hoy: string
  editar: boolean
  asignar: boolean
}) {
  const id = p.ref.slice(0, 8)
  return (
    <li className="tarjeta p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-marca-900">
            <Link href={`/sistema/nucleo/organizacion/cargos?ficha=cargo:${p.cargo_id}`} className="hover:text-acento-700">
              {p.cargo}
            </Link>
          </h3>
          <p className="mt-0.5 text-xs text-marca-500">Reporta a: {nombrePlaza(e, p.reporta_a_ref)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.certeza === 'inferencia' && <Insignia tono="ambar">Inferencia</Insignia>}
          <Insignia tono={p.estado === 'aprobada' ? 'verde' : 'neutro'}>{etiquetaDe(catalogos.estado_plaza, p.estado)}</Insignia>
          <Insignia>Nómina: {etiquetaDe(catalogos.tipo_nomina, p.tipo_nomina).toLowerCase()}</Insignia>
          {p.sedeEfectiva && <Insignia>{etiquetaDe(catalogos.sede, p.sedeEfectiva)}</Insignia>}
        </div>
      </div>
      <div className="mt-2 text-sm">
        <Cifras t={{ plazas: 1, dotacion: p.dotacion, ocupadas: p.titulares, vacantes: p.vacantes, porEncima: p.porEncima }} />
      </div>
      {p.nota && <p className="mt-2 text-xs text-pretty text-marca-500">{p.nota}</p>}

      {p.ocupantes.length > 0 ? (
        <ul className="mt-3 divide-y divide-marca-100 rounded-xl border border-marca-200/70">
          {p.ocupantes.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-marca-900">{o.nombre}</span>
                {o.ficha && <span className="ml-1.5 text-xs text-marca-500">ficha {o.ficha}</span>}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-marca-500">
                {o.tipo !== 'titular' && <Insignia>{etiquetaDe(catalogos.tipo_ocupacion, o.tipo)}</Insignia>}
                {o.excede && <Insignia tono="ambar">Por encima de la dotación</Insignia>}
                {o.certeza === 'por_nombre_de_cargo' && <Insignia tono="ambar">Casada por nombre de cargo</Insignia>}
                <span>desde {fmtFecha(o.desde)}</span>
                {o.hasta && <span>· hasta {fmtFecha(o.hasta)}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-marca-200 px-3 py-3 text-sm text-marca-500">Plaza sin ocupantes.</p>
      )}

      {(editar || asignar) && (
        <details className="group/ed mt-3">
          <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-marca-200 px-3 text-sm font-semibold text-marca-800 select-none hover:bg-marca-50 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-marca-400 transition-transform group-open/ed:rotate-90">›</span>
            Editar personas y plaza
          </summary>
        <div className="mt-2 space-y-2">
          {asignar && (
            <Plegable titulo="Asignar una persona">
              <Formulario accion={asignarOcupacion} boton="Asignar" pendiente="Asignando…">
                <input type="hidden" name="plaza_ref" value={p.ref} />
                <input type="hidden" name="unidad_actual" value={p.unidad_ref} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <BuscarPersona buscar={buscarEmpleados} id={`as-persona-${id}`} />
                  </div>
                  <Campo id={`as-tipo-${id}`} etiqueta="Tipo de ocupación" requerido>
                    <select id={`as-tipo-${id}`} name="tipo" defaultValue="titular" className="campo">
                      <Opciones lista={catalogos.tipo_ocupacion} />
                    </select>
                  </Campo>
                  <Fecha id={`as-fecha-${id}`} hoy={hoy} />
                  <Campo id={`as-motivo-${id}`} etiqueta="Motivo (opcional)">
                    <input id={`as-motivo-${id}`} name="motivo" className="campo" placeholder="Ingreso, promoción, interinato…" />
                  </Campo>
                  <label className="flex items-start gap-2 self-end pb-2 text-sm text-marca-700">
                    <input type="checkbox" name="excede" className="mt-0.5 h-4 w-4 accent-[var(--color-amber-600)]" />
                    <span>
                      Por encima de la dotación
                      <span className="block text-xs text-marca-500">Solo si la plaza está llena y la persona de verdad está ahí.</span>
                    </span>
                  </label>
                </div>
              </Formulario>
            </Plegable>
          )}
          {editar && p.ocupantes.length > 0 && (
            <Plegable titulo="Mover a otra plaza">
              <Formulario accion={moverOcupacion} boton="Mover" pendiente="Moviendo…">
                <input type="hidden" name="unidad_actual" value={p.unidad_ref} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo id={`mv-id-${id}`} etiqueta="Persona" requerido>
                    <select id={`mv-id-${id}`} name="id" required className="campo">
                      {p.ocupantes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo id={`mv-dest-${id}`} etiqueta="Plaza de destino" requerido>
                    <select id={`mv-dest-${id}`} name="plaza_destino" required className="campo">
                      <OpcionesPlazas e={e} excluir={p.ref} />
                    </select>
                  </Campo>
                  <Campo id={`mv-tipo-${id}`} etiqueta="Tipo en la plaza nueva">
                    <select id={`mv-tipo-${id}`} name="tipo" defaultValue="" className="campo">
                      <option value="">El mismo que tiene</option>
                      <Opciones lista={catalogos.tipo_ocupacion} />
                    </select>
                  </Campo>
                  <Fecha id={`mv-fecha-${id}`} hoy={hoy} />
                  <Campo id={`mv-motivo-${id}`} etiqueta="Motivo (opcional)">
                    <input id={`mv-motivo-${id}`} name="motivo" className="campo" placeholder="Promoción, transferencia…" />
                  </Campo>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm text-marca-700">
                    <input type="checkbox" name="excede" className="h-4 w-4 accent-[var(--color-amber-600)]" />
                    Por encima de la dotación en el destino
                  </label>
                </div>
              </Formulario>
            </Plegable>
          )}
          {editar && p.ocupantes.length > 0 && (
            <Plegable titulo="Terminar una ocupación">
              <Formulario accion={terminarOcupacion} boton="Terminar" pendiente="Guardando…" tono="peligro">
                <input type="hidden" name="unidad_actual" value={p.unidad_ref} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo id={`tm-id-${id}`} etiqueta="Persona" requerido>
                    <select id={`tm-id-${id}`} name="id" required className="campo">
                      {p.ocupantes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Campo id={`tm-fecha-${id}`} etiqueta="Último día + 1 (deja de ocuparla)" requerido ayuda="Hoy o una fecha futura.">
                    <input id={`tm-fecha-${id}`} type="date" name="fecha" required min={hoy} defaultValue={hoy} className="campo" />
                  </Campo>
                  <Campo id={`tm-motivo-${id}`} etiqueta="Motivo">
                    <input id={`tm-motivo-${id}`} name="motivo" className="campo" placeholder="Egreso, fin de pasantía…" />
                  </Campo>
                </div>
              </Formulario>
            </Plegable>
          )}
          {editar && (
            <Plegable titulo="Cambiar la plaza">
              <Formulario accion={editarPlaza} boton="Guardar versión nueva">
                <input type="hidden" name="ref" value={p.ref} />
                <input type="hidden" name="unidad_actual" value={p.unidad_ref} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo id={`pl-dot-${id}`} etiqueta="Dotación aprobada" requerido>
                    <input id={`pl-dot-${id}`} type="number" name="dotacion" min={1} max={500} required defaultValue={p.dotacion} className="campo" />
                  </Campo>
                  <Campo id={`pl-rep-${id}`} etiqueta="Reporta a">
                    <select id={`pl-rep-${id}`} name="reporta_a_ref" defaultValue={p.reporta_a_ref ?? ''} className="campo">
                      <OpcionesReporta e={e} nodo={nodo} excluir={p.ref} />
                      {p.reporta_a_ref && !nodo.ruta.concat(nodo.unidad.ref).includes(e.plazas.get(p.reporta_a_ref)?.unidad_ref ?? '') && (
                        <option value={p.reporta_a_ref}>{nombrePlaza(e, p.reporta_a_ref)}</option>
                      )}
                    </select>
                  </Campo>
                  <Campo id={`pl-est-${id}`} etiqueta="Estado">
                    <select id={`pl-est-${id}`} name="estado" defaultValue={p.estado} className="campo">
                      <Opciones lista={catalogos.estado_plaza.filter((o) => o.clave !== 'cerrada')} />
                    </select>
                  </Campo>
                  <Campo id={`pl-nom-${id}`} etiqueta="Tipo de nómina">
                    <select id={`pl-nom-${id}`} name="tipo_nomina" defaultValue={p.tipo_nomina ?? ''} className="campo">
                      <Opciones lista={catalogos.tipo_nomina} vacia="Sin definir" />
                    </select>
                  </Campo>
                  <Campo id={`pl-sede-${id}`} etiqueta="Sede propia" ayuda="Vacía: la de la unidad.">
                    <select id={`pl-sede-${id}`} name="sede" defaultValue={p.sede ?? ''} className="campo">
                      <Opciones lista={catalogos.sede} vacia="La de la unidad" />
                    </select>
                  </Campo>
                  <Campo id={`pl-uni-${id}`} etiqueta="Unidad">
                    <select id={`pl-uni-${id}`} name="unidad_ref" defaultValue={p.unidad_ref} className="campo">
                      {aplanar(e.raices).map((n) => (
                        <option key={n.unidad.ref} value={n.unidad.ref}>
                          {SANGRIA.repeat(n.profundidad)}
                          {n.unidad.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  <Fecha id={`pl-fecha-${id}`} hoy={hoy} />
                  <Campo id={`pl-nota-${id}`} etiqueta="Nota">
                    <input id={`pl-nota-${id}`} name="nota" className="campo" defaultValue={p.nota ?? ''} />
                  </Campo>
                  {p.certeza === 'inferencia' && (
                    <label className="flex items-center gap-2 text-sm text-marca-700 sm:col-span-2">
                      <input type="checkbox" name="confirmar" className="h-4 w-4 accent-[var(--color-acento-600)]" />
                      Confirmo estos datos (deja de ser inferencia)
                    </label>
                  )}
                </div>
              </Formulario>
            </Plegable>
          )}
          {editar && (
            <Plegable titulo="Cerrar la plaza" peligro>
              <Formulario accion={cerrarPlaza} boton="Cerrar la plaza" tono="peligro" pendiente="Cerrando…">
                <input type="hidden" name="ref" value={p.ref} />
                <input type="hidden" name="unidad_actual" value={p.unidad_ref} />
                <p className="mb-3 text-xs text-marca-500">
                  Solo se cierra una plaza vacía y sin plazas que le reporten. No se borra: deja de regir desde la fecha.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fecha id={`cp-fecha-${id}`} hoy={hoy} />
                  <Campo id={`cp-motivo-${id}`} etiqueta="Motivo" requerido>
                    <input id={`cp-motivo-${id}`} name="motivo" required minLength={5} className="campo" />
                  </Campo>
                  <label className="flex items-center gap-2 text-sm text-marca-700 sm:col-span-2">
                    <input type="checkbox" name="confirmo" className="h-4 w-4 accent-[var(--color-acento-600)]" />
                    Confirmo el cierre de la plaza
                  </label>
                </div>
              </Formulario>
            </Plegable>
          )}
        </div>
        </details>
      )}
    </li>
  )
}

type VersionUnidad = { id: string; nombre: string; tipo: string; padre_ref: string | null; sede: string | null; vigencia: unknown; fuente: string | null; certeza: string; nota: string | null }
type VersionPlaza = { id: string; ref: string; cargo_id: string; dotacion: number; estado: string; tipo_nomina: string | null; reporta_a_ref: string | null; vigencia: unknown; fuente: string | null }

export default async function UnidadPage({ params, searchParams }: PageProps<'/sistema/nucleo/organizacion/unidades/[ref]'>) {
  const [sesion, { ref }, sp] = await Promise.all([requerirPermiso('sistema:estructura'), params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(ref)) notFound()
  const supabase = await createClient()
  const org = supabase.schema('org')
  const hoy = hoyCaracas()
  const fecha = fechaDe(sp.fecha)

  const [e, catalogos, versiones, nombres] = await Promise.all([
    leerEstructura(supabase, fecha),
    leerCatalogos(supabase),
    todas<VersionUnidad>((a, b) =>
      org
        .from('unidad')
        .select('id, nombre, tipo, padre_ref, sede, vigencia, fuente, certeza, nota')
        .eq('ref', ref)
        .is('escenario_id', null)
        .order('vigencia')
        .range(a, b),
    ),
    leerNombres(supabase),
  ])
  if (!versiones.length) notFound()

  const nodo = e.nodos.get(ref)
  const ultima = versiones[versiones.length - 1]

  // Historial de plazas de la unidad y de las ocupaciones que ya terminaron.
  const [plazasHist, nombresUnidad] = await Promise.all([
    todas<VersionPlaza>((a, b) =>
      org
        .from('plaza')
        .select('id, ref, cargo_id, dotacion, estado, tipo_nomina, reporta_a_ref, vigencia, fuente')
        .eq('unidad_ref', ref)
        .is('escenario_id', null)
        .order('vigencia')
        .range(a, b),
    ),
    todas((a, b) => org.from('unidad').select('ref, nombre').is('escenario_id', null).range(a, b)),
  ])
  const refsPlazas = [...new Set(plazasHist.map((p) => p.ref))]
  const terminadas = refsPlazas.length
    ? await todas((a, b) =>
        org
          .from('ocupacion')
          .select('id, plaza_ref, empleado_id, tipo, vigencia, motivo')
          .in('plaza_ref', refsPlazas)
          .not('vigencia', 'cs', `[${fecha},${fecha}]`)
          .range(a, b),
      )
    : []
  const nombreDeUnidad = new Map(nombresUnidad.map((u) => [u.ref, u.nombre]))
  const cargoDe = (id: string) => e.cargos.get(id)?.nombre ?? 'Cargo'

  const editar = puede(sesion, 'sistema:estructura', 'editar') && fecha === hoy && Boolean(nodo)
  const crear = puede(sesion, 'sistema:estructura', 'crear') && fecha === hoy && Boolean(nodo)
  const asignar = (crear || editar) && Boolean(nodo)

  const u = nodo?.unidad
  const titulo = u?.nombre ?? ultima.nombre
  const subarbol = new Set<string>()
  const marcar = (n: Nodo) => {
    subarbol.add(n.unidad.ref)
    n.hijos.forEach(marcar)
  }
  if (nodo) marcar(nodo)
  const padres = aplanar(e.raices).filter((n) => !subarbol.has(n.unidad.ref))

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-ORG"
        titulo={titulo}
        migas={[{ etiqueta: 'Organigrama', href: '/sistema/nucleo/organizacion' }, { etiqueta: titulo }]}
        acciones={
          <Link href={`/sistema/nucleo/organizacion/plazas?ficha=unidad:${ref}`} className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-2.5 text-xs font-medium text-marca-800 hover:bg-marca-50">
            Ver su ficha
          </Link>
        }
      />

      {nodo && nodo.ruta.length > 0 && (
        <nav aria-label="Dónde está" className="mb-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-marca-500">
          {nodo.ruta.map((r) => (
            <span key={r} className="flex items-center gap-1.5">
              <Link href={`/sistema/nucleo/organizacion/unidades/${r}${fecha !== hoy ? `?fecha=${fecha}` : ''}`} className="hover:text-acento-700">
                {e.nodos.get(r)?.unidad.nombre}
              </Link>
              <span aria-hidden>›</span>
            </span>
          ))}
        </nav>
      )}

      <EncabezadoPagina
        rotulo={u ? etiquetaDe(catalogos.tipo_unidad, u.tipo) : 'Unidad'}
        titulo="Editor de la unidad"
        descripcion={
          nodo ? (
            <span className="flex flex-col gap-2">
              <Cifras t={nodo.total} />
              <span className="text-xs text-marca-500">
                {[
                  nodo.sedeEfectiva && `Sede: ${etiquetaDe(catalogos.sede, nodo.sedeEfectiva)}${u?.sede ? '' : ' (de la unidad superior)'}`,
                  u?.codigo_organigrama && `Organigrama ${u.codigo_organigrama}`,
                  `Vigente desde ${fmtFecha(rango(u?.vigencia).desde)}`,
                  nodo.total.plazas !== nodo.propio.plazas && `Totales con las ${nodo.hijos.length} unidades de abajo`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          ) : (
            `Esta unidad no está vigente el ${fmtFecha(fecha, true)}. Abajo está su historial.`
          )
        }
        acciones={u?.certeza === 'inferencia' ? <Insignia tono="ambar">Inferencia</Insignia> : undefined}
      />

      {sp.creada === '1' && (
        <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Unidad creada. Ahora puedes crearle plazas.
        </p>
      )}
      {fecha !== hoy && nodo && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Estás viendo la unidad como era el {fmtFecha(fecha, true)}. Para editarla,{' '}
          <Link href={`/sistema/nucleo/organizacion/unidades/${ref}`} className="font-medium underline">
            mírala a hoy
          </Link>
          .
        </p>
      )}
      {u?.nota && <p className="mb-5 text-sm text-pretty text-marca-600">{u.nota}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby="t-plazas" className="min-w-0">
          <h2 id="t-plazas" className="mb-3 text-sm font-semibold text-marca-800">
            Plazas {nodo && <span className="font-normal text-marca-500">· {nodo.plazas.length}</span>}
          </h2>
          {nodo && nodo.plazas.length > 0 ? (
            <ul className="space-y-3">
              {nodo.plazas.map((p) => (
                <TarjetaPlaza key={p.ref} p={p} e={e} nodo={nodo} catalogos={catalogos} hoy={hoy} editar={editar} asignar={asignar} />
              ))}
            </ul>
          ) : (
            <p className="tarjeta px-4 py-8 text-center text-sm text-marca-500">Esta unidad no tiene plazas propias.</p>
          )}
        </section>

        <aside className="min-w-0 space-y-4">
          {nodo && nodo.hijos.length > 0 && (
            <section className="tarjeta p-4">
              <h2 className="mb-2 text-sm font-semibold text-marca-800">Dependen de ella</h2>
              <ul className="space-y-1">
                {nodo.hijos.map((h) => (
                  <li key={h.unidad.ref}>
                    <Link
                      href={`/sistema/nucleo/organizacion/unidades/${h.unidad.ref}${fecha !== hoy ? `?fecha=${fecha}` : ''}`}
                      className="block rounded-lg px-2 py-1.5 text-sm hover:bg-marca-50"
                    >
                      <span className="font-medium text-marca-900">{h.unidad.nombre}</span>
                      <span className="block text-xs text-marca-500">
                        {h.total.dotacion} aprobada · {h.total.ocupadas} ocupada · {h.total.vacantes} vacantes
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(editar || crear) && nodo && u && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-marca-800">Cambios a la unidad</h2>
              {editar && (
                <Plegable titulo="Renombrar, cambiar tipo o mover">
                  <Formulario accion={editarUnidad} boton="Guardar versión nueva">
                    <input type="hidden" name="ref" value={u.ref} />
                    <div className="grid gap-3">
                      <Campo id="u-nombre" etiqueta="Nombre" requerido>
                        <input id="u-nombre" name="nombre" required minLength={3} defaultValue={u.nombre} className="campo" />
                      </Campo>
                      <Campo id="u-tipo" etiqueta="Tipo" requerido>
                        <select id="u-tipo" name="tipo" defaultValue={u.tipo} className="campo">
                          <Opciones lista={catalogos.tipo_unidad} />
                        </select>
                      </Campo>
                      <Campo id="u-padre" etiqueta="Depende de">
                        <select id="u-padre" name="padre_ref" defaultValue={u.padre_ref ?? ''} className="campo">
                          <option value="">Ninguna (arriba de todo)</option>
                          {padres.map((n) => (
                            <option key={n.unidad.ref} value={n.unidad.ref}>
                              {SANGRIA.repeat(n.profundidad)}
                              {n.unidad.nombre}
                            </option>
                          ))}
                        </select>
                      </Campo>
                      <Campo id="u-sede" etiqueta="Sede">
                        <select id="u-sede" name="sede" defaultValue={u.sede ?? ''} className="campo">
                          <Opciones lista={catalogos.sede} vacia="La de la unidad superior" />
                        </select>
                      </Campo>
                      <Campo id="u-codigo" etiqueta="Código del organigrama">
                        <input id="u-codigo" name="codigo" defaultValue={u.codigo_organigrama ?? ''} className="campo" placeholder="II-21-14-001" />
                      </Campo>
                      <Fecha id="u-fecha" hoy={hoy} />
                      {u.certeza === 'inferencia' && (
                        <label className="flex items-center gap-2 text-sm text-marca-700">
                          <input type="checkbox" name="confirmar" className="h-4 w-4 accent-[var(--color-acento-600)]" />
                          Confirmo estos datos (deja de ser inferencia)
                        </label>
                      )}
                    </div>
                  </Formulario>
                </Plegable>
              )}
              {crear && (
                <Plegable titulo="Crear una plaza aquí">
                  <Formulario accion={crearPlaza} boton="Crear plaza" pendiente="Creando…">
                    <input type="hidden" name="unidad_ref" value={u.ref} />
                    <div className="grid gap-3">
                      <Campo id="np-cargo" etiqueta="Cargo" requerido ayuda="¿No está? Créalo primero en Cargos.">
                        <select id="np-cargo" name="cargo_id" required defaultValue="" className="campo">
                          <option value="">Elige el cargo</option>
                          {[...e.cargos.values()]
                            .filter((c) => c.activo)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.nombre}
                              </option>
                            ))}
                        </select>
                      </Campo>
                      <Campo id="np-dot" etiqueta="Dotación aprobada" requerido>
                        <input id="np-dot" type="number" name="dotacion" min={1} max={500} required defaultValue={1} className="campo" />
                      </Campo>
                      <Campo id="np-rep" etiqueta="Reporta a">
                        <select id="np-rep" name="reporta_a_ref" defaultValue={nodo.plazas[0]?.ref ?? ''} className="campo">
                          <OpcionesReporta e={e} nodo={nodo} />
                        </select>
                      </Campo>
                      <Campo id="np-nom" etiqueta="Tipo de nómina">
                        <select id="np-nom" name="tipo_nomina" defaultValue="" className="campo">
                          <Opciones lista={catalogos.tipo_nomina} vacia="Sin definir" />
                        </select>
                      </Campo>
                      <Campo id="np-est" etiqueta="Estado">
                        <select id="np-est" name="estado" defaultValue="aprobada" className="campo">
                          <Opciones lista={catalogos.estado_plaza.filter((o) => o.clave !== 'cerrada')} />
                        </select>
                      </Campo>
                      <Campo id="np-sede" etiqueta="Sede propia">
                        <select id="np-sede" name="sede" defaultValue="" className="campo">
                          <Opciones lista={catalogos.sede} vacia="La de la unidad" />
                        </select>
                      </Campo>
                      <Fecha id="np-fecha" hoy={hoy} />
                    </div>
                  </Formulario>
                </Plegable>
              )}
              {crear && (
                <Plegable titulo="Crear una unidad que dependa de esta">
                  <Formulario accion={crearUnidad} boton="Crear unidad" pendiente="Creando…">
                    <input type="hidden" name="padre_ref" value={u.ref} />
                    <div className="grid gap-3">
                      <Campo id="nu-nombre" etiqueta="Nombre" requerido>
                        <input id="nu-nombre" name="nombre" required minLength={3} className="campo" placeholder="Coordinación de…" />
                      </Campo>
                      <Campo id="nu-tipo" etiqueta="Tipo" requerido>
                        <select id="nu-tipo" name="tipo" defaultValue="coordinacion" className="campo">
                          <Opciones lista={catalogos.tipo_unidad} />
                        </select>
                      </Campo>
                      <Campo id="nu-sede" etiqueta="Sede">
                        <select id="nu-sede" name="sede" defaultValue="" className="campo">
                          <Opciones lista={catalogos.sede} vacia="La de esta unidad" />
                        </select>
                      </Campo>
                      <Fecha id="nu-fecha" hoy={hoy} />
                    </div>
                  </Formulario>
                </Plegable>
              )}
              {editar && (
                <Plegable titulo="Cerrar la unidad" peligro>
                  <Formulario accion={cerrarUnidad} boton="Cerrar la unidad" tono="peligro" pendiente="Cerrando…">
                    <input type="hidden" name="ref" value={u.ref} />
                    <p className="mb-3 text-xs text-marca-500">
                      Solo se cierra una unidad sin plazas y sin unidades que dependan de ella. No se borra: deja de regir desde la fecha.
                    </p>
                    <div className="grid gap-3">
                      <Fecha id="cu-fecha" hoy={hoy} />
                      <Campo id="cu-motivo" etiqueta="Motivo" requerido>
                        <input id="cu-motivo" name="motivo" required minLength={5} className="campo" />
                      </Campo>
                      <label className="flex items-center gap-2 text-sm text-marca-700">
                        <input type="checkbox" name="confirmo" className="h-4 w-4 accent-[var(--color-acento-600)]" />
                        Confirmo el cierre de la unidad
                      </label>
                    </div>
                  </Formulario>
                </Plegable>
              )}
            </section>
          )}
        </aside>
      </div>

      <section aria-labelledby="t-historial" className="mt-10">
        <h2 id="t-historial" className="mb-1 text-sm font-semibold text-marca-800">
          Historial
        </h2>
        <p className="mb-3 text-xs text-marca-500">
          Nada se borra: cada versión dice desde y hasta cuándo rigió. «Reemplazada el mismo día» es una versión que se corrigió el día en
          que nacía.
        </p>
        <div className="tarjeta overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Versiones de la unidad</caption>
            <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
              <tr>
                <th className="px-3 py-2 font-medium">Vigencia</th>
                <th className="px-3 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Depende de</th>
                <th className="px-3 py-2 font-medium">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-marca-100">
              {versiones.map((v) => (
                <tr key={v.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-marca-700">
                    <Vigencia v={v.vigencia} />
                  </td>
                  <td className="px-3 py-2 text-marca-900">{v.nombre}</td>
                  <td className="px-3 py-2 text-marca-600">{etiquetaDe(catalogos.tipo_unidad, v.tipo)}</td>
                  <td className="px-3 py-2 text-marca-600">{v.padre_ref ? (nombreDeUnidad.get(v.padre_ref) ?? '—') : 'Ninguna'}</td>
                  <td className="max-w-[260px] truncate px-3 py-2 text-xs text-marca-500" title={fuenteLegible(v.fuente) ?? undefined}>
                    {fuenteLegible(v.fuente) ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {plazasHist.length > 0 && (
          <div className="tarjeta mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Versiones de las plazas</caption>
              <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Vigencia</th>
                  <th className="px-3 py-2 font-medium">Plaza</th>
                  <th className="px-3 py-2 font-medium">Dotación</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Nómina</th>
                  <th className="px-3 py-2 font-medium">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marca-100">
                {plazasHist.map((v) => (
                  <tr key={v.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-marca-700">
                      <Vigencia v={v.vigencia} />
                    </td>
                    <td className="px-3 py-2 text-marca-900">{cargoDe(v.cargo_id)}</td>
                    <td className="px-3 py-2 tabular-nums">{v.dotacion}</td>
                    <td className="px-3 py-2 text-marca-600">{etiquetaDe(catalogos.estado_plaza, v.estado)}</td>
                    <td className="px-3 py-2 text-marca-600">{etiquetaDe(catalogos.tipo_nomina, v.tipo_nomina)}</td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-xs text-marca-500" title={fuenteLegible(v.fuente) ?? undefined}>
                      {fuenteLegible(v.fuente) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {terminadas.length > 0 && (
          <div className="tarjeta mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="px-3 pt-3 text-left text-xs font-semibold text-marca-700">Ocupaciones que no rigen en esta fecha</caption>
              <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Vigencia</th>
                  <th className="px-3 py-2 font-medium">Persona</th>
                  <th className="px-3 py-2 font-medium">Plaza</th>
                  <th className="px-3 py-2 font-medium">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-marca-100">
                {terminadas.map((o) => {
                  const plaza = plazasHist.find((p) => p.ref === o.plaza_ref)
                  return (
                    <tr key={o.id}>
                      <td className="px-3 py-2 whitespace-nowrap text-marca-700">
                        <Vigencia v={o.vigencia} />
                      </td>
                      <td className="px-3 py-2 text-marca-900">{nombres.get(o.empleado_id)?.nombre ?? 'Fuera del padrón activo'}</td>
                      <td className="px-3 py-2 text-marca-600">{plaza ? cargoDe(plaza.cargo_id) : '—'}</td>
                      <td className="px-3 py-2 text-xs text-marca-500">{o.motivo ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}

function Vigencia({ v }: { v: unknown }) {
  const r = rango(v)
  if (r.vacia) return <span className="text-marca-400">Reemplazada el mismo día</span>
  return (
    <>
      {fmtFecha(r.desde)} → {r.hasta ? fmtFecha(r.hasta) : <span className="font-medium text-emerald-700">vigente</span>}
    </>
  )
}
