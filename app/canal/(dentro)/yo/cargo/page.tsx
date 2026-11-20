import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoAtras, IconoDocumento, IconoOrganigrama, IconoProcesos } from '@/components/iconos'
import { obtenerSesion, puede } from '@/lib/auth'
import { legible } from '@/lib/certificado'
import { requerirEmpleado } from '@/lib/canal'
import { leerMiCargo, leerMisDocumentos, leerMisProcesos } from '@/lib/mi-cargo'
import { hrefFicha } from '@/lib/plataforma/colaboracion'
import { fechaCorta } from '@/lib/plataforma/formato'

export const metadata: Metadata = { title: 'Mi cargo' }

/**
 * «Mi cargo»: mi plaza y mi cargo, mi unidad, a quién le reporto, los procesos
 * de mi cargo y de mi unidad, y los documentos vigentes que me tocan. Sale de la
 * estructura y del SGC con funciones que solo responden por quien mira. Quien
 * además puede abrir procesos o documentos en la plataforma tiene el enlace.
 */
export default async function MiCargoPage() {
  await requerirEmpleado()
  const [sesion, cargo, procesos, documentos] = await Promise.all([obtenerSesion(), leerMiCargo(), leerMisProcesos(), leerMisDocumentos()])
  const veProcesos = puede(sesion, 'sistema:procesos')
  const veDocumentos = puede(sesion, 'sistema:documentos')
  const plazas = cargo?.plazas ?? []
  const deMiCargo = procesos.filter((p) => p.relacion === 'tu_cargo')
  const deMiUnidad = procesos.filter((p) => p.relacion !== 'tu_cargo')
  // En el teléfono, los primeros: un proceso grande trae más de cien documentos.
  const TOPE_DOCUMENTOS = 15
  const docsVisibles = documentos.slice(0, TOPE_DOCUMENTOS)

  return (
    <>
      <Link href="/canal/yo" className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-marca-500 active:text-marca-800">
        <IconoAtras className="h-4 w-4" />
        Mi perfil
      </Link>
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">Mi cargo</h1>
        <p className="mt-1 text-[13px] text-marca-500">Tu lugar en la estructura de Iberia y lo que tu puesto debe conocer.</p>
      </header>

      {plazas.length === 0 ? (
        <section className="tarjeta-canal mb-4 px-5 py-5">
          <h2 className="text-[15px] font-semibold text-marca-900">{cargo?.cargo_padron ? legible(cargo.cargo_padron) : 'Todavía no tienes una plaza en la estructura'}</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-marca-600">
            {cargo?.area ? `${cargo.area}. ` : ''}Tu ficha del padrón aún no está casada con una plaza del organigrama. Capital Humano la asigna; cuando lo haga, aquí vas a ver tu unidad, a quién le reportas y los procesos de tu cargo.
          </p>
        </section>
      ) : (
        plazas.map((p) => (
          <section key={`${p.plaza_ref}-${p.tipo}`} className="tarjeta-canal mb-4 overflow-hidden" aria-label={`Plaza: ${p.cargo}`}>
            <div className="px-5 pt-5 pb-4">
              <p className="text-[11px] font-bold tracking-[0.12em] text-acento-700 uppercase">
                {p.tipo_nombre}
                {p.desde ? ` · desde ${fechaCorta(p.desde)}` : ''}
              </p>
              <h2 className="mt-1 text-[19px] leading-tight font-bold text-marca-900">{p.cargo}</h2>
              {p.familia && <p className="mt-0.5 text-[13px] text-marca-500">{p.familia}</p>}
              {p.proposito && <p className="mt-2.5 text-[14px] leading-relaxed text-marca-700">{p.proposito}</p>}
            </div>
            <div className="divide-y divide-marca-100 border-t border-marca-100 text-[14px]">
              <div className="flex items-start gap-3 px-5 py-3">
                <IconoOrganigrama className="mt-0.5 h-5 w-5 shrink-0 text-marca-500" />
                <div className="min-w-0">
                  <p className="text-[12px] text-marca-500">Tu unidad</p>
                  <p className="font-semibold text-marca-900">{p.unidad ?? 'Sin unidad'}</p>
                  {p.ruta && p.ruta.length > 0 && <p className="mt-0.5 text-[12px] leading-snug text-marca-500">{p.ruta.join(' › ')}</p>}
                  {p.sede && <p className="mt-0.5 text-[12px] text-marca-500">Sede {p.sede}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3 px-5 py-3">
                <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-[15px] text-marca-500">↑</span>
                <div className="min-w-0">
                  <p className="text-[12px] text-marca-500">Le reportas a</p>
                  {p.reporta_a ? (
                    <>
                      <p className="font-semibold text-marca-900">{p.reporta_a.personas.length ? p.reporta_a.personas.join(', ') : 'Plaza sin titular hoy'}</p>
                      <p className="text-[12px] text-marca-500">
                        {p.reporta_a.cargo}
                        {p.reporta_a.unidad ? ` · ${p.reporta_a.unidad}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-marca-600">La estructura no lo dice todavía</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        ))
      )}

      <ListaProcesos titulo="Procesos de tu cargo" vacio="Ningún proceso del SGC tiene hoy a tu cargo como dueño." filas={deMiCargo} enlace={veProcesos} />
      {deMiUnidad.length > 0 && <ListaProcesos titulo="Procesos de tu unidad" filas={deMiUnidad} enlace={veProcesos} />}

      <section aria-labelledby="mis-documentos" className="mb-4">
        <h2 id="mis-documentos" className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-500 uppercase">
          Documentos que debes conocer
        </h2>
        {documentos.length === 0 ? (
          <p className="tarjeta-canal px-4 py-4 text-[13px] leading-relaxed text-marca-600">
            No hay documentos vigentes vinculados a tus procesos. La distribución de documentos por cargo, con «leído y entendido», viene después.
          </p>
        ) : (
          <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
            {docsVisibles.map((d) => {
              const cuerpo = (
                <>
                  <IconoDocumento className="mt-0.5 h-5 w-5 shrink-0 text-marca-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] leading-snug font-semibold text-marca-900">{d.titulo}</span>
                    <span className="mt-0.5 block text-[12px] text-marca-500">
                      <span className="font-mono">{d.codigo}</span>
                      {d.version ? ` · versión ${d.version}` : ''} · {d.proceso}
                    </span>
                  </span>
                </>
              )
              return (
                <li key={d.id}>
                  {veDocumentos ? (
                    <Link href={hrefFicha('documento', d.id)} className="flex min-h-14 items-start gap-3 px-4 py-3 active:bg-marca-50">
                      {cuerpo}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-3">{cuerpo}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {documentos.length > TOPE_DOCUMENTOS && (
          <p className="mt-2 px-1 text-[12px] text-marca-500">
            Y {documentos.length - TOPE_DOCUMENTOS}
            {documentos.length >= 120 ? ' o más' : ''} documentos más de los mismos procesos.
          </p>
        )}
      </section>
    </>
  )
}

function ListaProcesos({
  titulo,
  vacio,
  filas,
  enlace,
}: {
  titulo: string
  vacio?: string
  filas: { ref: string; codigo: string | null; nombre: string; nivel_nombre: string; dueno: string; objetivo: string | null }[]
  enlace: boolean
}) {
  return (
    <section aria-label={titulo} className="mb-4">
      <h2 className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-500 uppercase">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="tarjeta-canal px-4 py-4 text-[13px] leading-relaxed text-marca-600">{vacio}</p>
      ) : (
        <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
          {filas.map((p) => {
            const cuerpo = (
              <>
                <IconoProcesos className="mt-0.5 h-5 w-5 shrink-0 text-marca-500" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] leading-snug font-semibold text-marca-900">{p.nombre}</span>
                  <span className="mt-0.5 block text-[12px] text-marca-500">
                    {p.codigo ? <span className="font-mono">{p.codigo} · </span> : null}
                    {p.nivel_nombre} · dueño: {p.dueno}
                  </span>
                  {p.objetivo && <span className="mt-1 line-clamp-2 block text-[13px] leading-relaxed text-marca-600">{p.objetivo}</span>}
                </span>
              </>
            )
            return (
              <li key={p.ref}>
                {enlace ? (
                  <Link href={hrefFicha('proceso', p.ref)} className="flex min-h-14 items-start gap-3 px-4 py-3 active:bg-marca-50">
                    {cuerpo}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 px-4 py-3">{cuerpo}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
