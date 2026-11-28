import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requerirPermiso } from '@/lib/auth'
import { activos, estadoDocumental, leerMapa, principales } from '@/lib/plataforma/procesos-vivos'
import { createClient } from '@/lib/supabase/server'
import { BOTON_CABECERA, CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Chip, ChipDoc, FilaProceso } from '@/components/sistema/procesos/vivos'

export const metadata: Metadata = { title: 'Macroproceso · Procesos' }

const TIPO: Record<string, string> = { estrategico: 'Estratégico', operativo: 'Operativo', soporte: 'Soporte' }

/** Un macroproceso: sus procesos con los documentos de cada uno (los sugeridos, en ámbar) y cómo está documentado. */
export default async function MacroprocesoPage({ params }: PageProps<'/sistema/nucleo/procesos/m/[codigo]'>) {
  const [sesion, { codigo }] = await Promise.all([requerirPermiso('sistema:procesos'), params])
  const supabase = await createClient()
  const mapa = await leerMapa(supabase)
  const m = mapa.porCodigo.get(decodeURIComponent(codigo))
  if (!m || m.nivel !== 0) notFound()
  const ps = mapa.hijos(m.ref)
  const estados = ps.map((p) => estadoDocumental(p).tono)
  const n = (t: string) => estados.filter((x) => x === t).length
  const propios = principales(activos(m.docs))
  const total = new Set([m, ...ps, ...ps.flatMap((p) => mapa.hijos(p.ref))].flatMap((p) => principales(activos(p.docs)).map((d) => d.id))).size
  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-PRO"
        titulo="Procesos"
        migas={[{ etiqueta: 'Mapa', href: '/sistema/nucleo/procesos' }, { etiqueta: `${m.codigo} ${m.nombre}` }]}
        acciones={<Link href="/sistema/nucleo/procesos/herramientas" className={BOTON_CABECERA}>Herramientas del SGC</Link>}
      />
      <section className="overflow-hidden rounded-2xl border border-[var(--borde)] bg-white shadow-[var(--sombra-tarjeta)]" data-macroproceso={m.codigo}>
        <div className="grid gap-2 px-5 pb-4 pt-5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-marca-500">
            Macroproceso {m.codigo} · {TIPO[m.tipo ?? ''] ?? ''}{m.codigoSgc ? ` · código SGC ${m.codigoSgc}` : ''}
          </span>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold">{m.nombre}</h1>
            <Link href={`/sistema/nucleo/procesos/${m.ref}`} className={BOTON_CABECERA}>Caracterización del macroproceso</Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {n('ok') > 0 && <Chip tono="ok">{n('ok')} documentados</Chip>}
            {n('sugerido') > 0 && <Chip tono="sugerido">{n('sugerido')} con enlace sugerido</Chip>}
            {n('borrador') > 0 && <Chip tono="borrador">{n('borrador')} con borrador</Chip>}
            {n('formatos') > 0 && <Chip tono="formatos">{n('formatos')} solo con formatos</Chip>}
            {n('sin') > 0 && <Chip tono="sin">{n('sin')} sin documentar</Chip>}
            <Chip>{total} documentos</Chip>
          </div>
        </div>
        {propios.length > 0 && (
          <div className="grid gap-1.5 border-t border-[var(--borde)] bg-marca-50 px-4 py-3 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-3">
            <span className="font-mono text-[12.5px] text-marca-500">{m.codigo}</span>
            <div className="grid gap-1.5">
              <b className="text-sm">Documentos del macroproceso completo</b>
              <div className="flex flex-wrap gap-1.5">{propios.slice(0, 8).map((d) => <ChipDoc key={d.id} d={d} />)}{propios.length > 8 && <Link href={`/sistema/nucleo/procesos/${m.ref}?p=documentos`} className="rounded-md border border-[var(--borde)] bg-white px-2 py-0.5 text-xs">+{propios.length - 8} más</Link>}</div>
            </div>
          </div>
        )}
        <div>{ps.map((p) => <FilaProceso key={p.ref} p={p} mapa={mapa} />)}</div>
      </section>
    </>
  )
}
