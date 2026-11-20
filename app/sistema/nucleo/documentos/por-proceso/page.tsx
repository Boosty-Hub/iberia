import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { hoyCaracas, numero } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { todosLosDocumentos, todosLosProcesos } from '@/components/sistema/procesos/datos-r2'
import { SelloFuente } from '@/components/sistema/ui/kpi'

export const metadata: Metadata = { title: 'Por proceso · Documentos' }

const BIBLIOTECA = '/sistema/nucleo/documentos?ver=todos'
type Cuenta = { vigentes: number; otros: number; obsoletos: number }
const vacia = (): Cuenta => ({ vigentes: 0, otros: 0, obsoletos: 0 })

/**
 * Los documentos colgados del árbol de procesos: macroproceso → proceso →
 * subproceso, con cuántos hay vigentes, por decidir y obsoletos en cada nodo
 * (y lo que suman debajo). Un número abre la biblioteca filtrada; el nombre
 * abre la ficha del proceso. Al final, lo que no cuelga de ningún proceso,
 * por su XX. Con la RLS de quien mira (el perímetro no cuenta sin permiso).
 */
export default async function DocumentosPorProcesoPage() {
  const sesion = await requerirPermiso('sistema:documentos')
  const supabase = await createClient()
  const veProcesos = puede(sesion, 'sistema:procesos')
  const [docs, procesos] = await Promise.all([todosLosDocumentos(supabase), veProcesos ? todosLosProcesos(supabase, hoyCaracas()) : Promise.resolve([])])

  const propio = new Map<string, Cuenta>()
  const sinProceso = new Map<string, { etiqueta: string; c: Cuenta }>()
  for (const d of docs) {
    const tramo: keyof Cuenta = d.estado === 'vigente' ? 'vigentes' : d.estado === 'obsoleto' || d.estado === 'retirado' ? 'obsoletos' : 'otros'
    if (d.proceso_ref) {
      const c = propio.get(d.proceso_ref) ?? vacia()
      c[tramo]++
      propio.set(d.proceso_ref, c)
    } else {
      const k = d.proceso_xx ?? '∅'
      const g = sinProceso.get(k) ?? { etiqueta: d.proceso_xx_etiqueta ?? 'Sin código de proceso', c: vacia() }
      g.c[tramo]++
      sinProceso.set(k, g)
    }
  }
  // Lo de debajo se suma hacia arriba.
  const padre = new Map(procesos.map((p) => [p.ref, p.padre_ref]))
  const acumulado = new Map<string, Cuenta>()
  for (const [ref, c] of propio) {
    let r: string | null | undefined = ref
    for (let i = 0; r && i < 8; i++) {
      const a = acumulado.get(r) ?? vacia()
      a.vigentes += c.vigentes
      a.otros += c.otros
      a.obsoletos += c.obsoletos
      acumulado.set(r, a)
      r = padre.get(r)
    }
  }
  const total = (c?: Cuenta) => (c ? c.vigentes + c.otros + c.obsoletos : 0)
  const macros = procesos.filter((p) => p.nivel === 0)
  const sinMacro = docs.filter((d) => d.proceso_ref && !padre.has(d.proceso_ref)).length

  const cifras = (c: Cuenta | undefined, filtro: string) => (
    <span className="flex shrink-0 items-center gap-1 text-[11.5px] tabular-nums">
      <Link href={`${BIBLIOTECA}&${filtro}&f.estado=vigente`} className="w-12 rounded px-1 text-right text-[#1f6f4b] hover:bg-[#e7f5ee]" title="Vigentes">
        ✓ {numero(c?.vigentes ?? 0)}
      </Link>
      <Link href={`${BIBLIOTECA}&${filtro}&f.estado=sin_determinar&f.estado=borrador`} className="w-12 rounded px-1 text-right text-[#8a5a12] hover:bg-[#fdf4e3]" title="Sin determinar o borrador">
        ? {numero(c?.otros ?? 0)}
      </Link>
      <Link href={`${BIBLIOTECA}&${filtro}&f.estado=obsoleto&f.estado=retirado`} className="w-12 rounded px-1 text-right text-marca-500 hover:bg-[#eef0f3]" title="Obsoletos o retirados">
        – {numero(c?.obsoletos ?? 0)}
      </Link>
    </span>
  )

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-DOC"
        titulo="Documentos"
        migas={[{ etiqueta: 'Por proceso' }]}
        descripcion="Los documentos colgados del árbol de procesos. ✓ vigentes · ? sin determinar o borrador · – obsoletos. Cada número abre la biblioteca filtrada; el nombre, la ficha del proceso."
      />
      <SelloFuente fuente="sgc.documento × sgc.proceso" en={new Date().toISOString()} className="mb-2" />
      {!veProcesos && <p className="mb-3 rounded-lg bg-[#fdf4e3] px-3 py-2 text-[12.5px] text-[#8a5a12]">Tu rol no ve el catálogo de procesos: abajo solo sale el reparto por código XX.</p>}

      <div className="flex flex-col gap-2">
        {macros.map((m) => {
          const hijos = procesos.filter((p) => p.macro_ref === m.ref && p.nivel > 0 && total(acumulado.get(p.ref)) > 0)
          const c = acumulado.get(m.ref)
          return (
            <details key={m.ref} className="group rounded-xl border border-[var(--borde)] bg-white" open={total(c) > 0 && macros.length <= 3}>
              <summary className="flex min-h-10 cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
                <span aria-hidden className="text-marca-400 transition-transform group-open:rotate-90">▸</span>
                <span className="w-10 shrink-0 font-mono text-[11px] text-marca-500">{m.codigo}</span>
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-marca-900">{m.nombre}</span>
                <span className="text-[11px] text-marca-400">{numero(hijos.length)} procesos con documentos</span>
                {cifras(c, `f.macro=${encodeURIComponent(m.nombre)}`)}
              </summary>
              {hijos.length > 0 && (
                <ul className="border-t border-[var(--borde)]">
                  {hijos.map((p) => (
                    <li key={p.ref} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-[#eef0f3] px-3 py-1.5 last:border-b-0">
                      <span className="w-10 shrink-0 font-mono text-[11px] text-marca-500">{p.codigo_sgc ?? p.codigo_informe}</span>
                      <Link href={`?ficha=proceso:${p.ref}`} scroll={false} className="min-w-0 flex-1 truncate text-[12.5px] text-marca-800 hover:underline" style={{ paddingLeft: `${(p.nivel - 1) * 16}px` }}>
                        {p.nombre}
                      </Link>
                      {total(propio.get(p.ref)) !== total(acumulado.get(p.ref)) && <span className="text-[10.5px] text-marca-400">propios {numero(total(propio.get(p.ref)))}</span>}
                      {cifras(acumulado.get(p.ref), `f.proceso_ref=${p.ref}`)}
                    </li>
                  ))}
                </ul>
              )}
            </details>
          )
        })}
      </div>

      <section className="mt-4 rounded-xl border border-[var(--borde)] bg-white p-3.5">
        <h2 className="text-[13px] font-semibold text-marca-900">Sin proceso vinculado, por su código XX</h2>
        <p className="mb-2 text-[11.5px] text-marca-500">
          Documentos que la carga no pudo colgar de un proceso del catálogo{sinMacro ? ` (y ${numero(sinMacro)} que cuelgan de un proceso que ya no rige)` : ''}. Se vinculan desde la ficha del
          documento.
        </p>
        <ul className="divide-y divide-[#eef0f3]">
          {[...sinProceso.entries()]
            .sort((a, b) => total(b[1].c) - total(a[1].c))
            .map(([k, g]) => (
              <li key={k} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5">
                <span className="min-w-0 flex-1 text-[12.5px] text-marca-800">{g.etiqueta}</span>
                {cifras(g.c, `f.proceso_ref=%E2%88%85&f.proceso_xx=${encodeURIComponent(k)}`)}
              </li>
            ))}
        </ul>
      </section>
    </>
  )
}
