import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IconoAtras, IconoEnviar } from '@/components/iconos'
import { BotonDesbloquear } from '@/components/canal/boton-desbloquear'
import { MenuModeracion } from '@/components/canal/menu-moderacion'
import { haceCuanto, iniciales, requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { enviarMensaje, marcarVisto } from './acciones'
import { legible } from '@/lib/certificado'

export const metadata: Metadata = { title: 'Conversación' }

export default async function ConversacionPage({
  params,
  searchParams,
}: PageProps<'/canal/mensajes/[id]'>) {
  const [yo, { id }, busqueda] = await Promise.all([requerirEmpleado(), params, searchParams])
  const supabase = await createClient()
  const falloEnvio = busqueda.aviso === 'envio'
  const ahora = new Date()

  // RLS solo devuelve la conversación si participo en ella; si no, es un 404
  // igual que si no existiera.
  const { data: conversacion } = await supabase
    .from('conversaciones')
    .select('id, tipo, grupos(nombre)')
    .eq('id', id)
    .maybeSingle()

  if (!conversacion) notFound()

  const [{ data: otros }, { data: mensajes }, { data: bloqueados }] = await Promise.all([
    supabase
      .from('conversacion_participantes')
      .select('empleados(id, nombre_completo, cargo)')
      .eq('conversacion_id', id)
      .neq('empleado_id', yo.id),
    supabase
      .from('mensajes')
      .select('id, texto, autor_id, created_at, empleados(nombre_completo)')
      .eq('conversacion_id', id)
      .eq('estado', 'visible')
      .order('created_at', { ascending: true })
      .limit(200),
    // Solo devuelve los míos: la RLS no deja leer los bloqueos de nadie más.
    supabase.from('bloqueos').select('bloqueado_id'),
  ])

  const otro = otros?.[0]?.empleados ?? null
  const esDirecta = conversacion.tipo !== 'grupo'
  // En un hilo directo, ¿bloqueé yo a la otra persona? (Si me bloqueó ella, no lo
  // sé ni se me dice: lo único que pasa es que mis mensajes no salen.)
  const loBloquee = esDirecta && !!otro && (bloqueados ?? []).some((b) => b.bloqueado_id === otro.id)
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
            {conversacion.tipo === 'grupo' ? 'Grupo de trabajo' : (otro?.cargo ? legible(otro.cargo) : '')}
          </p>
        </div>
        {/* Bloquear a la otra persona del hilo directo, o deshacerlo. En un grupo
            se bloquea desde un mensaje suyo. */}
        {esDirecta && otro && (
          <MenuModeracion
            etiqueta={`Opciones de la conversación con ${otro.nombre_completo}`}
            persona={{ id: otro.id, nombre: otro.nombre_completo, bloqueada: loBloquee }}
            className="-mr-2.5"
          />
        )}
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
                className={cn('flex items-center gap-0.5', mio ? 'justify-end' : 'justify-start')}
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
                {/* Reportar el mensaje, o bloquear a quien lo escribió. Solo en los
                    ajenos. */}
                {!mio && (
                  <MenuModeracion
                    etiqueta="Opciones del mensaje"
                    contenido={{ tipo: 'mensaje', id: m.id }}
                    persona={
                      m.empleados
                        ? { id: m.autor_id, nombre: m.empleados.nombre_completo, bloqueada: false }
                        : undefined
                    }
                  />
                )}
              </div>
            )
          })
        )}
      </div>

      {falloEnvio && !loBloquee && (
        <p
          role="alert"
          className="mb-2 rounded-xl bg-acento-50 px-3.5 py-2.5 text-[13px] text-acento-800"
        >
          No se pudo enviar el mensaje. Inténtalo de nuevo más tarde.
        </p>
      )}

      {/* Si bloqueé a la otra persona, no se escribe en este hilo hasta deshacerlo. */}
      {loBloquee && otro ? (
        <div className="sticky bottom-16 -mx-4 border-t border-marca-200/70 bg-white/95 px-4 py-3 backdrop-blur">
          <p className="text-[14px] leading-relaxed text-marca-600">
            Bloqueaste a {otro.nombre_completo}. No ves sus mensajes y no te puede escribir.
          </p>
          <div className="mt-2">
            <BotonDesbloquear empleadoId={otro.id} className="w-full" />
          </div>
        </div>
      ) : (
      /* Pegado al pie, justo encima de la navegación: el pulgar llega ahí. */
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
      )}
    </div>
  )
}
