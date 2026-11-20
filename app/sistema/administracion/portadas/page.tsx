import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { NIVELES, type Nivel } from '@/lib/permisos'
import { PORTADA_POR_NIVEL } from '@/lib/plataforma/metricas'
import { EditorPortada, type OpcionMetrica } from '@/components/sistema/ui/editor-portada'
import { EncabezadoPagina } from '@/components/ui'

export const metadata: Metadata = { title: 'Portadas de Mi día' }

const GRUPO: Record<string, string> = { 'NUC-ORG': 'Organización', 'NUC-PRO': 'Procesos', 'NUC-DOC': 'Documentos', 'FIN-TAS': 'Tasas de cambio' }

/**
 * Qué cifras ve cada rol en Mi día (`ui.portada_rol`, Anexo E §2.9). Salen del
 * registro de métricas: aquí solo se elige cuáles y en qué orden. Una cifra que
 * el rol no puede ver no le sale aunque esté en su portada (la base no la
 * manda), así que poner la brecha en la portada de Dirección no le da acceso.
 */
export default async function PortadasPage() {
  await requerirPermiso('modulo:roles', 'editar')
  const supabase = await createClient()
  const [{ data: roles }, { data: portadas }, { data: metricas }] = await Promise.all([
    supabase.from('roles').select('id, nombre, clave, nivel').order('nombre'),
    supabase.schema('ui').from('portada_rol').select('rol_id, metricas, actualizado_en'),
    supabase.schema('ui').from('metrica').select('clave, nombre, modulo, recurso, orden').neq('estado', 'retirada').order('orden'),
  ])
  const opciones: OpcionMetrica[] = (metricas ?? []).map((m) => ({ clave: m.clave, nombre: m.nombre, grupo: m.modulo ? (GRUPO[m.modulo] ?? m.modulo) : 'Lo tuyo' }))
  const recurso = new Map((metricas ?? []).map((m) => [m.clave, m.recurso]))
  const dePortada = new Map((portadas ?? []).map((p) => [p.rol_id, p.metricas]))

  return (
    <>
      <EncabezadoPagina
        rotulo="Administración"
        titulo="Portadas de Mi día"
        descripcion="Las cifras que cada rol ve al entrar, en su orden. Salen del registro de métricas, así que dicen lo mismo que en su módulo."
      />
      <p className="mb-4 rounded-lg border border-[var(--borde)] bg-white px-3 py-2 text-[12px] text-marca-600">
        Poner una cifra en una portada no da permiso para verla: si el rol no tiene el permiso de su módulo, no le sale. Un rol sin portada propia ve la de su nivel. El
        detalle de cada cifra está en el{' '}
        <Link href="/sistema/datos/metricas" className="font-semibold text-acento-700 hover:underline">
          registro de métricas
        </Link>
        .
      </p>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(roles ?? []).map((r) => {
          const propia = dePortada.get(r.id)
          const lista = propia ?? PORTADA_POR_NIVEL[r.nivel] ?? []
          return (
            <li key={r.id} className="min-w-0 rounded-xl border border-[var(--borde)] bg-white p-3.5">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13.5px] font-semibold text-marca-900">{r.nombre}</h2>
                <span className="text-[11px] text-marca-500">
                  Nivel {NIVELES[r.nivel as Nivel] ?? r.nivel} · {propia ? 'portada propia' : 'la de su nivel'}
                </span>
              </div>
              {lista.some((c) => recurso.get(c) === 'sistema:tasas-paralelo') && (
                <p className="mb-2 text-[11.5px] text-marca-500">🔒 El paralelo y la brecha solo salen si el rol tiene «Dólar paralelo y brecha».</p>
              )}
              <EditorPortada key={`${r.id}:${lista.join()}:${Boolean(propia)}`} rolId={r.id} inicial={lista} opciones={opciones} guardada={Boolean(propia)} />
            </li>
          )
        })}
      </ul>
    </>
  )
}
