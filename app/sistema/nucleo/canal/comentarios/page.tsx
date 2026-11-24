import type { Metadata } from 'next'
import Link from 'next/link'
import { puede, requerirPermiso } from '@/lib/auth'
import { fechaHora, numero } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { Segmentos } from '@/components/sistema/procesos/piezas-r2'
import { cn } from '@/lib/utils'
import { estadoComentario } from '../acciones'

export const metadata: Metadata = { title: 'Comentarios · Portal planta' }

const RUTA = '/sistema/nucleo/canal/comentarios'
const BOTON =
  'inline-flex min-h-7 items-center rounded-md border border-[var(--borde)] bg-white px-2 text-[11.5px] font-medium text-marca-800 hover:bg-marca-50 focus-visible:outline-2 focus-visible:outline-acento-500'
const BOTON_PELIGRO =
  'inline-flex min-h-7 items-center rounded-md border border-acento-200 bg-white px-2 text-[11.5px] font-semibold text-acento-700 hover:bg-acento-50 focus-visible:outline-2 focus-visible:outline-acento-500'

type Fila = {
  id: string
  publicacion_id: string
  publicacion: string
  autor: string
  texto: string
  estado: string
  creado_en: string
  reportes: number
}
type Vista = 'todos' | 'visible' | 'oculto' | 'reportados'
const VISTAS: Record<Vista, string> = { todos: 'Todos', visible: 'Visibles', oculto: 'Ocultos', reportados: 'Reportados' }

/** Todos los comentarios del feed del Portal planta (24-nov-2026): quién, dónde, y ocultarlos o mostrarlos. */
export default async function ComentariosCanalPage({ searchParams }: PageProps<'/sistema/nucleo/canal/comentarios'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:reportes'), searchParams])
  const editar = puede(sesion, 'modulo:reportes', 'editar')
  const vista: Vista = sp.estado === 'visible' || sp.estado === 'oculto' || sp.estado === 'reportados' ? sp.estado : 'todos'
  const supabase = await createClient()
  const { data, error } = await supabase.schema('ui').rpc('canal_comentarios' as never)
  const todas = ((data ?? []) as Fila[]).sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  const cuenta = (v: Vista) =>
    v === 'todos' ? todas.length : v === 'reportados' ? todas.filter((c) => c.reportes > 0).length : todas.filter((c) => c.estado === v).length
  const filas = vista === 'todos' ? todas : vista === 'reportados' ? todas.filter((c) => c.reportes > 0) : todas.filter((c) => c.estado === vista)
  const volver = `${RUTA}?estado=${vista}`

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Portal planta"
        migas={[{ etiqueta: 'Comentarios' }]}
        descripcion="Lo que la gente comenta debajo de las publicaciones. Ocultar no borra: quien lo escribió lo sigue viendo, y se puede volver a mostrar."
      />

      {(sp.aviso === 'error' || error) && (
        <p role="alert" className="mb-3 rounded-xl border border-acento-200 bg-acento-50 px-3.5 py-2.5 text-[12.5px] text-acento-800">
          {error ? 'No se pudieron leer los comentarios.' : 'No se pudo guardar el cambio. Inténtalo otra vez.'}
        </p>
      )}

      <Segmentos
        etiqueta="Qué comentarios ver"
        activa={vista}
        opciones={(Object.keys(VISTAS) as Vista[]).map((v) => ({ valor: v, etiqueta: VISTAS[v], href: `${RUTA}?estado=${v}`, n: cuenta(v) }))}
      />

      <section className="overflow-x-auto rounded-xl border border-[var(--borde)] bg-white">
        {filas.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12.5px] text-marca-500">No hay comentarios en esta vista.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <caption className="sr-only">Comentarios del portal</caption>
            <thead className="border-b border-[var(--borde)] bg-[#fafafa] text-[11.5px] text-marca-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold">Comentario</th>
                <th scope="col" className="px-3 py-2 font-semibold">En</th>
                <th scope="col" className="px-3 py-2 font-semibold">Fecha</th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">Reportes</th>
                {editar && <th scope="col" className="px-3 py-2 font-semibold">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef0f3]">
              {filas.map((c) => (
                <tr key={c.id} className={cn('align-top', c.estado === 'oculto' && 'bg-[#fafafa]')}>
                  <td className="max-w-[420px] px-3 py-2">
                    <p className="text-[11.5px] font-semibold text-marca-800">
                      {c.autor}
                      {c.estado === 'oculto' && <span className="ml-1 rounded-full bg-[#eef0f3] px-1.5 py-0.5 text-[10.5px] font-semibold text-marca-600">Oculto</span>}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line text-marca-900">{c.texto}</p>
                  </td>
                  <td className="max-w-[240px] px-3 py-2">
                    <Link href={`/canal/publicacion/${c.publicacion_id}`} className="text-marca-800 hover:underline">
                      {c.publicacion}
                    </Link>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-marca-700 tabular-nums">{fechaHora(c.creado_en)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {c.reportes ? (
                      <Link href="/sistema/nucleo/canal/moderacion" className="font-semibold text-acento-700 hover:underline">
                        {numero(c.reportes)}
                      </Link>
                    ) : (
                      '0'
                    )}
                  </td>
                  {editar && (
                    <td className="px-3 py-2">
                      <form action={estadoComentario}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="estado" value={c.estado === 'oculto' ? 'visible' : 'oculto'} />
                        <input type="hidden" name="volver" value={volver} />
                        <button type="submit" className={c.estado === 'oculto' ? BOTON : BOTON_PELIGRO}>
                          {c.estado === 'oculto' ? 'Mostrar' : 'Ocultar'}
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
