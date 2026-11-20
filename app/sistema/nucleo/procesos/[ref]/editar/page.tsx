import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAlerta, IconoAtras, IconoCheck, IconoEditar } from '@/components/iconos'
import { comparar, normalizarFicha } from '@/components/sistema/procesos/comun'
import { COLUMNAS_PROCESO, leerCatalogo, leerPlazas, leerProcesos, leerSolicitudes, type FilaProceso } from '@/components/sistema/procesos/datos'
import { EditorBorrador } from '@/components/sistema/procesos/editor-borrador'
import { InsigniaVersion } from '@/components/sistema/procesos/piezas'
import { Diferencias, FichaVista, LineaSolicitud } from '@/components/sistema/procesos/vistas'
import { abrirBorrador } from '@/app/sistema/nucleo/procesos/acciones'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Editar proceso · Plataforma Iberia' }

const RUTA = '/sistema/nucleo/procesos'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * El borrador de un proceso. Si está en borrador, se edita; si ya se envió, se
 * lee junto con su solicitud y los pasos de la ruta. La versión vigente no se
 * edita nunca: lo garantiza un trigger en la base.
 */
export default async function EditarProcesoPage({ params, searchParams }: PageProps<'/sistema/nucleo/procesos/[ref]/editar'>) {
  const [sesion, { ref }, consulta] = await Promise.all([requerirPermiso('sistema:procesos', 'editar'), params, searchParams])
  if (!UUID.test(ref)) notFound()
  const supabase = await createClient()

  const [{ data: filas }, { vigentes }, plazas, catalogo] = await Promise.all([
    supabase.schema('sgc').from('proceso').select(COLUMNAS_PROCESO).eq('ref', ref).is('escenario_id', null).order('version', { ascending: false }),
    leerProcesos(supabase),
    leerPlazas(supabase),
    leerCatalogo(supabase),
  ])
  const versiones = (filas ?? []) as unknown as FilaProceso[]
  if (!versiones.length) notFound()
  const vigente = versiones.find((v) => v.estado === 'vigente') ?? null
  const b = versiones.find((v) => v.estado === 'borrador' || v.estado === 'en_revision') ?? null

  const solicitudes = b ? await leerSolicitudes(supabase, 'proceso', [b.id]) : []
  const porRef = new Map(vigentes.map((v) => [v.ref, v]))
  const etiquetaPlaza = new Map(plazas.map((x) => [x.ref, x.etiqueta]))
  const nombreDe = (tipo: 'proceso' | 'plaza', r: string | null) =>
    !r ? '—' : tipo === 'proceso' ? (porRef.get(r)?.nombre ?? 'Proceso no vigente') : (etiquetaPlaza.get(r) ?? 'Plaza sin describir')

  const encabezado = (
    <>
      <Link href={`${RUTA}/${ref}`} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-marca-500 hover:text-acento-700">
        <IconoAtras className="h-4 w-4" />
        Volver a la ficha
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="rotulo mb-2">{b?.estado === 'en_revision' ? 'En revisión' : 'Borrador'}</p>
          <h1 className="text-2xl font-bold tracking-tight text-marca-900">{(b ?? vigente ?? versiones[0]).nombre}</h1>
          {b && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-marca-500">
              <InsigniaVersion estado={b.estado} version={b.version} />
              {vigente ? <span>La vigente es la versión {vigente.version} y sigue rigiendo hasta que esta se apruebe.</span> : <span>Proceso nuevo: no tiene versión vigente.</span>}
            </div>
          )}
        </div>
      </div>
    </>
  )

  const avisos = (
    <>
      {typeof consulta.error === 'string' && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-acento-200 bg-acento-50 px-4 py-3 text-sm text-acento-800">
          <IconoAlerta className="mt-0.5 h-4 w-4 shrink-0" />
          {consulta.error}
        </p>
      )}
      {(consulta.enviado === '1' || consulta.creado === '1' || consulta.movido === '1') && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <IconoCheck className="mt-0.5 h-4 w-4 shrink-0" />
          {consulta.enviado === '1'
            ? 'Enviado a revisión. Abajo está la solicitud con sus pasos; la decide la bandeja de quien firma.'
            : consulta.creado === '1'
              ? 'Proceso creado en borrador. Completa su ficha y envíalo a revisión.'
              : 'Movido en el borrador. Revisa el cambio y envíalo a revisión.'}
        </p>
      )}
    </>
  )

  if (!b) {
    return (
      <>
        {encabezado}
        {avisos}
        <div className="tarjeta p-6">
          <p className="text-sm text-marca-700">Este proceso no tiene un borrador abierto. Editar abre uno nuevo a partir de la versión vigente.</p>
          {vigente && (
            <form action={abrirBorrador} className="mt-4">
              <input type="hidden" name="ref" value={ref} />
              <button type="submit" className="btn-acento h-10">
                <IconoEditar className="h-4 w-4" />
                Abrir un borrador
              </button>
            </form>
          )}
        </div>
      </>
    )
  }

  const cambios = vigente ? comparar(vigente, b, nombreDe) : null
  const padres = vigentes
    .filter((v) => v.nivel === b.nivel - 1)
    .map((v) => ({ valor: v.ref, etiqueta: `${v.codigo_sgc ?? v.codigo_informe ?? ''} ${v.nombre}`.trim() }))
    .sort((a, c) => a.etiqueta.localeCompare(c.etiqueta, 'es'))

  return (
    <>
      {encabezado}
      {avisos}

      {cambios && (
        <div className="mb-6">
          <Diferencias cambios={cambios} />
        </div>
      )}

      {solicitudes.length > 0 && (
        <section className="tarjeta mb-6 p-5">
          <h2 className="mb-3 text-sm font-semibold text-marca-900">Aprobación</h2>
          <div className="space-y-3">
            {solicitudes.map((s) => (
              <LineaSolicitud key={s.id} solicitud={s} />
            ))}
          </div>
          {b.estado === 'borrador' && solicitudes[0]?.estado === 'devuelta' && (
            <p className="mt-3 text-sm text-amber-900">La revisión lo devolvió: corrige lo que dice el comentario y vuelve a enviarlo.</p>
          )}
        </section>
      )}

      {b.estado === 'borrador' ? (
        <EditorBorrador
          datos={{
            id: b.id,
            ref: b.ref,
            nivel: b.nivel,
            nombre: b.nombre,
            tipo: b.tipo,
            estado_operativo: b.estado_operativo,
            codigo_sgc: b.codigo_sgc,
            generacion: b.generacion,
            codigo_informe: b.codigo_informe,
            padre_ref: b.padre_ref,
            dueno_plaza_ref: b.dueno_plaza_ref,
            dueno_texto: b.dueno_texto,
            area_texto: b.area_texto,
            nota: b.nota,
          }}
          fichaInicial={normalizarFicha(b.ficha)}
          tipos={Object.entries(catalogo.tipos).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
          estados={Object.entries(catalogo.estados).map(([valor, etiqueta]) => ({ valor, etiqueta }))}
          plazas={plazas.map((x) => ({ valor: x.ref, etiqueta: x.etiqueta }))}
          padres={padres}
          puedeDescartar={puede(sesion, 'sistema:procesos', 'eliminar')}
        />
      ) : (
        <>
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Está en revisión: nadie lo edita mientras la ruta decide. Si lo devuelven, vuelve a ser borrador.
          </p>
          <FichaVista ficha={normalizarFicha(b.ficha)} />
        </>
      )}
    </>
  )
}
