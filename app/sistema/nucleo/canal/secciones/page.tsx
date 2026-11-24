import type { Metadata } from 'next'
import { puede, requerirPermiso } from '@/lib/auth'
import { fechaHora } from '@/lib/plataforma/formato'
import { createClient } from '@/lib/supabase/server'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { cn } from '@/lib/utils'
import { seccionDelPortal } from '../acciones'

export const metadata: Metadata = { title: 'Secciones · Portal planta' }

type Seccion = { clave: string; nombre: string; descripcion: string | null; activo: boolean; actualizado_en: string; actualizado_por: string | null }

/**
 * Las secciones del Portal planta que se prenden y se apagan (24-nov-2026, Gabriel: «se irá desplegando,
 * iremos activando»). Apagada, una sección sale del menú del teléfono y su página no abre. Inicio y Yo no se
 * apagan: son la puerta y la salida.
 */
export default async function SeccionesCanalPage({ searchParams }: PageProps<'/sistema/nucleo/canal/secciones'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('modulo:reportes'), searchParams])
  const editar = puede(sesion, 'modulo:reportes', 'editar')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('canal_modulos' as never)
    .select('clave, nombre, descripcion, activo, actualizado_en, actualizado_por')
    .order('orden' as never)
  const secciones = (data ?? []) as unknown as Seccion[]

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="NUC-CAN"
        titulo="Portal planta"
        migas={[{ etiqueta: 'Secciones' }]}
        descripcion="Qué secciones tiene el portal en el teléfono. Apagada, una sección sale del menú y su página no abre; nada de lo que tiene se borra."
      />

      {(sp.aviso === 'error' || error) && (
        <p role="alert" className="mb-3 rounded-xl border border-acento-200 bg-acento-50 px-3.5 py-2.5 text-[12.5px] text-acento-800">
          {error ? 'No se pudieron leer las secciones.' : 'No se pudo guardar el cambio. Inténtalo otra vez.'}
        </p>
      )}

      <ul className="divide-y divide-[#eef0f3] rounded-xl border border-[var(--borde)] bg-white">
        <li className="flex items-center gap-3 px-3.5 py-3 text-[12.5px]">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-marca-900">Inicio y Yo</p>
            <p className="text-[11.5px] text-marca-500">Siempre encendidas: son la entrada y el perfil.</p>
          </div>
          <span className="rounded-full bg-[#e7f5ee] px-2 py-0.5 text-[11px] font-semibold text-[#1f6f4b]">Encendida</span>
        </li>
        {secciones.map((s) => (
          <li key={s.clave} className="flex flex-wrap items-center gap-3 px-3.5 py-3 text-[12.5px]">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-marca-900">{s.nombre}</p>
              <p className="text-[11.5px] text-marca-500">
                {s.descripcion}
                {s.actualizado_por ? ` · cambiado ${fechaHora(s.actualizado_en)}` : ''}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                s.activo ? 'bg-[#e7f5ee] text-[#1f6f4b]' : 'bg-[#eef0f3] text-marca-600'
              )}
            >
              {s.activo ? 'Encendida' : 'Apagada'}
            </span>
            {editar && (
              <form action={seccionDelPortal}>
                <input type="hidden" name="clave" value={s.clave} />
                <input type="hidden" name="activo" value={s.activo ? 'no' : 'si'} />
                <input type="hidden" name="volver" value="/sistema/nucleo/canal/secciones" />
                <button
                  type="submit"
                  className="inline-flex min-h-8 items-center rounded-md border border-[var(--borde)] bg-white px-2.5 text-[12px] font-medium text-marca-800 hover:bg-marca-50"
                >
                  {s.activo ? 'Apagar' : 'Encender'}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
