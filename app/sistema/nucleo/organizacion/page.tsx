import type { Metadata } from 'next'
import Link from 'next/link'
import { ArbolUnidad, Cifras } from '@/components/sistema/organizacion/arbol'
import { fechaDe, filtrar, fmtFecha, hoyCaracas, leerCatalogos, leerEstructura } from '@/components/sistema/organizacion/datos'
import { EncabezadoPagina, Insignia, Metrica } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Estructura · Organización' }

/**
 * El organigrama vivo (NUC-ORG): unidades, plazas con su dotación y quién las
 * ocupa, **a la fecha que se elija**. Los filtros dejan ver solo una sede, un
 * tipo de nómina, un estado de plaza o solo lo vacante, y los totales de cada
 * unidad suman su subárbol con los mismos filtros.
 */
export default async function OrganizacionPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:estructura'), searchParams])
  const supabase = await createClient()
  const fecha = fechaDe(sp.fecha)
  const hoy = hoyCaracas()
  const sede = typeof sp.sede === 'string' ? sp.sede : ''
  const nomina = typeof sp.nomina === 'string' ? sp.nomina : ''
  const estado = typeof sp.estado === 'string' ? sp.estado : ''
  const soloVacantes = sp.vacantes === '1'
  const abrirTodo = sp.abrir === 'todo'
  const conFiltros = Boolean(sede || nomina || estado || soloVacantes)

  const [estructura, catalogos, conciliacion] = await Promise.all([
    leerEstructura(supabase, fecha),
    leerCatalogos(supabase),
    supabase.schema('control').from('conciliacion').select('id', { count: 'exact', head: true }).eq('estado', 'abierto').eq('modulo', 'NUC-ORG'),
  ])

  const visibles = conFiltros
    ? filtrar(estructura, (p) => {
        if (sede && (p.sedeEfectiva ?? 'sin') !== sede) return false
        if (nomina && (p.tipo_nomina ?? 'sin') !== nomina) return false
        if (estado && p.estado !== estado) return false
        if (soloVacantes && p.vacantes === 0) return false
        return true
      })
    : null
  const raices = visibles ? estructura.raices.filter((r) => visibles.unidades.has(r.unidad.ref)) : estructura.raices
  const total = raices.reduce(
    (t, r) => {
      const x = visibles ? r.visibleTotal : r.total
      return {
        plazas: t.plazas + x.plazas,
        dotacion: t.dotacion + x.dotacion,
        ocupadas: t.ocupadas + x.ocupadas,
        vacantes: t.vacantes + x.vacantes,
        porEncima: t.porEncima + x.porEncima,
      }
    },
    { plazas: 0, dotacion: 0, ocupadas: 0, vacantes: 0, porEncima: 0 },
  )
  const inferidas = [...estructura.unidades.values()].filter((u) => u.certeza === 'inferencia').length

  const consulta = (extra: Record<string, string>) => {
    const q = new URLSearchParams()
    if (fecha !== hoy) q.set('fecha', fecha)
    if (sede) q.set('sede', sede)
    if (nomina) q.set('nomina', nomina)
    if (estado) q.set('estado', estado)
    if (soloVacantes) q.set('vacantes', '1')
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v)
      else q.delete(k)
    }
    const s = q.toString()
    return `/sistema/nucleo/organizacion${s ? `?${s}` : ''}`
  }

  return (
    <>
      <EncabezadoPagina
        rotulo="Organización"
        titulo="Estructura"
        descripcion={
          <>
            Las unidades de Iberia con sus plazas, la dotación aprobada y quién las ocupa, como regían el{' '}
            <strong className="font-semibold text-marca-800">{fmtFecha(fecha, true)}</strong>. Cada cambio queda con su fecha: la
            estructura de cualquier día se puede volver a ver.
          </>
        }
        acciones={
          <>
            <Link href="/sistema/nucleo/organizacion/cargos" className="btn-neutro h-10">
              Cargos
            </Link>
            {puede(sesion, 'sistema:dotacion') && (
              <Link href="/sistema/nucleo/organizacion/dotacion" className="btn-neutro h-10">
                Dotación
              </Link>
            )}
            <Link href="/sistema/nucleo/conciliacion" className="btn-neutro h-10">
              Conciliación
              {(conciliacion.count ?? 0) > 0 && <Insignia tono="ambar" className="py-0.5">{conciliacion.count}</Insignia>}
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica valor={visibles ? visibles.unidades.size : estructura.unidades.size} etiqueta="Unidades" />
        <Metrica valor={total.dotacion} etiqueta="Dotación aprobada" sufijo={`en ${total.plazas} plazas`} />
        <Metrica valor={total.ocupadas} etiqueta="Ocupada" />
        <Metrica valor={total.vacantes} etiqueta="Vacantes" sufijo={total.porEncima ? `· ${total.porEncima} por encima` : undefined} />
      </div>

      <form method="get" className="tarjeta mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="lg:col-span-1">
          <label htmlFor="f-fecha" className="etiqueta">
            Estructura al
          </label>
          <input id="f-fecha" type="date" name="fecha" defaultValue={fecha} className="campo" />
        </div>
        <div>
          <label htmlFor="f-sede" className="etiqueta">
            Sede
          </label>
          <select id="f-sede" name="sede" defaultValue={sede} className="campo">
            <option value="">Todas</option>
            {catalogos.sede.map((o) => (
              <option key={o.clave} value={o.clave}>
                {o.etiqueta}
              </option>
            ))}
            <option value="sin">Sin sede definida</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-nomina" className="etiqueta">
            Tipo de nómina
          </label>
          <select id="f-nomina" name="nomina" defaultValue={nomina} className="campo">
            <option value="">Todos</option>
            {catalogos.tipo_nomina.map((o) => (
              <option key={o.clave} value={o.clave}>
                {o.etiqueta}
              </option>
            ))}
            <option value="sin">Sin definir</option>
          </select>
        </div>
        <div>
          <label htmlFor="f-estado" className="etiqueta">
            Estado de la plaza
          </label>
          <select id="f-estado" name="estado" defaultValue={estado} className="campo">
            <option value="">Todos</option>
            {catalogos.estado_plaza
              .filter((o) => o.clave !== 'cerrada')
              .map((o) => (
                <option key={o.clave} value={o.clave}>
                  {o.etiqueta}
                </option>
              ))}
          </select>
        </div>
        <label className="flex min-h-10 items-center gap-2 text-sm text-marca-700 lg:pb-2">
          <input type="checkbox" name="vacantes" value="1" defaultChecked={soloVacantes} className="h-4 w-4 accent-[var(--color-acento-600)]" />
          Solo con vacantes
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primario h-10 flex-1">
            Aplicar
          </button>
          {(conFiltros || fecha !== hoy) && (
            <Link href="/sistema/nucleo/organizacion" className="btn-neutro h-10">
              Limpiar
            </Link>
          )}
        </div>
      </form>

      {fecha !== hoy && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Estás viendo la estructura del {fmtFecha(fecha, true)}, no la de hoy.
        </p>
      )}

      <section className="tarjeta p-2 sm:p-4" aria-labelledby="titulo-arbol">
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-1 pb-3">
          <h2 id="titulo-arbol" className="text-sm font-semibold text-marca-800">
            Organigrama
            {conFiltros && <span className="ml-2 font-normal text-marca-500">· filtrado</span>}
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="hidden text-marca-500 sm:inline">
              <Cifras t={total} compacto />
            </span>
            <Link href={consulta({ abrir: abrirTodo ? '' : 'todo' })} className="font-medium text-acento-700 hover:underline">
              {abrirTodo ? 'Plegar' : 'Desplegar todo'}
            </Link>
          </div>
        </div>
        {raices.length === 0 ? (
          <p className="px-3 py-10 text-center text-sm text-marca-500">
            {conFiltros ? 'Ninguna plaza cumple esos filtros.' : 'No hay unidades vigentes en esa fecha.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {raices.map((r) => (
              <ArbolUnidad
                key={r.unidad.ref}
                nodo={r}
                catalogos={catalogos}
                visibles={visibles}
                abrirHasta={abrirTodo ? 99 : conFiltros ? 5 : 3}
                fecha={fecha !== hoy ? fecha : ''}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-xs text-pretty text-marca-500">
        «Inferencia» marca lo que la carga dedujo de los organigramas sin poder confirmarlo ({inferidas} unidades en esta fecha): se confirma al
        editar la unidad o la plaza. «Por encima» es gente registrada de más sobre la dotación aprobada; no es un error de carga, es un
        hallazgo. Del padrón solo se muestra el nombre: nada de contacto.
      </p>
    </>
  )
}
