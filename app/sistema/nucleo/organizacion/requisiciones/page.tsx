import type { Metadata } from 'next'
import Link from 'next/link'
import { IconoMas } from '@/components/iconos'
import { nombresDe } from '@/components/sistema/flujo/datos'
import { ESTADO_REQUISICION, diasDesde, diasTexto, fecha } from '@/components/sistema/flujo/formato'
import { EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Requisiciones de personal' }

const RUTA = '/sistema/nucleo/organizacion/requisiciones'

/**
 * La bandeja de requisiciones: las mías y, con permiso de verlas, todas. Por
 * estado, con quién la tiene ahora y cuántos días lleva ahí: es lo que Recursos
 * Humanos mira cada mañana (plan §6.6).
 */
export default async function RequisicionesPage({ searchParams }: PageProps<'/sistema/nucleo/organizacion/requisiciones'>) {
  const [sesion, params] = await Promise.all([requerirPermiso('sistema:requisiciones', 'crear'), searchParams])
  const supabase = await createClient()
  const org = supabase.schema('org')

  const verTodas = puede(sesion, 'sistema:requisiciones')
  const alcance = verTodas && params.de === 'todas' ? 'todas' : 'mias'
  const estado = typeof params.estado === 'string' && ESTADO_REQUISICION[params.estado] ? params.estado : null

  let consulta = org
    .from('requisicion')
    .select('id, numero, unidad_ref, cargo_id, origen, cantidad, estado, creado_por, creado_en, solicitud_id, cargo(nombre)')
    .order('numero', { ascending: false })
    .range(0, 499)
  if (alcance === 'mias') consulta = consulta.eq('creado_por', sesion.userId)
  const { data: todas } = await consulta
  const filas = todas ?? []
  const lista = estado ? filas.filter((r) => r.estado === estado) : filas

  const unidadRefs = [...new Set(lista.map((r) => r.unidad_ref))]
  const solicitudes = lista.map((r) => r.solicitud_id).filter((x): x is string => Boolean(x))
  const [unidades, sols, origenes, nombres] = await Promise.all([
    unidadRefs.length ? org.from('unidad').select('ref, nombre').in('ref', unidadRefs).is('escenario_id', null) : null,
    solicitudes.length
      ? supabase.schema('flujo').from('solicitud').select('id, estado, paso_actual, creado_en, paso(orden, nombre, decidido_en)').in('id', solicitudes)
      : null,
    supabase.schema('control').from('catalogo').select('clave, etiqueta').eq('tipo', 'origen_requisicion'),
    nombresDe(supabase, lista.map((r) => r.creado_por)),
  ])
  const nombreUnidad = new Map((unidades?.data ?? []).map((u) => [u.ref, u.nombre]))
  const origen = new Map((origenes.data ?? []).map((o) => [o.clave, o.etiqueta]))
  const enCurso = new Map(
    (sols?.data ?? []).map((s) => {
      const pasos = (s.paso ?? []) as unknown as { orden: number; nombre: string; decidido_en: string | null }[]
      const actual = pasos.find((p) => p.orden === s.paso_actual)
      const ultima = pasos.map((p) => p.decidido_en).filter(Boolean).sort().pop() ?? s.creado_en
      return [s.id, { quien: s.estado === 'en_curso' ? actual?.nombre : null, desde: ultima }]
    }),
  )

  const conteo = filas.reduce<Record<string, number>>((m, r) => ((m[r.estado] = (m[r.estado] ?? 0) + 1), m), {})
  const enlace = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams()
    const de = 'de' in cambios ? cambios.de : alcance === 'todas' ? 'todas' : null
    const es = 'estado' in cambios ? cambios.estado : estado
    if (de) p.set('de', de)
    if (es) p.set('estado', es)
    const txt = p.toString()
    return txt ? `${RUTA}?${txt}` : RUTA
  }

  return (
    <>
      <EncabezadoPagina
        rotulo="Organización"
        titulo="Requisiciones de personal"
        descripcion="Pedir una persona más para una unidad, con su impacto en la dotación y su ruta de aprobación. Al aprobarse, la estructura se mueve sola; al registrar el ingreso, la plaza queda ocupada."
        acciones={
          puede(sesion, 'sistema:requisiciones', 'crear') && (
            <Link href={`${RUTA}/nueva`} className="btn-acento h-10">
              <IconoMas className="h-4 w-4" />
              Nueva requisición
            </Link>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {verTodas && (
          <div className="mr-2 inline-flex rounded-xl border border-marca-200 bg-white p-1 text-sm">
            <Link href={enlace({ de: null })} className={cn('rounded-lg px-3 py-1.5', alcance === 'mias' ? 'bg-marca-800 font-semibold text-white' : 'text-marca-600 hover:bg-marca-50')}>
              Las mías
            </Link>
            <Link href={enlace({ de: 'todas' })} className={cn('rounded-lg px-3 py-1.5', alcance === 'todas' ? 'bg-marca-800 font-semibold text-white' : 'text-marca-600 hover:bg-marca-50')}>
              Todas
            </Link>
          </div>
        )}
        <Link href={enlace({ estado: null })} className={cn('insignia', !estado ? 'bg-marca-800 text-white' : 'bg-marca-100 text-marca-700 hover:bg-marca-200')}>
          Todos los estados · {filas.length}
        </Link>
        {Object.entries(ESTADO_REQUISICION)
          .filter(([k]) => conteo[k])
          .map(([k, v]) => (
            <Link key={k} href={enlace({ estado: k })} className={cn('insignia', estado === k ? 'bg-marca-800 text-white' : 'bg-marca-100 text-marca-700 hover:bg-marca-200')}>
              {v.etiqueta} · {conteo[k]}
            </Link>
          ))}
      </div>

      {!lista.length ? (
        <EstadoVacio
          titulo={filas.length ? 'Ninguna en ese estado' : alcance === 'mias' ? 'No has pedido ninguna' : 'No hay requisiciones'}
          descripcion="Una requisición nace como borrador, se envía con su impacto y recorre la ruta de aprobación."
          accion={puede(sesion, 'sistema:requisiciones', 'crear') ? { href: `${RUTA}/nueva`, etiqueta: 'Nueva requisición' } : undefined}
        />
      ) : (
        <ul className="tarjeta divide-y divide-[var(--borde)] overflow-hidden">
          {lista.map((r) => {
            const est = ESTADO_REQUISICION[r.estado] ?? { etiqueta: r.estado, tono: 'neutro' as const }
            const curso = r.solicitud_id ? enCurso.get(r.solicitud_id) : null
            const dias = diasDesde(curso?.desde ?? r.creado_en)
            return (
              <li key={r.id}>
                <Link href={`${RUTA}/${r.id}`} className="grid gap-2 px-5 py-4 transition-colors hover:bg-marca-50/60 md:grid-cols-[4rem_minmax(0,1fr)_10rem_12rem] md:items-center">
                  <span className="font-mono text-sm text-marca-500">N.º {r.numero}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-marca-900">
                      {(r.cargo as unknown as { nombre: string } | null)?.nombre ?? 'Cargo'}
                      {r.cantidad > 1 && <span className="font-normal text-marca-500"> × {r.cantidad}</span>}
                    </span>
                    <span className="block truncate text-xs text-marca-500">
                      {nombreUnidad.get(r.unidad_ref) ?? 'Unidad'} · {origen.get(r.origen) ?? r.origen}
                      {alcance === 'todas' && r.creado_por ? ` · pidió ${nombres[r.creado_por] ?? '—'}` : ''}
                    </span>
                  </span>
                  <span>
                    <Insignia tono={est.tono}>{est.etiqueta}</Insignia>
                  </span>
                  <span className="text-xs text-marca-600">
                    {curso?.quien ? (
                      <>
                        La tiene: <span className="font-medium text-marca-800">{curso.quien}</span>
                        <span className="block text-marca-500">{dias === 0 ? 'desde hoy' : `hace ${diasTexto(dias)}`}</span>
                      </>
                    ) : (
                      <>Creada el {fecha(r.creado_en)}</>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
