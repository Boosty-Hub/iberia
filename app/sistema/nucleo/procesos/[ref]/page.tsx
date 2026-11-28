import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { puede, requerirPermiso } from '@/lib/auth'
import { PESTANAS } from '@/lib/plataforma/dominios'
import { fichaProceso } from '@/lib/plataforma/fichas/procesos'
import { activos, CAMPOS_CARACTERIZACION, estadoDocumental, leerMapa, principales } from '@/lib/plataforma/procesos-vivos'
import { createClient } from '@/lib/supabase/server'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FichaObjeto } from '@/components/sistema/ui/ficha-objeto'
import { Chip, EscaleraDocumentos } from '@/components/sistema/procesos/vivos'
import { BotonConfirmarTodos } from '@/components/sistema/procesos/vivos-cliente'

export const metadata: Metadata = { title: 'Proceso · Procesos' }

type Ficha = Record<string, unknown> & { fuentes?: Record<string, string>; actividades?: Record<string, string[]>; indicadores?: { nombre: string; formula?: string | null; meta?: string | null; frecuencia?: string | null; fuente?: string }[] }

// Lo que dijo el levantamiento del informe. «nuevo» (no documentado) no se muestra: la revisión de los documentos del SGC
// encontró documentos para muchos de esos procesos (comparación de mapas, 27-nov-2026).
const ESTADO_INFORME: Record<string, string> = { propuesto: 'Propuesto por el informe', no_se_ejecuta: 'No se ejecuta hoy', sin_evidencia: 'Sin evidencia en el levantamiento' }

const PESTANAS_PROCESO = [
  { clave: 'caracterizacion', etiqueta: 'Caracterización' },
  { clave: 'documentos', etiqueta: 'Documentos' },
  { clave: 'indicadores', etiqueta: 'Indicadores' },
  { clave: 'versiones', etiqueta: 'Versiones' },
] as const

/**
 * Un proceso (rediseño del 28-nov-2026): su caracterización con los campos de ISO 9001 (cláusula 4.4) y sus
 * documentos escalonados. La edición de la caracterización sigue el ciclo de siempre (borrador → revisión → vigente),
 * en la ficha completa (`?vista=ficha`).
 */
export default async function ProcesoPage({ params, searchParams }: PageProps<'/sistema/nucleo/procesos/[ref]'>) {
  const [sesion, { ref }, sp] = await Promise.all([requerirPermiso('sistema:procesos'), params, searchParams])
  if (sp.vista === 'ficha') return <FichaCompleta sesion={sesion} ref_={ref} />
  const supabase = await createClient()
  const [mapa, { data: versiones }] = await Promise.all([
    leerMapa(supabase),
    supabase.schema('sgc').from('proceso').select('id, version, estado, ficha, creado_en, vigencia, nota').eq('ref', ref).is('escenario_id', null).order('version', { ascending: false }),
  ])
  const p = mapa.porRef.get(ref)
  if (!p) notFound()
  const macro = mapa.macroDe(ref)
  const padre = p.padre ? mapa.porRef.get(p.padre) : null
  const pest = PESTANAS_PROCESO.some((x) => x.clave === sp.p) ? (sp.p as string) : 'caracterizacion'
  const editar = puede(sesion, 'sistema:procesos', 'editar')
  const vigente = versiones?.find((v) => v.estado === 'vigente')
  const propuesta = versiones?.find((v) => v.estado === 'borrador' || v.estado === 'en_revision')
  const ficha = ((propuesta ?? vigente)?.ficha ?? {}) as Ficha
  const docs = principales(activos(p.docs))
  const tambien = activos(p.docs).filter((d) => d.enlace.rol === 'tambien').map((d) => {
    const casa = mapa.procesos.find((x) => x.docs.some((y) => y.id === d.id && y.enlace.rol === 'principal'))
    return { ...d, vive: casa ? casa.codigo : '—' }
  })
  const sugeridos = docs.filter((d) => d.enlace.estado === 'sugerido').length
  const e = estadoDocumental(p)
  const migas = [{ etiqueta: 'Mapa', href: '/sistema/nucleo/procesos' }]
  if (macro && macro.ref !== p.ref) migas.push({ etiqueta: `${macro.codigo} ${macro.nombre}`, href: `/sistema/nucleo/procesos/m/${macro.codigo}` })
  if (padre && padre.nivel > 0) migas.push({ etiqueta: `${padre.codigo} ${padre.nombre}`, href: `/sistema/nucleo/procesos/${padre.ref}` })
  migas.push({ etiqueta: `${p.codigo} ${p.nombre}`, href: '' })

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={migas.map((m) => (m.href ? m : { etiqueta: m.etiqueta }))}
        acciones={
          <>
            <Link href={`/sistema/nucleo/procesos/${ref}/imprimir`} className={BOTON_CABECERA}>Imprimir</Link>
            <Link href="/sistema/nucleo/procesos/herramientas" className={BOTON_CABECERA}>Herramientas del SGC</Link>
          </>
        }
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--borde)] bg-white shadow-[var(--sombra-tarjeta)]" data-proceso-pagina={p.codigo}>
        <div className="grid gap-2 px-5 pb-3 pt-5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-marca-500">
            {p.nivel === 0 ? 'Macroproceso' : p.nivel === 2 ? 'Subproceso' : 'Proceso'} {p.codigo}{p.codigoSgc ? ` · código SGC ${p.codigoSgc}` : ''}{p.dueno ? ` · dueño: ${p.dueno}` : ''}
          </span>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold">{p.nombre}</h1>
            {editar && <Link href={`/sistema/nucleo/procesos/${ref}?vista=ficha`} className={BOTON_CABECERA}>Proponer cambio</Link>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip tono={e.tono}>{e.texto}</Chip>
            {vigente && Object.keys(vigente.ficha as object ?? {}).length > 0 ? <Chip tono="ok">Caracterización vigente · v{vigente.version}</Chip> : <Chip>Caracterización por redactar</Chip>}
            {propuesta && <Chip tono="sugerido">{propuesta.estado === 'en_revision' ? 'Propuesta en revisión' : 'Propuesta por validar'} · v{propuesta.version}</Chip>}
            {ESTADO_INFORME[p.estadoOperativo] && <Chip>{ESTADO_INFORME[p.estadoOperativo]}</Chip>}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-[var(--borde)] px-3" aria-label="Secciones del proceso">
          {PESTANAS_PROCESO.map((x) => {
            const n = x.clave === 'documentos' ? docs.length : x.clave === 'indicadores' ? (ficha.indicadores?.length ?? 0) : 0
            return (
              <Link key={x.clave} href={`/sistema/nucleo/procesos/${ref}?p=${x.clave}`} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] ${pest === x.clave ? 'border-acento-500 font-semibold' : 'border-transparent text-marca-500 hover:text-marca-800'}`}>
                {x.etiqueta}{n ? <span className="ml-1 rounded-full bg-marca-100 px-1.5 text-[11px]">{n}</span> : null}
              </Link>
            )
          })}
          <Link href={`/sistema/nucleo/procesos/${ref}?vista=ficha`} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13.5px] text-marca-500 hover:text-marca-800">Ficha completa y aprobaciones</Link>
        </nav>

        {pest === 'caracterizacion' && (
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-4">
              {propuesta && (
                <div className="rounded-xl bg-oro-50 px-4 py-3 text-[13px] text-oro-900" data-propuesta-caracterizacion>
                  <b>Caracterización propuesta (v{propuesta.version}).</b> {propuesta.nota ?? 'Armada a partir de los documentos y del levantamiento.'}{' '}
                  {propuesta.estado === 'borrador' ? 'Falta enviarla a revisión: la aprueban el dueño del proceso y Gestión de la Calidad.' : 'Está en revisión.'}
                  {editar && propuesta.estado === 'borrador' && <> <Link className="font-semibold underline" href={`/sistema/nucleo/procesos/${ref}?vista=ficha`}>Revisar y enviar</Link></>}
                </div>
              )}
              <Caracterizacion ficha={ficha} />
            </div>
            <div className="grid content-start gap-2">
              {sugeridos > 0 && editar && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-oro-50 px-3 py-2 text-[12.5px] text-oro-900">
                  <span>{sugeridos} documento{sugeridos === 1 ? '' : 's'} con enlace sugerido por la revisión.</span>
                  <BotonConfirmarTodos proceso={ref} n={sugeridos} />
                </div>
              )}
              <EscaleraDocumentos docs={docs} tambien={tambien} compacto editar={editar} refProceso={ref} />
            </div>
          </div>
        )}
        {pest === 'documentos' && (
          <div className="grid gap-3 p-5">
            {sugeridos > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-oro-50 px-4 py-2.5 text-[13px] text-oro-900">
                <span>Los documentos en ámbar son <b>enlaces sugeridos</b>: por lo que dicen por dentro, van con este proceso aunque su código diga otra cosa. Confírmalos o di que no van aquí.</span>
                {editar && <BotonConfirmarTodos proceso={ref} n={sugeridos} />}
              </div>
            )}
            <EscaleraDocumentos docs={docs} tambien={tambien} editar={editar} refProceso={ref} />
          </div>
        )}
        {pest === 'indicadores' && <Indicadores ficha={ficha} />}
        {pest === 'versiones' && (
          <div className="grid gap-2 p-5">
            {(versiones ?? []).map((v) => (
              <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--borde)] px-4 py-2.5 text-[13px]">
                <span><b>v{v.version}</b> · {v.nota ?? (v.estado === 'vigente' ? 'Versión vigente' : '')}</span>
                <Chip tono={v.estado === 'vigente' ? 'ok' : v.estado === 'borrador' || v.estado === 'en_revision' ? 'sugerido' : 'gris'}>{v.estado.replace('_', ' ')}</Chip>
              </div>
            ))}
            <p className="text-[12.5px] text-marca-500">Cada cambio aprobado crea una versión nueva; la anterior queda reemplazada.</p>
          </div>
        )}
      </section>
    </>
  )
}

function Fuente({ texto }: { texto?: string }) {
  return texto ? <span className="block text-[11.5px] text-marca-500">↳ {texto}</span> : null
}

function Valor({ v }: { v: unknown }): ReactNode {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return <span className="text-[13px] text-marca-400">Por definir con el dueño del proceso</span>
  if (typeof v === 'string') return <p className="max-w-[72ch] text-[14px] leading-relaxed">{v}</p>
  if (Array.isArray(v)) return <ul className="grid list-disc gap-1 pl-5 text-[13.5px]">{v.map((x, i) => <li key={i}>{typeof x === 'string' ? x : (x as { nombre?: string; texto?: string }).nombre ?? (x as { texto?: string }).texto ?? JSON.stringify(x)}</li>)}</ul>
  return <p className="text-[13.5px]">{JSON.stringify(v)}</p>
}

/** La caracterización con los campos de la cláusula 4.4.1 de ISO 9001; cada campo dice de dónde salió. */
function Caracterizacion({ ficha }: { ficha: Ficha }) {
  const f = ficha.fuentes ?? {}
  const act = ficha.actividades as Record<string, string[]> | string[] | undefined
  const vacia = !Object.keys(ficha).filter((k) => k !== 'fuentes' && k !== 'origen').length
  if (vacia) {
    return (
      <div className="grid justify-items-center gap-2 rounded-xl border border-dashed border-[var(--borde)] p-8 text-center text-sm text-marca-500">
        <b className="text-marca-800">Este proceso todavía no tiene caracterización escrita.</b>
        Se arma en la revisión de su macroproceso, a partir de sus documentos y del levantamiento, y la aprueban el dueño y Gestión de la Calidad.
      </div>
    )
  }
  const brechas = Array.isArray(ficha.brechas) ? (ficha.brechas as string[]) : []
  return (
    <div className="grid gap-4">
      {typeof ficha.estado_hoy === 'string' && (
        <Campo titulo="Cómo se hace hoy" iso=""><p className="max-w-[72ch] text-[14px] leading-relaxed">{ficha.estado_hoy}</p><Fuente texto={f.estado_hoy} /></Campo>
      )}
      {typeof ficha.dueno === 'string' && <Campo titulo="Dueño del proceso" iso="4.4.1 e)"><p className="text-[14px]">{ficha.dueno}</p><Fuente texto={f.dueno} /></Campo>}
      {CAMPOS_CARACTERIZACION.filter((c) => c.clave !== 'indicadores').map((c) => {
        if (c.clave === 'actividades') {
          if (Array.isArray(act)) return <Campo key={c.clave} titulo={c.titulo} iso={c.iso}><Valor v={act} /><Fuente texto={f[c.clave]} /></Campo>
          const fases = act ? (['planificar', 'hacer', 'verificar', 'actuar'] as const) : []
          return (
            <Campo key={c.clave} titulo="Actividades · ciclo PHVA" iso={c.iso}>
              {fases.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {fases.map((k) => (
                    <div key={k} className="rounded-lg border border-[var(--borde)] p-2.5 text-[12.5px]">
                      <b className="mb-1 block capitalize">{k}</b>
                      <Valor v={act?.[k]} />
                    </div>
                  ))}
                </div>
              ) : <Valor v={null} />}
              <Fuente texto={f[c.clave]} />
            </Campo>
          )
        }
        return <Campo key={c.clave} titulo={c.titulo} iso={c.iso}><Valor v={ficha[c.clave]} /><Fuente texto={f[c.clave]} /></Campo>
      })}
      {brechas.length > 0 && (
        <section className="grid gap-1.5 rounded-xl bg-acento-50 p-3">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-acento-700">Brechas encontradas en la revisión</h3>
          <ul className="grid list-disc gap-1 pl-5 text-[13.5px]">{brechas.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </section>
      )}
    </div>
  )
}

function Campo({ titulo, iso, children }: { titulo: string; iso: string; children: ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-wider text-marca-500">{titulo}{iso && <span className="normal-case tracking-normal text-marca-400">ISO {iso}</span>}</h3>
      {children}
    </section>
  )
}

function Indicadores({ ficha }: { ficha: Ficha }) {
  const xs = ficha.indicadores ?? []
  if (!xs.length) return <p className="p-5 text-sm text-marca-500">Sin indicadores definidos. Se definen con el dueño del proceso: fórmula, meta y frecuencia.</p>
  return (
    <div className="overflow-x-auto p-5">
      <table className="w-full text-[13px]">
        <thead><tr className="text-left font-mono text-[10.5px] uppercase tracking-wider text-marca-500"><th className="py-2 pr-3">Indicador</th><th className="pr-3">Fórmula</th><th className="pr-3">Meta</th><th>Frecuencia</th></tr></thead>
        <tbody>{xs.map((i, k) => (
          <tr key={k} className="border-t border-[var(--borde)]"><td className="py-2 pr-3">{i.nombre}{i.fuente && <span className="block text-[11px] text-marca-500">↳ {i.fuente}</span>}</td><td className="pr-3 text-marca-500">{i.formula ?? 'por definir'}</td><td className="pr-3 text-marca-500">{i.meta ?? 'por definir'}</td><td className="text-marca-500">{i.frecuencia ?? 'por definir'}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}

/** La ficha de siempre (Datos, PHVA, Ciclo, Relaciones, Línea de tiempo, Aprobaciones…): aquí se edita y se envía. */
async function FichaCompleta({ sesion, ref_ }: { sesion: Awaited<ReturnType<typeof requerirPermiso>>; ref_: string }) {
  const ficha = await fichaProceso(sesion, ref_)
  if (!ficha) notFound()
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Mapa', href: '/sistema/nucleo/procesos' }, { etiqueta: ficha.titulo, href: `/sistema/nucleo/procesos/${ref_}` }, { etiqueta: 'Ficha completa' }]}
        pestanas={PESTANAS['NUC-PRO']}
        acciones={<Link href={`/sistema/nucleo/procesos/${ref_}`} className={BOTON_CABECERA}>← Volver al proceso</Link>}
      />
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        <FichaObjeto ficha={ficha} variante="pagina" />
      </div>
    </>
  )
}
