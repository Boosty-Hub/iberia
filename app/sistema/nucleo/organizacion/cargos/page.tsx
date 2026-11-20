import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoAtras } from '@/components/iconos'
import { etiquetaDe, hoyCaracas, leerCatalogos, todas, VIGENTE_EN } from '@/components/sistema/organizacion/datos'
import { Formulario, Plegable } from '@/components/sistema/organizacion/formulario'
import { EncabezadoPagina, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { crearCargo } from '../acciones'

export const metadata: Metadata = { title: 'Cargos · Organización' }

/**
 * El catálogo de cargos: un cargo es el «qué» (Analista de Nómina); la plaza es
 * el «dónde y cuántos». Los sinónimos guardan los otros nombres del mismo cargo
 * —el del padrón, el de JD Edwards, el de un organigrama viejo— para que la
 * conciliación case por cualquiera de ellos.
 */
export default async function CargosPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/cargos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const supabase = await createClient()
  const org = supabase.schema('org')
  const hoy = hoyCaracas()
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const familia = typeof sp.familia === 'string' ? sp.familia : ''
  const estado = sp.estado === 'inactivos' || sp.estado === 'todos' ? sp.estado : 'activos'

  const [cargos, plazas, ocupaciones, catalogos] = await Promise.all([
    todas((a, b) => org.from('cargo').select('id, nombre, familia, sinonimos, activo, proposito').order('nombre').range(a, b)),
    todas((a, b) => org.from('plaza').select('ref, cargo_id, dotacion').is('escenario_id', null).filter('vigencia', 'cs', VIGENTE_EN(hoy)).range(a, b)),
    todas((a, b) => org.from('ocupacion').select('plaza_ref').filter('vigencia', 'cs', VIGENTE_EN(hoy)).range(a, b)),
    leerCatalogos(supabase),
  ])

  const cargoDePlaza = new Map(plazas.map((p) => [p.ref, p.cargo_id]))
  const nPlazas = new Map<string, number>()
  const nDotacion = new Map<string, number>()
  for (const p of plazas) {
    nPlazas.set(p.cargo_id, (nPlazas.get(p.cargo_id) ?? 0) + 1)
    nDotacion.set(p.cargo_id, (nDotacion.get(p.cargo_id) ?? 0) + p.dotacion)
  }
  const nOcupantes = new Map<string, number>()
  for (const o of ocupaciones) {
    const c = cargoDePlaza.get(o.plaza_ref)
    if (c) nOcupantes.set(c, (nOcupantes.get(c) ?? 0) + 1)
  }

  const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const lista = cargos.filter((c) => {
    if (estado === 'activos' && !c.activo) return false
    if (estado === 'inactivos' && c.activo) return false
    if (familia && (c.familia ?? 'sin') !== familia) return false
    if (q && !plano([c.nombre, ...(c.sinonimos ?? [])].join(' ')).includes(plano(q))) return false
    return true
  })
  const sinPlaza = cargos.filter((c) => c.activo && !nPlazas.get(c.id)).length

  return (
    <>
      <Link href="/sistema/nucleo/organizacion" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Estructura
      </Link>
      <EncabezadoPagina
        rotulo="Organización"
        titulo="Cargos"
        descripcion={`${cargos.length} cargos en el catálogo; ${sinPlaza} activos no tienen plaza vigente hoy. Los sinónimos son los otros nombres con que aparece el mismo cargo en el padrón, en JD Edwards o en organigramas anteriores.`}
      />

      <form method="get" className="tarjeta mb-5 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_200px_160px_auto] sm:items-end">
        <div>
          <label htmlFor="c-q" className="etiqueta">
            Buscar
          </label>
          <input id="c-q" name="q" defaultValue={q} className="campo" placeholder="Nombre o sinónimo" />
        </div>
        <div>
          <label htmlFor="c-fam" className="etiqueta">
            Familia
          </label>
          <select id="c-fam" name="familia" defaultValue={familia} className="campo">
            <option value="">Todas</option>
            {catalogos.familia_cargo.map((o) => (
              <option key={o.clave} value={o.clave}>
                {o.etiqueta}
              </option>
            ))}
            <option value="sin">Sin familia</option>
          </select>
        </div>
        <div>
          <label htmlFor="c-est" className="etiqueta">
            Estado
          </label>
          <select id="c-est" name="estado" defaultValue={estado} className="campo">
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <button type="submit" className="btn-primario h-10">
          Filtrar
        </button>
      </form>

      {puede(sesion, 'sistema:estructura', 'crear') && (
        <Plegable titulo="Crear un cargo" className="mb-5">
          <Formulario accion={crearCargo} boton="Crear cargo" pendiente="Creando…">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="nc-nombre" className="etiqueta">
                  Nombre <span className="text-acento-600">*</span>
                </label>
                <input id="nc-nombre" name="nombre" required minLength={3} className="campo" placeholder="Analista de Costos" />
              </div>
              <div>
                <label htmlFor="nc-fam" className="etiqueta">
                  Familia
                </label>
                <select id="nc-fam" name="familia" defaultValue="" className="campo">
                  <option value="">Sin familia</option>
                  {catalogos.familia_cargo
                    .filter((o) => o.activo)
                    .map((o) => (
                      <option key={o.clave} value={o.clave}>
                        {o.etiqueta}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="nc-sin" className="etiqueta">
                  Sinónimos
                </label>
                <textarea id="nc-sin" name="sinonimos" rows={3} className="campo" placeholder="Uno por línea" />
              </div>
              <div>
                <label htmlFor="nc-prop" className="etiqueta">
                  Propósito
                </label>
                <textarea id="nc-prop" name="proposito" rows={3} className="campo" placeholder="Para qué existe el cargo, en una o dos líneas" />
              </div>
            </div>
          </Formulario>
        </Plegable>
      )}

      <div className="tarjeta overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <caption className="sr-only">Catálogo de cargos</caption>
          <thead className="border-b border-marca-200 bg-marca-50 text-left text-xs text-marca-600">
            <tr>
              <th className="px-4 py-2.5 font-medium">Cargo</th>
              <th className="px-3 py-2.5 font-medium">Familia</th>
              <th className="px-3 py-2.5 font-medium">Sinónimos</th>
              <th className="px-3 py-2.5 text-right font-medium">Plazas</th>
              <th className="px-3 py-2.5 text-right font-medium">Dotación</th>
              <th className="px-4 py-2.5 text-right font-medium">Ocupantes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-marca-100">
            {lista.map((c) => (
              <tr key={c.id} className="hover:bg-marca-50/50">
                <td className="px-4 py-2.5">
                  <Link href={`/sistema/nucleo/organizacion/cargos/${c.id}`} className="font-medium text-marca-900 hover:text-acento-700">
                    {c.nombre}
                  </Link>
                  {!c.activo && (
                    <Insignia className="ml-2 py-0.5" tono="neutro">
                      Inactivo
                    </Insignia>
                  )}
                </td>
                <td className="px-3 py-2.5 text-marca-600">{etiquetaDe(catalogos.familia_cargo, c.familia, '—')}</td>
                <td className="px-3 py-2.5 text-xs text-marca-500">
                  {(c.sinonimos ?? []).length ? (c.sinonimos ?? []).slice(0, 3).join(' · ') + ((c.sinonimos ?? []).length > 3 ? ` · +${(c.sinonimos ?? []).length - 3}` : '') : '—'}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nPlazas.get(c.id) ?? 0}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{nDotacion.get(c.id) ?? 0}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{nOcupantes.get(c.id) ?? 0}</td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-marca-500">
                  Ningún cargo coincide.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
