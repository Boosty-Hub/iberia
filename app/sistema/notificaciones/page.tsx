import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirSesion } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { COLUMNAS_NOTIFICACION, aNotificacion } from '@/components/sistema/colaboracion/datos'
import { ListaNotificaciones, MarcarTodoLeido } from '@/components/sistema/colaboracion/lista-notificaciones'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { TIPO_NOTIFICACION, type TipoNotificacion } from '@/lib/plataforma/colaboracion'
import { numero } from '@/lib/plataforma/formato'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Notificaciones · Plataforma Iberia' }

const POR_PAGINA = 40

/**
 * El centro de notificaciones (Anexo E §3): todo lo que me avisó la plataforma,
 * con filtro por tipo y por leídas. Tocar una la marca leída y abre su objeto en
 * el panel lateral. La RLS solo deja ver las propias.
 */
export default async function NotificacionesPage({ searchParams }: PageProps<'/sistema/notificaciones'>) {
  const [sesion, sp] = await Promise.all([requerirSesion(), searchParams])
  const tipo = typeof sp.tipo === 'string' && sp.tipo in TIPO_NOTIFICACION ? (sp.tipo as TipoNotificacion) : null
  const soloNoLeidas = sp.estado === 'no-leidas'
  const pagina = Math.max(1, Number(typeof sp.p === 'string' ? sp.p : 1) || 1)

  const supabase = await createClient()
  const tabla = () => supabase.schema('nucleo').from('notificacion')
  let consulta = tabla()
    .select(COLUMNAS_NOTIFICACION, { count: 'exact' })
    .order('creado_en', { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)
  if (tipo) consulta = consulta.eq('tipo', tipo)
  if (soloNoLeidas) consulta = consulta.is('leida_en', null)

  const claves = Object.keys(TIPO_NOTIFICACION) as TipoNotificacion[]
  const [{ data, count }, noLeidas, ...porTipo] = await Promise.all([
    consulta,
    tabla().select('id', { count: 'exact', head: true }).is('leida_en', null),
    ...claves.map((k) => tabla().select('id', { count: 'exact', head: true }).eq('tipo', k).is('leida_en', null)),
  ])
  const lista = (data ?? []).map(aNotificacion)
  const total = count ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const sinLeer = noLeidas.count ?? 0

  const href = (cambios: Record<string, string | null>) => {
    const q = new URLSearchParams()
    const base = { tipo, estado: soloNoLeidas ? 'no-leidas' : null, p: null as string | null, ...cambios }
    for (const [k, v] of Object.entries(base)) if (v) q.set(k, v)
    const s = q.toString()
    return s ? `/sistema/notificaciones?${s}` : '/sistema/notificaciones'
  }
  const chip = (activo: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs focus-visible:outline-2 focus-visible:outline-acento-500',
      activo ? 'border-[#2b2a28] bg-[#2b2a28] font-semibold text-white' : 'border-[var(--borde)] bg-white text-marca-700 hover:bg-marca-50'
    )

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-DIA"
        titulo="Notificaciones"
        migas={[{ etiqueta: 'Notificaciones' }]}
        descripcion={`${numero(sinLeer)} sin leer. Menciones, aprobaciones, lo que sigues y tus tareas, en un solo buzón.`}
        acciones={<MarcarTodoLeido hay={sinLeer > 0} />}
      />

      <nav aria-label="Filtrar notificaciones" className="mb-3 flex flex-wrap items-center gap-1.5">
        <Link href={href({ tipo: null })} className={chip(!tipo)} aria-current={!tipo ? 'page' : undefined}>
          Todas
        </Link>
        {claves.map((k, i) => (
          <Link key={k} href={href({ tipo: k })} className={chip(tipo === k)} aria-current={tipo === k ? 'page' : undefined}>
            <span aria-hidden>{TIPO_NOTIFICACION[k].marca}</span>
            {TIPO_NOTIFICACION[k].etiqueta}
            {(porTipo[i].count ?? 0) > 0 && (
              <span className={cn('rounded-full px-1.5 text-[10.5px]', tipo === k ? 'bg-white/20' : 'bg-[#eaf2fb] text-[#2f5f9a]')}>
                {porTipo[i].count}
                <span className="sr-only"> sin leer</span>
              </span>
            )}
          </Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-[var(--borde)] sm:block" aria-hidden />
        <Link href={href({ estado: soloNoLeidas ? null : 'no-leidas' })} className={chip(soloNoLeidas)}>
          {soloNoLeidas ? '✓ ' : ''}Solo sin leer
        </Link>
      </nav>

      <section className="overflow-hidden rounded-xl border border-[var(--borde)] bg-white" aria-label="Notificaciones">
        {!lista.length ? (
          <p className="px-4 py-10 text-center text-[13px] text-marca-400">
            {tipo || soloNoLeidas ? 'Nada con ese filtro.' : 'Todavía no tienes notificaciones. Cuando te mencionen, te asignen una tarea o te toque aprobar, llega aquí.'}
          </p>
        ) : (
          <ListaNotificaciones lista={lista} />
        )}
      </section>

      {paginas > 1 && (
        <nav aria-label="Páginas" className="mt-3 flex items-center justify-between text-xs text-marca-600">
          <span>
            {numero((pagina - 1) * POR_PAGINA + 1)}–{numero(Math.min(pagina * POR_PAGINA, total))} de {numero(total)}
          </span>
          <span className="flex gap-2">
            {pagina > 1 && (
              <Link href={href({ p: String(pagina - 1) })} className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-3 hover:bg-marca-50">
                ← Anteriores
              </Link>
            )}
            {pagina < paginas && (
              <Link href={href({ p: String(pagina + 1) })} className="inline-flex h-8 items-center rounded-lg border border-[var(--borde)] bg-white px-3 hover:bg-marca-50">
                Más viejas →
              </Link>
            )}
          </span>
        </nav>
      )}
    </>
  )
}
