'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import Image from 'next/image'
import { IconoCerrar } from '@/components/iconos'

/**
 * Las láminas del señor Carlos para la entrega del 21 de octubre, para mostrarlas desde el
 * informe: «Las tres líneas de intervención» y la de desarrollo organizacional, con el
 * diseño de Iberia (pedido de Gabriel, 20 de octubre de 2026, sobre su
 * «Láminas para presentación Iberia.pptx»).
 *
 * Un botón abre un `<dialog>` modal a pantalla completa: el navegador encierra el foco y
 * cierra con Escape. Se pasa con las flechas, la barra espaciadora, un toque en la mitad
 * derecha o izquierda de la lámina, o deslizando en el teléfono. Las láminas son 16:9 y
 * el texto se mide en `cqw`, así que se ven igual en un proyector y en un teléfono.
 */

const ESCALA: CSSProperties = { containerType: 'inline-size' }
const t = (cqw: number): CSSProperties => ({ fontSize: `${cqw}cqw` })

function Marco({ titulo, numero, children }: { titulo: string; numero: number; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col bg-white" style={{ padding: '3.2cqw 4.4cqw 2.4cqw' }}>
      <div className="flex items-center justify-between" style={{ gap: '2cqw' }}>
        <Image src="/marca/iberia.png" alt="Industrias Iberia" width={1400} height={362} style={{ height: '3.4cqw', width: 'auto' }} />
        <span className="font-semibold tracking-[0.14em] text-marca-400 uppercase" style={t(1.05)}>
          Programa de adopción de IA · Lo que proponemos
        </span>
      </div>
      <h2 className="font-bold tracking-tight text-marca-900" style={{ ...t(3.6), marginTop: '2.6cqw', lineHeight: 1.1 }}>
        {titulo}
      </h2>
      <div className="min-h-0 flex-1" style={{ marginTop: '2.4cqw' }}>
        {children}
      </div>
      <div
        className="flex items-center justify-between border-t-2 border-acento-500 text-marca-400"
        style={{ ...t(1.05), paddingTop: '1cqw', marginTop: '1.6cqw' }}
      >
        <span>Industrias Iberia · Entrega de la Fase 1 · 21 de octubre de 2026</span>
        <span className="font-mono">{numero} / 2</span>
      </div>
    </div>
  )
}

function LaminaTresLineas() {
  const lineas = [
    { nombre: 'Desarrollo organizacional', puntos: ['Desarrollo humano', 'Clima organizacional'] },
    { nombre: 'Procesos y marcos de referencia', puntos: ['Documentación y difusión', 'Políticas, normas y procedimientos'] },
    { nombre: 'Tecnología', puntos: ['Implementación de la IA'], acento: true },
  ]
  return (
    <Marco titulo="Las tres líneas de intervención" numero={1}>
      <div className="grid h-full" style={{ gap: '1.4cqw', gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>
        {lineas.map((l, i) => (
          <div
            key={l.nombre}
            className="grid overflow-hidden border border-marca-200"
            style={{ gridTemplateColumns: '32% 1fr', borderRadius: '1.4cqw' }}
          >
            <div
              className={`flex flex-col justify-center text-white ${l.acento ? 'bg-acento-500' : 'bg-marca-800'}`}
              style={{ padding: '0 2.2cqw' }}
            >
              <span className="font-mono opacity-70" style={t(1.1)}>
                Línea {i + 1}
              </span>
              <span className="font-bold" style={{ ...t(2.1), lineHeight: 1.15 }}>
                {l.nombre}
              </span>
            </div>
            <ul className="flex flex-col justify-center bg-[#f6f7f9] text-marca-800" style={{ padding: '0 2.6cqw', gap: '0.6cqw' }}>
              {l.puntos.map((p) => (
                <li key={p} className="flex items-center" style={{ ...t(2), gap: '1.2cqw' }}>
                  <span className={`shrink-0 rounded-full ${l.acento ? 'bg-acento-500' : 'bg-marca-400'}`} style={{ width: '0.8cqw', height: '0.8cqw' }} />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Marco>
  )
}

function LaminaDesarrollo() {
  const frentes = [
    'Enfoque de la Dirección',
    'Activación de la Gerencia',
    'Fortalecimiento del rol supervisorio',
    'Gestión del desempeño',
    'Comunicaciones internas',
    'Actualización y dinamización de los marcos de referencia',
  ]
  return (
    <Marco titulo="Desarrollo organizacional" numero={2}>
      <div className="grid h-full" style={{ gridTemplateColumns: '30% 1fr', gap: '1.6cqw' }}>
        <div
          className="flex flex-col justify-center bg-marca-800 text-white"
          style={{ padding: '0 2.4cqw', borderRadius: '1.4cqw' }}
        >
          <span className="font-mono opacity-70" style={t(1.1)}>
            Línea 1
          </span>
          <span className="font-bold" style={{ ...t(2.5), lineHeight: 1.15 }}>
            Desarrollo organizacional
          </span>
        </div>
        <div className="grid min-h-0" style={{ gridTemplateRows: 'auto 1fr', gap: '1.4cqw' }}>
          <div className="flex flex-wrap items-center bg-oro-100" style={{ padding: '1.6cqw 2.4cqw', borderRadius: '1.4cqw', gap: '1.2cqw' }}>
            <span className="rounded-full bg-oro-300 font-bold text-marca-900" style={{ ...t(1.9), padding: '0.4cqw 1.6cqw' }}>
              Desarrollo humano
            </span>
            <span className="rounded-full bg-oro-300 font-bold text-marca-900" style={{ ...t(1.9), padding: '0.4cqw 1.6cqw' }}>
              Clima organizacional
            </span>
          </div>
          <ul
            className="flex flex-col justify-center border border-marca-200 bg-[#f6f7f9] text-marca-800"
            style={{ padding: '1.6cqw 2.6cqw', borderRadius: '1.4cqw', gap: '1cqw' }}
          >
            {frentes.map((f) => (
              <li key={f} className="flex items-center" style={{ ...t(1.85), gap: '1.3cqw', lineHeight: 1.25 }}>
                <span
                  className="shrink-0 border-acento-500"
                  style={{ width: '1.5cqw', height: '1.5cqw', borderWidth: '0.25cqw', borderRadius: '0.3cqw' }}
                />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Marco>
  )
}

const LAMINAS = [LaminaTresLineas, LaminaDesarrollo]

export function PresentacionTresLineas() {
  const dialogo = useRef<HTMLDialogElement>(null)
  const [actual, setActual] = useState(0)
  const inicioToque = useRef<number | null>(null)

  const ir = useCallback((paso: number) => {
    setActual((a) => Math.min(LAMINAS.length - 1, Math.max(0, a + paso)))
  }, [])

  useEffect(() => {
    const el = dialogo.current
    if (!el) return
    const tecla = (ev: KeyboardEvent) => {
      if (!el.open) return
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(ev.key)) {
        ev.preventDefault()
        ir(1)
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(ev.key)) {
        ev.preventDefault()
        ir(-1)
      } else if (ev.key === 'Home') setActual(0)
      else if (ev.key === 'End') setActual(LAMINAS.length - 1)
    }
    el.addEventListener('keydown', tecla)
    return () => el.removeEventListener('keydown', tecla)
  }, [ir])

  const abrir = () => {
    setActual(0)
    dialogo.current?.showModal()
  }
  const cerrar = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    dialogo.current?.close()
  }
  const pantallaCompleta = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void dialogo.current?.requestFullscreen?.().catch(() => {})
  }

  const Lamina = LAMINAS[actual]

  return (
    <>
      <button type="button" onClick={abrir} className="btn-acento" aria-haspopup="dialog">
        Presentar las láminas
      </button>

      <dialog
        ref={dialogo}
        aria-label="Láminas: las tres líneas de intervención"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-marca-950 p-0 text-white backdrop:bg-marca-950"
        onClose={() => {
          if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
        }}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 p-4">
          <div
            className="relative w-full overflow-hidden rounded-xl shadow-2xl"
            style={{ ...ESCALA, maxWidth: 'min(1600px, calc((100dvh - 120px) * 16 / 9))', aspectRatio: '16 / 9' }}
            onPointerDown={(ev) => {
              inicioToque.current = ev.clientX
            }}
            onPointerUp={(ev) => {
              const desde = inicioToque.current
              inicioToque.current = null
              if (desde === null) return
              const delta = ev.clientX - desde
              if (Math.abs(delta) > 40) return ir(delta < 0 ? 1 : -1)
              const caja = ev.currentTarget.getBoundingClientRect()
              ir(ev.clientX - caja.left > caja.width / 2 ? 1 : -1)
            }}
          >
            <Lamina />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => ir(-1)} disabled={actual === 0} className="btn-neutro h-10 px-4 disabled:opacity-40">
              ← Anterior
            </button>
            <span className="min-w-14 text-center font-mono text-marca-300" aria-live="polite">
              {actual + 1} / {LAMINAS.length}
            </span>
            <button
              type="button"
              onClick={() => ir(1)}
              disabled={actual === LAMINAS.length - 1}
              className="btn-neutro h-10 px-4 disabled:opacity-40"
            >
              Siguiente →
            </button>
            <button type="button" onClick={pantallaCompleta} className="btn-neutro ml-2 hidden h-10 px-4 sm:inline-flex">
              Pantalla completa
            </button>
            <button type="button" onClick={cerrar} className="btn-neutro h-10 w-10 p-0" aria-label="Cerrar la presentación">
              <IconoCerrar className="h-5 w-5" />
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
