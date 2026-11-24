import { MenuModeracion } from '@/components/canal/menu-moderacion'
import { BotonSigue } from '@/components/canal/boton-sigue'
import { haceCuanto, iniciales } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { comentar, moderarComentario } from './acciones'

/**
 * Los comentarios de una publicación (24-nov-2026: «se habilitan en la próxima versión» hasta hoy). La RLS
 * decide qué se ve —los visibles; el mío aunque esté oculto; quien publica ve todo— y solo se comenta donde la
 * publicación lo permite (`privado.permite_comentar`). Quien publica en el portal o modera oculta y restaura;
 * los demás reportan, como en un mensaje.
 */
export async function Comentarios({
  publicacionId,
  yo,
  modero,
}: {
  publicacionId: string
  yo: { id: string }
  modero: boolean
}) {
  const supabase = await createClient()
  const ahora = new Date()
  const { data } = await supabase
    .from('comentarios')
    .select('id, texto, estado, empleado_id, created_at, empleados!comentarios_empleado_id_fkey(nombre_completo)')
    .eq('publicacion_id', publicacionId)
    .neq('estado', 'eliminado')
    .order('created_at', { ascending: true })
    .limit(300)
  const lista = data ?? []

  return (
    <section className="tarjeta-canal mt-3 p-4" aria-labelledby="comentarios">
      <h2 id="comentarios" className="mb-3 text-[15px] font-semibold text-marca-900">
        Comentarios {lista.length > 0 && <span className="font-normal text-marca-500">({lista.filter((c) => c.estado === 'visible').length})</span>}
      </h2>

      {lista.length === 0 ? (
        <p className="mb-4 text-[14px] text-marca-500">Todavía nadie comenta. Sé el primero.</p>
      ) : (
        <ul className="mb-4 space-y-3">
          {lista.map((c) => {
            const mio = c.empleado_id === yo.id
            const oculto = c.estado === 'oculto'
            const nombre = c.empleados?.nombre_completo ?? 'Alguien'
            return (
              <li key={c.id} className="flex gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-marca-100 text-[11px] font-bold text-marca-700">
                  {iniciales(nombre)}
                </span>
                <div className={cn('min-w-0 flex-1 rounded-2xl bg-marca-50 px-3 py-2', oculto && 'opacity-60')}>
                  <p className="text-[12px] text-marca-500">
                    <span className="font-semibold text-marca-800">{mio ? 'Tú' : nombre}</span> · {haceCuanto(c.created_at, ahora)}
                    {oculto && <span className="font-semibold text-acento-700"> · Oculto{mio && !modero ? ': solo lo ves tú' : ''}</span>}
                  </p>
                  <p className="mt-0.5 text-[15px] leading-relaxed whitespace-pre-line text-marca-900">{c.texto}</p>
                </div>
                <div className="flex shrink-0 flex-col items-center">
                  {modero ? (
                    <form action={moderarComentario}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="publicacion_id" value={publicacionId} />
                      <input type="hidden" name="estado" value={oculto ? 'visible' : 'oculto'} />
                      <button type="submit" className="toque rounded-full px-2 text-[12px] font-semibold text-marca-500 active:bg-marca-100">
                        {oculto ? 'Mostrar' : 'Ocultar'}
                      </button>
                    </form>
                  ) : (
                    !mio && (
                      <MenuModeracion
                        etiqueta={`Opciones del comentario de ${nombre}`}
                        contenido={{ tipo: 'comentario', id: c.id }}
                        persona={{ id: c.empleado_id, nombre, bloqueada: false }}
                      />
                    )
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <form action={comentar} className="space-y-2">
        <input type="hidden" name="publicacion_id" value={publicacionId} />
        <label htmlFor="comentario" className="sr-only">
          Escribe un comentario
        </label>
        <textarea
          id="comentario"
          name="texto"
          required
          rows={2}
          maxLength={1000}
          placeholder="Escribe un comentario…"
          className="w-full rounded-xl border border-marca-200 bg-white px-3.5 py-2.5 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:ring-2 focus:ring-acento-100 focus:outline-none"
        />
        <BotonSigue>Comentar</BotonSigue>
      </form>
    </section>
  )
}
