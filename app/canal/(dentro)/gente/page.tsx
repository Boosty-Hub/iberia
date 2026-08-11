import type { Metadata } from 'next'
import { IconoBuscar, IconoChat, IconoCheck, IconoMas } from '@/components/iconos'
import {
  NIVELES_EMPLEADO,
  ORDEN_NIVEL,
  iniciales,
  requerirEmpleado,
  requiereSolicitud,
  type NivelEmpleado,
} from '@/lib/canal'
import { createClient } from '@/lib/supabase/server'
import { abrirConversacion, responderConexion, solicitarConexion } from './acciones'

export const metadata: Metadata = { title: 'Gente' }

type Persona = {
  id: string
  nombre_completo: string
  cargo: string | null
  nivel: string
  sede: string | null
  areas: { nombre: string } | null
}

export default async function GentePage({ searchParams }: PageProps<'/canal/gente'>) {
  const [yo, params] = await Promise.all([requerirEmpleado(), searchParams])
  const q = typeof params.q === 'string' ? params.q.trim() : ''

  const supabase = await createClient()

  let consulta = supabase
    .from('empleados')
    .select('id, nombre_completo, cargo, nivel, sede, areas(nombre)')
    .eq('activo', true)
    .order('nombre_completo')
    .limit(200)

  if (q) {
    const patron = `%${q}%`
    consulta = consulta.or(`nombre_completo.ilike.${patron},cargo.ilike.${patron}`)
  }

  const [{ data: personas }, { data: conexiones }] = await Promise.all([
    consulta,
    supabase
      .from('conexiones')
      .select('id, solicita_id, recibe_id, estado')
      .or(`solicita_id.eq.${yo.id},recibe_id.eq.${yo.id}`),
  ])

  // Lo que hay entre yo y cada quien, resuelto de una vez para no consultar
  // por fila.
  const vinculo = new Map<
    string,
    { id: string; estado: string; laPediYo: boolean }
  >()
  for (const c of conexiones ?? []) {
    const otro = c.solicita_id === yo.id ? c.recibe_id : c.solicita_id
    vinculo.set(otro, {
      id: c.id,
      estado: c.estado,
      laPediYo: c.solicita_id === yo.id,
    })
  }

  const lista = (personas ?? []).filter((p) => p.id !== yo.id) as Persona[]

  // Agrupada por nivel: en una organización de 280 personas, ver "Dirección"
  // y "Planta" separadas orienta más que una lista alfabética corrida.
  const grupos = [...new Set(lista.map((p) => p.nivel))].sort(
    (a, b) => ORDEN_NIVEL[a as NivelEmpleado] - ORDEN_NIVEL[b as NivelEmpleado]
  )

  return (
    <>
      <header className="mb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-marca-900">
          Nuestra gente
        </h1>
        <p className="mt-1 text-[13px] text-marca-500">
          {lista.length} {lista.length === 1 ? 'persona' : 'personas'} en el directorio
        </p>
      </header>

      <form className="relative mb-4">
        <IconoBuscar className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-marca-400" />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre o cargo"
          aria-label="Buscar personas"
          className="min-h-11 w-full rounded-full border border-marca-200 bg-white pr-4 pl-11 text-[15px] text-marca-900 placeholder:text-marca-400 focus:border-acento-400 focus:ring-2 focus:ring-acento-100 focus:outline-none"
        />
      </form>

      {lista.length === 0 ? (
        <div className="tarjeta-canal px-6 py-12 text-center">
          <p className="text-[15px] text-marca-500">
            {q ? `Nadie coincide con «${q}».` : 'El directorio todavía está vacío.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map((nivel) => (
            <section key={nivel}>
              <h2 className="mb-2 px-1 text-[11px] font-bold tracking-wider text-marca-400 uppercase">
                {NIVELES_EMPLEADO[nivel as NivelEmpleado] ?? nivel}
              </h2>
              <ul className="tarjeta-canal divide-y divide-marca-100 overflow-hidden">
                {lista
                  .filter((p) => p.nivel === nivel)
                  .map((persona) => (
                    <FilaPersona
                      key={persona.id}
                      persona={persona}
                      miNivel={yo.nivel as NivelEmpleado}
                      vinculo={vinculo.get(persona.id)}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function FilaPersona({
  persona,
  miNivel,
  vinculo,
}: {
  persona: Persona
  miNivel: NivelEmpleado
  vinculo?: { id: string; estado: string; laPediYo: boolean }
}) {
  const nivel = persona.nivel as NivelEmpleado
  const pideSolicitud = requiereSolicitud(miNivel, nivel)
  const conectados = vinculo?.estado === 'aceptada'

  // Hacia arriba se escribe directo: nadie de planta queda expuesto a que la
  // dirección le rechace una solicitud dentro de su propia empresa.
  const puedeEscribir = conectados || !pideSolicitud

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-marca-100 text-sm font-bold text-marca-700">
        {iniciales(persona.nombre_completo)}
      </span>

      <div className="min-w-0 flex-1">
        {/* El nombre no se recorta: «Alberto García-Ra…» no le sirve a nadie.
            Lo que cede es el cargo, que sí se puede leer a medias. */}
        <p className="text-[15px] leading-snug font-semibold text-marca-900">
          {persona.nombre_completo}
        </p>
        <p className="truncate text-[13px] text-marca-500">
          {persona.cargo ?? 'Industrias Iberia'}
        </p>
        {(persona.areas?.nombre || persona.sede) && (
          <p className="truncate text-[11px] text-marca-400">
            {[persona.areas?.nombre, persona.sede === 'cagua' ? 'Cagua' : persona.sede === 'caracas' ? 'Caracas' : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </div>

      {puedeEscribir ? (
        <form action={abrirConversacion}>
          <input type="hidden" name="empleado_id" value={persona.id} />
          <button type="submit" className="btn-canal btn-canal-suave px-3 text-[13px]">
            <IconoChat className="h-4 w-4" />
            Escribir
          </button>
        </form>
      ) : vinculo?.estado === 'pendiente' && vinculo.laPediYo ? (
        <span className="chip shrink-0 bg-marca-100 text-marca-500">Pendiente</span>
      ) : vinculo?.estado === 'pendiente' ? (
        <form action={responderConexion}>
          <input type="hidden" name="conexion_id" value={vinculo.id} />
          <input type="hidden" name="respuesta" value="aceptada" />
          <button type="submit" className="btn-canal btn-canal-rojo px-3 text-[13px]">
            <IconoCheck className="h-4 w-4" />
            Aceptar
          </button>
        </form>
      ) : vinculo?.estado === 'rechazada' ? (
        <span className="chip shrink-0 bg-marca-100 text-marca-400">—</span>
      ) : (
        <form action={solicitarConexion}>
          <input type="hidden" name="empleado_id" value={persona.id} />
          <button type="submit" className="btn-canal btn-canal-suave px-3 text-[13px]">
            <IconoMas className="h-4 w-4" />
            Conectar
          </button>
        </form>
      )}
    </li>
  )
}
