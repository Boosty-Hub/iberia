import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { catalogoIa, nombresDe } from '@/lib/ia/servidor'
import { ACCIONES_ACTIVIDAD, ESTADOS_PROPUESTA, sigueAbierta, type NivelIa } from '@/lib/ia/niveles'
import { esFecha, fechaHora, numero } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { NivelIA } from '@/components/sistema/ia/nivel-ia'
import { BotonDeshacer } from '@/components/sistema/ia/deshacer'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Actividad de la IA · Administración' }

const POR_PAGINA = 40
const TIPO_FICHA = new Set(['unidad', 'plaza', 'cargo', 'persona', 'requisicion', 'escenario', 'proceso', 'documento'])
const EDITA: Record<string, string> = { documento: 'sistema:documentos', plaza: 'sistema:estructura' }

type Fila = {
  id: string
  capacidad: string | null
  nivel: NivelIa | null
  accion: string
  objeto_tipo: string | null
  objeto_id: string | null
  propuesta_id: string | null
  resumen: string
  evidencia: { tipo?: string; id?: string | null; campo?: string; valor?: unknown; fuente?: string }[]
  actor_es_ia: boolean
  pedido_por: string | null
  aprobado_por: string | null
  costo_tokens: number
  costo_usd: number
  latencia_ms: number | null
  modelo: string | null
  creado_en: string
}

/**
 * La actividad de la IA (Anexo E §7): el registro que no se corrige ni se
 * borra —hora, capacidad, nivel, objeto, qué hizo, evidencia, quién lo pidió y
 * quién decidió, tokens y costo—, con filtros. Lo de un objeto lo ve solo quien
 * puede leer el objeto (RLS); lo que la IA aplicó sola se deshace aquí mismo.
 */
export default async function ActividadIaPage({ searchParams }: PageProps<'/sistema/administracion/ia/actividad'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:ia-actividad'), searchParams])
  const uno = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '')
  const f = { capacidad: uno('capacidad'), nivel: uno('nivel'), accion: uno('accion'), actor: uno('actor'), desde: uno('desde'), hasta: uno('hasta') }
  const pagina = Math.max(1, Number(uno('pag')) || 1)
  const supabase = await createClient()

  let q = supabase
    .schema('ia')
    .from('actividad')
    .select('id, capacidad, nivel, accion, objeto_tipo, objeto_id, propuesta_id, resumen, evidencia, actor_es_ia, pedido_por, aprobado_por, costo_tokens, costo_usd, latencia_ms, modelo, creado_en', {
      count: 'exact',
    })
  if (f.capacidad) q = q.eq('capacidad', f.capacidad)
  if (/^N[0-4]$/.test(f.nivel)) q = q.eq('nivel', f.nivel)
  if (f.accion && ACCIONES_ACTIVIDAD[f.accion]) q = q.eq('accion', f.accion)
  if (f.actor === 'ia') q = q.eq('actor_es_ia', true)
  if (f.actor === 'persona') q = q.eq('actor_es_ia', false)
  if (esFecha(f.desde)) q = q.gte('creado_en', `${f.desde}T00:00:00-04:00`)
  if (esFecha(f.hasta)) q = q.lte('creado_en', `${f.hasta}T23:59:59-04:00`)
  const desde = (pagina - 1) * POR_PAGINA
  const [{ data, count }, catalogo] = await Promise.all([q.order('creado_en', { ascending: false }).range(desde, desde + POR_PAGINA - 1), catalogoIa()])
  const filas = (data ?? []) as unknown as Fila[]

  // Los títulos de los objetos (y de lo que cita la evidencia), solo los que quien mira puede leer.
  const objetos = new Map<string, { tipo: string; id: string }>()
  for (const r of filas) {
    if (r.objeto_tipo && r.objeto_id) objetos.set(`${r.objeto_tipo}:${r.objeto_id}`, { tipo: r.objeto_tipo, id: r.objeto_id })
    for (const e of r.evidencia ?? []) if (e.tipo && e.id && TIPO_FICHA.has(e.tipo)) objetos.set(`${e.tipo}:${e.id}`, { tipo: e.tipo, id: String(e.id) })
  }
  const lista = [...objetos.values()].slice(0, 400)
  const propuestas = [...new Set(filas.map((r) => r.propuesta_id).filter(Boolean))] as string[]
  const [{ data: titulos }, { data: props }, nombres] = await Promise.all([
    lista.length ? supabase.schema('nucleo').rpc('titulos_objetos', { p_tipos: lista.map((o) => o.tipo), p_ids: lista.map((o) => o.id) }) : { data: [] },
    propuestas.length ? supabase.schema('ia').from('propuesta').select('id, estado, nivel, deshacer_hasta').in('id', propuestas) : { data: [] },
    nombresDe(filas.flatMap((r) => [r.pedido_por, r.aprobado_por])),
  ])
  const titulo = new Map((titulos ?? []).map((t) => [`${t.tipo}:${t.id}`, t.titulo]))
  const propuesta = new Map((props ?? []).map((p) => [p.id, p]))
  const total = count ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  const enlace = (cambios: Record<string, string | null>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries({ ...f, pag: String(pagina), ...cambios })) if (v) u.set(k, v)
    if (!('pag' in cambios)) u.delete('pag')
    const s = u.toString()
    return `/sistema/administracion/ia/actividad${s ? `?${s}` : ''}`
  }

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-GIA"
        migas={[{ etiqueta: 'Actividad de la IA' }]}
        descripcion="Todo lo que hizo la IA y lo que decidieron las personas sobre sus propuestas. No se corrige ni se borra. Lo de cada objeto lo ves solo si puedes leer el objeto."
      />

      <form method="get" className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-[var(--borde)] bg-white p-3 text-[12px]" aria-label="Filtros de la actividad">
        <label className="flex flex-col gap-0.5 text-marca-500">
          Capacidad
          <select name="capacidad" defaultValue={f.capacidad} className="campo h-8 max-w-[220px]">
            <option value="">Todas</option>
            {catalogo.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.codigo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-marca-500">
          Nivel
          <select name="nivel" defaultValue={f.nivel} className="campo h-8">
            <option value="">Todos</option>
            {['N1', 'N2', 'N3', 'N4'].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-marca-500">
          Qué pasó
          <select name="accion" defaultValue={f.accion} className="campo h-8">
            <option value="">Todo</option>
            {Object.entries(ACCIONES_ACTIVIDAD).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-marca-500">
          Quién
          <select name="actor" defaultValue={f.actor} className="campo h-8">
            <option value="">IA y personas</option>
            <option value="ia">Solo la IA</option>
            <option value="persona">Solo personas</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-marca-500">
          Desde
          <input type="date" name="desde" defaultValue={f.desde} className="campo h-8" />
        </label>
        <label className="flex flex-col gap-0.5 text-marca-500">
          Hasta
          <input type="date" name="hasta" defaultValue={f.hasta} className="campo h-8" />
        </label>
        <button type="submit" className="inline-flex h-8 items-center rounded-lg bg-[#2b2a28] px-3 font-semibold text-white">
          Filtrar
        </button>
        {Object.values(f).some(Boolean) && (
          <Link href="/sistema/administracion/ia/actividad" className="inline-flex h-8 items-center px-1 text-marca-600 underline">
            Quitar filtros
          </Link>
        )}
        <span className="ml-auto self-center text-marca-400">{numero(total)} entradas</span>
      </form>

      {filas.length ? (
        <ol className="ml-2 border-l-2 border-[#e6dff7] pl-4" data-feed-ia>
          {filas.map((r) => {
            const p = r.propuesta_id ? propuesta.get(r.propuesta_id) : null
            const obj = r.objeto_tipo && r.objeto_id ? titulo.get(`${r.objeto_tipo}:${r.objeto_id}`) : null
            const deshacible = r.accion === 'aplico' && p?.estado === 'aceptada' && p.nivel === 'N4' && sigueAbierta(p.deshacer_hasta)
            const quien = r.actor_es_ia ? (r.pedido_por ? `Lo pidió ${nombres.get(r.pedido_por) ?? 'una persona'}` : null) : (nombres.get(r.aprobado_por ?? r.pedido_por ?? '') ?? 'Una persona')
            return (
              <li key={r.id} className="relative mb-3" data-actividad={r.accion}>
                <span aria-hidden className={cn('absolute top-0 -left-[23px] bg-[#f4f5f7] px-0.5 text-[12px]', r.actor_es_ia ? 'text-[#5a3f9e]' : 'text-marca-500')}>
                  {r.actor_es_ia ? '✦' : '●'}
                </span>
                <div className="rounded-xl border border-[var(--borde)] bg-white p-2.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    <time className="font-semibold text-marca-800 tabular-nums" dateTime={r.creado_en}>
                      {fechaHora(r.creado_en)}
                    </time>
                    {r.nivel && r.nivel !== 'N0' && <NivelIA nivel={r.nivel} />}
                    {r.capacidad && <span className="font-mono text-[10.5px] text-marca-400">{r.capacidad}</span>}
                    <span className={cn('rounded-full px-1.5 text-[10.5px] font-semibold', r.actor_es_ia ? 'bg-[#f1edfa] text-[#5a3f9e]' : 'bg-[#eef0f3] text-marca-600')}>
                      {r.actor_es_ia ? 'IA' : 'Persona'} · {ACCIONES_ACTIVIDAD[r.accion] ?? r.accion}
                    </span>
                  </p>
                  <p className="mt-1 text-[13px] text-marca-900">{r.resumen}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11.5px] text-marca-500">
                    {obj && r.objeto_tipo && (
                      <Link href={`/sistema/ficha/${r.objeto_tipo}/${r.objeto_id}`} className="text-[#1d4f8f] underline">
                        {obj}
                      </Link>
                    )}
                    {quien && <span>{quien}</span>}
                    {p && <span>Propuesta: {ESTADOS_PROPUESTA[p.estado] ?? p.estado}</span>}
                    {r.costo_tokens > 0 && (
                      <span className="tabular-nums">
                        {numero(r.costo_tokens)} tokens · US$ {numero(Number(r.costo_usd), 4)}
                        {r.latencia_ms ? ` · ${numero(r.latencia_ms / 1000, 1)} s` : ''}
                        {r.modelo ? ` · ${r.modelo}` : ''}
                      </span>
                    )}
                  </p>
                  {r.evidencia?.length > 0 && (
                    <details className="mt-1 text-[12px]">
                      <summary className="cursor-pointer text-marca-500 select-none">Evidencia ({r.evidencia.length})</summary>
                      <ul className="mt-1 flex flex-col gap-0.5 text-marca-600">
                        {r.evidencia.slice(0, 30).map((e, i) => {
                          const t = e.tipo && e.id ? titulo.get(`${e.tipo}:${e.id}`) : null
                          return (
                            <li key={i}>
                              › {t ? <Link href={`/sistema/ficha/${e.tipo}/${e.id}`} className="text-[#1d4f8f] underline">{t}</Link> : e.tipo && TIPO_FICHA.has(e.tipo) ? <span className="text-marca-400">un registro fuera de tu alcance</span> : null}
                              {e.campo && <> · {e.campo}</>}
                              {e.valor !== undefined && e.valor !== null && <> = {String(e.valor)}</>}
                              {e.fuente && <span className="text-marca-400"> · {e.fuente}</span>}
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  )}
                  {deshacible && p?.deshacer_hasta && (
                    <div className="mt-1.5">
                      <BotonDeshacer propuesta={p.id} hasta={p.deshacer_hasta} puede={Boolean(r.objeto_tipo && EDITA[r.objeto_tipo] && puede(sesion, EDITA[r.objeto_tipo], 'editar'))} />
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="rounded-xl border border-[var(--borde)] bg-white p-6 text-center text-marca-400">Nada con estos filtros a tu alcance.</p>
      )}

      {paginas > 1 && (
        <nav className="mt-3 flex items-center justify-center gap-2 text-[12px]" aria-label="Páginas">
          {pagina > 1 && (
            <Link href={enlace({ pag: String(pagina - 1) })} className="rounded-lg border border-[var(--borde)] bg-white px-2.5 py-1 hover:bg-marca-50">
              ← Más recientes
            </Link>
          )}
          <span className="text-marca-500">
            Página {pagina} de {paginas}
          </span>
          {pagina < paginas && (
            <Link href={enlace({ pag: String(pagina + 1) })} className="rounded-lg border border-[var(--borde)] bg-white px-2.5 py-1 hover:bg-marca-50">
              Más antiguas →
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
