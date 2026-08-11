import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoChat, IconoUsuarios } from '@/components/iconos'
import { haceCuanto, iniciales, requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mensajes' }

export default async function MensajesPage() {
  const yo = await requerirEmpleado()
  const supabase = await createClient()
  const ahora = new Date()

  const { data: participaciones } = await supabase
    .from('conversacion_participantes')
    .select('conversacion_id, visto_en, conversaciones(tipo, grupo_id, grupos(nombre))')
    .eq('empleado_id', yo.id)

  const ids = (participaciones ?? []).map((p) => p.conversacion_id)

  // Con quién es cada hilo directo, y qué fue lo último que se dijo. Dos
  // consultas en lugar de dos por conversación.
  const [{ data: otros }, { data: mensajes }] = ids.length
    ? await Promise.all([
        supabase
          .from('conversacion_participantes')
          .select('conversacion_id, empleados(id, nombre_completo, cargo)')
          .in('conversacion_id', ids)
          .neq('empleado_id', yo.id),
        supabase
          .from('mensajes')
          .select('conversacion_id, texto, autor_id, created_at')
          .in('conversacion_id', ids)
          .eq('estado', 'visible')
          .order('created_at', { ascending: false })
          .limit(300),
      ])
    : [{ data: null }, { data: null }]

  const acompanante = new Map<string, { nombre_completo: string; cargo: string | null }>()
  for (const o of otros ?? []) {
    if (o.empleados && !acompanante.has(o.conversacion_id)) {
      acompanante.set(o.conversacion_id, o.empleados)
    }
  }

  const ultimo = new Map<string, { texto: string; autor_id: string; created_at: string }>()
  for (const m of mensajes ?? []) {
    if (!ultimo.has(m.conversacion_id)) ultimo.set(m.conversacion_id, m)
  }

  const hilos = (participaciones ?? [])
    .map((p) => {
      const conv = p.conversaciones
      const esGrupo = conv?.tipo === 'grupo'
      const otro = acompanante.get(p.conversacion_id)
      const msg = ultimo.get(p.conversacion_id)
      return {
        id: p.conversacion_id,
        esGrupo,
        titulo: esGrupo
          ? (conv?.grupos?.nombre ?? 'Grupo')
          : (otro?.nombre_completo ?? 'Conversación'),
        subtitulo: esGrupo ? 'Grupo de trabajo' : (otro?.cargo ?? ''),
        mensaje: msg?.texto ?? null,
        mio: msg?.autor_id === yo.id,
        cuando: msg?.created_at ?? null,
        sinLeer:
          !!msg && msg.autor_id !== yo.id && (!p.visto_en || msg.created_at > p.visto_en),
      }
    })
    // Los hilos con actividad reciente arriba; los vacíos, al final.
    .sort((a, b) => (b.cuando ?? '').localeCompare(a.cuando ?? ''))

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">
          Mensajes
        </h1>
        <p className="mt-1 text-[13px] text-marca-500">
          Conversaciones directas con tus compañeros
        </p>
      </header>

      {hilos.length === 0 ? (
        <div className="tarjeta-canal px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-100 text-marca-400">
            <IconoChat className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-marca-900">
            Todavía no has conversado con nadie
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-marca-500">
            Busca a un compañero en el directorio y escríbele.
          </p>
          <Link href="/canal/gente" className="btn-canal btn-canal-rojo mt-5">
            <IconoUsuarios className="h-4 w-4" />
            Ir al directorio
          </Link>
        </div>
      ) : (
        <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
          {hilos.map((hilo) => (
            <li key={hilo.id}>
              <Link
                href={`/canal/mensajes/${hilo.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-marca-50"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marca-100 text-sm font-bold text-marca-700">
                  {iniciales(hilo.titulo)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-marca-900">
                    {hilo.titulo}
                  </p>
                  <p className="truncate text-[13px] text-marca-500">
                    {hilo.mensaje
                      ? `${hilo.mio ? 'Tú: ' : ''}${hilo.mensaje}`
                      : hilo.subtitulo || 'Sin mensajes todavía'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-marca-400">
                    {haceCuanto(hilo.cuando, ahora)}
                  </span>
                  {hilo.sinLeer && (
                    <span className="h-2 w-2 rounded-full bg-acento-600" />
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
