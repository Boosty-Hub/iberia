import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  activos, estadoDocumental, ETIQUETA_ESTADO_DOC, nivelDe, NIVELES_DOC, principales, TIPOS_DOC,
  type Bloque, type DocEnlazado, type Mapa, type ProcesoMapa,
} from '@/lib/plataforma/procesos-vivos'
import { BotonesEnlace } from './vivos-cliente'

/** Piezas de servidor del rediseño de Procesos: mapa, fila de proceso, escalera de documentos y bloques de texto. */

const TONO: Record<string, string> = {
  ok: 'bg-[#e6f4ec] text-[#1f7a4d]',
  sugerido: 'bg-oro-100 text-oro-800',
  borrador: 'bg-oro-100 text-oro-800',
  formatos: 'bg-[#e8f0fa] text-[#2c5d9c]',
  sin: 'bg-acento-50 text-acento-700',
}

export function Chip({ tono = 'gris', children }: { tono?: string; children: ReactNode }) {
  const c = TONO[tono] ?? 'bg-marca-100 text-marca-700'
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ${c}`}>{children}</span>
}

export function ChipEstadoDoc({ d }: { d: { estado: string; version: string | null } }) {
  const tono = d.estado === 'vigente' ? 'ok' : d.estado === 'borrador' ? 'borrador' : 'gris'
  return <Chip tono={tono}>{ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado}{d.estado === 'vigente' && d.version ? ` · v${d.version}` : ''}</Chip>
}

/** Un macroproceso en el mapa: cuántos procesos tienen documentos (confirmados en verde, sugeridos en ámbar). */
export function TarjetaMacro({ m, mapa }: { m: ProcesoMapa; mapa: Mapa }) {
  const ps = mapa.hijos(m.ref)
  let ok = 0
  let sug = 0
  for (const p of ps) {
    const ds = principales(activos([...p.docs, ...mapa.hijos(p.ref).flatMap((h) => h.docs)])).filter((d) => d.tipo !== '40')
    if (!ds.length) continue
    if (ds.every((d) => d.enlace.estado === 'sugerido')) sug++
    else ok++
  }
  const nDocs = new Set([m, ...ps, ...ps.flatMap((p) => mapa.hijos(p.ref))].flatMap((p) => principales(activos(p.docs)).map((d) => d.id))).size
  const pct = (n: number) => `${(100 * n) / Math.max(ps.length, 1)}%`
  return (
    <Link href={`/sistema/nucleo/procesos/m/${m.codigo}`} data-macro={m.codigo} className="grid gap-2 rounded-xl border border-[var(--borde)] bg-white p-3 shadow-[var(--sombra-tarjeta)] transition hover:border-acento-200 hover:shadow-md">
      <span className="flex justify-between font-mono text-[11.5px] text-marca-500"><span>{m.codigo}</span><span>{m.codigoSgc ?? ''}</span></span>
      <b className="min-h-[2.6em] text-[14px] font-semibold leading-snug">{m.nombre}</b>
      <span className="flex h-1.5 overflow-hidden rounded-full bg-marca-100" aria-hidden>
        <i className="block h-full bg-[#1f7a4d]" style={{ width: pct(ok) }} />
        <i className="block h-full bg-oro-400" style={{ width: pct(sug) }} />
      </span>
      <span className="flex justify-between gap-2 text-[11.5px] tabular-nums text-marca-500">
        <span>{ok + sug} de {ps.length} procesos</span>
        <span>{nDocs} documentos</span>
      </span>
    </Link>
  )
}

export function ChipDoc({ d }: { d: DocEnlazado }) {
  const sug = d.enlace.estado === 'sugerido'
  return (
    <Link
      href={`/sistema/nucleo/documentos/${d.id}`}
      title={`${d.titulo}${sug ? ' · enlace sugerido' : ''}`}
      className={`inline-flex min-w-0 max-w-full items-baseline gap-1.5 rounded-md border px-2 py-0.5 text-xs hover:bg-white ${sug ? 'border-dashed border-oro-500 bg-oro-50' : 'border-[var(--borde)] bg-marca-50'}`}
    >
      <span className="whitespace-nowrap font-mono text-[11px] text-marca-500">{d.codigo}</span>
      <span className="min-w-0 truncate">{d.titulo}</span>
      <span className="hidden whitespace-nowrap text-[10.5px] text-marca-500 sm:inline">{TIPOS_DOC[d.tipo ?? ''] ?? ''}</span>
    </Link>
  )
}

/** La fila de un proceso dentro de su macroproceso (y sus subprocesos debajo). */
export function FilaProceso({ p, mapa, sub = false }: { p: ProcesoMapa; mapa: Mapa; sub?: boolean }) {
  const ds = principales(activos(p.docs))
  const e = estadoDocumental(p)
  const hijos = mapa.hijos(p.ref)
  return (
    <>
      <div className={`grid grid-cols-1 gap-1 border-t border-[var(--borde)] px-4 py-3 sm:grid-cols-[64px_minmax(0,1fr)_120px] sm:gap-3 ${sub ? 'ml-4 border-l-2 sm:ml-[18px]' : ''}`} data-proceso={p.codigo}>
        <span className="font-mono text-[12.5px] text-marca-500">{p.codigo}</span>
        <div className="grid min-w-0 gap-1.5">
          <Link href={`/sistema/nucleo/procesos/${p.ref}`} className="font-semibold hover:text-acento-700">{p.nombre}</Link>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {ds.slice(0, 5).map((d) => <ChipDoc key={d.id} d={d} />)}
            {ds.length > 5 && <Link href={`/sistema/nucleo/procesos/${p.ref}?p=documentos`} className="rounded-md border border-[var(--borde)] bg-marca-50 px-2 py-0.5 text-xs">+{ds.length - 5} más</Link>}
            {!ds.length && <Link href={`/sistema/nucleo/procesos/${p.ref}`} className="rounded-lg border border-[var(--borde)] bg-white px-2.5 py-1 text-xs font-medium hover:bg-marca-50">✎ Documentar este proceso</Link>}
          </div>
        </div>
        <span className="sm:justify-self-end"><Chip tono={e.tono}>{e.texto}</Chip></span>
      </div>
      {hijos.map((h) => <FilaProceso key={h.ref} p={h} mapa={mapa} sub />)}
    </>
  )
}

/** Los documentos de un proceso, escalonados: lo que manda → cómo se hace → cómo se controla → dónde queda. */
export function EscaleraDocumentos({ docs, tambien, compacto, editar, refProceso }: { docs: DocEnlazado[]; tambien: (DocEnlazado & { vive: string })[]; compacto?: boolean; editar: boolean; refProceso: string }) {
  if (!docs.length && !tambien.length) {
    return (
      <div className="rounded-xl border border-[var(--borde)] p-4 text-sm text-marca-500">
        Sin documentos. Cuando la revisión de su macroproceso encuentre uno que corresponda, aparece aquí como sugerido.
      </div>
    )
  }
  return (
    <div className="grid content-start gap-2.5">
      {NIVELES_DOC.map((n) => {
        const xs = docs.filter((d) => nivelDe(d.tipo) === n.clave)
        if (!xs.length) return null
        const vis = compacto ? xs.slice(0, 6) : xs
        return (
          <section key={n.clave} className="overflow-hidden rounded-xl border border-[var(--borde)]">
            <header className="flex justify-between gap-2 bg-marca-50 px-3 py-2 text-[12.5px] font-semibold">
              <span>{n.nombre}</span><span className="font-normal text-marca-500">{n.nota} · {xs.length}</span>
            </header>
            <ul>
              {vis.map((d) => (
                <li key={d.id} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-[var(--borde)] px-3 py-2 text-[13px] ${d.enlace.estado === 'sugerido' ? 'bg-oro-50' : ''}`}>
                  <Link href={`/sistema/nucleo/documentos/${d.id}`} className="min-w-0 hover:text-acento-700">
                    <span className="block font-mono text-[11px] text-marca-500">
                      {d.codigo} · {TIPOS_DOC[d.tipo ?? ''] ?? ''}{d.enlace.estado === 'sugerido' ? ' · sugerido' : ''}
                    </span>
                    {d.titulo}
                    {d.enlace.estado === 'sugerido' && d.enlace.razon && !compacto && <span className="block text-[11.5px] text-marca-500">{d.enlace.razon}</span>}
                  </Link>
                  <span className="flex flex-col items-end gap-1">
                    <ChipEstadoDoc d={d} />
                    {editar && d.enlace.estado === 'sugerido' && !compacto && <BotonesEnlace id={d.enlace.id} />}
                  </span>
                </li>
              ))}
              {compacto && xs.length > 6 && (
                <li className="border-t border-[var(--borde)] px-3 py-2 text-[13px]"><Link className="text-marca-500 underline" href={`/sistema/nucleo/procesos/${refProceso}?p=documentos`}>Ver los {xs.length}</Link></li>
              )}
            </ul>
          </section>
        )
      })}
      {tambien.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-[var(--borde)]">
          <header className="flex justify-between gap-2 bg-marca-50 px-3 py-2 text-[12.5px] font-semibold">
            <span>También aplican aquí</span><span className="font-normal text-marca-500">de otros procesos · {tambien.length}</span>
          </header>
          <ul>
            {(compacto ? tambien.slice(0, 5) : tambien).map((d) => (
              <li key={d.id} className="border-t border-[var(--borde)] px-3 py-2 text-[13px]">
                <Link href={`/sistema/nucleo/documentos/${d.id}`} className="hover:text-acento-700">
                  <span className="block font-mono text-[11px] text-marca-500">{d.codigo} · {TIPOS_DOC[d.tipo ?? ''] ?? ''} · vive en {d.vive}</span>
                  {d.titulo}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/** El texto de un documento: cada bloque como se lee, con las referencias como enlaces. */
export function Bloques({ bloques, enlaceDe }: { bloques: Bloque[]; enlaceDe: (codigo: string) => string | null }) {
  const conReferencias = (t: string) => {
    const partes = t.split(/(II-\d{2}-\d{2}-\d{3})/g)
    return partes.map((x, i) => {
      if (i % 2 === 0) return x
      const h = enlaceDe(x)
      return h
        ? <Link key={i} href={h} className="mx-0.5 inline-flex items-baseline rounded border border-[var(--borde)] bg-white px-1.5 font-mono text-[11.5px] text-acento-700 hover:border-acento-200">{x} ↗</Link>
        : <span key={i} className="font-mono text-[12px]">{x}</span>
    })
  }
  const pasos = bloques.filter((b) => b.tipo === 'paso').length > 0
  let n = 0
  return (
    <div className={`grid gap-2.5 text-[14px] leading-relaxed ${pasos ? '' : ''}`}>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'parrafo':
            return <p key={i} className="max-w-[72ch]">{conReferencias(b.texto)}</p>
          case 'lista':
            return <ul key={i} className="grid max-w-[72ch] list-disc gap-1 pl-5">{b.items.map((x, j) => <li key={j}>{conReferencias(x)}</li>)}</ul>
          case 'tabla':
            return (
              <div key={i} className="overflow-x-auto rounded-lg border border-[var(--borde)]">
                <table className="w-full text-[13px]"><tbody>
                  {b.filas.map((f, j) => (
                    <tr key={j} className={j === 0 ? 'bg-marca-50 font-medium' : ''}>{f.map((c, k) => <td key={k} className="border-t border-[var(--borde)] px-3 py-1.5 align-top first:border-t-0">{conReferencias(c)}</td>)}</tr>
                  ))}
                </tbody></table>
              </div>
            )
          case 'paso':
            n++
            return (
              <div key={i} className="grid grid-cols-1 gap-1 border-t border-dashed border-[var(--borde)] pt-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-3">
                <span className="flex items-start gap-2 text-[12.5px] font-semibold"><i aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-sm bg-[#2c5d9c]" />{b.responsable ?? ''}</span>
                <p className="max-w-[72ch]"><span className="mr-1 font-mono text-[12px] text-marca-500">{n}.</span>{conReferencias(b.actividad)}</p>
              </div>
            )
          case 'decision':
            return (
              <div key={i} className="grid gap-2 rounded-lg border border-[var(--borde)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <p className="text-[13px] font-semibold sm:col-span-2"><Chip tono="formatos">Decisión</Chip> {b.pregunta}</p>
                {b.si && <p className="text-[13px]"><b className="text-[11.5px]">Sí → </b>{conReferencias(b.si)}</p>}
                {b.no && <p className="text-[13px]"><b className="text-[11.5px]">No → </b>{conReferencias(b.no)}</p>}
              </div>
            )
          case 'referencia': {
            const h = enlaceDe(b.codigo)
            const cuerpo = <><span className="font-mono text-[11.5px] text-acento-700">{b.codigo}</span><span>{b.titulo ?? ''}</span></>
            return h
              ? <Link key={i} href={h} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 rounded-lg border border-[var(--borde)] px-3 py-1.5 text-[13px] hover:bg-marca-50">{cuerpo}</Link>
              : <div key={i} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2 rounded-lg border border-[var(--borde)] px-3 py-1.5 text-[13px]">{cuerpo}</div>
          }
        }
      })}
    </div>
  )
}
