import type { Metadata } from 'next'
import Link from 'next/link'
import { requerirPermiso } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { miPolitica } from '@/lib/asistente/servidor'
import { ETIQUETA_CLASE, bytesLegibles, type ClaseArtefacto } from '@/lib/asistente/tipos'
import { fechaHora } from '@/lib/plataforma/formato'
import { CabeceraModulo } from '@/components/sistema/ui/cabecera-modulo'
import { BorrarArchivo } from '@/components/sistema/asistente/borrar-archivo'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mis archivos · Asistente de IA' }

type Fila = { tipo: 'archivo' | 'html'; id: string; nombre: string; origen: string; bytes: number; chat_id: string | null; creado_en: string; version?: number; clase?: ClaseArtefacto }

/**
 * Mis archivos (fase 1): todo lo que subí y todo lo que el asistente me generó
 * —archivos y HTML—, con su chat, su tamaño y la cuota que me queda. Se guarda
 * hasta que lo borre (decisión 13).
 */
export default async function MisArchivosPage({ searchParams }: PageProps<'/sistema/asistente/archivos'>) {
  const [sesion, sp] = await Promise.all([requerirPermiso('sistema:asistente'), searchParams])
  const ver = sp.ver === 'subidos' || sp.ver === 'generados' || sp.ver === 'html' ? sp.ver : 'todos'
  const supabase = await createClient()
  const db = supabase.schema('asistente')
  const [pol, { data: archivos }, { data: htmls }, { data: chats }, { data: conmigo }] = await Promise.all([
    miPolitica(),
    db.from('archivo').select('id, nombre, origen, bytes, chat_id, creado_en').eq('dueno', sesion.userId).eq('estado', 'listo').order('creado_en', { ascending: false }).limit(500),
    db.from('html').select('id, titulo, bytes, chat_id, creado_en, version, tipo').eq('dueno', sesion.userId).order('creado_en', { ascending: false }).limit(500),
    db.from('chat').select('id, titulo'),
    db.from('compartido').select('id, tipo, objeto_id, por, creado_en').eq('con', sesion.userId).order('creado_en', { ascending: false }),
  ])
  // Lo que otros me compartieron (la RLS deja leer esas filas por `compartido_conmigo`).
  const idsArchivo = (conmigo ?? []).filter((c) => c.tipo === 'archivo').map((c) => c.objeto_id)
  const idsHtml = (conmigo ?? []).filter((c) => c.tipo === 'html').map((c) => c.objeto_id)
  const [{ data: aCompartidos }, { data: hCompartidos }] = await Promise.all([
    idsArchivo.length ? db.from('archivo').select('id, nombre, bytes').in('id', idsArchivo) : Promise.resolve({ data: [] }),
    idsHtml.length ? db.from('html').select('id, titulo, bytes, tipo, version').in('id', idsHtml) : Promise.resolve({ data: [] }),
  ])
  const recibidos = [
    ...(aCompartidos ?? []).map((a) => ({ tipo: 'archivo' as const, id: a.id, nombre: a.nombre, bytes: Number(a.bytes) })),
    ...(hCompartidos ?? []).map((h) => ({ tipo: 'html' as const, id: h.id, nombre: `${h.titulo} (v${h.version})`, bytes: Number(h.bytes) })),
  ]
  const tituloChat = new Map((chats ?? []).map((c) => [c.id, c.titulo]))
  const filas: Fila[] = [
    ...(archivos ?? []).map((a) => ({ tipo: 'archivo' as const, id: a.id, nombre: a.nombre, origen: a.origen, bytes: Number(a.bytes), chat_id: a.chat_id, creado_en: a.creado_en })),
    ...(htmls ?? []).map((h) => ({ tipo: 'html' as const, id: h.id, nombre: h.titulo, origen: 'html', bytes: Number(h.bytes), chat_id: h.chat_id, creado_en: h.creado_en, version: h.version, clase: h.tipo as ClaseArtefacto })),
  ]
    .filter((f) => ver === 'todos' || (ver === 'html' ? f.tipo === 'html' : f.tipo === 'archivo' && f.origen === (ver === 'subidos' ? 'subido' : 'generado')))
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
  const usado = pol?.usado_bytes ?? 0
  const cuota = (pol?.cuota_mb ?? 0) * 1024 * 1024
  const pct = cuota ? Math.min(100, (usado / cuota) * 100) : 0
  const chip = (activo: boolean) =>
    cn('inline-flex h-8 items-center rounded-full border px-3 text-xs', activo ? 'border-[#2b2a28] bg-[#2b2a28] font-semibold text-white' : 'border-[var(--borde)] bg-white text-marca-700 hover:bg-marca-50')
  const ETIQUETA = { todos: 'Todos', subidos: 'Subidos', generados: 'Generados', html: 'Artefactos' } as const

  return (
    <>
      <CabeceraModulo sesion={sesion} codigo="MI-ASI" titulo="Asistente de IA" migas={[{ etiqueta: 'Mis archivos' }]} descripcion="Lo que subiste y lo que el asistente te generó. Se guarda hasta que lo borres." />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <nav aria-label="Qué ver" className="flex flex-wrap gap-1.5">
          {(['todos', 'subidos', 'generados', 'html'] as const).map((v) => (
            <Link key={v} href={v === 'todos' ? '/sistema/asistente/archivos' : `/sistema/asistente/archivos?ver=${v}`} className={chip(ver === v)} aria-current={ver === v ? 'page' : undefined}>
              {ETIQUETA[v]}
            </Link>
          ))}
        </nav>
        <div className="ml-auto min-w-[220px] text-[12px] text-marca-500">
          <div className="flex justify-between gap-3">
            <span>Espacio usado</span>
            <span>
              {bytesLegibles(usado)} de {bytesLegibles(cuota)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-marca-100" aria-hidden>
            <div className={cn('h-full rounded-full', pct > 85 ? 'bg-amber-500' : 'bg-marca-500')} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <section className="relative overflow-x-auto rounded-xl border border-[var(--borde)] bg-white">
        {filas.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-marca-400">Todavía no hay nada aquí.</p>
        ) : (
          <table className="w-full min-w-[720px] text-[13px]">
            <thead className="border-b border-[var(--borde)] bg-marca-50 text-left text-[12px] text-marca-600">
              <tr>
                <th className="px-4 py-2 font-semibold">Nombre</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 text-right font-semibold">Tamaño</th>
                <th className="px-3 py-2 font-semibold">Chat</th>
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-4 py-2 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.tipo}-${f.id}`} className="border-b border-[var(--borde)] last:border-0">
                  <td className="max-w-[320px] truncate px-4 py-2 font-medium text-marca-900">{f.nombre}</td>
                  <td className="px-3 py-2 text-marca-600">{f.tipo === 'html' ? `Artefacto · ${ETIQUETA_CLASE[f.clase ?? 'html']} · v${f.version}` : f.origen === 'subido' ? 'Subido' : 'Generado'}</td>
                  <td className="px-3 py-2 text-right text-marca-600">{bytesLegibles(f.bytes)}</td>
                  <td className="max-w-[220px] truncate px-3 py-2">
                    {f.chat_id && tituloChat.has(f.chat_id) ? (
                      <Link href={`/sistema/asistente/c/${f.chat_id}`} className="text-acento-700 hover:underline">
                        {tituloChat.get(f.chat_id)}
                      </Link>
                    ) : (
                      <span className="text-marca-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-marca-600">{fechaHora(f.creado_en)}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {f.tipo === 'html' ? (
                        <>
                          {f.clase !== 'documento' && (
                            <a href={`/sistema/asistente/html/${f.id}`} target="_blank" rel="noopener" className="btn-neutro h-7 px-2.5 text-[12px]">
                              Abrir
                            </a>
                          )}
                          <a href={`/sistema/asistente/html/${f.id}?descargar=1`} className="btn-neutro h-7 px-2.5 text-[12px]">
                            Descargar
                          </a>
                        </>
                      ) : (
                        <a href={`/sistema/asistente/archivo/${f.id}`} className="btn-neutro h-7 px-2.5 text-[12px]">
                          Descargar
                        </a>
                      )}
                      <BorrarArchivo tipo={f.tipo} id={f.id} nombre={f.nombre} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {recibidos.length > 0 && (
        <section className="mt-4 rounded-xl border border-[var(--borde)] bg-white">
          <header className="border-b border-[var(--borde)] px-4 py-2.5">
            <h2 className="text-[13px] font-semibold text-marca-900">Compartido conmigo</h2>
          </header>
          <ul className="px-4 py-2 text-[13px]">
            {recibidos.map((r) => (
              <li key={`${r.tipo}-${r.id}`} className="flex items-center gap-2 border-b border-[var(--borde)] py-1.5 last:border-0">
                <span className="min-w-0 flex-1 truncate text-marca-900">{r.nombre}</span>
                <span className="text-[12px] text-marca-500">{bytesLegibles(r.bytes)}</span>
                <a href={r.tipo === 'html' ? `/sistema/asistente/html/${r.id}` : `/sistema/asistente/archivo/${r.id}`} target={r.tipo === 'html' ? '_blank' : undefined} rel="noopener" className="btn-neutro h-7 px-2.5 text-[12px]">
                  {r.tipo === 'html' ? 'Abrir' : 'Descargar'}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
