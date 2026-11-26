'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { EVENTO_PREGUNTAR_IA } from '@/components/sistema/ia/abrir'
import { ChatAsistente } from './chat'
import { datosPanelAsistente, type DatosPanel } from './acciones-panel'

/**
 * «Preguntar a la IA» desde cualquier pantalla (26-nov-2026): el asistente al
 * costado, sin salir de la página, con el contexto de dónde se pregunta. Lo
 * abren la cabecera de cada módulo, la pestaña IA de una ficha y Ctrl K (evento
 * `preguntar-ia`). Reemplaza el panel viejo de NUC-PRO-IA-01: el asistente ya
 * responde sobre procesos, estructura y documentos con alcance y citas.
 */
export function PanelAsistente() {
  const [abierto, setAbierto] = useState(false)
  const [datos, setDatos] = useState<DatosPanel | null>(null)
  const [pedido, setPedido] = useState<{ pregunta: string; contexto: string; n: number }>({ pregunta: '', contexto: '', n: 0 })
  const [chatId, setChatId] = useState<string | null>(null)

  useEffect(() => {
    const abrir = (e: Event) => {
      const d = (e as CustomEvent<{ pregunta?: string; contexto?: string }>).detail ?? {}
      const contexto = d.contexto?.trim() || (typeof document !== 'undefined' ? `${document.title.replace(/ · .*$/, '')} (${location.pathname})` : '')
      setPedido((p) => ({ pregunta: d.pregunta?.trim() ?? '', contexto, n: p.n + 1 }))
      setChatId(null)
      setAbierto(true)
      void datosPanelAsistente().then(setDatos)
    }
    window.addEventListener(EVENTO_PREGUNTAR_IA, abrir)
    return () => window.removeEventListener(EVENTO_PREGUNTAR_IA, abrir)
  }, [])

  useEffect(() => {
    if (!abierto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[aria-label="Cerrar el artefacto"]') && setAbierto(false)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" data-panel-asistente>
      <button type="button" aria-label="Cerrar el asistente" className="absolute inset-0 bg-marca-900/20" onClick={() => setAbierto(false)} />
      <aside role="dialog" aria-label="Asistente de IA" className="relative flex h-full w-full max-w-[600px] flex-col bg-[#f6f7f9] shadow-2xl">
        <header className="flex items-center gap-2 border-b border-[var(--borde)] bg-white px-3 py-2">
          <span className="text-[13px] font-semibold text-marca-900">✦ Asistente de IA</span>
          {pedido.contexto && (
            <span className="min-w-0 flex-1 truncate rounded-full bg-[#f3f1fb] px-2.5 py-0.5 text-[11.5px] text-[#4f4577]" title={pedido.contexto}>
              Desde: {pedido.contexto}
            </span>
          )}
          <span className="flex-1" />
          <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => { setChatId(null); setPedido((p) => ({ ...p, pregunta: '', n: p.n + 1 })) }}>
            Nuevo
          </button>
          <Link href={chatId ? `/sistema/asistente/c/${chatId}` : '/sistema/asistente'} className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => setAbierto(false)}>
            Pantalla completa
          </Link>
          <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => setAbierto(false)} aria-label="Cerrar el asistente">
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 p-2.5">
          {!datos ? (
            <p className="p-4 text-[13px] text-marca-500">Abriendo el asistente…</p>
          ) : !datos.ok ? (
            <p className="m-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] text-amber-900">{datos.motivo}</p>
          ) : (
            <ChatAsistente
              key={pedido.n}
              compacto
              contexto={pedido.contexto}
              preguntaInicial={pedido.pregunta}
              alCrearChat={setChatId}
              yo={datos.yo}
              politica={datos.politica}
              modelos={datos.modelos}
              chats={[]}
              chatId={null}
              tituloInicial={null}
              mensajesIniciales={[]}
              archivosIniciales={[]}
              turnoInicial={null}
              modeloDelChat={null}
              esfuerzoDelChat={null}
              proyecto={null}
              compartido={false}
              esDueno
              participantes={[]}
              fuentesDelChat={[]}
              atajos={datos.atajos}
              tareasProgramadas={[]}
              deTarea={null}
              capacidades={datos.capacidades}
            />
          )}
        </div>
      </aside>
    </div>
  )
}
