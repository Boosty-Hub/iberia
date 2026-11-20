import type { Metadata } from 'next'
import Link from 'next/link'
import { TIPO_OBJETO } from '@/components/sistema/flujo/formato'
import { Aviso, EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Rutas de aprobación' }

/**
 * Las rutas de aprobación de la plataforma, una por tipo de objeto. Quién firma
 * cada paso no es una persona: es un cargo, una plaza, el jefe o el director de
 * la unidad, o un rol. La ruta lo resuelve desde la estructura al enviarse.
 */
export default async function AprobacionesPage() {
  await requerirPermiso('sistema:aprobaciones')
  const supabase = await createClient()
  const { data } = await supabase
    .schema('flujo')
    .from('ruta')
    .select('id, tipo_objeto, nombre, descripcion, activa, vigencia, ruta_paso(count)')
    .order('tipo_objeto')
  const rutas = data ?? []

  return (
    <>
      <EncabezadoPagina
        rotulo="Administración"
        titulo="Rutas de aprobación"
        descripcion="Quién firma qué: requisiciones, fichas de proceso y escenarios. Cada paso se resuelve desde la estructura (un cargo, una plaza, el jefe o el director de la unidad, o un rol) el día que se envía la solicitud."
      />
      <Aviso tono="ambar">
        <strong>Configuración sensible.</strong> Cambiar una ruta cambia quién aprueba. Cada cambio queda en la auditoría con quién lo hizo y
        cuándo. Las solicitudes que ya están en curso no cambian: sus pasos se copiaron al enviarse.
      </Aviso>
      {!rutas.length ? (
        <EstadoVacio titulo="No hay rutas" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rutas.map((r) => (
            <li key={r.id}>
              <Link href={`/sistema/administracion/aprobaciones/${r.id}`} className="tarjeta block h-full p-5 transition-colors hover:bg-marca-50/40">
                <span className="flex items-start justify-between gap-3">
                  <span className="font-semibold text-marca-900">{r.nombre}</span>
                  <Insignia tono={r.activa ? 'verde' : 'neutro'}>{r.activa ? 'Activa' : 'Inactiva'}</Insignia>
                </span>
                <span className="mt-1 block text-xs text-marca-500">{TIPO_OBJETO[r.tipo_objeto] ?? r.tipo_objeto}</span>
                {r.descripcion && <span className="mt-3 block text-sm text-pretty text-marca-600">{r.descripcion}</span>}
                <span className="mt-4 flex items-center justify-between border-t border-[var(--borde)] pt-3 text-xs text-marca-500">
                  <span>
                    <span className="font-semibold text-marca-800 tabular-nums">{(r.ruta_paso as unknown as { count: number }[])[0]?.count ?? 0}</span> pasos
                  </span>
                  <span className="font-medium text-acento-700">Editar la ruta →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
