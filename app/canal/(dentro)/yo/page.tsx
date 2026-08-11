import type { Metadata } from 'next'
import Link from 'next/link'
import { cerrarSesion } from '@/app/login/actions'
import {
  IconoCampana,
  IconoPanel,
  IconoSalir,
  IconoUsuarios,
} from '@/components/iconos'
import {
  NIVELES_EMPLEADO,
  iniciales,
  requerirEmpleado,
  type NivelEmpleado,
} from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Mi perfil' }

const SEDES: Record<string, string> = {
  caracas: 'Caracas',
  cagua: 'Cagua',
  campo: 'En campo',
}

export default async function YoPage() {
  const yo = await requerirEmpleado()
  const supabase = await createClient()

  const [{ count: conexiones }, { count: pendientes }] = await Promise.all([
    supabase
      .from('conexiones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'aceptada')
      .or(`solicita_id.eq.${yo.id},recibe_id.eq.${yo.id}`),
    supabase
      .from('conexiones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .eq('recibe_id', yo.id),
  ])

  const puedePublicar = yo.puede_publicar || yo.es_moderador

  return (
    <>
      <section className="tarjeta-canal mb-4 px-5 py-6 text-center">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-acento-600 text-2xl font-bold text-white">
          {iniciales(yo.nombre_completo)}
        </span>
        <h1 className="mt-3 text-[20px] leading-tight font-bold text-marca-900">
          {yo.nombre_completo}
        </h1>
        <p className="mt-1 text-[15px] text-marca-600">{yo.cargo ?? 'Industrias Iberia'}</p>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <span className="chip bg-marca-100 text-marca-600">
            {NIVELES_EMPLEADO[yo.nivel as NivelEmpleado] ?? yo.nivel}
          </span>
          {yo.areas?.nombre && (
            <span className="chip bg-marca-100 text-marca-600">{yo.areas.nombre}</span>
          )}
          {yo.sede && (
            <span className="chip bg-marca-100 text-marca-600">
              {SEDES[yo.sede] ?? yo.sede}
            </span>
          )}
        </div>
      </section>

      <ul className="tarjeta-canal mb-4 divide-y divide-marca-100 overflow-hidden">
        <li>
          <Link
            href="/canal/gente"
            className="flex items-center gap-3 px-4 py-3.5 active:bg-marca-50"
          >
            <IconoUsuarios className="h-5 w-5 text-marca-400" />
            <span className="flex-1 text-[15px] text-marca-800">Mis conexiones</span>
            <span className="text-[15px] font-semibold text-marca-500">
              {conexiones ?? 0}
            </span>
          </Link>
        </li>
        <li>
          <Link
            href="/canal/avisos"
            className="flex items-center gap-3 px-4 py-3.5 active:bg-marca-50"
          >
            <IconoCampana className="h-5 w-5 text-marca-400" />
            <span className="flex-1 text-[15px] text-marca-800">Avisos</span>
            {(pendientes ?? 0) > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-acento-600 px-1.5 text-[11px] font-bold text-white">
                {pendientes}
              </span>
            )}
          </Link>
        </li>
        {puedePublicar && (
          <li>
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3.5 active:bg-marca-50"
            >
              <IconoPanel className="h-5 w-5 text-marca-400" />
              <span className="flex-1 text-[15px] text-marca-800">
                Panel del programa
              </span>
            </Link>
          </li>
        )}
      </ul>

      <div className="tarjeta-canal mb-4 p-4">
        <h2 className="text-[13px] font-semibold text-marca-700">Lo que viene</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-marca-500">
          Vacaciones, préstamos, constancias e inscripción a eventos se irán
          sumando a este mismo lugar. Hoy el canal es comunicación; después será
          también donde se hacen los trámites.
        </p>
      </div>

      <form action={cerrarSesion}>
        <button type="submit" className="btn-canal btn-canal-suave w-full">
          <IconoSalir className="h-4 w-4" />
          Cerrar sesión
        </button>
      </form>

      <p className="mt-6 text-center text-[11px] text-marca-400">
        Industrias Iberia · Uso interno
      </p>
    </>
  )
}
