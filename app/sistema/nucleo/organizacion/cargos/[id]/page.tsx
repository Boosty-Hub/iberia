import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras } from '@/components/iconos'
import { etiquetaDe, hoyCaracas, leerCatalogos, leerEstructura } from '@/components/sistema/organizacion/datos'
import { Formulario } from '@/components/sistema/organizacion/formulario'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { editarCargo } from '../../acciones'

export const metadata: Metadata = { title: 'Cargo · Organización' }

/** Un cargo: sus datos editables y las plazas donde existe hoy. El costo de referencia vive en Dotación (perímetro de nómina). */
export default async function CargoPage({ params, searchParams }: PageProps<'/sistema/nucleo/organizacion/cargos/[id]'>) {
  const [sesion, { id }, sp] = await Promise.all([requerirPermiso('sistema:estructura'), params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data: cargo } = await supabase
    .schema('org')
    .from('cargo')
    .select('id, clave, nombre, familia, nivel, sinonimos, proposito, activo, creado_en')
    .eq('id', id)
    .maybeSingle()
  if (!cargo) notFound()

  const [e, catalogos] = await Promise.all([leerEstructura(supabase, hoyCaracas()), leerCatalogos(supabase)])
  const plazas = [...e.plazas.values()].filter((p) => p.cargo_id === id)
  const editar = puede(sesion, 'sistema:estructura', 'editar')

  return (
    <>
      <Link href="/sistema/nucleo/organizacion/cargos" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Cargos
      </Link>
      <EncabezadoPagina
        rotulo={etiquetaDe(catalogos.familia_cargo, cargo.familia, 'Cargo')}
        titulo={cargo.nombre}
        descripcion={cargo.proposito ?? 'Sin propósito escrito todavía.'}
        acciones={!cargo.activo ? <Insignia>Inactivo</Insignia> : undefined}
      />
      {sp.creado === '1' && (
        <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Cargo creado. Ya puedes usarlo al crear una plaza.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <h2 className="mb-3 text-sm font-semibold text-marca-800">
            Plazas vigentes hoy <span className="font-normal text-marca-500">· {plazas.length}</span>
          </h2>
          {plazas.length ? (
            <ul className="tarjeta divide-y divide-marca-100">
              {plazas.map((p) => (
                <li key={p.ref} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <Link href={`/sistema/nucleo/organizacion/unidades/${p.unidad_ref}`} className="font-medium text-marca-900 hover:text-acento-700">
                    {e.unidades.get(p.unidad_ref)?.nombre}
                  </Link>
                  <span className="text-xs text-marca-500">
                    {p.dotacion} aprobada · {p.titulares} ocupada{p.vacantes ? ` · ${p.vacantes} vacante(s)` : ''}
                    {p.porEncima ? ` · ${p.porEncima} por encima` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tarjeta px-4 py-8 text-center text-sm text-marca-500">Este cargo no tiene plazas vigentes hoy.</p>
          )}
          {(cargo.sinonimos ?? []).length > 0 && (
            <>
              <h2 className="mt-6 mb-2 text-sm font-semibold text-marca-800">Sinónimos</h2>
              <ul className="flex flex-wrap gap-1.5">
                {(cargo.sinonimos ?? []).map((s) => (
                  <li key={s}>
                    <Insignia>{s}</Insignia>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {editar && (
          <section className="tarjeta min-w-0 p-4 sm:p-5">
            <h2 className="text-sm font-semibold text-marca-800">Editar el cargo</h2>
            <p className="mt-1 mb-4 text-xs text-marca-500">Cambio directo: queda en la auditoría con quién y cuándo.</p>
            <Formulario accion={editarCargo} boton="Guardar">
              <input type="hidden" name="id" value={cargo.id} />
              <div className="grid gap-3">
                <div>
                  <label htmlFor="ec-nombre" className="etiqueta">
                    Nombre <span className="text-acento-600">*</span>
                  </label>
                  <input id="ec-nombre" name="nombre" required minLength={3} defaultValue={cargo.nombre} className="campo" />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
                  <div>
                    <label htmlFor="ec-fam" className="etiqueta">
                      Familia
                    </label>
                    <select id="ec-fam" name="familia" defaultValue={cargo.familia ?? ''} className="campo">
                      <option value="">Sin familia</option>
                      {catalogos.familia_cargo
                        .filter((o) => o.activo || o.clave === cargo.familia)
                        .map((o) => (
                          <option key={o.clave} value={o.clave}>
                            {o.etiqueta}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ec-nivel" className="etiqueta">
                      Nivel
                    </label>
                    <input id="ec-nivel" type="number" name="nivel" min={0} max={20} defaultValue={cargo.nivel ?? ''} className="campo" />
                  </div>
                </div>
                <div>
                  <label htmlFor="ec-sin" className="etiqueta">
                    Sinónimos
                  </label>
                  <textarea id="ec-sin" name="sinonimos" rows={4} defaultValue={(cargo.sinonimos ?? []).join('\n')} className="campo" />
                  <p className="mt-1 text-xs text-marca-500">Uno por línea.</p>
                </div>
                <div>
                  <label htmlFor="ec-prop" className="etiqueta">
                    Propósito
                  </label>
                  <textarea id="ec-prop" name="proposito" rows={4} defaultValue={cargo.proposito ?? ''} className="campo" />
                </div>
                <label className="flex items-center gap-2 text-sm text-marca-700">
                  <input type="checkbox" name="activo" defaultChecked={cargo.activo} className="h-4 w-4 accent-[var(--color-acento-600)]" />
                  Activo (se puede usar en plazas nuevas)
                </label>
              </div>
            </Formulario>
          </section>
        )}
      </div>
    </>
  )
}
