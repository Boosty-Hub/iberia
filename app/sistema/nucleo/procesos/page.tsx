import type { Metadata } from 'next'
import Link from 'next/link'
import { EncabezadoPagina, Insignia, Metrica } from '@/components/ui'
import { FAMILIAS, fichaVacia, normalizarFicha } from '@/components/sistema/procesos/comun'
import { activarProgramados, conteoDocumentos, leerCatalogo, leerProcesos } from '@/components/sistema/procesos/datos'
import { Codigos, InsigniaEstadoOperativo, PestanasProcesos } from '@/components/sistema/procesos/piezas'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mapa de procesos · Plataforma Iberia' }

/**
 * El mapa de procesos (NUC-PRO), dibujado desde el dato: los macroprocesos de
 * nivel 0 agrupados por tipo —estratégicos, cadena de valor, soporte— y, dentro
 * de cada uno, sus procesos de nivel 1. Nada de esto está escrito a mano: si
 * alguien publica un proceso nuevo, aparece aquí.
 *
 * En el teléfono las tarjetas van en una columna y los procesos en lista: el
 * lienzo navegable de la Fase 1 no se lee a 390 px.
 */
export default async function MapaProcesosPage() {
  const sesion = await requerirPermiso('sistema:procesos')
  const supabase = await createClient()
  await activarProgramados(supabase)

  const [{ vigentes, abiertos }, catalogo] = await Promise.all([leerProcesos(supabase), leerCatalogo(supabase)])
  const { acumulado } = await conteoDocumentos(supabase, vigentes)

  const hijos = new Map<string, typeof vigentes>()
  for (const p of vigentes) if (p.padre_ref) (hijos.get(p.padre_ref) ?? hijos.set(p.padre_ref, []).get(p.padre_ref)!).push(p)
  const macros = vigentes.filter((p) => p.nivel === 0)
  const porNivel = (n: number) => vigentes.filter((p) => p.nivel === n).length
  const conFicha = vigentes.filter((p) => !fichaVacia(normalizarFicha(p.ficha))).length
  const sinDueno = vigentes.filter((p) => p.nivel <= 1 && !p.dueno_plaza_ref).length
  const nuevos = [...abiertos.values()].filter((p) => !vigentes.some((v) => v.ref === p.ref)).length

  const descendientes = (ref: string): number => (hijos.get(ref) ?? []).reduce((s, h) => s + 1 + descendientes(h.ref), 0)

  return (
    <>
      <EncabezadoPagina
        rotulo="Procesos"
        titulo="Mapa de procesos"
        descripcion="Los macroprocesos de Iberia y sus procesos, con el código del SGC y el del informe de la Fase 1. Toca un proceso para abrir su ficha."
      />
      <PestanasProcesos activa="mapa" escenarios={puede(sesion, 'sistema:escenarios')} />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metrica valor={porNivel(0)} etiqueta="Macroprocesos" />
        <Metrica valor={porNivel(1)} sufijo={`+ ${porNivel(2) + porNivel(3)} sub`} etiqueta="Procesos" href="/sistema/nucleo/procesos/arbol" />
        <Metrica valor={conFicha} sufijo={`de ${vigentes.length}`} etiqueta="Con ficha PHVA" href="/sistema/nucleo/procesos/arbol?ficha=con" />
        <Metrica valor={sinDueno} etiqueta="Niveles 0-1 sin dueño" href="/sistema/nucleo/procesos/arbol?dueno=sin" />
      </div>

      {(abiertos.size > 0 || nuevos > 0) && (
        <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {abiertos.size} {abiertos.size === 1 ? 'proceso tiene' : 'procesos tienen'} un borrador o una revisión abierta
          {nuevos > 0 && <> ({nuevos} {nuevos === 1 ? 'es nuevo' : 'son nuevos'} y no salen en el mapa hasta aprobarse)</>}.{' '}
          <Link href="/sistema/nucleo/procesos/arbol?version=abiertos" className="font-semibold underline">
            Verlos en el árbol
          </Link>
        </p>
      )}

      <div className="space-y-10">
        {FAMILIAS.map((f) => {
          const lista = macros.filter((m) => m.tipo === f.tipo)
          if (!lista.length) return null
          return (
            <section key={f.tipo} aria-labelledby={`familia-${f.tipo}`}>
              <div className="mb-3 flex items-center gap-3">
                <span className={cn('h-3 w-3 rounded-full', f.barra)} />
                <h2 id={`familia-${f.tipo}`} className="text-lg font-semibold text-marca-900">
                  {f.tipo === 'operativo' ? f.titulo : (catalogo.tipos[f.tipo] ?? f.titulo)}
                  <span className="ml-2 text-sm font-normal text-marca-500">{f.rotulo}</span>
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {lista.map((m) => {
                  const procesos = hijos.get(m.ref) ?? []
                  const docs = acumulado.get(m.ref)
                  return (
                    <article key={m.ref} className="tarjeta overflow-hidden">
                      <div className={cn('h-1.5', f.barra)} />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Codigos sgc={m.codigo_sgc} informe={m.codigo_informe} />
                            <h3 className="mt-1 text-base leading-snug font-semibold">
                              <Link href={`/sistema/nucleo/procesos/${m.ref}`} className={cn('hover:underline', f.texto)}>
                                {m.nombre}
                              </Link>
                            </h3>
                          </div>
                          {abiertos.has(m.ref) && <Insignia tono="ambar">Borrador</Insignia>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <InsigniaEstadoOperativo estado={m.estado_operativo} etiquetas={catalogo.estados} />
                          <span className="text-xs text-marca-500">
                            {procesos.length} {procesos.length === 1 ? 'proceso' : 'procesos'}
                            {' · '}
                            {docs ? (
                              <Link href={`/sistema/nucleo/procesos/${m.ref}#documentos`} className="hover:text-acento-700 hover:underline">
                                {docs.total} {docs.total === 1 ? 'documento' : 'documentos'} ({docs.vigentes} vigentes)
                              </Link>
                            ) : (
                              'sin documentos'
                            )}
                          </span>
                        </div>
                        {procesos.length > 0 && (
                          <ul className="mt-4 divide-y divide-[var(--borde)] border-t border-[var(--borde)]">
                            {procesos.map((p) => {
                              const sub = descendientes(p.ref)
                              const dp = acumulado.get(p.ref)
                              return (
                                <li key={p.ref}>
                                  <Link
                                    href={`/sistema/nucleo/procesos/${p.ref}`}
                                    className="-mx-2 flex min-h-11 items-start gap-2 rounded-lg px-2 py-2 hover:bg-marca-50"
                                  >
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-sm leading-snug text-marca-800">{p.nombre}</span>
                                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-marca-500">
                                        <Codigos sgc={p.codigo_sgc} informe={p.codigo_informe} />
                                        {sub > 0 && <span>{sub} sub</span>}
                                        {dp && <span>{dp.total} doc.</span>}
                                      </span>
                                    </span>
                                    <span className="flex shrink-0 flex-col items-end gap-1">
                                      <InsigniaEstadoOperativo estado={p.estado_operativo} etiquetas={catalogo.estados} />
                                      {abiertos.has(p.ref) && <Insignia tono="ambar">Borrador</Insignia>}
                                    </span>
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2 text-xs text-marca-500">
        <span className="font-medium text-marca-700">Leyenda:</span>
        {Object.entries(catalogo.estados)
          .filter(([k]) => k !== 'vigente')
          .map(([k]) => (
            <InsigniaEstadoOperativo key={k} estado={k} etiquetas={catalogo.estados} />
          ))}
        <span>· sin insignia = {catalogo.estados.vigente ?? 'se ejecuta'}.</span>
      </div>
    </>
  )
}
