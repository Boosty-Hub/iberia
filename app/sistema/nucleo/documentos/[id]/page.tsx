import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { puede, requerirPermiso } from '@/lib/auth'
import { compararVersiones } from '@/lib/plataforma/comparar-texto'
import { fichaDocumento } from '@/lib/plataforma/fichas/procesos'
import { leerDocumentoVivo, PLANTILLAS, TIPOS_DOC, versionDeLectura, type VersionDoc } from '@/lib/plataforma/procesos-vivos'
import { createClient } from '@/lib/supabase/server'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { FichaObjeto } from '@/components/sistema/ui/ficha-objeto'
import { Bloques, Chip, ChipEstadoDoc } from '@/components/sistema/procesos/vivos'
import { BandaEnvio, EditorSeccion } from '@/components/sistema/procesos/vivos-cliente'

export const metadata: Metadata = { title: 'Documento · Procesos' }

const ETIQUETA_VERSION: Record<VersionDoc['estado'], string> = {
  vigente: 'vigente', transcripcion: 'transcripción por validar', historica: 'versión anterior hallada en los archivos',
  borrador: 'borrador', en_revision: 'en revisión', reemplazada: 'reemplazada',
}

/**
 * Un documento del SGC escrito en la plataforma (rediseño del 28-nov-2026): el texto por secciones, editable sección
 * por sección (borrador → revisión del dueño del proceso → aprobación de Gestión de la Calidad), y sus versiones con
 * la comparación. El archivo de origen queda como respaldo; los metadatos y la conciliación, en la ficha completa.
 */
export default async function DocumentoPage({ params, searchParams }: PageProps<'/sistema/nucleo/documentos/[id]'>) {
  const [sesion, { id }, sp] = await Promise.all([requerirPermiso('sistema:documentos'), params, searchParams])
  if (sp.vista === 'ficha') return <FichaCompleta sesion={sesion} id={id} />
  const supabase = await createClient()
  const datos = await leerDocumentoVivo(supabase, id)
  if (!datos) notFound()
  const { doc, versiones, enlaces } = datos
  const editar = puede(sesion, 'sistema:documentos', 'editar')
  const pest = sp.p === 'versiones' ? 'versiones' : 'documento'

  // El proceso principal y su macroproceso, para las migas.
  const principal = enlaces.find((e) => e.rol === 'principal')
  const refProceso = principal?.proceso_ref ?? doc.proceso_ref
  const sgc = supabase.schema('sgc')
  const [{ data: proc }, codigos] = await Promise.all([
    refProceso ? sgc.from('proceso').select('ref, codigo_informe, codigo_sgc, nombre, nivel, padre_ref').eq('ref', refProceso).is('escenario_id', null).eq('estado', 'vigente').maybeSingle() : Promise.resolve({ data: null }),
    codigosDocumentos(supabase),
  ])
  const migas: { etiqueta: string; href?: string }[] = [{ etiqueta: 'Mapa', href: '/sistema/nucleo/procesos' }]
  if (proc) migas.push({ etiqueta: `${proc.codigo_informe ?? proc.codigo_sgc ?? ''} ${proc.nombre}`.trim(), href: `/sistema/nucleo/procesos/${proc.ref}` })
  migas.push({ etiqueta: doc.codigo })

  const mio = versiones.find((v) => v.estado === 'borrador' && v.creadoPor === sesion.perfil.id)
  const enRevision = versiones.find((v) => v.estado === 'en_revision')
  const lectura = mio ?? enRevision ?? versionDeLectura(versiones)
  const enlaceDe = (codigo: string) => (codigos.get(codigo) ? `/sistema/nucleo/documentos/${codigos.get(codigo)}` : null)
  const plantilla = PLANTILLAS[doc.tipo_yy ?? ''] ?? ['Contenido']
  const editable = editar && !!lectura && (lectura.estado === 'borrador' || lectura.estado === 'vigente' || lectura.estado === 'transcripcion') && !enRevision

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={migas}
        acciones={<Link href={`/sistema/nucleo/documentos/${id}?vista=ficha`} className={BOTON_CABECERA}>Ficha y archivo de origen</Link>}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--borde)] bg-white shadow-[var(--sombra-tarjeta)]" data-documento={doc.codigo}>
        <div className="grid gap-2 px-5 pb-3 pt-5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-marca-500">
            {TIPOS_DOC[doc.tipo_yy ?? ''] ?? 'Documento'} · {doc.codigo}{proc ? ` · proceso ${proc.codigo_informe ?? proc.codigo_sgc ?? ''}` : ''}
          </span>
          <h1 className="text-xl font-bold">{doc.titulo}</h1>
          <div className="flex flex-wrap gap-1.5">
            <ChipEstadoDoc d={doc} />
            {lectura ? <Chip tono={lectura.estado === 'vigente' ? 'ok' : 'sugerido'}>Texto: {ETIQUETA_VERSION[lectura.estado]}</Chip> : <Chip>Pendiente de transcribir</Chip>}
            {principal?.estado === 'sugerido' && <Chip tono="sugerido">Enlace al proceso sugerido</Chip>}
            {doc.datos_sensibles && <Chip tono="sin">Datos sensibles</Chip>}
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-[var(--borde)] px-3">
          <Link href={`/sistema/nucleo/documentos/${id}`} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] ${pest === 'documento' ? 'border-acento-500 font-semibold' : 'border-transparent text-marca-500'}`}>Documento</Link>
          <Link href={`/sistema/nucleo/documentos/${id}?p=versiones`} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[13.5px] ${pest === 'versiones' ? 'border-acento-500 font-semibold' : 'border-transparent text-marca-500'}`}>
            Versiones{versiones.length ? <span className="ml-1 rounded-full bg-marca-100 px-1.5 text-[11px]">{versiones.length}</span> : null}
          </Link>
          <Link href={`/sistema/nucleo/documentos/${id}?vista=ficha`} className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-[13.5px] text-marca-500">Ficha, archivo de origen y aprobaciones</Link>
        </nav>

        {pest === 'documento' && (
          <div className="grid lg:grid-cols-[220px_minmax(0,1fr)_240px]">
            <aside className="grid content-start gap-0.5 border-b border-[var(--borde)] p-3 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-auto lg:border-b-0 lg:border-r">
              <span className="px-2 pb-1 font-mono text-[11px] uppercase tracking-wider text-marca-500">Contenido</span>
              {(lectura?.contenido.secciones.map((s) => s.titulo) ?? plantilla).map((t, i) => (
                <a key={i} href={`#s${i}`} className="grid grid-cols-[22px_minmax(0,1fr)] gap-1 rounded-md px-2 py-1 text-[12.5px] text-marca-600 hover:bg-marca-50"><span className="font-mono text-marca-400">{i + 1}</span>{t}</a>
              ))}
            </aside>
            <div className="grid min-w-0 content-start gap-6 p-5 lg:px-8">
              {mio && editar && <BandaEnvio documento={id} version={mio.id} tipo="borrador" />}
              {!mio && lectura?.estado === 'transcripcion' && editar && !enRevision && <BandaEnvio documento={id} version={lectura.id} tipo="transcripcion" />}
              {enRevision && <div className="rounded-xl bg-[#e8f0fa] px-4 py-3 text-[13px] text-[#2c5d9c]"><b>Versión {enRevision.numero} en revisión.</b> {enRevision.motivo ?? ''} Se decide en la Bandeja de quien aprueba.</div>}
              <Control doc={doc} v={lectura} />
              {lectura ? (
                lectura.contenido.secciones.map((s, i) => {
                  const cuerpo = (
                    <section id={`s${i}`} className="grid scroll-mt-20 gap-2.5">
                      <h2 className="flex items-baseline gap-2.5 text-[15.5px] font-bold"><span className="font-mono text-[13px] font-normal text-marca-400">{i + 1}</span>{s.titulo}</h2>
                      {s.bloques.length ? <Bloques bloques={s.bloques} enlaceDe={enlaceDe} /> : <p className="text-[13px] text-marca-400">(Sin contenido en el original.)</p>}
                    </section>
                  )
                  return editable ? <EditorSeccion key={`${lectura.id}-${i}`} documento={id} indice={i} seccion={s}>{cuerpo}</EditorSeccion> : <div key={i}>{cuerpo}</div>
                })
              ) : (
                <>
                  <div className="rounded-xl border border-[var(--borde)] bg-marca-50 px-4 py-3 text-[13px] text-marca-600">
                    Aún no está transcrito: llega con la revisión de su macroproceso. Las secciones de abajo son las de la plantilla de su tipo. Mientras, el original está en <Link className="underline" href={`/sistema/nucleo/documentos/${id}?vista=ficha`}>Ficha y archivo de origen</Link>.
                  </div>
                  {plantilla.map((t, i) => (
                    <section key={i} id={`s${i}`} className="grid gap-2">
                      <h2 className="flex items-baseline gap-2.5 text-[15.5px] font-bold"><span className="font-mono text-[13px] font-normal text-marca-400">{i + 1}</span>{t}</h2>
                      <div className="grid gap-1.5" aria-hidden><i className="h-2.5 w-[95%] rounded bg-marca-100" /><i className="h-2.5 w-[86%] rounded bg-marca-100" /><i className="h-2.5 w-[60%] rounded bg-marca-100" /></div>
                    </section>
                  ))}
                </>
              )}
            </div>
            <aside className="grid content-start gap-4 border-t border-[var(--borde)] p-4 text-[12.5px] lg:border-l lg:border-t-0">
              <div className="grid gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-marca-500">Versiones</span>
                <div className="grid border-l-2 border-[var(--borde)] pl-3">
                  {versiones.length ? versiones.map((v) => (
                    <div key={v.id} className="relative pb-2.5">
                      <i className={`absolute -left-[19px] top-1 h-3 w-3 rounded-full border-2 bg-white ${v.estado === 'vigente' ? 'border-[#1f7a4d] bg-[#1f7a4d]' : v.estado === 'borrador' || v.estado === 'transcripcion' ? 'border-dashed border-oro-500' : 'border-marca-400'}`} />
                      <b className="block">{v.etiqueta ?? `Versión ${v.numero}`}</b>
                      <span className="text-marca-500">{ETIQUETA_VERSION[v.estado]}{v.fecha ? ` · ${v.fecha.split('-').reverse().join('/')}` : ''}</span>
                    </div>
                  )) : <span className="text-marca-500">Sin versiones escritas todavía.</span>}
                </div>
                {versiones.length > 1 && <Link className="underline" href={`/sistema/nucleo/documentos/${id}?p=versiones`}>Comparar versiones</Link>}
              </div>
              {proc && (
                <div className="grid gap-1">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-marca-500">Proceso</span>
                  <Link className="underline" href={`/sistema/nucleo/procesos/${proc.ref}`}>{proc.codigo_informe ?? proc.codigo_sgc} {proc.nombre}</Link>
                  {principal?.estado === 'sugerido' && <span className="text-marca-500">Enlace sugerido: {principal.razon}</span>}
                </div>
              )}
              <div className="grid gap-1">
                <span className="font-mono text-[11px] uppercase tracking-wider text-marca-500">Respaldo</span>
                <Link className="underline" href={`/sistema/nucleo/documentos/${id}?vista=ficha`}>Archivo de origen (PDF)</Link>
              </div>
            </aside>
          </div>
        )}
        {pest === 'versiones' && <Versiones versiones={versiones} desde={typeof sp.desde === 'string' ? sp.desde : null} hasta={typeof sp.hasta === 'string' ? sp.hasta : null} id={id} />}
      </section>
    </>
  )
}

async function codigosDocumentos(supabase: Awaited<ReturnType<typeof createClient>>) {
  const m = new Map<string, string>()
  for (let desde = 0; ; desde += 1000) {
    const { data } = await supabase.schema('sgc').from('documento').select('id, codigo, estado').range(desde, desde + 999)
    for (const d of data ?? []) if (!m.has(d.codigo) || d.estado === 'vigente') m.set(d.codigo, d.id)
    if (!data || data.length < 1000) break
  }
  return m
}

/** El cajetín de control que trae cada documento del SGC (código, elaboración, actualización, versión). */
function Control({ doc, v }: { doc: { codigo: string; version: string | null; fecha: string | null }; v: VersionDoc | null }) {
  const c = v?.contenido.control ?? {}
  const celdas: [string, string][] = [
    ['CÓDIGO', doc.codigo],
    ['ELABORACIÓN', c.elaboracion ?? '—'],
    ['ACTUALIZACIÓN', c.actualizacion ?? (doc.fecha ? doc.fecha.split('-').reverse().join('/') : '—')],
    ['VERSIÓN', c.version_original ?? doc.version ?? '—'],
  ]
  const firmas = [c.elaboro && `Elaboró: ${c.elaboro}`, c.reviso && `Revisó: ${c.reviso}`, c.aprobo && `Aprobó: ${c.aprobo}`].filter(Boolean)
  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--borde)] text-[12px] sm:grid-cols-4">
        {celdas.map(([k, x]) => (
          <div key={k} className="grid gap-0.5 border-b border-r border-[var(--borde)] px-3 py-1.5 last:border-r-0 sm:border-b-0">
            <b className="font-mono text-[9.5px] font-medium tracking-wider text-marca-500">{k}</b><span className="break-words">{x}</span>
          </div>
        ))}
      </div>
      {firmas.length > 0 && <p className="text-[12px] text-marca-500">{firmas.join(' · ')}</p>}
    </div>
  )
}

/** La comparación entre dos versiones, sección por sección. Por defecto: la más nueva contra la anterior. */
function Versiones({ versiones, desde, hasta, id }: { versiones: VersionDoc[]; desde: string | null; hasta: string | null; id: string }) {
  if (versiones.length < 2) {
    return <p className="p-5 text-sm text-marca-500">{versiones.length ? 'Hay una sola versión: la comparación aparece cuando haya otra.' : 'Sin versiones escritas todavía.'}</p>
  }
  const b = versiones.find((v) => v.id === hasta) ?? versiones[0]
  const a = versiones.find((v) => v.id === desde) ?? versiones.find((v) => v.numero < b.numero) ?? versiones[1]
  const cambios = compararVersiones(a.contenido, b.contenido)
  const nombre = (v: VersionDoc) => `${v.etiqueta ?? `Versión ${v.numero}`}${v.fecha ? ` (${v.fecha.split('-').reverse().join('/')})` : ''}`
  return (
    <div className="grid gap-3 p-5" data-comparacion>
      <div className="flex flex-wrap gap-1.5 text-[12.5px]">
        {versiones.map((v) => (
          <Link key={v.id} href={`/sistema/nucleo/documentos/${id}?p=versiones&hasta=${v.id}`} className={`rounded-full border px-2.5 py-0.5 ${v.id === b.id ? 'border-acento-500 bg-acento-50 text-acento-700' : 'border-[var(--borde)]'}`}>
            {v.etiqueta ?? `v${v.numero}`} · {ETIQUETA_VERSION[v.estado]}
          </Link>
        ))}
      </div>
      <div className="rounded-xl bg-[#e8f0fa] px-4 py-2.5 text-[13px] text-[#2c5d9c]">
        Comparando <b>{nombre(a)}</b> → <b>{nombre(b)}</b>. {cambios.length ? `${cambios.length} sección(es) con cambios.` : 'Sin diferencias de texto.'}
        {b.motivo && <span className="block">Motivo: {b.motivo}</span>}
      </div>
      {cambios.map((c, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-[var(--borde)]">
          <div className="flex justify-between gap-2 bg-marca-50 px-3 py-2 text-[12.5px] font-semibold"><span>{c.titulo}</span><span className="font-normal text-marca-500">{c.tipo === 'nueva' ? 'sección nueva' : c.tipo === 'quitada' ? 'sección quitada' : 'modificada'}</span></div>
          <p className="whitespace-pre-wrap px-3 py-2.5 text-[13.5px] leading-relaxed">
            {c.trozos.map((t, j) => t.t === 'igual'
              ? <span key={j}>{t.x.length > 600 ? `${t.x.slice(0, 280)} … ${t.x.slice(-280)}` : t.x}</span>
              : t.t === 'quitado'
                ? <del key={j} className="rounded bg-acento-50 px-0.5 text-acento-700">{t.x}</del>
                : <ins key={j} className="rounded bg-[#e6f4ec] px-0.5 text-[#1f7a4d] no-underline">{t.x}</ins>)}
          </p>
        </div>
      ))}
    </div>
  )
}

/** La ficha de siempre: metadatos corregibles, archivos de origen, relaciones, línea de tiempo, conciliación. */
async function FichaCompleta({ sesion, id }: { sesion: Awaited<ReturnType<typeof requerirPermiso>>; id: string }) {
  const ficha = await fichaDocumento(sesion, id)
  if (!ficha) notFound()
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Mapa', href: '/sistema/nucleo/procesos' }, { etiqueta: ficha.titulo, href: `/sistema/nucleo/documentos/${id}` }, { etiqueta: 'Ficha' }]}
        acciones={<Link href={`/sistema/nucleo/documentos/${id}`} className={BOTON_CABECERA}>← Volver al documento</Link>}
      />
      <div className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-[var(--borde)] bg-white">
        <FichaObjeto ficha={ficha} variante="pagina" />
      </div>
    </>
  )
}
