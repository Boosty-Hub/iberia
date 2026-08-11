import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras, IconoEnviar } from '@/components/iconos'
import { haceCuanto, iniciales, requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { enviarMensaje, marcarVisto } from './acciones'

export const metadata: Metadata = { title: 'Conversación' }

export default async function ConversacionPage({
  params,
}: PageProps<'/canal/mensajes/[id]'>) {
  const [yo, { id }] = await Promise.all([requerirEmpleado(), params])
  const supabase = await createClient()
  const ahora = new Date()

  // RLS solo devuelve la conversación si participo en ella; si no, es un 404
  // igual que si no existiera.
  const { data: conversacion } = await supabase
    .from('conversaciones')
    .select('id, tipo, grupos(nombre)')
    .eq('id', id)
    .maybeSingle()

  if (!conversacion) notFound()

  const [{ data: otros }, { data: mensajes }] = await Promise.all([
    supabase
      .from('conversacion_participantes')
      .select('empleados(nombre_completo, cargo)')
      .eq('conversacion_id', id)
      .neq('empleado_id', yo.id),
    supabase
      .from('mensajes')
      .select('id, texto, autor_id, created_at, empleados(nombre_completo)')
      .eq('conversacion_id', id)
      .eq('estado', 'visible')
      .order('created_at', { ascending: true })
      .limit(200),
  ])

  const otro = otros?.[0]?.empleados ?? null
  const titulo =
    conversacion.tipo === 'grupo'
      ? (conversacion.grupos?.nombre ?? 'Grupo')
      : (otro?.nombre_completo ?? 'Conversación')

  await marcarVisto(id)

  return (
    <div className="flex min-h-[calc(100dvh-9.5rem)] flex-col">
      <header className="mb-3 flex items-center gap-3">
        <Link
          href="/canal/mensajes"
          aria-label="Volver a mensajes"
          className="-ml-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-full text-marca-500 active:bg-marca-100"
        >
          <IconoAtras className="h-5 w-5" />
        </Link>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-marca-100 text-sm font-bold text-marca-700">
          {iniciales(titulo)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold text-marca-900">{titulo}</p>
          <p className="truncate text-[12px] text-marca-500">
            {conversacion.tipo === 'grupo' ? 'Grupo de trabajo' : (otro?.cargo ?? '')}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-2 pb-4">
        {!mensajes?.length ? (
          <p className="px-6 py-10 text-center text-[15px] leading-relaxed text-marca-500">
            Escribe el primer mensaje.
          </p>
        ) : (
          mensajes.map((m) => {
            const mio = m.autor_id === yo.id
            return (
              <div
                key={m.id}
                className={cn('flex', mio ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5',
                    mio
                      ? 'rounded-br-sm bg-acento-600 text-white'
                      : 'rounded-bl-sm bg-white text-marca-900 ring-1 ring-marca-200/70'
                  )}
                >
                  {!mio && conversacion.tipo === 'grupo' && (
                    <p className="mb-0.5 text-[11px] font-semibold text-marca-500">
                      {m.empleados?.nombre_completo}
                    </p>
                  )}
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {m.texto}
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-[10px]',
                      mio ? 'text-white/70' : 'text-marca-400'
                    )}
                  >
                    {haceCuanto(m.created_at, ahora)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Pegado al pie, justo encima de la navegación: el pulgar llega ahí. */}
      <form
        action={enviarMensaje}
        className="sticky bottom-16 -mx-4 flex items-end gap-2 border-t border-marca-200/70 bg-white/95 px-4 py-2.5 backdrop-blur"
      >
        <input type="hidden" name="conversacion_id" value={id} />
        <input
          type="text"
          name="texto"
          required
          maxLength={4000}
          autoComplete="off"
          placeholder="Escribe un mensaje…"
          aria-label="Mensaje"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-marca-200 bg-marca-50 px-4 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:bg-white focus:ring-2 focus:ring-acento-100 focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Enviar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-acento-600 text-white active:bg-acento-700"
        >
          <IconoEnviar className="h-5 w-5" />
        </button>
      </form>
    </div>
  )
}
