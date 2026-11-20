import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { puede, requerirPermiso } from '@/lib/auth'
import { EncabezadoPagina, Insignia, Metrica } from '@/components/ui'

/**
 * La portada de la Plataforma Iberia: lo que ya opera y el registro de módulos.
 * **El plan es dato** (NUC-CFG): cada módulo del plan maestro es una fila de
 * `control.modulo`, con su fase y su estado; esta página no lleva una lista
 * escrita a mano.
 */

const TONO_ESTADO = {
  operando: 'verde',
  en_construccion: 'ambar',
  planificado: 'neutro',
  pausado: 'neutro',
} as const

const ETIQUETA_ESTADO = {
  operando: 'Operando',
  en_construccion: 'En construcción',
  planificado: 'Planificado',
  pausado: 'En pausa',
} as const

export default async function SistemaPage() {
  const sesion = await requerirPermiso('sistema:inicio')
  const supabase = await createClient()
  const org = supabase.schema('org')
  const sgc = supabase.schema('sgc')

  const [modulos, unidades, plazas, procesos, documentos, requisiciones] = await Promise.all([
    supabase.schema('control').from('modulo').select('*').order('orden'),
    puede(sesion, 'sistema:estructura')
      ? org.from('unidad').select('id', { count: 'exact', head: true }).is('escenario_id', null).filter('vigencia', 'cs', `[${hoy()},${hoy()}]`)
      : null,
    puede(sesion, 'sistema:estructura')
      ? org.from('plaza').select('dotacion').is('escenario_id', null).filter('vigencia', 'cs', `[${hoy()},${hoy()}]`)
      : null,
    puede(sesion, 'sistema:procesos')
      ? sgc.from('proceso').select('nivel').is('escenario_id', null).eq('estado', 'vigente')
      : null,
    puede(sesion, 'sistema:documentos')
      ? sgc.from('documento').select('id', { count: 'exact', head: true }).eq('estado', 'vigente')
      : null,
    puede(sesion, 'sistema:requisiciones') || puede(sesion, 'sistema:requisiciones', 'crear')
      ? org.from('requisicion').select('id', { count: 'exact', head: true }).in('estado', ['en_aprobacion', 'aprobada', 'en_seleccion'])
      : null,
  ])

  const dotacion = (plazas?.data ?? []).reduce((s, p) => s + (p.dotacion ?? 0), 0)
  const porNivel = (procesos?.data ?? []).reduce<Record<number, number>>((m, p) => ((m[p.nivel] = (m[p.nivel] ?? 0) + 1), m), {})

  const lista = modulos.data ?? []
  const porDominio = lista.reduce<Record<string, typeof lista>>((m, x) => ((m[x.dominio] ??= []).push(x), m), {})

  return (
    <>
      <EncabezadoPagina
        rotulo="Plataforma Iberia"
        titulo="Inicio"
        descripcion="La operación de Iberia como dato: estructura, procesos y documentos editables, con aprobación y vigencia. Lo que ves aquí sale de la base; nada se lleva en hojas aparte."
      />

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {unidades && <Metrica valor={unidades.count ?? 0} etiqueta="Unidades" href="/sistema/nucleo/organizacion" />}
        {plazas && <Metrica valor={dotacion} etiqueta="Dotación aprobada" href="/sistema/nucleo/organizacion/dotacion" />}
        {procesos && (
          <Metrica
            valor={(porNivel[0] ?? 0) + (porNivel[1] ?? 0)}
            sufijo={`+ ${(porNivel[2] ?? 0) + (porNivel[3] ?? 0)} sub`}
            etiqueta="Procesos"
            href="/sistema/nucleo/procesos"
          />
        )}
        {documentos && <Metrica valor={documentos.count ?? 0} etiqueta="Documentos vigentes" href="/sistema/nucleo/documentos" />}
        {requisiciones && (
          <Metrica valor={requisiciones.count ?? 0} etiqueta="Requisiciones abiertas" href="/sistema/nucleo/organizacion/requisiciones" />
        )}
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-marca-900">Módulos de la plataforma</h2>
          <p className="text-xs text-marca-500">
            {lista.filter((m) => m.estado === 'operando').length} operando ·{' '}
            {lista.filter((m) => m.estado === 'en_construccion').length} en construcción · {lista.length} en el plan
          </p>
        </div>
        {lista.length === 0 ? (
          <p className="tarjeta p-5 text-sm text-marca-600">El registro de módulos todavía no está cargado.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {Object.entries(porDominio).map(([dominio, mods]) => (
              <div key={dominio} className="tarjeta p-5">
                <p className="rotulo mb-3">{dominio}</p>
                <ul className="divide-y divide-[var(--borde)]">
                  {mods.map((m) => (
                    <li key={m.codigo} className="flex items-center gap-3 py-2.5">
                      <span className="w-[4.5rem] shrink-0 font-mono text-xs text-marca-500">{m.codigo}</span>
                      <span className="min-w-0 flex-1 text-sm text-marca-800">
                        {m.ruta && m.estado !== 'planificado' ? (
                          <Link href={m.ruta as never} className="hover:text-acento-700 hover:underline">
                            {m.nombre}
                          </Link>
                        ) : (
                          m.nombre
                        )}
                        {m.fase && <span className="block text-xs text-marca-400">{m.fase}</span>}
                      </span>
                      <Insignia tono={TONO_ESTADO[m.estado as keyof typeof TONO_ESTADO] ?? 'neutro'}>
                        {ETIQUETA_ESTADO[m.estado as keyof typeof ETIQUETA_ESTADO] ?? m.estado}
                      </Insignia>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

function hoy() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas' }).format(new Date())
}
