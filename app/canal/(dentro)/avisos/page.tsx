import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoCampana, IconoCheck, IconoOficial } from '@/components/iconos'
import { responderConexion } from '@/app/canal/(dentro)/gente/acciones'
import { haceCuanto, iniciales, requerirEmpleado } from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Avisos' }

export default async function AvisosPage() {
  const yo = await requerirEmpleado()
  const supabase = await createClient()
  const ahora = new Date()

  const [{ data: solicitudes }, { data: oficiales }, { data: leidas }] =
    await Promise.all([
      supabase
        .from('conexiones')
        .select('id, created_at, empleados!conexiones_solicita_id_fkey(nombre_completo, cargo)')
        .eq('recibe_id', yo.id)
        .eq('estado', 'pendiente')
        .order('created_at', { ascending: false }),
      supabase
        .from('publicaciones')
        .select('id, titulo, publicado_en')
        .eq('estado', 'publicado')
        .eq('oficial', true)
        .order('publicado_en', { ascending: false })
        .limit(10),
      supabase
        .from('publicacion_lecturas')
        .select('publicacion_id')
        .eq('empleado_id', yo.id),
    ])

  const yaLeidas = new Set((leidas ?? []).map((l) => l.publicacion_id))
  const comunicados = oficiales ?? []
  const solicitudesPendientes = solicitudes ?? []

  const vacio = solicitudesPendientes.length === 0 && comunicados.length === 0

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">
          Avisos
        </h1>
        <p className="mt-1 text-[13px] text-marca-500">
          Solicitudes de conexión y comunicados de la empresa
        </p>
      </header>

      {vacio && (
        <div className="tarjeta-canal px-6 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-marca-100 text-marca-400">
            <IconoCampana className="h-6 w-6" />
          </span>
          <h2 className="mt-3 text-base font-semibold text-marca-900">
            No tienes avisos
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-[15px] leading-relaxed text-marca-500">
            Aquí te avisamos cuando alguien quiera conectar contigo o cuando la
            empresa publique un comunicado.
          </p>
        </div>
      )}

      {solicitudesPendientes.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-400 uppercase">
            Quieren conectar contigo
          </h2>
          <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
            {solicitudesPendientes.map((s) => (
              <li key={s.id} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marca-100 text-sm font-bold text-marca-700">
                    {iniciales(s.empleados?.nombre_completo ?? '?')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-marca-900">
                      {s.empleados?.nombre_completo}
                    </p>
                    <p className="truncate text-[13px] text-marca-500">
                      {s.empleados?.cargo}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-marca-400">
                    {haceCuanto(s.created_at, ahora)}
                  </span>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <form action={responderConexion} className="flex-1">
                    <input type="hidden" name="conexion_id" value={s.id} />
                    <input type="hidden" name="respuesta" value="aceptada" />
                    <button type="submit" className="btn-canal btn-canal-rojo w-full">
                      <IconoCheck className="h-4 w-4" />
                      Aceptar
                    </button>
                  </form>
                  <form action={responderConexion} className="flex-1">
                    <input type="hidden" name="conexion_id" value={s.id} />
                    <input type="hidden" name="respuesta" value="rechazada" />
                    <button type="submit" className="btn-canal btn-canal-suave w-full">
                      Ahora no
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {comunicados.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-400 uppercase">
            Comunicados oficiales
          </h2>
          <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
            {comunicados.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/canal/publicacion/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-marca-50"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-oro-300 text-marca-900">
                    <IconoOficial className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-marca-900">
                      {c.titulo}
                    </p>
                    <p className="text-[12px] text-marca-500">
                      {haceCuanto(c.publicado_en, ahora)}
                      {!yaLeidas.has(c.id) && ' · sin leer'}
                    </p>
                  </div>
                  {!yaLeidas.has(c.id) && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-acento-600" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
