import type { Metadata } from 'next'
import Link from 'next/link'
import { BotonDesbloquear } from '@/components/canal/boton-desbloquear'
import { IconoAtras, IconoBloquear } from '@/components/iconos'
import { iniciales, requerirEmpleado } from '@/lib/canal'
import { legible } from '@/lib/certificado'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Personas bloqueadas' }

/**
 * A quién bloqueé, y cómo deshacerlo. La tabla `bloqueos` solo le devuelve a cada
 * quien los suyos, así que no hace falta filtrar: es la regla de la base.
 */
export default async function BloqueadosPage() {
  await requerirEmpleado()
  const supabase = await createClient()

  const { data: bloqueos } = await supabase
    .from('bloqueos')
    .select('id, bloqueado_id, empleados!bloqueos_bloqueado_id_fkey(nombre_completo, cargo)')
    .order('created_at', { ascending: false })

  return (
    <>
      <Link
        href="/canal/yo"
        className="mb-2 -ml-2 inline-flex min-h-11 items-center gap-1 px-2 text-sm text-marca-500 active:text-marca-800"
      >
        <IconoAtras className="h-4 w-4" />
        Mi perfil
      </Link>

      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">
          Personas bloqueadas
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-marca-500">
          No ves lo que publican ni lo que escriben, y no te pueden escribir. Ellas no
          saben que las bloqueaste.
        </p>
      </header>

      {!bloqueos?.length ? (
        <div className="tarjeta-canal px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-100 text-marca-400">
            <IconoBloquear className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-marca-900">
            No has bloqueado a nadie
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-marca-500">
            Puedes bloquear a alguien desde su perfil en «Nuestra gente», desde una
            conversación o desde una publicación.
          </p>
        </div>
      ) : (
        <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
          {bloqueos.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marca-100 text-sm font-bold text-marca-700">
                {iniciales(b.empleados?.nombre_completo ?? '?')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug font-semibold text-marca-900">
                  {b.empleados?.nombre_completo ?? 'Persona del directorio'}
                </p>
                {b.empleados?.cargo && (
                  <p className="truncate text-[13px] text-marca-500">
                    {legible(b.empleados.cargo)}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <BotonDesbloquear empleadoId={b.bloqueado_id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
