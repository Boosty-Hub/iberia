import type { Metadata } from 'next'
import Link from 'next/link'
import { crearEscenario } from './acciones'
import { IconoMas } from '@/components/iconos'
import { nombresDe } from '@/components/sistema/flujo/datos'
import { ESTADO_ESCENARIO, fecha, fechaHora } from '@/components/sistema/flujo/formato'
import { Enviar, FormAccion } from '@/components/sistema/flujo/formulario'
import { EncabezadoPagina, EstadoVacio, Insignia } from '@/components/ui'
import { puede, requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Escenarios de estructura' }

/**
 * Escenarios de estructura: una copia aislada de la organización de hoy para
 * diseñar «cómo debería ser», compararla contra la realidad, ver su impacto y,
 * con doble aprobación, publicarla con fecha. Los escenarios de procesos viven
 * en su módulo.
 */
export default async function EscenariosPage() {
  const sesion = await requerirPermiso('sistema:escenarios')
  const supabase = await createClient()
  const { data } = await supabase
    .schema('org')
    .from('escenario')
    .select('id, nombre, descripcion, estado, fecha_base, vigente_desde, creado_por, creado_en, publicado_en')
    .eq('alcance', 'estructura')
    .order('creado_en', { ascending: false })
  const escenarios = data ?? []
  const nombres = await nombresDe(supabase, escenarios.map((e) => e.creado_por))

  return (
    <>
      <EncabezadoPagina
        rotulo="Organización"
        titulo="Escenarios de estructura"
        descripcion="Diseña la estructura como debería ser sin tocar la de hoy: cambia unidades, plazas y dotación, compara, mira a quién afecta y envíala a aprobar con su fecha de entrada en vigencia."
        acciones={
          <Link href="/sistema/nucleo/procesos/escenarios" className="btn-neutro h-10">
            Escenarios de procesos →
          </Link>
        }
      />

      {puede(sesion, 'sistema:escenarios', 'crear') && (
        <FormAccion accion={crearEscenario} className="tarjeta mb-8 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-marca-800">Abrir un escenario</h2>
          <p className="mt-1 mb-4 text-xs text-marca-500">Copia la estructura vigente de hoy. Lo que cambies ahí no toca la realidad hasta que se apruebe.</p>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] md:items-end">
            <div>
              <label htmlFor="esc-nombre" className="etiqueta">
                Nombre <span className="text-acento-600">*</span>
              </label>
              <input id="esc-nombre" name="nombre" required minLength={3} maxLength={120} className="campo" placeholder="Operaciones 2027" />
            </div>
            <div>
              <label htmlFor="esc-desc" className="etiqueta">
                Para qué
              </label>
              <input id="esc-desc" name="descripcion" maxLength={500} className="campo" placeholder="Qué se quiere probar con este escenario" />
            </div>
            <Enviar pendiente="Copiando la estructura…">
              <IconoMas className="h-4 w-4" />
              Abrir escenario
            </Enviar>
          </div>
        </FormAccion>
      )}

      {!escenarios.length ? (
        <EstadoVacio titulo="Todavía no hay escenarios de estructura" descripcion="Un escenario es una copia de la estructura de hoy para diseñar cambios sin tocarla." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {escenarios.map((e) => {
            const est = ESTADO_ESCENARIO[e.estado] ?? { etiqueta: e.estado, tono: 'neutro' as const }
            return (
              <li key={e.id}>
                <Link href={`/sistema/nucleo/escenarios/${e.id}`} className="tarjeta block h-full p-5 transition-colors hover:bg-marca-50/40">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-marca-900">{e.nombre}</span>
                    <Insignia tono={est.tono}>{est.etiqueta}</Insignia>
                  </span>
                  {e.descripcion && <span className="mt-2 block text-sm text-marca-600">{e.descripcion}</span>}
                  <span className="mt-4 block border-t border-[var(--borde)] pt-3 text-xs text-marca-500">
                    Copia del {fecha(e.fecha_base)} · {e.creado_por ? (nombres[e.creado_por] ?? '—') : '—'}
                    {e.vigente_desde && <> · rige desde el {fecha(e.vigente_desde)}</>}
                    {e.publicado_en && <> · publicado el {fechaHora(e.publicado_en)}</>}
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
