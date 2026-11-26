import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { ETIQUETA_CLASE, bytesLegibles, type ClaseArtefacto } from '@/lib/asistente/tipos'
import { fechaHora } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { BorrarArchivo } from '@/components/sistema/asistente/borrar-archivo'

export const metadata: Metadata = { title: 'Artefactos · Asistente de IA' }

type Version = { id: string; titulo: string; version: number; tipo: string; bytes: number; chat_id: string | null; creado_en: string; grupo: string }
const COLUMNAS = 'id, titulo, version, tipo, bytes, chat_id, creado_en, grupo'

/**
 * Los artefactos (26-nov-2026, pedido de Gabriel: «no veo dónde se guardan»): tableros, gráficos y documentos que creó
 * el asistente, uno por fila en su última versión, con cuántas versiones tiene y el chat donde nació. Antes vivían como
 * un filtro dentro de los archivos. Se guardan hasta que su dueño los borra; abajo, los que le compartieron.
 */
export default async function ArtefactosPage() {
  const sesion = await requerirPermiso('sistema:asistente')
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [{ data: propios }, { data: chats }, { data: conmigo }] = await Promise.all([
    db.from('html').select(COLUMNAS).eq('dueno', sesion.userId).order('creado_en', { ascending: false }).limit(1000),
    db.from('chat').select('id, titulo'),
    db.from('compartido').select('objeto_id').eq('con', sesion.userId).eq('tipo', 'html'),
  ])
  const ids = (conmigo ?? []).map((c) => c.objeto_id)
  const { data: recibidos } = ids.length ? await db.from('html').select(COLUMNAS).in('id', ids) : { data: [] as Version[] }
  const tituloChat = new Map((chats ?? []).map((c) => [c.id, c.titulo]))
  // Un artefacto = su grupo; la fila es su última versión.
  const porGrupo = new Map<string, Version[]>()
  for (const v of (propios ?? []) as Version[]) porGrupo.set(v.grupo, [...(porGrupo.get(v.grupo) ?? []), v])
  const filas = [...porGrupo.values()].map((vs) => ({ ultima: vs.reduce((a, b) => (b.version > a.version ? b : a)), versiones: vs.length }))
  const etiqueta = (tipo: string) => ETIQUETA_CLASE[tipo as ClaseArtefacto] ?? tipo

  const acciones = (v: Version, propio: boolean) => (
    <span className="inline-flex items-center gap-1.5">
      {v.tipo !== 'documento' && (
        <a href={`/sistema/asistente/html/${v.id}`} target="_blank" rel="noopener" className="btn-neutro h-7 px-2.5 text-[12px]">
          Abrir
        </a>
      )}
      <a href={`/sistema/asistente/html/${v.id}?descargar=1`} className="btn-neutro h-7 px-2.5 text-[12px]">
        Descargar
      </a>
      {propio && <BorrarArchivo tipo="html" id={v.id} nombre={v.titulo} />}
    </span>
  )

  return (
    <>
      <CabeceraModulo
        sesion={sesion}
        codigo="MI-ASI"
        titulo="Asistente de IA"
        migas={[{ etiqueta: 'Artefactos' }]}
        descripcion="Los tableros, gráficos y documentos que creó el asistente, cada uno en su última versión. En su chat se abren al costado y se siguen actualizando."
      />
      <section className="relative overflow-x-auto rounded-xl border border-[var(--borde)] bg-white" data-artefactos>
        {filas.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-marca-500">Todavía no hay artefactos. Pídele al asistente un tablero, un gráfico o un documento y aparecerá aquí.</p>
        ) : (
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="border-b border-[var(--borde)] bg-marca-50 text-left text-[12px] text-marca-600">
              <tr>
                <th className="px-4 py-2 font-semibold">Artefacto</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Versión</th>
                <th className="px-3 py-2 font-semibold">Chat</th>
                <th className="px-3 py-2 font-semibold">Actualizado</th>
                <th className="px-4 py-2 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ ultima: v, versiones }) => (
                <tr key={v.grupo} className="border-b border-[var(--borde)] last:border-0">
                  <td className="max-w-[320px] truncate px-4 py-2 font-medium text-marca-900" title={v.titulo}>
                    {v.titulo}
                  </td>
                  <td className="px-3 py-2 text-marca-600">{etiqueta(v.tipo)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-marca-600">
                    v{v.version}
                    {versiones > 1 ? ` · ${versiones} versiones` : ''}
                  </td>
                  <td className="max-w-[220px] truncate px-3 py-2">
                    {v.chat_id && tituloChat.has(v.chat_id) ? (
                      <Link href={`/sistema/asistente/c/${v.chat_id}`} className="text-acento-700 hover:underline">
                        {tituloChat.get(v.chat_id)}
                      </Link>
                    ) : (
                      <span className="text-marca-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-marca-600">
                    {fechaHora(v.creado_en)} · {bytesLegibles(Number(v.bytes))}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">{acciones(v, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {(recibidos ?? []).length > 0 && (
        <section className="mt-4 rounded-xl border border-[var(--borde)] bg-white">
          <header className="border-b border-[var(--borde)] px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-marca-900">Compartidos conmigo</h2>
          </header>
          <ul className="px-4 py-2 text-[13px]">
            {((recibidos ?? []) as Version[]).map((v) => (
              <li key={v.id} className="flex items-center gap-2 border-b border-[var(--borde)] py-1.5 last:border-0">
                <span className="min-w-0 flex-1 truncate text-marca-900">
                  {v.titulo} (v{v.version})
                </span>
                {acciones(v, false)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
