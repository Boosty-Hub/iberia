'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EVENTO_PREGUNTAR_IA, EVENTO_VENTANA_IA } from '@/components/sistema/ia/abrir'
import { ChatAsistente } from './chat'
import { datosPanelAsistente, type DatosPanel } from './acciones-panel'
import { cn } from '@/lib/utils'

/** La pantalla en que está la persona, en palabras: el título de la página, su ruta y la ficha o fecha abiertas. */
function pantallaActual(): string {
  if (typeof document === 'undefined') return ''
  const titulo = document.title.replace(/ · (Plataforma|Programa de IA)[^·]*$/, '').trim()
  const h1 = document.querySelector('main h1')?.textContent?.trim()
  const sp = new URLSearchParams(location.search)
  const extra = [sp.get('ficha') ? `ficha abierta: ${sp.get('ficha')}` : '', sp.get('al') ? `datos al ${sp.get('al')}` : '', sp.get('esc') ? 'en un escenario' : ''].filter(Boolean)
  return `${h1 && h1 !== titulo ? `${h1} · ` : ''}${titulo} (${location.pathname}${extra.length ? `; ${extra.join('; ')}` : ''})`
}

/**
 * El asistente fuera de su pantalla (26-nov-2026), montado en el layout de `/sistema`:
 * - **Panel lateral** («Preguntar a la IA» desde la cabecera de un módulo, la pestaña IA de una ficha o Ctrl K, evento
 *   `preguntar-ia`): se abre al costado con el contexto de dónde se pregunta, que va con el primer mensaje.
 * - **Ventana flotante** («Abrir en ventana», evento `asistente-ventana`): queda abierta mientras se navega (el layout
 *   no se desmonta), se mueve y se minimiza, y CADA mensaje le dice al asistente en qué pantalla está la persona.
 * Pasar de panel a ventana no pierde la conversación: es el mismo chat con otro marco.
 */
export function PanelAsistente() {
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<'panel' | 'ventana'>('panel')
  const [minimizado, setMinimizado] = useState(false)
  const [datos, setDatos] = useState<DatosPanel | null>(null)
  const [pedido, setPedido] = useState<{ pregunta: string; contexto: string; n: number }>({ pregunta: '', contexto: '', n: 0 })
  const [chatId, setChatId] = useState<string | null>(null)
  const [pos, setPos] = useState({ derecha: 20, abajo: 20 })
  const arrastre = useRef<{ x: number; y: number; derecha: number; abajo: number } | null>(null)
  const ruta = usePathname()
  const [aqui, setAqui] = useState('')
  const abiertoRef = useRef(false)
  useEffect(() => {
    abiertoRef.current = abierto
  }, [abierto])

  // La pantalla actual, para el rótulo de la ventana (el título de la página cambia un instante después de navegar).
  useEffect(() => {
    if (!abierto || modo !== 'ventana') return
    const t = setTimeout(() => setAqui(pantallaActual()), 400)
    return () => clearTimeout(t)
  }, [ruta, abierto, modo])

  useEffect(() => {
    const cargar = (chat: string | null = null) => void datosPanelAsistente(chat).then(setDatos)
    const preguntar = (e: Event) => {
      const d = (e as CustomEvent<{ pregunta?: string; contexto?: string }>).detail ?? {}
      const contexto = d.contexto?.trim() || pantallaActual()
      setPedido((p) => ({ pregunta: d.pregunta?.trim() ?? '', contexto, n: p.n + 1 }))
      setChatId(null)
      setMinimizado(false)
      setAbierto(true)
      cargar()
    }
    const ventana = (e: Event) => {
      const desde = (e as CustomEvent<{ chatId?: string | null }>).detail?.chatId ?? null
      setModo('ventana')
      setMinimizado(false)
      // Desde un chat abierto, la ventana sigue ese chat. Si ya había uno en el panel, sigue ese; si no, uno nuevo.
      if (desde || !abiertoRef.current) {
        setDatos(null)
        setPedido((p) => ({ pregunta: '', contexto: '', n: p.n + 1 }))
        setChatId(desde)
        cargar(desde)
      }
      setAbierto(true)
    }
    window.addEventListener(EVENTO_PREGUNTAR_IA, preguntar)
    window.addEventListener(EVENTO_VENTANA_IA, ventana)
    return () => {
      window.removeEventListener(EVENTO_PREGUNTAR_IA, preguntar)
      window.removeEventListener(EVENTO_VENTANA_IA, ventana)
    }
  }, [])

  useEffect(() => {
    if (!abierto || modo !== 'panel') return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[aria-label="Cerrar el artefacto"]') && setAbierto(false)
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [abierto, modo])

  const contextoVivo = useCallback(() => pantallaActual(), [])
  const cerrar = () => {
    setAbierto(false)
    setModo('panel')
  }

  if (!abierto) return null
  const ventana = modo === 'ventana'
  return (
    <>
      {ventana && minimizado && (
        <button
          type="button"
          onClick={() => setMinimizado(false)}
          className="fixed right-5 bottom-5 z-[60] inline-flex h-11 items-center gap-2 rounded-full bg-[#2b2a28] px-4 text-[13px] font-semibold text-white shadow-xl hover:bg-marca-700"
          data-ventana-minimizada
        >
          ✦ Asistente de IA
        </button>
      )}
      <div className={cn('fixed z-[60]', ventana ? 'pointer-events-none inset-0' : 'inset-0 flex justify-end', ventana && minimizado && 'hidden')} data-panel-asistente data-modo={modo}>
        {!ventana ? <button type="button" aria-label="Cerrar el asistente" className="absolute inset-0 bg-marca-900/20" onClick={cerrar} /> : null}
        <aside
          role="dialog"
          aria-label="Asistente de IA"
          className={cn(
            'flex flex-col bg-[#f6f7f9]',
            ventana
              ? 'pointer-events-auto absolute inset-0 overflow-hidden border border-[var(--borde)] shadow-2xl sm:inset-auto sm:h-[min(640px,calc(100dvh-90px))] sm:w-[min(440px,calc(100vw-40px))] sm:rounded-2xl'
              : 'relative h-full w-full max-w-[600px] shadow-2xl'
          )}
          style={ventana ? { right: pos.derecha, bottom: pos.abajo } : undefined}
        >
          <header
            className={cn('flex items-center gap-1.5 border-b border-[var(--borde)] bg-white px-3 py-2', ventana && 'cursor-move select-none sm:touch-none')}
            onPointerDown={(e) => {
              if (!ventana || (e.target as HTMLElement).closest('button, a')) return
              arrastre.current = { x: e.clientX, y: e.clientY, ...pos }
              ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
            }}
            onPointerMove={(e) => {
              const a = arrastre.current
              if (!a) return
              setPos({
                derecha: Math.min(Math.max(0, a.derecha - (e.clientX - a.x)), window.innerWidth - 200),
                abajo: Math.min(Math.max(0, a.abajo - (e.clientY - a.y)), window.innerHeight - 120),
              })
            }}
            onPointerUp={() => (arrastre.current = null)}
          >
            <span className="shrink-0 text-[13px] font-semibold text-marca-900">✦ Asistente</span>
            {(ventana ? aqui : pedido.contexto) && (
              <span className="min-w-0 flex-1 truncate rounded-full bg-[#f3f1fb] px-2.5 py-0.5 text-[11.5px] text-[#4f4577]" title={ventana ? aqui : pedido.contexto} data-desde>
                {ventana ? 'Viendo' : 'Desde'}: {ventana ? aqui : pedido.contexto}
              </span>
            )}
            <span className="flex-1" />
            {!ventana && (
              <button type="button" className="btn-neutro h-8 px-2.5 text-[12px]" onClick={() => setModo('ventana')} title="Seguir navegando con el chat abierto">
                Abrir en ventana
              </button>
            )}
            <button
              type="button"
              className="btn-neutro h-8 px-2.5 text-[12px]"
              onClick={() => {
                setChatId(null)
                setPedido((p) => ({ ...p, pregunta: '', n: p.n + 1 }))
              }}
            >
              Nuevo
            </button>
            <Link href={chatId ? `/sistema/asistente/c/${chatId}` : '/sistema/asistente'} className="btn-neutro hidden h-8 px-2.5 text-[12px] sm:inline-flex" onClick={cerrar}>
              {ventana ? (
                <>
                  ⤢<span className="sr-only"> Pantalla completa</span>
                </>
              ) : (
                'Pantalla completa'
              )}
            </Link>
            {ventana && (
              <button type="button" className="btn-neutro h-8 w-8 px-0 text-[13px]" onClick={() => setMinimizado(true)} aria-label="Minimizar el asistente">
                –
              </button>
            )}
            <button type="button" className="btn-neutro h-8 w-8 px-0 text-[12px]" onClick={cerrar} aria-label="Cerrar el asistente">
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
                contextoVivo={ventana ? contextoVivo : undefined}
                preguntaInicial={pedido.pregunta}
                alCrearChat={setChatId}
                yo={datos.yo}
                politica={datos.politica}
                modelos={datos.modelos}
                chats={[]}
                chatId={datos.abierto?.id ?? null}
                tituloInicial={datos.abierto?.titulo ?? null}
                mensajesIniciales={datos.abierto?.mensajes ?? []}
                archivosIniciales={datos.abierto?.archivos ?? []}
                turnoInicial={datos.abierto?.turno ?? null}
                modeloDelChat={datos.abierto?.modelo ?? null}
                esfuerzoDelChat={datos.abierto?.esfuerzo ?? null}
                proyecto={datos.abierto?.proyecto ?? null}
                compartido={datos.abierto?.compartido ?? false}
                esDueno={datos.abierto?.esDueno ?? true}
                participantes={datos.abierto?.participantes ?? []}
                fuentesDelChat={datos.abierto?.fuentes ?? []}
                atajos={datos.atajos}
                tareasProgramadas={datos.abierto?.tareasProgramadas ?? []}
                deTarea={datos.abierto?.deTarea ?? null}
                capacidades={datos.capacidades}
              />
            )}
          </div>
        </aside>
      </div>
    </>
  )
}
